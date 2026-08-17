# git-going

A command line utility that checks the state of a repository and reports what it finds.
You install it once and call it from hooks in any number of projects.

It has three subcommands.

| Subcommand | Runs from | What it does |
| --- | --- | --- |
| `uncommitted` | the `post-commit` and `post-rewrite` git hooks | counts tracked changes still in the working tree and warns past a threshold |
| `commit` | the `commit-msg` git hook | validates a conventional commit subject and fails the commit when it does not pass |
| `treesize` | a Claude Code `PostToolUse` hook | reports the working tree size to a coding agent as the tree grows |

`uncommitted` and `commit` are git hooks.
`treesize` is not, and is registered in `.claude/settings.json` instead.
It exists because an agent can work for an hour without committing anything, and no git hook fires when git is never used.
It shares its counting and its thresholds with `uncommitted`, which is why it lives on the same binary.

## Install

```sh
deno install -g --allow-run=git --allow-read --allow-write jsr:@whaaaley/git-going
```

The permissions are baked into the shim that `deno install -g` writes, at install time.
A hook script that calls `git-going` therefore passes no flags of its own.

`--allow-run=git` runs `git diff` to count the working tree.
`--allow-read` reads the commit message file, `git-going.json`, and the treesize state file.
`--allow-write` writes the treesize state file.

Check the install with:

```sh
git-going --version
git-going --help
```

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
git-going commit --file "$1"
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

`commit` exits 1 when the subject does not pass, which fails the commit.
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

A list replaces the default rather than adding to it.
An empty `commit.scopes` accepts any scope, so a project that does not track scopes leaves it empty.
A key that is not one of these, or a value of the wrong type, is an error naming the key.

`uncommitted.files` and `uncommitted.lines` trip the warning independently.
Either count reaching its threshold on its own is enough.
The changed-line count is insertions plus deletions, because a rewritten line costs both.

The `treesize` tiers are ordered from smallest to largest, and the last tier a tree reaches is the one that describes it.
A tier is announced once per session, and speaks again after the tree drops below it and climbs back.

## Wiring it with an agent

An agent can do the setup above. The steps are:

1. Run `git config core.hooksPath` and report what it prints.
2. If it prints a path, append the `git-going` lines to the hook files already in that directory. If it prints nothing, create `.githooks`, set `core.hooksPath` to it, and write the three hook files.
3. `chmod +x` the hook files.
4. Merge the `PostToolUse` entry into `.claude/settings.json`, creating the file if it does not exist.
5. Add `.claude/treesize.state.json` to `.gitignore`.
6. Write a `git-going.json` only if the project wants values other than the defaults.

Step 2 is the one that needs the check first.
An agent that sets `core.hooksPath` without looking will disable hooks the project already had.
