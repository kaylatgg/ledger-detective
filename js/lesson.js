// lesson.js - "How a query works": a short click-through of SELECT, FROM and WHERE on real rows,
// shown before the first query. Also reopens from the terminal sidebar as a read-only refresher.

const LESSON_SQL = [
  ["select", "SELECT trader, amount"],
  ["from", "FROM trades"],
  ["where", "WHERE account = 'error'"],
];
const LESSON_STEPS = [
  {
    text: "SELECT picks which columns to show. Click the two columns this query shows.",
    wrong: () => "Not that one. Look at the names right after SELECT.",
    done: "Only trader and amount make it into the answer. Tip: SELECT * means every column. You'll use it in a moment.",
  },
  {
    text: "FROM picks which table to look in. Click the table this query uses.",
    wrong: () => "traders is the list of people. Check the word after FROM.",
    done: "Every row comes from the trades table.",
  },
  {
    text: (n) => `WHERE keeps only the rows that match, and text like 'error' goes in quotes. Click the ${n === 1 ? "row" : `${n} rows`} it keeps.`,
    wrong: (account) => `This row's account is ${account}, so WHERE leaves it out.`,
    done: "Only rows where account is exactly 'error' stay.",
  },
  {
    text: "Put together, a query reads like a sentence. Now write one yourself.",
  },
];
const LESSON_COLS = ["trader", "amount"];

