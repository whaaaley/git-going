// Pure shaping for the runtime proof: the manifest it stages and the result lines it prints.

export type RunResult = {
  runtime: string
  version: string
  passed: number
  failed: number
}

/**
 * Builds the package.json the staged copy installs from.
 *
 * The proof writes this rather than the repository so that no package.json ever
 * exists beside deno.json, which is what switches Deno to node-modules
 * resolution and breaks `deno check` for anyone who forgets to clean up.
 */
export const buildManifest = (dependencies: Record<string, string>, devDependencies: Record<string, string>): string => {
  const manifest = {
    name: 'runtime-proof',
    private: true,
    dependencies,
    devDependencies,
  }

  return `${JSON.stringify(manifest, null, 2)}\n`
}

// Both runtimes colour their summaries when piped, so the codes come out first.
// The escape comes from its code point so the pattern holds no control character.
const colourCode = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

const plain = (output: string): string => {
  return output.replace(colourCode, '')
}

// Node reports a summary as "pass 21" and "fail 0" on their own lines.
const readNodeCount = (output: string, noun: string): number => {
  const found = new RegExp(`^\\s*\\D*${noun} (\\d+)\\s*$`, 'm').exec(plain(output))

  if (!found) return 0

  const [, digits] = found

  if (!digits) return 0

  return Number(digits)
}

// Bun reports a summary as "21 pass" and "0 fail", each on its own line.
const readBunCount = (output: string, noun: string): number => {
  const found = new RegExp(`^\\s*(\\d+) ${noun}\\s*$`, 'm').exec(plain(output))

  if (!found) return 0

  const [, digits] = found

  if (!digits) return 0

  return Number(digits)
}

export const parseNodeSummary = (output: string): { passed: number; failed: number } => {
  return { passed: readNodeCount(output, 'pass'), failed: readNodeCount(output, 'fail') }
}

export const parseBunSummary = (output: string): { passed: number; failed: number } => {
  return { passed: readBunCount(output, 'pass'), failed: readBunCount(output, 'fail') }
}

// A run with no passing test is a failure even when nothing reported a failure.
// The usual cause is a runtime that never found or never loaded the files.
export const isFailure = (result: RunResult): boolean => {
  return result.failed > 0 || result.passed === 0
}

export const formatResult = (result: RunResult): string => {
  const status = isFailure(result) ? 'FAIL' : 'ok'

  return `${status}  ${result.runtime} ${result.version}  ${result.passed} passed, ${result.failed} failed`
}

export const formatSummary = (results: RunResult[]): string[] => {
  const lines = results.map(formatResult)
  const failed = results.filter(isFailure)

  if (failed.length > 0) {
    lines.push('', `${failed.length} of ${results.length} runtime runs failed.`)

    return lines
  }

  lines.push('', `All ${results.length} runtime runs passed.`)

  return lines
}
