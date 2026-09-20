import gap from '../packs/gap.json'

export async function loadPacks(): Promise<{ seedWords: string[] }> {
  return { seedWords: (gap as { seedWords: string[] }).seedWords }
}
