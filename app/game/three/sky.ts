/**
 * The sky in 3D, in plain three.js: the camera follows the kite from behind as it flies over the
 * Cambodian countryside (rice fields, sugar palms, stilt houses, the Tonle Sap, Angkor, the palace,
 * a full-moon festival), through the birds, rival kites, bunting, clouds, coins and rings the engine
 * places. The ground is made in 40 m pieces reused as you fly (each merged into a few meshes); the
 * flying lane in the middle is kept clear of scenery so only hazards are ever in the way. The view
 * never changes the game: it reads the engine's state each frame and reacts to its events.
 *
 * World axes: x across the field, y up, and the kite flies along -z (world z = -distance).
 * Quality 'high': shadows, antialiasing, up to 2x pixel ratio. 'low': no shadows, 1x pixels.
 */
import {
  ACESFilmicToneMapping, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight,
  IcosahedronGeometry, InstancedMesh, Line, LineBasicMaterial, Matrix4, Mesh, MeshBasicMaterial, PCFSoftShadowMap,
  PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
  type Object3D,
} from 'three'
import { FIELD, RING_BONUS, WORLDS, type Engine, type GameEvent, type Hazard } from '#shared/game'
import { bake, geo, mat, paint, part, rng } from './kit'
import { bunting, kite, makeFlyer, makeModel, makeRival, type ModelName } from './models'

export type Quality = 'high' | 'low'

const CHUNK = 40
const AHEAD = 6
/** Scenery stays this far out from the middle, clear of the flying lane. */
const CLEAR = FIELD.xHalf + 3
const KITE_SCALE = 0.62
const RIVAL_SCALE = 0.85

interface Particle { on: boolean, p: Vector3, v: Vector3, life: number, max: number, size: number, g: number }
interface Popup { el: HTMLElement, p: Vector3, t: number }

