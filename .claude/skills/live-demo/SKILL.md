---
name: live-demo
description: Boots the combined web+worker demo process, runs the HTTP emulator agent against it, and reports what happened in both the API and the pipeline worker.
---

# Live demo: emulate HTTP activity against the combined web+worker process

Demonstrates the phase-13 milestone (`.claude/plans/0.implementation-order.md`): an
external HTTP client turns automation on, and a few seconds later the worker has
ingested an audience comment and posted a reply against it — proven live, not just in
a unit test.

This only works with `main.demo.ts` (`DemoModule`), which runs the HTTP API and the
comment pipeline worker in **one process, sharing one in-memory `RepositoryModule`
instance**. `main.web.ts` and `main.worker.ts` are separate processes with separate
in-memory stores — running the emulator against either alone will time out with no
reply ever appearing, since nothing would be there to relay what the agent writes
over HTTP to a worker that can't see it.

## Best experience: have the human run it themselves

A bounded tool-run (below) is a fallback for when *you* are asked to demonstrate this
within a turn — it can never be genuinely "live" for the person reading your report,
since they only see a transcript retrieved after the fact, not something scrolling in
real time. If someone wants to actually *watch* this happen, tell them to run it
themselves in two terminals rather than asking you to run it for them:

```powershell
npm run start:demo                                        # terminal 1 — leave running
```
```powershell
$env:DEMO_LOG_PATH = "demo.log"; npm run demo:emulate      # terminal 2
```

Terminal 1's own stdout already shows the pipeline's real log lines directly
(`claimed N due schedule(s)`, `ingested N comment(s)`, `generated N reply`,
`published reply X`) even without `DEMO_LOG_PATH` — set it in terminal 2 only if they
want everything interleaved into one stream instead of watching two windows. Ctrl+C in
terminal 2 stops the agent gracefully with a summary; Ctrl+C in terminal 1 stops the
server. This runs until they stop it — no bounded window, no force-kill.

## The emulator agent runs until stopped, not once

`src/demo/emulate-agent.ts` is a continuous loop, not a one-shot script: every 8s
(`CREATE_INTERVAL_MS`) it creates a new composition+post, rotating across all seeded
accounts (2 Instagram + 2 YouTube by default — `seed.ts`) rather than alternating
between just two; every 2s (`POLL_INTERVAL_MS`) it polls comments across every post it
has ever created and prints only what's new. If `DEMO_LOG_PATH` is set, it also tails
that file incrementally and interleaves the worker's own log lines into the same
stream, prefixed `[worker]` next to its own `[agent]` lines. A human running this
themselves leaves it running indefinitely and stops it with Ctrl+C (SIGINT), which it
handles gracefully and prints a final summary before exiting.

**`DEMO_DURATION_MS`** (milliseconds) makes the agent self-terminate gracefully after
that long, printing the same summary a real SIGINT would — this is the right way to
bound a run non-interactively, not force-killing the process. Omit it to run until
SIGINT.

**When running this yourself in this turn**, set `DEMO_DURATION_MS` to a window that
comfortably covers at least 2-3 creation cycles (`CREATE_INTERVAL_MS` is 8s, so
~25-30s is enough — it no longer needs 40s) rather than force-killing after a fixed
sleep. Don't leave the demo process or the agent running in the background past the
end of your turn without telling the user explicitly — if asked to leave it running
for them to watch themselves, say so and give them the two-terminal commands above
rather than silently detaching a process.

## Steps

1. **Build.** Run `npm run build`. If it fails, stop and report the compile errors —
   don't attempt to run a stale `dist/`. Note the build now runs lint + format-check
   first (`prebuild`) — a real lint/format violation will fail the build before
   `nest build` even runs; fix it rather than bypassing it.

2. **Check port 3000 is free** before booting — a stale process from an earlier run
   (yours or the user's own `start:api`) will make the boot fail with `EADDRINUSE`.
   ```powershell
   Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
   ```
   If something's there and it isn't yours to stop, boot on a different port instead
   (`$env:PORT = "3002"` before `Start-Process`, and point the agent at
   `DEMO_BASE_URL = "http://localhost:3002/v1"`) rather than killing a process you
   don't recognize.

3. **Boot the combined demo process in the background**, capturing its own log:
   ```powershell
   $proc = Start-Process -FilePath "node" -ArgumentList "dist/main.demo.js" -PassThru -RedirectStandardOutput "demo.log" -RedirectStandardError "demo-err.log"
   Start-Sleep -Seconds 3
   $proc.Id | Out-File -FilePath "demo.pid"
   Get-Content demo-err.log -ErrorAction SilentlyContinue
   ```
   Confirm it started cleanly (no stderr, and `demo.log` shows both `NestApplication
   successfully started` and `Comment pipeline worker started`) before proceeding.

4. **Run the emulator agent for a bounded window**, self-terminating via
   `DEMO_DURATION_MS` rather than a force-kill, and pointing it at the demo log so it
   tails and interleaves worker activity into its own output:
   ```powershell
   $env:DEMO_LOG_PATH = "demo.log"
   $env:DEMO_DURATION_MS = "30000"
   node dist/demo/emulate-agent.js
   ```
   This runs in the foreground and returns once the agent stops itself — no
   `Start-Process`/`Stop-Process` needed, and its own graceful-shutdown summary line
   (`stopped after tracking N post(s) across N composition(s)`) will be present.

5. **Report what happened**, reading straight from the interleaved `[agent]`/
   `[worker]` lines: how many compositions were created, which platforms and accounts
   (the log names the account, e.g. `via "Demo YouTube (Vlogs)"`), and the genuine
   pipeline narration — `claimed N due schedule(s)`, `ingested N comment(s)`,
   `generated N reply`, `published reply X` — not just Nest's one-time startup/route
   log. If no `[CommentPipelineService]` lines appear at all, check that
   `DEMO_LOG_PATH` was actually set before starting the agent process — env vars set
   in one PowerShell command don't persist to a separately-invoked tool call in this
   environment.

6. **Clean up unconditionally** (success or failure):
   ```powershell
   $demoPid = Get-Content demo.pid -ErrorAction SilentlyContinue
   if ($demoPid) { Stop-Process -Id $demoPid -Force -ErrorAction SilentlyContinue }
   Remove-Item demo.log, demo-err.log, demo.pid -ErrorAction SilentlyContinue -Force
   ```

## Notes

- This is a **demo-only** entrypoint. Don't suggest deploying `main.demo.ts` anywhere
  real, and don't "fix" the fact that it duplicates `ApiRootModule`'s shape — that
  duplication is deliberate, documented in `main.demo.ts`'s own header comment, and
  exists only because there's no shared database in this take-home to split the two
  processes across for real. If `ApiRootModule`'s controller/provider list changes
  (a new controller, a new service), `DemoModule` needs the identical change made to
  it by hand — nothing keeps the two in sync automatically.
- If asked to change what the emulator agent exercises (a different automation
  level, a specific platform, multiple posts per cycle), edit
  `src/demo/emulate-agent.ts` and `npm run build` again before re-running this skill
  — don't hand-edit `dist/`.
- `comment-pipeline.service.ts`'s logging is deliberately sparse on purpose beyond
  what was added for this demo — it logs claim/ingest/generate/publish and the two
  failure paths, not a line per no-op tick (claiming 0 due schedules stays silent).
  Don't add a heartbeat log for silence; it would spam a real deployment polling every
  few seconds for no benefit.
