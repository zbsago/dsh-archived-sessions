// Build the client half of dsh-archived-sessions into the DeepSeek Harness
// client-module bundle format:
//
//   window.__ModuleLoader__.load({ id: "<package-name>", factory: (require) => {...} })
//
// External specifiers (react, react-dom, @deepseek-ai/*) are left as
// `require(...)` calls — the harness client module registry resolves them at
// runtime. The esbuild CJS output references `module.exports` / `require`,
// which the loader wrapper provides.

import { buildSync } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const id = pkg.name;

const result = buildSync({
  entryPoints: [join(root, "src/client/index.jsx")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".jsx": "jsx" },
  external: [
    "react",
    "react-dom",
    "react-dom/*",
    "react/jsx-runtime",
    "@deepseek-ai/*",
  ],
  minify: false,
  sourcemap: false,
  write: false,
  logLevel: "warning",
});

const body = result.outputFiles[0].text;

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(id)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
\t\treturn module.exports;
\t}
});
`;

const out = join(root, "lib/client.js");
writeFileSync(out, wrapped);
console.log(`built ${out} (${wrapped.length} bytes)`);
