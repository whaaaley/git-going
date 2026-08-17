// What the runtime proof installs, which runtimes it runs, and which tests it runs under them.

// The JSR dependencies this package imports, as the npm aliases npm.jsr.io serves.
// Deno reads these from deno.json, but Node and Bun need a package.json to resolve them.
export const dependencies: Record<string, string> = {
  '@std/assert': 'npm:@jsr/std__assert@^1.0.19',
  '@std/cli': 'npm:@jsr/std__cli@^1.0.32',
  '@std/path': 'npm:@jsr/std__path@^1.1.6',
}

// Once a package.json exists Deno switches to node-modules resolution and needs these types.
// The proof installs them even though the runtimes themselves do not read types.
export const devDependencies: Record<string, string> = {
  '@types/node': '^26.2.0',
}

// A published version is verified against the LTS line and the current line.
export const nodeVersions = ['24.19.0', '26.7.0']

// The test files the proof runs, relative to the staged copy.
// Node takes a glob and Bun takes a directory, so each runtime gets the form it accepts.
export const nodeTestGlobs = ['src/**/*.test.ts']

export const bunTestPaths = ['src/']

// Source directories copied into the staging directory, in repository order.
export const sourceDirectories = ['src']
