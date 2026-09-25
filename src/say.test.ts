import { describe, it, expect } from 'vitest'
import { say } from './say'

const rocko = (self: boolean) => ({ self, subject: 'Rocko', partner: 'Johnny' })

describe('say', () => {
  it('reads "you" to the person it is about and their name to everyone else', () => {
    expect(say('five things [you do|@ does] in bed', rocko(true))).toBe('five things you do in bed')
    expect(say('five things [you do|@ does] in bed', rocko(false))).toBe('five things Rocko does in bed')
    expect(say('Hours [you|@] could go without [your|their] phone', rocko(false))).toBe('Hours Rocko could go without their phone')
  })
  it('keeps a capital at the start either way', () => {
    expect(say('[Your|@’s] comfort food', rocko(true))).toBe('Your comfort food')
    expect(say('[Your|@’s] comfort food', rocko(false))).toBe('Rocko’s comfort food')
  })
  it('names the other one of you', () => {
    expect(say('The animal {partner} reminds [you|@] of', rocko(true))).toBe('The animal Johnny reminds you of')
    expect(say('The animal {partner} reminds [you|@] of', rocko(false))).toBe('The animal Johnny reminds Rocko of')
    expect(say('What would {player} order?', rocko(true))).toBe('What would Johnny order?')
  })
  it('still understands the old {name}', () => {
    expect(say('{name} in one word', { ...rocko(true), legacyName: 'partner' })).toBe('Johnny in one word')
    expect(say('seven smells {name} loves', rocko(false))).toBe('seven smells Rocko loves')
  })
  it('leaves plain text alone', () => {
    expect(say('Your comfort meal?', rocko(false))).toBe('Your comfort meal?')
  })
})
