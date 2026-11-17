/**
 * The rules of the sky, with no drawing: a plain TypeScript engine stepped at a fixed rate. It is
 * deterministic (its own seeded random numbers), so tests can fly whole levels. The kite flies along
 * with the wind; you point where it should go and it steers there, pushed about by gusts. It emits
 * events (coins, rings, power-ups, hits) that drive the effects, sounds and top bar.
 */
import { FIELD, HAZARDS, KITE, POWER, RING_BONUS, type PowerKind } from './data'
import { WORLDS, skyStyle, type Goal, type LevelDef, type WorldDef } from './levels'
import { createRng } from './rng'
import { Course, type Hazard, type SkyStyle } from './course'

export type GameEvent
  = | { type: 'coin', id: number }
    | { type: 'ring', id: number }
    | { type: 'ringMiss', id: number }
    | { type: 'power', kind: PowerKind }
    | { type: 'powerEnd', kind: PowerKind }
    | { type: 'shieldHit', id: number }
    | { type: 'smash', id: number }
    | { type: 'hit', id: number, lives: number }
    | { type: 'crash', id: number, kind: Hazard['kind'] }
    | { type: 'goal', index: number }
    | { type: 'world', world: number }
    | { type: 'won' }

export interface RunOptions {
  /** Seconds a magnet lasts, and a gust (turbo). */
  magnet: number
  turbo: number
  /** Start with a shield on. */
  startShield: boolean
}

