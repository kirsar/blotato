// NB: vibe-coded demo
// Runs continuously until stopped (Ctrl+C / SIGINT) — not a one-shot script. Every
// CREATE_INTERVAL_MS it creates a new composition+post as an external HTTP client
// (alternating Instagram/YouTube), turns automation on, and every POLL_INTERVAL_MS
// polls comments across everything it has created so far, printing only what's new.
// If DEMO_LOG_PATH points at the combined demo process's own log file, this also
// tails it incrementally, so the worker's own activity (ticks, warnings) and this
// agent's HTTP-client view interleave in one stream instead of two separate logs.
//
// Run against main.demo.ts (web + worker sharing one process) — see the live-demo
// skill for the full sequence.

import { readFileSync, statSync } from 'node:fs';

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:3000/v1';
const API_KEY = process.env.DEMO_API_KEY ?? 'demo-api-key';
const DEMO_LOG_PATH = process.env.DEMO_LOG_PATH;
// Optional self-limit: without it the loop truly runs until SIGINT, which is right
// for a human watching in their own terminal. When something invokes this
// non-interactively for a bounded window, this lets it exit on its own with a real
// summary line instead of being killed mid-tick by an external timeout.
const DEMO_DURATION_MS = process.env.DEMO_DURATION_MS ? Number(process.env.DEMO_DURATION_MS) : undefined;
const CREATE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 3000;

interface Account {
  id: string;
  platform: string;
}

interface Composition {
  id: string;
  posts: { id: string; platform: string }[];
}

interface CommentView {
  id: string;
  isAuthor: boolean;
  status: string;
  text: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'blotato-api-key': API_KEY, 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(source: 'agent' | 'worker', message: string): void {
  console.log(`[${new Date().toISOString()}] [${source}] ${message}`);
}

// Tails DEMO_LOG_PATH incrementally — only what's been appended since the last
// read, so this can be called every poll tick without reprinting the whole file.
let logOffset = 0;
function tailWorkerLog(): void {
  if (!DEMO_LOG_PATH) return;
  try {
    const { size } = statSync(DEMO_LOG_PATH);
    if (size <= logOffset) return;
    const buffer = readFileSync(DEMO_LOG_PATH);
    const chunk = buffer.subarray(logOffset, size).toString('utf-8');
    logOffset = size;
    for (const line of chunk.split('\n')) {
      if (line.trim()) log('worker', line.trim());
    }
  } catch {
    // Log file not created yet, or briefly locked by a concurrent write from the
    // demo process — skip this tick and pick it back up on the next one.
  }
}

async function createActivity(accounts: Account[], counter: number): Promise<string[]> {
  const platform = counter % 2 === 0 ? 'INSTAGRAM' : 'YOUTUBE';
  const account = accounts.find((a) => a.platform === platform);
  if (!account) return [];

  const postBody =
    platform === 'INSTAGRAM'
      ? { accountId: account.id, platform, mediaProductType: 'FEED' }
      : { accountId: account.id, platform, privacyStatus: 'public' };

  const composition = await api<Composition>('/compositions', {
    method: 'POST',
    body: JSON.stringify({ content: `Emulated post #${counter}`, posts: [postBody] }),
  });
  const postIds = composition.posts.map((p) => p.id);
  log('agent', `created composition ${composition.id} (${platform}), post(s): ${postIds.join(', ')}`);

  await api(`/compositions/${composition.id}/automation`, {
    method: 'PUT',
    body: JSON.stringify({ level: 'REPLY' }),
  });
  log('agent', `automation turned on (REPLY) for composition ${composition.id}`);

  return postIds;
}

async function main(): Promise<void> {
  log('agent', 'fetching seeded accounts');
  const accounts = await api<Account[]>('/accounts');
  if (accounts.length === 0) throw new Error('No seeded accounts found — is main.demo.ts running?');

  const trackedPostIds: string[] = [];
  const seenCommentIds = new Set<string>();
  let counter = 0;
  let stopping = false;

  process.on('SIGINT', () => {
    log('agent', 'stopping (SIGINT received)...');
    stopping = true;
  });

  const startedAt = Date.now();
  let nextCreateAt = 0;
  while (!stopping) {
    const now = Date.now();
    if (DEMO_DURATION_MS && now - startedAt >= DEMO_DURATION_MS) {
      log('agent', `reached configured duration (${DEMO_DURATION_MS}ms), stopping`);
      break;
    }
    if (now >= nextCreateAt) {
      const newPostIds = await createActivity(accounts, counter++);
      trackedPostIds.push(...newPostIds);
      nextCreateAt = now + CREATE_INTERVAL_MS;
    }

    tailWorkerLog();

    for (const postId of trackedPostIds) {
      const { items } = await api<{ items: CommentView[] }>(`/comments?postId=${postId}`);
      for (const comment of items) {
        const key = `${postId}:${comment.id}`;
        if (seenCommentIds.has(key)) continue;
        seenCommentIds.add(key);
        log(
          'agent',
          `post ${postId}: [${comment.isAuthor ? 'us' : 'audience'}] (${comment.status}) ${comment.text}`,
        );
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  log('agent', `stopped after tracking ${trackedPostIds.length} post(s) across ${counter} composition(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
