/**
 * The sky, the hazards and the kite: every number that balances the game is here.
 * Units: metres and seconds. The kite flies along +z (distance travelled) with the wind; x is across
 * the field (left is negative) and y is height above the ground.
 */

export const STEP = 1 / 60

/** The part of the sky the kite can fly in. */
export const FIELD = { xHalf: 6, yMin: 1.4, yMax: 12 }

export const KITE = {
  /** Top steering speed (metres a second), and how quickly it closes on where you point. */
  maxSpeed: 10,
  response: 5,
  /** Its size, for hits. */
  radius: 0.55,
  /** Line strength: hits before the line snaps. */
  lives: 3,
  /** Seconds it can't be hit again after a hit. */
  safeAfterHit: 1.6,
}

export type HazardKind = 'bird' | 'rival' | 'cloud' | 'palm' | 'bunting' | 'lantern'

export interface HazardDef {
  /**
   * Shape for hits. 'ball': a sphere of radius r at (x, y). 'pole': a post from the ground up to y,
   * r wide, with a ball of radius top at the top (a rival kite on its line, a palm with its crown).
   * 'bar': a rope right across the field at height y, r thick.
   */
  shape: 'ball' | 'pole' | 'bar'
  r: number
  top?: number
  /** Sideways speed (birds fly across). */
  vx?: number
  /** Upward speed (sky lanterns rise). */
  vy?: number
}

export const HAZARDS: Record<HazardKind, HazardDef> = {
  bird: { shape: 'ball', r: 0.6, vx: 2.6 },
  rival: { shape: 'pole', r: 0.12, top: 1.05 },
  cloud: { shape: 'ball', r: 2.1 },
  palm: { shape: 'pole', r: 0.35, top: 1.5 },
  bunting: { shape: 'bar', r: 0.3 },
  lantern: { shape: 'ball', r: 0.5, vy: 0.9 },
}

export type PowerKind = 'magnet' | 'shield' | 'turbo'

/** How long power-ups last at upgrade level 0, and how much each level adds. */
export const POWER = {
  magnet: { base: 7, perLevel: 1.6 },
  turbo: { base: 3.5, perLevel: 0.7 },
  /** Gust (turbo) speed multiplier. */
  turboBoost: 1.5,
  /** Magnet reach (metres). */
  magnetReach: 4.5,
}

export const UPGRADE_MAX = 5
/** Price of upgrade level n (1-based) for the magnet and the gust. */
export const upgradeCost = (level: number) => [0, 300, 700, 1400, 2500, 4000][level] ?? Infinity
/** Starting a flight with a shield on. */
export const START_SHIELD_COST = 1800

/** Kite designs: sail colour, trim colour, tail colour, price. */
export const PAINTS = [
  { id: 'classic', body: '#e8402f', canopy: '#ffd23f', tail: '#ffffff', price: 0 },
  { id: 'sky', body: '#2f8fd0', canopy: '#ffffff', tail: '#ffd23f', price: 500 },
  { id: 'lotus', body: '#ff6a90', canopy: '#ffffff', tail: '#3f9a3a', price: 900 },
  { id: 'jungle', body: '#3f9a3a', canopy: '#ffcf5a', tail: '#e8402f', price: 1500 },
  { id: 'royal', body: '#5a3a9a', canopy: '#ffc21a', tail: '#ffc21a', price: 2500 },
  { id: 'gold', body: '#e8b81a', canopy: '#c4402c', tail: '#c4402c', price: 5000 },
] as const
export type PaintId = (typeof PAINTS)[number]['id']

/** Coins for flying through a ring. */
export const RING_BONUS = 10

export const LEVELS_PER_WORLD = 20
