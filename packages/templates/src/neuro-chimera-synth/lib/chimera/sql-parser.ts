/**
 * CHIMERA // LAB — deterministic SQL parser (`lib/chimera/sql-parser.ts`).
 *
 * Hand-written tokenizer + recursive-descent parser for a documented SELECT subset (see
 * `.kiro/specs/neuro-chimera-synth/design.md` §3), and a canonical printer. No eval, no dynamic
 * code and no regex-based SQL rewriting: query rewrites transform the AST and call `printSql`.
 * Unsupported syntax throws `SqlParseError` with a character offset. `parseSql(printSql(ast))`
 * returns an AST equal to `ast`.
 */

export const MAX_SQL_LENGTH = 8192;
export const MAX_SQL_TOKENS = 2000;
export const MAX_EXPR_DEPTH = 64;

export class SqlParseError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(`${message} (at offset ${offset})`);
    this.name = "SqlParseError";
  }
}

/* ═══════════════════════════ AST ═══════════════════════════ */

export type ComparisonOp = "=" | "<>" | "<" | "<=" | ">" | ">=";
export type ArithmeticOp = "+" | "-" | "*" | "/";
/** pgvector distance operators: L2, cosine, negative inner product. */
export type DistanceOp = "<->" | "<=>" | "<#>";
export type BinaryOp = "AND" | "OR" | ComparisonOp | ArithmeticOp | DistanceOp;

export type Expr =
  | { readonly kind: "column"; readonly table: string | null; readonly name: string }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null }
  | { readonly kind: "param"; readonly index: number }
  | { readonly kind: "binary"; readonly op: BinaryOp; readonly left: Expr; readonly right: Expr }
  | { readonly kind: "not"; readonly expr: Expr }
  | { readonly kind: "neg"; readonly expr: Expr }
  | { readonly kind: "in"; readonly expr: Expr; readonly list: readonly Expr[]; readonly negated: boolean }
  | { readonly kind: "any"; readonly op: ComparisonOp; readonly expr: Expr; readonly array: Expr }
  | { readonly kind: "between"; readonly expr: Expr; readonly low: Expr; readonly high: Expr; readonly negated: boolean }
  | { readonly kind: "like"; readonly expr: Expr; readonly pattern: Expr; readonly negated: boolean }
  | { readonly kind: "isNull"; readonly expr: Expr; readonly negated: boolean }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly Expr[]; readonly star: boolean; readonly distinct: boolean };

export type SelectItem =
  | { readonly kind: "star"; readonly table: string | null }
  | { readonly kind: "expr"; readonly expr: Expr; readonly alias: string | null };

export interface TableRef {
  readonly name: string;
  readonly alias: string | null;
}

export interface JoinClause {
  readonly type: "inner" | "left";
  readonly table: TableRef;
  readonly on: Expr;
}

export interface OrderItem {
  readonly expr: Expr;
  readonly direction: "asc" | "desc";
}

export interface SelectStatement {
  readonly kind: "select";
  readonly distinct: boolean;
  readonly columns: readonly SelectItem[];
  readonly from: TableRef;
  readonly joins: readonly JoinClause[];
  readonly where: Expr | null;
  readonly groupBy: readonly Expr[];
  readonly having: Expr | null;
  readonly orderBy: readonly OrderItem[];
  readonly limit: number | null;
  readonly offset: number | null;
}

/* ═══════════════════════════ Tokenizer ═══════════════════════════ */

type TokenType = "ident" | "quotedIdent" | "keyword" | "number" | "string" | "param" | "op" | "punct" | "eof";

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly offset: number;
}

export const SQL_KEYWORDS: ReadonlySet<string> = new Set([
  "SELECT", "DISTINCT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "ANY", "BETWEEN", "LIKE", "IS", "NULL",
  "TRUE", "FALSE", "JOIN", "INNER", "LEFT", "OUTER", "ON", "GROUP", "BY", "ORDER", "ASC", "DESC", "LIMIT",
  "OFFSET", "AS", "HAVING",
]);

