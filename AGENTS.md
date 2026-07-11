# Agent Guidance

This repository contains standalone, single-page web apps built with HTML, CSS, and JavaScript.

## Repository Structure

- Keep shared assets in `common_resources/`.
- Put each app in one category folder using this shape:

  ```text
  category-name/
    app-slug/
      index.html
      app.yml
      thumbnail.png
  ```

- Use `index.html` as the app entry point.
- Use `app.yml` for app metadata:

  ```yaml
  title: BabyLog
  slug: babylog
  category: Family
  status: stable
  description: Tiny tracker for baby logs.
  featured: true
  date: 2026-07-11
  ```

## Editing Guidelines

- Prefer vanilla HTML, CSS, and JavaScript unless an app already uses a specific CDN dependency.
- Keep apps self-contained where practical.
- When moving apps into folders, update relative paths to shared resources.
- Do not commit local agent/tool caches, editor state, or generated dependency folders.
