/**
 * Reads and validates `git-going.json`.
 *
 * The file is found by walking up from the working directory, so it usually
 * sits at the repository root. Every field defaults, so a project with no
 * config file behaves exactly as {@link defaults} describes, and a config file
 * only has to name what it changes.
 *
 * Validation is strict and every failure throws {@link ConfigError} naming the
 * offending key by its dotted path, such as `commit.maxLength` or
 * `treesize.tiers[1].name`. Unknown keys are rejected rather than ignored, so
 * a typo surfaces instead of silently doing nothing.
 *
 * @example
 * ```ts
 * import { loadConfig } from '@whaaaley/git-going/config'
 *
 * const config = loadConfig(Deno.cwd())
 * ```
 *
 * @example A config file naming only what it changes.
 * ```json
 * {
 *   "commit": { "scopes": ["api", "cli"], "maxLength": 80 },
 *   "uncommitted": { "files": 20 }
 * }
 * ```
 *
 * @module
 */

import { dirname, join } from '@std/path'
import { scopePattern, typePattern } from './commit.pattern.ts'
import { safe } from './utils/safe.utils.ts'

/**
 * One severity level of the `treesize` hook.
 *
 * A tree reaches the tier when either `files` or `lines` is met, so the two
 * are independent ceilings rather than a combined condition. A tier that omits
 * one threshold in the config file defaults it to infinity, making that
 * dimension unreachable, and a tier omitting both is rejected as unreachable
 * entirely.
 */
export type Tier = {
  name: string
  files: number
  lines: number
}

/**
 * Thresholds for the `uncommitted` warning.
 *
 * The tree trips when either the file count or the combined changed-line count
 * reaches its value. Each is a whole number of at least 1.
 */
export type UncommittedConfig = {
  files: number
  lines: number
}

/**
 * The vocabulary and limits a commit subject is validated against.
 *
 * `types` is the permitted set of commit types, each lowercase letters only.
 * `scopes` is the permitted set of scopes, each lowercase letters and dashes
 * only, and an empty list accepts any scope rather than forbidding all of
 * them. `maxLength` is the longest permitted subject line.
 */
export type CommitConfig = {
  types: string[]
  scopes: string[]
  maxLength: number
}

/**
 * The tiers the `treesize` hook announces, ordered ascending by severity.
 *
 * The order is load-bearing. Parsing rejects a list in which a later tier is
 * easier to reach than the one before it.
 */
export type TreesizeConfig = {
  tiers: Tier[]
}

/**
 * The full resolved configuration, with every field populated.
 *
 * Whatever a `git-going.json` omits is filled from {@link defaults}, so no
 * field is ever missing by the time a caller sees it.
 */
export type Config = {
  uncommitted: UncommittedConfig
  commit: CommitConfig
  treesize: TreesizeConfig
}

/**
 * The configuration used when `git-going.json` is absent, and the source of
 * every individual field a config file does not name.
 *
 * The commit types are the Conventional Commits set. `scopes` is empty, which
 * accepts any scope, so a project is not forced to enumerate them.
 */
export const defaults: Config = {
  uncommitted: {
    files: 12,
    lines: 400,
  },
  commit: {
    types: [
      'feat',
      'fix',
      'refactor',
      'test',
      'docs',
      'style',
      'chore',
      'build',
      'ci',
      'perf',
      'revert',
    ],
    scopes: [],
    maxLength: 72,
  },
  treesize: {
    tiers: [
      { name: 'notice', files: 12, lines: 400 },
      { name: 'warning', files: 25, lines: 900 },
      { name: 'urgent', files: 40, lines: 1500 },
    ],
  },
}

/**
 * Thrown when `git-going.json` is malformed, holds an unknown key, or holds a
 * value that could not work.
 *
 * The message names the offending key by its dotted path and states what was
 * expected, so it is suitable for printing straight to a terminal.
 *
 * The commands handle it differently by intent. `uncommitted` and `treesize`
 * report the message and still exit 0, because their output is advice and a
 * broken config should not block a commit or break an agent edit. `validate`
 * lets it exit 1, because a commit cannot be checked against a config that
 * does not load.
 */
