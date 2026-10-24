// game.js - plays STORY (story.js) beat by beat, keeps score, saves progress.

const SAVE_KEY = "ledger-detective-save-v1";
const DEV = new URLSearchParams(location.search).has("dev");
const BELL = toMinutes("9:30 AM");
const MAX_LOST = 45; // hints and mistakes can cost at most this much clock time

function toMinutes(t) {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  let mins = h * 60 + parseInt(m[2], 10);
  if (mins < 12 * 60) mins += 24 * 60; // morning times belong to the next day
  return mins;
}
function fromMinutes(mins) {
  mins %= 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const Game = {
  s: null,
  _advance: null,

  fresh() {
    return {
      i: 0, flags: {}, lost: 0, clock: null, stats: {}, notes: "", pins: [], clues: [], terms: [],
      learned: [], phone: [], unread: {}, before: null, after: null, endingsSeen: [], started: Date.now(),
    };
  },
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { /* storage off: no saving */ } },
  loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { return null; } },
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } },

  stat(b) {
    return (this.s.stats[b.id] ||= { title: b.title, attempts: 0, errors: 0, wrong: 0, hints: 0, firstTry: null, solved: false, mistakes: [] });
  },

  // ---------- main loop ----------
  async run() {
    this.refreshHud();
    Phone.init(this);
    while (this.s.i < STORY.length) {
      const b = STORY[this.s.i];
      if (b.when && !b.when(this.s.flags)) { this.s.i++; continue; }
      this.save();
      if (DEV) $("#dev-beat").value = String(this.s.i);
      const r = await this.play(b);
      if (b.set) { Object.assign(this.s.flags, b.set); Phone.render(); }
      if (r && r.jumpTo) this.s.i = STORY.findIndex((x) => x.id === r.jumpTo);
      else this.s.i++;
    }
  },

  play(b) {
    const fn = this["beat_" + b.type];
    if (!fn) throw new Error("Unknown beat type: " + b.type);
    if (b.time) this.setClock(b.time);
    return fn.call(this, b);
  },

  // Waits for a click on the scene, Space or Enter.
  waitAdvance() {
    UI.more(true);
    return new Promise((res) => {
      this._advance = () => { this._advance = null; UI.more(false); res(); };
    });
  },

  // ---------- clock & evidence ----------
  setClock(t) { this.s.clock = toMinutes(t); this.refreshHud(); },
  loseTime(min) {
    const before = this.s.lost;
    this.s.lost = Math.min(MAX_LOST, this.s.lost + min);
    if (this.s.lost > before) UI.toast(`−${this.s.lost - before} minutes`);
    this.refreshHud();
  },
  refreshHud() {
    UI.clock(this.s.clock === null ? "" : fromMinutes(this.s.clock + this.s.lost), this.s.lost);
    UI.evidence(this.s.pins.length);
  },
  pin(b, sql, note) {
    this.s.pins = this.s.pins.filter((p) => p.id !== b.id);
    this.s.pins.push({ id: b.id, title: b.title, sql, note });
    this.refreshHud();
    this.save();
  },
  addMessage(m) {
    const at = this.s.clock === null ? null : this.s.clock + this.s.lost;
    const msg = { from: m.from || "", text: m.text, me: !!m.me, thread: m.thread, at };
    this.s.phone.push(msg);
    Phone.receive(msg);
    m.me ? Sound.key() : Sound.message();
  },
  // The messages in a list that will actually be sent, each with the thread it belongs to.
  threadMessages(list) {
    const live = list.filter((m) => !m.when || m.when(this.s.flags));
    const last = this.s.phone[this.s.phone.length - 1];
    const threads = assignThreads(live, Phone.current || (last && last.thread) || UNKNOWN);
    return live.map((m, i) => ({ ...m, thread: threads[i] }));
  },
  async sendMessages(msgs) {
    for (const m of msgs) {
      if (m.me) {
        if (Phone.current !== m.thread) Phone.openThread(m.thread);
        await sleep(350);
        this.addMessage(m);
        continue;
      }
      Phone.typing(m.thread);
      await sleep(Math.min(1500, 450 + m.text.length * 14));
      Phone.typing(null);
      const away = !Phone.isShowing(m.thread);
      this.addMessage(m); // shows a banner when its thread isn't open
      if (away) {
        await sleep(1000); // then follow the story into that thread
        Phone.openThread(m.thread);
      }
    }
  },

  // ---------- beats ----------
  async beat_chapter(b) {
    await UI.chapter(b.title, b.sub, b.big);
    if (b.big) Sound.sting();
    await sleep(900);
    await this.waitAdvance();
    await UI.chapterOff();
  },

  async beat_scene(b) {
    UI.setScene(b);
    if (b.sound) Sound[b.sound]();
    for (const line of b.lines || []) {
      UI.subtitle(line);
      await this.waitAdvance();
    }
    UI.subtitle("");
  },

  async beat_texts(b) {
    const msgs = this.threadMessages(b.messages);
    Phone.raise(msgs.length ? msgs[0].thread : null);
    Sound.buzz();
    await sleep(500);
    await this.sendMessages(msgs);
    await this.waitAdvance();
    Phone.lower();
  },

  async beat_notify(b) {
    if (b.sound) Sound[b.sound]();
    UI.notify(b.title, b.text);
    await sleep(500);
    await this.waitAdvance();
    UI.notify(null);
  },

  async beat_sticky(b) {
    if (!this.s.terms.some((t) => t[0] === b.term)) this.s.terms.push([b.term, b.def]);
    UI.sticky(b.term, b.def);
    Sound.key();
    await sleep(400);
    await this.waitAdvance();
    UI.stickyOff();
  },

  async beat_lesson() {
    await Lesson.open();
  },

  async beat_query(b) {
    if (b.unlock) this.s.flags[b.unlock] = true;
    await Terminal.open(b, this);
  },

  async beat_predict(b) {
    await Terminal.predict(b, this);
  },

  async beat_search(b) {
    UI.setScene({ ...b, still: true });
    UI.subtitle(b.prompt);
    await UI.search(b, (clue) => {
      if (!this.s.clues.includes(clue)) {
        this.s.clues.push(clue);
        UI.toast("Added to your notebook (N)");
      }
    });
    $("#frame").classList.remove("still");
  },

  async beat_choice(b) {
    const seconds = typeof b.seconds === "function" ? b.seconds(this.s) : b.seconds;
    const prompt = typeof b.prompt === "function" ? b.prompt(this.s) : b.prompt;
    if (b.sound) Sound[b.sound]();
    Sound.heartbeatOn();
    const i = await UI.choice({ speaker: b.speaker, prompt, options: b.options, seconds });
    Sound.heartbeatOff();

    let opt;
    if (i >= 0) opt = b.options[i];
    else if (b.timeout >= 0) opt = b.options[b.timeout];
    else opt = { set: b.timeoutSet, reply: b.timeoutReply, remember: b.timeoutRemember };
    (this.s.choices ||= {})[b.id] = i >= 0 ? opt.label : "ran out of time";

    if (i < 0 && b.timeoutText) {
      UI.subtitle(b.timeoutText);
      await this.waitAdvance();
      UI.subtitle("");
    }
    Object.assign(this.s.flags, opt.set || {});
    if (opt.lost) this.loseTime(opt.lost);
    if (opt.remember) UI.toast(opt.remember, 4000);
    if (opt.reply) {
      const msgs = this.threadMessages(opt.reply);
      Phone.raise(msgs.length ? msgs[0].thread : null);
      await this.sendMessages(msgs);
      await this.waitAdvance();
      Phone.lower();
    }
    for (const line of opt.lines || []) {
      UI.subtitle(line);
      await this.waitAdvance();
    }
    UI.subtitle("");
  },

  async beat_report(b) {
    if (b.require && !this.s.pins.some((p) => p.id === b.require)) {
      const q = STORY.find((x) => x.id === b.require);
      this.pin(q, q.answer + ";", "Automatically added: the query that proves who entered the trades.");
    }
    await UI.report(this.s.pins);
  },

  async beat_ending(b) {
    const key = this.s.flags.ending || "toolate";
    const e = b.endings[key];
    if (!this.s.endingsSeen.includes(key)) this.s.endingsSeen.push(key);
    UI.setScene({ image: e.image, shot: "Ending: " + e.title });
    Sound.sting();
    for (const line of e.lines(this.s.flags)) {
      UI.subtitle(line);
      await this.waitAdvance();
    }
    UI.subtitle("");
    const number = Object.keys(b.endings).indexOf(key) + 1;
    const pick = await UI.endingCard(e.title, e.tag, number);
    if (pick === "retry") {
      delete this.s.flags.ending;
      return { jumpTo: b.retry };
    }
  },

  async beat_summary() {
    this.save();
    Summary.show(this);
    await new Promise(() => {}); // the summary is the end of the game
  },

  // ---------- input ----------
  bindKeys() {
    // The flashlight follows the mouse (or finger).
    const frame = $("#frame");
    window.addEventListener("pointermove", (e) => {
      const r = frame.getBoundingClientRect();
      frame.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      frame.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
    });
    $("#chapter").addEventListener("click", () => this._advance && this._advance());
    $("#frame").addEventListener("click", () => this._advance && this._advance());
    $("#subtitle").addEventListener("click", () => this._advance && this._advance());
    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      const modal = $("#notebook").open;
      if ((e.key === " " || e.key === "Enter") && !typing && !modal && this._advance) {
        if (document.activeElement.tagName === "BUTTON" && e.key === "Enter") return;
        e.preventDefault();
        this._advance();
      }
      if ((e.key === "n" || e.key === "N") && !typing && this.s) {
        e.preventDefault();
        modal ? $("#notebook").close() : Notebook.open(this);
      }
      if ((e.key === "m" || e.key === "M") && !typing) this.toggleMute();
    });
    $("#btn-notebook").onclick = () => this.s && Notebook.open(this);
    $("#btn-sound").onclick = () => this.toggleMute();
  },
  toggleMute() {
    const muted = Sound.toggleMute();
    $("#btn-sound").textContent = muted ? "Sound off" : "Sound on";
    $("#btn-sound").setAttribute("aria-pressed", String(!muted));
  },
};

