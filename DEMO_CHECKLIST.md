# ✅ DEMO PREPARATION CHECKLIST

**Target**: Get Sentinel running with real PostgreSQL + Auth in 1-2 hours

---

## 🔴 PHASE 1: System Dependencies (30 min)

### PostgreSQL Installation
- [ ] Download PostgreSQL 15 or 16 from https://www.postgresql.org/download/windows/
- [ ] Run installer
  - [ ] Set superuser password: `postgres` (or your choice)
  - [ ] Port: `5432` (default)
  - [ ] Install pgAdmin 4: ✅ Yes
- [ ] Verify: `psql --version`
- [ ] Start PostgreSQL service (Services or auto-start)

### PostGIS Installation
- [ ] Download PostGIS 3.4 from https://postgis.net/windows/downloads/
- [ ] Run installer (will auto-detect PostgreSQL location)
- [ ] Verify: In psql, run `CREATE EXTENSION postgis; SELECT postgis_version();`

### Create Sentinel Database
```powershell
# Run these commands in PowerShell/Command Prompt
psql -U postgres -h localhost

# Then in psql:
CREATE DATABASE sentinel_db;
\c sentinel_db
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
\q
```

- [ ] Database `sentinel_db` created
- [ ] PostGIS extensions enabled

---

## 🟡 PHASE 2: Backend Setup (30 min)

### Navigate to Backend
```powershell
cd backend
```

### Create Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\activate
```

- [ ] Virtual environment created
- [ ] Activated (you should see `(venv)` in prompt)

### Install Dependencies
```powershell
pip install -r requirements.txt
```

- [ ] All packages installed successfully
- [ ] No errors in output

### Create .env Configuration
```powershell
copy .env.example .env
```

- [ ] `.env` file created in `backend/` directory

### Edit .env File
Open `.env` with your editor (VS Code) and update:

```bash
# Environment Settings
DEBUG=False
SECRET_KEY=[GENERATE THIS - see below]
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Settings
DB_ENGINE=django.contrib.gis.db.backends.postgis
DB_NAME=sentinel_db
DB_USER=postgres
DB_PASSWORD=postgres          # CHANGE if you set different password
DB_HOST=localhost
DB_PORT=5432

# Redis Settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# API/CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

- [ ] All database credentials match your PostgreSQL setup
- [ ] `SECRET_KEY` is filled in

### Generate Secret Key

```powershell
# Run this command and copy the output
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Paste the output into SECRET_KEY in .env
```

- [ ] SECRET_KEY generated and pasted into `.env`

### Run Migrations

```powershell
cd src
python manage.py migrate
```

- [ ] ✅ Output shows all migrations applied
- [ ] ❌ If error about `django.contrib.gis`, check PostGIS installation

### Create Superuser

```powershell
python manage.py createsuperuser
```

Follow prompts:
```
Username: admin
Email: admin@sentinel.local
Password: [enter secure password like: DemoPass123!]
Password (again): [confirm]
```

- [ ] Superuser `admin` created
- [ ] Password saved (use for login)

### Setup User Roles

```powershell
python manage.py shell
```

Then paste these commands:
```python
from infrastructure.auth import setup_user_roles
setup_user_roles()
exit()
```

- [ ] User roles created: Admin, Officer, Public
- [ ] See message: `✅ User roles created: Admin, Officer, Public`

### Verify Backend

```powershell
# Still in backend/src
python manage.py check
```

- [ ] Output: `System check identified no issues (0 silenced).`

---

## 🟠 PHASE 3: Frontend Setup (5 min)

### Navigate to Frontend

```powershell
cd ..\..\frontend
```

### Install Node Packages

```powershell
npm install
```

- [ ] All dependencies installed
- [ ] No major errors

---

## 🟢 PHASE 4: Start Servers (5 min)

### Terminal 1: Backend Server

```powershell
# Make sure you're in backend/src
cd backend/src
python manage.py runserver 0.0.0.0:8000
```

Expected output:
```
Django version 6.0.1
Starting ASGI application
Quit the server with CTRL-BREAK
```

- [ ] Backend running on http://localhost:8000/
- [ ] No errors in output

### Terminal 2: Frontend Dev Server

```powershell
# New terminal/PowerShell window
cd frontend
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:5173/
```

- [ ] Frontend running on http://localhost:5173/
- [ ] No errors in output

---

## 🔵 PHASE 5: Verification (10 min)

### Test 1: Admin Panel
- [ ] Visit http://localhost:8000/admin/
- [ ] Login with admin credentials
- [ ] See users, groups, permissions listed

### Test 2: API Login
```powershell
# Open new PowerShell window
curl -X POST http://localhost:8000/api/v1/auth/login/ `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"DemoPass123!"}'
```

- [ ] Response includes `"access": "eyJ0..."` token
- [ ] Response includes `"role": "admin"`

### Test 3: Get Current User
```powershell
# Copy the access token from previous response
$token = "eyJ0..." # paste your token

