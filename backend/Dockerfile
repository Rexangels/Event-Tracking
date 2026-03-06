# Use the official Python slim image as a base
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies needed for compiling packages and PostgreSQL
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Set working directory to where manage.py is located
WORKDIR /app/src

# Collect static files during image build
# A dummy SECRET_KEY is provided so Django can initialize securely during the build phase
RUN SECRET_KEY=dummy-key-for-build python manage.py collectstatic --noinput

# Expose the application port
EXPOSE 8000

# Run migrations and start Daphne to serve the app
# Use a shell wrapper so the $PORT environment variable correctly evaluates
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py create_superuser && daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
