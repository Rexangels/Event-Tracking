# AI Analysis & Explainability Roadmap (MVP → Trusted Ops)

## Why this matters now

The platform already has AI-assisted analysis/chat features, but for operational use we need:
- traceable reasoning,
- source attribution,
- confidence signaling,
- and governance controls for AI output.

This roadmap defines what to implement next so AI outputs are useful in real incidents and auditable later.

## Current gaps observed

1. **Limited explainability artifacts**
   - AI answers are not consistently bundled with evidence/source blocks.
2. **No confidence rubric**
   - Operators can’t quickly judge certainty level.
3. **No structured “why this answer” panel**
   - Missing top factors / assumptions / contradictions surfaced to users.
4. **No AI audit trail for prompts + outputs**
   - Hard to reconstruct decisions in governance reviews.
5. **No policy checks before showing high-impact recommendations**
   - Need safeguards for escalation and compliance-sensitive suggestions.

## Implementation phases

### Phase A — Explainability baseline (1 sprint)

- Add standard explainability object to AI responses:
  - `confidence_score` (0-1)
  - `confidence_label` (low/medium/high)
  - `key_factors` (top drivers)
  - `assumptions`
  - `counter_indicators`
  - `source_refs` (if available)
- Frontend: add “Why this answer?” expandable panel in AI chat modules.
- Frontend: show confidence badge next to every AI recommendation.

### Phase B — Auditability and governance (1 sprint)

- Persist AI interaction logs (prompt, model, response, explainability object, timestamp, user).
- Add redaction/PII stripping for prompts before persistence.
- Add audit view for admins/analysts with filters by date, model, confidence, user.

### Phase C — Reliability guardrails (1 sprint)

- Add output policy checks for critical recommendations:
  - force “needs human verification” banner when confidence is low,
  - block direct procedural commands without evidence block,
  - surface contradiction warnings.
- Add fallback behavior when model/API fails:
  - deterministic response template + degraded-mode notice.

## Definition of done (AI explainability)

- Every AI answer includes structured explainability metadata.
- Every critical recommendation shows confidence + sources + assumptions.
- AI prompts/outputs are queryable in audit logs.
- Low-confidence outputs are visibly marked and cannot be mistaken for verified facts.

## First concrete tickets

1. Backend contract: extend AI response schema with explainability fields.
2. Frontend UI: add Explainability panel component + confidence badge.
3. Persistence: create `AIInteractionLog` model and API endpoint for admin read-only access.
4. Governance: add policy middleware for high-impact response checks.
5. QA: add unit tests for explainability object presence and policy-check behavior.


## Progress update (current branch)

- ✅ **Phase A complete**: explainability metadata parsing + analyst-facing UI panels are live.
- 🟡 **Phase C started**: client-side guardrails now flag low-confidence outputs, block high-impact recommendations without evidence references, and provide deterministic degraded-mode fallback messaging when the AI provider fails.
- 🟡 **Phase B started**: backend AI interaction logging API is now in place with prompt redaction and role-restricted read access for governance review.
- ⏭️ **Next priority**: expand audit filters/dashboard UX and wire frontend AI clients to persist logs automatically.
