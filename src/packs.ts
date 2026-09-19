import gap from '../packs/gap.json'
import list from '../packs/list.json'

export async function loadPacks(): Promise<{ seedWords: string[]; houseForfeits: string[] }> {
  return {
    seedWords: (gap as { seedWords: string[] }).seedWords,
    houseForfeits: (list as { houseForfeits: string[] }).houseForfeits,
  }
}
