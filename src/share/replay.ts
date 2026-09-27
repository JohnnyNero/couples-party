import type { DrawStroke, PlayerId } from '../engine/state'
import { encodeGif, toIndices, type Rgb } from './gif'
import { fontsReady } from './image'

// Moment replays: a drawing redrawn stroke by stroke, as a looping GIF — the thing you
// actually want to send from a drawing game (the score is beside the point). Day colours,
// whatever the phone's theme, like the share card.

const CREAM: Rgb = [255, 243, 236]
const WHITE: Rgb = [255, 255, 255]
const INK: Rgb = [59, 36, 30]
const SEAT: Record<PlayerId, Rgb> = { A: [224, 82, 63], B: [62, 99, 200] }
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb
const css = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`

// Everything a replay can contain, with in-betweens so edges stay smooth.
function palette(): Rgb[] {
  return [
    CREAM, WHITE, INK, SEAT.A, SEAT.B,
    mix(WHITE, SEAT.A, 0.35), mix(WHITE, SEAT.A, 0.7), mix(WHITE, SEAT.B, 0.35), mix(WHITE, SEAT.B, 0.7),
    mix(CREAM, INK, 0.3), mix(CREAM, INK, 0.6), mix(WHITE, INK, 0.3), mix(WHITE, INK, 0.6),
    mix(CREAM, SEAT.A, 0.5), mix(CREAM, SEAT.B, 0.5), [242, 181, 68],
  ]
}

const DISPLAY = '"Baloo 2", Nunito, Arial, sans-serif'
const BODY = 'Nunito, Arial, sans-serif'

// Draws the first `upTo` points of the strokes into a box.
function inkStrokes(g: CanvasRenderingContext2D, strokes: DrawStroke[], upTo: number, x: number, y: number, w: number, h: number, colour: Rgb, width: number) {
  g.strokeStyle = css(colour)
  g.lineWidth = width
  g.lineCap = 'round'
  g.lineJoin = 'round'
  let left = upTo
  for (const stroke of strokes) {
    if (left <= 0) break
    const pts = stroke.slice(0, Math.max(1, Math.min(stroke.length, left)))
    left -= stroke.length
    g.beginPath()
    pts.forEach(([px, py], i) => {
      const cx = x + px * w
      const cy = y + py * h
      if (i === 0) g.moveTo(cx, cy)
      else g.lineTo(cx, cy)
    })
    if (pts.length === 1) g.lineTo(x + pts[0][0] * w + 0.1, y + pts[0][1] * h)
    g.stroke()
  }
}

function paper(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = css(WHITE)
  g.strokeStyle = css(INK)
  g.lineWidth = 3
  g.beginPath()
  g.roundRect(x, y, w, h, 18)
  g.fill()
  g.stroke()
}

function footer(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = css(mix(CREAM, INK, 0.6))
  g.font = `800 16px ${BODY}`
  g.textAlign = 'center'
  g.fillText('Coupled', W / 2, H - 14)
}

async function render(W: number, H: number, frames: number, drawFrame: (g: CanvasRenderingContext2D, f: number, last: boolean) => void, holdLast = 300): Promise<Blob> {
  await fontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  const pal = palette()
  const out: Uint8Array[] = []
  const delays: number[] = []
  for (let f = 0; f <= frames; f++) {
    const last = f === frames
    g.fillStyle = css(CREAM)
    g.fillRect(0, 0, W, H)
    drawFrame(g, f, last)
    out.push(toIndices(g.getImageData(0, 0, W, H).data, pal))
    delays.push(last ? holdLast : 7)
    // Let the page breathe between frames.
    if (f % 6 === 5) await new Promise((r) => setTimeout(r, 0))
  }
  return encodeGif(W, H, pal, out, delays)
}

const total = (strokes: DrawStroke[]) => strokes.reduce((n, s) => n + s.length, 0)

// Draw Your Answer: the drawing inks itself in, then what it was — and what they guessed.
export function drawingReplay({ strokes, drawer, title, answer, guess, guesser }: {
  strokes: DrawStroke[]; drawer: PlayerId; title: string; answer: string; guess: string | null; guesser: string
}): Promise<Blob> {
  const W = 480
  const H = 520
  const points = Math.max(1, total(strokes))
  const frames = 36
  return render(W, H, frames, (g, f, last) => {
    g.fillStyle = css(INK)
    g.textAlign = 'center'
    g.font = `800 22px ${DISPLAY}`
    g.fillText(title, W / 2, 38)
    paper(g, 24, 56, W - 48, (W - 48) * 0.75)
    inkStrokes(g, strokes, Math.ceil((points * f) / frames), 24, 56, W - 48, (W - 48) * 0.75, SEAT[drawer], 5)
    if (last) {
      g.font = `800 28px ${DISPLAY}`
      g.fillStyle = css(SEAT[drawer])
      g.fillText(`It was: ${answer || '—'}`, W / 2, 56 + (W - 48) * 0.75 + 44)
      g.font = `700 20px ${BODY}`
      g.fillStyle = css(INK)
      g.fillText(guess ? `${guesser} guessed: ${guess}` : `${guesser} didn’t guess`, W / 2, 56 + (W - 48) * 0.75 + 76)
    }
    footer(g, W, H)
  })
}

// Perfect Circle: both of you, drawing at once, then the scores.
export function circleReplay({ drawn, names, scores }: {
  drawn: Record<PlayerId, DrawStroke>; names: Record<PlayerId, string>; scores: Record<PlayerId, number>
}): Promise<Blob> {
  const W = 520
  const H = 360
  const frames = 30
  const box = 220
  return render(W, H, frames, (g, f, last) => {
    ;(['A', 'B'] as PlayerId[]).forEach((p, i) => {
      const x = 26 + i * (box + 28)
      paper(g, x, 40, box, box)
      const stroke = drawn[p] ?? []
      inkStrokes(g, stroke.length ? [stroke] : [], Math.ceil((stroke.length * f) / frames), x, 40, box, box, SEAT[p], 5)
      g.textAlign = 'center'
      g.fillStyle = css(INK)
      g.font = `800 20px ${DISPLAY}`
      g.fillText(names[p], x + box / 2, 28)
      if (last) {
        g.fillStyle = css(SEAT[p])
        g.font = `800 34px ${DISPLAY}`
        g.fillText(`${scores[p].toFixed(1)}%`, x + box / 2, 40 + box + 42)
      }
    })
    footer(g, W, H)
  })
}
