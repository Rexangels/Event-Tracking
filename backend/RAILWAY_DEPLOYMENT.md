## Railway backend deployment

1. Set the Railway service root directory to `backend`.
2. Commit `backend/railway.json`; Railway will read deploy config from it.
3. Add env vars: `SECRET_KEY`, `ENVIRONMENT=production`, `DEBUG=False`, `DATABASE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`.
4. For scale-safe realtime, also set `REDIS_URL` and `USE_REDIS_CHANNEL_LAYER=True`.
5. `railway.json` runs this pre-deploy sequence automatically:
   - `python manage.py validate_deployment --strict`
   - `python manage.py migrate --noinput`
   - `python manage.py collectstatic --noinput`
6. `railway.json` also configures:
   - start command for Daphne/ASGI
   - health check path: `/api/v1/health/`
   - restart policy and graceful draining
7. If deployment fails during pre-deploy, check validation output first; it will tell you which production settings are still unsafe.