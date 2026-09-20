import pack from '../../packs/bot.json'
import type { BotBrain } from './policy'

// Content never lives in code — the bot's vocabulary is a pack like everything else.
export const BRAIN: BotBrain = pack as BotBrain
