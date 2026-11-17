/**
 * Every 3D model in the game, built from simple shapes in code: the khleng ek (the humming kite) and
 * rival kites, egrets, storm clouds, bunting, sky lanterns, coins, rings and power-ups, and the
 * countryside below (sugar palms, stilt houses, temples, the palace). One world unit is a metre.
 * Kites lie in the x-y plane with their back to +z (the camera follows from behind); ground models
 * stand on y = 0.
 */
import { CatmullRomCurve3, Group, TubeGeometry, Vector3 } from 'three'
import { geo, group, mat, paint, part, rng, shadows } from './kit'

export type ModelName
  = | 'kite' | 'rival' | 'bird' | 'cloud' | 'palm' | 'lantern' | 'bunting'
    | 'coin' | 'ring' | 'magnet' | 'shield' | 'turbo'
    | 'sugarpalm' | 'tree' | 'house' | 'stupa' | 'prang' | 'palace' | 'boat' | 'flyer'
    | 'dara' | 'tasok'

const PI = Math.PI

/* ------------------------------ Textures ------------------------------ */

const krama = () => paint('krama', 64, (g, s) => {
  g.fillStyle = '#d93a2b'
  g.fillRect(0, 0, s, s)
  g.fillStyle = 'rgba(255,255,255,.85)'
  for (let i = 0; i < s; i += 16) {
    g.fillRect(i, 0, 5, s)
    g.fillRect(0, i, s, 5)
  }
})

/** Thatch or roof tiles: rows of strokes. */
const tiles = (base: string, line: string) => paint(`tiles${base}${line}`, 64, (g, s) => {
  g.fillStyle = base
  g.fillRect(0, 0, s, s)
  g.fillStyle = line
  for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 2)
}, 2, 2)

/* ------------------------------ The kites ------------------------------ */

const WING: [number, number][] = [[-1.2, 0], [-1.17, 0.28], [-0.95, 0.5], [-0.5, 0.62], [0, 0.66], [0.5, 0.62], [0.95, 0.5], [1.17, 0.28], [1.2, 0], [0.7, -0.12], [0, -0.04], [-0.7, -0.12]]
const BODY: [number, number][] = [[-0.5, -0.06], [0.5, -0.06], [0.42, -0.6], [0.2, -1.0], [0, -1.12], [-0.2, -1.0], [-0.42, -0.6]]
const scaled = (pts: [number, number][], s: number, dy = 0): [number, number][] => pts.map(([x, y]) => [x * s, y * s + dy])

/**
 * A khleng ek: a broad curved wing over a smaller body, a bamboo frame, the "ek" (a bow strung across
 * the top that hums in the wind) and two long ribbon tails. About 2.4 m wide; children named 'pose'
 * (the whole kite, for tilting), 'tail' (ribbon pieces, for waving) and 'ek' (the bow's string).
 */
