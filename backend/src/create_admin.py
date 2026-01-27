
import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

username = 'admin'
password = 'admin'
email = 'admin@example.com'

try:
    if User.objects.filter(username=username).exists():
        user = User.objects.get(username=username)
        user.set_password(password)
        user.save()
        print(f"Updated password for existing user '{username}' to '{password}'")
    else:
        User.objects.create_superuser(username, email, password)
        print(f"Created new superuser '{username}' with password '{password}'")
except Exception as e:
    print(f"Error: {e}")