const THREE_CHAR_OPS = ["<->", "<=>", "<#>"];
const TWO_CHAR_OPS = ["<=", ">=", "<>", "!="];
const ONE_CHAR_OPS = "=<>+-*/";
const PUNCT = "(),.;";

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch) || ch === "$";
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

export function tokenizeSql(sql: string): Token[] {
  if (new TextEncoder().encode(sql).length > MAX_SQL_LENGTH) {
    throw new SqlParseError(`SQL exceeds ${MAX_SQL_LENGTH} bytes`, MAX_SQL_LENGTH);
  }
  const tokens: Token[] = [];
  let i = 0;
  let positional = 0;
  const push = (type: TokenType, value: string, offset: number) => {
    if (tokens.length >= MAX_SQL_TOKENS) throw new SqlParseError(`SQL exceeds ${MAX_SQL_TOKENS} tokens`, offset);
    tokens.push({ type, value, offset });
  };

  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end < 0) throw new SqlParseError("Unterminated block comment", i);
      i = end + 2;
      continue;
    }
    const start = i;
    if (isIdentStart(ch)) {
      while (i < sql.length && isIdentPart(sql[i]!)) i++;
      const word = sql.slice(start, i);
      const upper = word.toUpperCase();
      if (SQL_KEYWORDS.has(upper)) push("keyword", upper, start);
      else push("ident", word.toLowerCase(), start);
      continue;
    }
    if (ch === '"') {
      let value = "";
      i++;
      for (;;) {
        if (i >= sql.length) throw new SqlParseError("Unterminated quoted identifier", start);
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += sql[i];
        i++;
      }
      if (value.length === 0) throw new SqlParseError("Empty quoted identifier", start);
      push("quotedIdent", value, start);
      continue;
    }
    if (ch === "'") {
      let value = "";
      i++;
      for (;;) {
        if (i >= sql.length) throw new SqlParseError("Unterminated string literal", start);
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += sql[i];
        i++;
      }
      push("string", value, start);
      continue;
    }
    if (isDigit(ch) || (ch === "." && isDigit(sql[i + 1] ?? ""))) {
      while (i < sql.length && isDigit(sql[i]!)) i++;
      if (sql[i] === "." && isDigit(sql[i + 1] ?? "")) {
        i++;
        while (i < sql.length && isDigit(sql[i]!)) i++;
      } else if (sql[i] === "." && !isIdentStart(sql[i + 1] ?? "")) {
        i++;
      }
      if (sql[i] === "e" || sql[i] === "E") {
        let j = i + 1;
        if (sql[j] === "+" || sql[j] === "-") j++;
        if (isDigit(sql[j] ?? "")) {
          i = j;
          while (i < sql.length && isDigit(sql[i]!)) i++;
        }
      }
      if (i < sql.length && isIdentStart(sql[i]!)) throw new SqlParseError("Invalid number literal", start);
      push("number", sql.slice(start, i), start);
      continue;
    }
    if (ch === "$") {
      i++;
      while (i < sql.length && isDigit(sql[i]!)) i++;
      const digits = sql.slice(start + 1, i);
      if (digits.length === 0 || Number(digits) < 1 || digits.length > 4) throw new SqlParseError("Invalid parameter", start);
      push("param", String(Number(digits)), start);
      continue;
    }
    if (ch === "?") {
      i++;
      positional++;
      push("param", String(positional), start);
      continue;
    }
    const three = sql.slice(i, i + 3);
    if (THREE_CHAR_OPS.includes(three)) {
      push("op", three, start);
      i += 3;
      continue;
    }
    const two = sql.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      push("op", two === "!=" ? "<>" : two, start);
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(ch)) {
      push("op", ch, start);
      i++;
      continue;
    }
    if (PUNCT.includes(ch)) {
      push("punct", ch, start);
      i++;
      continue;
    }
    throw new SqlParseError(`Unexpected character ${JSON.stringify(ch)}`, start);
  }
  tokens.push({ type: "eof", value: "", offset: sql.length });
  return tokens;
}

/* ═══════════════════════════ Parser ═══════════════════════════ */

