# Onboarding Guide

## Prerequisites
- Python 3.10+
- Node.js 18+ (for Frontend)
- Git

## Getting Started

### 1. Clone the Repository
```bash
git clone <repository_url>
cd Event-Tracking
```

### 2. Backend Setup
The backend follows Clean Architecture and uses Django.

```bash
cd backend
# Create Virtual Environment (Windows)
python -m venv venv
.\venv\Scripts\activate

# Install Dependencies
pip install -r requirements.txt

# Run Migrations
cd src
python manage.py migrate

# Run Server
python manage.py runserver
```

### 3. Frontend Setup
The frontend is a React + Vite application.

```bash
cd frontend
npm install
npm run dev
```

## Project Structure
- `/backend`: Django Project (Clean Architecture)
  - `/src/domain`: Business Logic
  - `/src/application`: Use Cases
  - `/src/infrastructure`: Framework & DB
  - `/src/interfaces`: API Adapters
- `/frontend`: React Application
- `/docs`: Project Documentation