export const DEFAULT_RUN: RunOptions = { magnet: POWER.magnet.base, turbo: POWER.turbo.base, startShield: false }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export class Engine {
  readonly level: LevelDef
  readonly endless: boolean
  readonly course: Course
  readonly opts: RunOptions
  world: WorldDef
  worldIndex: number
  state: 'playing' | 'won' | 'crashed' = 'playing'
  time = 0
  /** Metres flown: the kite's position along the course. */
  dist = 0
  speed: number
  /** Where the kite is across the field and how high, its steering speed, and where it's pointed. */
  x = 0
  y = 5
  vx = 0
  vy = 0
  aimX = 0
  aimY = 5
  /** The sideways wind right now. */
  wind = 0
  coins = 0
  rings = 0
  lives = KITE.lives
  safeT = 0
  magnetT = 0
  turboT = 0
  shield: boolean
  done: boolean[]
  /** What snapped the line (for the result screen). */
  crashedInto: Hazard['kind'] | null = null

  private events: GameEvent[] = []
  private style: SkyStyle
  private windPhase: number

  constructor(level: LevelDef, opts: RunOptions = DEFAULT_RUN) {
    this.level = level
    this.endless = level.n === 0
    this.opts = opts
    this.worldIndex = level.world
    this.world = WORLDS[level.world]!
    this.speed = this.world.speed[0]
    this.shield = opts.startShield
    this.style = skyStyle(this.world, level)
    const rng = createRng(level.seed)
    this.windPhase = rng.range(0, 6.28)
    this.course = new Course(rng, this.style)
    this.course.extend(140, this.speed)
    this.done = level.goals.map(() => false)
  }

  /* ------------------------------ Controls ------------------------------ */

  /** Points the kite at a spot in the sky (clamped to the field). */
  steer(x: number, y: number) {
    if (this.state !== 'playing') return
    this.aimX = clamp(x, -FIELD.xHalf, FIELD.xHalf)
    this.aimY = clamp(y, FIELD.yMin, FIELD.yMax)
  }

  /* ------------------------------ Queries ------------------------------ */

  goalProgress(goal: Goal) {
    const have = goal.kind === 'distance' ? Math.floor(this.dist) : goal.kind === 'coins' ? this.coins : this.rings
    return { have: Math.min(have, goal.n), need: goal.n }
  }

  get stars() {
    if (this.state !== 'won') return 0
    return this.coins >= this.level.stars[1] ? 3 : this.coins >= this.level.stars[0] ? 2 : 1
  }

  /** Endless mode's score: metres plus ten a coin. */
  get score() {
    return Math.floor(this.dist) + this.coins * 10
  }

  drainEvents() {
    const out = this.events
    this.events = []
    return out
  }

  /* ------------------------------ Time ------------------------------ */

  step(dt: number) {
    if (this.state !== 'playing') return
    this.time += dt

    // Speed: the wind builds over the flight (and a gust on top).
    const [v0, v1] = this.endless ? [this.world.speed[0], 22] : this.world.speed
    const ramp = this.endless ? Math.min(1, this.dist / 6000) : Math.min(1, this.dist / 2000)
    let target = v0 + (v1 - v0) * ramp
    if (this.turboT > 0) target *= POWER.turboBoost
    this.speed += (target - this.speed) * Math.min(1, dt * 3)
    const before = this.dist
    this.dist += this.speed * dt

    // Steering, with the sideways wind pushing.
    const t = this.time + this.windPhase
    this.wind = this.world.gust * (Math.sin(t * 0.53) * 0.7 + Math.sin(t * 1.37 + 1) * 0.3)
    let vx = (this.aimX - this.x) * KITE.response
    let vy = (this.aimY - this.y) * KITE.response
    const v = Math.hypot(vx, vy)
    if (v > KITE.maxSpeed) {
      vx *= KITE.maxSpeed / v
      vy *= KITE.maxSpeed / v
    }
    this.vx = vx + this.wind
    this.vy = vy
    this.x = clamp(this.x + this.vx * dt, -FIELD.xHalf, FIELD.xHalf)
    this.y = clamp(this.y + this.vy * dt, FIELD.yMin, FIELD.yMax)

    // Timers.
    for (const kind of ['magnet', 'turbo'] as const) {
      const key = kind === 'magnet' ? 'magnetT' : 'turboT'
      if (this[key] > 0) {
        this[key] -= dt
        if (this[key] <= 0) {
          this[key] = 0
          this.emit({ type: 'powerEnd', kind })
        }
      }
    }
    if (this.safeT > 0) this.safeT = Math.max(0, this.safeT - dt)

    // Endless: a new place every kilometre, and a busier sky.
    if (this.endless) {
      const w = Math.floor(this.dist / 1000) % WORLDS.length
      if (w !== this.worldIndex) {
        this.worldIndex = w
        this.world = WORLDS[w]!
        this.style.hazards = { ...this.world.hazards }
        this.emit({ type: 'world', world: w })
      }
      this.style.difficulty = Math.min(1, 0.15 + this.dist / 7000)
    }

    this.course.extend(this.dist + 160, this.speed)
    this.course.trim(this.dist - 20)

    this.moveHazards(dt)
    this.collide()
    this.pickUp(before)
    this.checkGoals()
  }

  private moveHazards(dt: number) {
    for (const h of this.course.hazards) {
      if (h.hit || h.z - this.dist > 45) continue
      if (h.vx) {
        h.x += h.vx * dt
        if (Math.abs(h.x) > FIELD.xHalf + 1) h.vx = -h.vx
      }
      if (h.vy) h.y = Math.min(FIELD.yMax + 2, h.y + h.vy * dt)
    }
  }

  /** Whether the kite touches a hazard. */
  touches(h: Hazard, x = this.x, y = this.y, z = this.dist, margin = 0) {
    const def = HAZARDS[h.kind]
    const R = KITE.radius + margin
    const dz = h.z - z
    if (def.shape === 'bar') return Math.abs(dz) < def.r + R && Math.abs(y - h.y) < def.r + R
    if (def.shape === 'ball') return Math.hypot(h.x - x, h.y - y, dz) < def.r + R
    // A pole: the line or trunk, then the kite or crown at the top.
    if (Math.abs(dz) < def.r + R && Math.abs(h.x - x) < def.r + R && y < h.y) return true
    return Math.hypot(h.x - x, h.y - y, dz) < def.top! + R
  }

  private collide() {
    for (const h of this.course.hazards) {
      if (h.hit || Math.abs(h.z - this.dist) > 3) continue
      if (!this.touches(h)) continue
      h.hit = true
      if (this.turboT > 0) {
        this.emit({ type: 'smash', id: h.id })
        continue
      }
      if (this.safeT > 0) continue
      if (this.shield) {
        this.shield = false
        this.safeT = 0.6
        this.emit({ type: 'shieldHit', id: h.id })
        continue
      }
      this.lives--
      if (this.lives <= 0) {
        this.state = 'crashed'
        this.crashedInto = h.kind
        this.emit({ type: 'crash', id: h.id, kind: h.kind })
        return
      }
      this.safeT = KITE.safeAfterHit
      this.emit({ type: 'hit', id: h.id, lives: this.lives })
    }
  }

  private pickUp(before: number) {
    for (const p of this.course.pickups) {
      if (p.taken) continue
      const dz = p.z - this.dist
      if (dz > 6) continue
      if (p.kind === 'ring') {
        // Rings count when you cross them, through the middle.
        if (p.z > before && p.z <= this.dist) {
          p.taken = true
          if (Math.hypot(p.x - this.x, p.y - this.y) < 1.45) {
            this.rings++
            this.coins += RING_BONUS
            this.emit({ type: 'ring', id: p.id })
          }
          else this.emit({ type: 'ringMiss', id: p.id })
        }
        continue
      }
      const d = Math.hypot(p.x - this.x, p.y - this.y, dz)
      if (p.kind === 'coin') {
        const reach = this.magnetT > 0 && dz < POWER.magnetReach && dz > -1 && d < 7
        if (reach || d < 1.05) {
          p.taken = true
          this.coins++
          this.emit({ type: 'coin', id: p.id })
        }
      }
      else if (d < 1.25) {
        p.taken = true
        if (p.kind === 'magnet') this.magnetT = this.opts.magnet
        if (p.kind === 'turbo') this.turboT = this.opts.turbo
        if (p.kind === 'shield') this.shield = true
        this.emit({ type: 'power', kind: p.kind })
      }
    }
  }

  private checkGoals() {
    if (this.endless) return
    let all = true
    this.level.goals.forEach((g, i) => {
      const p = this.goalProgress(g)
      const met = p.have >= p.need
      if (met && !this.done[i]) {
        this.done[i] = true
        this.emit({ type: 'goal', index: i })
      }
      if (!met) all = false
    })
    if (all) {
      this.state = 'won'
      this.emit({ type: 'won' })
    }
  }

  private emit(event: GameEvent) {
    this.events.push(event)
  }
}