const COMPARISON_OPS: ReadonlySet<string> = new Set(["=", "<>", "<", "<=", ">", ">="]);
const ADDITIVE_OPS: ReadonlySet<string> = new Set(["+", "-", "<->", "<=>", "<#>"]);
const MULTIPLICATIVE_OPS: ReadonlySet<string> = new Set(["*", "/"]);

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.pos + ahead, this.tokens.length - 1)]!;
  }

  private next(): Token {
    const token = this.peek();
    if (token.type !== "eof") this.pos++;
    return token;
  }

  private isKeyword(word: string, ahead = 0): boolean {
    const t = this.peek(ahead);
    return t.type === "keyword" && t.value === word;
  }

  private isPunct(ch: string): boolean {
    const t = this.peek();
    return t.type === "punct" && t.value === ch;
  }

  private isOp(op: string): boolean {
    const t = this.peek();
    return t.type === "op" && t.value === op;
  }

  private acceptKeyword(word: string): boolean {
    if (!this.isKeyword(word)) return false;
    this.pos++;
    return true;
  }

  private expectKeyword(word: string): void {
    if (!this.acceptKeyword(word)) this.fail(`Expected ${word}`);
  }

  private expectPunct(ch: string): void {
    if (!this.isPunct(ch)) this.fail(`Expected "${ch}"`);
    this.pos++;
  }

  private fail(message: string): never {
    const t = this.peek();
    const found = t.type === "eof" ? "end of input" : JSON.stringify(t.value);
    throw new SqlParseError(`${message}, found ${found}`, t.offset);
  }

  private enter(): void {
    this.depth++;
    if (this.depth > MAX_EXPR_DEPTH) this.fail(`Expression nesting exceeds ${MAX_EXPR_DEPTH}`);
  }

  private leave(): void {
    this.depth--;
  }

  parseStatement(): SelectStatement {
    this.expectKeyword("SELECT");
    const distinct = this.acceptKeyword("DISTINCT");
    const columns: SelectItem[] = [this.parseSelectItem()];
    while (this.isPunct(",")) {
      this.pos++;
      columns.push(this.parseSelectItem());
    }
    this.expectKeyword("FROM");
    const from = this.parseTableRef();
    const joins: JoinClause[] = [];
    for (;;) {
      let type: "inner" | "left" | null = null;
      if (this.isKeyword("JOIN")) type = "inner";
      else if (this.isKeyword("INNER") && this.isKeyword("JOIN", 1)) {
        this.pos++;
        type = "inner";
      } else if (this.isKeyword("LEFT")) {
        this.pos++;
        this.acceptKeyword("OUTER");
        if (!this.isKeyword("JOIN")) this.fail("Expected JOIN");
        type = "left";
      }
      if (type === null) break;
      this.expectKeyword("JOIN");
      const table = this.parseTableRef();
      this.expectKeyword("ON");
      joins.push({ type, table, on: this.parseExpr() });
    }
    const where = this.acceptKeyword("WHERE") ? this.parseExpr() : null;
    const groupBy: Expr[] = [];
    if (this.acceptKeyword("GROUP")) {
      this.expectKeyword("BY");
      groupBy.push(this.parseExpr());
      while (this.isPunct(",")) {
        this.pos++;
        groupBy.push(this.parseExpr());
      }
    }
    const having = this.acceptKeyword("HAVING") ? this.parseExpr() : null;
    const orderBy: OrderItem[] = [];
    if (this.acceptKeyword("ORDER")) {
      this.expectKeyword("BY");
      do {
        if (orderBy.length > 0) this.pos++;
        const expr = this.parseExpr();
        let direction: "asc" | "desc" = "asc";
        if (this.acceptKeyword("DESC")) direction = "desc";
        else this.acceptKeyword("ASC");
        orderBy.push({ expr, direction });
      } while (this.isPunct(","));
    }
    const limit = this.acceptKeyword("LIMIT") ? this.parseNonNegativeInt("LIMIT") : null;
    const offset = this.acceptKeyword("OFFSET") ? this.parseNonNegativeInt("OFFSET") : null;
    if (this.isPunct(";")) this.pos++;
    if (this.peek().type !== "eof") this.fail("Expected end of statement");
    return { kind: "select", distinct, columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  private parseNonNegativeInt(clause: string): number {
    const t = this.peek();
    if (t.type !== "number" || !/^\d+$/.test(t.value)) this.fail(`${clause} needs a non-negative integer`);
    const value = Number(t.value);
    if (!Number.isSafeInteger(value)) this.fail(`${clause} value is too large`);
    this.pos++;
    return value;
  }

  private parseIdentifier(what: string): string {
    const t = this.peek();
    if (t.type === "ident" || t.type === "quotedIdent") {
      this.pos++;
      return t.value;
    }
    return this.fail(`Expected ${what}`);
  }

  private parseOptionalAlias(): string | null {
    if (this.acceptKeyword("AS")) return this.parseIdentifier("alias");
    const t = this.peek();
    if (t.type === "ident" || t.type === "quotedIdent") {
      this.pos++;
      return t.value;
    }
    return null;
  }

  private parseTableRef(): TableRef {
    const name = this.parseIdentifier("table name");
    if (this.isPunct(".")) this.fail("Schema-qualified table names are not supported");
    return { name, alias: this.parseOptionalAlias() };
  }

  private parseSelectItem(): SelectItem {
    if (this.isOp("*")) {
      this.pos++;
      return { kind: "star", table: null };
    }
    const t = this.peek();
    const t1 = this.peek(1);
    const t2 = this.peek(2);
    if ((t.type === "ident" || t.type === "quotedIdent") && t1.type === "punct" && t1.value === "." && t2.type === "op" && t2.value === "*") {
      this.pos += 3;
      return { kind: "star", table: t.value };
    }
    const expr = this.parseExpr();
    return { kind: "expr", expr, alias: this.parseOptionalAlias() };
  }

  parseStandaloneExpr(): Expr {
    const expr = this.parseExpr();
    if (this.peek().type !== "eof") this.fail("Expected end of expression");
    return expr;
  }

  parseExpr(): Expr {
    this.enter();
    try {
      return this.parseOr();
    } finally {
      this.leave();
    }
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.acceptKeyword("OR")) left = { kind: "binary", op: "OR", left, right: this.parseAnd() };
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.acceptKeyword("AND")) left = { kind: "binary", op: "AND", left, right: this.parseNot() };
    return left;
  }

  private parseNot(): Expr {
    if (this.acceptKeyword("NOT")) {
      this.enter();
      try {
        return { kind: "not", expr: this.parseNot() };
      } finally {
        this.leave();
      }
    }
    return this.parsePredicate();
  }

  private parsePredicate(): Expr {
    const left = this.parseAdditive();
    const t = this.peek();
    if (t.type === "op" && COMPARISON_OPS.has(t.value)) {
      this.pos++;
      const op = t.value as ComparisonOp;
      if (this.acceptKeyword("ANY")) {
        this.expectPunct("(");
        const array = this.parseExpr();
        this.expectPunct(")");
        return { kind: "any", op, expr: left, array };
      }
      return { kind: "binary", op, left, right: this.parseAdditive() };
    }
    if (this.acceptKeyword("IS")) {
      const negated = this.acceptKeyword("NOT");
      this.expectKeyword("NULL");
      return { kind: "isNull", expr: left, negated };
    }
    const negated = this.isKeyword("NOT") && (this.isKeyword("IN", 1) || this.isKeyword("BETWEEN", 1) || this.isKeyword("LIKE", 1));
    if (negated) this.pos++;
    if (this.acceptKeyword("IN")) {
      this.expectPunct("(");
      const list: Expr[] = [this.parseExpr()];
      while (this.isPunct(",")) {
        this.pos++;
        list.push(this.parseExpr());
      }
      this.expectPunct(")");
      return { kind: "in", expr: left, list, negated };
    }
    if (this.acceptKeyword("BETWEEN")) {
      const low = this.parseAdditive();
      this.expectKeyword("AND");
      const high = this.parseAdditive();
      return { kind: "between", expr: left, low, high, negated };
    }
    if (this.acceptKeyword("LIKE")) {
      return { kind: "like", expr: left, pattern: this.parseAdditive(), negated };
    }
    if (negated) this.fail("Expected IN, BETWEEN or LIKE after NOT");
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    for (;;) {
      const t = this.peek();
      if (t.type !== "op" || !ADDITIVE_OPS.has(t.value)) return left;
      this.pos++;
      left = { kind: "binary", op: t.value as BinaryOp, left, right: this.parseMultiplicative() };
    }
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t.type !== "op" || !MULTIPLICATIVE_OPS.has(t.value)) return left;
      this.pos++;
      left = { kind: "binary", op: t.value as BinaryOp, left, right: this.parseUnary() };
    }
  }

  private parseUnary(): Expr {
    if (this.isOp("-")) {
      this.pos++;
      const t = this.peek();
      if (t.type === "number") {
        this.pos++;
        return { kind: "literal", value: -Number(t.value) };
      }
      this.enter();
      try {
        return { kind: "neg", expr: this.parseUnary() };
      } finally {
        this.leave();
      }
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    switch (t.type) {
      case "number": {
        this.pos++;
        const value = Number(t.value);
        if (!Number.isFinite(value)) this.fail("Number literal is out of range");
        return { kind: "literal", value };
      }
      case "string":
        this.pos++;
        return { kind: "literal", value: t.value };
      case "param":
        this.pos++;
        return { kind: "param", index: Number(t.value) };
      case "keyword":
        if (t.value === "NULL") {
          this.pos++;
          return { kind: "literal", value: null };
        }
        if (t.value === "TRUE" || t.value === "FALSE") {
          this.pos++;
          return { kind: "literal", value: t.value === "TRUE" };
        }
        return this.fail("Unexpected keyword");
      case "punct":
        if (t.value === "(") {
          this.pos++;
          if (this.isKeyword("SELECT")) this.fail("Subqueries are not supported");
          const inner = this.parseExpr();
          this.expectPunct(")");
          return inner;
        }
        return this.fail("Unexpected punctuation");
      case "ident":
      case "quotedIdent": {
        this.pos++;
        if (t.type === "ident" && this.isPunct("(")) return this.parseCall(t.value);
        if (this.isPunct(".")) {
          this.pos++;
          return { kind: "column", table: t.value, name: this.parseIdentifier("column name") };
        }
        return { kind: "column", table: null, name: t.value };
      }
      default:
        return this.fail("Expected expression");
    }
  }

  private parseCall(name: string): Expr {
    this.expectPunct("(");
    this.enter();
    try {
      if (this.isOp("*")) {
        this.pos++;
        this.expectPunct(")");
        return { kind: "call", name, args: [], star: true, distinct: false };
      }
      const distinct = this.acceptKeyword("DISTINCT");
      const args: Expr[] = [];
      if (!this.isPunct(")")) {
        args.push(this.parseExpr());
        while (this.isPunct(",")) {
          this.pos++;
          args.push(this.parseExpr());
        }
      }
      this.expectPunct(")");
      return { kind: "call", name, args, star: false, distinct };
    } finally {
      this.leave();
    }
  }
}

