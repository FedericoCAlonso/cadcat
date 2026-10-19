/**
 * Mulberry32 seeded pseudo-random number generator.
 * Deterministic and fast 32-bit generator for search and optimization.
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    // Ensure seed is a non-zero 32-bit integer
    this.state = (Math.floor(seed) >>> 0) || 0x12345678;
  }

  /**
   * Returns a pseudo-random float in [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    if (min >= max) return min;
    const f = this.next();
    return min + Math.floor(f * (max - min + 1));
  }

  /**
   * Returns a random boolean with probability p of being true.
   */
  nextBool(p = 0.5): boolean {
    return this.next() < p;
  }

  /**
   * Picks a random element from an array.
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const idx = Math.floor(this.next() * array.length);
    return array[Math.min(idx, array.length - 1)]!;
  }

  /**
   * Fisher-Yates in-place shuffle (returns a new shuffled copy).
   */
  shuffle<T>(array: readonly T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
    }
    return copy;
  }
}