curl -X GET http://localhost:8000/api/v1/auth/users/me/ `
  -H "Authorization: Bearer $token"
```

- [ ] Response shows your user profile
- [ ] Shows `"role": "admin"`

### Test 4: Frontend Login
- [ ] Visit http://localhost:5173
- [ ] Login with: `admin` / `DemoPass123!`
- [ ] Should see dashboard (or appropriate UI)

---

## 📋 Demo Script (5 min)

Once everything is running, here's what to demo:

### 1. Show Admin Login
```
- Frontend: http://localhost:5173
- Login as "admin"
- Show admin dashboard
```

- [ ] Login works
- [ ] Dashboard displays

### 2. Create Test User (via API)
```powershell
curl -X POST http://localhost:8000/api/v1/auth/users/ `
  -H "Content-Type: application/json" `
  -d '{
    "username": "officer1",
    "email": "officer@sentinel.local",
    "password": "OfficerPass123!",
    "password2": "OfficerPass123!",
    "role": "officer",
    "organization": "Field Ops"
  }'
```

- [ ] Officer user created
- [ ] Response shows role: "officer"

### 3. Login as Officer
```
- Logout from admin
- Login as "officer1" / "OfficerPass123!"
- Show officer dashboard (limited features)
```

- [ ] Officer view is different from admin
- [ ] Cannot access admin functions

### 4. Show Database
```powershell
psql -U postgres -h localhost -d sentinel_db -c "\dt"
```

- [ ] Shows all tables
- [ ] Demonstrates PostgreSQL is being used

### 5. Show API Documentation
```
Visit: http://localhost:8000/api/schema/
```

- [ ] Shows API endpoints
- [ ] Demonstrates professional API structure

---

## 🆘 Troubleshooting Checklist

### "Cannot connect to PostgreSQL"
- [ ] PostgreSQL service running? (Services app or `pg_isready`)
- [ ] Username/password correct in `.env`?
- [ ] Database `sentinel_db` exists? (Check with `psql`)
- [ ] PostGIS extensions installed? (Check with `psql -d sentinel_db -c "SELECT postgis_version();"`

### "Migration failed"
- [ ] Database created? `psql -U postgres -h localhost -c "SELECT 1 FROM pg_database WHERE datname='sentinel_db';"`
- [ ] PostGIS extensions enabled? 
- [ ] Delete .env and try again with correct credentials

### "Port 8000 already in use"
```powershell
python manage.py runserver 0.0.0.0:8001  # Use different port
```

### "Port 5173 already in use"
```powershell
npm run dev -- --port 5174  # Use different port
```

### "ImportError: No module named 'psycopg2'"
```powershell
pip install psycopg2-binary
```

### "CORS error in browser console"
- [ ] Check `CORS_ALLOWED_ORIGINS` in `.env`
- [ ] Should include `http://localhost:5173`
- [ ] Restart backend after changing

### "Secret key is insecure"
- [ ] Generate new one: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- [ ] Update `.env`
- [ ] Restart backend

---

## ✅ Final Checklist

Before saying "DEMO READY":

```
System:
- [ ] PostgreSQL running
- [ ] PostGIS installed
- [ ] sentinel_db created

Backend:
- [ ] Virtual environment activated
- [ ] All packages installed
- [ ] .env configured with DB credentials
- [ ] Migrations complete
- [ ] Superuser created
- [ ] User roles set up
- [ ] Backend running on :8000
- [ ] No errors in backend console

Frontend:
- [ ] Node packages installed
- [ ] Frontend running on :5173
- [ ] No errors in frontend console

API:
- [ ] Can login and get token
- [ ] Can get current user profile
- [ ] Can access admin panel

UX:
- [ ] Frontend login page loads
- [ ] Admin can login
- [ ] Can create new users
- [ ] Officer user has limited access
- [ ] API documentation visible

Performance:
- [ ] Response times < 1 second
- [ ] No console errors
- [ ] No network errors
```

---

## 🎉 You're Ready to Demo!

Once all checkboxes are ticked:

1. **Start both servers** (backend + frontend)
2. **Open browser** to http://localhost:5173
3. **Login** with `admin` / `[your-password]`
4. **Show stakeholders**:
   - Real PostgreSQL database (enterprise grade)
   - Multiple user roles (Admin, Officer, Public)
   - Secure authentication with JWT tokens
   - Production-ready API structure

---

**Estimated Setup Time**: 1-2 hours (first time)  
**Critical Path**: PostgreSQL → Backend Setup → Run Servers  
**Demo Duration**: 15-30 minutes  

**Status**: Ready when all checkboxes are ✅

---

*Last Updated: February 3, 2026*
