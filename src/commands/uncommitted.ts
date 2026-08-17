import { parseArgs } from '@std/cli/parse-args'
import { loadConfig } from '../config.ts'
import { readChanges } from '../git.ts'
import { check } from '../uncommitted.check.ts'

const help = [
  'usage: git-going uncommitted',
  '',
  'Counts the tracked changes between the working tree and HEAD, and warns when',
  'either the file count or the changed-line count reaches its threshold.',
  'Untracked files are not counted.',
  '',
  'Run it from the post-commit and post-rewrite git hooks.',
  '',
  'options:',
  '  -h, --help  print this message',
].join('\n')

export const runUncommitted = async (args: string[]): Promise<void> => {
  const flags = parseArgs(args, {
    boolean: ['help'],
    alias: { h: 'help' },
  })

  if (flags.help) {
    console.log(help)

    return
  }

  const config = loadConfig(Deno.cwd())
  const changes = await readChanges(Deno.cwd())

  for (const line of check(changes, config.uncommitted)) {
    console.error(line)
  }
}