export class ConfigError extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const rejectUnknownKeys = (source: Record<string, unknown>, allowed: string[], path: string): void => {
  for (const key of Object.keys(source)) {
    if (allowed.includes(key)) continue

    throw new ConfigError(`unknown key ${path}${key}, expected one of ${allowed.join(', ')}`)
  }
}

const readNumber = (source: Record<string, unknown>, key: string, path: string, fallback: number): number => {
  const found = source[key]

  if (found === undefined) return fallback
  if (typeof found !== 'number' || !Number.isFinite(found)) {
    throw new ConfigError(`${path}${key} must be a number`)
  }

  return found
}

// A threshold is compared with >= against a count, so zero trips on every tree and stops being a threshold at all.
// One is degenerate but coherent, and no maximum is imposed because a deliberately unreachable ceiling is a legitimate choice.
const readThreshold = (source: Record<string, unknown>, key: string, path: string, fallback: number): number => {
  const found = readNumber(source, key, path, fallback)

  if (!Number.isInteger(found) || found < 1) {
    throw new ConfigError(`${path}${key} is not usable, a threshold must be a whole number of at least 1`)
  }

  return found
}

const readStringArray = (source: Record<string, unknown>, key: string, path: string, fallback: string[]): string[] => {
  const found = source[key]

  if (found === undefined) return fallback
  if (!Array.isArray(found) || found.some((entry) => typeof entry !== 'string')) {
    throw new ConfigError(`${path}${key} must be an array of strings`)
  }

  return found.filter((entry): entry is string => typeof entry === 'string')
}

// A vocabulary entry the subject pattern can never match would surface later as a confusing format failure, so it is refused here by name.
const readVocabulary = (source: Record<string, unknown>, key: string, path: string, pattern: RegExp, shape: string, fallback: string[]): string[] => {
  const entries = readStringArray(source, key, path, fallback)

  for (const entry of entries) {
    if (pattern.test(entry)) continue

    throw new ConfigError(`${path}${key} entry ${JSON.stringify(entry)} is not usable, ${shape}`)
  }

  return entries
}

const readSection = (source: Record<string, unknown>, key: string, path: string): Record<string, unknown> => {
  const found = source[key]

  if (found === undefined) return {}
  if (!isObject(found)) {
    throw new ConfigError(`${path}${key} must be an object`)
  }

  return found
}

// A tier is named in an error by its name, falling back to its position when the name is blank.
const tierLabel = (name: string, index: number): string => {
  return name === '' ? `[${index}]` : JSON.stringify(name)
}

const readTiers = (source: Record<string, unknown>, path: string, fallback: Tier[]): Tier[] => {
  const found = source['tiers']

  if (found === undefined) return fallback
  if (!Array.isArray(found)) {
    throw new ConfigError(`${path}tiers must be an array`)
  }

  const tiers = found.map((entry, index): Tier => {
    const at = `${path}tiers[${index}].`

    if (!isObject(entry)) {
      throw new ConfigError(`${path}tiers[${index}] must be an object`)
    }

    rejectUnknownKeys(entry, ['name', 'files', 'lines'], at)

    const name = entry['name']

    if (typeof name !== 'string') {
      throw new ConfigError(`${at}name must be a string`)
    }

    // A tier declaring neither threshold defaults both to infinity, so no working tree could ever reach it.
    if (entry['files'] === undefined && entry['lines'] === undefined) {
      throw new ConfigError(`${path}tiers entry ${tierLabel(name, index)} is not usable, a tier needs files or lines to be reachable`)
    }

    return {
      name,
      files: readNumber(entry, 'files', at, Number.POSITIVE_INFINITY),
      lines: readNumber(entry, 'lines', at, Number.POSITIVE_INFINITY),
    }
  })

  // tierFor takes the last tier reached, so a later tier easier to reach than an earlier one would be announced in its place.
  // Both thresholds must be non-decreasing, which is exactly when each tier's trip region sits inside the one before it.
  for (const [index, tier] of tiers.entries()) {
    const previous = tiers[index - 1]

    if (!previous) continue
    if (tier.files >= previous.files && tier.lines >= previous.lines) continue

    throw new ConfigError(`${path}tiers entry ${tierLabel(tier.name, index)} is not usable, a tier must not be easier to reach than ${tierLabel(previous.name, index - 1)} before it`)
  }

  return tiers
}

