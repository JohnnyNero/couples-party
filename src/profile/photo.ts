// A photo from the camera roll, made small enough to keep on the server next to your
// name: the middle square, 192px across, as a JPEG data URL — around 10 KB, well under
// the 60 KB the server allows (see migration 0013).

const SIDE = 192

export async function shrinkPhoto(file: File): Promise<string> {
  const img = await loadImage(file)
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIDE
  canvas.height = SIDE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIDE, SIDE)
  // Step the quality down until it fits, in the rare case a busy photo doesn't.
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length < 55000) return url
  }
  throw new Error('photo is too big')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("couldn't read that photo")) }
    img.src = url
  })
}
