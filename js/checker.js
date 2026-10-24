// checker.js - decides whether the player's query answers the task, and if not, explains why.
//
// Key idea: many SQL mistakes run WITHOUT an error (a missing comma, the wrong capital letter,
// SUM without GROUP BY). So we never trust "no error" alone. We compare the player's RESULT
// with the result of the task's correct query, then look at the SQL to explain the gap.

const Checker = {
  // task: { answer, orderBy?: column index in answer that must be in the same order, mistakes?: [...] }
  // Returns { status, message, note, result }
  //   status: "empty" | "blank" | "blocked" | "error" | "wrong" | "correct"
  check(task, rawSql) {
    const sql = stripComments(rawSql).trim();
    if (!sql) return { status: "empty", message: "Type a query first, then press Enter." };
    if (sql.includes("___")) return { status: "blank", message: "Fill in the blank (___) first." };

    const bare = withoutStrings(sql);
    const statements = bare.split(";").filter((s) => s.trim());
    if (statements.length > 1) {
      return { status: "blocked", message: "One query at a time. Remove everything after the first semicolon (;)." };
    }
    if (!/^\s*SELECT\b/i.test(bare)) {
      return {
        status: "blocked",
        message: "You only have read access tonight. Every query starts with SELECT.",
      };
    }

    let result;
    try {
      result = DB.query(sql);
    } catch (e) {
      return { status: "error", message: explainError(e.message, sql, bare), raw: e.message };
    }

    const expected = DB.query(task.answer);
    const ctx = { sql, bare, result, expected, task };

    if (matches(expected, result, task.orderBy)) {
      return { status: "correct", result, note: styleNote(ctx) };
    }
    for (const m of task.mistakes || []) {
      if (m.test(ctx)) return { status: "wrong", result, message: m.msg };
    }
    return { status: "wrong", result, message: explainWrong(ctx) };
  },
};

// ---------- comparing results ----------

const key = (v) => (v === null ? "NULL" : String(v));

// True when `got` contains every column of `exp` (any order, extra columns allowed),
// the same rows, and (if orderBy is set) the same order for that column.
function matches(exp, got, orderBy) {
  const proj = project(exp, got);
  if (!proj) return false;
  const a = exp.rows.map((r) => JSON.stringify(r.map(key))).sort();
  const b = proj.map((r) => JSON.stringify(r.map(key))).sort();
  if (a.join("\n") !== b.join("\n")) return false;
  if (orderBy === undefined || orderBy === null) return true;
  return exp.rows.map((r) => key(r[orderBy])).join("|") === proj.map((r) => key(r[orderBy])).join("|");
}

// Reorders got's columns to line up with exp's columns, matching columns by their values.
function project(exp, got) {
  if (got.rows.length !== exp.rows.length) return null;
  const colValues = (res, j) => res.rows.map((r) => key(r[j])).sort().join("|");
  const used = new Set();
  const map = [];
  for (let j = 0; j < exp.columns.length; j++) {
    const want = colValues(exp, j);
    let found = -1;
    for (let k = 0; k < got.columns.length; k++) {
      if (!used.has(k) && colValues(got, k) === want) { found = k; break; }
    }
    if (found < 0) return null;
    used.add(found);
    map.push(found);
  }
  return got.rows.map((r) => map.map((k) => r[k]));
}

// ---------- explaining errors (the query did not run) ----------

const CLAUSE_ORDER = "SELECT … FROM … WHERE … GROUP BY … ORDER BY … LIMIT";

