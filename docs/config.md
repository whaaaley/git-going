# Config

Thresholds and commit rules come from a `git-going.json` in the repository root.
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

## uncommitted

`files` and `lines` are the thresholds `uncommitted` warns at.
A count reaching either one trips the warning on its own.

## commit

`types` is the set of subject types `validate` accepts.
`scopes` is the set of scopes it accepts, and an empty list accepts any scope, so a project that names none is not forced to enumerate them.
`maxLength` is the longest subject line allowed, counted over the whole first line.

## treesize

`tiers` is an ordered list, from the first tier a growing tree reaches to the last.
Each tier needs a `name` and at least one of `files` or `lines`.
A tier declaring only one threshold is reached by that count alone.

## Commit Subject Rules

`validate` checks the first line of the message and nothing else.
A subject reads as `type(scope): description`, with the scope optional.
The description starts with a lowercase letter and does not end with `.` `!` `,` `;` or `:`.
The type must be in `commit.types`, and the scope must be in `commit.scopes` when that list is non-empty.
The whole subject must fit within `commit.maxLength`.

A type is lowercase letters only.
A scope is lowercase letters and dashes only.

These defaults follow [Conventional Commits](https://www.conventionalcommits.org) with one deliberate deviation.
The spec allows a `!` breaking-change marker, as in `feat!:` or `feat(scope)!:`, and `validate` rejects it.
Record a breaking change in a `BREAKING CHANGE:` footer in the commit body instead.
The marker is only recognized in the header, so a `!` inside the description is left alone.

`maxLength` is a git convention that the spec does not set.

## Invalid Config

A config value the tool cannot use is an error naming the offending key, rather than a silently ignored setting.
How that error surfaces depends on the command.
`validate` fails, since the rules it was asked to enforce are unknown.
`uncommitted` prints the error and exits 0, and `treesize` stays silent, because neither may cost the work that triggered it.

The rejected cases:

- An unknown key at any level, including a misspelled tier field.
- A `commit.types` or `commit.scopes` entry the subject pattern could never match, such as a type with an uppercase letter or a scope with a space. Left to be discovered later, such an entry reads as a confusing format failure on a commit that should have passed.
- A `uncommitted.files`, `uncommitted.lines`, or `commit.maxLength` that is not a whole number of at least 1. A threshold of zero is reached by every working tree, including an empty one, and stops being a threshold.
- A `treesize` tier declaring neither `files` nor `lines`, which no working tree could ever reach.
- A `treesize` tier easier to reach than the tier before it. The last tier reached is the one announced, so an out-of-order tier would speak in place of the one that should have.
- A `git-going.json` that is not valid JSON, or whose top level is not an object.

No maximum is imposed on a threshold, because a deliberately unreachable ceiling is a legitimate way to turn one count off.

## Related Docs

- [Git Hooks](git-hooks.md) -- wiring `uncommitted` and `validate`
- [Claude Code Hook](claude-code.md) -- wiring `treesize`
