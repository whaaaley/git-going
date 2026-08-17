// Remembers which tier was last announced, so a tree that stays large is only described once.

export type State = {
  sessionId: string
  announced: string
}

export const empty: State = { sessionId: '', announced: '' }

const decode = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// A state written by a different session describes a tree this session has not spoken about yet.

export const parse = (raw: string, sessionId: string): State => {
  const parsed = decode(raw)

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
