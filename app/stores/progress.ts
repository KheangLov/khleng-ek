import { defineStore } from 'pinia'
import {
  LEVELS_PER_WORLD, PAINTS, POWER, START_SHIELD_COST, TOTAL_LEVELS, UPGRADE_MAX, upgradeCost,
  type PaintId, type RunOptions,
} from '#shared/game'

/** Where progress and settings are kept (this device only; nothing is sent anywhere). */
export const STORAGE_KEY = 'khleng-ek:v1'

export interface Settings {
  sound: boolean
  music: boolean
  haptics: boolean
  /** Shadows, smooth edges and sharp pixels (off: faster on older phones). */
  hd: boolean
}

interface Saved {
  /** Best stars per level (index = level number; 0 = not done). */
  stars: number[]
  /** Endless mode's best score and distance. */
  best: { score: number, dist: number }
  /** Coins to spend in the workshop. */
  wallet: number
  upgrades: { magnet: number, turbo: number, shield: boolean }
  paints: PaintId[]
  paint: PaintId
  /** Story scenes already seen, e.g. 'riverside-intro'. */
  seen: string[]
  settings: Settings
}

const DEFAULT_SETTINGS: Settings = { sound: true, music: true, haptics: true, hd: true }

export const useProgressStore = defineStore('progress', () => {
  const loaded = ref(false)
  const stars = ref<number[]>(Array(TOTAL_LEVELS + 1).fill(0))
  const best = ref({ score: 0, dist: 0 })
  const wallet = ref(0)
  const upgrades = ref({ magnet: 0, turbo: 0, shield: false })
  const paints = ref<PaintId[]>(['classic'])
  const paint = ref<PaintId>('classic')
  const seen = ref<string[]>([])
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

  /** The furthest level you can play: one past the furthest done. */
  const unlocked = computed(() => {
    let n = 1
    while (n <= TOTAL_LEVELS && stars.value[n]! > 0) n++
    return Math.min(n, TOTAL_LEVELS)
  })
  const cleared = computed(() => stars.value.filter(s => s > 0).length)
  const totalStars = computed(() => stars.value.reduce((a, b) => a + b, 0))
  const allDone = computed(() => cleared.value >= TOTAL_LEVELS)
  const paintJob = computed(() => PAINTS.find(p => p.id === paint.value) ?? PAINTS[0])

  /** What the workshop's upgrades give a flight. */
  const runOptions = computed<RunOptions>(() => ({
    magnet: POWER.magnet.base + upgrades.value.magnet * POWER.magnet.perLevel,
    turbo: POWER.turbo.base + upgrades.value.turbo * POWER.turbo.perLevel,
    startShield: upgrades.value.shield,
  }))

  function worldStars(world: number) {
    let sum = 0
    for (let n = world * LEVELS_PER_WORLD + 1; n <= (world + 1) * LEVELS_PER_WORLD; n++) sum += stars.value[n]!
    return sum
  }
  function isUnlocked(n: number) {
    return n >= 1 && n <= unlocked.value
  }

  function load() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<Saved>
      if (Array.isArray(saved.stars)) {
        stars.value = Array.from({ length: TOTAL_LEVELS + 1 }, (_, i) => Math.max(0, Math.min(3, Number(saved.stars![i]) || 0)))
      }
      if (saved.best) best.value = { score: Number(saved.best.score) || 0, dist: Number(saved.best.dist) || 0 }
      wallet.value = Math.max(0, Number(saved.wallet) || 0)
      if (saved.upgrades) {
        upgrades.value = {
          magnet: Math.max(0, Math.min(UPGRADE_MAX, Number(saved.upgrades.magnet) || 0)),
          turbo: Math.max(0, Math.min(UPGRADE_MAX, Number(saved.upgrades.turbo) || 0)),
          shield: !!saved.upgrades.shield,
        }
      }
      if (Array.isArray(saved.paints)) paints.value = ['classic', ...saved.paints.filter((p): p is PaintId => PAINTS.some(x => x.id === p) && p !== 'classic')]
      if (saved.paint && paints.value.includes(saved.paint)) paint.value = saved.paint
      if (Array.isArray(saved.seen)) seen.value = saved.seen.filter(s => typeof s === 'string')
      if (saved.settings && typeof saved.settings === 'object') settings.value = { ...DEFAULT_SETTINGS, ...saved.settings }
    }
    catch {
      // Unreadable or blocked storage: start fresh.
    }
  }

  function save() {
    if (!import.meta.client) return
    try {
      const data: Saved = { stars: stars.value, best: best.value, wallet: wallet.value, upgrades: upgrades.value, paints: paints.value, paint: paint.value, seen: seen.value, settings: settings.value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
    catch {
      // Storage full or blocked: progress lasts for this visit only.
    }
  }

  /** Records a finished level. Returns whether it was the first time. */
  function complete(n: number, got: number) {
    const first = stars.value[n] === 0
    if (got > stars.value[n]!) stars.value[n] = got
    save()
    return first
  }

  /** Banks a flight's coins (levels and endless alike). */
  function earn(coins: number) {
    wallet.value += Math.max(0, Math.floor(coins))
    save()
  }

  /** Records an endless run. Returns whether it's a new best. */
  function endless(score: number, dist: number) {
    const record = score > best.value.score
    if (record) best.value = { score, dist: Math.floor(dist) }
    save()
    return record
  }

  function upgradeCostOf(kind: 'magnet' | 'turbo' | 'shield') {
    if (kind === 'shield') return upgrades.value.shield ? Infinity : START_SHIELD_COST
    const level = upgrades.value[kind]
    return level >= UPGRADE_MAX ? Infinity : upgradeCost(level + 1)
  }

  function buyUpgrade(kind: 'magnet' | 'turbo' | 'shield') {
    const cost = upgradeCostOf(kind)
    if (wallet.value < cost) return false
    wallet.value -= cost
    if (kind === 'shield') upgrades.value.shield = true
    else upgrades.value[kind]++
    save()
    return true
  }

  function buyPaint(id: PaintId) {
    const p = PAINTS.find(x => x.id === id)
    if (!p) return false
    if (!paints.value.includes(id)) {
      if (wallet.value < p.price) return false
      wallet.value -= p.price
      paints.value.push(id)
    }
    paint.value = id
    save()
    return true
  }

  function markSeen(id: string) {
    if (!seen.value.includes(id)) {
      seen.value.push(id)
      save()
    }
  }

  function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.value[key] = value
    save()
  }

  function reset() {
    stars.value = Array(TOTAL_LEVELS + 1).fill(0)
    best.value = { score: 0, dist: 0 }
    wallet.value = 0
    upgrades.value = { magnet: 0, turbo: 0, shield: false }
    paints.value = ['classic']
    paint.value = 'classic'
    seen.value = []
    save()
  }

  return {
    loaded, stars, best, wallet, upgrades, paints, paint, paintJob, seen, settings, unlocked, cleared, totalStars, allDone, runOptions,
    worldStars, isUnlocked, load, save, complete, earn, endless, upgradeCostOf, buyUpgrade, buyPaint, markSeen, setSetting, reset,
  }
})
