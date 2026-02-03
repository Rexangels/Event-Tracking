#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

# Reset admin password
admin = User.objects.get(username='admin')
admin.set_password('admin123')
admin.save()
print("✅ Password reset for admin user to 'admin123'")

# Test authentication
from django.contrib.auth import authenticate
user = authenticate(username='admin', password='admin123')
if user:
    print(f"✅ Authentication successful!")
else:
    print("❌ Authentication still failed")
