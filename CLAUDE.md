# Blotato Comments Service

A multi-platform social media comment system: list and reply to comments across
Instagram and YouTube through one API, plus an opt-in automation tier that polls,
generates, and posts replies on its own.

This is a take-home exercise. The design reasoning behind almost every decision is
written down in `.claude/plans/` — if a choice here looks arbitrary, it is probably
argued for there. See the map at the bottom.

## Hard constraints

These are deliberate scope decisions, not gaps to fix. Don't "repair" them without
being asked:

- **Everything runs in memory.** No Postgres, no Docker, no network calls to real
  platforms. `prisma/schema.prisma` is the intended production schema and can be
  checked with `npm run prisma:validate`, but nothing reads or writes through Prisma
  at runtime.
- **Providers are simulated.** `InstagramProvider` / `YouTubeProvider` generate
  plausible comments and latency instead of calling Meta/Google. The error taxonomy
  they raise is real and reachable on demand (`injected-failure.ts`).
- **The reply generator is a stub.** No model call, no tokens, no prompt. The
  batching rules around it (`src/agent/batching.ts`) are the actual subject.
- **One seeded tenant.** `seed.ts` creates one user (API key `demo-api-key`) and four
  social accounts. The code paths are multi-tenant; the seed data isn't.
- **Webhooks are designed and stubbed `501`** (`src/api/subscription/`).

## Commands

```bash
npm run build       # nest build; prebuild gate runs lint + format:check first
npm test            # vitest — 54 tests
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier --write

npm run start:api     # HTTP API on :3000, Swagger UI at /
npm run start:worker  # comment pipeline worker (separate process in production)
npm run start:demo    # web + worker in ONE process — demo only, see main.demo.ts
```

Authenticate with header `blotato-api-key: demo-api-key`. `/health` is the one
unauthenticated route and sits outside the `v1` prefix.

## Layout

Path aliases (`tsconfig.json`): `@domain/*`, `@platforms/*`, `@repository/*`,
`@agent/*` → `src/*`.

- `src/domain/` — plain entity types, enums, the platform error taxonomy. No I/O.
- `src/repository/` — repository contracts plus in-memory implementations, behind DI
  tokens (`tokens.ts`). Swapping in Prisma means new classes, not new call sites.
- `src/platforms/` — everything platform-specific: the capability registry, the
  provider contract, the two providers, and the post-DTO conversion registry.
- `src/api/` — HTTP layer: controllers, services, DTOs.
- `src/agent/` — the stub reply generator and the batching rules.
- `src/jobs/` — scheduling math (pure functions) and the pipeline worker.
- `src/demo/` — `emulate-agent.ts`, a continuous HTTP client used by the live-demo skill.

## Invariants

Breaking one of these breaks the point of the exercise:

1. **Never branch on platform.** No `if (platform === …)`, no switch, no lookup by
   name. A platform contributes a `PLATFORMS` registry entry plus a class tagged
   `@PlatformProvider(...)`; `ProviderRegistry` finds it via Nest's `DiscoveryService`.
   Same pattern for DTO conversion (`PostDtoConverterRegistry`).
2. **Provider failures normalize to the taxonomy** in `src/domain/errors.ts`. The
   worker switches on error _type_, never on which platform raised it.
3. **HTTP exceptions belong to the API layer.** Domain, repository, jobs, and
   platform code throw plain domain errors. `PlatformNotSupportedError` exists
   precisely because the registry is called from the worker, which has no response
   to send.
4. **The automation level is derived, never stored.** `effective()` in
   `domain/automation.ts` is `min(user ceiling, composition, schedule)`, so lowering
   a tenant's ceiling takes effect on the next poll with no sweep across rows. Resolve
   the ceiling through `UserRepository`; never read it off a constant.
5. **`OFF` has exactly one representation: no `PostSchedule` row.** A retired row
   (`retiredAt` set) is a different state from an absent one.
6. **`claimDue()` is not a real claim.** It's a plain read standing in for
   `SELECT … FOR UPDATE SKIP LOCKED`, safe only because one worker runs and its loop
   chains passes with `setTimeout`. Two workers would double-post every reply.
7. **`DemoModule` in `main.demo.ts` duplicates `ApiRootModule` by hand.** If you add a
   controller or provider to one, add it to the other. Nothing keeps them in sync.

## Where the reasoning lives

`.claude/plans/` — see `.claude/plans/README.md` for the full index. The six that
carry most of the argument:

| Question                                                                     | Doc                             |
| ---------------------------------------------------------------------------- | ------------------------------- |
| Why these components, and what was deliberately not built                    | `1.overall-architecture.md`     |
| Why the REST surface looks like this; idempotency; the `501`s                | `2.api-surface.md`              |
| How platforms plug in; the error taxonomy                                    | `3.social-media-integration.md` |
| Why the generator is a stub; how batches are partitioned and capped          | `4.agentic-integration.md`      |
| Why platform capability is code and not a table; the extension-table pattern | `5.storage.md`                  |
| Polling intervals, quota math, why jitter is not optional                    | `0.capacity-planning.md`        |

## Skills

- `.claude/skills/live-demo/` — boots the combined process and drives real HTTP
  traffic through it, so you can watch automation happen end to end.
- `.claude/skills/onboard-new-social-platform/` — a deliberate placeholder showing the
  intended shape of platform onboarding, not a finished pipeline.