function explainError(msg, sql, bare) {
  let m;
  if (!/\bFROM\b/i.test(bare)) {
    return "Every query needs FROM to say which table to look in, like: SELECT * FROM trades";
  }
  if ((m = msg.match(/no such column: (.+)/))) {
    const name = m[1].replace(/^["'`]|["'`]$/g, "");
    const value = DB.knownValues.find((v) => v.toLowerCase() === name.toLowerCase());
    if (value) {
      return `"${name}" is a value, not a column name. Text values need single quotes around them: '${value}'`;
    }
    const col = closest(name, allColumns());
    if (col) return `There's no column called "${name}". Did you mean ${col}?`;
    return `There's no column called "${name}". Check the Tables panel for the column names.`;
  }
  if ((m = msg.match(/no such table: (.+)/))) {
    const t = closest(m[1], Object.keys(DB.schema));
    const list = Object.keys(DB.schema).join(", ");
    return t
      ? `There's no table called "${m[1]}". Did you mean ${t}?`
      : `There's no table called "${m[1]}". The tables are: ${list}.`;
  }
  if (/misuse of aggregate/.test(msg)) {
    return "SUM and COUNT can't go inside WHERE. To filter totals, add HAVING after GROUP BY, like: HAVING SUM(amount) > 50000";
  }
  if (/unrecognized token/.test(msg) || ((sql.match(/'/g) || []).length % 2 === 1)) {
    return "A quote was opened but never closed. Text values need a quote on both sides: 'error'";
  }
  if (/incomplete input/.test(msg)) {
    return "The query stops too early. Something is missing at the end, like a value after = or a column after BY.";
  }
  if ((m = msg.match(/near "(.+?)": syntax error/))) {
    const tok = m[1].toUpperCase();
    const upper = bare.toUpperCase();
    const where = upper.search(/\bWHERE\b/);
    const later = Math.min(...[/\bORDER\s+BY\b/, /\bGROUP\s+BY\b/, /\bLIMIT\b/]
      .map((re) => upper.search(re)).filter((i) => i >= 0), Infinity);
    if (where >= 0 && later < where) {
      return `WHERE has to come before GROUP BY, ORDER BY and LIMIT. The order is always: ${CLAUSE_ORDER}`;
    }
    if (tok === "FROM" && /,\s*FROM\b/i.test(bare)) {
      return "There's an extra comma just before FROM. Only put commas between columns.";
    }
    if (/\bORDER\s+(?!BY)/i.test(bare) || /\bGROUP\s+(?!BY)/i.test(bare)) {
      return "ORDER and GROUP always come with BY: ORDER BY amount, GROUP BY trader.";
    }
    if (/^(SELCT|SELET|SLECT|FORM|FRM|WHER|WERE|ODER)$/.test(tok)) {
      return `"${m[1]}" looks like a typo. The keywords are SELECT, FROM, WHERE, ORDER BY.`;
    }
    return `SQL got confused near "${m[1]}". Check the spelling, and that the parts go in this order: ${CLAUSE_ORDER}`;
  }
  return "The database couldn't run that: " + msg;
}

// ---------- explaining wrong answers (the query ran, but the rows are wrong) ----------

function explainWrong({ sql, bare, result, expected, task }) {
  const got = result.rows.length;
  const want = expected.rows.length;
  const answerUpper = task.answer.toUpperCase();
  const upper = bare.toUpperCase();

  // Missing comma: "SELECT trader amount" quietly renames trader to "amount".
  const selectList = (bare.match(/SELECT\s+([\s\S]*?)\s+FROM\b/i) || [])[1] || "";
  for (const part of selectList.split(",")) {
    const words = part.trim().split(/\s+/);
    const cols = allColumns();
    if (words.length === 2 && cols.includes(words[0].toLowerCase()) && cols.includes(words[1].toLowerCase())) {
      return `You're missing a comma. Without it, SQL shows ${words[0]} and just labels it "${words[1]}". Write: ${words[0]}, ${words[1]}`;
    }
  }

  if (got === 0) {
    // Check each  column = 'value'  against the values that column really holds.
    const table = ((bare.match(/\bFROM\s+(\w+)/i) || [])[1] || "").toLowerCase();
    for (const m of sql.matchAll(/(\w+)\s*==?\s*'((?:[^']|'')*)'/g)) {
      const col = m[1].toLowerCase();
      const lit = m[2].replace(/''/g, "'");
      const vals = DB.columnValues[`${table}.${col}`];
      if (!vals || vals.includes(lit)) continue;
      const sameCase = vals.find((v) => v.toLowerCase() === lit.toLowerCase());
      if (sameCase) return `Nothing came back. Values must match exactly, capitals too: it's '${sameCase}', not '${lit}'.`;
      const longer = vals.find((v) => v.toLowerCase().startsWith(lit.toLowerCase()));
      if (longer) return `No ${m[1]} is exactly '${lit}'. In this table it's written '${longer}'. Values must match exactly.`;
      return `No ${m[1]} is exactly '${lit}'. Run the query without WHERE first to see how the values are written.`;
    }
    for (const lit of literals(sql)) {
      if (DB.knownValues.includes(lit)) continue;
      const sameCase = DB.knownValues.find((v) => v.toLowerCase() === lit.toLowerCase());
      if (sameCase) return `Nothing came back. Values must match exactly, capitals too: it's '${sameCase}', not '${lit}'.`;
      const longer = DB.knownValues.find((v) => v.toLowerCase().startsWith(lit.toLowerCase()));
      if (longer) return `No matches for '${lit}'. The database writes it as '${longer}'. Values must match exactly.`;
    }
    return "Your query ran but found nothing. Check that the value you're filtering on is spelled exactly as it appears in the table.";
  }

  if (/\b(SUM|COUNT|AVG|MAX|MIN)\s*\(/.test(upper) && !/GROUP\s+BY/.test(upper) && got === 1 && want > 1) {
    return "That's one total for everyone added together. To get one row per person, add GROUP BY and the column to split by.";
  }

  if (/\bOR\b/.test(upper) && /\bAND\b/.test(answerUpper) && !/\bAND\b/.test(upper)) {
    return "OR keeps rows that match either condition, so extra rows got in. You want rows that match both: use AND.";
  }

  if (/\bDESC\b/.test(answerUpper) && /ORDER\s+BY/.test(upper) && !/\bDESC\b/.test(upper)) {
    return "ORDER BY sorts smallest first. To put the biggest first, add DESC after the column: ORDER BY amount DESC";
  }

  if (got === want) {
    if (matches(expected, result, undefined)) {
      if (/\bDESC\b/.test(answerUpper) && !/\bDESC\b/.test(upper)) {
        return "Right rows, wrong order. ORDER BY sorts smallest first unless you add DESC after the column.";
      }
      if (!/\bDESC\b/.test(answerUpper) && /\bDESC\b/.test(upper)) {
        return "Right rows, but upside down. DESC puts the biggest or latest first. Without it, ORDER BY goes smallest or earliest first.";
      }
      return "Right rows, wrong order. Check which column you put after ORDER BY.";
    }
    const gb = (s) => ((s.match(/GROUP\s+BY\s+(\w+)/i) || [])[1] || "").toLowerCase();
    if (gb(bare) && gb(task.answer) && gb(bare) !== gb(task.answer)) {
      return `You grouped by ${gb(bare)}. Think about which column the question is really asking you to split by.`;
    }
    return "Right number of rows, but the values are different. Check which columns you chose and what you're filtering on.";
  }

  if (got > want) {
    if (/\bWHERE\b/.test(answerUpper) && !/\bWHERE\b/.test(upper)) {
      return `That's every row (${got}). Add WHERE to keep only the rows the question asks for.`;
    }
    const limit = task.answer.match(/LIMIT\s+(\d+)/i);
    if (limit && !/\bLIMIT\b/.test(upper)) {
      return `The order looks right, but you have ${got} rows. Keep just the top ${limit[1]} with LIMIT ${limit[1]} at the end.`;
    }
    return `You got ${got} rows, but the answer has ${want}. Your filter is letting extra rows through.`;
  }

  return `You got ${got} rows, but the answer has ${want}. Your filter is stricter than it needs to be.`;
}

// Gentle notes for answers that work here but are bad habits elsewhere.
function styleNote({ sql, bare }) {
  if (/==/.test(bare)) return "Correct! One habit to fix: standard SQL uses a single = to compare. Most databases reject ==.";
  const dq = sql.match(/"([^"]*)"/);
  if (dq && DB.knownValues.includes(dq[1])) {
    return `Correct! One habit to fix: use 'single quotes' for text. Many databases read "double quotes" as a column name.`;
  }
  return null;
}

// ---------- helpers ----------

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// Replaces the inside of 'text' with blanks, so keywords inside quotes are ignored.
function withoutStrings(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

function literals(sql) {
  return [...sql.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

function allColumns() {
  return [...new Set(Object.values(DB.schema).flat())];
}

function closest(word, options) {
  const w = word.toLowerCase();
  let best = null;
  let bestD = 3;
  for (const o of options) {
    const d = levenshtein(w, o.toLowerCase());
    if (d < bestD) { best = o; bestD = d; }
  }
  if (best) return best;
  // "badges" -> "badge_swipes", "enteredby" -> "entered_by"
  const squash = (s) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
  return options.find((o) => w.length >= 4 && (squash(o).startsWith(squash(w)) || squash(w) === squash(o))) || null;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}
