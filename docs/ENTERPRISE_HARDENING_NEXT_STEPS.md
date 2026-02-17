# Enterprise Hardening: Phase 1 Implementation

This document captures the implementation completed for the next enterprise readiness wave:
1. Postgres/PostGIS readiness configuration
2. Secret/environment hardening
3. RBAC/JWT guardrail tightening
4. Validation and test coverage updates

## 1) Postgres + PostGIS readiness

The backend now supports runtime-selectable database engines through environment variables.

- `DB_ENGINE=sqlite` (default local)
- `DB_ENGINE=postgres` (PostgreSQL)
- `DB_ENGINE=postgis` (PostgreSQL + PostGIS backend)

Relevant variables:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_CONN_MAX_AGE`

A `docker-compose.enterprise.yml` file has been added to quickly start PostGIS + Redis for local enterprise-like testing.

## 2) Environment and secret hardening

`.env.example` has been expanded and normalized so production-safe configuration is explicit.

Highlights:
- `ENVIRONMENT` controls production-safe defaults.
- `DEBUG` can be disabled explicitly.
- secure cookie toggles can be controlled with env vars.
- CORS and JWT durations are now configurable.

## 3) RBAC/JWT hardening

Role-aware API permission guards were introduced in `infrastructure/permissions.py` and applied to:
- User management endpoints
- Admin health/events endpoints
- INEHSS assignment creation/reassignment/review/approve actions

### Guardrail behavior
- Assignment creation is restricted to admin/supervisor roles.
- Review/approve/reassign assignment actions are restricted to admin/supervisor roles.
- Operational datasets remain readable by authorized operations roles.

## 4) Tests

Added focused RBAC tests in `backend/src/tests/test_authz_rbac.py` to validate:
- Officers cannot create assignments.
- Supervisors can create assignments.

## Local enterprise profile quick start

```bash
cp .env.example .env
# edit .env
# set ENVIRONMENT=production
# set DB_ENGINE=postgis
# set USE_REDIS_CHANNEL_LAYER=true

# infrastructure
docker compose -f docker-compose.enterprise.yml up -d

# backend
cd backend/src
python manage.py migrate
python manage.py runserver
```


## Governance endpoints delivered

- `GET /api/v1/governance/ledger/` returns append-only audit entries with integrity flag.
- `GET /api/v1/governance/trust-index/` returns dynamic governance scorecards for UI.
- Audit entries now include immutable chain fields: `prev_hash`, `entry_hash`.
