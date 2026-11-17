/**
 * Sound effects and music, made on the fly with the Web Audio API: no sound files to download.
 * The music is a short loop per world in a five-note (pentatonic) scale, scheduled a little ahead
 * of time so it never stutters while the game is busy.
 */
import type { GameEvent } from '#shared/game'

type Wave = OscillatorType

const WORLD_SONGS: { tempo: number, root: number, scale: number[], wave: Wave, melody: number[], bass: number[] }[] = [
  // Rice fields: open and sunny.
  { tempo: 96, root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle', melody: [0, 2, 4, -1, 3, 4, 2, -1, 1, 2, 4, 5, 4, 2, 0, -1], bass: [0, 0, 3, 3, 4, 4, 3, 3] },
  // Sugar palms: lazy afternoon.
  { tempo: 84, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sine', melody: [4, -1, 3, -1, 2, 1, -1, 0, 2, -1, 3, 4, 3, -1, 1, -1], bass: [0, 0, 2, 2, 3, 3, 1, 1] },
  // Tonle Sap: rocking on the water.
  { tempo: 100, root: 62, scale: [0, 2, 5, 7, 9], wave: 'triangle', melody: [0, 1, 2, 4, 3, 2, 1, -1, 2, 3, 4, 5, 4, 3, 2, -1], bass: [0, 0, 2, 2, 3, 3, 4, 4] },
  // Angkor: grand and old.
  { tempo: 88, root: 55, scale: [0, 2, 3, 7, 8], wave: 'triangle', melody: [0, -1, 2, 3, 4, -1, 3, 2, 1, -1, 2, 4, 5, 4, 2, -1], bass: [0, 0, 3, 3, 1, 1, 4, 4] },
  // The palace: festive.
  { tempo: 120, root: 58, scale: [0, 2, 4, 7, 9], wave: 'triangle', melody: [0, 0, 2, 3, 4, 3, 2, 0, 1, 1, 3, 4, 5, 4, 3, 1], bass: [0, 0, 0, 0, 3, 3, 4, 4] },
  // The full moon: a night festival.
  { tempo: 112, root: 62, scale: [0, 3, 5, 7, 10], wave: 'sine', melody: [0, -1, 1, 0, 3, -1, 2, 1, 0, -1, 4, 3, 2, -1, 1, -1], bass: [0, 0, 1, 1, 0, 0, 3, 2] },
]

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

export class GameAudio {
  private ac: AudioContext | null = null
  private sfx: GainNode | null = null
  private music: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private lastHit = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private step = 0
  private nextNote = 0
  private song = WORLD_SONGS[0]!
  soundOn = true
  musicOn = true

  /** Starts audio; call from a tap or click (browsers only allow sound after one). */
  unlock() {
    try {
      if (!this.ac) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ac = new Ctx()
        this.sfx = this.ac.createGain()
        this.sfx.gain.value = 0.55
        this.sfx.connect(this.ac.destination)
        this.music = this.ac.createGain()
        this.music.gain.value = 0.16
        this.music.connect(this.ac.destination)
      }
      if (this.ac.state === 'suspended') void this.ac.resume().catch(() => {})
    }
    catch {
      this.ac = null
    }
  }

  private tone(f: number, d: number, type: Wave = 'sine', v = 0.1, f2 = 0, delay = 0, out = this.sfx) {
    if (!this.ac || !out) return
    const t = this.ac.currentTime + delay
    const o = this.ac.createOscillator()
    const g = this.ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d)
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + d + 0.03)
  }

  private noise(d: number, v = 0.2, cutoff = 1500, delay = 0, out = this.sfx) {
    if (!this.ac || !out) return
    if (!this.noiseBuf) {
      this.noiseBuf = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const t = this.ac.currentTime + delay
    const s = this.ac.createBufferSource()
    const f = this.ac.createBiquadFilter()
    const g = this.ac.createGain()
    s.buffer = this.noiseBuf
    f.type = 'lowpass'
    f.frequency.value = cutoff
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    s.connect(f)
    f.connect(g)
    g.connect(out)
    s.start(t)
    s.stop(t + d + 0.03)
  }

  /** Interface sounds. */
  ui(kind: 'tap' | 'select' | 'nope' | 'star' | 'unlock' | 'page') {
    if (!this.soundOn) return
    switch (kind) {
      case 'tap':
        this.tone(620, 0.05, 'triangle', 0.05)
        break
      case 'select':
        this.tone(700, 0.06, 'triangle', 0.07, 900)
        break
      case 'nope':
        this.tone(170, 0.14, 'square', 0.05, 120)
        break
      case 'star':
        this.tone(880, 0.12, 'triangle', 0.1, 1320)
        this.tone(1320, 0.18, 'sine', 0.06, 0, 0.08)
        break
      case 'unlock':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, 0, i * 0.07))
        break
      case 'page':
        this.tone(480, 0.06, 'sine', 0.05, 640)
        break
    }
  }

  /** Sounds for what happened in the game. */
  handle(events: GameEvent[]) {
    if (!this.soundOn || !this.ac) return
    const now = this.ac.currentTime
    for (const e of events) {
      switch (e.type) {
        case 'coin':
          if (now - this.lastHit < 0.04) break
          this.lastHit = now
          this.tone(1320, 0.07, 'sine', 0.08, 1760)
          this.tone(1760, 0.09, 'sine', 0.06, 2200, 0.04)
          break
        case 'ring':
          ;[784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, 0, i * 0.06))
          this.noise(0.3, 0.06, 5000)
          break
        case 'ringMiss':
          this.tone(330, 0.15, 'sine', 0.04, 260)
          break
        case 'power':
          ;[523, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, 0, i * 0.05))
          break
        case 'powerEnd':
          this.tone(660, 0.2, 'triangle', 0.06, 330)
          break
        case 'shieldHit':
          this.tone(900, 0.3, 'sine', 0.12, 300)
          this.noise(0.2, 0.15, 3000)
          break
        case 'smash':
          this.noise(0.3, 0.25, 2500)
          this.tone(500, 0.2, 'triangle', 0.08, 200)
          break
        case 'hit':
          this.noise(0.25, 0.3, 1600)
          this.tone(420, 0.25, 'sawtooth', 0.07, 160)
          break
        case 'crash':
          // The line snaps: a twang, then the kite flutters down.
          this.tone(880, 0.35, 'sawtooth', 0.1, 110)
          this.noise(0.9, 0.25, 1200, 0.1)
          this.stopHum()
          break
        case 'goal':
          ;[659, 880].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, 0, i * 0.09))
          break
        case 'world':
          ;[523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, 0, i * 0.1))
          break
        case 'won':
          ;[523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, 0, i * 0.14))
          this.stopHum()
          break
      }
    }
  }

  private ek: { osc: OscillatorNode, over: OscillatorNode, lfo: OscillatorNode, gain: GainNode } | null = null

  /** The ek's hum: the bow's string singing in the wind, a little higher and louder as it blows harder. */
  hum(speed: number) {
    if (!this.ac || !this.sfx || !this.soundOn) return
    if (!this.ek) {
      const osc = this.ac.createOscillator()
      const over = this.ac.createOscillator()
      const lfo = this.ac.createOscillator()
      const depth = this.ac.createGain()
      const gain = this.ac.createGain()
      const filter = this.ac.createBiquadFilter()
      osc.type = 'triangle'
      over.type = 'sine'
      lfo.frequency.value = 5.5
      depth.gain.value = 4
      lfo.connect(depth)
      depth.connect(osc.frequency)
      depth.connect(over.frequency)
      filter.type = 'bandpass'
      filter.frequency.value = 500
      filter.Q.value = 0.8
      gain.gain.value = 0.0001
      osc.connect(filter)
      over.connect(filter)
      filter.connect(gain)
      gain.connect(this.sfx)
      osc.start()
      over.start()
      lfo.start()
      this.ek = { osc, over, lfo, gain }
    }
    const t = this.ac.currentTime
    this.ek.osc.frequency.setTargetAtTime(180 + speed * 7, t, 0.3)
    this.ek.over.frequency.setTargetAtTime((180 + speed * 7) * 2.01, t, 0.3)
    this.ek.gain.gain.setTargetAtTime(0.02 + speed * 0.0012, t, 0.3)
  }

  stopHum() {
    if (!this.ek || !this.ac) return
    const m = this.ek
    this.ek = null
    m.gain.gain.setTargetAtTime(0.0001, this.ac.currentTime, 0.1)
    setTimeout(() => {
      m.osc.stop()
      m.over.stop()
      m.lfo.stop()
    }, 600)
  }

  /** Starts (or switches) the world's music loop. */
  playMusic(world: number) {
    this.song = WORLD_SONGS[world % WORLD_SONGS.length]!
    if (!this.ac || !this.musicOn) return
    this.stopMusic()
    this.step = 0
    this.nextNote = this.ac.currentTime + 0.1
    this.timer = setInterval(() => this.schedule(), 50)
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  setMusic(on: boolean, world: number) {
    this.musicOn = on
    if (on) this.playMusic(world)
    else this.stopMusic()
  }

  private schedule() {
    if (!this.ac || !this.music) return
    const song = this.song
    const stepLen = 60 / song.tempo / 2
    while (this.nextNote < this.ac.currentTime + 0.25) {
      const delay = this.nextNote - this.ac.currentTime
      const m = song.melody[this.step % song.melody.length]!
      if (m >= 0) {
        const octave = Math.floor(m / song.scale.length)
        const note = song.root + 12 + song.scale[m % song.scale.length]! + octave * 12
        this.tone(midi(note), stepLen * 0.9, song.wave, 0.25, 0, delay, this.music)
      }
      if (this.step % 2 === 0) {
        const b = song.bass[(this.step / 2) % song.bass.length]!
        this.tone(midi(song.root - 12 + song.scale[b % song.scale.length]!), stepLen * 1.8, 'triangle', 0.35, 0, delay, this.music)
      }
      if (this.step % 4 === 2) this.noise(0.05, 0.12, 6000, delay, this.music)
      this.step++
      this.nextNote += stepLen
    }
  }

  /** Lowers the music while paused or on a result screen. */
  duck(on: boolean) {
    if (!this.ac || !this.music) return
    this.music.gain.setTargetAtTime(on ? 0.05 : 0.16, this.ac.currentTime, 0.2)
  }

  dispose() {
    this.stopMusic()
    this.stopHum()
    void this.ac?.close().catch(() => {})
    this.ac = null
  }
}

export function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms)
  }
  catch {
    // Not supported: no buzz.
  }
}
