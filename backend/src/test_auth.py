#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import authenticate
from django.contrib.auth.models import User

# Test authentication directly
print("Testing Django authentication...")
user = authenticate(username='admin', password='admin123')
if user:
    print(f"✅ Authentication successful for user: {user.username}")
else:
    print("❌ Authentication failed")
    
# Check if user exists
if User.objects.filter(username='admin').exists():
    print("✅ User 'admin' exists in database")
else:
    print("❌ User 'admin' does not exist")