/** Parse one SELECT statement. Throws `SqlParseError` on anything outside the documented subset. */
export function parseSql(sql: string): SelectStatement {
  return new Parser(tokenizeSql(sql)).parseStatement();
}

/** Parse a standalone expression (used for tests and rewrites). */
export function parseSqlExpr(sql: string): Expr {
  return new Parser(tokenizeSql(sql)).parseStandaloneExpr();
}

/* ═══════════════════════════ Printer ═══════════════════════════ */

const PREC_OR = 1;
const PREC_AND = 2;
const PREC_NOT = 3;
const PREC_PREDICATE = 4;
const PREC_ADDITIVE = 5;
const PREC_MULTIPLICATIVE = 6;
const PREC_NEG = 7;
const PREC_PRIMARY = 8;

function precedence(expr: Expr): number {
  switch (expr.kind) {
    case "binary":
      if (expr.op === "OR") return PREC_OR;
      if (expr.op === "AND") return PREC_AND;
      if (COMPARISON_OPS.has(expr.op)) return PREC_PREDICATE;
      if (MULTIPLICATIVE_OPS.has(expr.op)) return PREC_MULTIPLICATIVE;
      return PREC_ADDITIVE;
    case "not":
      return PREC_NOT;
    case "in":
    case "any":
    case "between":
    case "like":
    case "isNull":
      return PREC_PREDICATE;
    case "neg":
      return PREC_NEG;
    case "literal":
      return typeof expr.value === "number" && (expr.value < 0 || Object.is(expr.value, -0)) ? PREC_NEG : PREC_PRIMARY;
    default:
      return PREC_PRIMARY;
  }
}

