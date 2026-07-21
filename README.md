# Onepage Webapps

**Onepage Webapps** is a collection of small, self-contained browser apps. Each app is meant to be understandable as a single page, easy to run locally, and simple enough to copy, modify, or learn from.

The constraint is deliberate: plain HTML, CSS, and JavaScript first. Some apps use CDN libraries when they make the app materially better, but there is no shared build system, backend, package manager requirement, or framework ceremony. Open a folder, open `index.html`, and the app should explain itself by working.

## Contents

- [Why this exists](#why-this-exists)
- [Status](#status)
- [Apps](#apps)
- [Running an app](#running-an-app)
- [Repository layout](#repository-layout)
- [App metadata](#app-metadata)
- [Adding a new app](#adding-a-new-app)
- [Development notes](#development-notes)
- [Public workflow files](#public-workflow-files)
- [License](#license)

## Why this exists

Small tools have a nice property: they can stay close to the problem that created them. A baby log, a prompt stash, a writing helper, a music sketchpad, a map experiment; none of these need to become products before they are useful.

This repository is a place for those tools to live in public. The goal is not one polished mega-app. The goal is a shelf of focused web apps that are:

- easy to inspect
- easy to run
- easy to remix
- mostly dependency-light
- organized enough to grow without becoming a junk drawer

## Status

This is a living collection. Some apps are stable utilities, some are experiments, and some are preserved drafts. Each app declares its status in `app.yml` so future indexes, galleries, or deployment scripts can decide what to show.

The repo structure recently moved from one flat `.html` file per app to one folder per app. That makes it easier to add metadata, thumbnails, tests, and app-specific assets without losing the one-page spirit.

## Apps

| App | Category | Status | Path |
| --- | --- | --- | --- |
| BabyLog | Family | stable | `family/babylog/` |
| LLM Toolbox | Productivity | stable | `productivity/llm-toolbox/` |
| LocalAI Lead Responder | Productivity | stable | `productivity/localai-lead-responder/` |
| Prompt Stash | Productivity | stable | `productivity/prompt-stash/` |
| Todo List | Productivity | stable | `productivity/todo-list/` |
| PodCut Studio | Audio | stable | `audio/podcut/` |
| Qraft | Writing | experimental | `writing/qraft/` |
| Voice Refiner | Writing | stable | `writing/voice-refiner/` |
| Writing Coach | Writing | stable | `writing/writing-coach/` |
| AetherDepth | Lab | experimental | `lab/aetherdepth/` |
| AI Video Generator | Lab | experimental | `lab/ai-video-generator/` |
| Artemis II | Lab | experimental | `lab/artemis-ii/` |
| Partial Derivative Slices Demo | Lab | experimental | `lab/calculus-partial-derivatives/` |
| Song Memory Atlas | Lab | experimental | `lab/song-memory-atlas/` |
| Stave | Lab | experimental | `lab/stave/` |

Draft and backup variants may also exist when they are useful to preserve development history, but stable apps should be the ones linked from public indexes.

## Running an app

Clone the repo:

```sh
git clone https://github.com/feddernico/onepage-webapps.git
cd onepage-webapps
```

Then either open an app's `index.html` directly in a browser, or run a tiny static server:

```sh
python3 -m http.server
```

Open one of the app folders:

```text
http://localhost:8000/productivity/prompt-stash/
http://localhost:8000/family/babylog/
http://localhost:8000/writing/voice-refiner/
```

Some browser APIs are happier over `localhost` than `file://`, so the static server is the safest default.

## Repository layout

```text
onepage-webapps/
  common_resources/
    js/
  productivity/
    prompt-stash/
      index.html
      app.yml
      thumbnail.png
  writing/
    voice-refiner/
      index.html
      app.yml
      thumbnail.png
  family/
    babylog/
      index.html
      app.yml
      thumbnail.png
  lab/
    newest-weird-thing/
      index.html
      app.yml
```

`common_resources/` is for shared JavaScript, CSS, images, or data that more than one app genuinely uses. Everything app-specific should stay inside that app's folder.

## App metadata

Every app should include an `app.yml` file beside `index.html`:

```yaml
title: BabyLog
slug: babylog
category: Family
status: stable
description: Tiny tracker for baby logs.
featured: true
date: 2026-07-11
```

Use these fields consistently:

- `title`: display name
- `slug`: URL-safe app id, matching the folder name when possible
- `category`: top-level category folder, title-cased
- `status`: `stable`, `experimental`, or `draft`
- `description`: one short sentence
- `featured`: whether the app should appear prominently in future indexes
- `date`: date the app or metadata entry was last meaningfully shaped

Add `thumbnail.png` when an app is ready to be shown in a gallery.

## Adding a new app

1. Pick a category: `productivity`, `writing`, `family`, or `lab`.
2. Create a slugged folder: `category/my-new-app/`.
3. Add `index.html`.
4. Add `app.yml`.
5. Put app-specific assets in the same folder.
6. Use `common_resources/` only for resources shared by multiple apps.

If an app grows beyond one file, that is fine. The important convention is that the folder is the app boundary and `index.html` remains the entry point.

## Development notes

- Prefer vanilla HTML, CSS, and JavaScript.
- Keep external dependencies explicit in the app file unless they are shared across apps.
- Update relative paths when moving an app between folders.
- Keep local agent/editor tooling out of commits; durable public guidance belongs in `AGENTS.md`.
- QUnit assets currently live in `qunit/` for existing tests.

## Running tests

QUnit tests are browser-based. Start a local server from the repo root:

```bash
python3 -m http.server 8000
```

Then open the PodCut audio regression test:

```text
http://127.0.0.1:8000/qunit/test/test_podcut_audio.html
```

The PodCut test loads `audio/podcut/index.html` in an iframe and exercises the real audio helpers, including RNNoise speech denoise, noise cleanup, soundcheck-style gating, music ducking, and mastering regressions. A healthy run shows 11 tests, 35 assertions, and 0 failures.

## Public workflow files

This repo includes public agent/workflow guidance:

- `AGENTS.md` for durable repo instructions
- `.github/` prompts and skills for OpenSpec-oriented workflows
- `openspec/config.yaml` for the project OpenSpec configuration

Local tool state such as `.claude/`, `.codex/`, `.opencode/`, editor workspaces, caches, and dependency folders should stay untracked.

## License

This repository is released under the [MIT License](LICENSE).
