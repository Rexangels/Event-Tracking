#!/bin/bash
# Setup script for Sentinel development environment on Windows

echo "🚀 Sentinel Development Setup"
echo "======================================"

# Step 1: Create .env file
echo ""
echo "📝 Step 1: Creating .env file..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ .env created. Please edit backend/.env with your PostgreSQL credentials"
else
    echo "✅ .env already exists"
fi

# Step 2: Install Python dependencies
echo ""
echo "📦 Step 2: Installing Python dependencies..."
cd backend
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo "✅ Python dependencies installed"
else
    echo "❌ Failed to install Python dependencies"
    exit 1
fi

# Step 3: Run Django migrations
echo ""
echo "🗄️  Step 3: Running Django migrations..."
cd src
python manage.py migrate
if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed"
else
    echo "❌ Migration failed"
    exit 1
fi

# Step 4: Create superuser
echo ""
echo "👤 Step 4: Creating superuser..."
python manage.py createsuperuser
if [ $? -eq 0 ]; then
    echo "✅ Superuser created"
else
    echo "❌ Superuser creation failed"
    exit 1
fi

# Step 5: Setup user roles
echo ""
echo "👥 Step 5: Setting up user roles..."
python manage.py shell << EOF
from infrastructure.auth import setup_user_roles
setup_user_roles()
EOF

# Step 6: Install Node dependencies
echo ""
echo "📦 Step 6: Installing Node dependencies..."
cd ../../frontend
npm install
if [ $? -eq 0 ]; then
    echo "✅ Node dependencies installed"
else
    echo "❌ Failed to install Node dependencies"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎉 Next steps:"
echo "   1. Start PostgreSQL (if not already running)"
echo "   2. In backend/src directory: python manage.py runserver"
echo "   3. In frontend directory: npm run dev"
echo "   4. Login at http://localhost:5173 with your superuser credentials"