export function printIdentifier(name: string): string {
  const simple = /^[a-z_][a-z0-9_$]*$/.test(name) && !SQL_KEYWORDS.has(name.toUpperCase());
  return simple ? name : `"${name.split('"').join('""')}"`;
}

function printNumber(value: number): string {
  if (Object.is(value, -0)) return "-0";
  return String(value);
}

function wrap(expr: Expr, minPrecedence: number): string {
  const text = printExpr(expr);
  return precedence(expr) < minPrecedence ? `(${text})` : text;
}

/** Print an expression with the minimum parentheses needed to re-parse to the same AST. */
export function printExpr(expr: Expr): string {
  switch (expr.kind) {
    case "column":
      return expr.table === null ? printIdentifier(expr.name) : `${printIdentifier(expr.table)}.${printIdentifier(expr.name)}`;
    case "literal":
      if (expr.value === null) return "NULL";
      if (typeof expr.value === "boolean") return expr.value ? "TRUE" : "FALSE";
      if (typeof expr.value === "number") return printNumber(expr.value);
      return `'${expr.value.split("'").join("''")}'`;
    case "param":
      return `$${expr.index}`;
    case "binary": {
      const p = precedence(expr);
      if (p === PREC_PREDICATE) {
        return `${wrap(expr.left, PREC_ADDITIVE)} ${expr.op} ${wrap(expr.right, PREC_ADDITIVE)}`;
      }
      // Left-associative: equal precedence on the right needs parentheses.
      return `${wrap(expr.left, p)} ${expr.op} ${wrap(expr.right, p + 1)}`;
    }
    case "not":
      return `NOT ${wrap(expr.expr, PREC_NOT)}`;
    case "neg":
      return `-${wrap(expr.expr, PREC_NEG + 1)}`;
    case "in":
      return `${wrap(expr.expr, PREC_ADDITIVE)} ${expr.negated ? "NOT IN" : "IN"} (${expr.list.map(printExpr).join(", ")})`;
    case "any":
      return `${wrap(expr.expr, PREC_ADDITIVE)} ${expr.op} ANY(${printExpr(expr.array)})`;
    case "between":
      return `${wrap(expr.expr, PREC_ADDITIVE)} ${expr.negated ? "NOT BETWEEN" : "BETWEEN"} ${wrap(expr.low, PREC_ADDITIVE)} AND ${wrap(expr.high, PREC_ADDITIVE)}`;
    case "like":
      return `${wrap(expr.expr, PREC_ADDITIVE)} ${expr.negated ? "NOT LIKE" : "LIKE"} ${wrap(expr.pattern, PREC_ADDITIVE)}`;
    case "isNull":
      return `${wrap(expr.expr, PREC_ADDITIVE)} IS ${expr.negated ? "NOT NULL" : "NULL"}`;
    case "call": {
      if (expr.star) return `${printIdentifier(expr.name)}(*)`;
      const args = expr.args.map(printExpr).join(", ");
      return `${printIdentifier(expr.name)}(${expr.distinct ? "DISTINCT " : ""}${args})`;
    }
  }
}

