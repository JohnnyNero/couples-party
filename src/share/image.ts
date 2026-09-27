import type { PlayerId } from '../engine/state'
import { SITE, type CardData } from './card'

// The share card as a picture: Story-shaped (9:16), in the app's day colours whatever
// the phone's theme, so every couple's card looks like a Coupled card. Drawn straight
// onto a canvas — no screenshots, nothing private on it.

const W = 1080
const H = 1920
const C = {
  bg: '#FFF3EC',
  ink: '#3B241E',
  soft: 'rgba(59,36,30,0.55)',
  faint: 'rgba(59,36,30,0.12)',
  card: '#FFFFFF',
  A: '#E0523F',
  Aink: '#B8402F',
  B: '#3E63C8',
  Bink: '#34519E',
  tan: '#F4ECD0',
  tanInk: '#7A6320',
  sage: '#3E7A38',
}
const DISPLAY = '"Baloo 2", Nunito, Arial, sans-serif'
const BODY = 'Nunito, Arial, sans-serif'

export async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 120px ${DISPLAY}`),
      document.fonts.load(`800 40px ${BODY}`),
    ])
  } catch { /* the fallbacks will do */ }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// Coupled's mark: two links, one in each of your colours.
function logo(g: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  g.lineWidth = 8 * scale
  g.strokeStyle = C.B
  g.beginPath(); g.ellipse(cx + 13 * scale, cy, 20 * scale, 14 * scale, 0, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = C.bg
  g.lineWidth = 13 * scale
  g.beginPath(); g.ellipse(cx - 13 * scale, cy, 20 * scale, 14 * scale, 0, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = C.A
  g.lineWidth = 8 * scale
  g.beginPath(); g.ellipse(cx - 13 * scale, cy, 20 * scale, 14 * scale, 0, 0, Math.PI * 2); g.stroke()
  // The blue link back over the coral one at the bottom crossing.
  g.save()
  g.beginPath(); g.rect(cx - 60 * scale, cy, 120 * scale, 40 * scale); g.clip()
  g.strokeStyle = C.bg
  g.lineWidth = 13 * scale
  g.beginPath(); g.ellipse(cx + 13 * scale, cy, 20 * scale, 14 * scale, 0, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = C.B
  g.lineWidth = 8 * scale
  g.beginPath(); g.ellipse(cx + 13 * scale, cy, 20 * scale, 14 * scale, 0, 0, Math.PI * 2); g.stroke()
  g.restore()
}

function avatar(g: CanvasRenderingContext2D, p: PlayerId, name: string, cx: number, cy: number, r: number) {
  g.fillStyle = p === 'A' ? C.A : C.B
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#FFFFFF'
  g.font = `800 ${r}px ${DISPLAY}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText((name.trim()[0] ?? p).toUpperCase(), cx, cy + r * 0.08)
}

function crown(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.fillStyle = '#F2B544'
  g.strokeStyle = C.ink
  g.lineWidth = 4
  g.beginPath()
  const pts: [number, number][] = [[3, 16], [2, 5], [7, 9], [12, 2], [17, 9], [22, 5], [21, 16]]
  pts.forEach(([x, y], i) => {
    const px = cx + (x - 12) * s
    const py = cy + (y - 9) * s
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  })
  g.closePath(); g.fill(); g.stroke()
}

// Shrinks a line until it fits.
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, max: number): number {
  let s = size
  g.font = `${weight} ${s}px ${family}`
  while (g.measureText(text).width > max && s > 20) {
    s -= 4
    g.font = `${weight} ${s}px ${family}`
  }
  return s
}

export async function drawCard(d: CardData): Promise<Blob> {
  await fontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  g.fillStyle = C.bg
  g.fillRect(0, 0, W, H)

  // Top: the mark, the name, what this was.
  // The mark and the name, centred together.
  g.textBaseline = 'middle'
  g.font = `800 96px ${DISPLAY}`
  const wordW = g.measureText('Coupled').width
  const markW = 66 * 2.2
  const left = (W - (markW + 28 + wordW)) / 2
  logo(g, left + markW / 2, 196, 2.2)
  g.fillStyle = C.ink
  g.textAlign = 'left'
  g.fillText('Coupled', left + markW + 28, 204)
  // What this was — the daily reads "The daily · #12" here, the wordmark being right above.
  const label = d.label.replace(/^Coupled #/, 'The daily · #').toUpperCase()
  g.textAlign = 'center'
  g.fillStyle = C.soft
  fit(g, label, 800, 40, BODY, W - 160)
  g.fillText(label, W / 2, 320)

  // The two of you, head to head.
  roundRect(g, 80, 400, W - 160, 560, 64)
  g.fillStyle = C.card
  g.fill()
  g.lineWidth = 6
  g.strokeStyle = C.ink
  g.stroke()
  const lead: PlayerId | null = d.scores.A === d.scores.B ? null : d.scores.A > d.scores.B ? 'A' : 'B'
  ;(['A', 'B'] as PlayerId[]).forEach((p, i) => {
    const cx = i === 0 ? 300 : W - 300
    if (lead === p) crown(g, cx, 470, 5)
    avatar(g, p, d.names[p], cx, 600, 90)
    g.fillStyle = p === 'A' ? C.Aink : C.Bink
    g.font = `800 170px ${DISPLAY}`
    g.textAlign = 'center'
    g.fillText(String(d.scores[p]), cx, 810)
    g.fillStyle = C.ink
    fit(g, d.names[p], 800, 48, BODY, 360)
    g.fillText(d.names[p], cx, 910)
  })
  g.fillStyle = C.faint
  g.font = `800 56px ${DISPLAY}`
  g.fillText('vs', W / 2, 760)

  // Together: the number, and its name.
  roundRect(g, 80, 1010, W - 160, 250, 56)
  g.fillStyle = C.tan
  g.fill()
  g.fillStyle = C.tanInk
  g.textAlign = 'left'
  g.font = `800 52px ${DISPLAY}`
  g.fillText('Together', 140, 1090)
  g.font = `800 60px ${DISPLAY}`
  if (d.tier) g.fillText(d.tier, 140, 1180)
  g.textAlign = 'right'
  g.font = `800 170px ${DISPLAY}`
  g.fillText(String(d.together), W - 140, 1150)

  // Each game: who took it (coral or blue), and how you did together underneath.
  const rows = d.rows.slice(0, 13)
  const cols = Math.min(rows.length, 7)
  const tile = 104
  const gap = 22
  const lines = Math.ceil(rows.length / cols)
  rows.forEach((r, i) => {
    const line = Math.floor(i / cols)
    const inLine = line === lines - 1 ? rows.length - line * cols : cols
    const x0 = (W - (inLine * tile + (inLine - 1) * gap)) / 2
    const x = x0 + (i % cols) * (tile + gap)
    const y = 1330 + line * (tile + 70)
    roundRect(g, x, y, tile, tile, 26)
    g.fillStyle = r.winner === 'A' ? C.A : r.winner === 'B' ? C.B : C.faint
    g.fill()
    if (r.together !== null) {
      const strength = Math.max(0.12, Math.min(1, r.together / 30))
      roundRect(g, x + 14, y + tile + 14, (tile - 28) * strength, 14, 7)
      g.fillStyle = C.tanInk
      g.fill()
    }
  })

  g.textAlign = 'center'
  g.fillStyle = C.soft
  g.font = `700 34px ${BODY}`
  g.fillText('Who took each game · and how you did together', W / 2, 1330 + lines * (tile + 70) + 20)
  g.fillStyle = C.ink
  g.font = `800 38px ${BODY}`
  g.fillText(SITE, W / 2, H - 110)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
}
