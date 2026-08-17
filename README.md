# git-going

Git hooks that watch a repository and say something when it needs attention.

Each hook is a small tool with its own thresholds and no opinion about what the project builds.

## Status

Early. The hooks exist and work, but the install story is not settled.
See Open questions below.

## The hooks

| Hook | Fires on | What it says |
| --- | --- | --- |
| `uncommitted` | post-commit, post-rewrite | how much work is still uncommitted after a commit |
| `docdrift` | post-commit | which documented things no longer match the code |
| `treesize` | a coding agent's file edits | the working tree crossed a size tier |

`uncommitted` counts tracked changes against the last commit and warns past a file or line threshold.
It answers the case where one thing is committed and twenty are left behind.

`docdrift` compares a project's documentation to what the code actually exports.
It catches a documented thing that was deleted and an added thing nobody documented.

`treesize` is not a git hook.
It runs on a coding agent's edits, because an agent can work for an hour without committing anything, and no git hook fires when git is never used.
It announces once per severity tier and stays quiet until the tree shrinks.

## Why these are separate from a linter

A linter reads files and judges their contents.
These read the repository and judge its state, which is a different question and a different trigger.
Neither one belongs inside the other.

## Install

Not yet written.
The constraint that shapes it is that `core.hooksPath` accepts exactly one directory per repository, so an installer either owns that directory or composes with hooks already in it.

## Open questions

**How much of `docdrift` is general.** The idea is universal.
The current implementation reads an ESLint plugin's rule metadata, which is not.
The general form needs a way for a project to declare what its documentation should correspond to.

**Whether a project supplies its own thresholds.** Twelve files and four hundred lines suit one repository and not another.

**Whether the agent hook belongs here at all.** It solves the same problem through a different mechanism, for people running a coding agent.
That may be one product or two.

**Composing with existing hooks.** A repository that already sets `core.hooksPath` cannot simply be pointed somewhere else.
