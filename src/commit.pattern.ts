// The shapes a conventional commit subject is made of.
// Every pattern here is a whole-value test except the breaking marker, which matches only the header.

export const typePattern = /^[a-z]+$/u

export const scopePattern = /^[a-z-]+$/u

// The header is the type, an optional scope, and the separator, so both full patterns are built from the same two sources.
const typeSource = '[a-z]+'

const scopeSource = '[a-z-]+'

const headerSource = `^(${typeSource})(?:\\((${scopeSource})\\))?`

// Unanchored at the end on purpose, so the marker is found in the header and a bang later in the description is left alone.
export const breakingPattern = new RegExp(`${headerSource}!:`, 'u')

export const subjectPattern = new RegExp(`${headerSource}: (.+)$`, 'u')

export const capitalPattern = /^[A-Z]/u

export const punctuationPattern = /[.!,;:]$/u
