Rule: prove the package runs under Node and Bun with `deno task runtimes`
Reason: the JSR runtime compatibility claim is set by hand in the JSR web UI, so the only thing keeping it honest is a proof anyone can rerun

Rule: expect the proof to write nothing inside the repository
Reason: the sources are copied to a temporary directory and the install happens there, so a run cannot leave the tree dirty

Rule: do not create `package.json`, `package-lock.json`, or `.npmrc` in the repository to run the suites by hand
Reason: a `package.json` beside `deno.json` switches Deno to node-modules resolution, and `deno check` then fails with a missing `@types/node` for everyone who did not also install

Rule: rely on the temporary directory being removed even when a run fails
Reason: the cleanup is in a `finally`, so a failing runtime reports its output without stranding an install

Rule: pass `--keep` to leave the staging directory in place and print its path
Reason: reproducing a failure by hand needs the installed tree the failure happened in

Rule: expect a missing runtime to be reported and skipped rather than failing the run
Reason: a machine without Bun should still prove what it can, and the summary names what actually ran

Rule: read the summary as one line per runtime plus a verdict
Reason: each line carries the runtime, its version, and the pass and fail counts, so the evidence is the output rather than a claim about it

Rule: treat a run that passed nothing as a failure
Reason: a runtime that never loaded the files reports zero failures, which would otherwise read as success

Rule: keep the dependency list and the runtime versions in `runtimes.config.ts`, the parsing and formatting in `runtimes.report.ts`, and the IO in `runtimes.ts`
Reason: the report module tests without permissions while the entry owns the only spawn, copy, and temporary directory

Rule: update `dependencies` in `runtimes.config.ts` whenever an import is added to `deno.json`
Reason: the staged copy resolves imports through that manifest alone, so a missing entry fails the proof with a module not found

Rule: express a JSR dependency as its `npm:@jsr/...` alias in that manifest
Reason: Node and Bun resolve JSR packages through npm.jsr.io under the `@jsr` scope, which is what the generated `.npmrc` points at

Rule: do not read the proof as covering the `.` entrypoint
Reason: `src/main.ts` reads `Deno.args`, calls `Deno.exit`, and runs git through `Deno.Command`, so the CLI is Deno only and the proof covers the subpath exports instead

Rule: do not read the proof as covering `loadConfig` or `findConfigPath` from `./config`
Reason: the tests exercise `defaults`, `merge`, and `parse`, while those two call `Deno.statSync` and `Deno.readTextFileSync` and would throw a missing `Deno` under another runtime

Rule: treat `./config` as importable anywhere but callable in full only under Deno
Reason: the `Deno` references sit inside function bodies rather than at module scope, so importing the module never throws and only those two functions do

Rule: record the result in the README rather than only in a terminal
Reason: a reader deciding whether to trust the JSR badge needs the versions and the counts in the repository

Rule: rerun the proof before bumping the version and update the README counts when they move
Reason: the recorded numbers are evidence for a specific release, so a stale count is worse than none