export function kite(body = '#e8402f', trim = '#ffd23f', tail = '#ffffff') {
  const root = new Group()
  const pose = group(root)
  pose.name = 'pose'
  const sail = mat(body, { rough: 0.55, side: 'double' })
  const inner = mat(trim, { rough: 0.55, side: 'double' })
  const bamboo = mat('#c8a060', { rough: 0.6 })
  part(pose, geo.shape('kwing', WING, 0.02), sail)
  part(pose, geo.shape('kbody', BODY, 0.02), sail)
  // The trim: a smaller wing and body inside, and a sun at the centre.
  part(pose, geo.shape('kwing2', scaled(WING, 0.72, 0.08), 0.02), inner, [0, 0, 0.012])
  part(pose, geo.shape('kbody2', scaled(BODY, 0.62, -0.08), 0.02), inner, [0, 0, 0.012])
  part(pose, geo.cyl(0.16, 0.16, 0.02, 20), sail, [0, 0.22, 0.03], [PI / 2, 0, 0])
  // The frame.
  part(pose, geo.cyl(0.025, 0.025, 2.0, 6), bamboo, [0, -0.2, 0.04])
  part(pose, geo.torus(1.2, 0.022, PI), bamboo, [0, 0, 0.04], [0, 0, 0], [1, 0.55, 1])
  // The ek: a bow above the wing, and its string.
  const ek = group(pose, [0, 0.95, 0.06])
  part(ek, geo.torus(0.85, 0.028, PI), bamboo, [0, -0.3, 0], [0, 0, 0], [1, 0.42, 1])
  const string = part(ek, geo.cyl(0.008, 0.008, 1.7, 4), mat('#f4efe4', { rough: 0.4 }), [0, -0.3, 0], [0, 0, PI / 2])
  string.name = 'ek'
  part(ek, geo.cyl(0.015, 0.015, 0.4, 4), bamboo, [0, -0.2, 0])
  // Two ribbon tails, in pieces so they can wave.
  const ribbon = mat(tail, { rough: 0.6, side: 'double' })
  for (const side of [-1, 1]) {
    const t = group(pose, [side * 0.18, -1.05, 0])
    t.name = 'tails'
    for (let i = 0; i < 6; i++) {
      const piece = part(t, geo.box(0.08, 0.26, 0.01), i % 2 ? ribbon : inner, [0, -0.13 - i * 0.26, 0])
      piece.name = 'tail'
    }
  }
  return shadows(root, false)
}

const RIVAL_COLORS: [string, string, string][] = [
  ['#2f8fd0', '#ffffff', '#ffd23f'], ['#3f9a3a', '#ffd23f', '#e8402f'], ['#7a4aa0', '#ff9ad0', '#ffffff'],
  ['#ff9a1a', '#2a2a30', '#ffd23f'], ['#e8402f', '#ffffff', '#2f8fd0'], ['#2a2a30', '#ffd23f', '#e8402f'],
]

/** Someone else's kite (its line is drawn by the view). */
function rival(seed = Math.floor(Math.random() * 1000)) {
  const [a, b, c] = RIVAL_COLORS[seed % RIVAL_COLORS.length]!
  return kite(a, b, c)
}

/** A white egret, wings out ('wingL' and 'wingR' flap). Flies along x. */
function bird() {
  const root = new Group()
  const white = mat('#f8f6f0', { rough: 0.7 })
  const pose = group(root, [0, 0, 0], [0, PI / 2, 0])
  part(pose, geo.capsule(0.11, 0.5), white, [0, 0, 0], [PI / 2, 0, 0])
  part(pose, geo.sphere(0.09), white, [0, 0.12, -0.38])
  part(pose, geo.cone(0.025, 0.3, 6), mat('#ffc21a', { rough: 0.4 }), [0, 0.11, -0.58], [-PI / 2, 0, 0])
  part(pose, geo.sphere(0.018), mat('#1a1410'), [0.05, 0.15, -0.42])
  part(pose, geo.sphere(0.018), mat('#1a1410'), [-0.05, 0.15, -0.42])
  part(pose, geo.cyl(0.012, 0.012, 0.4, 4), mat('#2a2a20'), [0.04, -0.02, 0.45], [PI / 2 - 0.2, 0, 0])
  part(pose, geo.cyl(0.012, 0.012, 0.4, 4), mat('#2a2a20'), [-0.04, -0.02, 0.45], [PI / 2 - 0.2, 0, 0])
  const wingPts: [number, number][] = [[0, 0.2], [0.35, 0.18], [0.7, 0.05], [0.62, -0.1], [0.3, -0.18], [0, -0.2]]
  for (const side of [-1, 1]) {
    const w = group(pose, [side * 0.06, 0.04, 0])
    w.name = side < 0 ? 'wingL' : 'wingR'
    part(w, geo.shape('wing', wingPts, 0.02), white, [0, 0, 0], [PI / 2, 0, side < 0 ? PI : 0])
  }
  return shadows(root, false)
}

