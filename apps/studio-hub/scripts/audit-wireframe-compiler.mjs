#!/usr/bin/env node
// Static code-path audit for the Wireframe Architect compiler (Phase 5).
//
// Bundles ONLY `compileExcalidrawToGenUI` (plus `createVerifiedCatalog`, whose
// `validateFull` the compiler calls at runtime) with Rollup tree-shaking, then:
//   1. lists every module that contributes code to that bundle, and
//   2. scans the bundled code for network / model-API / dynamic-import /
//      clock / randomness tokens.
// Exit code 0 only when no forbidden token is found.
//
// Usage: node apps/studio-hub/scripts/audit-wireframe-compiler.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const compilerPath = path.resolve(here, "../src/lib/excalidraw-compiler.ts").replaceAll("\\", "/");
const ENTRY_ID = "\0wireframe-compile-entry";

const result = await build({
  root: path.resolve(here, ".."),
  configFile: false,
  logLevel: "silent",
  plugins: [
    {
      name: "wireframe-compile-entry",
      enforce: "pre",
      resolveId: (id) =>
        id === "wireframe-compile-entry" ||
        id.endsWith("/wireframe-compile-entry") ||
        id.endsWith("\\wireframe-compile-entry")
          ? ENTRY_ID
          : null,
      load: (id) =>
        id === ENTRY_ID
          ? `export { compileExcalidrawToGenUI } from "${compilerPath}";\n` +
            `export { createVerifiedCatalog } from "@genui-studio/core";\n`
          : null,
    },
  ],
  build: {
    write: false,
    minify: false,
    target: "esnext",
    lib: { entry: "wireframe-compile-entry", formats: ["es"], fileName: "compile" },
    rollupOptions: { treeshake: { moduleSideEffects: false } },
  },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
const chunks = outputs.filter((o) => o.type === "chunk");
if (chunks.length !== 1) {
  console.error(`Expected exactly 1 chunk (no code-split dynamic imports), got ${chunks.length}`);
  process.exit(1);
}
const chunk = chunks[0];

const rel = (id) => {
  const clean = id.replace(/^\0/, "");
  const nm = clean.lastIndexOf("node_modules/");
  if (nm >= 0) return clean.slice(nm + "node_modules/".length).replace(/^\.pnpm\/[^/]+\/node_modules\//, "");
  return path.relative(path.resolve(here, "../../.."), clean).replaceAll("\\", "/");
};

const contributing = Object.entries(chunk.modules)
  .filter(([, m]) => m.renderedLength > 0)
  .map(([id, m]) => ({ id: rel(id), bytes: m.renderedLength, code: m.code ?? "" }))
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

console.log(`Bundle: 1 chunk, ${chunk.code.length} bytes, ${contributing.length} contributing modules`);
console.log(`Static imports left in bundle: ${chunk.imports.length} | dynamic imports: ${chunk.dynamicImports.length}`);
const byPackage = new Map();
for (const m of contributing) {
  const pkg = m.id.startsWith("@") ? m.id.split("/").slice(0, 2).join("/") : m.id.split("/")[0] === "packages" || m.id.split("/")[0] === "apps" ? m.id.split("/").slice(0, 2).join("/") : m.id.split("/")[0];
  const entry = byPackage.get(pkg) ?? { files: 0, bytes: 0 };
  entry.files += 1;
  entry.bytes += m.bytes;
  byPackage.set(pkg, entry);
}
console.log("\nContributing code by package:");
for (const [pkg, { files, bytes }] of [...byPackage].sort()) {
  console.log(`  ${pkg.padEnd(34)} ${String(files).padStart(3)} files ${String(bytes).padStart(8)} bytes`);
}
console.log("\nFirst-party modules on the compile path:");
for (const m of contributing.filter((x) => !x.id.includes("/node_modules/") && !x.id.startsWith("zod") && !x.id.startsWith("@json-render"))) {
  console.log(`  ${m.id} (${m.bytes} bytes)`);
}

const FORBIDDEN = [
  ["network: fetch()", /\bfetch\s*\(/],
  ["network: XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["network: WebSocket", /\bWebSocket\b/],
  ["network: EventSource", /\bEventSource\b/],
  ["network: sendBeacon", /\bsendBeacon\b/],
  ["network: node http/https/net", /["'](node:)?(http|https|net|tls|dgram)["']/],
  ["module loading: dynamic import()", /\bimport\s*\(/],
  ["module loading: require()", /\brequire\s*\(/],
  ["model API host/SDK", /generativelanguage|googleapis|openai|anthropic|api\.mistral|cohere\.ai|@google\/genai|@ai-sdk|huggingface/i],
  ["credentials", /\bapi[_-]?key\b|\bAuthorization\b|\bBearer\s/i],
  ["randomness: Math.random", /\bMath\.random\b/],
  ["randomness: crypto", /\bcrypto\.(getRandomValues|randomUUID|randomBytes)\b/],
  ["clock: Date.now / new Date()", /\bDate\.now\b|\bnew Date\s*\(\s*\)/],
  ["clock: performance.now", /\bperformance\.now\b/],
  ["locale-dependent tie-break in compiler: localeCompare", /\blocaleCompare\b/, (m) => m.id.endsWith("excalidraw-compiler.ts")],
];

let violations = 0;
console.log("\nForbidden-token scan of bundled compile-path code:");
for (const [label, re, filterFn] of FORBIDDEN) {
  const pool = filterFn ? contributing.filter(filterFn) : contributing;
  const hits = pool.filter((m) => re.test(m.code)).map((m) => m.id);
  if (hits.length) violations += hits.length;
  console.log(`  ${hits.length ? "FOUND" : "none "}  ${label}${hits.length ? `  <- ${hits.join(", ")}` : ""}`);
}

console.log(violations === 0 ? "\nAUDIT_OK: zero forbidden tokens on the compile path" : `\nAUDIT_FAIL: ${violations} forbidden token hit(s)`);
process.exit(violations === 0 ? 0 : 1);
