# Claude Code Hook

`treesize` is a Claude Code `PostToolUse` hook, not a git hook.
It reads a hook payload on stdin after a `Write` or `Edit` tool call and tells the coding agent to commit once the working tree crosses a size tier.

## Registration

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

The `matcher` and the command agree with each other.
`treesize` ignores any payload whose tool is not `Write` or `Edit`, so a broader matcher costs a subprocess per tool call and changes nothing else.

## What It Announces

The tree is measured the same way `uncommitted` measures it, as tracked changes between the working tree and HEAD.
The tiers and their thresholds are in [Config](config.md).

When a tier is reached, `treesize` prints a message on stdout as an `additionalContext` envelope, which is the `PostToolUse` field that reaches the model.
A shorter notice goes to the human as `systemMessage`, and the full text is repeated on stderr.

A tier is announced once. Staying inside it says nothing new, so nothing is printed until the tree reaches a higher tier.
Falling below a tier lowers the remembered tier, so climbing back into it announces it again.

`treesize` exits 0 and prints nothing on any failure, including a malformed config or an unreadable payload.
A warning must never cost the edit that triggered it.

## State File

`treesize` writes `.claude/treesize.state.json` to remember which tier it has already announced.
The file records the session id alongside the tier, so a new session starts with nothing announced.

Add it to `.gitignore`:

```
.claude/treesize.state.json
```

A state file that cannot be written only costs the next run its memory of the current tier.

## Related Docs

- [Config](config.md) - the tier thresholds and what a bad value does
- [Git Hooks](git-hooks.md) - `uncommitted` and `validate`, which are git hooks
