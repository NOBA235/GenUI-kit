/**
 * Deterministic YAML and HCL emitters for the CMOS IaC compiler.
 *
 * YAML: strings are always JSON-quoted (JSON is valid YAML 1.2), so no value can change type
 * or break indentation. HCL: literal strings escape `"`, `\`, `${` and `%{`; `tpl()` marks
 * strings that intentionally contain Terraform interpolation.
 */

/* ═══════════════════════════ YAML ═══════════════════════════ */

/** A multi-line literal block scalar (`key: |`). */
export class YamlBlock {
  constructor(readonly text: string) {}
}

export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlBlock
  | readonly YamlValue[]
  | { readonly [key: string]: YamlValue | undefined };

function yamlScalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`Non-finite YAML number: ${value}`);
    return String(value);
  }
  return value ? "true" : "false";
}

function yamlKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.\-]*$/.test(key) ? key : JSON.stringify(key);
}

function isYamlObject(value: YamlValue): value is { readonly [key: string]: YamlValue | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof YamlBlock);
}

function emitYamlEntries(obj: { readonly [key: string]: YamlValue | undefined }, indent: number, out: string[]): void {
  const pad = " ".repeat(indent);
  for (const [rawKey, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const key = yamlKey(rawKey);
    if (value instanceof YamlBlock) {
      out.push(`${pad}${key}: |`);
      for (const line of value.text.replace(/\n$/, "").split("\n")) {
        out.push(line.length > 0 ? `${pad}  ${line}` : "");
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        out.push(`${pad}${key}: []`);
      } else {
        out.push(`${pad}${key}:`);
        emitYamlList(value, indent + 2, out);
      }
    } else if (isYamlObject(value)) {
      const keys = Object.keys(value).filter((k) => value[k] !== undefined);
      if (keys.length === 0) {
        out.push(`${pad}${key}: {}`);
      } else {
        out.push(`${pad}${key}:`);
        emitYamlEntries(value, indent + 2, out);
      }
    } else {
      out.push(`${pad}${key}: ${yamlScalar(value as string | number | boolean | null)}`);
    }
  }
}

function emitYamlList(list: readonly YamlValue[], indent: number, out: string[]): void {
  const pad = " ".repeat(indent);
  for (const item of list) {
    if (isYamlObject(item)) {
      const nested: string[] = [];
      emitYamlEntries(item, indent + 2, nested);
      if (nested.length === 0) {
        out.push(`${pad}- {}`);
        continue;
      }
      nested[0] = `${pad}- ${nested[0]!.slice(indent + 2)}`;
      out.push(...nested);
    } else if (Array.isArray(item) || item instanceof YamlBlock) {
      throw new TypeError("Nested YAML lists and block scalars inside lists are not supported.");
    } else {
      out.push(`${pad}- ${yamlScalar(item as string | number | boolean | null)}`);
    }
  }
}

export function emitYamlDocument(header: readonly string[], doc: { readonly [key: string]: YamlValue | undefined }): string {
  const out = header.map((line) => (line.length > 0 ? `# ${line}` : "#"));
  emitYamlEntries(doc, 0, out);
  return `${out.join("\n")}\n`;
}

/** Escape `$` so Docker Compose passes it to the container instead of interpolating it. */
export function composeLiteral(text: string): string {
  return text.replace(/\$/g, "$$$$");
}

/* ═══════════════════════════ HCL ═══════════════════════════ */

export interface HclRaw {
  readonly kind: "raw";
  readonly text: string;
}
export interface HclTemplate {
  readonly kind: "tpl";
  readonly text: string;
}
export interface HclCall {
  readonly kind: "call";
  readonly name: string;
  readonly arg: HclValue;
}
export type HclValue =
  | string
  | number
  | boolean
  | HclRaw
  | HclTemplate
  | HclCall
  | readonly HclValue[]
  | { readonly [key: string]: HclValue | undefined };

export interface HclAttr {
  readonly kind: "attr";
  readonly name: string;
  readonly value: HclValue;
}
export interface HclBlock {
  readonly kind: "block";
  readonly type: string;
  readonly labels: readonly string[];
  readonly body: readonly HclItem[];
}
export interface HclComment {
  readonly kind: "comment";
  readonly text: string;
}
export type HclItem = HclAttr | HclBlock | HclComment;

/** Raw HCL expression (references, function calls, type keywords). */
export const raw = (text: string): HclRaw => ({ kind: "raw", text });
/** Quoted string that intentionally contains `${...}` interpolation. */
export const tpl = (text: string): HclTemplate => ({ kind: "tpl", text });
export const call = (name: string, arg: HclValue): HclCall => ({ kind: "call", name, arg });
export const attr = (name: string, value: HclValue): HclAttr => ({ kind: "attr", name, value });
export const block = (type: string, labels: readonly string[], body: readonly (HclItem | null | false)[]): HclBlock => ({
  kind: "block",
  type,
  labels,
  body: body.filter((item): item is HclItem => Boolean(item)),
});
export const comment = (text: string): HclComment => ({ kind: "comment", text });

function escapeHclBase(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function hclString(text: string): string {
  // In String.replace, "$$" is a literal "$": "$$$${" emits "$${".
  return `"${escapeHclBase(text).replace(/\$\{/g, "$$$${").replace(/%\{/g, "%%{")}"`;
}

function isHclObject(value: HclValue): value is { readonly [key: string]: HclValue | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !("kind" in value);
}

function hclKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : hclString(key);
}

function emitHclValue(value: HclValue, indent: number): string {
  if (typeof value === "string") return hclString(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`Non-finite HCL number: ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const items = value as readonly HclValue[];
    if (items.length === 0) return "[]";
    const simple = items.every((v) => typeof v !== "object" || ("kind" in v && v.kind !== "call"));
    if (simple) return `[${items.map((v) => emitHclValue(v, indent)).join(", ")}]`;
    const pad = " ".repeat(indent + 2);
    return `[\n${items.map((v) => `${pad}${emitHclValue(v, indent + 2)},`).join("\n")}\n${" ".repeat(indent)}]`;
  }
  if (isHclObject(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined) as [string, HclValue][];
    if (entries.length === 0) return "{}";
    const pad = " ".repeat(indent + 2);
    const width = Math.max(...entries.map(([k]) => hclKey(k).length));
    const lines = entries.map(([k, v]) => `${pad}${hclKey(k).padEnd(width)} = ${emitHclValue(v, indent + 2)}`);
    return `{\n${lines.join("\n")}\n${" ".repeat(indent)}}`;
  }
  const special = value as HclRaw | HclTemplate | HclCall;
  if (special.kind === "raw") return special.text;
  if (special.kind === "tpl") return `"${escapeHclBase(special.text)}"`;
  return `${special.name}(${emitHclValue(special.arg, indent)})`;
}

function emitHclItems(items: readonly HclItem[], indent: number, out: string[]): void {
  const pad = " ".repeat(indent);
  let i = 0;
  while (i < items.length) {
    const item = items[i]!;
    if (item.kind === "comment") {
      out.push(`${pad}# ${item.text}`.trimEnd());
      i += 1;
    } else if (item.kind === "attr") {
      // Align `=` across a run of consecutive attributes, like `terraform fmt`.
      let j = i;
      while (j < items.length && items[j]!.kind === "attr") j += 1;
      const run = items.slice(i, j) as HclAttr[];
      const width = Math.max(...run.map((a) => a.name.length));
      for (const a of run) out.push(`${pad}${a.name.padEnd(width)} = ${emitHclValue(a.value, indent)}`);
      i = j;
    } else {
      const labels = item.labels.map((l) => ` ${hclString(l)}`).join("");
      if (item.body.length === 0) {
        out.push(`${pad}${item.type}${labels} {}`);
      } else {
        out.push(`${pad}${item.type}${labels} {`);
        emitHclItems(item.body, indent + 2, out);
        out.push(`${pad}}`);
      }
      i += 1;
    }
    const next = items[i];
    if (next && (item.kind === "block" || next.kind === "block") && indent === 0) out.push("");
  }
}

export function emitHclDocument(header: readonly string[], items: readonly HclItem[]): string {
  const out = header.map((line) => (line.length > 0 ? `# ${line}` : "#"));
  if (out.length > 0) out.push("");
  emitHclItems(items, 0, out);
  return `${out.join("\n")}\n`;
}
