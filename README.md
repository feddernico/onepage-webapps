# Onepage Webapps

One page webapps created using only **HTML5**, **CSS**, and **JavaScript**.

## Overview

This repository contains a collection of simple, single-page web applications built without any external frameworks or libraries. Each app is fully self-contained, demonstrating what can be achieved using just the core web technologies.

## Features

- 100% client-side: No backend required
- Pure HTML5, CSS, and JavaScript (Vanilla JS)
- Minimal dependencies
- Easy to deploy and use
- Great for learning and prototyping

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/feddernico/onepage-webapps.git
   cd onepage-webapps
   ```

2. **Run an app:**
   - Method 1: Open an app's `index.html` file in your browser, or
   - Method 2: Use a simple static server (for example, with Python):

     ```bash
     python3 -m http.server
     ```

   - Then navigate to an app folder, such as `http://localhost:8000/productivity/prompt-stash/`.

## Directory Structure

```
onepage-webapps/
├── common_resources/
│   ├── css
│   └── js
├── productivity/
│   └── prompt-stash/
│       ├── index.html
│       ├── app.yml
│       └── thumbnail.png
├── writing/
│   └── voice-refiner/
│       ├── index.html
│       ├── app.yml
│       └── thumbnail.png
├── family/
│   └── babylog/
│       ├── index.html
│       ├── app.yml
│       └── thumbnail.png
├── lab/
│   └── newest-weird-thing/
│       ├── index.html
│       └── app.yml
└── README.md
```

- `common_resources/` contains JavaScript and CSS reused across apps.
- Each app lives in its own category folder and exposes `index.html` as the entry point.
- Each app should include an `app.yml` metadata file:

  ```yaml
  title: BabyLog
  slug: babylog
  category: Family
  status: stable
  description: Tiny tracker for baby logs.
  featured: true
  date: 2026-07-11
  ```

- Add `thumbnail.png` when an app is ready to appear in galleries or indexes.

## Contributing

Contributions are welcome! If you have a cool one-page webapp idea or improvement, feel free to open a pull request.

1. Fork the repository
2. Add your app in a new folder (follow the structure)
3. Submit a PR with a short description of your app

## License

[MIT](LICENSE)

---

Let me know if you have specific apps or folders you want listed, or if you’d like more customization!
