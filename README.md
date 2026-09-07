# Blotato Comments Service

A multi-platform social media comment system: list/reply-to comments across Instagram
and YouTube through one API, plus an opt-in automation tier that polls, generates, and
posts replies on its own.

## Get started

```bash
git clone https://github.com/kirsar/blotato.git
cd blotato
npm install
```

## Build and test

```bash
npm run build       # nest build
npm test            # vitest — 54 tests
```

## Run the API

```bash
npm run start:api
```

Swagger UI: http://localhost:3000/
Authorize via `demo-api-key`

## Database schema

Designed for Postgres via Prisma, though this build runs entirely in-memory to avoid bringing Docker in

- [`prisma/database-schemas-diagram.html`](./prisma/database-schemas-diagram.html) — visual diagram.
- [`prisma/schema.prisma`](./prisma/schema.prisma) — the models.
- [`prisma/init.sql`](./prisma/init.sql) — the generated DDL (`prisma migrate diff`)

## Prototype shape

On how deep to take the prototype, the options were roughly:

0. Just an API calling the social platform's API.
1. Add a job that fetches/posts comments on the social platforms.
2. Add some form of AI integration and automate comments publishing.
3. Full automation of posts and comments.

I picked **2** — to showcase both design of extensible platforms and passion of building systems that changes its own state over time, not just handling user requests.

[System design](./.claude/plans/services-diagram.html)

## Features

- **Domain and capacity limits research** — It's not intended to be read by humans;
  please run an agent (Opus level preferred) to learn
  [the folder](./.claude/plans/) and start asking questions
  ([example](./.claude/architecture-chat-example.png)).
- **Extensible platform support** — a new social platform
  ([`src/platforms/`](./src/platforms/)) plugs in independently of the existing ones,
  without touching shared code. In a prod system it's nice to have a
  [skill](./.claude/skills/onboard-new-social-platform/SKILL.md) to ease onboarding of
  new social platforms.
- **Extensibility per domain entity** — a base type plus per-platform derived types,
  each translating to its own independent database table sharing the base's primary
  key, rather than one wide table or a generic key-value blob. See
  [`InstagramPost`](./src/platforms/instagram/instagram-post.ts) and
  [`YouTubePost`](./src/platforms/youtube/youtube-post.ts).
- **Composition** — one authored piece of content, fanned out to a set og posts on multiple platforms at once.
- **Opt-in comment automation** — ability to turn comments automation on or off. A worker loop (claim → read → generate → write) ingests audience comments and posts replies on its own once automation is on.
- **Webhook API (designed, stubbed as `501`)** — to let users avoid polling patterns.
  Routed and documented ([`src/api/subscription/`](./src/api/subscription/)), not
  implemented
- **Idempotency keys on manual comments** — `POST /v1/comments` isn't safe to retry on its own: a client that times out and retries would otherwise create a second, duplicate reply.
- **Adaptive polling** — target-yield interval while a post is active, geometric
  backoff once it goes quiet, jitter so a fleet of posts doesn't synchronize into
  request spikes, and a poll window decoupled from the retention window so a post
  isn't polled forever just because its data is still queryable
  ([`src/jobs/scheduling.ts`](./src/jobs/scheduling.ts)).
- **Some code is vibe-coded on purpose**, just to get an end-to-end system and test running —
  `src/jobs/scheduling.ts`, `src/jobs/comment-pipeline.service.ts`.

## Repo overview

- [`src/domain/`](./src/domain/) — plain entity types, enums, the platform error
  taxonomy.
- [`src/repository/`](./src/repository/) — repository contracts plus their in-memory
  implementations, behind DI tokens.
- [`src/platforms/`](./src/platforms/) — everything platform-specific: the capability
  registry (`registry.ts`), the comment-provider contract, `InstagramProvider`/
  `YouTubeProvider`, and the post-DTO conversion registry that keeps platform field
  names out of the API layer.
- [`src/api/`](./src/api/) — the HTTP layer: controllers, services and DTOs for
  accounts, platforms, compositions, comments, and automation.
- [`src/agent/`](./src/agent/) — the stub reply generator and the batching rules
  (partition by tenant, cap by output budget).
- [`src/jobs/`](./src/jobs/) — the scheduling math and the comment pipeline worker
  service (claim → read → generate → write).
- [`src/demo/`](./src/demo/) — the HTTP-client emulator script used by the `live-demo`
  skill.
- [`src/main.web.ts`](./src/main.web.ts) — the HTTP API entrypoint.
- [`src/main.worker.ts`](./src/main.worker.ts) — the comment pipeline worker entrypoint,
  a separate process from the API in production.
- [`.claude/plans/`](./.claude/plans/) — the design docs.
- [`.claude/skills/`](./.claude/skills/) — `live-demo` and
  `onboard-new-social-platform`.