const Lesson = {
  // Plays the lesson as a story beat. Resolves when the player finishes it.
  open() {
    return new Promise((resolve) => this.show(false, resolve));
  },

  // Read-only refresher from the terminal sidebar: every answer already shown.
  refresher() {
    const back = document.activeElement;
    this.show(true, () => back && back.focus && back.focus());
  },

  show(review, onClose) {
    const data = this.rows();
    const keep = data.rows.filter((r) => r[data.account] === "error").map((r) => r[0]);
    this.st = {
      review, data, keep, onClose, step: 0,
      cols: new Set(review ? LESSON_COLS : []),
      table: review,
      rows: new Set(review ? keep : []),
    };
    const box = $("#lesson");
    box.hidden = false;
    box.onkeydown = (e) => { if (e.key === "Escape" && review) { e.stopPropagation(); this.close(); } };
    this.render();
  },

  close() {
    $("#lesson").hidden = true;
    $("#lesson").onkeydown = null;
    const done = this.st.onClose;
    this.st = null;
    done();
  },

  // Five real rows from trades, at least one of them in the error account.
  rows() {
    let r = DB.query("SELECT * FROM trades ORDER BY id LIMIT 5");
    const account = r.columns.indexOf("account");
    if (!r.rows.some((row) => row[account] === "error")) {
      const err = DB.query("SELECT * FROM trades WHERE account = 'error' ORDER BY id LIMIT 1").rows;
      const rest = DB.query("SELECT * FROM trades WHERE account <> 'error' ORDER BY id LIMIT 4").rows;
      r = { columns: r.columns, rows: [...rest, ...err].sort((a, b) => a[0] - b[0]) };
    }
    return { ...r, account };
  },

  isDone(step) {
    const st = this.st;
    if (step === 0) return LESSON_COLS.every((c) => st.cols.has(c));
    if (step === 1) return st.table;
    if (step === 2) return st.keep.every((id) => st.rows.has(id));
    return true;
  },

  // ---------- drawing ----------

  render() {
    const st = this.st;
    const step = st.step;
    const def = LESSON_STEPS[step];
    $("#lesson-count").textContent = step < 3 ? `Step ${step + 1} of 3` : "Put together";
    $("#lesson-close").hidden = !st.review;
    $("#lesson-close").onclick = () => this.close();

    const body = $("#lesson-body");
    body.replaceChildren();

    // The query so far, coloured like the translation chips. The newest part is marked.
    const code = el("pre", "lesson-code");
    LESSON_SQL.slice(0, Math.min(step + 1, 3)).forEach(([kind, text], i) => {
      if (i) code.append("\n");
      code.append(el("span", `q-${kind}${i === step ? " q-new" : ""}`, text));
    });
    body.append(code);

    const text = el("p", "lesson-text", typeof def.text === "function" ? def.text(st.keep.length) : def.text);
    text.tabIndex = -1;
    body.append(text);

    if (step === 1) body.append(this.tablePicker());
    if (step === 3) {
      const tr = el("div", "lesson-translate");
      Translate.render(tr, LESSON_SQL.map((p) => p[1]).join(" "));
      body.append(tr);
    }
    body.append(this.table());

    const say = el("p", "lesson-say");
    say.id = "lesson-say";
    say.setAttribute("aria-live", "polite");
    body.append(say);

    $("#lesson-back").hidden = step === 0;
    $("#lesson-back").onclick = () => { st.step--; this.render(); };
    const next = $("#lesson-next");
    next.textContent = step < 3 ? "Next ▸" : st.review ? "Close" : "Write your first query ▸";
    next.onclick = () => {
      if (step < 3) { st.step++; this.render(); } else this.close();
    };
    this.update();
    text.focus();
  },

  // Step 2's choice between two table names.
  tablePicker() {
    const st = this.st;
    const wrap = el("div", "lesson-tables");
    for (const name of ["trades", "traders"]) {
      const b = el("button", "pick lesson-table", name);
      b.type = "button";
      b.dataset.table = name;
      b.disabled = st.review;
      b.onclick = () => {
        if (name === "trades") st.table = true;
        this.update(name === "trades" ? null : LESSON_STEPS[1].wrong());
      };
      wrap.append(b);
    }
    return wrap;
  },

  // The five rows, like a spreadsheet. Headers are buttons in step 1, rows in step 3.
  table() {
    const st = this.st;
    const { columns, rows } = st.data;
    const step = st.step;
    const wrap = el("div", "lesson-grid");
    const cap = el("p", "lesson-caption", st.table && step > 1 ? "trades table · first 5 rows" : "First 5 rows of a table");
    const table = el("table", "lesson-table-grid");
    const head = el("tr");
    if (step === 2) head.append(el("th", "lesson-rowhead", ""));
    for (const c of columns) {
      const th = el("th");
      th.dataset.col = c;
      if (step === 0) {
        const b = el("button", "pick", c);
        b.type = "button";
        b.disabled = st.review;
        b.onclick = () => {
          if (!LESSON_COLS.includes(c)) return this.update(LESSON_STEPS[0].wrong());
          const first = !st.cols.has(c) && st.cols.size === 0;
          st.cols.add(c);
          this.update(first ? `Yes, ${c} is one. Find the other.` : null);
        };
        th.append(b);
      } else th.textContent = c;
      head.append(th);
    }
    const thead = el("thead");
    thead.append(head);
    const tbody = el("tbody");
    for (const r of rows) {
      const tr = el("tr");
      tr.dataset.id = r[0];
      if (step === 2) {
        const td = el("td", "lesson-rowhead");
        const b = el("button", "pick lesson-rowbtn", String(r[0]));
        b.type = "button";
        b.disabled = st.review;
        b.setAttribute("aria-label", `Row ${r[0]}: ` + columns.map((c, i) => `${c} ${r[i]}`).join(", "));
        b.onclick = () => {
          if (!st.keep.includes(r[0])) return this.update(LESSON_STEPS[2].wrong(r[st.data.account]));
          st.rows.add(r[0]);
          this.update(null);
        };
        td.append(b);
        tr.append(td);
      }
      r.forEach((v, i) => {
        const td = el("td", typeof v === "number" ? "num" : "", typeof v === "number" ? v.toLocaleString("en-US") : String(v));
        td.dataset.col = columns[i];
        tr.append(td);
      });
      tbody.append(tr);
    }
    table.append(thead, tbody);
    wrap.append(cap, table);
    return wrap;
  },

  // Lights up what's been found so far, without redrawing (so keyboard focus stays put).
  update(nudge) {
    const st = this.st;
    const body = $("#lesson-body");
    const step = st.step;
    const done = this.isDone(step);
    const showCols = step === 0 ? st.cols : step >= 1 && this.isDone(0) ? new Set(LESSON_COLS) : new Set();
    for (const cell of body.querySelectorAll("[data-col]")) {
      cell.classList.toggle("lit-select", showCols.has(cell.dataset.col));
      cell.classList.toggle("dim", step === 0 && done && !showCols.has(cell.dataset.col));
    }
    for (const b of body.querySelectorAll("[data-table]")) b.classList.toggle("lit-from", st.table && b.dataset.table === "trades");
    const showRows = step >= 2;
    for (const tr of body.querySelectorAll("tr[data-id]")) {
      const id = Number(tr.dataset.id);
      const kept = showRows && (step === 3 ? st.keep.includes(id) : st.rows.has(id));
      tr.classList.toggle("lit-where", kept);
      tr.classList.toggle("dim", showRows && this.isDone(2) && !kept);
    }
    // The finished picture: only the chosen columns of the kept rows stay bright.
    if (step === 3) for (const td of body.querySelectorAll("tbody td[data-col]")) {
      td.classList.toggle("dim", !(LESSON_COLS.includes(td.dataset.col) && st.keep.includes(Number(td.parentNode.dataset.id))));
    }
    const say = $("#lesson-say");
    say.classList.toggle("nudge", !!nudge);
    say.textContent = nudge || (done && step < 3 ? LESSON_STEPS[step].done : "");
    $("#lesson-next").hidden = !done;
  },
};

$("#btn-lesson").onclick = () => Lesson.refresher();
