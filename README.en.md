# harness

A general-purpose coding agent harness

[한국어](README.md) · [English](README.en.md)

Manage instructions, skills, rules, and agent settings from one source repository. Adapters deliver them to coding agent runtimes such as Claude Code and Codex.

## Get started with an agent

Ask your coding agent to follow the [agent onboarding guide](src/docs/harness/guides/agent-onboarding.md) (Korean):

> Follow this repository's agent onboarding guide to install and apply the harness on this machine. Preserve my existing settings and unrelated plugin hooks. Ask me about conflicting choices, and use English for responses.

The guide covers inspecting existing configuration, selecting runtimes and skill profiles, reviewing changes, migrating links, and verifying the result.

## Documentation and response language

Most reference documents and workflows are written in Korean. This README is an English entry point; the [Korean README](README.md) provides the detailed repository overview.

The root [AGENTS.md](AGENTS.md) defaults to Korean responses. **Before linking it into your agents, adapt its language preference in your checkout or fork.** Workflow references and default profiles may also specify an output language. Review those instructions when adopting a workflow, and use a project profile where that workflow supports language overrides. An English README alone does not change agent behavior.

## Quick start

Prepare Git, Node.js 22.19 or newer, and npm's `npx`. Install the coding agent runtimes you want to use. External skill installation requires network access; additional CLI requirements and installation commands are declared in [harness.json](harness.json) under `tools`.

```bash
git clone https://github.com/rheech22/harness.git
cd harness
node scripts/build.mjs
node scripts/add-external.mjs --all
node scripts/check.mjs
```

After adapting the language preference, review the link and configuration plans. These examples select Claude Code and Codex with the `common` and `writing` skill profiles; choose the runtimes and profiles you need.

```bash
node scripts/link.mjs --profile common,writing --runtime claude,codex
node scripts/configure.mjs --runtime claude,codex
```

Apply the reviewed plans:

```bash
node scripts/link.mjs --profile common,writing --runtime claude,codex --apply
node scripts/configure.mjs --runtime claude,codex --apply
```

`link` refuses to overwrite existing paths that point elsewhere. `configure` preserves unrelated settings and plugin hooks, reports conflicts, and backs up changes. Existing settings symlinks require explicit adoption with `--adopt-symlink`. The checkout can live at any location.

See [setup and local configuration](src/docs/harness/guides/setup.md) (Korean) for migration, backups, and verification. Review hook trust requirements in the runtime's adapter README before relying on hooks.

## Repository layout

```text
AGENTS.md                 Shared agent instructions
harness.json              Runtime-neutral manifest and skill profiles
src/
  docs/                   Source documents and document templates
  skills/{name}/          Skill manifests, assets, and scripts
  packages/{name}/        Standalone packages developed here
  hooks/                  Shared hook implementations
  bootstrap/              Common project initialization files
  adapters/{runtime}/     Runtime-specific configuration and delivery rules
dist/
  skills/{name}/          Generated custom skills and installed external skills
  adapters/{runtime}/     Generated commands and rules
  packages/{name}/        Versioned release snapshots
scripts/                  Build, installation, configuration, and release tools
```

Edit source files, then regenerate outputs. Commit `dist/`, but do not edit it directly.

## How it works

- **build** bundles declared documents, assets, and scripts into skills. It also generates declared runtime commands and rules, and copies skills supplied by standalone packages.
- **link** creates symlinks for shared skills, instructions, and runtime rules or commands. Skill selection comes from `harness.json` profiles; runtime destinations come from each `adapter.json`.
- **configure** applies declared JSON settings and hook registrations to local files. It tracks managed values, preserves unrelated entries, and stops on conflicting local changes. Claude settings are supported; Codex currently applies hook registrations without changing `config.toml`.
- **export** creates release snapshots under `dist/packages/`. Releases use independent `{name}-v{version}` tags.
- **check** detects generated-file drift and hand-edited release snapshots. A snapshot behind its source is reported as pending export until the next release.

Custom skills are built from this repository. External skills are fetched from upstream repositories by `scripts/add-external.mjs` using Skills CLI. Both are distributed through `dist/skills/`; installing a skill does not install its required CLI programs.

## Project configuration

Keep project-specific instructions, MCP configuration, and workflow profiles in the project. Supported workflow overrides live in `docs/profiles/{name}.md`. To initialize project configuration without overwriting existing files:

```bash
node scripts/init-project.mjs /path/to/project --runtime claude,codex
```

Authentication, sessions, caches, and runtime trust records stay local. Do not put credentials in shared configuration sources.

## Further reading

- [Principles](src/docs/harness/conventions/principles.md): source ownership and repository boundaries (Korean).
- [Skill conventions](src/docs/harness/conventions/skills.md): manifests and self-contained bundles (Korean).
- [Releases](src/docs/harness/guides/release.md): package versions, snapshots, tags, and installation commands (Korean).
- [Claude Code adapter](src/adapters/claude/README.md) and [Codex adapter](src/adapters/codex/README.md): runtime paths and verification (Korean).
- [excalibridge](src/packages/excalibridge/README.md): a standalone shared Excalidraw canvas package (English).
