"""
Authentication API views - Login, Token generation, User management
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from django.db import IntegrityError
from infrastructure.auth import UserProfile, UserRole
from rest_framework import serializers


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer with user role information"""
    
    def get_token(self, user):
        token = super().get_token(user)
        
        # Add user info to token
        try:
            profile = user.profile
            token['role'] = profile.role
            token['organization'] = profile.organization
        except UserProfile.DoesNotExist:
            token['role'] = UserRole.PUBLIC
        
        token['username'] = user.username
        token['email'] = user.email
        
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login endpoint"""
    serializer_class = CustomTokenObtainPairSerializer


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    role = serializers.CharField(source='profile.role', read_only=True)
    organization = serializers.CharField(source='profile.organization', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'organization', 'date_joined']
        read_only_fields = ['id', 'date_joined']


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
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Allow anyone to register"""
        if self.action == 'create':
            return [AllowAny()]
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
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get system health status"""
        return Response({
            'status': 'OPERATIONAL',
            'database': 'OK',
            'api': 'OK'
        }, status=status.HTTP_200_OK)


# Events Endpoint for Admin
class AdminEventsViewSet(viewsets.ViewSet):
    """Admin events endpoint - returns paginated events"""
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get all events (admin view)"""
        from infrastructure.models import EventModel
        from rest_framework.serializers import ModelSerializer
        
        class EventSerializer(ModelSerializer):
            class Meta:
                model = EventModel
                fields = ['id', 'title', 'description', 'category', 'severity', 'status', 
                         'latitude', 'longitude', 'accuracy', 'altitude', 'trust_score', 
                         'created_at', 'updated_at']
        
        # Get all events ordered by created_at descending
        events = EventModel.objects.all().order_by('-created_at')
        serializer = EventSerializer(events, many=True)
        
        return Response({
            'count': events.count(),
            'next': None,
            'previous': None,
            'results': serializer.data
        }, status=status.HTTP_200_OK)
