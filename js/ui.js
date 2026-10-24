// ui.js - everything the player sees, except the SQL terminal (terminal.js).

const $ = (sel, root = document) => root.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

const UI = {
  sceneToken: 0,

  // ---------- the scene image ----------
  setScene(b) {
    const frame = $("#frame");
    frame.classList.toggle("dark", !!b.dark);
    frame.classList.toggle("flicker", !!b.flicker);
    frame.classList.toggle("still", !!b.still);
    if (!b.image) return;
    const token = ++this.sceneToken;
    const src = "images/" + b.image;
    const bg = $("#bg");
    const ph = $("#placeholder");
    const show = (ok) => {
      if (token !== this.sceneToken) return;
      bg.classList.remove("in");
      void bg.offsetWidth; // restart the slow camera drift
      if (ok) {
        bg.style.backgroundImage = `url("${src}")`;
        ph.hidden = true;
      } else {
        bg.style.backgroundImage = "";
        ph.hidden = false;
        $("#ph-label").textContent = `Image to come: ${b.image}`;
        $("#ph-shot").textContent = b.shot || "";
      }
      bg.classList.add("in");
    };
    const img = new Image();
    img.onload = () => show(true);
    img.onerror = () => show(false);
    img.src = src;
  },

  subtitle(text) {
    const box = $("#subtitle");
    $("#sub-text").textContent = text || "";
    box.classList.toggle("on", !!text);
  },
  more(on) { $("#sub-more").hidden = !on; },

  // ---------- HUD ----------
  clock(text, lostMin) {
    $("#clock").textContent = text;
    $("#lost").textContent = lostMin ? `−${lostMin} min` : "";
  },
  evidence(n) { $("#evidence-count").textContent = n; },

  // ---------- chapter cards ----------
  async chapter(title, sub, big) {
    const c = $("#chapter");
    $("#chapter-title").textContent = title;
    $("#chapter-sub").textContent = sub || "";
    c.classList.toggle("big", !!big);
    c.hidden = false;
    await sleep(30);
    c.classList.add("on");
  },
  async chapterOff() {
    const c = $("#chapter");
    c.classList.remove("on");
    await sleep(600);
    c.hidden = true;
  },

  // ---------- phone ----------
  phoneUp(up) { $("#phone").classList.toggle("up", up); },
  renderPhone(log) {
    const box = $("#phone-log");
    box.innerHTML = "";
    let last = null;
    for (const m of log.slice(-40)) {
      const who = m.me ? "me" : m.from;
      if (!m.me && who !== last) box.append(el("div", "msg-from", m.from));
      box.append(el("div", "msg" + (m.me ? " me" : ""), m.text));
      last = who;
    }
    const t = el("div", "typing");
    t.id = "typing";
    t.hidden = true;
    box.append(t);
    box.scrollTop = box.scrollHeight;
  },
  typing(from) {
    const t = $("#typing");
    if (!t) return;
    t.hidden = !from;
    t.textContent = from ? `${from} is typing…` : "";
    $("#phone-log").scrollTop = $("#phone-log").scrollHeight;
  },

  // ---------- notifications, toasts, sticky notes ----------
  notify(title, text) {
    const n = $("#notify");
    $("#notify-title").textContent = title || "";
    $("#notify-text").textContent = text || "";
    n.classList.toggle("on", !!title);
  },
  toast(text, ms = 3200) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("on");
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove("on"), ms);
  },
  sticky(term, def) {
    const s = $("#sticky");
    $("#sticky-term").textContent = term;
    $("#sticky-def").textContent = def;
    s.classList.add("on");
  },
  stickyOff() { $("#sticky").classList.remove("on"); },

  // ---------- timed choice ----------
  choice({ speaker, prompt, options, seconds }) {
    return new Promise((resolve) => {
      const box = $("#choice");
      $("#choice-speaker").textContent = speaker || "";
      $("#choice-prompt").textContent = prompt;
      const list = $("#choice-options");
      list.innerHTML = "";
      let done = false;
      const finish = (i) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        document.removeEventListener("keydown", onKey);
        box.classList.remove("on");
        setTimeout(() => { box.hidden = true; }, 300);
        resolve(i);
      };
      options.forEach((o, i) => {
        const btn = el("button", "choice-btn");
        btn.type = "button";
        btn.append(el("span", "choice-key", String(i + 1)), el("span", "choice-label", o.label));
        btn.onclick = () => finish(i);
        list.append(btn);
      });
      const bar = $("#choice-bar");
      bar.style.transition = "none";
      bar.style.transform = "scaleX(1)";
      box.hidden = false;
      void bar.offsetWidth;
      box.classList.add("on");
      bar.style.transition = `transform ${seconds}s linear`;
      bar.style.transform = "scaleX(0)";
      const timer = setTimeout(() => finish(-1), seconds * 1000);
      const onKey = (e) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= options.length) { e.preventDefault(); finish(n - 1); }
      };
      document.addEventListener("keydown", onKey);
    });
  },

  // ---------- searching an image ----------
  search(b, onClue) {
    return new Promise((resolve) => {
      const layer = $("#hotspots");
      layer.innerHTML = "";
      layer.hidden = false;
      const leave = $("#search-leave");
      leave.hidden = true;
      leave.textContent = (b.leave || "Move on") + " ▸";
      let found = false;
      for (const s of b.spots) {
        const btn = el("button", "spot");
        btn.type = "button";
        Object.assign(btn.style, { left: s.x + "%", top: s.y + "%", width: (s.w || 10) + "%", height: (s.h || 10) + "%" });
        btn.setAttribute("aria-label", s.label);
        btn.append(el("span", "spot-label", s.label));
        btn.onclick = (e) => {
          e.stopPropagation();
          btn.classList.add("seen");
          UI.subtitle(s.text);
          Sound.key();
          if (s.clue) onClue(s.clue);
          if (s.key && !found) { found = true; leave.hidden = false; }
        };
        layer.append(btn);
      }
      leave.onclick = (e) => {
        e.stopPropagation();
        layer.hidden = true;
        leave.hidden = true;
        UI.subtitle("");
        resolve();
      };
    });
  },

  // ---------- report & ending ----------
  report(pins) {
    return new Promise((resolve) => {
      const box = $("#report");
      const list = $("#report-list");
      list.innerHTML = "";
      for (const p of pins) {
        const item = el("li", "report-item");
        item.append(el("strong", "", p.title), el("code", "", p.sql));
        if (p.note) item.append(el("p", "", "“" + p.note + "”"));
        list.append(item);
      }
      $("#report-count").textContent = `${pins.length} piece${pins.length === 1 ? "" : "s"} of evidence`;
      box.hidden = false;
      $("#report-send").onclick = () => { box.hidden = true; resolve(); };
    });
  },

  endingCard(title, tag, number) {
    return new Promise((resolve) => {
      const box = $("#ending");
      $("#ending-label").textContent = `Ending ${number} of 4`;
      $("#ending-title").textContent = title;
      $("#ending-tag").textContent = tag;
      box.hidden = false;
      requestAnimationFrame(() => box.classList.add("on"));
      const done = (v) => { box.classList.remove("on"); box.hidden = true; resolve(v); };
      $("#ending-retry").onclick = () => done("retry");
      $("#ending-next").onclick = () => done("next");
    });
  },
};

