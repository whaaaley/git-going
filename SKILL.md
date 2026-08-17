Rule: install the utility once with `deno install -g --allow-run=git --allow-read --allow-write jsr:@whaaaley/git-going`
Reason: the permissions are baked into the generated shim, so every hook script that calls `git-going` needs no flags of its own

Rule: run `git config core.hooksPath` before setting it in a project
Reason: git honors one hooks directory per repository, so pointing it elsewhere silently stops the existing hooks with no warning

Rule: add the `git-going` line to the hooks already in that directory when `core.hooksPath` is already set
Reason: composing with the existing directory keeps the project's other hooks running

Rule: call `git-going validate --file "$1"` from `commit-msg`
Reason: git passes the message file path as the first argument, and the validator reads only the subject line

Rule: pipe a message into `git-going validate` on stdin as the alternative input
Reason: supports workflows where the message comes from another command rather than a file

Rule: call `git-going uncommitted` from `post-commit` and `post-rewrite`
Reason: the count of what is left behind is worth reading right after a commit lands

Rule: register `git-going treesize` in `.claude/settings.json` under `hooks.PostToolUse` with the matcher `Write|Edit`
Reason: it reads a Claude Code hook payload on stdin, so it is not a git hook and a bare invocation with no payload does nothing

Rule: merge the `PostToolUse` entry into an existing `.claude/settings.json` rather than replacing the file
Reason: replacing it drops every other hook the project had registered

Rule: add `.claude/treesize.state.json` to `.gitignore`
Reason: it is per-session scratch state holding the session id and the tier already announced

Rule: put project thresholds in a `git-going.json` at the repository root
Reason: the utility is installed rather than vendored, so a consumer cannot edit a config file inside the package

Rule: expect `git-going.json` to be found by walking up from the working directory
Reason: a hook may run from a subdirectory, and the config belongs to the repository rather than the caller

Rule: omit any field that should keep its default
Reason: every field defaults, so a project with no config file behaves exactly as the README documents

Rule: expect a list in the config to replace the default rather than extend it
Reason: a project that names its own commit types means those types and not the defaults as well

Rule: leave `commit.scopes` empty to accept any scope
Reason: an empty list means the project does not track scopes, which is different from naming none

Rule: expect an unknown key or a wrong-typed value to fail with an error naming the key
Reason: the config is hand-validated with a defaults merge, so a typo surfaces instead of being silently ignored

Rule: expect a warning at 12 changed files or 400 changed lines by default
Reason: either count trips the warning on its own

Rule: read the changed-line count as insertions plus deletions
Reason: a rewritten line costs both, so summing them measures the work a reviewer has to read

Rule: expect only tracked changes to be counted
Reason: scratch files would false-positive, and git collapses an untracked directory to a single line that undercounts it

Rule: expect `uncommitted` to exit 0 even when it warns, and even when the config is bad
Reason: the warning is advice rather than a failure, and one honest exit code suits every hook that runs it

Rule: expect `validate` to exit 1 and name each broken rule when the subject does not pass
Reason: `commit-msg` fails the commit on a nonzero exit, which is the point of the check

Rule: expect `validate` to exit 1 on a bad config rather than passing the commit
Reason: a `commit-msg` hook that silently accepts everything is worse than one that complains

Rule: expect a merge or revert subject to pass unchecked
Reason: git generates those, and rewriting them would fight the tool that wrote them

Rule: expect the treesize tiers `notice`, `warning`, and `urgent` at 12, 25, and 40 files or 400, 900, and 1500 changed lines
Reason: the last tier a tree reaches is the one that describes it, and either count trips a tier on its own

Rule: expect one treesize message per tier entered, not one per edit
Reason: the tier already announced is stored between runs, so staying inside it says nothing

Rule: expect a tier to speak again after the tree drops below it and climbs back
Reason: the stored tier follows the tree down, so committing the work rearms every tier above what is left

Rule: expect `treesize` to exit 0 and print nothing when git is missing, the directory is not a repository, the config is bad, or the payload is malformed
Reason: a warning that broke the edit it followed would cost more than the advice is worth

Rule: expect the full treesize message on stdout under `hookSpecificOutput.additionalContext` with `hookEventName` set to `PostToolUse`, a one-line `systemMessage` beside it, and the same message on stderr
Reason: `additionalContext` is the documented field that reaches the model, `systemMessage` is shown only to the user, and stderr keeps the tool readable when run by hand

Rule: keep the config in `config.ts`, the pure logic in the sibling modules, the IO in `commands/`, and the dispatch in `main.ts`
Reason: the pure modules test without permissions while the command modules own the only calls to git and the only file access
