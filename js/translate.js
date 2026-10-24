// translate.js - a live plain-English reading of the player's query, shown under the editor.
//
// It only describes what the query says. It never judges whether it's the right answer:
// checker.js does that. It must never throw, whatever is typed, so every step is forgiving
// and anything it doesn't understand is shown as typed.

const AGGREGATES = {
  SUM: (x) => ["the total of ", ...x],
  AVG: (x) => ["the average of ", ...x],
  MIN: (x) => ["the smallest ", ...x],
  MAX: (x) => ["the biggest ", ...x],
  COUNT: (x, star) => (star ? ["how many rows"] : ["how many ", ...x, " values"]),
};
const CLAUSES = ["SELECT", "FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT"];
// SQL words that are never flagged as unknown columns, even where they aren't explained.
const RESERVED = new Set(["SELECT", "FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT", "BY", "AS", "AND", "OR",
  "NOT", "LIKE", "IN", "IS", "NULL", "BETWEEN", "DISTINCT", "JOIN", "ON", "INNER", "LEFT", "RIGHT", "OUTER",
  "ASC", "DESC", "CASE", "WHEN", "THEN", "ELSE", "END", "OFFSET", "ALL", "UNION"]);
const OPS = { "=": "is", "==": "is", "!=": "is not", "<>": "is not", ">": "is over", "<": "is under", ">=": "is at least", "<=": "is at most" };
const TOTAL_OPS = { "=": "of", "==": "of", "!=": "other than", "<>": "other than", ">": "over", "<": "under", ">=": "of at least", "<=": "of at most" };

const Translate = {
  // Redraws the translation of `sql` into `box`.
  render(box, sql) {
    if (!box) return;
    box.replaceChildren();
    let parts = [];
    try { parts = this.parse(sql); } catch (e) { console.warn("translate:", e); }
    if (!parts.length) {
      box.append(el("span", "tr-empty", "Your query, in plain English, shows up here as you type."));
      return;
    }
    for (const p of parts) {
      const chip = el("span", "tr-part tr-" + p.kind);
      for (const piece of p.pieces) {
        if (typeof piece === "string") chip.append(piece);
        else if (piece.slot) chip.append(el("span", "tr-slot", "___"));
        else if (piece.bad) {
          chip.append(el("span", "tr-bad", piece.text));
          chip.append(el("span", "tr-note", " (" + piece.bad + ")"));
        }
      }
      box.append(chip);
    }
  },

  // Returns [{ kind, pieces }] where each piece is a string, { slot: true } or { text, bad }.
  parse(sql) {
    const tokens = tokenize(String(sql || ""));
    if (!tokens.length) return [];

    // Split into clauses at clause keywords, in the order typed. Brackets are ignored here, so
    // a half-typed "SUM(amount FROM trades" still finds its FROM.
    const clauses = [];
    let cur = null;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === "word" && CLAUSES.includes(t.up)) {
        cur = { key: t.up, tokens: [] };
        clauses.push(cur);
        if ((t.up === "GROUP" || t.up === "ORDER") && tokens[i + 1] && tokens[i + 1].up === "BY") i++;
        continue;
      }
      if (!cur) { cur = { key: null, tokens: [] }; clauses.push(cur); }
      cur.tokens.push(t);
    }

    // Context: which table's columns count, and which names SELECT defines.
    const schema = (typeof DB !== "undefined" && DB.schema) || {};
    const tables = Object.keys(schema);
    const fromClause = clauses.find((c) => c.key === "FROM");
    const fromWord = fromClause && fromClause.tokens[0] && fromClause.tokens[0].type === "word" ? fromClause.tokens[0].v : null;
    const table = fromWord ? tables.find((t) => t.toLowerCase() === fromWord.toLowerCase()) : null;
    const ctx = {
      schema, table,
      cols: table ? schema[table] : [...new Set(Object.values(schema).flat())],
      names: new Set(),
      allowNames: false,
    };
    const selectClause = clauses.find((c) => c.key === "SELECT");
    if (selectClause) for (const item of splitTop(selectClause.tokens, (t) => t.v === ",")) {
      const a = parseItem(item, ctx).alias;
      if (a) ctx.names.add(a.toLowerCase());
    }

    const parts = [];
    for (const c of clauses) {
      try {
        parts.push(describe(c, ctx));
      } catch (e) {
        console.warn("translate:", e);
        parts.push({ kind: "other", pieces: [rawText(c.tokens)] });
      }
    }
    if (selectClause && !fromClause) parts.splice(parts.indexOf(parts.find((p) => p.kind === "select")) + 1, 0,
      { kind: "from", pieces: ["from which table? ", { slot: true }] });
    return parts.filter((p) => p.pieces.length);
  },
};

