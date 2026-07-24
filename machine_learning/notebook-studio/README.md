# Notebook Studio

Notebook Studio is authored as small source files and assembled into a single-page
`index.html` artifact.

Edit these files:

- `src/template.html` for the HTML shell.
- `src/styles.css` for styles.
- `src/parts/*.ts` for application behavior. The numeric prefixes define the
  assembly order.

Build the single-file app with:

```sh
node machine_learning/notebook-studio/build.mjs
```

The build script inlines the template, CSS, and ordered TypeScript source files
into `index.html` so the app stays compatible with the one-page webapp structure.
