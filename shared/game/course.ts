/**
 * The course: hazards, coins, rings and power-ups placed ahead of the kite as it flies, from a seeded
 * random generator (the same course every time for a level). It's made in patterns (a flock of birds,
 * a rope of bunting, rival kites, a trail of coins), each with a way through, and spaced so there's
 * time to steer between them.
 */
import { FIELD, type HazardKind, type PowerKind } from './data'
import type { Rng } from './rng'

export interface Hazard {
  id: number
  kind: HazardKind
  x: number
  /** Height: of a ball's centre, a pole's top or a rope. */
  y: number
  z: number
  /** Sideways and upward speed (birds, lanterns). */
  vx: number
  vy: number
  hit: boolean
}

export type PickupKind = 'coin' | 'ring' | PowerKind

export interface Pickup {
  id: number
  kind: PickupKind
  x: number
  y: number
  z: number
  taken: boolean
}

/** What a world's sky is like: how often each hazard comes, and the rings. */
export interface SkyStyle {
  hazards: Partial<Record<HazardKind, number>>
  /** 0 (easy) to 1. */
  difficulty: number
  /** Chance a pattern is a ring. */
  rings: number
}

const { xHalf, yMin, yMax } = FIELD

export class Course {
  hazards: Hazard[] = []
  pickups: Pickup[] = []
  /** How far ahead the course is made. */
  end = 40
  private id = 0
  private lastPower = 0

  constructor(private rng: Rng, private style: SkyStyle) {}

  /** Makes the course up to `until` metres, spaced for flying at `speed`. */
  extend(until: number, speed: number) {
    while (this.end < until) {
      const d = this.style.difficulty
      const len = this.pattern(this.end, speed, d)
      this.end += len + speed * (1.15 - d * 0.3) + 7 + this.rng.range(0, 8 * (1 - d))
    }
  }

  /** Forgets what's behind. */
  trim(behind: number) {
    if (this.hazards.length && this.hazards[0]!.z < behind) this.hazards = this.hazards.filter(h => h.z >= behind)
    if (this.pickups.length && this.pickups[0]!.z < behind) this.pickups = this.pickups.filter(p => p.z >= behind)
  }

  private hazard(kind: HazardKind, x: number, y: number, z: number, vx = 0, vy = 0) {
    this.hazards.push({ id: ++this.id, kind, x, y, z, vx, vy, hit: false })
  }

  private pickup(kind: PickupKind, x: number, y: number, z: number) {
    this.pickups.push({ id: ++this.id, kind, x: clamp(x, -xHalf + 0.6, xHalf - 0.6), y: clamp(y, yMin + 0.4, yMax - 0.4), z, taken: false })
  }

