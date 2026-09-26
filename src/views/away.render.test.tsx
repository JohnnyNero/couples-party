import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { AwayScreen } from './AwayScreen'

describe('the waiting screen', () => {
  it('names who the game is waiting for, and says it is saved', () => {
    let s = initialState(1, 'mrmrs', { mrmrsQuestions: ['Your comfort meal?'] })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Johnny' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Rocko' }, 1000)
    s = reduce(s, { type: 'AWAY', player: 'B' }, 2000)
    const html = renderToStaticMarkup(<AwayScreen s={s} />)
    expect(html).toContain('Waiting for Rocko')
    expect(html).toContain('saved')
  })
})
