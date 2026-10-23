# Skill Forge for DeepSeek Harness

**Distill a conversation into a reusable `SKILL.md`, so the next similar question hits a skill instead of re-deriving the answer.**

A DeepSeek Harness (DSH) plugin: four model-facing tools plus a Web GUI panel.

<p align="center">
  <img src="https://raw.githubusercontent.com/chaonimadesazhi/dsh-skill-forge/main/docs/screenshots/01-library-light.jpg" alt="Skill library" width="820">
</p>

---

## The problem

Ask the same class of question twice and the model re-derives the answer: re-reads context, re-tries the dead ends, re-builds the conclusion. That costs the same tokens again, and the result stays trapped in the old conversation.

Skill Forge does one thing: **compress a workflow that already worked into a skill file at the end of the conversation**. DSH's skill catalog then surfaces it on a related request, and the model loads a few dozen instruction lines instead of re-thinking hundreds of reasoning lines.

Skills are written to `~/.dsh/skills/<name>/SKILL.md` — the official DSH skill root, usable by any preset that loads skills.

---

## Two ways to use it

### 1. Let the agent do it (recommended, zero setup)

Just ask in natural language:

> Save that ffmpeg troubleshooting flow as a skill

The model then calls:

| Tool | What it does |
|---|---|
| `skill_forge_context` | Bounded digest of the current (or a named) session — 10 turns / 16k chars by default, keeping the newest tail |
| `skill_forge_save` | Writes `~/.dsh/skills/<name>/SKILL.md`; refuses same-name by default, keeps a `.bak` on overwrite |
| `skill_forge_list` | Lists skills this plugin wrote, with path, size and mtime |
| `skill_forge_delete` | Moves into `.trash` (recoverable); **only skills this plugin wrote** |

The catalog hot-reloads after a write, so the new skill can be loaded by the `skill` tool in the same session.

### 2. Forge it in the panel (Web GUI)

A sidebar icon (below the task board) opens two tabs:

- **Library** — search, click a row to preview, delete into `.trash`. The preview renders Markdown with a raw-source toggle.
- **Forge** — pick a recent session or paste text; leave name/description blank to let the AI fill them; "Distill with AI" produces a draft → review → save.

<p align="center">
  <img src="https://raw.githubusercontent.com/chaonimadesazhi/dsh-skill-forge/main/docs/screenshots/03-forge-light.jpg" alt="Forge tab" width="820">
</p>

Distillation needs both the `llm` and `agentDefaultModel` host services. When either is missing the route answers **503 `llm-unavailable`**, and the panel points you at path 1 or a manually written draft.

---

## Install

### A. From npm (after publishing)

```sh
dsh plugin --profile web add dsh-skill-forge
```

### B. From GitHub (local link)

```sh
git clone https://github.com/chaonimadesazhi/dsh-skill-forge.git
dsh plugin --profile web add link:./dsh-skill-forge
```

### C. Desktop client

The desktop client owns its `desktop` profile exclusively; the CLI refuses to write it (`profile "desktop" is managed exclusively by the Electron application`).

Use the app instead: **Settings → Plugins → install from local directory**, pointing at the cloned folder.

Restart DSH afterwards; the Skill Forge icon appearing in the sidebar is the success signal.

---

## Configuration

Edit the `skill-forge` row in your profile's `cordis.patch.yml`:

```yaml
- id: skill-forge
  name: dsh-skill-forge
  config:
    maxCaptureChars: 20000   # max context chars per panel distillation
    toolCaptureChars: 16000  # default cap for skill_forge_context
```

---

## What a forged skill looks like

```markdown
---
name: eac-ffmpeg-path-fix
description: "Fix EAC render jobs failing with ffmpeg not found because the binary was not on PATH."
whenToUse: "EAC job submission or render fails with ffmpeg not found in the log"
metadata:
  forge: "skill-forge"
  version: 1
---

## When to use
## Steps
## Checklist
## Anti-patterns
```

`metadata.forge` is this plugin's ownership marker: `skill_forge_list` only lists skills carrying it, and `skill_forge_delete` only deletes those. **Hand-written and third-party skills are never touched.**

---

## Safety boundaries

- HTTP routes accept **loopback + same-origin** requests only; cross-site and LAN clients get 403. Request bodies are capped at 1 MiB.
- Writes go to `~/.dsh/skills` only — never the DSH installation, never the profile manifest or patch.
- No session events are appended; conversation text is read through `sessionQuery`.
- Distillation never writes to disk. Only pressing "Save" writes, and overwriting asks first and keeps a `.bak`.

---

## Known limitations

- Catalog hot-reload relies on DSH's file watcher: usually immediate, but not guaranteed to be sub-second.
- AI distillation requires a usable default model; without one, use path 1 or write the draft yourself.
- Skill names must be kebab-case — that is DSH's official skill grammar.
- Manages `~/.dsh/skills` only, not project-level `.dsh/skills`.
- The panel centres at max 880px, so very wide windows leave generous side gutters.

---

## Development

Plain ESM, no build step, no runtime dependencies (only `node:` built-ins plus `react` on the browser side).

```sh
node --check index.js
node --check client.js
```

Two local suites were run before release: 61 structural checks and 73 behavioural checks (against a throwaway `DSH_HOME`, never your real skills). See [docs/维护者手册.md](docs/维护者手册.md) (Chinese).

---

## Screenshots

| Markdown preview | Draft review |
|---|---|
| <img src="https://raw.githubusercontent.com/chaonimadesazhi/dsh-skill-forge/main/docs/screenshots/02-preview-markdown.jpg" width="400"> | <img src="https://raw.githubusercontent.com/chaonimadesazhi/dsh-skill-forge/main/docs/screenshots/04-draft.jpg" width="400"> |

Dark theme:

<p align="center">
  <img src="https://raw.githubusercontent.com/chaonimadesazhi/dsh-skill-forge/main/docs/screenshots/05-library-dark.jpg" alt="Dark theme" width="820">
</p>

---

## License

[MIT](LICENSE)

---

English | [中文](README.md)
