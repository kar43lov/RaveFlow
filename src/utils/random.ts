// Seedable pseudo-random number generator (Mulberry32)
export class SeededRandom {
  private seed: number

  constructor(seed: number = Date.now()) {
    this.seed = seed
  }

  // Returns a random number between 0 and 1
  next(): number {
    let t = (this.seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Returns a random number in range [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  // Returns a random integer in range [min, max]
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  // Returns a random item from an array
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)]
  }

  // Shuffles an array in place
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  // Returns a random boolean with given probability
  chance(probability: number = 0.5): boolean {
    return this.next() < probability
  }

  // Reset seed
  reset(seed: number): void {
    this.seed = seed
  }
}

// Simple noise functions
export function noise1D(x: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + seed) * 43758.5453123
  return n - Math.floor(n)
}

export function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123
  return n - Math.floor(n)
}

// Smooth noise (value noise interpolation)
export function smoothNoise1D(x: number, seed: number = 0): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f) // smoothstep

  return (
    noise1D(i, seed) * (1 - u) +
    noise1D(i + 1, seed) * u
  )
}

// FBM (Fractal Brownian Motion)
export function fbm(x: number, octaves: number = 4, seed: number = 0): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise1D(x * frequency, seed + i)
    amplitude *= 0.5
    frequency *= 2
  }

  return value
}
