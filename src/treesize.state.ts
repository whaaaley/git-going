import { safe } from './utils/safe.utils.ts'

// Remembers which tier was last announced, so a tree that stays large is only described once.

export type State = {
  sessionId: string
  announced: string
}

export const empty: State = { sessionId: '', announced: '' }

// A state written by a different session describes a tree this session has not spoken about yet.

export const parse = (raw: string, sessionId: string): State => {
  const { data: parsed, error: decodeError } = safe((): unknown => JSON.parse(raw))

  if (decodeError) return empty
  if (!parsed || typeof parsed !== 'object') return empty
  if (!('sessionId' in parsed) || !('announced' in parsed)) return empty

  const { sessionId: stored, announced } = parsed

  if (typeof stored !== 'string' || typeof announced !== 'string') return empty
  if (stored !== sessionId) return empty

  return { sessionId: stored, announced }
}

export const serialize = (state: State): string => {
  return JSON.stringify(state)
}
