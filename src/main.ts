import { ConfigError } from './config.ts'
import { runCommit } from './commands/commit.ts'
import { runTreesize } from './commands/treesize.ts'
import { runUncommitted } from './commands/uncommitted.ts'

export const version = '0.1.0'

const help = [
  'usage: git-going <command> [options]',
  '',
  'commands:',
  '  uncommitted  warn when the tracked working tree holds too much uncommitted work',
  '  commit       validate a conventional commit subject',
  '  treesize     a Claude Code PostToolUse hook that reports working tree size',
  '',
  'uncommitted and commit are git hooks, run from post-commit, post-rewrite, and',
  'commit-msg. treesize is not a git hook, it is registered in .claude/settings.json.',
  '',
  'options:',
  '  -h, --help     print this message',
  '  -v, --version  print the version',
  '',
  'Run git-going <command> --help for a command.',
].join('\n')

const commands = ['uncommitted', 'commit', 'treesize']

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

  if (command === 'uncommitted') {
    await runUncommitted(rest)

    return 0
  }

  if (command === 'commit') {
    return await runCommit(rest)
  }

  // A treesize failure would surface as a broken agent edit, so it stays silent and exits 0.
  if (command === 'treesize') {
    try {
      await runTreesize(rest)
    } catch {
      return 0
    }

    return 0
  }

  console.error(`error: unknown command ${command}, expected one of ${commands.join(', ')}`)

  return 1
}

let code = 0

try {
  code = await main()
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`error: ${error.message}`)
    code = 1
  } else {
    throw error
  }
}

Deno.exit(code)
