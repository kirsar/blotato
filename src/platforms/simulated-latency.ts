// Every provider method that talks to "the platform" is actually local and instant —
// there's no real network call anywhere in this take-home. This puts a fixed delay at
// each of those points so the demo (and anything timing it) sees something closer to
// what a real platform round-trip would feel like, rather than a suspiciously instant
// response.
export function simulateLatency(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
