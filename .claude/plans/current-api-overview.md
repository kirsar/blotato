# Blotato's current live API — research notes

Referenced from [0.general-plan.md](./0.general-plan.md). Source: https://help.blotato.com/api
(fetched 2026-09-04).

## What Blotato's real, live API actually does

**Auth:** header `blotato-api-key`. Base URL `https://backend.blotato.com/v2`.

**Stack (as of this research):** Next.js (frontend/dashboard), Fastify (backend API),
TypeScript, Postgres, deployed on Heroku, with AWS in the mix (likely storage/infra).
This plan targets NestJS on the Fastify adapter (0.general-plan.md §1.5) — same HTTP
layer underneath, with Nest's module and DI structure on top. The take-home itself runs
Nest's default Express adapter to keep scope on the comment system
(1.overall-architecture.md); the adapter is a one-line bootstrap change either way.

**Accounts:** `GET /users/me/accounts` → connected accounts: `id` (accountId), `platform`
(twitter, instagram, linkedin, facebook, tiktok, pinterest, threads, bluesky, youtube —
9 platforms total for publishing), `fullname`, `username`. Facebook/LinkedIn pages are
subaccounts with their own `id` used as `pageId`.

**Posts:** `POST /posts` body `{ post: { accountId, content: {text, mediaUrls, platform,
additionalPosts}, target: {targetType, ...platform-specific} }, scheduledTime?,
useNextFreeSlot? }` → `201 { postSubmissionId, scheduledTime }`. Note:
`postSubmissionId` is a tracking id for a status-polling endpoint, NOT necessarily the
platform-native post id directly.

**Comments — the real, live comments API** (only 2 of the 9 platforms support comments
today: **Instagram and Facebook**. Explicitly NOT supported: Twitter/X, TikTok,
LinkedIn, Pinterest, Threads, Bluesky, YouTube.)

- `GET /v2/comments` — query: `limit` (1-250, default 50), `cursor`, `platform[]`
  (instagram|facebook), `accountId`, `parentCommentId` (filter to replies of one
  comment), `postId`, `since`, `until` (ISO8601). Response: `{ items: Comment[],
  cursor: string }`.
- `GET /v2/comments/:commentId` — single comment.
- `POST /v2/comments` — body `{ postId, text, parentCommentId? }`. Text limits: 2200
  chars Instagram, 8000 Facebook. **"Replies to replies are not supported"**
  (parentCommentId must point to a top-level comment). Returns `201` with the Comment
  object at status `queued`.

**Comment object fields:** `id` (Blotato id), `accountId`, `platform`, `postId`
(Blotato post id, **nullable** — a comment can exist on a platform post Blotato
doesn't track), `parentCommentId`, `platformPostId`, `platformCommentId` (nullable
while queued), `authorId` (nullable, platform user id — **no display name or avatar
exposed**), `isAuthor` (bool: true = posted by the connected account itself, false =
audience), `text`, `status`, `errorCode`, `errorMessage`, `createdAt`.

**Status lifecycle:** `queued` → `processing` → `posted` | `failed`. Also `deleted`
(removed from platform since last sync). The existence of queued/processing strongly
implies reply-posting is handled **asynchronously**, not synchronously in the request.

**Errors:** `404` (post/parent comment not found, or comments disabled on that post),
`422` (platform unsupported for comments, char limit exceeded, invalid parentCommentId
i.e. reply-to-reply, or a domain-specific "active-contacts limit" rule — error code
20101), `429` rate limited. General error envelope shape is **not documented publicly**.

**Rate limits:** GET list/single 60 req/min, POST 30 req/min.

**Stated product constraints:** "Blotato does not backfill comments" (only captures
from the moment the feature was enabled onward). "Blotato retains comments for up to
45 days." Replying to an audience member counts toward some "active contacts" limit;
replying to your own comment doesn't.

## Observations, and what a greenfield design can afford to try

**Framing, deliberately.** The Blotato current model is a live product with constraints
this exercise doesn't have: real customers whose integrations can't break, migration
cost on every schema change, platform partnerships and quota agreements not visible from
outside, and a cost model that has to work. Several things that look like gaps from the
outside are almost certainly deliberate, and a few are platform limitations rather than
choices at all. What follows is what a from-scratch design is *free* to try, not a
critique of the current model — that freedom is the only real advantage here, and it's
the cheap kind.

**Decision values:** **Build** = real code in the take-home. **Stub** = a token
implementation proving the seam exists. **Document** = designed, deliberately not
built. **No change** = the current model's behaviour is right, or the difference isn't
ours to claim. **Open** = unresolved, and named so it isn't mistaken for an oversight.
Ordered by value shown per line of code.