/** A dark storm cloud, about 2 m across, with a flicker of lightning ('bolt'). */
function cloud() {
  const root = new Group()
  const dark = mat('#5a6070', { rough: 1 })
  const light = mat('#8a90a0', { rough: 1 })
  const r = rng(11)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * PI * 2
    part(root, geo.sphere(1, 16, 12), i % 3 ? dark : light, [Math.cos(a) * 1.1, Math.sin(a) * 0.45 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.8], [0, 0, 0], 0.8 + r() * 0.5)
  }
  part(root, geo.sphere(1, 16, 12), light, [0, 0.4, 0], [0, 0, 0], 1.3)
  const bolt = part(root, geo.shape('bolt', [[0.15, 0.6], [-0.25, -0.05], [0.05, -0.05], [-0.12, -0.7], [0.3, 0.12], [0.02, 0.12]], 0.06), mat('#fff27a', { emissive: '#ffe14d', emissiveIntensity: 1.6 }), [0.3, -1.3, 0.6])
  bolt.name = 'bolt'
  return root
}

/** A sugar palm as a hazard: the crown at about 5.4 m (the view scales it to the hazard's height). */
function palm() {
  const root = new Group()
  const trunk = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0.1, 2, 0), new Vector3(-0.05, 4, 0.05), new Vector3(0.05, 5.4, 0)])
  part(root, new TubeGeometry(trunk, 16, 0.2, 10), mat('#5a4a3a', { rough: 1 }))
  fanCrown(root, 5.4, 1.4)
  return shadows(root, false)
}

/** A round crown of fan leaves, like a sugar palm's. */
function fanCrown(parent: Group, y: number, size: number) {
  const leaf = mat('#3f8a3a', { rough: 0.75, side: 'double' })
  const dry = mat('#8a8a4a', { rough: 0.9, side: 'double' })
  const fan: [number, number][] = []
  for (let i = 0; i <= 8; i++) {
    const a = -0.9 + (i / 8) * 1.8
    fan.push([Math.sin(a) * 0.55, 0.6 + Math.cos(a) * 0.55])
  }
  fan.push([0, 0])
  for (let i = 0; i < 14; i++) {
    const g = group(parent, [0, y, 0], [0, (i / 14) * PI * 2, 0], size)
    const tilt = i % 2 ? -0.5 : -1.1
    part(g, geo.cyl(0.015, 0.015, 0.6, 4), leaf, [0, 0.2, 0.15], [tilt, 0, 0])
    part(g, geo.shape('fan', fan, 0.01), i % 5 === 4 ? dry : leaf, [0, 0.1, 0.3], [tilt - 0.4, 0, 0])
  }
  part(parent, geo.sphere(0.32), mat('#4a3a2a', { rough: 0.9 }), [0, y, 0])
}

/** A sky lantern: a glowing paper lamp rising on its flame. */
function lantern() {
  const root = new Group()
  part(root, geo.cyl(0.36, 0.28, 0.75, 16, true), mat('#ffb05a', { rough: 0.6, emissive: '#ff8a1a', emissiveIntensity: 1.3, side: 'double' }))
  part(root, geo.cyl(0.36, 0.36, 0.02, 16), mat('#ffc88a', { emissive: '#ff9a3a', emissiveIntensity: 1 }), [0, 0.38, 0])
  part(root, geo.sphere(0.08), mat('#fff2a0', { emissive: '#ffe14d', emissiveIntensity: 2 }), [0, -0.3, 0])
  return root
}

/** Festival bunting right across the sky at height h: two poles, a rope and triangle flags. */
export function bunting(width: number, h: number) {
  const root = new Group()
  const pole = mat('#8a6a42', { rough: 0.8 })
  for (const side of [-1, 1]) part(root, geo.cyl(0.1, 0.12, 1, 8), pole, [side * width / 2, -h / 2, 0], [0, 0, 0], [1, h, 1])
  part(root, geo.cyl(0.02, 0.02, width, 4), mat('#f4efe4'), [0, 0, 0], [0, 0, PI / 2])
  const colors = ['#e8402f', '#ffd23f', '#2f8fd0', '#3f9a3a', '#ffffff', '#ff6a90']
  const flag: [number, number][] = [[-0.22, 0], [0.22, 0], [0, -0.48]]
  const n = Math.floor(width / 0.55)
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + (i + 0.5) * (width / n)
    const sag = -Math.sin(((i + 0.5) / n) * PI) * 0.12
    part(root, geo.shape('flag', flag, 0.01), mat(colors[i % colors.length]!, { rough: 0.6, side: 'double' }), [x, sag, 0])
  }
  return root
}

