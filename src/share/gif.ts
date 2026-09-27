// A small animated-GIF encoder, for the drawing replays. Browsers can record a canvas as
// video but not as a GIF — and a GIF plays everywhere a picture does (every chat app,
// inline, on a loop). Drawings are a handful of flat colours, so one small fixed palette
// covers every frame and there's no colour-quantising to do.

export type Rgb = [number, number, number]

class Bytes {
  data: number[] = []
  byte(b: number) { this.data.push(b & 0xff) }
  word(w: number) { this.byte(w); this.byte(w >> 8) }
  str(s: string) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)) }
}

// GIF's LZW, variable code width, emitted in sub-blocks of up to 255 bytes.
function lzw(indices: Uint8Array, minCodeSize: number, out: Bytes) {
  const clear = 1 << minCodeSize
  const end = clear + 1
  let codeSize = minCodeSize + 1
  let next = end + 1
  let dict = new Map<string, number>()
  const block: number[] = []
  let bits = 0
  let acc = 0
  const emit = (code: number) => {
    acc |= code << bits
    bits += codeSize
    while (bits >= 8) {
      block.push(acc & 0xff)
      acc >>>= 8
      bits -= 8
      if (block.length === 255) { out.byte(255); block.forEach((b) => out.byte(b)); block.length = 0 }
    }
  }
  out.byte(minCodeSize)
  emit(clear)
  let prefix = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const joined = prefix + ',' + k
    if (dict.has(joined)) {
      prefix = joined
      continue
    }
    emit(prefix.includes(',') ? dict.get(prefix)! : Number(prefix))
    if (next < 4096) {
      dict.set(joined, next++)
      if (next > 1 << codeSize && codeSize < 12) codeSize++
    } else {
      emit(clear)
      dict = new Map()
      codeSize = minCodeSize + 1
      next = end + 1
    }
    prefix = String(k)
  }
  emit(prefix.includes(',') ? dict.get(prefix)! : Number(prefix))
  emit(end)
  if (bits > 0) block.push(acc & 0xff)
  for (let i = 0; i < block.length; i += 255) {
    const chunk = block.slice(i, i + 255)
    out.byte(chunk.length)
    chunk.forEach((b) => out.byte(b))
  }
  out.byte(0)
}

// Frames are palette indices, width × height each; `delays` in hundredths of a second.
export function encodeGif(width: number, height: number, palette: Rgb[], frames: Uint8Array[], delays: number[]): Blob {
  const bitsNeeded = Math.max(2, Math.ceil(Math.log2(Math.max(2, palette.length))))
  const size = 1 << bitsNeeded
  const out = new Bytes()
  out.str('GIF89a')
  out.word(width)
  out.word(height)
  out.byte(0x80 | ((bitsNeeded - 1) << 4) | (bitsNeeded - 1)) // global table
  out.byte(0)
  out.byte(0)
  for (let i = 0; i < size; i++) {
    const [r, g, b] = palette[i] ?? [0, 0, 0]
    out.byte(r); out.byte(g); out.byte(b)
  }
  // Loop forever.
  out.byte(0x21); out.byte(0xff); out.byte(11); out.str('NETSCAPE2.0'); out.byte(3); out.byte(1); out.word(0); out.byte(0)
  frames.forEach((frame, f) => {
    out.byte(0x21); out.byte(0xf9); out.byte(4); out.byte(0); out.word(delays[f] ?? 8); out.byte(0); out.byte(0)
    out.byte(0x2c); out.word(0); out.word(0); out.word(width); out.word(height); out.byte(0)
    lzw(frame, bitsNeeded, out)
  })
  out.byte(0x3b)
  return new Blob([new Uint8Array(out.data)], { type: 'image/gif' })
}

// A canvas frame as palette indices: each pixel to its nearest colour.
export function toIndices(pixels: Uint8ClampedArray, palette: Rgb[]): Uint8Array {
  const out = new Uint8Array(pixels.length / 4)
  const cache = new Map<number, number>()
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]
    let best = cache.get(key)
    if (best === undefined) {
      let d = Infinity
      best = 0
      for (let c = 0; c < palette.length; c++) {
        const dr = pixels[i] - palette[c][0]
        const dg = pixels[i + 1] - palette[c][1]
        const db = pixels[i + 2] - palette[c][2]
        const dist = dr * dr + dg * dg + db * db
        if (dist < d) { d = dist; best = c }
      }
      cache.set(key, best)
    }
    out[p] = best
  }
  return out
}
