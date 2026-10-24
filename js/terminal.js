// terminal.js - the SQL terminal: tables panel, editor, results, feedback, hints and pinning.

const HINT_COST = 5; // minutes lost for hint 2 and hint 3 (hint 1 is free)

const Terminal = {
  // Shows the terminal for a query beat. Resolves when the player continues.
  open(b, game) {
    return new Promise((resolve) => {
      const s = game.s;
      const st = game.stat(b);
      const voice = typeof b.voice === "function" ? b.voice(s.flags) : b.voice || "Unknown";
      const input = $("#term-input");
      let solved = false;
      let hintLevel = 0;

      this.show(b, game);
      $("#term-editor").hidden = false;
      $("#term-predict").hidden = true;
      $("#feed-title").textContent = voice;
      $("#term-feed").innerHTML = "";
      input.value = b.template || "";
      input.readOnly = false;

      const hintBtn = $("#term-hint");
      const hints = b.challenge ? [] : b.hints || [];
      const setHintLabel = () => {
        hintBtn.hidden = !hints.length;
        if (hintLevel >= hints.length) { hintBtn.textContent = "No more hints"; hintBtn.disabled = true; return; }
        hintBtn.disabled = false;
        hintBtn.textContent = hintLevel === 0 ? "Hint (free)" : `Another hint (−${HINT_COST} min)`;
      };
      setHintLabel();

      const skipBtn = $("#term-skip");
      skipBtn.hidden = !(b.challenge || b.optional);
      skipBtn.textContent = b.challenge ? "I don't know yet" : "Skip this";

      const say = (text, kind = "") => {
        const m = el("div", "feed-msg " + kind, text);
        $("#term-feed").append(m);
        m.scrollIntoView({ block: "nearest" });
      };
      if (b.challenge === "before") say("No hints for this one. Just try. It's fine to skip.");
      if (b.challenge === "after") say("Same question as before. No hints.");

      const finish = (outcome) => {
        input.onkeydown = null;
        this.hide();
        resolve(outcome);
      };

      const run = () => {
        if (solved) return;
        const r = Checker.check(b, input.value);
        $("#term-results").innerHTML = "";
        $("#term-status").textContent = "";
        $("#term-status").className = "";
        if (r.result) this.renderResult(r.result);

        if (["empty", "blank", "blocked"].includes(r.status)) {
          say(r.message, "warn");
          Sound.error();
          return;
        }
        st.attempts++;
        if (r.status === "error") {
          st.errors++;
          st.mistakes.push(r.message);
          $("#term-status").textContent = "Database error: " + r.raw;
          $("#term-status").className = "bad";
          say(r.message, "warn");
          Sound.error();
          return;
        }
        if (r.status === "wrong") {
          st.wrong++;
          st.mistakes.push(r.message);
          $("#term-status").textContent = "It ran, but this isn't the answer yet.";
          $("#term-status").className = "meh";
          say(r.message, "warn");
          Sound.error();
          return;
        }
        // correct
        solved = true;
        st.solved = true;
        st.firstTry = st.attempts === 1;
        input.readOnly = true;
        $("#term-status").textContent = "Correct.";
        $("#term-status").className = "good";
        if (r.note) say(r.note);
        Sound.success();
        if (b.challenge) s[b.challenge] = { solved: true, attempts: st.attempts };
        for (const l of b.learn || []) {
          if (!s.learned.some((x) => x[0] === l[0])) s.learned.push(l);
        }
        this.showSuccess(b, game, input.value, () => finish("solved"));
      };

      input.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); return; }
        if (e.key.length === 1) Sound.key();
      };
      // No pasting or dropping text in: typing it is the lesson. Column clicks still insert.
      input.onpaste = input.ondrop = (e) => {
        e.preventDefault();
        UI.toast("Type it yourself, that's how it sticks.");
      };
      $("#term-run").onclick = run;
      hintBtn.onclick = () => {
        if (hintLevel >= hints.length) return;
        if (hintLevel > 0) game.loseTime(HINT_COST);
        say(hints[hintLevel], "hint");
        hintLevel++;
        st.hints++;
        setHintLabel();
        input.focus();
      };
      skipBtn.onclick = () => {
        if (b.challenge) s[b.challenge] = { solved: false, attempts: st.attempts, skipped: true };
        st.skipped = true;
        finish("skipped");
      };

      input.focus();
      const blank = input.value.indexOf("___");
      if (blank >= 0) input.setSelectionRange(blank, blank + 3);
    });
  },

  // Predict-the-output beat.
  predict(b, game) {
    return new Promise((resolve) => {
      this.show(b, game);
      $("#term-editor").hidden = true;
      $("#term-predict").hidden = false;
      $("#feed-title").textContent = "Unknown";
      $("#term-feed").innerHTML = "";
      $("#predict-code").textContent = b.query;
      $("#predict-question").textContent = b.question;
      const opts = $("#predict-options");
      opts.innerHTML = "";
      const after = $("#predict-after");
      after.hidden = true;
      b.options.forEach((o, i) => {
        const btn = el("button", "predict-btn", o);
        btn.type = "button";
        btn.onclick = () => {
          const right = i === b.answer;
          game.s.stats[b.id] = { title: b.title, kind: "predict", solved: right, attempts: 1, hints: 0, mistakes: [] };
          [...opts.children].forEach((c, j) => {
            c.disabled = true;
            if (j === b.answer) c.classList.add("right");
            else if (j === i) c.classList.add("wrong");
          });
          const m = el("div", "feed-msg " + (right ? "" : "warn"), (right ? "Right. " : "Not quite. ") + b.explain);
          $("#term-feed").append(m);
          right ? Sound.success() : Sound.error();
          this.renderResult(DB.query(b.query));
          after.hidden = false;
          $("#predict-continue").focus();
        };
        opts.append(btn);
      });
      $("#predict-continue").onclick = () => { this.hide(); resolve(); };
    });
  },

  show(b, game) {
    const t = $("#terminal");
    $("#term-label").textContent = b.label || "";
    $("#term-question").textContent = b.question || "";
    $("#term-keywords").textContent = b.keywords ? "Hint: " + b.keywords : "";
    $("#term-keywords").hidden = !b.keywords;
    const tool = $("#term-tool");
    tool.innerHTML = "";
    tool.hidden = !(b.tool && b.tool.length);
    for (const line of b.tool || []) tool.append(el("p", "", line));
    $("#term-results").innerHTML = "";
    $("#term-status").textContent = "";
    $("#term-success").hidden = true;
    this.renderTables(game);
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add("on"));
  },

  hide() {
    const t = $("#terminal");
    t.classList.remove("on");
    t.hidden = true;
  },

  renderTables(game) {
    const box = $("#term-tables");
    box.innerHTML = "";
    for (const [name, cols] of Object.entries(DB.schema)) {
      if (name === "badge_swipes" && !game.s.flags.badges) continue;
      const t = el("div", "tbl");
      t.append(el("div", "tbl-name", name));
      const list = el("div", "tbl-cols");
      for (const c of cols) {
        const btn = el("button", "col", c);
        btn.type = "button";
        btn.title = "Insert " + c;
        btn.onclick = () => insertAtCursor($("#term-input"), c);
        list.append(btn);
      }
      t.append(list);
      box.append(t);
    }
  },

  renderResult(res) {
    const box = $("#term-results");
    box.innerHTML = "";
    const n = res.rows.length;
    box.append(el("div", "res-count", `${n} row${n === 1 ? "" : "s"}`));
    if (!res.columns.length) return;
    const wrap = el("div", "res-wrap");
    const table = el("table", "res");
    const head = el("tr");
    res.columns.forEach((c) => head.append(el("th", "", c)));
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    const MAX = 80;
    res.rows.slice(0, MAX).forEach((r) => {
      const tr = el("tr");
      r.forEach((v) => tr.append(el("td", typeof v === "number" ? "num" : "", v === null ? "NULL" : String(v))));
      body.append(tr);
    });
    table.append(body);
    wrap.append(table);
    box.append(wrap);
    if (n > MAX) box.append(el("div", "res-count", `…and ${n - MAX} more rows`));
  },

  showSuccess(b, game, sql, onContinue) {
    const box = $("#term-success");
    const lines = typeof b.success === "function" ? b.success(game.s) : b.success || [];
    const out = $("#success-lines");
    out.innerHTML = "";
    lines.forEach((l) => out.append(el("p", "", l)));
    const canPin = !b.challenge && b.pin !== false;
    $("#pin-row").hidden = !canPin;
    const note = $("#pin-note");
    note.value = "";
    const pinBtn = $("#pin-btn");
    pinBtn.disabled = false;
    pinBtn.textContent = "Pin as evidence";
    pinBtn.onclick = () => {
      game.pin(b, sql.trim(), note.value.trim());
      pinBtn.textContent = "Pinned ✓";
      pinBtn.disabled = true;
    };
    box.hidden = false;
    $("#term-continue").onclick = onContinue;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setTimeout(() => (canPin ? note : $("#term-continue")).focus(), 50);
    note.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); pinBtn.click(); $("#term-continue").focus(); } };
  },
};

function insertAtCursor(input, text) {
  if (input.readOnly) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.selectionStart = input.selectionEnd = start + text.length;
  input.focus();
}