/**
 * Validates already-decoded JSON and fills every unnamed field from
 * {@link defaults}.
 *
 * `undefined` yields the defaults untouched, which is the no-config-file case.
 *
 * @param raw The decoded contents of a `git-going.json`.
 * @throws {ConfigError} When `raw` is not an object, holds an unknown key, holds a value of the wrong type, sets a threshold below 1 or non-integer, names a commit type or scope the subject pattern could never match, or declares a tier that is unreachable or easier to reach than the tier before it.
 */
export const merge = (raw: unknown): Config => {
  if (raw === undefined) return defaults
  if (!isObject(raw)) {
    throw new ConfigError('git-going.json must contain a JSON object')
  }

  rejectUnknownKeys(raw, ['uncommitted', 'commit', 'treesize'], '')

  const uncommitted = readSection(raw, 'uncommitted', '')
  const commit = readSection(raw, 'commit', '')
  const treesize = readSection(raw, 'treesize', '')

  rejectUnknownKeys(uncommitted, ['files', 'lines'], 'uncommitted.')
  rejectUnknownKeys(commit, ['types', 'scopes', 'maxLength'], 'commit.')
  rejectUnknownKeys(treesize, ['tiers'], 'treesize.')

  return {
    uncommitted: {
      files: readThreshold(uncommitted, 'files', 'uncommitted.', defaults.uncommitted.files),
      lines: readThreshold(uncommitted, 'lines', 'uncommitted.', defaults.uncommitted.lines),
    },
    commit: {
      types: readVocabulary(commit, 'types', 'commit.', typePattern, 'a type is lowercase letters only', defaults.commit.types),
      scopes: readVocabulary(commit, 'scopes', 'commit.', scopePattern, 'a scope is lowercase letters and dashes only', defaults.commit.scopes),
      maxLength: readThreshold(commit, 'maxLength', 'commit.', defaults.commit.maxLength),
    },
    treesize: {
      tiers: readTiers(treesize, 'treesize.', defaults.treesize.tiers),
    },
  }
}

/**
 * Decodes the text of a `git-going.json` and validates it.
 *
 * @param raw The file's text.
 * @throws {ConfigError} When the text is not valid JSON, or fails any of the validation {@link merge} performs.
 */
export const parse = (raw: string): Config => {
  const { data: decoded, error: decodeError } = safe((): unknown => JSON.parse(raw))

  if (decodeError) throw new ConfigError('git-going.json is not valid JSON')

  return merge(decoded)
}

/**
 * Walks up from a directory looking for `git-going.json`.
 *
 * The search starts at `start` and climbs one parent at a time until it finds
 * the file or reaches the filesystem root.
 *
 * Requires read access to each directory on the way up.
 *
 * @param start The directory to start from, usually `Deno.cwd()`.
 * @returns The absolute path to the file, or `''` when no config file exists above `start`.
 */
export const findConfigPath = (start: string): string => {
  let current = start

  while (true) {
    const candidate = join(current, 'git-going.json')

    // A missing file at this level only means the walk continues upward.
    const { data: info, error: statError } = safe(() => Deno.statSync(candidate))

    if (!statError && info.isFile) return candidate

    const parent = dirname(current)

    if (parent === current) return ''

    current = parent
  }
}

/**
 * Finds `git-going.json` above a directory, reads it, and validates it.
 *
 * A missing or unreadable file yields {@link defaults}, because a project
 * without a config is a supported case. A file that exists and can be read but
 * does not parse or does not validate throws instead, because that is a
 * mistake the author wants to hear about.
 *
 * Requires read access to the config file and the directories above `start`.
 *
 * @param start The directory to start the search from, usually `Deno.cwd()`.
 * @throws {ConfigError} When a config file is found and read but is invalid.
 *
 * @example
 * ```ts
 * const config = loadConfig(Deno.cwd())
 *
 * console.log(config.commit.maxLength)
 * ```
 */
export const loadConfig = (start: string): Config => {
  const path = findConfigPath(start)

  if (path === '') return defaults

  const { data: raw, error: readError } = safe(() => Deno.readTextFileSync(path))

  if (readError) return defaults

  return parse(raw)
}
