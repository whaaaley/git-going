# git-going

Hook commands for git and Claude Code.

## Docs

- [Git Hooks](https://github.com/whaaaley/git-going/blob/main/docs/git-hooks.md) - the `core.hooksPath` check, the three hook files, and what each command exits with
- [Claude Code Hook](https://github.com/whaaaley/git-going/blob/main/docs/claude-code.md) - the `.claude/settings.json` entry, the state file, and when a tier is announced
- [Config](https://github.com/whaaaley/git-going/blob/main/docs/config.md) - every `git-going.json` key, its default, the commit subject rules, and what a bad value does
- [API](https://github.com/whaaaley/git-going/blob/main/docs/api.md) - the subpath exports, for reusing the rules outside the CLI

## Commands

| Subcommand | Runs from | What it does |
| --- | --- | --- |
| `uncommitted` | the `post-commit` and `post-rewrite` git hooks | counts tracked changes still in the working tree and warns past a threshold |
| `validate` | the `commit-msg` git hook | validates a commit subject and fails the commit when it does not pass |
| `treesize` | a Claude Code `PostToolUse` hook | tells a coding agent to commit once the working tree crosses a tier |

## Install

```sh
deno install -g --allow-run=git --allow-read --allow-write jsr:@whaaaley/git-going
```

The permissions are baked into the shim at install time, so a hook script passes no flags of its own.

## Runtimes

The subpath exports `./validator`, `./check`, `./tier`, and `./config` are verified on Node 24.19.0, Node 26.7.0, and Bun 1.3.14, with all 138 tests passing under each.

The `.` entrypoint is Deno only.
It reads `Deno.args`, runs git through `Deno.Command`, and exits through `Deno.exit`, so the CLI does not run under Node or Bun.

`loadConfig` and `findConfigPath` read the filesystem and are Deno only, though importing `./config` works anywhere.

Run `deno task runtimes` to reproduce it.
