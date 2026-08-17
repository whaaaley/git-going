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

## Wiring a project

Git allows one hooks directory per repository, named by `core.hooksPath`.
Check whether the repository already sets one before you change it.
Pointing `core.hooksPath` somewhere else silently stops the existing hooks from running, with no warning and no error.

```sh
git config core.hooksPath
```

If that prints a path, the repository already has a hooks directory.
Add the lines below to the hook files already in that directory rather than changing the setting.

If it prints nothing, create a directory and point git at it:

```sh
mkdir -p .githooks
git config core.hooksPath .githooks
```

Then write the three hook files.

`.githooks/commit-msg`:

```sh
#!/usr/bin/env bash
git-going validate --file "$1"
```

`.githooks/post-commit`:

```sh
#!/usr/bin/env bash
git-going uncommitted
```

`.githooks/post-rewrite`:

```sh
#!/usr/bin/env bash
git-going uncommitted
```

Make them executable:

```sh
chmod +x .githooks/commit-msg .githooks/post-commit .githooks/post-rewrite
```

`validate` exits 1 when the subject does not pass, which fails the commit.
`uncommitted` exits 0 whether or not it warns, because the warning is advice.

## The Claude Code hook

`treesize` is a `PostToolUse` hook, not a git hook.
Add this to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "git-going treesize",
            "timeout": 10,
            "statusMessage": "Checking uncommitted tree size"
          }
        ]
      }
    ]
  }
}
```

If `.claude/settings.json` already exists, merge this entry into the existing `hooks` object.
Replacing the file drops whatever hooks were there.

`treesize` writes `.claude/treesize.state.json` to remember which tier it has already announced this session.
Add it to `.gitignore`:

```
.claude/treesize.state.json
```

## Config

Thresholds come from a `git-going.json` in the repository root.
The file is found by walking up from the working directory.
Every field defaults, so a project with no config file works and gets the values below.

```json
{
  "uncommitted": {
    "files": 12,
    "lines": 400
  },
  "commit": {
    "types": [
      "feat",
      "fix",
      "refactor",
      "test",
      "docs",
      "style",
      "chore",
      "build",
      "ci",
      "perf",
      "revert"
    ],
    "scopes": [],
    "maxLength": 72
  },
  "treesize": {
    "tiers": [
      { "name": "notice", "files": 12, "lines": 400 },
      { "name": "warning", "files": 25, "lines": 900 },
      { "name": "urgent", "files": 40, "lines": 1500 }
    ]
  }
}
```

The `commit` defaults follow [Conventional Commits](https://www.conventionalcommits.org), with a stricter stance on breaking changes: a `!` marker is rejected in favor of a `BREAKING CHANGE:` footer, and `maxLength` is a git convention the spec does not set.
A list replaces the default rather than adding to it, and an empty `commit.scopes` accepts any scope.
Either `uncommitted` count trips the warning on its own, and the line count is insertions plus deletions.
A `treesize` tier is announced once per session, and again after the tree drops below it and climbs back.