// ---------- reading the text ----------

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "-" && s[i + 1] === "-") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (ch === "/" && s[i + 1] === "*") { const end = s.indexOf("*/", i + 2); i = end < 0 ? s.length : end + 2; continue; }
    if (ch === "'") {
      let v = "";
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        v += s[i++];
      }
      out.push({ type: "str", v });
      continue;
    }
    if (ch === '"' || ch === "`") {
      const end = s.indexOf(ch, i + 1);
      const v = s.slice(i + 1, end < 0 ? s.length : end);
      i = end < 0 ? s.length : end + 1;
      out.push({ type: "word", v, up: v.toUpperCase() });
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (word) {
      const v = word[0];
      out.push(/^_+$/.test(v) ? { type: "slot", v } : { type: "word", v, up: v.toUpperCase() });
      i += v.length;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (num) { out.push({ type: "num", v: num[0] }); i += num[0].length; continue; }
    const op = /^(>=|<=|<>|!=|==|=|>|<)/.exec(s.slice(i));
    if (op) { out.push({ type: "op", v: op[0] }); i += op[0].length; continue; }
    if (ch === ";") { i++; continue; }
    out.push({ type: "punct", v: ch });
    i++;
  }
  return out;
}

// Splits tokens at top-level separators (commas, AND/OR), keeping each separator.
function splitTop(tokens, isSep) {
  const groups = [[]];
  const seps = [];
  let depth = 0;
  for (const t of tokens) {
    if (t.v === "(") depth++;
    if (t.v === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && isSep(t)) { groups.push([]); seps.push(t); continue; }
    groups[groups.length - 1].push(t);
  }
  groups.seps = seps;
  return groups;
}

function rawText(tokens) {
  return tokens.map((t) => (t.type === "str" ? `'${t.v}'` : t.v)).join(" ").replace(/ ([,.)]) ?/g, "$1 ").replace(/\( /g, "(").trim();
}

// ---------- one part of the query ----------

// Reads one value from the front of `tokens`: *, a column, a function call, text, a number or a slot.
// Returns { pieces, typed, used, agg?, col? }.
function parseAtom(tokens, ctx) {
  const t = tokens[0];
  if (!t) return { pieces: [{ slot: true }], typed: "", used: 0 };
  if (t.type === "slot") return { pieces: [{ slot: true }], typed: t.v, used: 1 };
  if (t.v === "*") return { pieces: ["every column"], typed: "*", used: 1, star: true };
  if (t.type === "str") return { pieces: [t.v], typed: `'${t.v}'`, used: 1 };
  if (t.type === "num") return { pieces: [t.v], typed: t.v, used: 1 };
  if (t.type !== "word") return { pieces: [t.v], typed: t.v, used: 1 };

  // A function call: SUM(amount), COUNT(*)...
  if (tokens[1] && tokens[1].v === "(") {
    let depth = 0;
    let end = 1;
    for (; end < tokens.length; end++) {
      if (tokens[end].v === "(") depth++;
      if (tokens[end].v === ")" && --depth === 0) break;
    }
    const inner = tokens.slice(2, end);
    const used = Math.min(end + 1, tokens.length);
    const typed = rawText(tokens.slice(0, used));
    const agg = AGGREGATES[t.up];
    if (!agg) return { pieces: [typed], typed, used };
    const star = inner.length === 1 && inner[0].v === "*";
    const arg = star ? { pieces: [] } : parseAtom(inner, ctx);
    return { pieces: agg(arg.pieces, star), typed, used, agg: t.up };
  }

  // table.column
  let word = t;
  let used = 1;
  if (tokens[1] && tokens[1].v === "." && tokens[2] && tokens[2].type === "word") { word = tokens[2]; used = 3; }
  if (RESERVED.has(word.up)) return { pieces: [word.v], typed: word.v, used };
  return { pieces: [checkName(word.v, ctx)], typed: rawText(tokens.slice(0, used)), used, col: word.v };
}

