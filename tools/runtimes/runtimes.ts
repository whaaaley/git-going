import { safeAsync } from '../../src/utils/safe.utils.ts'
import { bunTestPaths, dependencies, devDependencies, nodeTestGlobs, nodeVersions, sourceDirectories } from './runtimes.config.ts'
import { buildManifest, formatSummary, isFailure, parseBunSummary, parseNodeSummary } from './runtimes.report.ts'
import type { RunResult } from './runtimes.report.ts'

const printHelp = (): void => {
  console.log([
    'usage: deno task runtimes [options]',
    '',
    'Proves the package runs under Node and Bun. The sources are copied to a',
    'temporary directory, the JSR dependencies are installed there as npm',
    'packages, and the test suite runs under each runtime.',
    '',
    'Nothing is written inside the repository. A package.json beside deno.json',
    'switches Deno to node-modules resolution and breaks deno check, so the',
    'proof keeps its install artifacts outside the tree entirely.',
    '',
    'Requires node and bun on PATH. Missing runtimes are reported and skipped.',
    '',
    'A version manager keeps each node version under its own absolute path, so',
    'allow-run cannot be narrowed to a fixed list of binary names.',
    '',
    'options:',
    '  --keep      leave the staging directory in place and print its path',
    '  -h, --help  print this message',
  ].join('\n'))
}

const repoRoot = new URL('../../', import.meta.url).pathname

// The tool joins only known-good segments, so @std/path is not worth adding here.
const join = (...segments: string[]): string => segments.join('/').replace(/\/+/g, '/')

const run = async (command: string, args: string[], cwd: string): Promise<{ code: number; output: string }> => {
  const process = new Deno.Command(command, { args, cwd, stdout: 'piped', stderr: 'piped' })
  const { code, stdout, stderr } = await process.output()
  const decoder = new TextDecoder()

  return { code, output: `${decoder.decode(stdout)}${decoder.decode(stderr)}` }
}

const lookup = async (command: string): Promise<string> => {
  const { code, output } = await run('which', [command], repoRoot)

  if (code !== 0) return ''

  return output.trim()
}

// A staged copy is a plain directory of sources plus the manifest that resolves their imports.
const stage = async (directory: string): Promise<void> => {
  for (const source of sourceDirectories) {
    await copy(join(repoRoot, source), join(directory, source))
  }

  await Deno.writeTextFile(join(directory, 'package.json'), buildManifest(dependencies, devDependencies))

  // The JSR packages are served from npm.jsr.io under the @jsr scope rather than the public registry.
  await Deno.writeTextFile(join(directory, '.npmrc'), '@jsr:registry=https://npm.jsr.io\n')
}

const copy = async (from: string, to: string): Promise<void> => {
  await Deno.mkdir(to, { recursive: true })

  for await (const entry of Deno.readDir(from)) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)

    if (entry.isDirectory) {
      await copy(source, target)
      continue
    }

    await Deno.copyFile(source, target)
  }
}

const runNode = async (binary: string, version: string, directory: string): Promise<RunResult> => {
  const { output } = await run(binary, ['--test', ...nodeTestGlobs], directory)
  const { passed, failed } = parseNodeSummary(output)
  const result = { runtime: 'node', version, passed, failed }

  if (isFailure(result)) console.error(output)

  return result
}

const runBun = async (binary: string, directory: string): Promise<RunResult> => {
  const { output: raw } = await run(binary, ['--version'], directory)
  const { output } = await run(binary, ['test', ...bunTestPaths], directory)
  const { passed, failed } = parseBunSummary(output)
  const result = { runtime: 'bun', version: raw.trim(), passed, failed }

  if (isFailure(result)) console.error(output)

  return result
}

// A version manager keeps each version under its own prefix, so a match is used directly.
// The bare binary is accepted only when it already reports the version asked for.
const resolveNode = async (node: string, version: string): Promise<string> => {
  if (node === '') return ''

  const home = Deno.env.get('HOME') ?? ''
  const managed = join(home, '.vite-plus', 'js_runtime', 'node', version, 'bin', 'node')

  const { error } = await safeAsync(() => Deno.stat(managed))

  if (!error) return managed

  const { code, output } = await run(node, ['--version'], repoRoot)

  if (code === 0 && output.trim() === `v${version}`) return node

  return ''
}

const main = async (): Promise<void> => {
  const args = new Set(Deno.args)

  if (args.has('--help') || args.has('-h')) {
    printHelp()
    Deno.exit(0)
  }

  const keep = args.has('--keep')

  const node = await lookup('node')
  const bun = await lookup('bun')

  if (node === '' && bun === '') {
    console.error('Neither node nor bun is on PATH, so there is nothing to prove against.')
    Deno.exit(1)
  }

  const directory = await Deno.makeTempDir({ prefix: 'runtime-proof-' })

  try {
    await stage(directory)

    console.error('Installing the JSR dependencies as npm packages...')

    const install = await run('npm', ['install', '--silent', '--no-audit', '--no-fund'], directory)

    if (install.code !== 0) {
      console.error(install.output)
      console.error('The install failed, so no runtime was exercised.')
      Deno.exit(1)
    }

    const results: RunResult[] = []

    if (node === '') {
      console.error('node is not on PATH, skipping it.')
    }

    // Each requested version is resolved through the same node binary only when it matches,
    // so a machine holding one version proves that one rather than silently proving nothing.
    for (const version of nodeVersions) {
      const binary = await resolveNode(node, version)

      if (binary === '') {
        console.error(`node ${version} is not installed, skipping it.`)
        continue
      }

      results.push(await runNode(binary, version, directory))
    }

    if (bun === '') {
      console.error('bun is not on PATH, skipping it.')
    }

    if (bun !== '') results.push(await runBun(bun, directory))

    if (results.length === 0) {
      console.error('No runtime was available, so the claim was not proven.')
      Deno.exit(1)
    }

    console.log(formatSummary(results).join('\n'))

    if (results.some(isFailure)) Deno.exit(1)
  } finally {
    if (keep) {
      console.error(`Staging directory kept at ${directory}`)
    } else {
      await Deno.remove(directory, { recursive: true })
    }
  }
}

await main()

Deno.exit(0)