function printTableRef(ref: TableRef): string {
  return ref.alias === null ? printIdentifier(ref.name) : `${printIdentifier(ref.name)} ${printIdentifier(ref.alias)}`;
}

/** Print a statement as canonical SQL (upper-case keywords, explicit ASC/DESC, minimal parentheses). */
export function printSql(stmt: SelectStatement): string {
  const parts: string[] = [];
  const items = stmt.columns.map((item) =>
    item.kind === "star"
      ? item.table === null
        ? "*"
        : `${printIdentifier(item.table)}.*`
      : item.alias === null
        ? printExpr(item.expr)
        : `${printExpr(item.expr)} AS ${printIdentifier(item.alias)}`,
  );
  parts.push(`SELECT ${stmt.distinct ? "DISTINCT " : ""}${items.join(", ")}`);
  parts.push(`FROM ${printTableRef(stmt.from)}`);
  for (const join of stmt.joins) {
    parts.push(`${join.type === "left" ? "LEFT JOIN" : "JOIN"} ${printTableRef(join.table)} ON ${printExpr(join.on)}`);
  }
  if (stmt.where) parts.push(`WHERE ${printExpr(stmt.where)}`);
  if (stmt.groupBy.length > 0) parts.push(`GROUP BY ${stmt.groupBy.map(printExpr).join(", ")}`);
  if (stmt.having) parts.push(`HAVING ${printExpr(stmt.having)}`);
  if (stmt.orderBy.length > 0) {
    parts.push(`ORDER BY ${stmt.orderBy.map((o) => `${printExpr(o.expr)} ${o.direction === "desc" ? "DESC" : "ASC"}`).join(", ")}`);
  }
  if (stmt.limit !== null) parts.push(`LIMIT ${stmt.limit}`);
  if (stmt.offset !== null) parts.push(`OFFSET ${stmt.offset}`);
  return parts.join(" ");
}

