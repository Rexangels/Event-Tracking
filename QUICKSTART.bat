:: Quick Start Commands for Sentinel - Copy and Run These
:: Windows Command Prompt / PowerShell

REM ============================================
REM PART 1: Install PostgreSQL + PostGIS
REM ============================================

REM 1. Download and run PostgreSQL installer:
REM    https://www.postgresql.org/download/windows/
REM    Set password: postgres
REM    Port: 5432

REM 2. Download and run PostGIS installer:
REM    https://postgis.net/windows/downloads/

REM 3. Create database:
@echo Creating sentinel_db...
psql -U postgres -h localhost -c "CREATE DATABASE sentinel_db;"
psql -U postgres -h localhost -d sentinel_db -c "CREATE EXTENSION postgis;"
psql -U postgres -h localhost -d sentinel_db -c "CREATE EXTENSION postgis_topology;"

REM ============================================
REM PART 2: Backend Setup
REM ============================================

cd backend

REM Create virtual environment
python -m venv venv
call venv\Scripts\activate

REM Install dependencies
pip install -r requirements.txt

REM Copy environment file
copy .env.example .env
REM EDIT .env WITH YOUR DATABASE CREDENTIALS!

cd src

REM Generate secret key and update .env
python -c "from django.core.management.utils import get_random_secret_key; print('SECRET_KEY=' + get_random_secret_key())"

REM Run migrations
python manage.py migrate

REM Create superuser
python manage.py createsuperuser

REM Setup user roles
python manage.py shell -c "from infrastructure.auth import setup_user_roles; setup_user_roles()"

REM ============================================
REM PART 3: Frontend Setup
REM ============================================

cd ..\..\frontend
npm install

REM ============================================
REM PART 4: Run Application
REM ============================================

REM Terminal 1 - Backend:
cd backend\src
python manage.py runserver 0.0.0.0:8000

REM Terminal 2 - Frontend:
cd frontend
npm run dev

REM ============================================
REM Testing
REM ============================================

REM Login endpoint:
curl -X POST http://localhost:8000/api/v1/auth/login/ ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"your-password\"}"

REM Get current user:
curl http://localhost:8000/api/v1/auth/users/me/ ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

REM Admin panel:
http://localhost:8000/admin/

REM Frontend:
http://localhost:5173/
