---
name: onboard-new-social-platform
description: Scaffolds a new platform (registry entry, provider, module) from a link to that platform's comments API docs. Placeholder — demonstrates the intended shape, not a finished pipeline.
---

# Onboard a new social platform

**This is a placeholder, not a finished skill.** There's no way to make "read an
arbitrary third party's API docs and correctly infer pagination, auth, and comment
schema" reliable without a human checking every step against the real docs. What
follows demonstrates the *intent* — ask for the one input that actually varies
per-platform, then land it into the same shape Instagram and YouTube already use — so a
future version of this skill has a concrete scaffold to grow from, not a proof it's
finished.

## The one input this needs

**A link to the new platform's comments API documentation** (list comments, post a
reply, and ideally delete-a-comment and rate-limit docs). If the user invokes this
without one, ask for it before doing anything else — nothing below is guessable from
a platform name alone (Reddit, TikTok and Mastodon each shape "list comments" and "who
paid to post it" completely differently).

## What "landing a platform" means in this codebase

Every existing platform (`src/platforms/instagram/`, `src/platforms/youtube/`) is the
same seven-piece shape, none of it in a database (`5.storage.md`, "Platform is code, not
a table"):

1. **`PlatformId` enum entry** (`src/domain/platform-id.ts`) — the new platform's key
   everywhere else below hangs off.
2. **`PLATFORMS` registry entry** (`src/platforms/registry.ts`) — `maxCommentLength`,
   `maxReplyDepth`, `supportsDelete`, `syncMode` (`cursor` vs `since` — read from the
   docs' pagination model, don't guess), and a `poll`/`budget` policy filled in from
   whatever rate limits the docs state, or a clearly-marked placeholder if they don't
   say.
3. **A provider class** implementing `ICommentReader`/`ICommentWriter`
   (`src/platforms/provider/comment-provider.contract.ts`), decorated
   `@PlatformProvider(PlatformId.X)` for `ProviderRegistry`'s discovery — this is where
   the actual API shape from the docs gets translated into `FetchedComment`/`Comment`.
   Follow `instagram.provider.ts` for a `cursor`-sync example, `youtube.provider.ts` for
   `since`-sync.
4. **A post extension, only if the platform has post-level fields the pipeline needs**
   (Instagram's `mediaProductType` gates pollability; YouTube's `privacyStatus` does the
   same) — domain type extending `Post`, a repository contract
   (`x-post.repository.contract.ts`), an in-memory repository, DTOs with the static
   `toPost`/`fromPost`-style conversion methods, and an `XPostDtoConverter` decorated
   `@PostDtoConverterProvider(PlatformId.X)`. Skip this whole piece if the platform has
   no fields beyond what `Post` already carries.
5. **A Nest module** (`x.module.ts`) wiring the provider and any extension repository
   behind DI tokens, exported and added to `platforms.module.ts`'s imports.
6. **A `FakeCredentialStore` isn't platform-specific** — real OAuth is out of scope
   everywhere (`3.social-media-integration.md`), so this step is only "make sure the new
   provider calls `ICredentialStore.resolve()` the same way the other two do," not new
   work.
7. **Tests**: a `*.provider.spec.ts` co-located next to the provider, covering at least
   one success path and the injected-failure markers (`checkInjectedFailure`) the way
   `instagram.provider.spec.ts`/`youtube.provider.spec.ts` do.

## What this skill does NOT do (yet)

- Fetch or parse the linked docs itself with any reliability — a human still has to read
  them and confirm `syncMode`, rate limits, and the comment/reply shape before step 2-3
  are trustworthy.
- Wire real credentials or call the real API even once — everything stays inside the
  existing fake/simulated-latency/injected-failure pattern, matching the other two
  platforms.
- Guarantee the new provider's error mapping is complete — the six-error taxonomy in
  `src/domain/errors.ts` was derived from Instagram and YouTube specifically; a third,
  sufficiently different platform may need a judgment call on which existing error type
  its failures map to, or whether the taxonomy itself needs to grow.

## Procedure (sketch)

1. Ask for the comments-API doc link if not given.
2. Read enough of it to answer: pagination model (`cursor` or `since`), max comment
   length, reply depth limit, whether delete exists, and the rate-limit shape (calls
   vs. units, app-wide vs. per-project scope — see `PlatformBudget`).
3. Add the `PlatformId` entry and the `PLATFORMS` registry entry, filling every field
   from what the docs actually say — mark anything guessed with a `// TODO: confirm
   against docs` comment rather than a silent guess.
4. Scaffold the provider class from whichever existing provider matches the new
   platform's `syncMode`, translating field names as you go.
5. Add the post extension only if the docs show a platform-specific field the pipeline
   needs to gate on or display.
6. Wire the module and add it to `platforms.module.ts`.
7. Write `*.provider.spec.ts` alongside the provider now, not after everything else is
   "done": at least one success path per exported method, plus the injected-failure
   markers (`checkInjectedFailure`) the way `instagram.provider.spec.ts`/
   `youtube.provider.spec.ts` do.
8. Run `npm run typecheck && npm test`. **This is not a one-shot gate — iterate.** Fix
   whatever's red, run both again, and repeat until both are clean. Never trust an IDE's
   inline error squiggles or a stale run over the actual command output — this session's
   own history is full of "IDE says broken, `tsc` says fine" and the reverse; the
   toolchain is the only source of truth, checked fresh after every fix.
9. Only after both are clean: stop and report what's still unverified regardless — mainly
   that the provider's actual behavior matches the docs, since nothing here calls the
   real API. A green `typecheck`/`test` run proves the scaffold is internally consistent,
   not that it correctly implements the platform.