export class SkyView {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(58, 1, 0.3, 320)
  private root = new Group()
  private sun: DirectionalLight
  private hemi: HemisphereLight
  private ground: Group
  private player: Group
  private pose: Object3D
  private tails: Object3D[] = []
  private bubble: Mesh
  private line: Line
  private linePos: Float32Array
  private chunks: { slot: number, obj: Group | null }[] = []
  private variants: Group[][] = []
  private builtWorld = -1
  private hazards = new Map<number, Group>()
  private pickups = new Map<number, Group>()
  private flying: { obj: Group, t: number, from: Vector3 }[] = []
  private parts: Particle[] = []
  private partMesh: InstancedMesh
  private streaks: InstancedMesh
  private streakPos: Vector3[] = []
  private moon: Mesh
  private stars: Points
  private puffs = new Group()
  private popups: Popup[] = []
  private time = 0
  private lastStats = -1
  private shake = 0
  private crashT = 0
  private camX = 0
  private camY = 5
  private width = 1
  private height = 1
  private v = new Vector3()
  private m4 = new Matrix4()
  private q = new Quaternion()
  reducedMotion = false

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement, readonly quality: Quality, design: { body: string, canopy: string, tail: string }, private scenic = false) {
    this.renderer = new WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.shadowMap.enabled = quality === 'high'
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.scene.fog = new Fog('#dff3ff', 90, 230)
    this.hemi = new HemisphereLight('#e8f4ff', '#6a7a4a', 1.25)
    this.scene.add(this.hemi)
    this.sun = new DirectionalLight('#fff1d6', 2.2)
    this.sun.castShadow = quality === 'high'
    this.sun.shadow.mapSize.set(1024, 1024)
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 26, bottom: -26, near: 1, far: 80 })
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target)
    this.scene.add(this.root)

    this.ground = this.buildGround()
    this.root.add(this.ground)
    for (let i = 0; i < AHEAD + 2; i++) this.chunks.push({ slot: -999, obj: null })

    // The kite, its bubble when shielded, and its line down to Dara behind.
    this.player = kite(design.body, design.canopy, design.tail)
    this.player.scale.setScalar(KITE_SCALE)
    this.player.traverse(o => o.name === 'tails' && this.tails.push(o))
    this.player.traverse(o => o.castShadow = quality === 'high')
    this.pose = this.player.getObjectByName('pose')!
    this.bubble = new Mesh(geo.sphere(2.1, 24, 16), new MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.2, depthWrite: false }))
    this.bubble.position.set(0, -0.2, 0)
    this.bubble.visible = false
    this.player.add(this.bubble)
    this.root.add(this.player)
    this.linePos = new Float32Array(17 * 3)
    const lg = new BufferGeometry()
    lg.setAttribute('position', new BufferAttribute(this.linePos, 3))
    this.line = new Line(lg, new LineBasicMaterial({ color: '#f4efe4', transparent: true, opacity: 0.85 }))
    this.line.frustumCulled = false
    this.root.add(this.line)

    const n = quality === 'high' ? 400 : 200
    this.partMesh = new InstancedMesh(new IcosahedronGeometry(1, 0), mat('#ffffff', { rough: 0.5 }), n)
    this.partMesh.frustumCulled = false
    for (let i = 0; i < n; i++) {
      this.parts.push({ on: false, p: new Vector3(), v: new Vector3(), life: 0, max: 1, size: 0, g: 0 })
      this.partMesh.setMatrixAt(i, this.m4.makeScale(0, 0, 0))
      this.partMesh.setColorAt(i, new Color('#ffffff'))
    }
    this.root.add(this.partMesh)
    // Wind streaks: always a few, many in a gust.
    this.streaks = new InstancedMesh(new BoxGeometry(0.025, 0.025, 3), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 }), 50)
    this.streaks.frustumCulled = false
    const R = rng(5)
    for (let i = 0; i < 50; i++) this.streakPos.push(new Vector3((R() - 0.5) * 18, 0.5 + R() * 13, -R() * 50))
    this.root.add(this.streaks)

    // The moon and stars, for the night.
    this.moon = new Mesh(geo.sphere(9, 32, 20), new MeshBasicMaterial({ color: '#fff6d8', fog: false }))
    this.moon.visible = false
    this.root.add(this.moon)
    const starPos = new Float32Array(600 * 3)
    const S = rng(21)
    for (let i = 0; i < 600; i++) {
      const a = S() * Math.PI - Math.PI / 2
      const e = 0.08 + S() * 1.2
      starPos.set([Math.sin(a) * Math.cos(e) * 200, Math.sin(e) * 200, -Math.cos(a) * Math.cos(e) * 200], i * 3)
    }
    const sg = new BufferGeometry()
    sg.setAttribute('position', new BufferAttribute(starPos, 3))
    this.stars = new Points(sg, new PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false }))
    this.stars.visible = false
    this.root.add(this.stars)

    // Fair-weather clouds far off, for depth (they keep their distance as you fly).
    const C = rng(31)
    const white = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, fog: false })
    for (let i = 0; i < 9; i++) {
      const puff = new Group()
      for (let j = 0; j < 5; j++) {
        const m = new Mesh(geo.sphere(1, 14, 10), white)
        m.position.set((j - 2) * 4 + C() * 2, C() * 2.5, C() * 3)
        m.scale.set(5 + C() * 3, 3 + C() * 2, 4)
        puff.add(m)
      }
      puff.position.set((C() - 0.5) * 300, 40 + C() * 40, -150 - C() * 120)
      this.puffs.add(puff)
    }
    this.root.add(this.puffs)
  }

  /** The sky: a soft gradient from the world's sky colour down to its hazy horizon. */
  private skyTexture(w: number) {
    const p = WORLDS[w]!.palette
    const tex = paint(`sky${w}`, 256, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s)
      g.addColorStop(0, p.sky)
      g.addColorStop(0.62, p.sky)
      g.addColorStop(1, p.horizon)
      c.fillStyle = g
      c.fillRect(0, 0, s, s)
    })
    return tex
  }

  /* ------------------------------ The ground ------------------------------ */

  private fieldTexture(w: number) {
    const world = WORLDS[w]!
    return paint(`field${w}`, 256, (c, s) => {
      c.fillStyle = world.palette.ground
      c.fillRect(0, 0, s, s)
      const R = rng(w + 40)
      // Rice paddies: squares of green (or gold, or water), with earth dikes between.
      const cell = s / 4
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const tone = R()
          c.fillStyle = world.scenery === 'water' && R() < 0.4 ? '#5aa8d0' : tone < 0.5 ? world.palette.field : tone < 0.8 ? world.palette.ground : (world.night ? '#4a5a3a' : '#c8c060')
          c.fillRect(i * cell + 4, j * cell + 4, cell - 8, cell - 8)
          c.fillStyle = 'rgba(0,0,0,.06)'
          for (let k = 0; k < 60; k++) c.fillRect(i * cell + 4 + R() * (cell - 10), j * cell + 4 + R() * (cell - 10), 2, 4)
        }
      }
      c.strokeStyle = world.night ? '#3a3a2a' : '#a8885a'
      c.lineWidth = 6
      for (let i = 0; i <= 4; i++) {
        c.beginPath()
        c.moveTo(i * cell, 0)
        c.lineTo(i * cell, s)
        c.moveTo(0, i * cell)
        c.lineTo(s, i * cell)
        c.stroke()
      }
    }, 14, 20)
  }

  private buildGround() {
    const g = new Group()
    const field = part(g, new PlaneGeometry(260, 400), mat('#ffffff', { rough: 1 }), [0, 0, -150], [-Math.PI / 2, 0, 0])
    field.receiveShadow = true
    field.name = 'field'
    const water = part(g, new PlaneGeometry(260, 400), mat('#4a9ac8', { rough: 0.1, metal: 0.3 }), [0, 0.02, -150], [-Math.PI / 2, 0, 0])
    water.receiveShadow = true
    water.name = 'water'
    return g
  }

  /** Builds the pieces of countryside for a world (six variations, merged for speed). */
  private buildWorld(w: number) {
    if (this.variants[w]) return
    const world = WORLDS[w]!
    const list: Group[] = []
    for (let v = 0; v < 6; v++) {
      const R = rng(w * 100 + v * 7 + 1)
      const piece = new Group()
      for (const side of [-1, 1] as const) {
        // Sugar palms and trees in rows along the dikes, and houses beyond.
        for (let z = 2; z < CHUNK; z += 8 + R() * 6) {
          this.place(piece, R() < 0.65 ? 'sugarpalm' : 'tree', side * (CLEAR + R() * 4), -z, R() * 6, 0.85 + R() * 0.35)
        }
        if (world.scenery !== 'moon' || R() < 0.5) {
          for (let z = 6; z < CHUNK; z += 16 + R() * 10) this.place(piece, 'house', side * (CLEAR + 9 + R() * 8), -z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0.9)
        }
        for (let z = 4; z < CHUNK; z += 14 + R() * 10) this.place(piece, R() < 0.3 ? 'sugarpalm' : 'tree', side * (CLEAR + 20 + R() * 25), -z, R() * 6, 1 + R() * 0.4)
      }
      // People flying kites in the fields, well to the side.
      for (let i = 0; i < 2; i++) {
        const side = R() < 0.5 ? -1 : 1
        const f = makeFlyer(Math.floor(R() * 99))
        f.position.set(side * (CLEAR - 1 + R() * 2), 0, -R() * CHUNK)
        f.rotation.y = Math.PI
        piece.add(f)
      }
      // Landmarks now and then, far out.
      if (v % 3 === 0) {
        const side = v % 2 ? -1 : 1
        if (world.scenery === 'paddies' || world.scenery === 'palms') this.place(piece, 'stupa', side * 34, -20, 0, 2.6)
        if (world.scenery === 'temple') this.place(piece, 'prang', side * 42, -20, 0, 2.4)
        if (world.scenery === 'palace') this.place(piece, 'palace', side * 40, -20, side > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2)
        if (world.scenery === 'moon') this.place(piece, 'stupa', side * 34, -20, 0, 2.6)
      }
      if (world.scenery === 'water') {
        for (let i = 0; i < 2; i++) this.place(piece, 'boat', (R() < 0.5 ? -1 : 1) * (4 + R() * 30), -R() * CHUNK, R() * 6, 1.2)
      }
      list.push(bake(piece, this.quality === 'high'))
    }
    this.variants[w] = list
  }

  private place(parent: Group, name: ModelName, x: number, z: number, yaw = 0, scale = 1) {
    const m = makeModel(name)
    m.position.set(x, 0, z)
    m.rotation.y = yaw
    m.scale.setScalar(scale)
    parent.add(m)
    return m
  }

  private syncChunks(dist: number, world: number) {
    this.buildWorld(world)
    const first = Math.floor(dist / CHUNK) - 1
    for (let i = 0; i < this.chunks.length; i++) {
      const slot = first + i
      if (this.chunks.find(ch => ch.slot === slot)) continue
      const free = this.chunks.find(ch => ch.slot < first || ch.slot >= first + this.chunks.length)!
      if (free.obj) this.root.remove(free.obj)
      const list = this.variants[world]!
      free.obj = list[((slot * 7919) >>> 0) % list.length]!.clone()
      free.obj.position.z = -slot * CHUNK
      free.slot = slot
      this.root.add(free.obj)
    }
  }

  /** Changes the world: lighting, ground, sky; clears the pieces so they're rebuilt for it. */
  private applyWorld(w: number) {
    if (this.builtWorld === w) return
    this.builtWorld = w
    const world = WORLDS[w]!
    const p = world.palette
    this.scene.background = this.skyTexture(w)
    this.puffs.visible = !world.night
    ;(this.scene.fog as Fog).color.set(p.horizon)
    this.hemi.color.set(world.night ? '#6a78c8' : '#e8f4ff')
    this.hemi.intensity = world.night ? 1.15 : 1.25
    this.sun.color.set(world.night ? '#b8c4ff' : world.id === 'angkor' ? '#ffd8a8' : '#fff1d6')
    this.sun.intensity = world.night ? 0.9 : 2.2
    ;(this.ground.getObjectByName('field') as Mesh).material = mat('#ffffff', { rough: 1, map: this.fieldTexture(w) })
    // The Tonle Sap: a wide lake in the middle, fields beyond.
    const water = this.ground.getObjectByName('water') as Mesh
    water.visible = world.scenery === 'water'
    water.scale.x = 0.12
    this.moon.visible = world.night
    this.stars.visible = world.night
    for (const c of this.chunks) {
      if (c.obj) this.root.remove(c.obj)
      c.obj = null
      c.slot = -999
    }
  }

  /* ------------------------------ Camera ------------------------------ */

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.width = cssWidth
    this.height = cssHeight
    this.renderer.setPixelRatio(this.quality === 'high' ? Math.min(dpr, 2) : 1)
    this.renderer.setSize(cssWidth, cssHeight, false)
    this.camera.aspect = cssWidth / cssHeight
    this.camera.fov = this.baseFov()
    this.camera.updateProjectionMatrix()
  }

  /** Narrow screens need a wider view to keep the whole sky in sight. */
  private baseFov() {
    return this.camera.aspect < 0.8 ? 76 : this.camera.aspect < 1.2 ? 66 : 58
  }

  /* ------------------------------ Effects ------------------------------ */

  private emit(at: Vector3, n: number, colors: string[], o: { speed?: [number, number], up?: number, life?: [number, number], size?: [number, number], g?: number, vz?: number } = {}) {
    if (this.reducedMotion) n = Math.ceil(n / 3)
    const [s0, s1] = o.speed ?? [1, 3]
    const [l0, l1] = o.life ?? [0.4, 0.8]
    const [z0, z1] = o.size ?? [0.04, 0.08]
    const color = new Color()
    let i = 0
    for (let k = 0; k < n; k++) {
      while (i < this.parts.length && this.parts[i]!.on) i++
      if (i >= this.parts.length) break
      const p = this.parts[i]!
      const a = Math.random() * Math.PI * 2
      const s = s0 + Math.random() * (s1 - s0)
      p.on = true
      p.p.copy(at)
      p.v.set(Math.cos(a) * s * 0.7, (o.up ?? 1) * (Math.random() - 0.3) * s, Math.sin(a) * s * 0.7 + (o.vz ?? 0))
      p.max = p.life = l0 + Math.random() * (l1 - l0)
      p.size = z0 + Math.random() * (z1 - z0)
      p.g = o.g ?? 4
      this.partMesh.setColorAt(i, color.set(colors[Math.floor(Math.random() * colors.length)]!))
    }
    if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true
  }

  private popup(at: Vector3, html: string) {
    const el = document.createElement('div')
    el.className = 'sv-popup'
    el.innerHTML = html
    this.overlay.appendChild(el)
    this.popups.push({ el, p: at.clone(), t: 0 })
  }

  private hazardAt(engine: Engine, id: number): Hazard | undefined {
    return engine.course.hazards.find(h => h.id === id)
  }

  /** Effects for what just happened in the game. */
  handle(events: GameEvent[], engine: Engine) {
    const here = new Vector3(engine.x, engine.y, -engine.dist)
    const drift = -engine.speed * 0.5
    for (const e of events) {
      switch (e.type) {
        case 'coin': {
          const obj = this.pickups.get(e.id)
          if (obj) {
            this.pickups.delete(e.id)
            this.flying.push({ obj, t: 0, from: obj.position.clone() })
          }
          break
        }
        case 'ring': {
          const obj = this.pickups.get(e.id)
          const at = obj ? obj.position.clone() : here.clone()
          this.emit(at, 36, ['#ffd23f', '#ff8a1a', '#ffffff'], { speed: [2, 6], g: 1, vz: drift, size: [0.06, 0.12], life: [0.6, 1.1] })
          this.popup(at.clone().setY(at.y + 1.6), `+${RING_BONUS}`)
          if (obj) obj.visible = false
          break
        }
        case 'ringMiss': {
          const obj = this.pickups.get(e.id)
          if (obj) obj.scale.setScalar(0.85)
          break
        }
        case 'power':
          this.emit(here, 26, e.kind === 'magnet' ? ['#ff6a6a', '#ffffff'] : e.kind === 'shield' ? ['#8fd8ff', '#ffffff'] : ['#bfe6ff', '#ffffff'], { speed: [2, 5], g: 0.5, vz: drift })
          break
        case 'shieldHit':
          this.emit(here, 30, ['#8fd8ff', '#ffffff'], { speed: [3, 7], g: 1, vz: drift })
          this.shake = Math.max(this.shake, 0.25)
          break
        case 'smash': {
          const h = this.hazardAt(engine, e.id)
          this.emit(h ? new Vector3(h.x, h.kind === 'bunting' ? engine.y : h.y, -h.z) : here, 30, ['#ffffff', '#ffd23f', '#e8402f', '#8a90a0'], { speed: [3, 8], g: 3, vz: drift, size: [0.06, 0.14] })
          this.shake = Math.max(this.shake, 0.2)
          this.hide(e.id)
          break
        }
        case 'hit':
          this.emit(here, 34, ['#ffffff', '#f4efe4', '#e8402f', '#ffd23f'], { speed: [2, 6], g: 2, vz: drift, size: [0.05, 0.12] })
          this.shake = Math.max(this.shake, 0.4)
          break
        case 'crash':
          this.crashT = 0.001
          this.shake = 0.6
          this.emit(here, 50, ['#ffffff', '#f4efe4', '#e8402f', '#ffd23f', '#c8a060'], { speed: [3, 9], g: 3, size: [0.06, 0.16], life: [0.6, 1.4] })
          break
        case 'world':
          this.applyWorld(e.world)
          break
        case 'won':
          for (let i = 0; i < 6; i++) this.emit(here.clone().add(new Vector3((Math.random() - 0.5) * 6, 2, -8)), 22, ['#ffe14d', '#8fd36a', '#ff9cc9', '#4fc3f7', '#ffffff'], { speed: [2, 5], g: 2, life: [1, 2] })
          break
        default:
          break
      }
    }
  }

  /** A hazard that was smashed through: hide it. */
  private hide(id: number) {
    const obj = this.hazards.get(id)
    if (obj) obj.visible = false
  }

  /** Moves effects on (only while the game runs). */
  update(dt: number) {
    this.time += dt
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.8)
    if (this.crashT > 0) this.crashT += dt
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]!
      if (!p.on) continue
      p.life -= dt
      if (p.life <= 0) {
        p.on = false
        this.partMesh.setMatrixAt(i, this.m4.makeScale(0, 0, 0))
        continue
      }
      p.v.y -= p.g * dt
      p.p.addScaledVector(p.v, dt)
      const s = p.size * Math.min(1, (p.life / p.max) * 2)
      this.m4.compose(p.p, this.q, this.v.set(s, s, s))
      this.partMesh.setMatrixAt(i, this.m4)
    }
    this.partMesh.instanceMatrix.needsUpdate = true
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!
      p.t += dt
      if (p.t > 1) {
        p.el.remove()
        this.popups.splice(i, 1)
      }
    }
  }

  /* ------------------------------ Every frame ------------------------------ */

  render(engine: Engine) {
    this.applyWorld(engine.worldIndex)
    const z = -engine.dist
    this.syncChunks(engine.dist, engine.worldIndex)
    // The ground follows in 20 m steps, so the paddies stay put.
    this.ground.position.z = -Math.floor(engine.dist / 20) * 20
    const still = this.reducedMotion

    // The kite: leaning into its turns, bobbing, tails waving; tumbling if the line snaps.
    let ky = engine.y
    this.player.position.set(engine.x, ky, z)
    if (this.crashT > 0) {
      const t = this.crashT
      ky = Math.max(0.3, engine.y - t * t * 4)
      this.player.position.y = ky
      this.pose.rotation.set(t * 2, 0, t * 5)
    }
    else {
      const bob = still ? 0 : Math.sin(this.time * 2.3) * 0.05
      this.pose.position.y = bob
      this.pose.rotation.set(-0.25 - engine.vy * 0.02, 0, still ? 0 : -engine.vx * 0.05 + Math.sin(this.time * 1.7) * 0.04)
    }
    for (const t of this.tails) {
      let i = 0
      for (const c of t.children) {
        c.rotation.z = still ? 0 : Math.sin(this.time * 6 - i * 0.7) * 0.12 * (i + 1) * 0.3 + engine.vx * 0.01 * i
        c.rotation.x = 0.2 * i * 0.15
        i++
      }
    }
    // Flicker while it can't be hit again.
    this.player.visible = this.crashT > 0 || engine.safeT <= 0 || Math.floor(this.time * 12) % 2 === 0
    this.bubble.visible = engine.shield
    if (engine.shield) this.bubble.rotation.y = this.time

    // The line, sagging down to Dara far behind.
    const ax = engine.x * 0.2
    const az = z + 34
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const sag = Math.sin(t * Math.PI) * 1.2
      this.linePos.set([engine.x + (ax - engine.x) * t, ky - 0.6 * KITE_SCALE + (0 - ky) * t * t - sag * (1 - t) * 0.5, z + (az - z) * t], i * 3)
    }
    this.line.geometry.attributes.position!.needsUpdate = true

    this.syncHazards(engine)
    this.syncPickups(engine)

    // Coins flying into the kite.
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!
      f.t += 0.07
      const to = new Vector3(engine.x, engine.y, z)
      f.obj.position.lerpVectors(f.from, to, Math.min(1, f.t))
      f.obj.scale.setScalar(Math.max(0.1, 1 - f.t * 0.6))
      if (f.t >= 1) {
        this.root.remove(f.obj)
        this.flying.splice(i, 1)
      }
    }

    // Wind streaks: a few always, more and faster in a gust.
    const gust = engine.turboT > 0
    this.streaks.visible = !still
    if (this.streaks.visible) {
      const count = gust ? 50 : 14
      for (let i = 0; i < this.streakPos.length; i++) {
        const p = this.streakPos[i]!
        p.z += engine.speed * (gust ? 0.06 : 0.03)
        if (p.z > 6) p.z -= 56
        this.m4.makeTranslation(p.x + this.camX, p.y, z + p.z - 24)
        if (i >= count) this.m4.makeScale(0, 0, 0)
        this.streaks.setMatrixAt(i, this.m4)
      }
      this.streaks.instanceMatrix.needsUpdate = true
    }

    // Camera: behind the kite and a little below it, easing after it; wider in a gust.
    const k = this.scenic ? 0.03 : 0.1
    this.camX += (engine.x * 0.55 - this.camX) * k
    this.camY += (engine.y * 0.7 + 3.1 - this.camY) * k
    const fov = this.baseFov() + (gust ? 8 : 0)
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov += (fov - this.camera.fov) * 0.1
      this.camera.updateProjectionMatrix()
    }
    const sh = still ? 0 : this.shake
    const back = this.camera.aspect < 0.8 ? 9 : this.scenic ? 11 : 7.8
    this.camera.position.set(this.camX + (Math.random() - 0.5) * sh, this.camY + (Math.random() - 0.5) * sh, z + back)
    this.camera.lookAt(this.camX * 1.15, this.camY * 0.8 + 1.5, z - 24)
    this.sun.position.set(engine.x - 10, 30, z + 6)
    this.sun.target.position.set(engine.x, 0, z - 14)
    this.moon.position.set(30, 70, z - 220)
    this.puffs.position.set(this.camX * 0.6, 0, z)
    this.stars.position.set(0, 0, z)

    this.renderer.render(this.scene, this.camera)
    if (this.time - this.lastStats > 1) {
      this.lastStats = this.time
      this.canvas.dataset.drawCalls = String(this.renderer.info.render.calls)
    }
    for (const p of this.popups) {
      const s = this.v.copy(p.p).project(this.camera)
      p.el.style.transform = `translate(${((s.x + 1) / 2 * this.width).toFixed(1)}px, ${((1 - s.y) / 2 * this.height - p.t * 50).toFixed(1)}px) translate(-50%, -50%)`
      p.el.style.opacity = String(Math.max(0, 1 - Math.max(0, p.t - 0.6) / 0.4))
    }
  }

  private makeHazard(h: Hazard): Group {
    switch (h.kind) {
      case 'rival': {
        const g = new Group()
        const k = makeRival(h.id)
        k.scale.setScalar(RIVAL_SCALE)
        k.name = 'kite'
        g.add(k)
        // Its line straight down to the one flying it.
        const line = part(g, geo.cyl(0.03, 0.03, 1, 4), mat('#f4efe4', { rough: 0.4 }), [0, -h.y / 2, 0], [0, 0, 0], [1, h.y, 1])
        line.name = 'line'
        const f = makeFlyer(h.id)
        f.position.set(0, -h.y, 0.4)
        f.rotation.y = Math.PI
        g.add(f)
        return g
      }
      case 'bunting':
        return bunting(FIELD.xHalf * 2 + 3, h.y)
      case 'palm': {
        const g = makeModel('palm')
        g.scale.set(1, h.y / 5.4, 1)
        return g
      }
      default:
        return makeModel(h.kind)
    }
  }

  private syncHazards(engine: Engine) {
    const seen = new Set<number>()
    const still = this.reducedMotion
    for (const h of engine.course.hazards) {
      seen.add(h.id)
      let obj = this.hazards.get(h.id)
      if (!obj) {
        obj = this.makeHazard(h)
        this.root.add(obj)
        this.hazards.set(h.id, obj)
      }
      if (h.kind === 'palm') obj.position.set(h.x, 0, -h.z)
      else if (h.kind === 'bunting') obj.position.set(0, h.y, -h.z)
      else obj.position.set(h.x, h.y, -h.z)
      if (h.kind === 'bird') {
        obj.rotation.y = h.vx > 0 ? Math.PI : 0
        const flap = still ? 0 : Math.sin(this.time * 12 + h.id) * 0.6
        obj.getObjectByName('wingL')!.rotation.z = flap
        obj.getObjectByName('wingR')!.rotation.z = -flap
      }
      else if (h.kind === 'rival') {
        const k = obj.getObjectByName('kite')!
        k.rotation.z = still ? 0 : Math.sin(this.time * 1.3 + h.id) * 0.12
      }
      else if (h.kind === 'cloud') {
        obj.getObjectByName('bolt')!.visible = !still && Math.sin(this.time * 7 + h.id * 3) > 0.85
      }
      else if (h.kind === 'lantern' && !still) obj.rotation.y = this.time + h.id
      // Hit things fade a little, so you can see what got you.
      if (h.hit && h.kind !== 'bunting') obj.scale.multiplyScalar(0.995)
    }
    for (const [id, obj] of this.hazards) {
      if (!seen.has(id)) {
        this.root.remove(obj)
        this.hazards.delete(id)
      }
    }
  }

  private syncPickups(engine: Engine) {
    const seen = new Set<number>()
    for (const p of engine.course.pickups) {
      if (p.taken && p.kind !== 'ring') continue
      seen.add(p.id)
      let obj = this.pickups.get(p.id)
      if (!obj) {
        obj = makeModel(p.kind)
        this.root.add(obj)
        this.pickups.set(p.id, obj)
      }
      obj.position.set(p.x, p.y + (this.reducedMotion || p.kind === 'ring' ? 0 : Math.sin(this.time * 4 + p.id) * 0.08), -p.z)
      const spin = obj.getObjectByName('spin')
      if (spin) spin.rotation[p.kind === 'ring' ? 'z' : 'y'] = this.time * (p.kind === 'ring' ? 0.8 : 3) + p.id
    }
    for (const [id, obj] of this.pickups) {
      if (!seen.has(id)) {
        this.root.remove(obj)
        this.pickups.delete(id)
      }
    }
  }

  dispose() {
    for (const p of this.popups) p.el.remove()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}

/** Every model the interface shows as a picture. */
export const ICON_MODELS: ModelName[] = ['kite', 'rival', 'bird', 'cloud', 'palm', 'lantern', 'bunting', 'coin', 'ring', 'magnet', 'shield', 'turbo', 'dara', 'tasok', 'stupa', 'prang', 'palace', 'house']
