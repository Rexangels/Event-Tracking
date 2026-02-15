"""
Authentication module - User roles and permissions for Sentinel
"""

from django.contrib.auth.models import User, Group, Permission
from django.db import models


def setup_user_roles():
    """
    Create default user roles and assign permissions.
    Call this once during initial migration or setup.
    """
    
    # Create role groups
    admin_group, _ = Group.objects.get_or_create(name='Admin')
    officer_group, _ = Group.objects.get_or_create(name='Officer')
    public_group, _ = Group.objects.get_or_create(name='Public')
    supervisor_group, _ = Group.objects.get_or_create(name='Supervisor')
    analyst_group, _ = Group.objects.get_or_create(name='Analyst')
    
    # Get all permissions
    perms = {p.codename: p for p in Permission.objects.all()}
    
    # Admin: full access
    admin_perms = [
        'add_hazardreport', 'change_hazardreport', 'delete_hazardreport', 'view_hazardreport',
        'add_formtemplate', 'change_formtemplate', 'delete_formtemplate', 'view_formtemplate',
        'add_officeerassignment', 'change_officeerassignment', 'delete_officeerassignment', 'view_officeerassignment',
        'add_formsubmission', 'change_formsubmission', 'delete_formsubmission', 'view_formsubmission',
        'add_user', 'change_user', 'delete_user', 'view_user',
    ]
    admin_group.permissions.set([perms.get(p) for p in admin_perms if p in perms])
    
    # Officer: can view and update reports, submit forms
    officer_perms = [
        'view_hazardreport', 'change_hazardreport',
        'view_officeerassignment', 'change_officeerassignment',
        'add_formsubmission', 'change_formsubmission', 'view_formsubmission',
        'view_formtemplate',
    ]
    officer_group.permissions.set([perms.get(p) for p in officer_perms if p in perms])
    
    # Public: can create reports
    public_perms = [
        'add_hazardreport', 'view_hazardreport',
    ]
    public_group.permissions.set([perms.get(p) for p in public_perms if p in perms])

    # Supervisor: review + assignment governance
    supervisor_perms = [
        'view_hazardreport', 'change_hazardreport',
        'view_officeerassignment', 'change_officeerassignment',
        'view_formsubmission', 'change_formsubmission',
        'view_auditlog'
    ]
    supervisor_group.permissions.set([perms.get(p) for p in supervisor_perms if p in perms])

    # Analyst: read-only operational view
    analyst_perms = [
        'view_hazardreport',
        'view_formsubmission',
        'view_officeerassignment',
        'view_auditlog',
    ]
    analyst_group.permissions.set([perms.get(p) for p in analyst_perms if p in perms])
    
    print("✅ User roles created: Admin, Supervisor, Analyst, Officer, Public")


class UserRole(models.TextChoices):
    """User role choices"""
    ADMIN = 'admin', 'Administrator'
    SUPERVISOR = 'supervisor', 'Supervisor'
    ANALYST = 'analyst', 'Analyst'
    OFFICER = 'officer', 'Field Officer'
    PUBLIC = 'public', 'Public User'


class UserProfile(models.Model):
    """Extended user profile with roles and organization"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.PUBLIC
    )
    organization = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    location = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
    
    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"
    
    def is_admin(self):
        return self.role == UserRole.ADMIN
    
    def is_officer(self):
        return self.role == UserRole.OFFICER
    
    def is_public(self):
        return self.role == UserRole.PUBLIC
