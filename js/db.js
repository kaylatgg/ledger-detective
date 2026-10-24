// db.js - runs the player's SQL against the case database, entirely in the browser.
// Uses sql.js (real SQLite compiled to WebAssembly). Loads lib/ first, then a CDN.

const SQLJS_CDN = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";

const DB = {
  db: null,
  schema: {},        // { tableName: [column, ...] }
  knownValues: [],   // every distinct text value in the database (for spotting missing quotes)
  columnValues: {},  // { "table.column": [distinct text values] }

  async init() {
    const SQL = await loadSqlJs();
    this.db = new SQL.Database();
    this.db.run(window.CASE_SQL);
    for (const t of ["trades", "traders", "badge_swipes"]) {
      this.schema[t] = this.query(`SELECT * FROM ${t} LIMIT 0`).columns;
    }
    const values = new Set();
    for (const [t, cols] of Object.entries(this.schema)) {
      for (const c of cols) {
        const r = this.query(`SELECT DISTINCT ${c} FROM ${t}`);
        const list = (this.columnValues[`${t}.${c}`.toLowerCase()] ||= []);
        for (const [v] of r.rows) {
          if (typeof v !== "string") continue;
          values.add(v);
          if (!list.includes(v)) list.push(v);
        }
      }
    }
    this.knownValues = [...values];
  },

  // Runs one SELECT. Returns { columns, rows } or throws an Error with SQLite's message.
  query(sql) {
    const stmt = this.db.prepare(sql);
    try {
      const columns = stmt.getColumnNames();
      const rows = [];
      while (stmt.step()) rows.push(stmt.get());
      return { columns, rows };
    } finally {
      stmt.free();
    }
  },
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load " + src));
    document.head.appendChild(s);
  });
}

async function loadSqlJs() {
  // A local copy in lib/ works offline, but only when served (WebStorm, GitHub Pages).
  const bases = location.protocol === "file:" ? [SQLJS_CDN] : ["lib/", SQLJS_CDN];
  let lastError;
  for (const base of bases) {
    try {
      if (!window.initSqlJs) await loadScript(base + "sql-wasm.js");
      return await window.initSqlJs({ locateFile: (f) => base + f });
    } catch (e) {
      lastError = e;
      delete window.initSqlJs;
    }
  }
  throw lastError;
}
