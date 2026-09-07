# Design corpus — index

Written during the build as the reasoning record, not as documentation to be read
start to finish. Each file argues one area: the tradeoff considered, the option
picked, and what was deliberately left out. Start with `CLAUDE.md` at the repo root
for the code-level orientation; come here for *why*.

Numbered roughly in the order they were written — `0.*` is research and groundwork,
`1`–`11` follow the take-home's own question areas.

## Groundwork

| File | What it covers |
| --- | --- |
| `0.foundational-research.md` | The verbatim task brief and the overall plan derived from it. The longest file; the origin of everything else. |
| `0.current-api-overview.md` | Research notes on what Blotato's real live API does today. |
| `0.capacity-planning.md` | Statistical inputs, quota math, polling-interval derivation, why jitter is not optional. |
| `0.services.md` | Per-component reference — the service roster and each one's responsibility. |
| `0.implementation-order.md` | The phase plan the build actually followed (phases 0–13). |

## Question areas

| File | What it covers |
| --- | --- |
| `1.overall-architecture.md` | Components, boundaries, and an explicit "what is deliberately not built" section. |
| `2.api-surface.md` | The REST surface, pagination, the idempotency contract, and why subscriptions are routed but `501`. |
| `3.social-media-integration.md` | One class per platform behind two interfaces; the six-error taxonomy and how it normalizes. |
| `4.agentic-integration.md` | Why the reply generator is a stub; batch partitioning by tenant+account; failure granularity. |
| `5.storage.md` | Platform-as-code vs. a table; the base + per-platform extension-table pattern; retention and erasure. |
| `6.compliance-data-retention.md` | Retention windows and right-to-erasure. Sketch only. |
| `7.security-multi-tenancy.md` | API-key auth, tenant isolation, and where the worker bypasses RLS. Sketch only. |
| `8.ai-dev-tooling.md` | How AI tooling is used in the workflow, and the skills that came out of it. Sketch only. |
| `9.testing.md` | Testing strategy and what is deliberately not covered. Sketch only. |
| `10.observability-operations.md` | Logging, metrics, and operational surface. Sketch only. |
| `11.versioning-platform-onboarding.md` | API versioning and the platform onboarding path. Sketch only. |

Files marked *Sketch only* are a few lines each — the areas were considered and
scoped out, and they say so rather than pretending to be complete.

## Diagram

`services-diagram.html` — the system diagram, open it in a browser.
