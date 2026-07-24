import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const appDir = path.dirname(url.fileURLToPath(import.meta.url));
const srcDir = path.join(appDir, "src");

const templatePath = path.join(srcDir, "template.html");
const stylesPath = path.join(srcDir, "styles.css");
const partsDir = path.join(srcDir, "parts");
const outputPath = path.join(appDir, "index.html");

function indentBlock(source, spaces) {
  const prefix = " ".repeat(spaces);
  return source
    .replace(/\s+$/u, "")
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : ""))
    .join("\n");
}

function buildNotebookStudio() {
  const template = fs.readFileSync(templatePath, "utf8");
  const styles = fs.readFileSync(stylesPath, "utf8");
  const app = [
    "(function () {",
    ...fs.readdirSync(partsDir)
      .filter((file) => file.endsWith(".ts"))
      .sort()
      .map((file) => indentBlock(fs.readFileSync(path.join(partsDir, file), "utf8"), 4)),
    "}());",
  ].join("\n\n");
  const html = template
    .replace("/*__NOTEBOOK_PILOT_CSS__*/", indentBlock(styles, 8))
    .replace("/*__NOTEBOOK_PILOT_APP__*/", indentBlock(app, 8));

  fs.writeFileSync(outputPath, html);
}

buildNotebookStudio();