// ---------- end-of-game summary (also your playtest notes) ----------
const Summary = {
  show(game) {
    const s = game.s;
    const box = $("#summary");
    const rows = $("#summary-rows");
    rows.innerHTML = "";
    for (const b of STORY) {
      if ((b.type !== "query" && b.type !== "predict") || b.challenge) continue;
      const st = s.stats[b.id];
      const tr = el("tr");
      tr.append(el("td", "", b.title));
      if (!st) { tr.append(el("td", "", "—"), el("td", "", "—"), el("td", "", "not played")); rows.append(tr); continue; }
      tr.append(el("td", "num", String(st.attempts)), el("td", "num", String(st.hints)));
      tr.append(el("td", "", st.skipped ? "skipped" : st.solved ? (st.firstTry ? "first try" : "solved") : b.type === "predict" ? "wrong guess" : "—"));
      rows.append(tr);
    }
    const fmt = (c) => (!c ? "not attempted" : c.skipped ? "skipped (didn't know yet)" : c.solved ? `solved in ${c.attempts} ${c.attempts === 1 ? "try" : "tries"}` : `not solved (${c.attempts} tries)`);
    $("#summary-before").textContent = fmt(s.before);
    $("#summary-after").textContent = fmt(s.after);
    const names = { caught: "Caught", halfright: "Half Right", framed: "Framed", toolate: "Too Late" };
    $("#summary-endings").textContent = s.endingsSeen.map((k) => names[k]).join(", ") || "none";
    const mins = Math.round((Date.now() - s.started) / 60000);
    $("#summary-time").textContent = `${mins} minute${mins === 1 ? "" : "s"}`;
    const hints = Object.values(s.stats).reduce((a, x) => a + (x.hints || 0), 0);
    $("#summary-hints").textContent = String(hints);
    box.hidden = false;

    $("#summary-copy").onclick = async () => {
      const text = this.text(s);
      try { await navigator.clipboard.writeText(text); $("#summary-copy").textContent = "Copied ✓"; }
      catch (e) { $("#summary-text").hidden = false; $("#summary-text").value = text; $("#summary-text").select(); }
    };
    $("#summary-again").onclick = () => { game.clearSave(); location.reload(); };
  },

  text(s) {
    const lines = ["LEDGER DETECTIVE: NIGHT SHIFT — results", ""];
    lines.push("Before: " + $("#summary-before").textContent, "After: " + $("#summary-after").textContent, "");
    for (const b of STORY) {
      if ((b.type !== "query" && b.type !== "predict") || b.challenge) continue;
      const st = s.stats[b.id];
      if (!st) continue;
      const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
      lines.push(`${b.title}: ${plural(st.attempts, "try").replace("trys", "tries")}, ${plural(st.hints, "hint")}${st.skipped ? ", skipped" : ""}`);
      for (const m of [...new Set(st.mistakes)]) lines.push("   mistake: " + m);
    }
    lines.push("", "Endings: " + $("#summary-endings").textContent, "Time played: " + $("#summary-time").textContent);
    return lines.join("\n");
  },
};