// A bare name: a column, a name made in SELECT, or a problem.
function checkName(name, ctx) {
  const lower = name.toLowerCase();
  if (!ctx.cols.length) return name; // database not loaded: nothing to check against
  if (ctx.cols.some((c) => c.toLowerCase() === lower)) return name;
  if (ctx.allowNames && ctx.names.has(lower)) return name;
  const values = (typeof DB !== "undefined" && DB.knownValues) || [];
  if (values.some((v) => v.toLowerCase() === lower)) return { text: name, bad: "this is a value: put it in 'quotes'" };
  return { text: name, bad: ctx.table ? `not a column in ${ctx.table}` : "not a column in any table" };
}

function isColumn(name, ctx) {
  return ctx.cols.some((c) => c.toLowerCase() === name.toLowerCase());
}

// One SELECT item: a value, maybe followed by a name (with or without AS).
function parseItem(tokens, ctx) {
  if (tokens[0] && tokens[0].up === "DISTINCT") {
    const item = parseItem(tokens.slice(1), ctx);
    return { pieces: ["each different ", ...item.pieces], alias: item.alias };
  }
  const atom = parseAtom(tokens, ctx);
  const rest = tokens.slice(atom.used);
  let alias = null;
  let aliasTok = null;
  let used = 0;
  if (rest[0] && rest[0].up === "AS") {
    aliasTok = rest[1] && (rest[1].type === "word" || rest[1].type === "slot") ? rest[1] : null;
    alias = aliasTok && aliasTok.type === "word" ? aliasTok.v : null;
    used = aliasTok ? 2 : 1;
  } else if (rest[0] && rest[0].type === "word" && !RESERVED.has(rest[0].up)) {
    aliasTok = rest[0];
    alias = rest[0].v;
    used = 1;
  }
  const pieces = [...atom.pieces];
  if (aliasTok || (rest[0] && rest[0].up === "AS")) {
    pieces.push(" (called ");
    if (!aliasTok || aliasTok.type === "slot") pieces.push({ slot: true });
    else if (atom.typed && isColumn(alias, ctx)) {
      pieces.push({ text: alias, bad: `${alias} is also a column: missing a comma? → ${atom.typed}, ${alias}` });
    } else pieces.push(alias);
    pieces.push(")");
  }
  const extra = rest.slice(used);
  if (extra.length) pieces.push(" " + rawText(extra));
  return { pieces, alias };
}

// "a, b and c"
function joinList(lists, last = " and ") {
  const out = [];
  lists.forEach((l, i) => {
    if (i > 0) out.push(i === lists.length - 1 ? last : ", ");
    out.push(...l);
  });
  return out;
}

// One condition: left, operator, right. `total` phrases it for HAVING.
function parseCondition(tokens, ctx, having) {
  if (!tokens.length) return [{ slot: true }];
  const left = parseAtom(tokens, ctx);
  let rest = tokens.slice(left.used);
  const out = [];
  const op = rest[0] && rest[0].type === "op" ? rest[0].v : null;
  if (op) rest = rest.slice(1);
  const right = op ? parseAtom(rest, ctx) : null;
  if (right) rest = rest.slice(right.used);

  if (having && left.agg === "SUM" && op) out.push("totals ", TOTAL_OPS[op], " ", ...right.pieces);
  else if (having && left.agg === "COUNT" && op) out.push("groups with ", TOTAL_OPS[op], " ", ...right.pieces, " rows");
  else {
    if (having) out.push("groups where ");
    out.push(...left.pieces);
    if (op) out.push(" ", OPS[op], " ", ...right.pieces);
    else if (!rest.length) out.push(" ", { slot: true });
  }
  if (rest.length) out.push(" " + rawText(rest));
  return out;
}