| # | Observation | Most likely explanation | Decision |
|---|---|---|---|
| 1 | Capability differences are scattered rather than declared — only 2/9 platforms support comments, reply-to-reply is blocked, text limits differ per platform | **Mostly not design choices.** Meta is realistically the only vendor with a usable comment API at this maturity, and flat threads are an accurate description of Instagram and Facebook | **Build.** Capability as *data* on the `Platform` row — `supportsComments`, `supportsDelete`, `maxReplyDepth`, `maxCommentLength` — not scattered `if (platform === …)` (1.overall-architecture.md). Platform N+1 is a row plus a provider class. Two dimensions this session added: a **quota gate**, since YouTube is infeasible at scale on default project quota regardless of code, so onboarding has a non-engineering step; and `maxCommentLength` enforced as a **prompt constraint before generation**, since TikTok's 150-char cap sits ~1.7x under the reply budget (0.capacity-planning.md §D) |
| 2 | A composition fanned out to N platforms yields N unlinked ids — nothing answers "comments on the thing I wrote" | The current model has no composition concept, so the question can't be posed; adding one to a live product means migrating every existing row | **Build.** `Composition` 1:N `Post` plus a `?compositionId=` parameter (0.general-plan.md §1.2.a). ~One column and one index. Arrives as a **new** parameter rather than redefining `postId`, so existing integrations keep working. The item a user would actually feel |
| 3 | No documented idempotency key on `POST /comments` | Genuine and cheap — the kind of thing deferred rather than rejected | **Build.** Table keyed by (accountId, key): same key and body replays the original response, same key with a different body returns 409 |
| 4 | Replies are delivered asynchronously — `201 queued`, then `queued → processing → posted` | Correct design, and the current model already has it | **Build — but this is parity, not improvement.** Worth building because a working runner (claim, call provider, update status, back off) is the clearest demonstration of competence in the deliverable |
| 5 | No outbound webhook for customers — the only way to learn a comment arrived is polling `GET /comments` | Outbound delivery means retries, signing, endpoint health, and dead-lettering; a lot of machinery for an early API | **Stub.** `Subscription` and `WebhookDelivery` in the schema, a `POST /v1/subscriptions` route, and a TODO at the emit site in Scheduler-Retriever. **No delivery worker.** The design is cheap on paper — claim rows, call an external endpoint, back off, which is `ReplyJobRunner`'s exact shape — but "cheap" assumed the security work came free, and it doesn't (see below). Closes a real asymmetry when built: this design makes *our* polling adaptive, then hands the identical problem to every integrator, who has none of the velocity signal needed to be adaptive about it |
| 6 | Ingestion mechanism (platform → Blotato) is undocumented | **Not observable.** How comments are fetched isn't part of the public API surface, so any claim about polling vs. webhooks is inference from absence | **Stub.** Regardless of what the current model does, the data model should let platform webhooks land later — they are the single biggest quota lever (0.capacity-planning.md §5). Signature verification plus app review is disproportionate here, presumably the same weighing that left it out of the live product |
| 7 | No delete endpoint for our own replies | Possibly scope, possibly a deliberate safety call | **Document.** Behind the `supportsDelete` capability flag from #1. Low cost either way, but not the thing to spend the budget on |
| 8 | Fixed per-key rate limits, rather than per-account against the platform | Simple, predictable, and defensible for an external API | **Document.** Interface sketch only. Harder than it looks: Meta's quota is an **app-wide pool**, not a per-account allowance, so fair-share across tenants is a multi-tenancy availability concern rather than a scheduling one (0.general-plan.md §7.0) |
| 9 | `authorId` only, no display name or avatar | **Plausibly deliberate PII minimization** — defensible when storing third-party data across tenants | **No change — adopted as-is.** This design stores the author's `platformAccountId` and nothing more. A lookup table for names and avatars was considered and cut (5.storage.md): it added a second place to erase without removing the first. "Add display names" stays a product decision with a privacy cost, not a straightforward improvement |
| 10 | 45-day retention, no backfill | No-backfill is a **platform API limitation**, not a choice. 45 days is plausibly a cost and compliance call we have no visibility into | **No change**, except making retention configurable rather than constant — easy only because there's no existing data to migrate. The cheapest kind of advantage |
| 11 | Comment `status` includes `deleted`, so removals are detected somehow | Whatever mechanism the current model uses, it works | **Open — this plan is *behind* the current model.** Forward-only cursor sync, adopted here for write-volume reasons, structurally cannot see a comment disappear, and §6.1's compliance requirement depends on it. A regression we owe an answer for, not an improvement |

### Why #5 is a stub, not a build — the security work isn't optional

The delivery mechanics really are cheap: they're `ReplyJobRunner` pointed at a customer
URL instead of a platform API. **What makes the feature expensive is that the URL is
attacker-controlled**, and that cost can't be deferred the way a missing retry could.

**Server-Side Request Forgery.** The attacker never touches the target; they get *our*
server to make the request, which works because our server sits inside a trust boundary
they don't have. **The caller is our own delivery worker** — our dyno, our network
position, our IAM role — which is exactly what makes a customer-supplied URL dangerous.

The concrete attack: a customer registers
`http://169.254.169.254/latest/meta-data/iam/security-credentials/` as their webhook
endpoint. Our worker POSTs to it, the cloud metadata service answers a caller it trusts,
and the credentials land in the delivery log the customer can read back. Same shape for
probing `localhost:5432` or mapping private ranges.

**What shipping it would require**, and why that is more than a weekend: resolve the
hostname *before* connecting and reject loopback, private, and link-local ranges, then
re-check after every redirect so a public URL can't 302 into an internal one. Add a
short per-delivery timeout so one hanging subscriber doesn't occupy workers, auto-disable
after N consecutive failures, and state explicitly that delivery is **not** ordered,
since integrators assume it and guaranteeing it is genuinely hard.

**So the scope call is: schema and route, no worker.** Half-building this one is worse
than not starting it — a delivery worker without address filtering is a credential
exfiltration path, so the honest options are all-of-it or none-of-it, and the take-home
budget doesn't cover all of it. The seam is left visible so the shape of the answer is
legible without the liability.

**Design detail, recorded so a later build doesn't re-derive it:** the *producers*
emit, in-transaction. Scheduler-Retriever writes `WebhookDelivery` rows in the same
micro-batched transaction as the comment upsert, and Reply Publisher does the same when
a reply reaches `POSTED`. That gets exactly-once emission for free — no watermark, no
"which comments were already notified" query. Subscriptions are tenant-scoped, few,
and rarely changed, so they live in a refreshed in-memory cache and the emit is a map
lookup that is usually a no-op. The delivery worker is then a pure consumer, and it
belongs in its **own process** for the same reason §1.4 isolates the others: it blocks
on customer endpoint health, not platform rate limits, so colocating it would let one
hanging subscriber starve reply posting.