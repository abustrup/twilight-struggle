// ============================================================================
// rng.ts – Deterministic, injectable PRNG (mulberry32). Shared by engine,
// tests, and (in online) replaced by server-rolled results.
// ============================================================================

export class RNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    // mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  die(): number {
    return 1 + Math.floor(this.next() * 6);
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  getState(): number {
    return this.state;
  }
}

// Advances a numeric seed (for immutable-ish usage within reducer).
export function rollDieFromSeed(seed: number): { roll: number; nextSeed: number } {
  const rng = new RNG(seed);
  return { roll: rng.die(), nextSeed: rng.getState() };
}
