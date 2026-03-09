"""
Authentication API views - Login, Token generation, User management
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from infrastructure.permissions import IsAdminOrSupervisor
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from infrastructure.auth import UserProfile, UserRole, get_user_role
from infrastructure.health import build_health_report
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer with user role information"""

    def validate(self, attrs):
        identifier = attrs.get(self.username_field)
        if isinstance(identifier, str) and '@' in identifier:
            user_model = get_user_model()
            matched_user = user_model.objects.filter(email__iexact=identifier.strip()).order_by('id').first()
            if matched_user:
                attrs = {**attrs, self.username_field: matched_user.get_username()}

        return super().validate(attrs)
    
    def get_token(self, user):
        token = super().get_token(user)

        # Add user info to token
        token['role'] = get_user_role(user)
        try:
            profile = user.profile
            token['organization'] = profile.organization
        except UserProfile.DoesNotExist:
            token['organization'] = ''

        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login endpoint"""
    serializer_class = CustomTokenObtainPairSerializer


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    role = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'organization', 'is_staff', 'is_superuser', 'date_joined'
        ]
        read_only_fields = ['id', 'date_joined']

    def get_role(self, obj):
        return get_user_role(obj)

    def get_organization(self, obj):
        try:
            return obj.profile.organization
        except UserProfile.DoesNotExist:
            return ''


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=UserRole.choices, default=UserRole.PUBLIC)
    organization = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name', 'role', 'organization']
    
    def validate(self, data):
        if data['password'] != data.pop('password2'):
            raise serializers.ValidationError("Passwords do not match")
        return data
    
    def create(self, validated_data):
        role = validated_data.pop('role', UserRole.PUBLIC)
        organization = validated_data.pop('organization', '')
        
        try:
            user = User.objects.create_user(**validated_data)
            UserProfile.objects.create(user=user, role=role, organization=organization)
            return user
        except IntegrityError:
            raise serializers.ValidationError("Username already exists")


class UserViewSet(viewsets.ModelViewSet):
    """User management endpoint"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrSupervisor]
    
    def get_permissions(self):
        """Allow anyone to register"""
        if self.action == 'create':
            return [AllowAny()]
        if self.action in ['me', 'logout']:
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def get_serializer_class(self):
        """Use different serializer for registration"""
        if self.action == 'create':
            return RegisterSerializer
        return UserSerializer
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Logout endpoint (for token blacklisting if needed)"""
        return Response({'detail': 'Successfully logged out'}, status=status.HTTP_200_OK)


# Health Check View
class HealthCheckView(viewsets.ViewSet):
    """System health status endpoint"""
    permission_classes = [IsAdminOrSupervisor]
    
    def list(self, request):
        """Get system health status"""
        payload, http_status = build_health_report(getattr(request, 'request_id', None))
        return Response(payload, status=http_status)


# Events Endpoint for Admin
class AdminEventsViewSet(viewsets.ViewSet):
    """Admin events endpoint - returns paginated events"""
    permission_classes = [IsAdminOrSupervisor]
    
    def list(self, request):
        """Get paginated events with optional bbox, severity, and status filters."""
        from infrastructure.models import EventModel
        from interfaces.serializers import EventReportSerializer

        events = EventModel.objects.all()

        bbox_param = request.query_params.get('bbox')
        if bbox_param:
            try:
                coords = [float(value) for value in bbox_param.split(',')]
                if len(coords) == 4:
                    min_lon, min_lat, max_lon, max_lat = coords
                    events = events.filter(
                        latitude__gte=min_lat,
                        latitude__lte=max_lat,
                        longitude__gte=min_lon,
                        longitude__lte=max_lon,
                    )
            except (TypeError, ValueError):
                pass

        severity = request.query_params.get('severity')
        if severity:
            events = events.filter(severity=severity.lower())

        status_filter = request.query_params.get('status')
        if status_filter:
            events = events.filter(status=status_filter.lower())

        events = events.order_by('-created_at')

        paginator = PageNumberPagination()
        paginator.page_size = min(int(request.query_params.get('limit', 100)), 100)
        page = paginator.paginate_queryset(events, request)
        serializer = EventReportSerializer(page if page is not None else events, many=True)

        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data, status=status.HTTP_200_OK)
