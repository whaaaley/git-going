import { parseArgs } from '@std/cli/parse-args'
import { loadConfig } from '../config.ts'
import { subjectOf, validate } from '../commit.validator.ts'

const help = [
  'usage: git-going commit --file <path>',
  '       git-going commit < message',
  '',
  'Validates a conventional commit subject. Only the first line is checked.',
  'Exits 1 and names each broken rule when the subject does not pass.',
  '',
  'Run it from the commit-msg git hook, passing the path git supplies.',
  '',
  'options:',
  '  -f, --file <path>  read the message from a file',
  '  -h, --help         print this message',
].join('\n')

export const runCommit = async (args: string[]): Promise<number> => {
  const flags = parseArgs(args, {
    boolean: ['help'],
    string: ['file'],
    alias: { h: 'help', f: 'file' },
  })

  if (flags.help) {
    console.log(help)

    return 0
  }

  // A bare positional path is accepted too, because git hands the hook exactly that.
  const [positional] = flags._
  const path = flags.file ?? (typeof positional === 'string' ? positional : '')

  let message = ''

  if (path === '') {
    message = await new Response(Deno.stdin.readable).text()
  } else {
    try {
      message = await Deno.readTextFile(path)
    } catch {
      console.error(`error: cannot read the commit message file ${path}`)

      return 1
    }
  }

  const config = loadConfig(Deno.cwd())
  const failures = validate(message, config.commit)

  if (failures.length === 0) return 0

  console.error(`error: ${subjectOf(message)}`)

  for (const failure of failures) {
    console.error(`  ${failure.rule}: ${failure.detail}`)
  }

  return 1
}
