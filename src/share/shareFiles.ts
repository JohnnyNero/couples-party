// Hands a picture (or a clip) and some text to the phone's share sheet — and, where a
// browser can't share files, does the next best thing: shares just the text, or saves
// the file and copies the text for you to paste.
export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'saved' | 'failed'

export async function shareFiles({ text, file, filename, title }: { text?: string; file: Blob | null; filename: string; title: string }): Promise<ShareResult> {
  const asFile = file ? new File([file], filename, { type: file.type }) : null
  const withFile = asFile ? { title, text, files: [asFile] } : null
  try {
    if (withFile && navigator.canShare?.(withFile)) {
      await navigator.share(withFile)
      return 'shared'
    }
    if (text && navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled'
  }
  let saved = false
  if (file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    saved = true
  }
  if (text) {
    try {
      await navigator.clipboard.writeText(text)
      return saved ? 'saved' : 'copied'
    } catch { /* no clipboard either */ }
  }
  return saved ? 'saved' : 'failed'
}
