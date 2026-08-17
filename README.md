# git-going

Hook commands for git and Claude Code.

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

## Docs

- [Git Hooks](docs/git-hooks.md) -- the `core.hooksPath` check, the three hook files, and what each command exits with
- [Claude Code Hook](docs/claude-code.md) -- the `.claude/settings.json` entry, the state file, and when a tier is announced
- [Config](docs/config.md) -- every `git-going.json` key, its default, the commit subject rules, and what a bad value does
- [API](docs/api.md) -- the subpath exports, for reusing the rules outside the CLI