  /** A trail of coins from one point to another (and a power-up now and then). */
  private trail(z: number, n: number, from: [number, number], to: [number, number], spacing = 2.4) {
    const power = z - this.lastPower > 240 && this.rng.next() < 0.5
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0
      const s = t * t * (3 - 2 * t)
      const x = from[0] + (to[0] - from[0]) * s
      const y = from[1] + (to[1] - from[1]) * s
      if (power && i === n - 1) {
        this.lastPower = z
        this.pickup(this.rng.pick(['magnet', 'shield', 'turbo'] as const), x, y, z + i * spacing)
      }
      else this.pickup('coin', x, y, z + i * spacing)
    }
    return (n - 1) * spacing
  }

  private point(): [number, number] {
    return [this.rng.range(-xHalf + 1, xHalf - 1), this.rng.range(yMin + 1, yMax - 1.5)]
  }

  private pick(): HazardKind | 'coins' | 'ring' {
    if (this.rng.next() < this.style.rings) return 'ring'
    const weights = Object.entries(this.style.hazards) as [HazardKind, number][]
    const total = weights.reduce((s, [, w]) => s + w, 0) + 2.2
    let r = this.rng.range(0, total)
    for (const [kind, w] of weights) {
      if ((r -= w) < 0) return kind
    }
    return 'coins'
  }

  private pattern(z: number, speed: number, d: number): number {
    const kind = this.pick()
    switch (kind) {
      case 'coins': {
        const a = this.point()
        const b = this.point()
        return this.trail(z, this.rng.int(6, 10), a, b)
      }
      case 'ring': {
        const [x, y] = this.point()
        const lead = this.trail(z, 4, [x + this.rng.range(-3, 3), y + this.rng.range(-2, 2)], [x, y])
        this.pickup('ring', x, y, z + lead + 3)
        // Harder rings sit between rival kites.
        if (d > 0.35 && this.rng.next() < d) {
          for (const side of [-1, 1]) {
            const px = x + side * this.rng.range(2.6, 3.4)
            if (Math.abs(px) < xHalf) this.hazard('rival', px, this.rng.range(6, 10.5), z + lead + 3)
          }
        }
        return lead + 3
      }
      case 'bird': {
        const n = 1 + this.rng.int(0, d > 0.5 ? 4 : 3)
        const y0 = this.rng.range(yMin + 1.2, yMax - 1.5)
        const dir = this.rng.next() < 0.5 ? -1 : 1
        const speedX = 1.6 + d * 2.2
        for (let i = 0; i < n; i++) this.hazard('bird', clamp(-dir * (xHalf - 1) + this.rng.range(-1, 2) - dir * i * 1.4, -xHalf, xHalf), clamp(y0 + (i % 2) * 1.1 - 0.5, yMin + 0.6, yMax - 0.6), z + i * 1.3, dir * speedX, 0)
        // Coins above or below the flock.
        const cy = y0 > (yMin + yMax) / 2 ? y0 - 3.2 : y0 + 3.2
        this.trail(z - 2, 3, [0, cy], [0, cy])
        return n * 1.3
      }
      case 'rival': {
        const n = 1 + this.rng.int(0, d > 0.3 ? 3 : 2)
        const xs: number[] = []
        for (let i = 0; i < n * 4 && xs.length < n; i++) {
          const x = this.rng.range(-xHalf + 1, xHalf - 1)
          if (xs.every(o => Math.abs(o - x) > 3.2)) xs.push(x)
        }
        // A slalom on harder levels: one after another.
        const slalom = d > 0.45 && this.rng.next() < 0.5
        xs.forEach((x, i) => this.hazard('rival', x, this.rng.range(5.5, yMax + 0.4), z + (slalom ? i * Math.max(6, speed * 0.55) : this.rng.range(0, 2))))
        const free = pickGap(xs)
        this.trail(z - 3, 4, [free, 3], [free, 3.2])
        return slalom ? (xs.length - 1) * Math.max(6, speed * 0.55) : 2
      }
      case 'cloud': {
        const n = 1 + this.rng.int(0, 2)
        for (let i = 0; i < n; i++) this.hazard('cloud', this.rng.range(-xHalf + 2, xHalf - 2), this.rng.range(8.6, 10.6), z + i * 3)
        this.trail(z - 2, 5, [this.rng.range(-3, 3), 4], [this.rng.range(-3, 3), 4.5])
        return n * 3
      }
      case 'palm': {
        const n = 2 + this.rng.int(0, 2)
        for (let i = 0; i < n; i++) this.hazard('palm', this.rng.range(-xHalf + 0.5, xHalf - 0.5), this.rng.range(4, 6.2), z + i * 2.5)
        this.trail(z, 4, [this.rng.range(-3, 3), 8.2], [this.rng.range(-3, 3), 8.8])
        return n * 2.5
      }
      case 'bunting': {
        const h = this.rng.range(3.8, 8.6)
        this.hazard('bunting', 0, h, z)
        const above = h < 6.5 ? this.rng.next() < 0.7 : false
        const y = above ? Math.min(yMax - 1, h + 2.6) : Math.max(yMin + 0.6, h - 2.4)
        this.trail(z - 4, 4, [this.rng.range(-3, 3), y], [this.rng.range(-3, 3), y])
        return 2
      }
      case 'lantern': {
        const n = 3 + this.rng.int(0, 3)
        for (let i = 0; i < n; i++) this.hazard('lantern', this.rng.range(-xHalf + 0.8, xHalf - 0.8), this.rng.range(yMin, 5), z + i * 2.2, 0, 0.6 + this.rng.range(0, 0.6))
        this.trail(z + 1, 4, [this.rng.range(-3, 3), 10], [this.rng.range(-3, 3), 10.5])
        return n * 2.2
      }
    }
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

/** The middle of the widest gap between posts across the field. */
function pickGap(xs: number[]) {
  const edges = [-xHalf, ...[...xs].sort((a, b) => a - b), xHalf]
  let best = 0
  let width = -1
  for (let i = 0; i < edges.length - 1; i++) {
    const w = edges[i + 1]! - edges[i]!
    if (w > width) {
      width = w
      best = (edges[i]! + edges[i + 1]!) / 2
    }
  }
  return best
}
