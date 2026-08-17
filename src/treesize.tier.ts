/**
 * Decides which severity tier a working tree has reached, and whether that
 * tier is worth announcing.
 *
 * This backs the `treesize` command, a Claude Code `PostToolUse` hook that
 * tells a coding agent to commit before it keeps editing. Because the hook
 * runs after every edit, {@link decide} tracks the last tier announced and
 * stays quiet until the tree crosses into a higher one.
 *
 * Tiers are an ordered list, ascending in severity, and every function here
 * depends on that order. See {@link tierFor} and {@link rankOf}.
 *
 * @example
 * ```ts
 * import { decide } from '@whaaaley/git-going/tier'
 * import { defaults } from '@whaaaley/git-going/config'
 *
 * const changes = { fileCount: 30, insertions: 900, deletions: 100 }
 * const { announcement, nextAnnounced } = decide(changes, 'notice', defaults.treesize.tiers)
 * ```
 *
 * @module
 */

import type { Tier } from './config.ts'
import type { Changes } from './uncommitted.check.ts'
import { pluralize } from './utils/pluralize.utils.ts'

/**
 * A message telling the reader to commit, together with the tier that produced
 * it.
 *
 * `lines` is a headline followed by guidance, ready to print as separate
 * lines. `tier` is the name of the tier reached.
 */
export type Announcement = {
  tier: string
  lines: string[]
}

// The headline is read by the coding agent, so it opens with the instruction and leaves the evidence to the clause after it.
const directive: Record<string, string> = {
  notice: 'Commit the finished work before making further edits.',
  warning: 'Commit the finished work now, before writing anything new.',
  urgent: 'Stop editing and commit the finished work before touching another file.',
}

const guidance: Record<string, string[]> = {
  notice: [
    'Split the finished part of this work into its own commit before going further.',
    'Run git status to see what is left.',
  ],
  warning: [
    'This is past the size a reviewer can read in one pass.',
    'Commit the parts that already stand on their own before writing anything new.',
  ],
  urgent: [
    'Stop adding to this tree and commit what is finished.',
    'Work this large stops being reviewable, and a single mistake now costs all of it.',
  ],
}

const fallbackDirective = 'Commit the finished work before making further edits.'

/**
 * Finds the tier a working tree has reached.
 *
 * A tier is reached when either the file count or the combined line count
 * meets its threshold. Every tier in the list is tested and the **last** match
 * wins, so `tiers` must be ordered ascending by severity. A later tier that is
 * easier to reach than an earlier one would be announced in its place, which
 * is why config parsing rejects a non-ascending list.
 *
 * @param changes The tracked changes between the working tree and `HEAD`.
 * @param tiers The tiers, ordered ascending by severity.
 * @returns The most severe tier reached, or `null` when the tree reaches none.
 */
export const tierFor = (changes: Changes, tiers: Tier[]): Tier | null => {
  const { fileCount, insertions, deletions } = changes
  const lineCount = insertions + deletions

  let reached: Tier | null = null

  for (const tier of tiers) {
    if (fileCount >= tier.files || lineCount >= tier.lines) reached = tier
  }

  return reached
}

/**
 * Ranks a tier by severity.
 *
 * A tier's rank is its position in the ordered list, so the ranking is only
 * meaningful when `tiers` is ordered ascending by severity. A name that is not
 * in the list ranks `-1`, below every real tier, which is how the empty name
 * of a tree that has announced nothing compares correctly against all of them.
 *
 * @param name The tier name to look up.
 * @param tiers The tiers, ordered ascending by severity.
 * @returns The tier's index, or `-1` when the name is not in the list.
 */
export const rankOf = (name: string, tiers: Tier[]): number => {
  return tiers.findIndex((tier) => tier.name === name)
}

const describe = (tier: Tier, changes: Changes): string => {
  const { fileCount, insertions, deletions } = changes
  const lineCount = insertions + deletions

  const filesTripped = fileCount >= tier.files
  const linesTripped = lineCount >= tier.lines

  const files = pluralize('file', fileCount)
  const lines = pluralize('changed line', lineCount)

  if (filesTripped && linesTripped) return `${files} and ${lines}`
  if (filesTripped) return files

  return lines
}

/**
 * The outcome of {@link decide}.
 *
 * `announcement` is the message to print, or `null` when the tree has nothing
 * new to say. `nextAnnounced` is the tier name the caller must persist and
 * pass back as `lastAnnounced` on the next run, and it must be stored whether
 * or not an announcement came with it.
 */
export type Decision = {
  announcement: Announcement | null
  nextAnnounced: string
}

/**
 * Decides whether a working tree has crossed into a higher tier since the last
 * announcement, and builds the message when it has.
 *
 * A tree announces only on the way up. Staying inside the announced tier says
 * nothing new and returns no announcement.
 *
 * The stored tier is the one the tree has currently reached, not the highest
 * it has ever reached. Falling to a lower tier lowers the stored value, which
 * lets that tier announce again if the tree grows back into it. A tree that
 * reaches no tier at all resets `nextAnnounced` to the empty string.
 *
 * @param changes The tracked changes between the working tree and `HEAD`.
 * @param lastAnnounced The `nextAnnounced` from the previous run, or `''` on the first.
 * @param tiers The tiers, ordered ascending by severity.
 *
 * @example
 * ```ts
 * let announced = ''
 *
 * const { announcement, nextAnnounced } = decide(changes, announced, tiers)
 *
 * announced = nextAnnounced
 *
 * if (announcement) console.error(announcement.lines.join('\n'))
 * ```
 */
export const decide = (changes: Changes, lastAnnounced: string, tiers: Tier[]): Decision => {
  const reached = tierFor(changes, tiers)

  if (!reached) {
    return { announcement: null, nextAnnounced: '' }
  }

  const nextAnnounced = reached.name

  // Staying inside the announced tier says nothing new, and a drop was already absorbed by the rank falling.
  if (rankOf(reached.name, tiers) <= rankOf(lastAnnounced, tiers)) {
    return { announcement: null, nextAnnounced }
  }

  const headline = `${directive[reached.name] ?? fallbackDirective} ${describe(reached, changes)} are uncommitted.`

  const announcement = {
    tier: reached.name,
    lines: [headline, ...(guidance[reached.name] ?? [])],
  }

  return { announcement, nextAnnounced }
}
