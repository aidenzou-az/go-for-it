# go-for-it

Reusable repo-local workflow kernel for AI-assisted software development.

`go-for-it` provides the `yxg` CLI, `.yxg/` artifact templates, validator rules, git observe/suggest support, and a Codex repo-local plugin adapter. The goal is to keep project intent, work contracts, reviews, and handoff context durable inside the repository instead of relying on chat history.

## What It Provides

- A `.yxg/` project memory model with work units, reviews, baseline knowledge, and local runtime state.
- A `yxg` CLI for `init`, `import`, `plan`, `execute`, `review`, `resume`, `cleanup`, and validation flows.
- Codex intent skills such as `$yxg:yxg-import`, `$yxg:yxg-plan`, `$yxg:yxg-do`, `$yxg:yxg-monitor`, and `$yxg:yxg-finish`.
- Git observe/suggest behavior that reports branch mismatch and dirty-worktree risk without implicitly running git writes.
- Import support for understanding existing repositories before planning new work.

## Local Setup

Requirements:

- Node.js 20+
- Git, if you want branch and dirty-worktree suggestions

Use the local CLI from this repository:

```bash
npm link
yxg --help
```

Run tests:

```bash
npm test
```

## Use In Another Repository

For an existing project, start with import:

```text
$yxg:yxg-import
```

For a new or greenfield project, start with init:

```text
$yxg:yxg-init
```

To install the Codex adapter into another repository:

```bash
npm run install:codex-adapter -- /abs/path/to/target-repo
npm run verify:codex-adapter -- /abs/path/to/target-repo
```

Then manually enable or refresh the local `yxg` plugin inside Codex for that target repository.

## Common Codex Flow

```text
$yxg:yxg-import
$yxg:yxg-plan 增加一个具体功能
$yxg:yxg-do
$yxg:yxg-monitor
$yxg:yxg-finish
```

`yxg-do` continues the current recommended work. If there is no active work but `.yxg/ROADMAP.md` names a planned next work, the Codex skill should use that roadmap item as the next intended task without asking the user to run low-level ready commands.

Use `$yxg:yxg-monitor` when implementation is complete enough to observe, but the work still needs external evidence before review. Typical examples include soak tests, scheduled data collection, production observation windows, or acceptance checks that need time to run. Monitoring work remains open for evidence collection, but it should not block `$yxg:yxg-do` from continuing the next actionable work when one exists.

## Key Docs

- [Framework spec](docs/FRAMEWORK-SPEC.md)
- [Workflow commands](docs/WORKFLOW-COMMANDS.md)
- [Artifact schemas](docs/ARTIFACT-SCHEMAS.md)
- [Git integration](docs/GIT-INTEGRATION-SPEC.md)
- [Codex adapter](docs/CODEX-ADAPTER-SPEC.md)
- [Dogfood checklist](docs/CODEX-DOGFOOD-CHECKLIST.md)
