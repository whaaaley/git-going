import { parseArgs } from '@std/cli/parse-args'
import { dirname, join } from '@std/path'
import { loadConfig } from '../config.ts'
import { readChanges } from '../git.ts'
import { empty, parse, serialize, type State } from '../treesize.state.ts'
import { decide } from '../treesize.tier.ts'

// Reads a Claude Code PostToolUse payload on stdin and describes the working tree when it enters a new size tier.
// Every failure path here returns in silence, because a warning must never cost the edit that triggered it.

const help = [
  'usage: git-going treesize',
  '',
  'A Claude Code PostToolUse hook, not a git hook. It reads a hook payload on',
  'stdin and prints an additionalContext envelope on stdout when the working',
  'tree enters a size tier it has not announced this session.',
  '',
  'Register it in .claude/settings.json under hooks.PostToolUse.',
  '',
  'options:',
  '  -h, --help  print this message',
].join('\n')

type Payload = {
  toolName: string
  sessionId: string
  cwd: string
}

const stringAt = (source: object, key: string): string => {
  if (!(key in source)) return ''

  const found: unknown = Reflect.get(source, key)

  if (typeof found !== 'string') return ''

  return found
}

const readPayload = async (): Promise<Payload> => {
  const blank = { toolName: '', sessionId: '', cwd: '' }

  try {
    const raw = await new Response(Deno.stdin.readable).text()
    const parsed: unknown = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') return blank

    return {
      toolName: stringAt(parsed, 'tool_name'),
      sessionId: stringAt(parsed, 'session_id'),
      cwd: stringAt(parsed, 'cwd'),
    }
  } catch {
    return blank
  }
}

const statePath = (root: string): string => {
  return join(root, '.claude', 'treesize.state.json')
}

const readState = async (path: string, sessionId: string): Promise<State> => {
  try {
    return parse(await Deno.readTextFile(path), sessionId)
  } catch {
    return empty
  }
}

const writeState = async (path: string, state: State): Promise<void> => {
  try {
    await Deno.mkdir(dirname(path), { recursive: true })
    await Deno.writeTextFile(path, serialize(state))
  } catch {
    return
  }
}

export const runTreesize = async (args: string[]): Promise<void> => {
  const flags = parseArgs(args, {
    boolean: ['help'],
    alias: { h: 'help' },
  })

  if (flags.help) {
    console.log(help)

    return
  }

  const { toolName, sessionId, cwd } = await readPayload()

  if (toolName !== 'Write' && toolName !== 'Edit') return

  const root = cwd.length > 0 ? cwd : Deno.cwd()
  const config = loadConfig(root)
  const changes = await readChanges(root)

  const path = statePath(root)
  const state = await readState(path, sessionId)
  const { announcement, nextAnnounced } = decide(changes, state.announced, config.treesize.tiers)

  if (nextAnnounced !== state.announced) {
    await writeState(path, { sessionId, announced: nextAnnounced })
  }

  if (!announcement) return

  const message = announcement.lines.join('\n')

  // additionalContext under hookSpecificOutput is the documented PostToolUse field that reaches the model.
  // systemMessage rides along as the short notice for the human, who does not need the full instruction.
  const output = {
    systemMessage: `Uncommitted tree reached the ${announcement.tier} tier.`,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
  }

  console.log(JSON.stringify(output))
  console.error(message)
}
