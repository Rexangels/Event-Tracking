# ADR-001: Adoption of Clean Architecture

## Status
Accepted

## Context
We are establishing an enterprise-grade backend for the Event Tracking application. The goal is to ensure:
- Reliability
- Scalability
- Maintainability
- Testability

Standard Django Project structure (MVT) often couples business logic with the framework (Views/Models), making it harder to test pure logic or switch infrastructure.

## Decision
We will adopt **Clean Architecture** (also known as Hexagonal Architecture or Ports and Adapters) for the backend.

The project structure will be organized as:
- **Domain**: Pure business logic, entities, and use case interfaces. No framework dependencies.
- **Application**: Application specific business rules, orchestration of domain objects.
- **Infrastructure**: Gateways (Repositories), Framework configurations, Database models, External APIs.
- **Interfaces**: Incoming adapters (API Views, Serializers, CLI commands).

## Consequences
### Positive
- High testability of business logic.
- Framework independence (easier to upgrade/switch libraries).
- Clear separation of concerns.

### Negative
- Higher initial boilerplate.
- Steeper learning curve for developers used to "fat models" or "logic in views".
