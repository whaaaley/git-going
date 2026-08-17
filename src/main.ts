/**
 * The `git-going` command line entry point.
 *
 * This module parses `Deno.args` and dispatches to the `uncommitted`,
 * `validate`, and `treesize` commands. It exports only {@link version}, so
 * importing it as a library gains you nothing. The reusable surface lives on
 * the subpath exports:
 *
 * - `@whaaaley/git-going/validator` validates a commit subject.
 * - `@whaaaley/git-going/check` decides whether an uncommitted tree is large enough to warn about.
 * - `@whaaaley/git-going/tier` decides which severity tier a working tree has reached.
 * - `@whaaaley/git-going/config` reads and validates `git-going.json`.
 *
 * `uncommitted` and `validate` are git hooks, run from `post-commit`,
 * `post-rewrite`, and `commit-msg`. `treesize` is not a git hook, it is
 * registered as a Claude Code `PostToolUse` hook in `.claude/settings.json`.
 *
 * @example
 * ```sh
 * git-going validate --file .git/COMMIT_EDITMSG
 * git-going uncommitted
 * ```
 *
 * @module
 */

import { ConfigError } from './config.ts'
import { runValidate } from './commands/validate.ts'
import { runTreesize } from './commands/treesize.ts'
import { runUncommitted } from './commands/uncommitted.ts'
import { safeAsync } from './utils/safe.utils.ts'

/**
 * The version `git-going --version` prints.
 *
 * This is a literal, kept in step with the `version` field of `deno.json` by
 * hand.
 */
export const version = '0.1.0'

const help = [
  'usage: git-going <command> [options]',
  '',
  'commands:',
  '  uncommitted  warn when the tracked working tree holds too much uncommitted work',
  '  validate     validate a commit subject',
  '  treesize     a Claude Code PostToolUse hook that reports working tree size',
  '',
  'uncommitted and validate are git hooks, run from post-commit, post-rewrite, and',
  'commit-msg. treesize is not a git hook, it is registered in .claude/settings.json.',
  '',
  'options:',
  '  -h, --help     print this message',
  '  -v, --version  print the version',
  '',
  'Run git-going <command> --help for a command.',
].join('\n')

const commands = ['uncommitted', 'validate', 'treesize']

const main = async (): Promise<number> => {
  const [command, ...rest] = Deno.args

  if (command === undefined || command === '--help' || command === '-h') {
    console.log(help)

    return 0
  }

  if (command === '--version' || command === '-v') {
    console.log(version)

    return 0
  }

  // The warning is advice, so a bad config is reported and the hook still passes.
  if (command === 'uncommitted') {
    const { error } = await safeAsync(() => runUncommitted(rest))

    if (error) {
      if (!(error instanceof ConfigError)) throw error

      console.error(`error: ${error.message}`)
    }

    return 0
  }

  if (command === 'validate') {
    return await runValidate(rest)
  }

  // A treesize failure would surface as a broken agent edit, so it stays silent and exits 0.
  if (command === 'treesize') {
    await safeAsync(() => runTreesize(rest))

    return 0
  }

  console.error(`error: unknown command ${command}, expected one of ${commands.join(', ')}`)

  return 1
}

if (import.meta.main) {
  const { data: code, error } = await safeAsync(() => main())

  if (error && !(error instanceof ConfigError)) throw error

  if (error) {
    console.error(`error: ${error.message}`)
    Deno.exit(1)
  }

  Deno.exit(code)
}
