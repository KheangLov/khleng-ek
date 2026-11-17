import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RUN, Engine, FIELD, HAZARDS, KITE, LEVELS_PER_WORLD, RING_BONUS, STEP, TOTAL_LEVELS, WORLDS,
  endlessLevel, getLevel, levelLabel,
} from '../../shared/game'
import { autoplay } from './helpers/autoplay'

const run = (e: Engine, seconds: number) => {
  for (let t = 0; t < seconds && e.state === 'playing'; t += STEP) e.step(STEP)
}

/** An engine with an empty sky and calm air, for testing one thing at a time. */
function calm(n = 1, opts = DEFAULT_RUN) {
  const e = new Engine(getLevel(n), opts)
  e.course.hazards = []
  e.course.pickups = []
  e.course.end = 1e9
  e.world = { ...e.world, gust: 0 }
  return e
}

describe('levels', () => {
  it('has 120 levels in six worlds', () => {
    expect(TOTAL_LEVELS).toBe(120)
    expect(WORLDS).toHaveLength(6)
    expect(LEVELS_PER_WORLD).toBe(20)
    expect(levelLabel(21)).toBe('2-1')
    expect(levelLabel(120)).toBe('6-20')
  })

  it('makes the same course every time', () => {
    const a = new Engine(getLevel(55))
    const b = new Engine(getLevel(55))
    run(a, 20)
    run(b, 20)
    expect(a.course.hazards.map(h => [h.kind, Math.round(h.x), Math.round(h.z)])).toEqual(b.course.hazards.map(h => [h.kind, Math.round(h.x), Math.round(h.z)]))
  })

  it('always asks for a flight, and stars above the coin goal', () => {
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const level = getLevel(n)
      expect(level.goals[0]!.kind).toBe('distance')
      const coins = level.goals.find(g => g.kind === 'coins')
      if (coins) expect(level.stars[0]).toBeGreaterThan(coins.n)
      expect(level.stars[1]).toBeGreaterThan(level.stars[0])
    }
  })

  it('keeps everything inside the sky', () => {
    for (const n of [1, 60, 120]) {
      const e = new Engine(getLevel(n))
      e.course.extend(3000, 15)
      for (const p of e.course.pickups) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(FIELD.xHalf)
        expect(p.y).toBeGreaterThanOrEqual(FIELD.yMin)
        expect(p.y).toBeLessThanOrEqual(FIELD.yMax)
      }
    }
  })
})

describe('engine', () => {
  it('steers where you point, and stays in the sky', () => {
    const e = calm()
    e.steer(4, 9)
    run(e, 2)
    expect(e.x).toBeCloseTo(4, 1)
    expect(e.y).toBeCloseTo(9, 1)
    e.steer(99, -99)
    run(e, 3)
    expect(e.x).toBeLessThanOrEqual(FIELD.xHalf)
    expect(e.y).toBeGreaterThanOrEqual(FIELD.yMin)
  })

  it('takes three hits to snap the line, with a moment of safety after each', () => {
    const e = calm()
    e.steer(0, 5)
    for (let i = 0; i < 12; i++) e.course.hazards.push({ id: 100 + i, kind: 'bird', x: 0, y: 5, z: 20 + i * 4, vx: 0, vy: 0, hit: false })
    run(e, 30)
    expect(e.state).toBe('crashed')
    expect(e.lives).toBe(0)
    expect(e.crashedInto).toBe('bird')
    // Four metres apart is well inside the safe time: it took more than three birds to snap it.
    expect(e.course.hazards.filter(h => h.hit).length).toBeGreaterThan(KITE.lives)
  })

  it('a shield takes a hit', () => {
    const e = calm(1, { ...DEFAULT_RUN, startShield: true })
    e.steer(0, 5)
    e.course.hazards.push({ id: 7, kind: 'cloud', x: 0, y: 5, z: 15, vx: 0, vy: 0, hit: false })
    run(e, 3)
    expect(e.shield).toBe(false)
    expect(e.lives).toBe(KITE.lives)
  })

  it('flies over a rope of bunting, but not through it', () => {
    for (const [y, hurt] of [[9, false], [6, true]] as const) {
      const e = calm()
      e.y = e.aimY = y
      e.course.hazards.push({ id: 8, kind: 'bunting', x: 0, y: 6, z: 15, vx: 0, vy: 0, hit: false })
      run(e, 3)
      expect(e.lives < KITE.lives).toBe(hurt)
    }
  })

  it('goes round a rival kite\'s line, or over it', () => {
    expect(HAZARDS.rival.shape).toBe('pole')
    for (const [x, y, hurt] of [[0, 3, true], [2, 3, false], [0, 11.5, false]] as const) {
      const e = calm()
      e.x = e.aimX = x
      e.y = e.aimY = y
      e.course.hazards.push({ id: 9, kind: 'rival', x: 0, y: 9, z: 15, vx: 0, vy: 0, hit: false })
      run(e, 3)
      expect(e.lives < KITE.lives, `at ${x}, ${y}`).toBe(hurt)
    }
  })

  it('collects coins, rings and power-ups', () => {
    const e = calm()
    e.steer(0, 5)
    e.course.pickups = [
      { id: 1, kind: 'coin', x: 0, y: 5, z: 10, taken: false },
      { id: 2, kind: 'ring', x: 0, y: 5, z: 14, taken: false },
      { id: 3, kind: 'magnet', x: 0, y: 5, z: 18, taken: false },
      { id: 4, kind: 'coin', x: 2, y: 6, z: 22, taken: false },
      { id: 5, kind: 'ring', x: 4, y: 9, z: 26, taken: false },
    ]
    run(e, 4)
    expect(e.rings).toBe(1)
    expect(e.coins).toBe(2 + RING_BONUS)
    expect(e.magnetT).toBeGreaterThan(0)
  })

  it('wins when every goal is met', () => {
    const r = autoplay(getLevel(1))
    expect(r.won).toBe(true)
    expect(r.stars).toBeGreaterThan(0)
  })

  it('changes place every kilometre in endless mode', () => {
    const r = autoplay(endlessLevel(3), DEFAULT_RUN, 120)
    expect(r.dist).toBeGreaterThan(1000)
    expect(r.engine.worldIndex).toBe(Math.floor(r.dist / 1000) % 6)
  })
})

describe('the simple flyer', () => {
  it('finishes every level', () => {
    for (let n = 1; n <= TOTAL_LEVELS; n++) expect(autoplay(getLevel(n)).won, `level ${n}`).toBe(true)
  }, 300_000)
})