/* ------------------------------ Pickups ------------------------------ */

function coin() {
  const root = new Group()
  const spin = group(root)
  spin.name = 'spin'
  part(spin, geo.cyl(0.3, 0.3, 0.07, 28), mat('#ffcf3a', { rough: 0.3, metal: 0.35, emissive: '#ff9a00', emissiveIntensity: 0.15 }), [0, 0, 0], [PI / 2, 0, 0])
  part(spin, geo.torus(0.3, 0.025), mat('#f0b000', { rough: 0.3, metal: 0.35 }))
  const star: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i / 10) * PI * 2
    const r = i % 2 ? 0.075 : 0.18
    star.push([Math.cos(a) * r, -Math.sin(a) * r])
  }
  part(spin, geo.shape('star', star, 0.09, 0.008), mat('#fff0a0', { rough: 0.3, metal: 0.2 }))
  return root
}

/** A ring to fly through: a gold hoop garlanded with marigolds. 'spin' turns the garland. */
function ring() {
  const root = new Group()
  part(root, geo.torus(1.45, 0.07), mat('#ffc21a', { rough: 0.3, metal: 0.5, emissive: '#ff9a00', emissiveIntensity: 0.25 }))
  const spin = group(root)
  spin.name = 'spin'
  const flowers = [mat('#ff8a1a', { rough: 0.7 }), mat('#ffd23f', { rough: 0.7 }), mat('#ffffff', { rough: 0.7 })]
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * PI * 2
    part(spin, geo.sphere(0.12, 10, 8), flowers[i % 3]!, [Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0.06])
  }
  return root
}

function magnet() {
  const root = new Group()
  const spin = group(root)
  spin.name = 'spin'
  part(spin, geo.torus(0.22, 0.08, PI), mat('#e8402f', { rough: 0.35, metal: 0.3 }), [0, 0.05, 0], [0, 0, PI])
  for (const x of [-0.22, 0.22]) part(spin, geo.cyl(0.08, 0.08, 0.14, 14), mat('#e8eef2', { rough: 0.3, metal: 0.6 }), [x, -0.02, 0])
  part(root, geo.sphere(0.42, 18, 12), mat('#ff8a8a', { opacity: 0.18, rough: 0.2 }))
  return root
}

function shield() {
  const root = new Group()
  const spin = group(root)
  spin.name = 'spin'
  part(spin, geo.torus(0.24, 0.07), mat('#ffffff', { rough: 0.8, map: krama() }))
  part(spin, geo.sphere(0.1), mat('#ffd23f', { rough: 0.3, metal: 0.4 }))
  part(root, geo.sphere(0.42, 18, 12), mat('#8fd8ff', { opacity: 0.2, rough: 0.2 }))
  return root
}

/** A gust of wind: three swirls. */
function turbo() {
  const root = new Group()
  const spin = group(root)
  spin.name = 'spin'
  const air = mat('#ffffff', { rough: 0.3, emissive: '#bfe6ff', emissiveIntensity: 0.6 })
  for (let i = 0; i < 3; i++) part(spin, geo.torus(0.12 + i * 0.06, 0.025, PI * 1.4), air, [0, 0, (i - 1) * 0.08], [0, 0, i * 1.2])
  part(root, geo.sphere(0.42, 18, 12), mat('#bfe6ff', { opacity: 0.22, rough: 0.2 }))
  return root
}

/* ------------------------------ The countryside ------------------------------ */

function sugarpalm() {
  const root = new Group()
  const trunk = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(0.1, 3, 0), new Vector3(-0.08, 6, 0.05), new Vector3(0.05, 8.6, 0)])
  part(root, new TubeGeometry(trunk, 16, 0.22, 10), mat('#5a4a3a', { rough: 1 }))
  fanCrown(root, 8.6, 1.5)
  return shadows(root, false)
}

