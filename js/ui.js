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
    $("#phone-time").textContent = text.replace(/\s*[AP]M$/, ""); // the status bar drops AM/PM, like iOS
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

// ---------- phone: a Messages app with one thread per contact ----------

// The thread for each message in one list. Your own messages (me: true) go to the nearest
// other sender in the same list: the one before, or else the one after. to: "Name" overrides.
function assignThreads(list, fallback) {
  return list.map((m, i) => {
    if (m.to) return m.to;
    if (!m.me) return m.from || fallback;
    for (let j = i - 1; j >= 0; j--) if (!list[j].me && list[j].from) return list[j].from;
    for (let j = i + 1; j < list.length; j++) if (!list[j].me && list[j].from) return list[j].from;
    return fallback;
  });
}

const Phone = {
  game: null,
  current: null,  // the open thread, or null for the conversation list
  typingIn: null, // the thread someone is typing in

  init(game) {
    this.game = game;
    const s = game.s;
    // Old saves: messages had no thread or time. Sort them into threads now.
    if (!Array.isArray(s.phone)) s.phone = [];
    if (s.phone.some((m) => !m.thread)) {
      const threads = assignThreads(s.phone, UNKNOWN);
      s.phone.forEach((m, i) => { m.thread ||= threads[i]; if (m.at === undefined) m.at = null; });
    }
    if (!s.unread || typeof s.unread !== "object") s.unread = {};
    this.current = null;

    // Nothing in here may reach the scene: clicks on the phone never advance the story.
    $("#phone").onclick = (e) => { e.stopPropagation(); if (!this.isUp()) this.raise(); };
    $("#phone-lower").onclick = (e) => { e.stopPropagation(); e.currentTarget.blur(); this.lower(); };
    $("#phone-back").onclick = () => this.openThread(null);
    if (!this._watching) {
      // The phone also works on top of the SQL terminal.
      this._watching = true;
      new MutationObserver(() => this.layout()).observe($("#terminal"), { attributes: true, attributeFilter: ["hidden"] });
      window.addEventListener("resize", () => this.layout());
    }
    this.layout();
    this.render();
  },

  isUp() { return $("#phone").classList.contains("up"); },
  isShowing(thread) { return this.isUp() && this.current === thread; },
  name(thread) { return thread === UNKNOWN && this.game.s.flags.revealed ? "Marcus (burner)" : thread; },

  raise(thread) {
    if (thread) this.current = thread;
    $("#phone").classList.add("up");
    this.layout();
    this.markRead();
    this.render();
  },
  lower() {
    $("#phone").classList.remove("up");
    this.layout();
    this.render();
  },
  openThread(thread) {
    this.current = thread;
    this.markRead();
    this.render();
  },
  // Not saved here: the game saves at the start of each beat, so a Continue never replays
  // a texts beat on top of messages it already delivered.
  markRead() {
    if (!this.isUp() || !this.current) return;
    delete this.game.s.unread[this.current];
    this.closeBanners(this.current);
  },

  // The raised phone always sits in the same spot. While the terminal is open, the terminal
  // pads its right side so the phone never covers the editor, question or results; it may
  // overlap the edge of the feed column.
  layout() {
    const term = !$("#terminal").hidden;
    const over = term && this.isUp();
    document.body.classList.toggle("term-open", term);
    const terminal = $("#terminal");
    terminal.style.paddingRight = "";
    if (!over) return;
    const W = window.innerWidth;
    const left = $("#phone").getBoundingClientRect().left; // includes the tilt; translateY doesn't move it sideways
    if (W > 980) {
      const cs = getComputedStyle(terminal);
      const padL = parseFloat(cs.paddingLeft);
      const base = padL; // the right padding may be mid-transition; the left always matches its resting value
      const feedW = $(".term-feed").getBoundingClientRect().width;
      const maxW = parseFloat(getComputedStyle($(".term-window")).maxWidth);
      // The window's right edge may reach this far: the main column ends a feed-width before it.
      const right = left - 16 + feedW;
      // The window is centred once max-width caps it, so its right edge moves half as fast as the padding.
      const pad = right - padL <= maxW ? W - right : W + padL + maxW - 2 * right;
      if (pad > base) terminal.style.paddingRight = `${Math.ceil(pad)}px`;
    } else {
      // One-column terminal: make room beside the phone instead.
      terminal.style.paddingRight = `${W - left + 12}px`;
    }
  },

  // A message was just added to the log.
  receive(m) {
    if (!m.me && !this.isShowing(m.thread)) {
      this.game.s.unread[m.thread] = (this.game.s.unread[m.thread] || 0) + 1;
      this.banner(m);
    }
    this.render();
  },
  typing(thread) {
    this.typingIn = thread;
    if (this.current) this.render();
  },

  render() {
    if (!this.game) return;
    const s = this.game.s;
    const total = Object.values(s.unread).reduce((a, n) => a + n, 0);
    const badge = $("#phone-badge");
    badge.hidden = !total || this.isUp();
    badge.textContent = String(total);
    const inThread = !!this.current;
    $("#phone-head").className = "phone-head " + (inThread ? "thread" : "list");
    $("#phone-title").hidden = inThread;
    $("#phone-back").hidden = !inThread;
    $("#phone-contact").hidden = !inThread;
    $("#phone-list").hidden = inThread;
    $("#phone-log").hidden = !inThread;
    $("#phone-input").hidden = !inThread;
    if (inThread) {
      const name = this.name(this.current);
      $("#phone-avatar").textContent = initial(name);
      $("#phone-name").textContent = name;
      this.renderThread();
    } else {
      this.renderList();
    }
  },

  renderList() {
    const s = this.game.s;
    const box = $("#phone-list");
    box.innerHTML = "";
    const last = new Map(); // thread -> its newest message, in order of last activity
    for (const m of s.phone) { last.delete(m.thread); last.set(m.thread, m); }
    if (!last.size) box.append(el("p", "phone-empty", "No messages yet."));
    for (const [thread, m] of [...last].reverse()) {
      const unread = s.unread[thread] || 0;
      const name = this.name(thread);
      const row = el("button", "convo" + (unread ? " unread" : ""));
      row.type = "button";
      row.setAttribute("aria-label", `${name}${unread ? `, ${unread} unread` : ""}: ${m.text}`);
      const body = el("span", "convo-body");
      const top = el("span", "convo-top");
      top.append(el("span", "convo-name", name), el("span", "convo-time", stamp(m.at)));
      body.append(top, el("span", "convo-preview", m.text));
      row.append(el("span", "convo-dot"), el("span", "avatar", initial(name)), body);
      row.onclick = () => this.openThread(thread);
      box.append(row);
    }
  },

  renderThread() {
    const box = $("#phone-log");
    box.innerHTML = "";
    // A time header starts a new group whenever the in-game time changes.
    let lastAt = null;
    const items = this.game.s.phone.filter((x) => x.thread === this.current).slice(-60).map((m) => {
      const header = m.at !== null && m.at !== undefined && m.at !== lastAt;
      if (header) lastAt = m.at;
      return { m, header };
    });
    let lastMine = -1;
    items.forEach(({ m }, k) => { if (m.me) lastMine = k; });
    const typing = this.typingIn === this.current;
    items.forEach(({ m, header }, k) => {
      if (header) box.append(el("div", "msg-time", stamp(m.at)));
      if (!m.me && m.from !== this.current) box.append(el("div", "msg-from", this.name(m.from)));
      // Only the last bubble of a run from the same person gets a tail.
      const next = items[k + 1];
      const tail = next ? next.header || next.m.me !== m.me || next.m.from !== m.from : !(typing && !m.me);
      box.append(el("div", "msg" + (m.me ? " me" : "") + (tail ? " tail" : ""), m.text));
      if (k === lastMine) box.append(el("div", "msg-receipt", "Delivered"));
    });
    if (typing) {
      const t = el("div", "msg typing tail");
      t.setAttribute("aria-label", "typing");
      t.append(el("i"), el("i"), el("i"));
      box.append(t);
    }
    box.scrollTop = box.scrollHeight;
  },

  // ---------- banners beside the phone ----------
  banner(m) {
    const stack = $("#banners");
    const name = this.name(m.thread);
    const card = el("button", "banner");
    card.type = "button";
    card.dataset.thread = m.thread;
    card.append(el("span", "avatar", initial(name)), el("span", "banner-name", name), el("span", "banner-now", "now"), el("span", "banner-text", m.text));
    card.setAttribute("aria-label", `Message from ${name}: ${m.text}`);
    card.onclick = (e) => { e.stopPropagation(); this.raise(m.thread); };
    stack.append(card);
    const max = window.innerWidth > 980 ? 3 : 2;
    const live = [...stack.children].filter((c) => !c.classList.contains("off"));
    live.slice(0, Math.max(0, live.length - max)).forEach((c) => this.dropBanner(c));
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("on")));

    // On screen at least 6 seconds, longer for longer messages. Hovering pauses the timer.
    let left = Math.min(10000, Math.max(6000, 3000 + m.text.length * 60));
    let started = 0;
    const run = () => { started = Date.now(); card._timer = setTimeout(() => this.dropBanner(card), left); };
    card.onmouseenter = () => { clearTimeout(card._timer); left -= Date.now() - started; };
    card.onmouseleave = () => { left = Math.max(left, 2000); run(); };
    run();
    Sound.buzz();
  },
  dropBanner(card) {
    if (card.classList.contains("off")) return;
    clearTimeout(card._timer);
    card.onmouseenter = card.onmouseleave = null;
    card.classList.remove("on");
    card.classList.add("off");
    setTimeout(() => card.remove(), 350);
  },
  closeBanners(thread) {
    for (const c of [...$("#banners").children]) if (c.dataset.thread === thread) this.dropBanner(c);
  },
};

// In-game time of a message, or nothing before the clock starts.
function stamp(at) { return at === null || at === undefined ? "" : fromMinutes(at); }
function initial(name) { return name === UNKNOWN ? "?" : name.charAt(0).toUpperCase(); }

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
