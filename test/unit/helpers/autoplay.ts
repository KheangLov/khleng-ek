/**
 * A simple flyer, for tests and for the star targets (shared/game/par.ts). It decides at a human
 * pace (every 0.12 s): it tries spots across the sky, follows the path the kite would take to each,
 * throws out any that would touch a hazard on the way (birds and lanterns where they'll be by then),
 * and of the rest picks the one near the most coins and rings that's least far to go.
 */
import { DEFAULT_RUN, Engine, FIELD, KITE, STEP, type LevelDef, type RunOptions } from '../../../shared/game'

const TICK = 0.12

export interface FlyResult { won: boolean, dist: number, coins: number, rings: number, stars: number, engine: Engine }

export function autoplay(level: LevelDef, opts: RunOptions = DEFAULT_RUN, limit = 600): FlyResult {
  const e = new Engine(level, opts)
  let next = 0
  while (e.state === 'playing' && e.time < limit) {
    e.step(STEP)
    e.drainEvents()
    if (e.time < next) continue
    next = e.time + TICK
    think(e)
  }
  return { won: e.state === 'won', dist: e.dist, coins: e.coins, rings: e.rings, stars: e.stars, engine: e }
}

const SPOTS: [number, number][] = []
for (let x = -FIELD.xHalf + 0.5; x <= FIELD.xHalf - 0.5 + 1e-6; x += 1) {
  for (let y = FIELD.yMin + 0.3; y <= FIELD.yMax - 0.2 + 1e-6; y += 0.9) SPOTS.push([x, y])
}

/** Where the kite would be after `t` seconds heading for (x, y). */
function along(e: Engine, x: number, y: number, t: number): [number, number] {
  const d = Math.hypot(x - e.x, y - e.y)
  if (d < 1e-6) return [x, y]
  const k = Math.min(1, (t * KITE.maxSpeed * 0.8) / d)
  return [e.x + (x - e.x) * k, e.y + (y - e.y) * k]
}

export function think(e: Engine) {
  const horizon = e.speed * 1.7 + 4
  const ahead = e.course.hazards.filter(h => !h.hit && h.z - e.dist > -1.5 && h.z - e.dist < horizon)
  const goodies = e.course.pickups.filter(p => !p.taken && p.z - e.dist > 0.5 && p.z - e.dist < e.speed * 1.4 + 3)
  let best: [number, number] = [e.aimX, e.aimY]
  let bestScore = -Infinity
  for (const [x, y] of SPOTS) {
    let danger = 0
    for (const h of ahead) {
      // Check a few moments around when it passes the kite.
      for (const lag of [-0.08, 0, 0.08]) {
        const t = Math.max(0, (h.z - e.dist) / e.speed + lag)
        const [px, py] = along(e, x, y, t)
        const moved = { ...h, x: h.x + h.vx * t, y: h.y + h.vy * t }
        if (e.touches(moved, px, py, h.z, 0.45)) {
          danger += 1 / (1 + t)
          break
        }
      }
    }
    let gain = 0
    for (const p of goodies) {
      const t = (p.z - e.dist) / e.speed
      const [px, py] = along(e, x, y, t)
      const d = Math.hypot(p.x - px, p.y - py)
      if (p.kind === 'ring') gain += d < 0.9 ? 14 : 3 / (1 + d)
      else if (p.kind === 'coin') gain += d < 0.9 ? 1 : 0.3 / (1 + d)
      else gain += d < 1 ? 4 : 0
    }
    const score = -danger * 1000 + gain - Math.hypot(x - e.aimX, y - e.aimY) * 0.04 - Math.abs(y - 6.5) * 0.02
    if (score > bestScore) {
      bestScore = score
      best = [x, y]
    }
  }
  e.steer(best[0], best[1])
}
