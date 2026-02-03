#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

try:
    u = User.objects.get(username='admin')
    print(f'User: {u.username}, Active: {u.is_active}, Staff: {u.is_staff}, Superuser: {u.is_superuser}')
    print(f'Password hash: {u.password[:20]}...')
except User.DoesNotExist:
    print("Admin user not found!")