// ---------- start-up ----------
async function boot() {
  Game.bindKeys();
  const status = $("#title-status");
  try {
    await DB.init();
  } catch (e) {
    status.textContent = "Couldn't load the SQL engine. Check your internet connection and refresh.";
    console.error(e);
    return;
  }
  status.textContent = "Best with headphones · about 30 minutes";
  const saved = Game.loadSave();
  const cont = $("#btn-continue");
  cont.hidden = !(saved && saved.i > 0 && saved.i < STORY.length);
  $("#btn-new").disabled = false;

  const start = (state) => {
    Sound.start();
    Game.s = state;
    $("#title").hidden = true;
    $("#hud").hidden = false;
    // The terminal starts just below the header, however tall it wraps.
    new ResizeObserver(() => document.documentElement.style.setProperty("--hud-h", `${$("#hud").offsetHeight}px`)).observe($("#hud"));
    $("#phone").hidden = false;
    // restore the last scene image when continuing
    for (let j = Game.s.i; j >= 0; j--) {
      if (STORY[j].image) { UI.setScene(STORY[j]); break; }
    }
    Game.run().catch((e) => { console.error(e); UI.toast("Something broke: " + e.message, 8000); });
  };
  $("#btn-new").onclick = () => { Game.clearSave(); start(Game.fresh()); };
  cont.onclick = () => start(Object.assign(Game.fresh(), saved));

  if (DEV) setupDev();
}

// ?dev in the URL: jump to any beat, and see hotspot boxes with click coordinates.
function setupDev() {
  document.body.classList.add("dev");
  const sel = $("#dev-beat");
  sel.hidden = false;
  STORY.forEach((b, i) => sel.append(new Option(`${i} · ${b.type} · ${b.id || b.title || b.image || b.term || ""}`, String(i))));
  sel.onchange = () => {
    const s = Game.s || Game.fresh();
    s.i = parseInt(sel.value, 10);
    s.flags.badges = true;
    Game.s = s;
    Game.save();
    location.reload();
  };
  $("#frame").addEventListener("click", (e) => {
    const r = $("#frame").getBoundingClientRect();
    const x = (((e.clientX - r.left) / r.width) * 100).toFixed(1);
    const y = (((e.clientY - r.top) / r.height) * 100).toFixed(1);
    UI.toast(`x: ${x}, y: ${y}`);
    console.log(`hotspot position: x: ${x}, y: ${y}`);
  });
  // Auto-continue the saved game in dev mode so beat jumps land immediately.
  const saved = Game.loadSave();
  if (saved) setTimeout(() => $("#btn-continue").hidden ? null : $("#btn-continue").click(), 0);
}

boot();
