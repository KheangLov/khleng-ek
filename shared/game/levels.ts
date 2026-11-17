/**
 * The 120 levels: six places to fly, twenty each, and endless mode. A level is a seeded course (the
 * same every time) and a few goals to meet in one flight: fly so far, collect so many coins, fly
 * through so many rings. Star coin targets come from par.ts, made by a simple flyer playing every
 * level (see test/unit/par.test.ts).
 */
import { LEVELS_PER_WORLD, type HazardKind } from './data'
import { PAR } from './par'
import { createRng } from './rng'
import type { SkyStyle } from './course'

export const WORLD_COUNT = 6
export const TOTAL_LEVELS = WORLD_COUNT * LEVELS_PER_WORLD

export type WorldId = 'paddies' | 'palms' | 'tonlesap' | 'angkor' | 'palace' | 'moon'

export interface WorldDef {
  id: WorldId
  night: boolean
  /** Hazards in this sky, by how often they come. */
  hazards: Partial<Record<HazardKind, number>>
  /** Starting and top wind speed (metres a second): how fast the kite flies along. */
  speed: [number, number]
  /** Sideways wind: how hard it pushes (metres a second). */
  gust: number
  /** Ground, sky and haze colours. */
  palette: { ground: string, field: string, sky: string, horizon: string }
  /** What's on the ground below. */
  scenery: 'paddies' | 'palms' | 'water' | 'temple' | 'palace' | 'moon'
  /** Colours of the world's card on the map. */
  accent: { from: string, to: string }
}

export const WORLDS: WorldDef[] = [
  { id: 'paddies', night: false, speed: [9, 13.5], gust: 0.6, scenery: 'paddies', accent: { from: '#9be36a', to: '#2f7f3a' },
    hazards: { bird: 3, bunting: 2, rival: 2 },
    palette: { ground: '#7cb84a', field: '#9fd45a', sky: '#8fd0ff', horizon: '#dff3ff' } },
  { id: 'palms', night: false, speed: [9.5, 14.5], gust: 0.9, scenery: 'palms', accent: { from: '#ffd36a', to: '#a8701a' },
    hazards: { bird: 3, palm: 3, bunting: 2, rival: 2 },
    palette: { ground: '#b8a858', field: '#e0c86a', sky: '#9fd6ff', horizon: '#fff0c8' } },
  { id: 'tonlesap', night: false, speed: [10, 15.5], gust: 1.3, scenery: 'water', accent: { from: '#5fc9e8', to: '#1e6a8a' },
    hazards: { bird: 4, rival: 3, cloud: 2, bunting: 1 },
    palette: { ground: '#4a9ac8', field: '#7cb84a', sky: '#a8dcff', horizon: '#e8f6ff' } },
  { id: 'angkor', night: false, speed: [10.5, 16.5], gust: 1.2, scenery: 'temple', accent: { from: '#ffb46a', to: '#8a4a2a' },
    hazards: { bird: 3, rival: 3, palm: 2, bunting: 2, cloud: 1 },
    palette: { ground: '#8aa858', field: '#b8c870', sky: '#ffc89a', horizon: '#ffe8c8' } },
  { id: 'palace', night: false, speed: [11, 17.5], gust: 1.6, scenery: 'palace', accent: { from: '#ffe07a', to: '#b8701a' },
    hazards: { bird: 3, rival: 4, bunting: 3, cloud: 2 },
    palette: { ground: '#8ab85a', field: '#c8d8a0', sky: '#8fc8ff', horizon: '#e8f0ff' } },
  { id: 'moon', night: true, speed: [11.5, 18.5], gust: 1.8, scenery: 'moon', accent: { from: '#9a8aff', to: '#1a1a4a' },
    hazards: { bird: 2, rival: 3, lantern: 4, bunting: 2, cloud: 1 },
    palette: { ground: '#2a3a3a', field: '#3a4a3a', sky: '#141a3a', horizon: '#3a3a6a' } },
]

export type Goal
  = | { kind: 'distance', n: number }
    | { kind: 'coins', n: number }
    | { kind: 'rings', n: number }

export interface LevelDef {
  /** 1 to TOTAL_LEVELS; 0 is endless mode. */
  n: number
  world: number
  index: number
  goals: Goal[]
  /** 0 to 1. */
  difficulty: number
  /** Chance a pattern is a ring. */
  rings: number
  seed: number
  /** Coins for two and three stars. */
  stars: [number, number]
}

/** "3-12": world 3, level 12. */
export function levelLabel(n: number) {
  const w = Math.floor((n - 1) / LEVELS_PER_WORLD)
  return `${w + 1}-${n - w * LEVELS_PER_WORLD}`
}

const cache = new Map<number, LevelDef>()

export function getLevel(n: number): LevelDef {
  let level = cache.get(n)
  if (!level) cache.set(n, level = makeLevel(n))
  return level
}

const round = (v: number, to: number) => Math.max(to, Math.round(v / to) * to)

function makeLevel(n: number): LevelDef {
  const world = Math.floor((n - 1) / LEVELS_PER_WORLD)
  const index = n - 1 - world * LEVELS_PER_WORLD
  const d = (n - 1) / (TOTAL_LEVELS - 1)
  const local = index / (LEVELS_PER_WORLD - 1)
  const rng = createRng(0x4B1E + n * 6151)
  const difficulty = Math.min(1, 0.05 + d * 0.75 + local * 0.15)

  const goals: Goal[] = []
  const distance = round(300 + 1800 * d + 400 * local, 50)
  let rings = 0.14
  if (index < 2 && world === 0) {
    goals.push({ kind: 'distance', n: index === 0 ? 250 : 400 })
    if (index === 1) goals.push({ kind: 'coins', n: 25 })
  }
  else {
    // Every level is a flight of some length; most also ask for coins or rings (or both).
    goals.push({ kind: 'distance', n: distance })
    const roll = rng.next()
    if (roll < 0.45) goals.push({ kind: 'coins', n: round(distance * (0.1 + 0.03 * rng.next()), 5) })
    else if (roll < 0.8) {
      rings = 0.24
      goals.push({ kind: 'rings', n: Math.max(2, Math.round(distance / 200)) })
    }
    else {
      rings = 0.22
      goals.push({ kind: 'coins', n: round(distance * 0.07, 5) })
      goals.push({ kind: 'rings', n: Math.max(2, Math.round(distance / 260)) })
    }
  }
  const bot = PAR[n - 1] ?? 0
  const coinGoal = goals.find(g => g.kind === 'coins')?.n ?? 0
  return {
    n, world, index, goals, difficulty, rings,
    seed: n * 7919 + 29,
    stars: [Math.max(1, coinGoal + 5, Math.round(bot * 0.6)), Math.max(2, coinGoal + 10, Math.round(bot * 0.85))],
  }
}

/** Endless mode: the place changes as you go, and it keeps getting harder. */
export function endlessLevel(seed: number): LevelDef {
  return { n: 0, world: 0, index: 0, goals: [], difficulty: 0.15, rings: 0.14, seed, stars: [0, 0] }
}

/** The sky's make-up for a level in a world. */
export function skyStyle(world: WorldDef, level: LevelDef): SkyStyle {
  return { hazards: { ...world.hazards }, difficulty: level.difficulty, rings: level.rings }
}
