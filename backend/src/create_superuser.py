#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from infrastructure.auth import setup_user_roles, UserProfile, UserRole

# Setup user roles first
setup_user_roles()

# Create superuser if doesn't exist
if not User.objects.filter(username='admin').exists():
    admin = User.objects.create_superuser('admin', 'admin@demo.com', 'admin123')
    # Create profile with Admin role
    UserProfile.objects.create(
        user=admin,
        role=UserRole.ADMIN,
        organization='Demo Organization'
    )
    print("✅ Superuser 'admin' created with password 'admin123'")
else:
    admin = User.objects.get(username='admin')
    # Ensure admin has a profile
    if not hasattr(admin, 'profile'):
        UserProfile.objects.create(
            user=admin,
            role=UserRole.ADMIN,
            organization='Demo Organization'
        )
        print("✅ Profile created for admin user")
    else:
        print("✅ Superuser 'admin' already exists with profile")
