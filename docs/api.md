# API

The decision logic behind each command is published as a subpath export, so a project can reuse it without shelling out to the CLI.
Each module is pure. Reading git, reading the config file, and writing state all live in the commands, not here.

Wiring hooks needs none of this. It is for building something else on the same rules.

## ./validator

`validate(message, config)` returns an array of `Failure` objects, one per broken rule, and an empty array when the subject passes.
`config` is the `commit` section of a [config](config.md).
`subjectOf(message)` returns the trimmed first line, which is the part `validate` checks.

```ts
import { validate } from '@whaaaley/git-going/validator'
import { defaults } from '@whaaaley/git-going/config'

const failures = validate('feat: add a thing', defaults.commit)
```

## ./check

`check(changes, thresholds)` returns the warning lines for a working tree, and an empty array when neither threshold is reached.
`changes` is a `Changes` object of `fileCount`, `insertions`, and `deletions`.

## ./tier

`tierFor(changes, tiers)` returns the highest tier a tree has reached, or `null`.
`decide(changes, lastAnnounced, tiers)` pairs that with the announcement history, returning the announcement to print, if any, and the tier to remember next.

## ./config

`loadConfig(start)` walks up from a directory to find `git-going.json` and returns a full config, falling back to `defaults` when no file is found.
`parse(raw)` and `merge(raw)` do the same from a JSON string or an already-parsed value.
All three throw `ConfigError` on a value the tool cannot use, described in [Config](config.md).
`defaults` is the config used when no file is present.

## Related Docs

- [Config](config.md) - the shape these modules read and what makes a value invalid
