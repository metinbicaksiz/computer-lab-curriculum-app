// Copies the editor, Python runtime and Blockly media into public/ so the app
// works with no internet connection. Runs automatically after `npm install`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// npm workspaces hoist packages to the root node_modules, so check both.
const pkgDir = (name) =>
  [join(import.meta.dirname, "..", "node_modules", name), join(import.meta.dirname, "..", "..", "node_modules", name)]
    .find((d) => existsSync(join(d, "package.json"))) ?? name;
const pub = join(import.meta.dirname, "..", "public");

const copies = [
  [join(pkgDir("monaco-editor"), "min", "vs"), join(pub, "monaco", "vs")],
  [pkgDir("pyodide"), join(pub, "pyodide")],
  [join(pkgDir("blockly"), "media"), join(pub, "blockly-media")],
];
for (const [from, to] of copies) {
  if (!existsSync(from)) {
    console.warn(`copy-assets: missing ${from}`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`copy-assets: ${to}`);
}
