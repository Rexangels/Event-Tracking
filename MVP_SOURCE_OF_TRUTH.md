# MVP Source of Truth (Demo Baseline)

This file is the **authoritative status** for the current demo/MVP and resolves documentation drift.

## Scope Decisions

- The project is currently optimized for **demo + MVP**, not enterprise production.
- **SQLite is intentionally retained** for local demo speed and simplicity.
- Enterprise roadmap items (PostgreSQL/PostGIS/Redis/K8s/S3) remain valid, but are **future stages**.

## Current Reality (Code-Aligned)

### Backend
- Django + DRF API is active with JWT login/refresh and role-profile model scaffolding.
- Event APIs, INEHSS form/report/assignment APIs, and basic audit endpoints are implemented.
- Channels currently use in-memory backend (demo-friendly).
- Primary DB engine is SQLite.

### Frontend
- Public reporting, login, officer route, and admin route exist.
- Auth guard protects officer/admin routes.

## What is now implemented in this reconciliation step

1. **Assignment lifecycle depth**
   - Expanded statuses: pending → accepted → in_progress → awaiting_review → approved/revision_needed → completed (+ declined/reassigned).
   - Added assignment `progress_percent`, `escalation_level`, and `escalation_reason`.
   - Added lifecycle actions: `start`, `submit_review`, `request_revision`, `approve`, `decline`, `escalate`.

2. **QA/validation upgrades**
   - Latitude/longitude validation in report/submission serializers.
   - Requires lat/lon to be provided together.

3. **Search/filter baseline**
   - Added report filtering by tracking_id, status, priority, text search, and coordinate range min/max.

4. **Evidence/media hardening**
   - Added file type allow-list validation.
   - Added max file size guard (20MB).

5. **Expanded role taxonomy scaffold**
   - Added `supervisor` and `analyst` role options in auth role enum.
   - Added corresponding group permission setup stubs.

## Next Implementation Queue (MVP-first)

1. ✅ Frontend assignment lifecycle UI controls (accept/start/review/escalate actions now surfaced for officers).
2. ✅ Frontend report search/filter bar (status/priority/search controls in admin reports tab).
3. ✅ Notification UX baseline (officer dashboard alerts for escalated/overdue work).
4. ✅ Improved media preview workflow baseline (image/video preview before submit in dynamic forms).
5. CI pipeline run with backend tests in a deterministic environment (workflow added; execution pending accessible package network).

## Deferred by design (not blocked for demo)

- PostgreSQL + PostGIS migration.
- Redis channel layer.
- S3/MinIO media storage.
- Full enterprise monitoring and security hardening.

## AI analysis & explainability focus (next major track)

- Add structured explainability metadata to AI responses (confidence, key factors, assumptions, source references).
- Add UI "Why this answer?" panel + confidence badges for analyst/officer workflows.
- Add audit logging for AI interactions for governance review.
- ✅ Add policy checks baseline for high-impact recommendations and low-confidence warnings (frontend guardrails + degraded-mode fallback).

See: `docs/AI_ANALYSIS_EXPLAINABILITY_ROADMAP.md`.
