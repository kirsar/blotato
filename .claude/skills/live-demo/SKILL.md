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

## The emulator agent runs until stopped, not once

`src/demo/emulate-agent.ts` is a continuous loop, not a one-shot script: every 15s it
creates a new composition+post (alternating Instagram/YouTube) and turns automation
on; every 3s it polls comments across every post it has ever created and prints only
what's new. If `DEMO_LOG_PATH` is set, it also tails that file incrementally and
interleaves the worker's own log lines into the same stream, prefixed `[worker]`
next to its own `[agent]` lines — one continuous feed of both sides instead of two
logs to cross-reference by hand. A human running this themselves in an interactive
terminal leaves it running indefinitely and stops it with Ctrl+C (SIGINT), which it
handles gracefully and prints a final summary before exiting.

**When running this yourself in this turn**, you cannot literally run something
forever — pick a bounded window that shows at least two creation cycles (i.e. at
least ~35-40s, comfortably past `CREATE_INTERVAL_MS` twice), then send SIGINT and
report on the window you observed. Don't leave the demo process or the agent running
in the background past the end of your turn without telling the user explicitly —
if asked to leave it running for the user to watch themselves, say so and give them
the exact commands rather than silently detaching a process.

## Steps

1. **Build.** Run `npm run build`. If it fails, stop and report the compile errors —
   don't attempt to run a stale `dist/`.

2. **Boot the combined demo process in the background**, capturing its own log:
   ```powershell
   $proc = Start-Process -FilePath "node" -ArgumentList "dist/main.demo.js" -PassThru -RedirectStandardOutput "demo.log" -RedirectStandardError "demo-err.log"
   Start-Sleep -Seconds 3
   $proc.Id | Out-File -FilePath "demo.pid"
   Get-Content demo-err.log -ErrorAction SilentlyContinue
   ```
   Confirm it started cleanly (no stderr, and `demo.log` shows both `NestApplication
   successfully started` and `Comment pipeline worker started`) before proceeding. If
   port 3000 is already in use, stop and say so rather than guessing at a different
   port.

3. **Run the emulator agent for a bounded window**, pointing it at the demo log so
   it tails and interleaves worker activity into its own output:
   ```powershell
   $env:DEMO_LOG_PATH = "demo.log"
   $agent = Start-Process -FilePath "node" -ArgumentList "dist/demo/emulate-agent.js" -PassThru -RedirectStandardOutput "agent.log" -RedirectStandardError "agent-err.log"
   Start-Sleep -Seconds 40
   Stop-Process -Id $agent.Id -Force -ErrorAction SilentlyContinue
   Get-Content agent.log -ErrorAction SilentlyContinue
   ```
   40s comfortably covers two creation cycles (15s apart) and several poll ticks.
   Since the process is force-stopped rather than sent a real SIGINT, its own
   graceful-shutdown summary line won't appear — that's expected, not a failure.

4. **Report what happened**, reading straight from the interleaved `[agent]`/
   `[worker]` lines in `agent.log`: how many compositions were created, which
   platforms, how many replies were observed, and anything the worker itself logged
   (warnings, backoffs). If no `[worker]` lines appear at all, check that
   `DEMO_LOG_PATH` was actually set before starting the agent process — env vars set
   in one PowerShell command don't persist to a separately-invoked tool call in this
   environment.

5. **Clean up unconditionally** (success or failure):
   ```powershell
   $demoPid = Get-Content demo.pid -ErrorAction SilentlyContinue
   if ($demoPid) { Stop-Process -Id $demoPid -Force -ErrorAction SilentlyContinue }
   Remove-Item demo.log, demo-err.log, demo.pid, agent.log, agent-err.log -ErrorAction SilentlyContinue -Force
   ```

## Notes

- This is a **demo-only** entrypoint. Don't suggest deploying `main.demo.ts` anywhere
  real, and don't "fix" the fact that it duplicates `ApiRootModule`'s shape — that
  duplication is deliberate, documented in `main.demo.ts`'s own header comment, and
  exists only because there's no shared database in this take-home to split the two
  processes across for real.
- If asked to change what the emulator agent exercises (a different automation
  level, a YouTube post, multiple posts), edit `src/demo/emulate-agent.ts` and
  `npm run build` again before re-running this skill — don't hand-edit `dist/`.