function conditions(tokens, ctx, having) {
  const groups = splitTop(tokens, (t) => t.up === "AND" || t.up === "OR");
  const out = [];
  groups.forEach((g, i) => {
    if (i > 0) out.push(" " + groups.seps[i - 1].up.toLowerCase() + " ");
    out.push(...parseCondition(g, ctx, having));
  });
  return out;
}

function sortPhrase(atom, dir, ctx) {
  const desc = dir === "DESC";
  if (atom.col && ctx.table) {
    const name = atom.col.toLowerCase();
    if (name === "time") return [desc ? "latest " : "earliest ", ...atom.pieces, " first"];
    const text = (typeof DB !== "undefined" && DB.columnValues && DB.columnValues[`${ctx.table}.${name}`.toLowerCase()]) || [];
    if (text.length) return [...atom.pieces, desc ? " from Z to A" : " from A to Z"];
  }
  return [desc ? "biggest " : "smallest ", ...atom.pieces, " first"];
}

function describe(c, ctx) {
  const tk = c.tokens;
  switch (c.key) {
    case "SELECT": {
      ctx.allowNames = false;
      if (!tk.length) return { kind: "select", pieces: ["Show which columns? ", { slot: true }] };
      const items = splitTop(tk, (t) => t.v === ",").map((item) => (item.length ? parseItem(item, ctx).pieces : [{ slot: true }]));
      return { kind: "select", pieces: ["Show ", ...joinList(items)] };
    }
    case "FROM": {
      const t = tk[0];
      const rest = rawText(tk.slice(1));
      let pieces;
      if (!t || t.type === "slot") pieces = ["from which table? ", { slot: true }];
      else if (t.type !== "word") pieces = ["from " + rawText(tk)];
      else if (ctx.table) pieces = ["from the ", t.v, " table"];
      else pieces = ["from the ", { text: t.v, bad: "not a table" }, " table"];
      if (t && t.type === "word" && rest) pieces.push(" " + rest);
      return { kind: "from", pieces };
    }
    case "WHERE":
      ctx.allowNames = false;
      return { kind: "where", pieces: ["only rows where ", ...conditions(tk, ctx, false)] };
    case "GROUP": {
      ctx.allowNames = true;
      if (!tk.length || tk[0].type === "slot") return { kind: "group", pieces: ["one row per which column? ", { slot: true }] };
      const items = splitTop(tk, (t) => t.v === ",").map((item) => {
        const a = parseAtom(item, ctx);
        const extra = rawText(item.slice(a.used));
        return extra ? [...a.pieces, " " + extra] : a.pieces;
      });
      return { kind: "group", pieces: ["one row per ", ...joinList(items)] };
    }
    case "HAVING":
      ctx.allowNames = true;
      return { kind: "having", pieces: ["only ", ...(tk.length ? conditions(tk, ctx, true) : ["groups where ", { slot: true }])] };
    case "ORDER": {
      ctx.allowNames = true;
      if (!tk.length || tk[0].type === "slot") return { kind: "order", pieces: ["sorted by which column? ", { slot: true }] };
      const items = splitTop(tk, (t) => t.v === ",").map((item) => {
        if (!item.length) return [{ slot: true }];
        const a = parseAtom(item, ctx);
        let rest = item.slice(a.used);
        let dir = null;
        if (rest[0] && (rest[0].up === "DESC" || rest[0].up === "ASC")) { dir = rest[0].up; rest = rest.slice(1); }
        const out = sortPhrase(a, dir, ctx);
        if (rest.length) out.push(" " + rawText(rest));
        return out;
      });
      return { kind: "order", pieces: joinList(items, ", then ") };
    }
    case "LIMIT": {
      const t = tk[0];
      if (!t || t.type === "slot") return { kind: "limit", pieces: ["only the first ", { slot: true }] };
      const pieces = t.type === "num" ? (t.v === "1" ? ["only the first row"] : ["only the first ", t.v]) : ["only the first ", rawText([t])];
      if (tk.length > 1) pieces.push(" " + rawText(tk.slice(1)));
      return { kind: "limit", pieces };
    }
    default:
      return { kind: "other", pieces: tk.length ? [rawText(tk)] : [] };
  }
}
