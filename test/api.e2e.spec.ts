import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomationLevel } from '@domain/automation';
import { CommentStatus } from '@domain/comment';
import { PlatformId } from '@domain/platform-id';
import { SEED_API_KEY } from '@repository/in-memory/seed';
import { ApiRootModule } from '../src/api-root.module';

// The one true end-to-end test (0.foundational-research.md §9.1): boots the real
// ApiRootModule and drives it over real HTTP via supertest, rather than calling a
// handler function directly. Its job is the wire path — routing, the global prefix,
// guard and interceptor wiring, ValidationPipe, the class-transformer discriminator,
// and response serialization — not the domain logic, which the co-located unit specs
// over automation/batching/scheduling already cover more cheaply.

const KEY_HEADER = 'blotato-api-key';
const IG_ACCOUNT = 'account_ig_demo';
const YT_ACCOUNT = 'account_yt_demo';

interface PostView {
  id: string;
  platform: PlatformId;
  platformPostId: string;
  content: string | null;
  publishedAt: string | null;
  mediaProductType?: string;
  privacyStatus?: string;
}

interface CompositionView {
  id: string;
  content: string;
  posts: PostView[];
}

describe('API end to end, over real HTTP', () => {
  let app: INestApplication;

  // supertest binds the server to an ephemeral port and issues genuine HTTP
  // requests against it, so this exercises the full Express/Nest stack.
  const api = () => request(app.getHttpServer());
  // Per-verb rather than one wrapper, because supertest's `.set()` lives on the
  // request a verb returns, not on the agent itself.
  const authed = {
    get: (path: string) => api().get(path).set(KEY_HEADER, SEED_API_KEY),
    post: (path: string) => api().post(path).set(KEY_HEADER, SEED_API_KEY),
    put: (path: string) => api().put(path).set(KEY_HEADER, SEED_API_KEY),
    delete: (path: string) => api().delete(path).set(KEY_HEADER, SEED_API_KEY),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiRootModule] }).compile();
    app = moduleRef.createNestApplication();
    // Deliberately identical to main.web.ts — an E2E that configures the app
    // differently from production is testing a system nobody runs.
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createComposition(): Promise<CompositionView> {
    const res = await authed
      .post('/v1/compositions')
      .send({
        content: 'e2e composition',
        posts: [
          { platform: PlatformId.INSTAGRAM, accountId: IG_ACCOUNT, mediaProductType: 'FEED' },
          { platform: PlatformId.YOUTUBE, accountId: YT_ACCOUNT, privacyStatus: 'unlisted' },
        ],
      })
      .expect(201);
    return res.body as CompositionView;
  }

  describe('auth and routing', () => {
    it('serves /health with no API key, outside the versioned prefix', async () => {
      await api().get('/health').expect(200, { status: 'ok' });
    });

    it('does not mount /health under /v1', async () => {
      await api().get('/v1/health').expect(404);
    });

    it('rejects a request with no API key', async () => {
      const res = await api().get('/v1/accounts').expect(401);
      expect(res.body.message).toContain('Missing blotato-api-key');
    });

    it('rejects an unknown API key', async () => {
      const res = await api().get('/v1/accounts').set(KEY_HEADER, 'nope').expect(401);
      expect(res.body.message).toContain('Invalid API key');
    });

    it('accepts the seeded key', async () => {
      await authed.get('/v1/accounts').expect(200);
    });
  });

  describe('GET /v1/accounts', () => {
    it('returns the seeded accounts', async () => {
      const res = await authed.get('/v1/accounts').expect(200);
      expect(res.body).toHaveLength(4);
      expect(res.body.map((a: { id: string }) => a.id)).toContain(IG_ACCOUNT);
    });

    it('never serializes credentialRef or userId', async () => {
      // The exclusion is enforced by AccountResponseDto's field list at compile
      // time; this asserts it actually holds on the wire.
      const res = await authed.get('/v1/accounts').expect(200);
      for (const account of res.body) {
        expect(account).not.toHaveProperty('credentialRef');
        expect(account).not.toHaveProperty('userId');
      }
    });
  });

  describe('GET /v1/platforms', () => {
    it('serves the capability registry without exposing poll or budget policy', async () => {
      const res = await authed.get('/v1/platforms').expect(200);
      const instagram = res.body.find((p: { id: string }) => p.id === PlatformId.INSTAGRAM);
      expect(instagram).toMatchObject({
        name: 'Instagram',
        supportsComments: true,
        maxReplyDepth: 1,
        maxCommentLength: 2200,
      });
      expect(instagram).not.toHaveProperty('poll');
      expect(instagram).not.toHaveProperty('budget');
      expect(instagram).not.toHaveProperty('syncMode');
    });
  });

  describe('POST /v1/compositions — the discriminated union', () => {
    it('round-trips each platform extension field', async () => {
      // class-transformer drops the discriminator without keepDiscriminatorProperty,
      // which would leave the service's platform switch with nothing to read. This is
      // the silent failure that test exists to catch.
      const composition = await createComposition();
      expect(composition.posts).toHaveLength(2);

      const ig = composition.posts.find((p) => p.platform === PlatformId.INSTAGRAM)!;
      const yt = composition.posts.find((p) => p.platform === PlatformId.YOUTUBE)!;
      expect(ig.mediaProductType).toBe('FEED');
      expect(ig).not.toHaveProperty('privacyStatus');
      expect(yt.privacyStatus).toBe('unlisted');
      expect(yt).not.toHaveProperty('mediaProductType');
    });

    it('falls back to the composition caption when a post omits its own', async () => {
      const composition = await createComposition();
      expect(composition.posts.every((p) => p.content === 'e2e composition')).toBe(true);
      expect(composition.posts.every((p) => p.publishedAt !== null)).toBe(true);
    });

    it('embeds the same posts, with extensions, on GET', async () => {
      const created = await createComposition();
      const res = await authed.get(`/v1/compositions/${created.id}`).expect(200);
      const fetched = res.body as CompositionView;
      expect(fetched.posts.map((p) => p.id).sort()).toEqual(created.posts.map((p) => p.id).sort());
      expect(fetched.posts.find((p) => p.platform === PlatformId.YOUTUBE)?.privacyStatus).toBe('unlisted');
    });

    it('rejects a post whose platform contradicts its account', async () => {
      await authed
        .post('/v1/compositions')
        .send({
          content: 'mismatched',
          posts: [{ platform: PlatformId.YOUTUBE, accountId: IG_ACCOUNT, privacyStatus: 'public' }],
        })
        .expect(422);
    });

    it('rejects a body the ValidationPipe cannot accept', async () => {
      await authed.post('/v1/compositions').send({ posts: [] }).expect(400);
    });
  });

  describe('GET /v1/comments — the mutually exclusive filters', () => {
    it('requires exactly one of postId or compositionId', async () => {
      await authed.get('/v1/comments').expect(400);
    });

    it('rejects both ids together', async () => {
      await authed.get('/v1/comments?postId=a&compositionId=b').expect(400);
    });

    it('rejects platform alongside postId', async () => {
      const composition = await createComposition();
      const postId = composition.posts[0].id;
      const res = await authed
        .get(`/v1/comments?postId=${postId}&platform=${PlatformId.INSTAGRAM}`)
        .expect(400);
      expect(res.body.message).toContain('compositionId');
    });

    it('returns an empty page for a post with no comments yet', async () => {
      const composition = await createComposition();
      const res = await authed.get(`/v1/comments?postId=${composition.posts[0].id}`).expect(200);
      expect(res.body).toEqual({ items: [], cursor: null });
    });
  });

  describe('POST /v1/comments and the idempotency interceptor', () => {
    it('queues a reply and returns a Location header', async () => {
      const composition = await createComposition();
      const res = await authed
        .post('/v1/comments')
        .send({ postId: composition.posts[0].id, text: 'thanks for watching!' })
        .expect(201);

      expect(res.body.status).toBe(CommentStatus.QUEUED);
      expect(res.body.isAuthor).toBe(true);
      expect(res.body.platformCommentId).toBeNull();
      expect(res.headers.location).toBe(`/v1/comments/${res.body.id}`);
      // Idempotency bookkeeping is never serialized.
      expect(res.body).not.toHaveProperty('idempotencyKey');
      expect(res.body).not.toHaveProperty('requestHash');
    });

    it('replays the same comment for a repeated key and body', async () => {
      const composition = await createComposition();
      const body = { postId: composition.posts[0].id, text: 'idempotent reply' };

      const first = await authed.post('/v1/comments').set('Idempotency-Key', 'k-1').send(body).expect(201);
      const replay = await authed.post('/v1/comments').set('Idempotency-Key', 'k-1').send(body).expect(201);

      expect(replay.body.id).toBe(first.body.id);
    });

    it('409s when the same key arrives with a different body', async () => {
      const composition = await createComposition();
      const postId = composition.posts[0].id;

      await authed
        .post('/v1/comments')
        .set('Idempotency-Key', 'k-2')
        .send({ postId, text: 'original' })
        .expect(201);
      await authed
        .post('/v1/comments')
        .set('Idempotency-Key', 'k-2')
        .send({ postId, text: 'different' })
        .expect(409);
    });

    it('posts a top-level comment when parentCommentId is omitted', async () => {
      const composition = await createComposition();
      const res = await authed
        .post('/v1/comments')
        .send({ postId: composition.posts[0].id, text: 'kicking off the thread' })
        .expect(201);

      expect(res.body.parentCommentId).toBeNull();
      expect(res.body.platformParentCommentId).toBeNull();
      expect(res.body.status).toBe(CommentStatus.QUEUED);
    });

    it('rejects text longer than the platform allows', async () => {
      const composition = await createComposition();
      const ig = composition.posts.find((p) => p.platform === PlatformId.INSTAGRAM)!;
      await authed
        .post('/v1/comments')
        .send({ postId: ig.id, text: 'x'.repeat(2201) })
        .expect(422);
    });

    it('404s for a post that does not exist', async () => {
      await authed.post('/v1/comments').send({ postId: 'nope', text: 'hi' }).expect(404);
    });
  });

  describe('automation', () => {
    it('reports requested, ceiling and effective, with per-post schedule state', async () => {
      const composition = await createComposition();
      await authed
        .put(`/v1/compositions/${composition.id}/automation`)
        .send({ level: AutomationLevel.REPLY })
        .expect(204);

      const res = await authed.get(`/v1/compositions/${composition.id}/automation`).expect(200);
      expect(res.body.requested).toBe(AutomationLevel.REPLY);
      expect(res.body.ceiling).toBe(AutomationLevel.REPLY);
      expect(res.body.effective).toBe(AutomationLevel.REPLY);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.posts.every((p: { nextPollAfter: string | null }) => p.nextPollAfter !== null)).toBe(
        true,
      );
    });

    it('treats an empty body as "whatever the ceiling allows"', async () => {
      const composition = await createComposition();
      await authed.put(`/v1/compositions/${composition.id}/automation`).send({}).expect(204);

      const res = await authed.get(`/v1/compositions/${composition.id}/automation`).expect(200);
      expect(res.body.requested).toBeNull();
      expect(res.body.effective).toBe(AutomationLevel.REPLY);
    });

    it('rejects a level outside the settable set', async () => {
      const composition = await createComposition();
      await authed
        .put(`/v1/compositions/${composition.id}/automation`)
        .send({ level: AutomationLevel.DRAFT })
        .expect(400);
    });

    it('retires every schedule on DELETE, rather than lowering the effective level', async () => {
      // OFF has exactly one representation: no active schedule row. Clearing the
      // composition's level alone would fall back to the ceiling, not to OFF.
      const composition = await createComposition();
      await authed.put(`/v1/compositions/${composition.id}/automation`).send({}).expect(204);
      await authed.delete(`/v1/compositions/${composition.id}/automation`).expect(204);

      const res = await authed.get(`/v1/compositions/${composition.id}/automation`).expect(200);
      expect(res.body.posts.every((p: { retiredAt: string | null }) => p.retiredAt !== null)).toBe(true);
      expect(res.body.effective).toBe(AutomationLevel.REPLY);
    });

    it('404s for a composition this tenant does not own', async () => {
      await authed.get('/v1/compositions/does-not-exist/automation').expect(404);
    });
  });

  describe('subscriptions', () => {
    it('answers 501 on every routed verb', async () => {
      await authed
        .post('/v1/subscriptions')
        .send({ url: 'https://example.test/hook', events: ['comment.created'] })
        .expect(501);
      await authed.get('/v1/subscriptions').expect(501);
      await authed.get('/v1/subscriptions/sub_1').expect(501);
      await authed.delete('/v1/subscriptions/sub_1').expect(501);
    });
  });
});
