import type { Changes } from './uncommitted.check.ts'
import { safeAsync } from './utils/safe.utils.ts'

// Counts the tracked changes between the working tree and HEAD.

const run = async (args: string[], cwd: string): Promise<string> => {
  const command = new Deno.Command('git', { args, cwd, stdout: 'piped', stderr: 'null' })
  const { data: output, error: runError } = await safeAsync(() => command.output())

  // A git failure leaves the tree uncountable, so the caller reports nothing rather than guessing.
  if (runError) return ''
  if (output.code !== 0) return ''

  return new TextDecoder().decode(output.stdout)
}

// A shortstat line names only its nonzero parts, as in "3 files changed, 12 insertions(+)".
export const countIn = (shortstat: string, noun: string): number => {
  const found = new RegExp(`(\\d+) ${noun}`).exec(shortstat)

  if (!found) return 0

  const [, digits] = found

  if (!digits) return 0

  return Number(digits)
}

export const readChanges = async (cwd: string): Promise<Changes> => {
  // The two counts are independent, so the subprocesses overlap rather than queue.
  const [names, shortstat] = await Promise.all([
    run(['diff', '--name-only', 'HEAD', '--'], cwd),
    run(['diff', '--shortstat', 'HEAD', '--'], cwd),
  ])

  return {
    fileCount: names.split('\n').filter((line) => line.length > 0).length,
    insertions: countIn(shortstat, 'insertion'),
    deletions: countIn(shortstat, 'deletion'),
  }
}
