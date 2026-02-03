# 🚀 Sentinel Development Setup Guide

**Quick Setup for Demo** ⏱️ ~30 minutes

---

## Part 1: PostgreSQL + PostGIS Installation (Windows)

### 1.1 Install PostgreSQL 15/16

**Download**:
- Visit: https://www.postgresql.org/download/windows/
- Click "Interactive installer by EDB"
- Download PostgreSQL 15 or 16

**Installation Steps**:
1. Run the installer
2. Choose installation directory (e.g., `C:\Program Files\PostgreSQL\16`)
3. **Set superuser password**: `postgres` (or your preference)
4. Port: `5432` (default)
5. ✅ Check "Install pgAdmin 4" (optional but useful)

**Verify Installation**:
```powershell
# Open PowerShell
psql --version
# Output: psql (PostgreSQL) 16.x ...
```

---

### 1.2 Install PostGIS Extension

**Download**:
- Visit: https://postgis.net/windows/downloads/
- Download: PostGIS 3.4 for PostgreSQL 16 (or your version)

**Installation**:
1. Run PostGIS installer
2. Choose PostgreSQL installation path (should auto-detect)
3. Select all components
4. Complete installation

**Verify PostGIS**:
```powershell
psql -U postgres -h localhost
```

In the `psql` prompt:
```sql
CREATE EXTENSION postgis;
SELECT postgis_version();
-- Output: POSTGIS="3.4.0 ..."
```

---

### 1.3 Create Sentinel Database

```powershell
# Connect to PostgreSQL
psql -U postgres -h localhost

# Inside psql prompt:
CREATE DATABASE sentinel_db;
\c sentinel_db
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
\q
```

✅ **Database ready!**

---

## Part 2: Backend Setup

### 2.1 Install Python Packages

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Key packages added**:
- ✅ `psycopg2-binary` - PostgreSQL adapter
- ✅ `django-guardian` - Fine-grained permissions
- ✅ `djangorestframework-simplejwt` - JWT authentication
- ✅ `channels-redis` - Production WebSockets

---

### 2.2 Configure Environment

```powershell
# Copy .env template
copy .env.example .env

# Edit .env with your PostgreSQL credentials
# Open with your editor and update:
```

**Content of `.env`**:
```bash
DEBUG=False
SECRET_KEY=your-very-secret-key-change-this
ALLOWED_HOSTS=localhost,127.0.0.1

DB_ENGINE=django.contrib.gis.db.backends.postgis
DB_NAME=sentinel_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

### 2.3 Generate Secret Key

```powershell
cd src

# Generate a production secret key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
# Copy the output and paste into .env as SECRET_KEY
```

---

### 2.4 Run Migrations

```powershell
# From backend/src directory
python manage.py migrate

# Output should show:
# Running migrations:
#   Applying contenttypes.0001_initial... OK
#   Applying auth.0001_initial... OK
#   ...
#   Applying infrastructure.0001_initial_userprofile... OK
```

---

### 2.5 Create Superuser

```powershell
python manage.py createsuperuser

# Follow prompts:
# Username: admin
# Email: admin@sentinel.local
# Password: [enter secure password]
# Password (again): [confirm]
```

---

### 2.6 Setup User Roles (Admin, Officer, Public)

```powershell
python manage.py shell

# Inside Python shell:
>>> from infrastructure.auth import setup_user_roles
>>> setup_user_roles()
# Output: ✅ User roles created: Admin, Officer, Public

>>> exit()
```

---

## Part 3: Frontend Setup

### 3.1 Install Node Packages

```powershell
cd frontend
npm install
```

---

## Part 4: Running the Application

### Terminal 1: Backend Server

```powershell
cd backend/src
python manage.py runserver 0.0.0.0:8000

# Output:
# Django version 6.0.1
# Starting development server at http://127.0.0.1:8000/
```

### Terminal 2: Frontend Dev Server

```powershell
cd frontend
npm run dev

# Output:
# ➜  Local:   http://localhost:5173/
# ➜  Press q to quit
```

---

## Part 5: Testing the Setup

### ✅ Check Backend API

```powershell
# In a new terminal:
curl http://localhost:8000/api/v1/auth/users/me/ -H "Authorization: Bearer YOUR_TOKEN"

# Or test login:
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"your-password\"}"

# Response will include access_token
```

### ✅ Check Frontend

Visit: http://localhost:5173

Should see Sentinel login page

---

## Part 6: Login Workflow

1. **Admin Login**:
   - Username: `admin`
   - Password: [your superuser password]
   - Role: Administrator
   - Access: Full admin dashboard + all features

2. **Create Officer User** (via Django Admin):
   - Go to: http://localhost:8000/admin/
   - Users → Add User
   - Username: `officer1`
   - Password: [set password]
   - Go to UserProfile → Add Profile
   - Role: Officer
   - Organization: [your org]

3. **Create Public User**:
   - Via `/api/v1/auth/users/` endpoint or Django Admin
   - Role: Public
   - Can only create/view reports

---

## 🎯 Demo Script

For your demo, here's what to show:

### Step 1: Show Multiple User Logins
```
1. Login as Admin → See admin dashboard
2. Logout
3. Login as Officer → See officer dashboard (different view)
4. Logout
5. Show public user access (limited permissions)
```

### Step 2: Create Event
```
1. Create a new environmental hazard report
2. Add location (should now use PostGIS for mapping)
3. Upload media
4. Submit
```

### Step 3: Officer Workflow
```
1. As officer, view assigned reports
2. Add inspection form
3. Mark as resolved
```

### Step 4: Admin Features
```
1. View all events on map
2. See event statistics
3. Manage users/roles
```

---

## ⚠️ Troubleshooting

### PostgreSQL not connecting
```
# Check if PostgreSQL is running
psql -U postgres -h localhost

# If fails, start PostgreSQL service:
# Windows: Services → PostgreSQL 16 server → Start

# Check connection string in .env
DB_HOST=localhost
DB_PORT=5432
```

### Migration errors
```
# Reset database (dev only!)
psql -U postgres -h localhost
DROP DATABASE sentinel_db;
CREATE DATABASE sentinel_db;
\c sentinel_db
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
\q

# Then run migrations again
python manage.py migrate
```

### Port already in use
```
# Backend (change port):
python manage.py runserver 0.0.0.0:8001

# Frontend (change port):
npm run dev -- --port 5174
```

### CORS errors in frontend
```
# Check CORS_ALLOWED_ORIGINS in .env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Restart backend after editing
```

---

## 📋 Checklist

- [ ] PostgreSQL 15/16 installed
- [ ] PostGIS extension installed
- [ ] `sentinel_db` database created
- [ ] Backend venv activated
- [ ] `requirements.txt` installed
- [ ] `.env` configured with DB credentials
- [ ] Migrations run successfully
- [ ] Superuser created
- [ ] User roles setup complete
- [ ] Frontend packages installed
- [ ] Backend server running on :8000
- [ ] Frontend dev server running on :5173
- [ ] Can login with admin credentials
- [ ] Can create and view events

---

## 🚀 Next: Advanced Setup (Optional)

After basic demo works:

### Add Redis (for production-grade WebSockets)

```powershell
# Download Redis for Windows
# https://github.com/microsoftarchive/redis/releases

# Or use WSL2:
# wsl -d Ubuntu
# sudo apt install redis-server
# redis-server
```

### Docker Setup (for easy deployment)

```powershell
# Coming next...
```

---

**Questions?** Check logs:
```powershell
# Django logs
tail -f backend/src/*.log

# Browser console
F12 in frontend
```