function tree() {
  const root = new Group()
  part(root, geo.cyl(0.2, 0.28, 2.6, 10), mat('#6a4a2a', { rough: 1 }), [0, 1.3, 0])
  const leaf = mat('#3f8f3a', { rough: 0.85 })
  const light = mat('#58a84a', { rough: 0.85 })
  for (const [x, y, z, s] of [[0, 3.3, 0, 1.6], [1.0, 2.9, 0.2, 1.1], [-1.0, 3.0, -0.1, 1.2], [0.1, 4.3, 0.1, 1.1]] as const) {
    part(root, geo.sphere(1, 14, 10), s > 1.5 ? leaf : light, [x, y, z], [0, 0, 0], s)
  }
  return shadows(root, false)
}

/** A wooden Khmer house on stilts, with a steep tiled roof and a ladder. */
function house() {
  const root = new Group()
  const wood = mat('#8a5a34', { rough: 0.85 })
  const plank = mat('#a8744a', { rough: 0.85 })
  for (const x of [-1.8, 0, 1.8]) for (const z of [-1.4, 1.4]) part(root, geo.cyl(0.1, 0.1, 2.2, 6), wood, [x, 1.1, z])
  part(root, geo.box(4.2, 0.15, 3.4), wood, [0, 2.2, 0])
  part(root, geo.box(4, 2, 3.2), plank, [0, 3.25, 0])
  for (const x of [-1, 1]) part(root, geo.box(0.7, 0.8, 0.05), mat('#3a2a1a'), [x, 3.4, 1.62])
  part(root, geo.gable(4.8, 4, 2.2, 0.12), mat('#ffffff', { rough: 0.8, map: tiles('#b8502a', '#8a3a1a'), side: 'double' }), [0, 4.25, 0])
  part(root, geo.gableWall(4.0, 3.2, 1.9), plank, [0, 4.25, 0])
  for (let i = 0; i < 5; i++) part(root, geo.box(0.8, 0.05, 0.12), wood, [2.4, 0.4 + i * 0.42, 1.0 - i * 0.05])
  return shadows(root, false)
}

function stupa() {
  const root = new Group()
  const white = mat('#f4efe4', { rough: 0.9 })
  const gold = mat('#ffc21a', { rough: 0.3, metal: 0.6 })
  part(root, geo.rbox(3.2, 0.6, 3.2, 0.05), white, [0, 0.3, 0])
  part(root, geo.rbox(2.6, 0.6, 2.6, 0.05), white, [0, 0.9, 0])
  part(root, geo.lathe('bell', [[0, 0], [1.1, 0], [1.05, 0.4], [0.8, 1.1], [0.45, 1.5], [0.3, 1.6], [0, 1.62]], 28), white, [0, 1.2, 0])
  part(root, geo.lathe('spire', [[0, 0], [0.3, 0], [0.24, 0.6], [0.14, 1.4], [0.05, 2.2], [0, 2.4]], 16), gold, [0, 2.8, 0])
  for (let i = 0; i < 4; i++) part(root, geo.torus(0.27 - i * 0.04, 0.03), gold, [0, 3.0 + i * 0.25, 0], [PI / 2, 0, 0])
  return shadows(root, false)
}

/** A temple tower in the Angkor style: a lotus-bud spire in stepped tiers, on a terrace. */
function prang() {
  const root = new Group()
  const stone = mat('#a89878', { rough: 1 })
  const dark = mat('#8a7a5a', { rough: 1 })
  part(root, geo.box(9, 1.2, 9), stone, [0, 0.6, 0])
  part(root, geo.box(7, 1.2, 7), dark, [0, 1.8, 0])
  part(root, geo.box(5, 3, 5), stone, [0, 3.9, 0])
  part(root, geo.box(1.4, 2.2, 0.3), mat('#3a3020'), [0, 3.5, 2.5])
  part(root, geo.lathe('prang', [[0, 0], [2.4, 0], [2.3, 0.8], [2.0, 1.0], [2.0, 1.8], [1.7, 2.0], [1.6, 2.8], [1.3, 3.0], [1.2, 3.8], [0.9, 4.0], [0.8, 4.8], [0.5, 5.2], [0.25, 6.0], [0, 6.6]], 8), stone, [0, 5.4, 0], [0, PI / 8, 0])
  for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]] as const) {
    part(root, geo.lathe('prang2', [[0, 0], [1.0, 0], [0.9, 0.8], [0.8, 1.0], [0.75, 1.8], [0.55, 2.0], [0.45, 2.8], [0.2, 3.4], [0, 3.8]], 8), dark, [x, 2.4, z], [0, PI / 8, 0])
  }
  return shadows(root, false)
}

