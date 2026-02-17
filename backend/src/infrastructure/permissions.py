"""Role-based permissions for API endpoints."""

from rest_framework.permissions import BasePermission
from infrastructure.auth import UserRole


class HasAnyRole(BasePermission):
    """Allow access if user has one of the allowed roles (or is superuser/staff)."""

    allowed_roles: set[str] = set()

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff:
            return True

        role = getattr(getattr(user, 'profile', None), 'role', None)
        return role in self.allowed_roles


class IsAdminOrSupervisor(HasAnyRole):
    allowed_roles = {UserRole.ADMIN, UserRole.SUPERVISOR}


class IsOperationsReadRole(HasAnyRole):
    """Roles allowed to read operational datasets."""

    allowed_roles = {UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALYST, UserRole.OFFICER}