// ---------- notebook (press N) ----------
const Notebook = {
  open(game) {
    const s = game.s;
    const d = $("#notebook");
    $("#nb-notes").value = s.notes || "";
    $("#nb-notes").oninput = (e) => { s.notes = e.target.value; game.save(); };

    const ev = $("#nb-evidence");
    ev.innerHTML = "";
    if (!s.pins.length) ev.append(el("p", "nb-empty", "Nothing pinned yet. After a query works, pin it as evidence."));
    s.pins.forEach((p) => {
      const item = el("div", "nb-pin");
      item.append(el("strong", "", p.title), el("code", "", p.sql));
      const input = el("input", "nb-pin-note");
      input.value = p.note || "";
      input.placeholder = "What does this prove? In your own words";
      input.setAttribute("aria-label", "Note for " + p.title);
      input.oninput = () => { p.note = input.value; game.save(); };
      item.append(input);
      ev.append(item);
    });
    const clues = $("#nb-clues");
    clues.innerHTML = "";
    if (!s.clues.length) clues.append(el("li", "nb-empty", "No clues yet."));
    s.clues.forEach((c) => clues.append(el("li", "", c)));

    const cheat = $("#nb-cheat");
    cheat.innerHTML = "";
    if (!s.learned.length) cheat.append(el("p", "nb-empty", "Each new SQL skill appears here once you've used it."));
    s.learned.forEach(([k, v]) => {
      const row = el("div", "nb-cheat-row");
      row.append(el("code", "", k), el("span", "", v));
      cheat.append(row);
    });
    const terms = $("#nb-terms");
    terms.innerHTML = "";
    if (!s.terms.length) terms.append(el("p", "nb-empty", "No terms yet."));
    s.terms.forEach(([t, def]) => {
      const row = el("div", "nb-term");
      row.append(el("strong", "", t), el("span", "", def));
      terms.append(row);
    });
    if (!d.open) d.showModal();
  },
};
