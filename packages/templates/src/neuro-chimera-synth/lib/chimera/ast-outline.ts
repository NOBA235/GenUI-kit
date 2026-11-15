/**
 * Flat outline of a parsed SELECT statement for the AST inspector (`lib/chimera/ast-outline.ts`).
 *
 * Node names follow PostgreSQL's raw parse tree (SelectStmt, ResTarget, BoolExpr, A_Expr, …) so
 * the inspector reads like `pg_parse_tree` output. The outline is bounded by MAX_OUTLINE_LINES.
 */

import { printExpr, type Expr, type SelectStatement } from "./sql-parser.js";

export interface AstLine {
  readonly depth: number;
  readonly node: string;
  readonly detail: string;
}

export const MAX_OUTLINE_LINES = 400;

class OutlineBuilder {
  readonly lines: AstLine[] = [];
  truncated = false;

  push(depth: number, node: string, detail = ""): boolean {
    if (this.lines.length >= MAX_OUTLINE_LINES) {
      this.truncated = true;
      return false;
    }
    this.lines.push({ depth, node, detail });
    return true;
  }

  expr(e: Expr, depth: number, role = ""): void {
    const prefix = role ? `${role}: ` : "";
    switch (e.kind) {
      case "column":
        this.push(depth, "ColumnRef", `${prefix}${e.table ? `${e.table}.` : ""}${e.name}`);
        return;
      case "literal":
        this.push(depth, "A_Const", `${prefix}${printExpr(e)}`);
        return;
      case "param":
        this.push(depth, "ParamRef", `${prefix}$${e.index}`);
        return;
      case "binary": {
        const node = e.op === "AND" || e.op === "OR" ? `BoolExpr ${e.op}` : `A_Expr ${e.op}`;
        if (!this.push(depth, node, role)) return;
        this.expr(e.left, depth + 1);
        this.expr(e.right, depth + 1);
        return;
      }
      case "not":
        if (this.push(depth, "BoolExpr NOT", role)) this.expr(e.expr, depth + 1);
        return;
      case "neg":
        if (this.push(depth, "A_Expr -", `${prefix}unary minus`)) this.expr(e.expr, depth + 1);
        return;
      case "in":
        if (!this.push(depth, e.negated ? "A_Expr NOT IN" : "A_Expr IN", `${prefix}${e.list.length} value(s)`)) return;
        this.expr(e.expr, depth + 1);
        for (const item of e.list) this.expr(item, depth + 1, "value");
        return;
      case "any":
        if (!this.push(depth, `A_Expr ${e.op} ANY`, role)) return;
        this.expr(e.expr, depth + 1);
        this.expr(e.array, depth + 1, "array");
        return;
      case "between":
        if (!this.push(depth, e.negated ? "A_Expr NOT BETWEEN" : "A_Expr BETWEEN", role)) return;
        this.expr(e.expr, depth + 1);
        this.expr(e.low, depth + 1, "low");
        this.expr(e.high, depth + 1, "high");
        return;
      case "like":
        if (!this.push(depth, e.negated ? "A_Expr NOT LIKE" : "A_Expr LIKE", role)) return;
        this.expr(e.expr, depth + 1);
        this.expr(e.pattern, depth + 1, "pattern");
        return;
      case "isNull":
        if (this.push(depth, e.negated ? "NullTest IS NOT NULL" : "NullTest IS NULL", role)) this.expr(e.expr, depth + 1);
        return;
      case "call":
        if (!this.push(depth, "FuncCall", `${prefix}${e.name}(${e.distinct ? "DISTINCT " : ""}${e.star ? "*" : ""})`)) return;
        for (const arg of e.args) this.expr(arg, depth + 1, "arg");
        return;
    }
  }
}

/** Outline a statement as indented parse-tree lines. */
export function outlineStatement(stmt: SelectStatement): { readonly lines: readonly AstLine[]; readonly truncated: boolean } {
  const b = new OutlineBuilder();
  b.push(0, "SelectStmt", stmt.distinct ? "DISTINCT" : "");
  b.push(1, "targetList", `${stmt.columns.length} item(s)`);
  for (const item of stmt.columns) {
    if (item.kind === "star") {
      b.push(2, "ResTarget", `${item.table ? `${item.table}.` : ""}*`);
    } else if (b.push(2, "ResTarget", item.alias ? `AS ${item.alias}` : "")) {
      b.expr(item.expr, 3);
    }
  }
  b.push(1, "fromClause", "");
  b.push(2, "RangeVar", `${stmt.from.name}${stmt.from.alias ? ` ${stmt.from.alias}` : ""}`);
  for (const join of stmt.joins) {
    if (!b.push(2, "JoinExpr", `${join.type.toUpperCase()} ${join.table.name}${join.table.alias ? ` ${join.table.alias}` : ""}`)) break;
    b.expr(join.on, 3, "quals");
  }
  if (stmt.where && b.push(1, "whereClause", "")) b.expr(stmt.where, 2);
  if (stmt.groupBy.length > 0 && b.push(1, "groupClause", `${stmt.groupBy.length} key(s)`)) {
    for (const g of stmt.groupBy) b.expr(g, 2);
  }
  if (stmt.having && b.push(1, "havingClause", "")) b.expr(stmt.having, 2);
  if (stmt.orderBy.length > 0 && b.push(1, "sortClause", `${stmt.orderBy.length} key(s)`)) {
    for (const o of stmt.orderBy) {
      if (b.push(2, "SortBy", o.direction.toUpperCase())) b.expr(o.expr, 3);
    }
  }
  if (stmt.limit !== null) b.push(1, "limitCount", String(stmt.limit));
  if (stmt.offset !== null) b.push(1, "limitOffset", String(stmt.offset));
  return { lines: b.lines, truncated: b.truncated };
}