/* ═══════════════════════════ AST utilities ═══════════════════════════ */

/** Split a predicate into its top-level AND conjuncts. */
export function splitConjuncts(expr: Expr | null): Expr[] {
  if (expr === null) return [];
  if (expr.kind === "binary" && expr.op === "AND") return [...splitConjuncts(expr.left), ...splitConjuncts(expr.right)];
  return [expr];
}

/** Join conjuncts back with AND (left-deep, preserving order). */
export function joinConjuncts(conjuncts: readonly Expr[]): Expr | null {
  if (conjuncts.length === 0) return null;
  return conjuncts.slice(1).reduce<Expr>((acc, c) => ({ kind: "binary", op: "AND", left: acc, right: c }), conjuncts[0]!);
}

/** Every column referenced by an expression, in source order. */
export function columnRefs(expr: Expr): Array<Extract<Expr, { kind: "column" }>> {
  const out: Array<Extract<Expr, { kind: "column" }>> = [];
  const visit = (e: Expr): void => {
    switch (e.kind) {
      case "column":
        out.push(e);
        return;
      case "binary":
        visit(e.left);
        visit(e.right);
        return;
      case "not":
      case "neg":
      case "isNull":
        visit(e.expr);
        return;
      case "in":
        visit(e.expr);
        e.list.forEach(visit);
        return;
      case "any":
        visit(e.expr);
        visit(e.array);
        return;
      case "between":
        visit(e.expr);
        visit(e.low);
        visit(e.high);
        return;
      case "like":
        visit(e.expr);
        visit(e.pattern);
        return;
      case "call":
        e.args.forEach(visit);
        return;
      default:
        return;
    }
  };
  visit(expr);
  return out;
}

/** True when the expression has no column references (literals, params and arithmetic on them). */
export function isConstantExpr(expr: Expr): boolean {
  return columnRefs(expr).length === 0;
}

/** True when the expression contains an aggregate call (COUNT, SUM, AVG, MIN, MAX). */
export function containsAggregate(expr: Expr): boolean {
  const AGGREGATES = new Set(["count", "sum", "avg", "min", "max"]);
  const visit = (e: Expr): boolean => {
    switch (e.kind) {
      case "call":
        return AGGREGATES.has(e.name) || e.args.some(visit);
      case "binary":
        return visit(e.left) || visit(e.right);
      case "not":
      case "neg":
      case "isNull":
        return visit(e.expr);
      case "in":
        return visit(e.expr) || e.list.some(visit);
      case "any":
        return visit(e.expr) || visit(e.array);
      case "between":
        return visit(e.expr) || visit(e.low) || visit(e.high);
      case "like":
        return visit(e.expr) || visit(e.pattern);
      default:
        return false;
    }
  };
  return visit(expr);
}