/** A royal hall: a long white hall under tiered orange-and-green roofs, with a gold spire. */
function palace() {
  const root = new Group()
  const white = mat('#f6f0e2', { rough: 0.85 })
  const gold = mat('#ffc21a', { rough: 0.3, metal: 0.6 })
  part(root, geo.box(10, 1, 6), white, [0, 0.5, 0])
  part(root, geo.box(8.5, 3, 4.6), mat('#fff6e0', { rough: 0.85 }), [0, 2.5, 0])
  for (let i = -3; i <= 3; i++) part(root, geo.cyl(0.18, 0.2, 3, 8), white, [i * 1.3, 2.5, 2.6])
  const roofs = [tiles('#e8802a', '#b85a1a'), tiles('#3f8f4a', '#2a6a3a')]
  for (let t = 0; t < 3; t++) {
    const len = 10 - t * 2.4
    const span = 6.4 - t * 1.4
    part(root, geo.gable(len, span, 2.2 - t * 0.3, 0.14), mat('#ffffff', { rough: 0.6, map: roofs[t % 2]!, side: 'double' }), [0, 4 + t * 1.1, 0])
    part(root, geo.gableWall(len - 0.3, span - 0.4, 2.0 - t * 0.3), mat('#ffd36a', { rough: 0.7 }), [0, 4 + t * 1.1, 0])
  }
  part(root, geo.cyl(0.5, 0.7, 1.4, 8), gold, [0, 7.6, 0])
  part(root, geo.lathe('pspire', [[0, 0], [0.5, 0], [0.35, 1.0], [0.2, 2.4], [0.06, 3.6], [0, 4.0]], 10), gold, [0, 8.3, 0])
  for (const x of [-4.9, 4.9]) part(root, geo.cone(0.12, 1.2, 6), gold, [x, 5.0, 0], [0, 0, x < 0 ? 0.5 : -0.5])
  return shadows(root, false)
}

function boat() {
  const root = new Group()
  part(root, geo.lathe('hull', [[0, 0], [0.5, 0.05], [0.7, 0.4], [0.72, 0.5]], 4), mat('#8a5a34', { rough: 0.7 }), [0, 0, 0], [0, PI / 4, 0], [1, 1, 4])
  part(root, geo.vault(0.6, 2.4), mat('#c8a070', { rough: 0.8, side: 'double' }), [0, 0.5, 0], [0, PI / 2, 0], [1, 0.6, 1])
  return shadows(root, false)
}

/** Someone on the ground flying a kite (the rival kites' owners). */
function flyer(seed = Math.floor(Math.random() * 1000)) {
  const root = new Group()
  const r = rng(seed + 3)
  const skin = mat(['#c98a5a', '#d9a070', '#b87a4a'][Math.floor(r() * 3)]!, { rough: 0.6 })
  const shirt = mat(['#ffffff', '#3aa0d0', '#ff9a3a', '#ff6a90', '#3f9a3a'][Math.floor(r() * 5)]!, { rough: 0.8 })
  for (const x of [-0.09, 0.09]) part(root, geo.capsule(0.07, 0.4), mat('#2a3a5a', { rough: 0.8 }), [x, 0.3, 0])
  part(root, geo.capsule(0.19, 0.3), shirt, [0, 0.9, 0])
  part(root, geo.sphere(0.16), skin, [0, 1.38, 0])
  part(root, geo.hemi(0.17), mat('#1a1010', { rough: 0.5 }), [0, 1.4, 0.02], [-0.3, 0, 0])
  for (const x of [-0.18, 0.18]) part(root, geo.capsule(0.055, 0.32), shirt, [x, 1.2, -0.1], [-2.2, 0, 0])
  return shadows(root)
}

/* ------------------------------ People (the story) ------------------------------ */

function person(kind: 'dara' | 'tasok') {
  const root = new Group()
  const skin = mat(kind === 'dara' ? '#c98a5a' : '#b87a4a', { rough: 0.6 })
  const shirt = kind === 'dara' ? '#ff6a90' : '#f4efe4'
  part(root, geo.capsule(0.2, 0.22), mat(shirt, { rough: 0.8 }), [0, 0.32, 0], [0, 0, 0], [0.85, 1, 1.3])
  for (const z of [-1, 1]) {
    part(root, geo.capsule(0.06, 0.24), mat(shirt, { rough: 0.8 }), [0.04, 0.38, z * 0.25], [z * 0.25, 0, -0.25])
    part(root, geo.sphere(0.06), skin, [0.1, 0.22, z * 0.29])
  }
  part(root, geo.torus(0.1, 0.045), mat('#ffffff', { rough: 0.8, map: krama() }), [0, 0.6, 0], [PI / 2, 0, 0])
  const head = group(root, [0, 0.86, 0], [0, 0, 0], 1.12)
  part(head, geo.sphere(0.19), skin)
  for (const z of [-1, 1]) part(head, geo.sphere(0.045), skin, [-0.02, 0, z * 0.18], [0, 0, 0], [0.6, 1, 0.6])
  for (const z of [-0.07, 0.07]) {
    part(head, geo.sphere(0.024), mat('#2a1a10', { rough: 0.2 }), [0.17, 0.02, z])
    part(head, geo.sphere(0.008), mat('#ffffff'), [0.188, 0.03, z * 1.05])
    part(head, geo.sphere(0.03), mat('#ff8f7a', { rough: 0.7 }), [0.14, -0.06, z * 1.8], [0, 0, 0], [0.5, 0.6, 0.8])
  }
  part(head, geo.torus(0.05, 0.01, PI), mat('#8a3a2a'), [0.18, -0.07, 0], [0, PI / 2, PI])
  if (kind === 'dara') {
    part(head, geo.hemi(0.2), mat('#1a1010', { rough: 0.5 }), [-0.02, 0.02, 0], [0, 0, 0.35])
    part(head, geo.capsule(0.07, 0.26), mat('#1a1010', { rough: 0.5 }), [-0.2, -0.05, 0], [0, 0, -0.6])
    part(head, geo.sphere(0.05), mat('#ffd23f'), [-0.12, 0.15, 0.12])
  }
  else {
    // Grandpa: short white hair, round glasses.
    part(head, geo.hemi(0.198), mat('#ececec', { rough: 0.9 }), [-0.03, 0.02, 0], [0, 0, 0.5])
    for (const z of [-0.075, 0.075]) part(head, geo.torus(0.045, 0.008), mat('#3a3a3a', { metal: 0.5 }), [0.185, 0.03, z], [0, PI / 2, 0])
    part(head, geo.cyl(0.006, 0.006, 0.06, 4), mat('#3a3a3a'), [0.19, 0.03, 0], [PI / 2, 0, 0])
  }
  return shadows(root)
}

/* ------------------------------ The catalogue ------------------------------ */

const MAKERS: Record<ModelName, () => Group> = {
  kite: () => kite(), rival: () => rival(1), bird, cloud, palm, lantern, bunting: () => bunting(3, 1.4),
  coin, ring, magnet, shield, turbo,
  sugarpalm, tree, house, stupa, prang, palace, boat, flyer: () => flyer(2),
  dara: () => person('dara'),
  tasok: () => person('tasok'),
}

/** A fresh copy of a model (geometry and materials are shared). */
export function makeModel(name: ModelName): Group {
  const g = MAKERS[name]()
  g.name = name
  return g
}

export { flyer as makeFlyer, rival as makeRival }
