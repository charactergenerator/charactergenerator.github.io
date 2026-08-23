// App logic for the D&D Character Generator (data lives in data.js)
// ---------- EXTRA SOURCES (open5e.js, EN Publishing via Open5e) ----------
// Everything from data.js is SRD 5.2; anything merged in below is tagged with
// its own source so the reference can label and filter by it.
const SRC_SRD = "SRD 5.2";
RULES.forEach(r => { if (!r.src) r.src = SRC_SRD; });

if (typeof A5E_SOURCES !== "undefined") {
  const srcName = k => (A5E_SOURCES[k] || {}).n || k;
  const A5E_URL = "https://a5esrd.com/a5esrd";

  // Spells: A5E spell lists are not class-tagged in the data, so these are a
  // reference library rather than picks for the character sheet.
  A5E_SPELLS.forEach(s => {
    const bits = [`Casting Time: ${s.t}.`, `Range: ${s.r}.`, `Components: ${s.c || "None"}.`, `Duration: ${s.u}.`];
    if (s.conc) bits.push("Concentration.");
    if (s.rit) bits.push("Ritual.");
    RULES.push({
      c: s.l === 0 ? "Spell · Cantrip" : "Spell · Level " + s.l,
      t: s.n, src: srcName("a5e-ag"), url: A5E_URL,
      d: `<i>${s.s}${s.l ? ", level " + s.l : " cantrip"}.</i> ${bits.join(" ")}<br><br>${s.d}` +
         (s.hl ? `<br><br><b>At Higher Levels.</b> ${s.hl}` : "")
    });
  });
  A5E_FEATS.forEach(f => RULES.push({
    c: "Feat · General", t: f.n, src: srcName("a5e-ag"), url: A5E_URL,
    d: (f.pre ? `<i>Prerequisite: ${f.pre}.</i><br>` : "") + f.d +
       (f.b.length ? "<br>" + f.b.map(b => "• " + b).join("<br>") : "")
  }));
  A5E_BACKGROUNDS.forEach(b => RULES.push({
    c: "Background", t: b.n, src: srcName(b.src), url: A5E_URL,
    d: b.d + b.b.map(x => `<br><br><b>${x.n}.</b> ${x.d}`).join("")
  }));
  A5E_CONDITIONS.forEach(c => RULES.push({
    c: "Condition", t: c.n, src: srcName("a5e-ag"), url: A5E_URL, d: c.d
  }));
  A5E_CLASSES.forEach(k => {
    RULES.push({ c: "Class", t: k.n, src: srcName("a5e-ag"), url: A5E_URL,
      d: `<i>Hit die d${k.hd}. Saving throws: ${k.saves.join(", ")}.</i><br><br>${k.d}` });
    // A feature can be listed twice by the source (once as a class feature and
    // again in an options list); keep the first and merge nothing else in
    const seenFeat = new Set();
    const feat = (f, owner) => {
      if (seenFeat.has(f.n)) return;
      seenFeat.add(f.n);
      RULES.push({
        c: "Feature", t: f.n, src: srcName("a5e-ag"), url: A5E_URL,
        d: `<i>${owner} feature${f.lv ? ", level " + f.lv.join("/") : ""}.</i><br><br>${f.d}`
      });
    };
    k.f.forEach(f => feat(f, k.n));
    k.subs.forEach(s => {
      RULES.push({ c: "Subclass", t: s.n, src: srcName("a5e-ag"), url: A5E_URL,
        d: `<i>${k.n} archetype.</i><br><br>${s.d}` });
      s.f.forEach(f => feat(f, s.n));
    });
  });

  // The Marshal is shaped like the app's own classes, so it can be played
  if (typeof A5E_PLAYABLE !== "undefined") {
    Object.entries(A5E_PLAYABLE).forEach(([name, c]) => {
      CLASSES[name] = {
        hitDie: c.hitDie, saves: c.saves, primary: c.primary,
        skillCount: c.skillCount, skillList: c.skillList,
        armor: c.armor, weapons: c.weapons,
        features: c.features, equipment: c.equipment,
        src: srcName("a5e-ag")
      };
      CLASS_LEVELS[name] = c.levels;
      SUBCLASSES[name] = {};
      Object.entries(c.subs).forEach(([sub, s]) => {
        SUBCLASSES[name][sub] = { d: s.d || `A ${name} archetype.`, f: s.f };
      });
      CLASS_RESOURCES[name] = CLASS_RESOURCES[name] || [];
    });
  }
}

// ---------- STATE ----------
const state = {
  name:"", cls:"", species:"", background:"", alignment:"", playerName:"", xp:"",
  scores:{STR:null,DEX:null,CON:null,INT:null,WIS:null,CHA:null},
  skills:[], spells:[], level:1, dieRolls:[], loadedId:null,
  traits:"", ideals:"", bonds:"", flaws:"", notes:"",
  tempHp:0, inspiration:false, deathS:0, deathF:0,
  slotsUsed:{}, hdUsed:0, stable:false, retired:false,
  resUsed:{}, conc:null, gear:[], dropped:[],
  conditions:[], coins:{pp:0,gp:0,ep:0,sp:0,cp:0},
  attuned:[], subclass:"", customSub:null, feats:[]
};
let sheetTargetId = "sheet";
let sheetSpellFilter = "";

// Inline die icon: the die's silhouette with its number inside, matching the
// Dice of Fate on the Basics tab. Outline only, with no interior lines, so
// each shape has to be distinct on its own; that is why a d6 is a square
// rather than a cube, whose outline would be a hexagon like the d20's.
// Dropping the "d" prefix is what lets the number stay readable down to 16px.
// The baselines below are measured, not guessed: each one puts the middle of
// the digits' ink on the shape's optical centre. They assume the lining
// figures the CSS font stack provides. A serif face like Georgia uses
// old-style figures, where 4 drops below the baseline and 10/12/20 sit at
// x-height, which is what made the numbers look uneven and floor-bound.
const DIE_SHAPES = {
  4:  { shape:'<polygon points="32,5 60,55 4,55"/>',                   y:45,   f:26 },
  6:  { shape:'<rect x="9" y="9" width="46" height="46" rx="3"/>',     y:42.5, f:30 },
  8:  { shape:'<polygon points="32,2 60,32 32,62 4,32"/>',             y:42,   f:28 },
  10: { shape:'<polygon points="32,2 60,28 32,62 4,28"/>',             y:39.5, f:27 },
  12: { shape:'<polygon points="58.6,40.7 48.5,54.6 32,60 15.5,54.6 5.4,40.7 5.4,23.3 15.5,9.4 32,4 48.5,9.4 58.6,23.3"/>', y:41.5, f:27 },
  20: { shape:'<polygon points="32,3 57.1,17.5 57.1,46.5 32,61 6.9,46.5 6.9,17.5"/>', y:41.5, f:27 }
};
function dieIcon(sides) {
  // An unfamiliar die (d100 and friends) borrows the d20 outline
  const cfg = DIE_SHAPES[sides] || { ...DIE_SHAPES[20], f: String(sides).length > 2 ? 20 : 27 };
  return `<svg class="die-ico" viewBox="0 0 64 64" role="img" aria-label="d${sides}">${cfg.shape}<text x="32" y="${cfg.y}" font-size="${cfg.f}">${sides}</text></svg>`;
}
// Replace every dice mention in a string with the labeled shape: "2d6" -> 2x [d6 icon]
function allDice(str) {
  return String(str).replace(/(\d+)?d(4|6|8|10|12|20)\b/g, (m,n,s)=>`${n && +n>1 ? n+"×" : ""}${dieIcon(+s)}`);
}
// Kept for existing call sites
function diceHtml(dice) { return allDice(dice); }

// Reduce a sheet line to a term the reference lookup can resolve
function refTermFrom(s) {
  return String(s).replace(/<[^>]*>/g,"")
    .replace(/^\s*L\d+\s+/,"")          // drop the "L5" tag on features gained after level 1
    .split(" (")[0]
    .replace(/^Origin Feat: /,"")
    .replace(/^Feat: /,"")
    .replace(/^Subclass: /,"")
    .trim();
}
// Equipment lines: drop counts, parentheticals, and trailing lists ("4 Handaxes", "Longbow, 20 Arrows, Quiver")
function eqTermFrom(s) {
  return String(s).split(",")[0].split(" or ")[0].split(" (")[0].replace(/^\d+\s+/,"").trim();
}

// Rewrite level-1 feature text with level-appropriate numbers
function scaleFeature(cls, f, lvl) {
  const cant = CANTRIPS_KNOWN[cls] ? CANTRIPS_KNOWN[cls][lvl-1] : null;
  const prep = PREPARED_SPELLS[cls] ? PREPARED_SPELLS[cls][lvl-1] : null;
  if (f.startsWith("Rage (")) return `Rage (${SCALING.rageUses(lvl)}/Long Rest, +${SCALING.rageDmg(lvl)} damage)`;
  if (f.startsWith("Sneak Attack (")) return `Sneak Attack (${SCALING.sneakDice(lvl)}d6)`;
  if (f.startsWith("Martial Arts (")) return `Martial Arts (d${SCALING.martialDie(lvl)})`;
  if (f.startsWith("Bardic Inspiration (")) return `Bardic Inspiration (d${SCALING.bardDie(lvl)})`;
  if (f.startsWith("Second Wind (")) return `Second Wind (${SCALING.secondWind(lvl)}/Long Rest, 1d10+level HP)`;
  if (f.startsWith("Lay On Hands (")) return `Lay On Hands (${5*lvl} HP pool)`;
  if (f.startsWith("Eldritch Invocations (")) return `Eldritch Invocations (${SCALING.invocations(lvl)})`;
  if (f.startsWith("Pact Magic (")) {
    const p = pactSlots(lvl);
    return `Pact Magic (Charisma): ${cant} cantrips, ${prep} spells prepared, ${p.n} level-${p.l} slot${p.n>1?"s":""}`;
  }
  if (f.includes("spells prepared") && prep!=null) {
    let out = f.replace(/\d+ spells prepared/, `${prep} spells prepared`);
    if (cant!=null) out = out.replace(/\d+ cantrips/, `${cant} cantrips`);
    return out;
  }
  return f;
}

// ---------- CONDITIONS & EXHAUSTION ----------
// Active conditions change what the dice do, so every d20 test asks these
// helpers whether it should roll with Advantage or Disadvantage.
function activeConds() { return (state.conditions||[]).map(n=>CONDITIONS[n]).filter(Boolean); }
function hasCond(n) { return (state.conditions||[]).includes(n); }
// kind: "atk" (attack rolls), "chk" (ability checks), "sav" (saving throws).
// ability narrows save-specific effects like Restrained's Disadvantage on DEX saves.
function condRollMode(kind, ability) {
  let adv = null, dis = null;
  (state.conditions||[]).forEach(n=>{
    const c = CONDITIONS[n];
    if (!c) return;
    if (c.adv && c.adv[kind]) adv = adv || n;
    if (c.dis && c.dis[kind]) dis = dis || n;
    if (kind === "sav" && ability && (c.saveDis||[]).includes(ability)) dis = dis || n;
  });
  return { adv, dis };
}
// Conditions that stop you acting also stop you concentrating
function condIncapacitated() { return activeConds().some(c=>c.incap); }
function condSpeed(base) {
  return activeConds().some(c=>c.speed0) ? 0 : base;
}

function toggleCondition(name) {
  pushUndo(`${hasCond(name)?"clearing":"applying"} ${name}`);
  const list = state.conditions || (state.conditions = []);
  const i = list.indexOf(name);
  if (i >= 0) { list.splice(i,1); logEvent("status", `No longer <b>${name}</b>`); }
  else {
    list.push(name);
    tally(STATS.conds, name);
    logEvent("status", `Now <b>${name}</b>${CONDITIONS[name].note?` · ${CONDITIONS[name].note}`:""}`);
    if (CONDITIONS[name].incap && state.conc) dropConc(`${name.toLowerCase()}`);
  }
  renderSheet(); persistLoaded();
}
// ---------- UNDO ----------
// Misclicks happen constantly at the table, so every play-time change stashes
// the fields it could touch and can be rolled back one step at a time.
// Everything a play-time action or a level-up can change. Levelling touches
// level, dieRolls, scores, subclass, feats, and spells, so undo has to carry
// those too or "undo the level up" would leave the sheet half-advanced.
const UNDO_KEYS = ["curHp","tempHp","maxHp","deathS","deathF","stable","slotsUsed","resUsed",
                   "conditions","hdUsed","conc","coins","attuned","inspiration","gear","dropped",
                   "level","dieRolls","scores","skills","spells","subclass","customSub","feats","xp"];
let undoStack = [];
function pushUndo(label) {
  const snap = {};
  UNDO_KEYS.forEach(k=>{ snap[k] = JSON.parse(JSON.stringify(state[k] ?? null)); });
  undoStack.push({label, snap});
  if (undoStack.length > 25) undoStack.shift();
}
function undoLast() {
  const step = undoStack.pop();
  if (!step) return;
  UNDO_KEYS.forEach(k=>{ if (step.snap[k] !== null) state[k] = step.snap[k]; });
  syncCreatorFields();
  logEvent("edit", `<b>Undid</b> ${step.label}`);
  renderSheet(); persistLoaded();
}
// Push restored state back into the creator's inputs, which otherwise keep
// showing the values from before the undo
function syncCreatorFields() {
  ABILITIES.forEach(a=>{ const el = document.getElementById("ab_"+a); if (el) el.value = state.scores[a] ?? ""; });
  const xp = document.getElementById("xpField");
  if (xp) xp.value = state.xp || "";
  renderSkillChoices();
  renderSpellChoices();
}

// ---------- MONEY ----------
// Starting coins come from the class and background gear lists ("15 GP"), and
// state.coins holds everything earned or spent since.
const COIN_RE = /^(\d+)\s*(PP|GP|EP|SP|CP)$/i;
function startingCoins() {
  const out = {pp:0,gp:0,ep:0,sp:0,cp:0};
  const c = state.cls ? CLASSES[state.cls] : null;
  const bg = state.background ? BACKGROUNDS[state.background] : null;
  [...(c?c.equipment:[]), ...(bg?bg.equipment:[])].forEach(e=>{
    const m = COIN_RE.exec(e.trim());
    if (m) out[m[2].toLowerCase()] += parseInt(m[1],10);
  });
  return out;
}
function purse() {
  const start = startingCoins(), have = state.coins || {};
  const out = {};
  COINS.forEach(c=>{ out[c.k] = (start[c.k]||0) + (have[c.k]||0); });
  return out;
}
function purseInCp() {
  const p = purse();
  return COINS.reduce((s,c)=>s + p[c.k]*c.cp, 0);
}
// Coin values in copper, so a mixed purse can be totalled and gains and spends
// can be compared across coin types
const COIN_CP = Object.fromEntries(COINS.map(c=>[c.k, c.cp]));
function changeCoin(k, n) {
  const p = purse();
  if (n < 0 && p[k] + n < 0) n = -p[k];      // never go negative in a single coin type
  if (!n) return;
  pushUndo(`the ${Math.abs(n)} ${k.toUpperCase()} change`);
  state.coins = {...(state.coins||{})};
  state.coins[k] = (state.coins[k]||0) + n;
  if (n > 0) STATS.coins.gained += n * COIN_CP[k]; else STATS.coins.spent += -n * COIN_CP[k];
  saveStats();
  logEvent("gear", `${n>0?"Gained":"Spent"} <b>${Math.abs(n)} ${k.toUpperCase()}</b> · purse now ${COINS.filter(c=>purse()[c.k]).map(c=>`${purse()[c.k]} ${c.k.toUpperCase()}`).join(", ")||"empty"}`);
  renderSheet(); persistLoaded();
}
function coinFromInput(k, sign) {
  const el = document.getElementById("coinAmt");
  const n = Math.abs(parseInt(el && el.value, 10) || 0);
  if (!n) return;
  changeCoin(k, sign*n);
}

// ---------- EXPERIENCE ----------
// The XP field is free text so a table using milestones can write anything in
// it; anything numeric also drives the progress bar.
function xpNum() {
  const n = parseInt(String(state.xp||"").replace(/[^0-9]/g,""), 10);
  return isNaN(n) ? 0 : n;
}
function xpProgress() {
  const xp = xpNum();
  if (!xp && !/\d/.test(String(state.xp||""))) return null;
  const lv = state.level;
  if (lv >= 20) return { xp, ready:false, max:true };
  const from = XP_THRESHOLDS[lv-1], to = XP_THRESHOLDS[lv];
  const earned = levelForXp(xp);
  return {
    xp, from, to, next: lv+1,
    pct: Math.max(0, Math.min(100, Math.round((xp - from) / (to - from) * 100))),
    ready: earned > lv,
    behind: earned < lv
  };
}
function addXp() {
  const el = document.getElementById("xpAmt");
  const n = parseInt(el && el.value, 10) || 0;
  if (!n) { if (el) el.focus(); return; }
  pushUndo(`the +${n} XP`);
  const before = xpNum();
  state.xp = String(before + n);
  const f = document.getElementById("xpField");
  if (f) f.value = state.xp;
  STATS.xp += n;
  logEvent("xp", `<b>+${n} XP</b> · ${before} → ${state.xp}${levelForXp(xpNum())>state.level?` · enough for level ${levelForXp(xpNum())}!`:""}`);
  renderSheet(); persistLoaded();
}

// ---------- SUBCLASS ----------
// SRD 5.2 ships one subclass per class. Anything else a table plays (a
// Player's Handbook subclass, or the DM's homebrew) is entered by hand and
// lives on the character as state.customSub.
const OTHER_SUB = "__other__";
function subclassChoices() { return state.cls ? Object.keys(SUBCLASSES[state.cls]||{}) : []; }
function subclassDue() { return !!(state.cls && state.level >= SUBCLASS_LEVEL && !state.subclass); }
function isCustomSub() { return !!state.customSub; }
// Features earned by this character's subclass at its current level, from the
// SRD table or from the hand-entered list
function mySubclassFeatures(atLevel) {
  const lvl = atLevel || state.level;
  if (isCustomSub()) {
    return (state.customSub.feats||[])
      .filter(x=>lvl >= x.lv)
      .sort((a,b)=>a.lv-b.lv)
      .map(x=>({lv:x.lv, f:x.f}));
  }
  return subclassFeatures(state.cls, state.subclass, lvl);
}
function pickSubclass(name) {
  state.subclass = name;
  state.customSub = null;
  logEvent("level", `<b>Subclass chosen</b>: ${name}`);
  refClose();
  renderSheet(); persistLoaded();
}
function saveCustomSub() {
  const name = (document.getElementById("customSubName").value||"").trim();
  if (!name) { alert("Give your subclass a name first."); return; }
  const desc = (document.getElementById("customSubDesc").value||"").trim();
  const first = !state.customSub;
  state.subclass = name;
  state.customSub = { d: desc, feats: (state.customSub && state.customSub.feats) || [] };
  logEvent("level", `<b>Subclass ${first?"chosen":"updated"}</b>: ${name} <small>(custom)</small>`);
  renderSheet(); persistLoaded();
  openSubclassPicker();
}
function addCustomSubFeature() {
  if (!state.customSub) return;
  const lv = parseInt(document.getElementById("customFeatLv").value, 10) || SUBCLASS_LEVEL;
  const f = (document.getElementById("customFeatText").value||"").trim();
  if (!f) { document.getElementById("customFeatText").focus(); return; }
  state.customSub.feats = [...(state.customSub.feats||[]), { lv: Math.max(1, Math.min(20, lv)), f }];
  logEvent("level", `<b>${state.subclass}</b>: added level ${lv} feature "${f}"`);
  renderSheet(); persistLoaded();
  openSubclassPicker();
}
function removeCustomSubFeature(i) {
  if (!state.customSub) return;
  const gone = state.customSub.feats.splice(i,1)[0];
  if (gone) logEvent("level", `<b>${state.subclass}</b>: removed "${gone.f}"`);
  renderSheet(); persistLoaded();
  openSubclassPicker();
}

// One overlay handles choosing a subclass and editing a custom one, both from
// the sheet and for heroes who passed level 3 before subclasses existed
function openSubclassPicker() {
  const opts = subclassChoices();
  const custom = isCustomSub();
  document.getElementById("refModal").innerHTML = `
    <h3>${state.subclass?"Your":"Choose your"} ${state.cls} Subclass</h3>
    <div class="lvl-step">At level ${SUBCLASS_LEVEL} you commit to a specialty, and it keeps giving you features as you climb.
      SRD 5.2 publishes one subclass per class; pick <b>Other</b> to enter any subclass your table uses instead.</div>
    <div class="lvl-step">
      <div class="k">Options · click one to choose it</div>
      <div class="picker-box">
        ${opts.map(n=>{
          const sc = SUBCLASSES[state.cls][n];
          const levels = Object.keys(sc.f).map(Number).sort((a,b)=>a-b);
          const cur = !custom && state.subclass===n;
          return `<div class="chooser-row${cur?" current":""}" onclick="pickSubclass('${escQ(n)}')">
            <div><b>${n}</b> <small style="color:var(--muted)">· SRD</small>${cur?' <small style="color:var(--accent)">· current</small>':""}</div>
            <div style="font-size:.85rem;color:var(--muted)">${sc.d}</div>
            <div style="font-size:.8rem;margin-top:.2rem">${levels.map(lv=>`<b>L${lv}</b> ${allDice(sc.f[lv].map(f=>f.split(" (")[0]).join(", "))}`).join(" · ")}</div>
          </div>`;
        }).join("")}
        <div class="chooser-row${custom?" current":""}" onclick="document.getElementById('customSubName').focus()">
          <div><b>Other</b> <small style="color:var(--muted)">· your own</small>${custom?' <small style="color:var(--accent)">· current</small>':""}</div>
          <div style="font-size:.85rem;color:var(--muted)">Any subclass from another book, or one your DM made up. Name it below and add its features as you earn them.</div>
        </div>
      </div>
    </div>
    <div class="lvl-step">
      <div class="k">Other · name your own</div>
      <div class="row" style="margin-bottom:.4rem">
        <input type="text" id="customSubName" placeholder="e.g. Path of the Storm Herald" value="${escAttr(custom?state.subclass:"")}">
        <button onclick="saveCustomSub()">${custom?"Update":"Use this"}</button>
      </div>
      <textarea id="customSubDesc" rows="2" placeholder="What is it about? (optional)">${escHtml(custom?(state.customSub.d||""):"")}</textarea>
    </div>
    ${custom?`<div class="lvl-step">
      <div class="k">${escHtml(state.subclass)} features</div>
      ${(state.customSub.feats||[]).length ? `<ul class="clean">${state.customSub.feats
          .map((x,i)=>({x,i}))
          .sort((a,b)=>a.x.lv-b.x.lv)
          .map(({x,i})=>`<li><small style="color:var(--muted)">L${x.lv}</small> ${allDice(escHtml(x.f))}
            <button class="gear-btn" style="float:right" title="Remove this feature" onclick="removeCustomSubFeature(${i})">−</button></li>`).join("")}</ul>`
        : `<div style="color:var(--muted);font-size:.85rem">No features yet. Add them as you earn them, or all at once.</div>`}
      <div class="row" style="margin-top:.5rem">
        <select id="customFeatLv" style="flex:0 0 6.5rem">
          ${Array.from({length:20},(_,i)=>i+1).map(lv=>`<option value="${lv}" ${lv===SUBCLASS_LEVEL?"selected":""}>Level ${lv}</option>`).join("")}
        </select>
        <input type="text" id="customFeatText" placeholder="e.g. Storm Aura (10-ft aura, 2d6 lightning)">
        <button onclick="addCustomSubFeature()">Add</button>
      </div>
      <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">Features show on your sheet once you reach their level. Dice you write, like 2d6, get their die shape.</div>
    </div>`:""}
    <div class="lvl-actions"><button onclick="refClose()">Close</button></div>`;
  document.getElementById("refOverlay").classList.add("open");
  const n = document.getElementById("customSubName");
  if (n) n.addEventListener("keydown", e=>{ if (e.key==="Enter") saveCustomSub(); });
  const t = document.getElementById("customFeatText");
  if (t) t.addEventListener("keydown", e=>{ if (e.key==="Enter") addCustomSubFeature(); });
}

// ---------- FEATS ----------
// The background's origin feat is derived rather than stored, so changing
// background swaps it cleanly; chosen feats live in state.feats.
function allFeats() {
  const bg = state.background ? BACKGROUNDS[state.background] : null;
  const out = bg ? [{ n: bg.feat, at: 1, origin: true }] : [];
  return [...out, ...(state.feats||[])];
}
// A feat name may carry a parenthetical, as in "Magic Initiate (Cleric)"
function featDef(name) { return FEATS[name] || FEATS[String(name).split(" (")[0]]; }

// ---------- HELPERS ----------
// Player-entered text (custom subclass names and features) goes through these
// before it reaches markup
const escHtml = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const escAttr = s => escHtml(s).replace(/"/g,"&quot;");
const rand = arr => arr[Math.floor(Math.random()*arr.length)];
const mod = s => Math.floor((s-10)/2);
const fmtMod = m => (m>=0?"+":"")+m;
function roll4d6() {
  const r = [0,0,0,0].map(()=>1+Math.floor(Math.random()*6)).sort((a,b)=>b-a);
  return r[0]+r[1]+r[2];
}

// ---------- UI SETUP ----------
function fillSelect(id, options) {
  const el = document.getElementById(id);
  el.innerHTML = '<option value="">-- choose --</option>' + options.map(o=>`<option>${o}</option>`).join("");
}
fillSelect("selClass", Object.keys(CLASSES));
fillSelect("selSpecies", Object.keys(SPECIES));
fillSelect("selBackground", Object.keys(BACKGROUNDS));
fillSelect("selAlignment", ALIGNMENTS);

const abDiv = document.getElementById("abilityInputs");
abDiv.innerHTML = ABILITIES.map(a=>`
  <div class="ab"><label>${a}</label>
    <div class="ab-row">
      <button class="gear-btn" onclick="bumpScore('${a}',-1)" title="Lower ${a}" tabindex="-1">−</button>
      <input type="number" min="1" max="30" id="ab_${a}" placeholder="--">
      <button class="gear-btn" onclick="bumpScore('${a}',1)" title="Raise ${a}" tabindex="-1">+</button>
    </div>
  </div>`).join("");

// The +/- beside each ability score. The range is 1-30 rather than the old
// 3-20 so the magic items that set a score above 20 can be recorded.
function bumpScore(ab, delta) {
  const el = document.getElementById("ab_" + ab);
  const cur = parseInt(el.value, 10);
  const next = Math.max(1, Math.min(30, (isNaN(cur) ? 10 : cur) + delta));
  el.value = next;
  state.scores[ab] = next;
  renderSheet();
}

// ---------- SKILL CHOICES ----------
function renderSkillChoices() {
  const box = document.getElementById("skillChoices");
  if (!state.cls) { box.innerHTML = '<span style="color:var(--muted)">Pick a class first.</span>'; return; }
  const c = CLASSES[state.cls];
  const bgSkills = state.background ? BACKGROUNDS[state.background].skills : [];
  box.innerHTML = `<div style="margin-bottom:.3rem;color:var(--muted)">Choose ${c.skillCount}:</div>` +
    c.skillList.map(s=>{
      const fromBg = bgSkills.includes(s);
      const checked = fromBg || state.skills.includes(s);
      return `<label style="display:inline-block;width:49%;font-weight:normal;${fromBg?'color:var(--muted)':''}">
        <input type="checkbox" value="${s}" ${checked?"checked":""} ${fromBg?"disabled title='Already granted by your background'":""}> ${s}${fromBg?" ✓bg":""}</label>`;
    }).join("");
  box.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const c2 = CLASSES[state.cls];
      if (cb.checked) {
        state.skills.push(cb.value);
        if (state.skills.length > c2.skillCount) {
          const removed = state.skills.shift();
          const other = box.querySelector(`input[value="${removed}"]`);
          if (other) other.checked = false;
        }
      } else {
        state.skills = state.skills.filter(s=>s!==cb.value);
      }
      renderSheet();
    });
  });
}

function randomizeSkills() {
  if (!state.cls) return;
  const c = CLASSES[state.cls];
  const bgSkills = state.background ? BACKGROUNDS[state.background].skills : [];
  const pool = c.skillList.filter(s=>!bgSkills.includes(s));
  state.skills = [];
  while (state.skills.length < c.skillCount && pool.length) {
    const pick = rand(pool);
    pool.splice(pool.indexOf(pick),1);
    state.skills.push(pick);
  }
  renderSkillChoices();
}

// ---------- SPELL CHOICES ----------
// Spell counts and highest castable spell level (capped at 3, this tool's data range);
// pass a level to preview a different level
function spellCounts(atLevel) {
  const lvl = atLevel || state.level;
  const cant = CANTRIPS_KNOWN[state.cls] ? CANTRIPS_KNOWN[state.cls][lvl-1] : 0;
  const prep = PREPARED_SPELLS[state.cls] ? PREPARED_SPELLS[state.cls][lvl-1] : 0;
  const lvs = getSlotRows(lvl).map(r=>r.lv);
  const maxCast = lvs.length ? Math.max(...lvs) : 1;
  return { cant, prep, maxCast };
}
// ---------- SHARED SPELL PICKER (level up and long rest) ----------
// Selections are staged on the pending object so Cancel discards them.
function pickerList(ctx) { return ctx === "lvl" ? pendingLvl.spells : pendingLR.spells; }

function spellPickerHtml(ctx, counts) {
  const list = pickerList(ctx);
  const lvlOf = n => SPELLS.find(s=>s.n===n)?.l ?? 1;
  const have0 = list.filter(n=>lvlOf(n)===0).length;
  const have1 = list.length - have0;
  const left0 = counts.cant - have0, left1 = counts.prep - have1;
  const pool = SPELLS.filter(s=>s.c.includes(state.cls) && s.l <= counts.maxCast && (s.l>0 || counts.cant>0));
  const todo = [left0>0?`${left0} cantrip${left0>1?"s":""}`:"", left1>0?`${left1} spell${left1>1?"s":""}`:""].filter(Boolean).join(" and ");
  let html = `<div style="font-size:.85rem;margin:.2rem 0 .35rem">
    ${counts.cant?`Cantrips <b>${have0}/${counts.cant}</b> · `:""}Spells <b>${have1}/${counts.prep}</b>
    ${todo?`<span style="color:var(--accent)">· choose ${todo}</span>`
          :`<span style="color:var(--good)">· ready</span>`}
    ${(left0<0||left1<0)?`<span style="color:var(--accent2)">· over the limit, uncheck some</span>`:""}
  </div><div class="picker-box">`;
  SPELL_LEVELS.forEach(lv=>{
    const g = pool.filter(s=>s.l===lv);
    if (!g.length) return;
    html += `<div class="spell-lvl-h">${lv===0?"Cantrips":"Level "+lv}</div>` + g.map(s=>{
      const on = list.includes(s.n);
      const full = lv===0 ? left0<=0 : left1<=0;
      return `<label class="spell-row${!on&&full?" dimmed":""}"><input type="checkbox" ${on?"checked":""} ${!on&&full?"disabled":""} onchange="pickerToggle('${ctx}','${escQ(s.n)}')"> ${s.n} <small style="color:var(--muted)">${allDice(s.d)}</small></label>`;
    }).join("");
  });
  return html + `</div>`;
}

function pickerToggle(ctx, name) {
  const arr = pickerList(ctx);
  const i = arr.indexOf(name);
  if (i >= 0) arr.splice(i,1); else arr.push(name);
  if (ctx === "lvl") renderLvlModal(); else longRest();
}

// Randomly add class spells until the given counts are met; returns the names added
function fillSpellsRandomly(cant, prep, maxCast) {
  const learned = [];
  const isCantrip = n => SPELLS.find(s=>s.n===n)?.l === 0;
  const pickInto = (pool, need) => {
    const p = pool.filter(s=>!state.spells.includes(s.n));
    while (need-- > 0 && p.length) {
      const s = p.splice(Math.floor(Math.random()*p.length), 1)[0];
      state.spells.push(s.n); learned.push(s.n);
    }
  };
  const have0 = state.spells.filter(isCantrip).length;
  pickInto(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l===0), cant - have0);
  pickInto(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l>=1&&s.l<=maxCast), prep - (state.spells.length - state.spells.filter(isCantrip).length));
  return learned;
}

function renderSpellChoices() {
  const sec = document.getElementById("spellSection");
  const box = document.getElementById("spellChoices");
  const caster = state.cls && CLASSES[state.cls].spellcaster;
  sec.style.display = caster ? "" : "none";
  if (!caster) return;
  const { cant, prep, maxCast } = spellCounts();
  const q = (document.getElementById("spellSearch").value||"").toLowerCase();
  const mine = SPELLS.filter(s=>s.c.includes(state.cls) && (!q || s.n.toLowerCase().includes(q) || s.d.toLowerCase().includes(q)));
  let html = `<div style="color:var(--muted);margin-bottom:.2rem">At level ${state.level}: ${cant?cant+" cantrips known, ":""}${prep} spells prepared, spell levels up to ${maxCast}.</div>`;
  SPELL_LEVELS.forEach(lv=>{
    const group = mine.filter(s=>s.l===lv);
    if (!group.length) return;
    html += `<div class="spell-lvl-h">${lv===0?"Cantrips":"Level "+lv}</div>` + group.map(s=>
      `<label class="spell-row" title="${s.d.replace(/"/g,'&quot;')}"><input type="checkbox" value="${s.n}" ${state.spells.includes(s.n)?"checked":""}> ${s.n} <small style="color:var(--muted)">${allDice(s.d)}</small></label>`).join("");
  });
  box.innerHTML = html;
  box.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      if (cb.checked) state.spells.push(cb.value);
      else state.spells = state.spells.filter(s=>s!==cb.value);
      renderSheet();
    });
  });
}

function randomizeSpells() {
  state.spells = [];
  const caster = state.cls && CLASSES[state.cls].spellcaster;
  if (!caster) return;
  const { cant, prep, maxCast } = spellCounts();
  const pick = (pool,n)=>{ const p=[...pool]; const out=[]; while(out.length<n && p.length){ out.push(p.splice(Math.floor(Math.random()*p.length),1)[0].n); } return out; };
  state.spells = [
    ...pick(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l===0), cant),
    ...pick(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l>=1&&s.l<=maxCast), prep)
  ];
  renderSpellChoices();
}
document.getElementById("btnRandSkills").addEventListener("click", ()=>{
  if (!state.cls) { alert("Pick a class first: its list decides which skills you can choose."); return; }
  randomizeSkills();
  renderSheet();
});
document.getElementById("btnRandSpells").addEventListener("click", ()=>{ randomizeSpells(); renderSheet(); });
document.getElementById("spellSearch").addEventListener("input", renderSpellChoices);

// ---------- PERSONALITY & NOTES ----------
const RP_FIELDS = { rpTraits:"traits", rpIdeals:"ideals", rpBonds:"bonds", rpFlaws:"flaws", rpNotes:"notes", playerName:"playerName", xpField:"xp" };
Object.entries(RP_FIELDS).forEach(([id,key])=>{
  document.getElementById(id).addEventListener("input", e=>{ state[key]=e.target.value; renderSheet(); });
});
document.querySelectorAll("button[data-rp]").forEach(b=>{
  b.addEventListener("click", ()=>{
    const key = b.dataset.rp;
    state[key] = rand(RP_TABLES[key]);
    document.getElementById("rp"+key[0].toUpperCase()+key.slice(1)).value = state[key];
    renderSheet();
  });
});

// ---------- RANDOMIZERS ----------
const randomizers = {
  name: () => { state.name = rand(NAMES.first)+" "+rand(NAMES.last); document.getElementById("charName").value = state.name; },
  class: () => { state.cls = rand(Object.keys(CLASSES)); document.getElementById("selClass").value = state.cls; randomizeSkills(); randomizeSpells(); },
  species: () => { state.species = rand(Object.keys(SPECIES)); document.getElementById("selSpecies").value = state.species; },
  background: () => { state.background = rand(Object.keys(BACKGROUNDS)); document.getElementById("selBackground").value = state.background; randomizeSkills(); },
  alignment: () => { state.alignment = rand(ALIGNMENTS); document.getElementById("selAlignment").value = state.alignment; }
};

document.querySelectorAll("button.dice").forEach(b=>{
  b.addEventListener("click", ()=>{ randomizers[b.dataset.rand](); renderSheet(); });
});

function setScores(vals) {
  ABILITIES.forEach((a,i)=>{
    state.scores[a] = vals[i];
    document.getElementById("ab_"+a).value = vals[i];
  });
}

document.getElementById("btnRoll4d6").addEventListener("click", ()=>{
  setScores(ABILITIES.map(()=>roll4d6()));
  renderSheet();
});
document.getElementById("btnStandard").addEventListener("click", ()=>{
  setScores([15,14,13,12,10,8]);
  renderSheet();
});
document.getElementById("btnOptimize").addEventListener("click", ()=>{
  const vals = ABILITIES.map(a=>state.scores[a]).filter(v=>v!=null);
  if (vals.length<6) { setScores([15,14,13,12,10,8]); }
  optimizeForClass();
  renderSheet();
});

function optimizeForClass() {
  if (!state.cls) return;
  const c = CLASSES[state.cls];
  const sorted = ABILITIES.map(a=>state.scores[a]).sort((x,y)=>y-x);
  const order = [...c.primary, ...ABILITIES.filter(a=>!c.primary.includes(a))];
  const newScores = {};
  order.forEach((a,i)=>newScores[a]=sorted[i]);
  setScores(ABILITIES.map(a=>newScores[a]));
}

ABILITIES.forEach(a=>{
  document.getElementById("ab_"+a).addEventListener("input", e=>{
    state.scores[a] = parseInt(e.target.value)||null;
    renderSheet();
  });
});

document.getElementById("charName").addEventListener("input", e=>{ state.name=e.target.value; renderSheet(); });
["selClass","selSpecies","selBackground","selAlignment"].forEach(id=>{
  document.getElementById(id).addEventListener("change", e=>{
    const key = {selClass:"cls",selSpecies:"species",selBackground:"background",selAlignment:"alignment"}[id];
    state[key] = e.target.value;
    if (id==="selClass") { state.skills=[]; state.spells=[]; state.level=1; state.dieRolls=[]; state.slotsUsed={}; state.hdUsed=0; state.resUsed={}; state.conc=null; state.gear=[]; state.dropped=[]; state.subclass=""; state.customSub=null; state.feats=[]; state.attuned=[]; renderSkillChoices(); renderSpellChoices(); }
    if (id==="selBackground") {
      // Free up any class pick the new background already grants, so the
      // player keeps their full allotment of distinct proficiencies
      const granted = state.background ? BACKGROUNDS[state.background].skills : [];
      state.skills = state.skills.filter(s=>!granted.includes(s));
      renderSkillChoices();
    }
    renderSheet();
  });
});

document.getElementById("btnRandomAll").addEventListener("click", ()=>{
  state.level=1; state.dieRolls=[]; state.loadedId=null;
  state.tempHp=0; state.inspiration=false; state.deathS=0; state.deathF=0;
  state.slotsUsed={}; state.hdUsed=0; state.stable=false; state.retired=false;
  // Fresh heroes arrive fully rested: force HP to recompute from scratch
  state.maxHp=null; state.curHp=null; state.resUsed={}; state.conc=null; state.gear=[]; state.dropped=[];
  state.conditions=[]; state.coins={pp:0,gp:0,ep:0,sp:0,cp:0};
  state.attuned=[]; state.subclass=""; state.customSub=null; state.feats=[];
  undoStack = [];
  Object.values(randomizers).forEach(f=>f());
  setScores(ABILITIES.map(()=>roll4d6()));
  optimizeForClass();
  randomizeSkills();
  ["traits","ideals","bonds","flaws"].forEach(k=>{
    state[k] = rand(RP_TABLES[k]);
    document.getElementById("rp"+k[0].toUpperCase()+k.slice(1)).value = state[k];
  });
  renderSheet();
});

document.getElementById("btnClear").addEventListener("click", clearCreator);
function clearCreator() {
  state.name=""; state.cls=""; state.species=""; state.background=""; state.alignment="";
  state.level=1; state.dieRolls=[]; state.loadedId=null; state.maxHp=null; state.curHp=null;
  state.skills=[]; state.spells=[]; state.playerName=""; state.xp="";
  state.traits=""; state.ideals=""; state.bonds=""; state.flaws=""; state.notes="";
  state.tempHp=0; state.inspiration=false; state.deathS=0; state.deathF=0;
  state.slotsUsed={}; state.hdUsed=0; state.stable=false; state.retired=false;
  state.resUsed={}; state.conc=null; state.gear=[]; state.dropped=[];
  state.conditions=[]; state.coins={pp:0,gp:0,ep:0,sp:0,cp:0};
  state.attuned=[]; state.subclass=""; state.customSub=null; state.feats=[];
  undoStack = [];
  ABILITIES.forEach(a=>{ state.scores[a]=null; document.getElementById("ab_"+a).value=""; });
  document.getElementById("charName").value="";
  ["selClass","selSpecies","selBackground","selAlignment"].forEach(id=>document.getElementById(id).value="");
  ["rpTraits","rpIdeals","rpBonds","rpFlaws","rpNotes","playerName","xpField"].forEach(id=>document.getElementById(id).value="");
  renderSkillChoices(); renderSpellChoices(); renderSheet();
}

// ---------- SHEET RENDER ----------
// Max HP: hit die at level 1 + rolled/average gains + CON per level (+1/level for Dwarf).
// Runs independently of rendering so it stays correct while the sheet isn't on screen.
function computeHp() {
  const c = state.cls ? CLASSES[state.cls] : null;
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  let hp = c ? c.hitDie + state.dieRolls.reduce((a,b)=>a+b,0) + conMod*state.level : null;
  if (state.species==="Dwarf" && hp!=null) hp += state.level;
  if (hp!=null) hp = Math.max(1, hp);
  if (state.maxHp !== hp) {
    const delta = hp - (state.maxHp||0);
    state.curHp = state.maxHp==null || state.curHp==null ? hp : Math.max(0, Math.min(hp, state.curHp + Math.max(0,delta)));
    state.maxHp = hp;
  }
}

// Conditions live behind a button in the action row rather than a permanent
// grid of chips. The menu stays open while you toggle several at once.
let condMenuOpen = false;
function toggleCondMenu(e) {
  if (e) e.stopPropagation();
  condMenuOpen = !condMenuOpen;
  renderSheet();
}
function closeCondMenu() {
  if (!condMenuOpen) return;
  condMenuOpen = false;
  renderSheet();
}
// One-line summary of what a condition does to your own rolls
function condEffect(n, long) {
  const c = CONDITIONS[n], bits = [];
  const names = long ? {atk:"attack rolls",chk:"ability checks",sav:"saving throws"}
                     : {atk:"attacks",chk:"checks",sav:"saves"};
  if (c.dis) bits.push((long?"Disadvantage on ":"dis. ") + Object.keys(c.dis).map(k=>names[k]).join(" and "));
  if (c.adv) bits.push((long?"Advantage on ":"adv. ") + Object.keys(c.adv).map(k=>names[k]).join(" and "));
  if (c.saveDis) bits.push((long?"Disadvantage on ":"dis. ") + c.saveDis.join(" and ") + " saves");
  if (c.autoFail) bits.push(`${c.autoFail.join(" and ")} saves ${long?"fail automatically":"auto-fail"}`);
  if (c.speed0) bits.push(long ? "Speed drops to 0" : "Speed 0");
  if (c.incap) bits.push(long ? "no actions, and Concentration breaks" : "incapacitated");
  return bits.join(long ? "; " : ", ");
}
// The button, and the drop-down it opens
function condMenu() {
  const on = state.conditions || [];
  const items = CONDITION_NAMES.map(n=>{
    const active = on.includes(n);
    const eff = condEffect(n);
    return `<div class="cond-item${active?" on":""}" onclick="event.stopPropagation();toggleCondition('${n}')"
      title="${CONDITIONS[n].note||""}">
      <span class="tick">${active?"☑":"☐"}</span>
      <span><b>${n}</b>${eff?` <small>${eff}</small>`:""}</span>
    </div>`;
  }).join("");
  return `<span class="cond-wrap">
    <button class="cond-btn${on.length?" on":""}" onclick="toggleCondMenu(event)"
      title="${on.length?"Active: "+on.join(", "):"Apply a condition"}" aria-expanded="${condMenuOpen}">
      🤢 Conditions${on.length?` · ${on.length}`:""} ${condMenuOpen?"▴":"▾"}</button>
    ${condMenuOpen?`<div class="cond-menu" onclick="event.stopPropagation()">
      <div class="cond-menu-head">
        <span class="ref-link" onclick="refLookup('Conditions')">Conditions</span>
        ${on.length?`<button class="gear-btn" onclick="clearConditions()">Clear all</button>`:""}
      </div>
      ${items}
    </div>`:""}
  </span>`;
}
function clearConditions() {
  if (!(state.conditions||[]).length) return;
  pushUndo("clearing all conditions");
  const had = state.conditions.join(", ");
  state.conditions = [];
  logEvent("status", `No longer <b>${had}</b>`);
  renderSheet(); persistLoaded();
}
// A slim banner keeps the active ones and their effects visible on the sheet
function condSummary() {
  const on = state.conditions || [];
  if (!on.length) return "";
  return `<div class="cond-summary">
    ${on.map(n=>{
      const eff = condEffect(n, true);
      return `<div><span class="ref-link" onclick="refLookup('${n}')"><b>${n}</b></span>${eff?": "+eff+".":""} ${CONDITIONS[n].note||""}
        <button class="gear-btn" title="Remove ${n}" onclick="toggleCondition('${n}')">✕</button></div>`;
    }).join("")}
  </div>`;
}

// The purse: starting coins from class and background, plus everything earned
// or spent since. Amounts are entered once and applied to any coin type.
function purseBlock(canAct) {
  const p = purse();
  const totalGp = Math.round(purseInCp() / 100 * 100) / 100;
  return `<div class="purse">
    <div class="purse-row">
      <span class="ref-link" onclick="refLookup('Coins and Currency')">💰 Purse</span>
      ${COINS.map(c=>`<span class="coin ${c.k}${p[c.k]?"":" zero"}" title="${c.n}">${p[c.k]} <small>${c.k.toUpperCase()}</small></span>`).join("")}
      <span style="color:var(--muted);font-size:.8rem">≈ ${totalGp.toLocaleString()} gp</span>
    </div>
    ${canAct?`<div class="purse-row">
      <input type="number" id="coinAmt" min="1" placeholder="10" title="Amount, then pick a coin to gain or spend">
      ${COINS.map(c=>`<span class="coin-btns"><button class="gear-btn" onclick="coinFromInput('${c.k}',1)" title="Gain ${c.n}">+${c.k.toUpperCase()}</button><button class="gear-btn" onclick="coinFromInput('${c.k}',-1)" title="Spend ${c.n}" ${p[c.k]?"":"disabled"}>−</button></span>`).join("")}
    </div>`:""}
  </div>`;
}

// Experience against the level table. Hidden on the sheet for now: the XP
// field on the Create tab still records whatever the player types, and
// everything below is ready to switch back on by calling xpBlock() again.
function xpBlock(canAct) {
  const p = xpProgress();
  if (!p) return canAct ? `<div class="xp-box"><span style="color:var(--muted)">No <span class="ref-link" onclick="refLookup('Experience Points')">XP</span> recorded. Add some, or ignore this if your table uses milestones.</span>
    <span class="xp-add"><input type="number" id="xpAmt" placeholder="250"><button class="gear-btn" onclick="addXp()">+ XP</button></span></div>` : "";
  if (p.max) return `<div class="xp-box"><b>${p.xp.toLocaleString()} XP</b> · level 20, the top of the table</div>`;
  return `<div class="xp-box">
    <div class="xp-line">
      <b>${p.xp.toLocaleString()} XP</b>
      <span style="color:var(--muted)">${p.ready
        ? `enough for <b style="color:var(--good)">level ${levelForXp(p.xp)}</b>`
        : `${(p.to - p.xp).toLocaleString()} to level ${p.next}`}</span>
      ${canAct?`<span class="xp-add"><input type="number" id="xpAmt" placeholder="250"><button class="gear-btn" onclick="addXp()">+ XP</button></span>`:""}
    </div>
    <div class="xp-bar"><span style="width:${p.ready?100:p.pct}%" class="${p.ready?"ready":""}"></span></div>
    ${p.ready?`<div style="color:var(--good);font-size:.85rem">You have enough XP to level up.</div>`:""}
  </div>`;
}

function renderSheet() {
  const saveLabel = state.loadedId ? "💾 Update Character" : "💾 Save Character";
  ["btnSave","btnSaveTop"].forEach(id=>{ const b = document.getElementById(id); if (b) b.textContent = saveLabel; });
  computeHp();
  try { localStorage.setItem("dnd-srd-current", JSON.stringify(state)); } catch(e) {}
  persistLoaded();   // every change that redraws the sheet is written through to the saved copy
  const el = document.getElementById(sheetTargetId);
  if (!el) { renderDownOverlay(); return; }
  const haveScores = ABILITIES.every(a=>state.scores[a]!=null);
  if (!state.cls && !state.species && !haveScores) {
    el.innerHTML = '<div class="empty">Choose options on the left (or hit <b>Randomize All</b>) to generate a character sheet.</div>';
    renderDownOverlay();
    return;
  }
  const c = state.cls ? CLASSES[state.cls] : null;
  const sp = state.species ? SPECIES[state.species] : null;
  const bg = state.background ? BACKGROUNDS[state.background] : null;
  const profBonus = 2 + Math.floor((state.level-1)/4);
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  const dexMod = state.scores.DEX!=null ? mod(state.scores.DEX) : 0;
  const wisMod = state.scores.WIS!=null ? mod(state.scores.WIS) : 0;

  const hp = state.maxHp;
  const bloodied = hp!=null && state.curHp>0 && state.curHp <= Math.floor(hp/2);
  const baseSpeed = sp ? sp.speed : 30;
  const speedNow = condSpeed(baseSpeed);

  let ac = 10 + dexMod;
  let acNote = "10 + Dex (unarmored)";
  if (c) {
    if (state.cls==="Barbarian") { ac = 10+dexMod+conMod; acNote="Unarmored Defense"; }
    else if (state.cls==="Monk") { ac = 10+dexMod+wisMod; acNote="Unarmored Defense"; }
    else if (["Fighter","Paladin"].includes(state.cls)) { ac = 16; acNote="Chain Mail"; if (state.cls==="Paladin"){ac=18;acNote="Chain Mail + Shield";} }
    else if (state.cls==="Cleric") { ac = 13+Math.min(dexMod,2)+2; acNote="Chain Shirt + Shield"; }
    else if (state.cls==="Druid") { ac = 11+dexMod+2; acNote="Leather + Shield"; }
    else if (state.cls==="Ranger") { ac = 12+dexMod; acNote="Studded Leather"; }
    else if (["Bard","Rogue","Warlock"].includes(state.cls)) { ac = 11+dexMod; acNote="Leather Armor"; }
  }

  const allSkillProfs = new Set(state.skills);
  if (bg) bg.skills.forEach(s=>allSkillProfs.add(s));

  const skillMod = s => state.scores[SKILLS[s]]!=null
    ? mod(state.scores[SKILLS[s]]) + (allSkillProfs.has(s)?profBonus:0) : null;
  const passive = s => 10 + (skillMod(s) ?? 0);
  const passivePerception = passive("Perception");

  const saveRows = ABILITIES.map(a=>{
    const isProf = c && c.saves.includes(a);
    const m = state.scores[a]!=null ? mod(state.scores[a]) + (isProf?profBonus:0) : null;
    const auto = activeConds().some(x=>(x.autoFail||[]).includes(a));
    const roll = m!=null ? `class="rollable" onclick="rollD20('${ABILITY_NAMES[a]} Save',${m},'sav','${a}')" title="Click to roll"` : "";
    return `<li ${roll}>${isProf?'<span class="prof">●</span>':'○'} ${ABILITY_NAMES[a]} ${m!=null?fmtMod(m):"--"}${auto?' <small style="color:var(--accent2)" title="A condition makes this save fail automatically">auto-fail</small>':""}</li>`;
  }).join("");

  const skillRows = ALL_SKILLS.map(s=>{
    const ab = SKILLS[s];
    const isProf = allSkillProfs.has(s);
    const m = state.scores[ab]!=null ? mod(state.scores[ab]) + (isProf?profBonus:0) : null;
    const roll = m!=null ? `class="rollable" onclick="rollD20('${s}',${m},'chk')" title="Click to roll"` : "";
    return `<li ${roll}>${isProf?'<span class="prof">●</span>':'○'} ${s} <small style="color:var(--muted)">(${ab})</small> ${m!=null?fmtMod(m):"--"}</li>`;
  }).join("");

  const equipment = currentEquipment();
  // Level 1 class features head the list; everything gained later is collected
  // with the level it arrived at, then shown in level order
  const features = [...(c?c.features.map(f=>allDice(scaleFeature(state.cls,f,state.level))):[])];
  const later = [];
  const tag = lv => `<small style="color:var(--muted)">L${lv}</small> `;
  if (c && CLASS_LEVELS[state.cls]) {
    for (let lv=2; lv<=state.level; lv++) {
      (CLASS_LEVELS[state.cls][lv]||[]).forEach(f=>{
        // The class table names the SRD subclass at level 3. Once a subclass has
        // actually been chosen, name that one: its features are listed below.
        if (/^Subclass:/.test(f) && state.subclass) {
          later.push({lv, html: tag(lv)+"Subclass: "+escHtml(state.subclass)});
        } else {
          later.push({lv, html: tag(lv)+allDice(f)});
        }
      });
    }
  }
  // Subclass features, tagged with the level they arrived at. A custom
  // subclass holds the player's own words, so they are escaped and open the
  // subclass editor rather than a reference lookup that cannot exist.
  mySubclassFeatures().forEach(({lv,f})=>later.push(isCustomSub()
    ? {lv, html: tag(lv)+allDice(escHtml(f)), act:"openSubclassPicker()", tip:"Your own subclass feature: click to edit"}
    : {lv, html: tag(lv)+allDice(f)}));
  // Feats: the background's origin feat plus anything taken at an ASI level
  allFeats().forEach(f=>later.push({lv:f.at, html: tag(f.at)+(f.origin?"Origin Feat: ":"Feat: ")+f.n}));
  later.sort((a,b)=>a.lv-b.lv);
  later.forEach(x=>features.push(x.act ? {html:x.html, act:x.act, tip:x.tip} : x.html));
  const traits = sp ? sp.traits.map(t=>allDice(t)) : [];
  const canLevel = c && haveScores && state.level < 20 && !state.retired;
  const canAct = c && haveScores && !state.retired;

  // Attacks from carried weapons
  const strMod = state.scores.STR!=null ? mod(state.scores.STR) : 0;
  const attacks = [];
  if (c) {
    const seen = new Set();
    equipment.forEach(item=>{   // only weapons still carried produce attacks
      Object.keys(WEAPONS).forEach(w=>{
        if (item.includes(w) && !seen.has(w)) {
          seen.add(w);
          const wd = WEAPONS[w];
          const abMod = wd.rng ? dexMod : wd.fin ? Math.max(strMod,dexMod) : strMod;
          const [die, type] = wd.dmg.split(" ");
          attacks.push({name:w, bonus:abMod+profBonus, dice:die, type, dmgMod:abMod,
            dmg:`${wd.dmg}${abMod?` ${abMod>0?"+":""}${abMod}`:""}`});
        }
      });
    });
    if (state.cls==="Monk") {
      const maMod = Math.max(strMod, dexMod);
      const maDie = SCALING.martialDie(state.level);
      attacks.push({name:"Unarmed Strike", bonus:maMod+profBonus, dice:`1d${maDie}`, type:"bludgeoning", dmgMod:maMod,
        dmg:`1d${maDie} bludgeoning${maMod?` ${maMod>0?"+":""}${maMod}`:""}`});
    } else {
      attacks.push({name:"Unarmed Strike", bonus:strMod+profBonus, dice:null, type:"bludgeoning", dmgMod:Math.max(1,1+strMod), dmg:`${Math.max(1,1+strMod)} bludgeoning`});
    }
  }

  // Spellcasting numbers
  const castAb = c && c.spellcaster;
  const castMod = castAb && state.scores[castAb]!=null ? mod(state.scores[castAb]) : 0;
  const chosenSpells = SPELLS.filter(s=>state.spells.includes(s.n));

  const attackRows = attacks.map(a=>
    `<li class="rollable" onclick="attackRoll('${escQ(a.name)}',${a.bonus},${a.dice?`'${a.dice}'`:"null"},'${a.type}',${a.dmgMod})" title="Click to attack">${a.name} <b>${fmtMod(a.bonus)}</b> <small style="color:var(--muted)">${allDice(a.dmg)}</small></li>`).join("");

  const slotRows = getSlotRows().filter(r=>r.total>0).map(r=>{
    const used = state.slotsUsed[r.lv]||0;
    const pips = Array.from({length:r.total},(_,i)=>{
      const filled = i < r.total-used;
      return `<span class="slot-pip${filled?" filled":""}" onclick="${filled?`spendSlot(${r.lv})`:`restoreSlot(${r.lv})`}" title="${filled?"Click to expend":"Click to restore"}"></span>`;
    }).join(" ");
    return `<li><b>${r.pact?`Pact Slots (Level ${r.lv})`:`Level ${r.lv} Slots`}:</b> ${pips}</li>`;
  }).join("");

  const resList = resourcesFor();
  const resBlock = resList.length ? `
    <h3 class="section">${refLink("Class Resources","Resources")}</h3>
    <ul class="clean">
      ${resList.map(r=>{
        const used = state.resUsed[r.name]||0, left = r.max - used;
        const note = `<small style="color:var(--muted)">${r.rest} rest</small>`;
        if (r.pool) return `<li><b>${r.name}</b> ${left} / ${r.max} HP ${note}
          <span style="float:right">
            <button style="padding:.1rem .4rem;font-size:.8rem" onclick="spendRes('${escQ(r.name)}',1)" ${left<1?"disabled":""}>-1</button>
            <button style="padding:.1rem .4rem;font-size:.8rem" onclick="spendRes('${escQ(r.name)}',5)" ${left<5?"disabled":""}>-5</button>
            <button style="padding:.1rem .4rem;font-size:.8rem" onclick="restoreRes('${escQ(r.name)}')" ${used?"":"disabled"}>reset</button>
          </span></li>`;
        const pips = Array.from({length:Math.min(r.max,12)},(_,i)=>{
          const filled = i < left;
          return `<span class="slot-pip${filled?" filled":""}" title="${filled?"Click to spend":"Click to restore"}"
                    onclick="${filled?`spendRes('${escQ(r.name)}',1)`:`restoreRes('${escQ(r.name)}',1)`}"></span>`;
        }).join(" ");
        return `<li><b>${r.name}</b> ${pips}${r.max>12?` <small>(${left}/${r.max})</small>`:""} ${note}</li>`;
      }).join("")}
    </ul>` : "";

  const focusOk = hasSpellFocus();
  const spellBlock = castAb ? `
    <h3 class="section">Spellcasting (${ABILITY_NAMES[castAb]})</h3>
    ${focusOk ? "" : `<div class="warn-banner">⚠ No spellcasting focus carried. Add a ${refLink("Arcane Focus","focus")}${state.cls==="Wizard"?" or your Spellbook":""} in Equipment to cast spells.</div>`}
    <ul class="clean">
      <li>Spell Save DC <b>${8+profBonus+castMod}</b> · <span class="rollable" onclick="attackRoll('Spell Attack',${profBonus+castMod},null,'spell',0)" title="Click to roll" style="color:var(--accent)">Spell Attack ${fmtMod(profBonus+castMod)} 🎲</span></li>
      ${slotRows}
      ${chosenSpells.length>8?`<li><input type="text" id="sheetSpellFilter" placeholder="Filter your spells..." value="${sheetSpellFilter.replace(/"/g,'&quot;')}" style="padding:.25rem .4rem;font-size:.85rem"></li>`:""}
      ${SPELL_LEVELS.map(lv=>{
        const g = chosenSpells.filter(s=>s.l===lv && (!sheetSpellFilter ||
          s.n.toLowerCase().includes(sheetSpellFilter.toLowerCase()) || s.d.toLowerCase().includes(sheetSpellFilter.toLowerCase())));
        return g.length ? `<li><b>${lv===0?"Cantrips":"Level "+lv}:</b> ${g.map(s=>`<span onclick="spellDetail('${escQ(s.n)}')" title="${s.d.replace(/"/g,'&quot;')}" style="border-bottom:1px dotted var(--muted);cursor:pointer">${s.n}</span>`).join(", ")}</li>` : "";
      }).join("")}
      ${!chosenSpells.length ? '<li style="color:var(--muted)">No spells chosen yet: pick them in the Spells list on the left.</li>' : ""}
      ${chosenSpells.length && sheetSpellFilter && !chosenSpells.some(s=>s.n.toLowerCase().includes(sheetSpellFilter.toLowerCase())||s.d.toLowerCase().includes(sheetSpellFilter.toLowerCase()))
        ? '<li style="color:var(--muted)">None of your spells match that.</li>' : ""}
    </ul>` : "";

  const rp = [["Personality Traits",state.traits],["Ideals",state.ideals],["Bonds",state.bonds],["Flaws",state.flaws],["Backstory & Notes",state.notes]].filter(x=>x[1]);
  const rpBlock = rp.length ? `
    <h3 class="section">Personality</h3>
    <ul class="clean">${rp.map(([k,v])=>`<li><b>${k}:</b> ${v.replace(/</g,"&lt;")}</li>`).join("")}</ul>` : "";

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
      <h2>${state.name || "Unnamed Hero"}</h2>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
        ${state.retired?`<button onclick="resurrectCurrent()" title="Powerful magic calls them back with 1 HP">✨ Resurrect</button>
        <span style="border:1px solid var(--accent2);color:var(--accent2);border-radius:6px;padding:.3rem .6rem;font-weight:bold" title="This hero has been laid to rest">🪦 Retired · Dead</span>`:""}
        ${canAct?`<button class="roll-mode${rollMode==="adv"?" on":""}" onclick="setRollMode('adv')" title="Roll two d20s and keep the higher on every d20 test">⬆ ADV</button>
        <button class="roll-mode${rollMode==="dis"?" on dis":""}" onclick="setRollMode('dis')" title="Roll two d20s and keep the lower on every d20 test">⬇ DIS</button>
        ${condMenu()}
        <button onclick="shortRest()" title="1+ hour: spend Hit Dice to heal">⛺ Short Rest</button>
        <button onclick="longRest()" title="8 hours: restore HP, spell slots, and half your Hit Dice">🌙 Long Rest</button>
        <button onclick="undoLast()" ${undoStack.length?"":"disabled"} title="${undoStack.length?`Undo ${undoStack[undoStack.length-1].label}`:"Nothing to undo"}">↶ Undo${undoStack.length?` <small>(${undoStack.length})</small>`:""}</button>`:""}
        ${canLevel?`<button onclick="levelUp()" style="font-weight:bold" title="Advance to level ${state.level+1}">⬆ Level Up</button>`:""}
      </div>
    </div>
    ${rollModeLabel()?`<div class="mode-banner${rollMode==="dis"?" dis":""}">Rolling with ${rollModeLabel()} · <span onclick="setRollMode('${rollMode}')" style="cursor:pointer;text-decoration:underline">back to normal</span></div>`:""}
    ${state.conc?`<div class="conc-banner">🌀 Concentrating on <b>${state.conc}</b> <button onclick="dropConc('dropped')" title="Stop concentrating">✕</button></div>`:""}
    ${subclassDue()?`<div class="warn-banner">⚠ You reached level ${SUBCLASS_LEVEL} without choosing a subclass. <span class="ref-link" onclick="openSubclassPicker()">Choose your ${state.cls} subclass</span> to pick up its features.</div>`:""}
    <div class="tagline">Level ${state.level} ${state.species||"?"} ${state.cls||"?"}${state.subclass?` <span class="ref-link" onclick="${isCustomSub()?"openSubclassPicker()":`refLookup('${escQ(state.subclass)}')`}" title="${isCustomSub()?"Your own subclass: click to edit it or add features":"What is this?"}">(${escHtml(state.subclass)}${isCustomSub()?" ✎":""})</span>`:""} · ${state.background||"no background"} · ${state.alignment||"unaligned"}${state.playerName?` · played by ${state.playerName.replace(/</g,"&lt;")}`:""}</div>
    ${canAct?condSummary():""}

    <div class="vitals">
      <div class="vital"><div class="v">${ac}</div><div class="k">ARMOR CLASS</div><div style="font-size:.65rem;color:var(--muted)">${acNote}</div></div>
      <div class="vital${bloodied?" bloodied":""}"><div class="v">${hp!=null?`${state.curHp} / ${hp}`:"--"}${state.tempHp?` <small style="color:var(--good)">+${state.tempHp}</small>`:""}</div><div class="k">HIT POINTS${state.tempHp?" + TEMP":bloodied?` · <span class="ref-link" onclick="refLookup('Bloodied')">BLOODIED</span>`:""}</div>
        ${hp!=null?`<div class="hp-tracker">
          <button class="gear-btn" onclick="hpFromInput(-1)" title="Take damage: the amount typed, or 1">−</button>
          <input type="number" id="hpAmt" min="1" placeholder="1" title="Amount to take or heal; leave it blank for 1">
          <button class="gear-btn" onclick="hpFromInput(1)" title="Heal: the amount typed, or 1" ${state.curHp>=hp?"disabled":""}>+</button>
          <button class="gear-btn" onclick="changeTempHp(1)" title="Add Temporary HP">+Temp</button>${state.tempHp?`<button class="gear-btn" onclick="changeTempHp(-1)" title="Remove Temporary HP">−Temp</button>`:""}
        </div>`:""}
        ${hp!=null && state.curHp===0 ? `<div class="death-saves">DEATH SAVES
          <span>✔ ${[1,2,3].map(i=>`<span class="pip" onclick="deathPip('S',${i})">${state.deathS>=i?"●":"○"}</span>`).join("")}</span>
          <span>✘ ${[1,2,3].map(i=>`<span class="pip" onclick="deathPip('F',${i})">${state.deathF>=i?"●":"○"}</span>`).join("")}</span>
          ${state.deathS>=3?"<b style='color:var(--good)'>STABLE</b>":state.deathF>=3?"<b style='color:var(--accent2)'>DEAD</b>":""}
        </div>`:""}
      </div>
      <div class="vital rollable" onclick="rollD20('Initiative',${dexMod},'chk')" title="Click to roll initiative"><div class="v">${fmtMod(dexMod)}</div><div class="k">INITIATIVE 🎲</div></div>
      <div class="vital"><div class="v">${speedNow} ft</div><div class="k">SPEED</div>${speedNow!==baseSpeed?`<div style="font-size:.65rem;color:var(--accent2)">was ${baseSpeed} ft</div>`:""}</div>
      <div class="vital"><div class="v">+${profBonus}</div><div class="k">PROF. BONUS</div></div>
      <div class="vital"><div class="v">${c?`${state.level-state.hdUsed}/${state.level}× ${dieIcon(c.hitDie)}`:"--"}</div><div class="k"><span class="ref-link" onclick="refLookup('Hit Point Dice')">HIT DICE</span></div></div>
      <div class="vital rollable" onclick="toggleInspiration()" title="Toggle Heroic Inspiration"><div class="v">${state.inspiration?"★":"☆"}</div><div class="k">INSPIRATION</div></div>
    </div>

    <div class="statgrid">
      ${ABILITIES.map(a=>{
        const s = state.scores[a];
        const roll = s!=null ? `class="stat rollable" onclick="rollD20('${ABILITY_NAMES[a]} Check',${mod(s)},'chk')" title="Click to roll an ability check"` : 'class="stat"';
        return `<div ${roll}><div class="nm">${a}</div><div class="mod">${s!=null?fmtMod(mod(s)):"--"}</div><div class="scr">${s!=null?s:"--"}</div></div>`;
      }).join("")}
    </div>

    <div class="twocol">
      <div>
        <h3 class="section">Saving Throws</h3>
        <ul class="clean">${saveRows}</ul>
        ${attacks.length?`<h3 class="section">Attacks</h3><ul class="clean">${attackRows}</ul>`:""}
        ${resBlock}
        ${spellBlock}
        <h3 class="section">Skills</h3>
        <ul class="clean">${skillRows}</ul>
      </div>
      <div>
        <h3 class="section">Features &amp; Traits${isCustomSub()?` <button class="gear-btn" style="float:right" title="Edit ${escAttr(state.subclass)} and its features" onclick="openSubclassPicker()">✎ ${escHtml(state.subclass)}</button>`:""}</h3>
        <ul class="clean">${features.map(f=>
          typeof f === "object"
            ? `<li class="rollable" onclick="${f.act}" title="${f.tip}">${f.html}</li>`
            : `<li class="rollable" onclick="refLookup('${escQ(refTermFrom(f))}')" title="Click for details">${f}</li>`
        ).join("") || "<li>--</li>"}</ul>
        <h3 class="section">Species Traits${sp?` (${sp.size}, ${state.species})`:""}</h3>
        <ul class="clean">${traits.map(t=>`<li class="rollable" onclick="refLookup('${escQ(refTermFrom(t))}')" title="Click for details">${t}</li>`).join("") || "<li>--</li>"}</ul>
        <h3 class="section">Proficiencies</h3>
        <ul class="clean">
          <li><b>Armor:</b> ${c?c.armor:"--"}</li>
          <li><b>Weapons:</b> ${c?c.weapons:"--"}</li>
          <li><b>Tools:</b> ${bg?bg.tool:"--"}</li>
        </ul>
        <h3 class="section">Equipment</h3>
        ${purseBlock(canAct)}
        <ul class="clean">${equipmentStacks().map(({name:e, qty})=>
          `<li class="rollable" onclick="refLookup('${escQ(eqTermFrom(e))}')" title="Click for details">${e}${qty>1?` <b>×${qty}</b>`:""}${
            needsAttunement(e)?` <button class="attune-btn${isAttuned(e)?" on":""}" title="${isAttuned(e)?"Attuned: click to end":"Requires Attunement: click to attune"}"
                    onclick="event.stopPropagation();toggleAttune('${escQ(e)}')">✦</button>`:""}${
            canAct?` <span style="float:right;white-space:nowrap">
                    <button class="gear-btn" title="Drop one ${e.replace(/"/g,"&quot;")}"
                      onclick="event.stopPropagation();dropItem('${escQ(e)}')">−</button>
                    <button class="gear-btn" title="Add another ${e.replace(/"/g,"&quot;")}"
                      onclick="event.stopPropagation();addOneMore('${escQ(e)}')">+</button></span>`:""}</li>`
        ).join("") || "<li>--</li>"}</ul>
        ${(state.attuned||[]).length?`<div style="font-size:.8rem;color:var(--muted)">✦ <span class="ref-link" onclick="refLookup('Attunement')">Attuned</span> to ${state.attuned.length} of ${ATTUNEMENT_MAX}: ${state.attuned.join(", ")}</div>`:""}
        ${canAct?`<button class="gear-btn wide" onclick="openGear()">+ Add Equipment</button>`:""}
      </div>
    </div>
    ${rpBlock}
    <h3 class="section">Notes</h3>
    <textarea id="sheetNotes" rows="3" placeholder="Session notes, loot, leads, NPC names...">${(state.notes||"").replace(/</g,"&lt;")}</textarea>
    <h3 class="section" style="cursor:pointer;user-select:none" onclick="toggleRollLog()" title="Rolls, level-ups, edits, rests, and status changes">📜 History ${showRollLog?"▾":"▸"} <small style="color:var(--muted)">(${histLog.length})</small></h3>
    ${showRollLog ? `
      <ul class="clean">${histLog.length ? histLog.map(r=>
        `<li>${HIST_ICONS[r.type]||"·"} ${r.text}${r.who?` <small style="color:var(--muted)">· ${r.who}</small>`:""} <small style="color:var(--muted)">${r.at}</small></li>`).join("")
        : '<li style="color:var(--muted)">Nothing yet: rolls, level-ups, rests, edits, and dramatic events will be recorded here.</li>'}</ul>
      ${histLog.length?`<button onclick="clearRollLog()" style="margin-top:.4rem;font-size:.8rem">Clear history</button>`:""}` : ""}`;

  // Notes save as you type, without redrawing the sheet out from under the cursor
  const notesEl = el.querySelector("#sheetNotes");
  if (notesEl) notesEl.addEventListener("input", e=>{
    state.notes = e.target.value;
    const creatorNotes = document.getElementById("rpNotes");
    if (creatorNotes) creatorNotes.value = state.notes;
    try { localStorage.setItem("dnd-srd-current", JSON.stringify(state)); } catch(err) {}
    persistLoaded();
  });
  // The conditions menu hangs off a button whose position depends on how the
  // action row wrapped, so nudge it back on screen if it would run off an edge
  const cMenu = el.querySelector(".cond-menu");
  if (cMenu) {
    cMenu.style.left = "0"; cMenu.style.right = "auto";
    if (cMenu.getBoundingClientRect().right > window.innerWidth - 8) {
      cMenu.style.left = "auto"; cMenu.style.right = "0";
    }
    const box = cMenu.getBoundingClientRect();
    if (box.left < 8) {
      cMenu.style.right = "auto";
      cMenu.style.left = (8 - cMenu.parentElement.getBoundingClientRect().left) + "px";
    }
  }
  // Filtering your own spell list shouldn't redraw the box out from under you
  const spellFilterEl = el.querySelector("#sheetSpellFilter");
  if (spellFilterEl) spellFilterEl.addEventListener("input", e=>{
    sheetSpellFilter = e.target.value;
    renderSheet();
    const again = document.getElementById("sheetSpellFilter");
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });
  renderDownOverlay();
}

// ---------- TABS ----------
// The sidebar can switch on hover, which saves a click when you are skimming.
// Touch screens have no hover, so the bottom bar always waits for a tap.
const NAV_KEY = "dnd-srd-nav";
let navMode = "hover";
try { navMode = localStorage.getItem(NAV_KEY) || "hover"; } catch(e) {}
const navHoverable = () => navMode === "hover" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  window.matchMedia("(min-width: 601px)").matches;

function setNavMode(m) {
  navMode = m;
  try { localStorage.setItem(NAV_KEY, m); } catch(e) {}
  const on = 'background:var(--accent);color:#fff;border-color:var(--accent);font-weight:bold';
  const dark = document.body.classList.contains("dark");
  ["btnNavHover","btnNavClick"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.cssText = "flex:1;" + ((id==="btnNavHover") === (m==="hover") ? on + (dark?";color:#06230f":"") : "");
  });
}

// The footer's attribution link opens Settings and scrolls to the credits,
// so the full licence text stays one click from every page
function showAttribution(e) {
  if (e) e.preventDefault();
  // On a phone that button opens the More sheet, so go to the page directly
  if (onPhone()) openSettingsFromMore();
  else {
    const tab = document.querySelector('.tabs button[data-tab="settings"]');
    if (tab) tab.click();
  }
  const target = document.getElementById("attribution");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function activateTab(b) {
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tabpage").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  document.getElementById("tab-"+b.dataset.tab).classList.add("active");
}

// ---------- MORE SHEET (phones) ----------
// The bottom bar has five slots and the sidebar has more than five things in
// it. On a phone the last slot opens this sheet instead of the Settings page,
// so Settings and the outbound links all stay reachable.
const onPhone = () => window.matchMedia("(max-width: 600px)").matches;
const moreSheet = () => document.getElementById("moreSheet");
function closeMoreSheet() {
  moreSheet().classList.remove("open");
  document.querySelector('.tabs button[data-tab="settings"]').classList.remove("sheet-open");
}
function toggleMoreSheet() {
  const open = moreSheet().classList.toggle("open");
  document.querySelector('.tabs button[data-tab="settings"]').classList.toggle("sheet-open", open);
}
function openSettingsFromMore() {
  closeMoreSheet();
  const b = document.querySelector('.tabs button[data-tab="settings"]');
  activateTab(b);
  renderStorageStatus();
  window.scrollTo(0, 0);
}
// Stats is a sidebar tab on a desktop. The bottom bar has five slots and they
// are already spoken for, so on a phone it is reached from this sheet instead.
function openStatsFromMore() {
  closeMoreSheet();
  activateTab(document.querySelector('.tabs button[data-tab="stats"]'));
  renderStats();
  window.scrollTo(0, 0);
}
// A sheet left open behind a widened window would sit over the page with no
// way back to it, since the button that closes it is only on the bar
window.addEventListener("resize", ()=>{ if (!onPhone()) closeMoreSheet(); });

document.querySelectorAll(".tabs button").forEach(b=>{
  // Hovering only swaps the view; anything with side effects still waits for
  // the click handler below, and a brief delay stops a passing cursor from
  // flipping through every tab on its way somewhere else
  let hoverTimer = null;
  b.addEventListener("mouseenter", ()=>{
    if (!navHoverable() || b.classList.contains("active")) return;
    hoverTimer = setTimeout(()=>{ if (navHoverable()) b.click(); }, 90);
  });
  b.addEventListener("mouseleave", ()=>{ clearTimeout(hoverTimer); });
  b.addEventListener("click", ()=>{
    // On a phone the Settings slot is the More slot, and opens the sheet
    if (b.dataset.tab==="settings" && onPhone()) { toggleMoreSheet(); return; }
    closeMoreSheet();
    activateTab(b);
    if (b.dataset.tab==="saved") renderSavedList();
    if (b.dataset.tab==="settings") renderStorageStatus();
    if (b.dataset.tab==="rules") { loadBestiary(); loadItems(); loadExtraSources(); }
    if (b.dataset.tab==="stats") renderStats();
    if (b.dataset.tab==="create") {
      // Leaving a saved-character view: give the creator a fresh start and drop
      // the old sheet, which would otherwise sit there looking live while its
      // buttons act on cleared state
      const wasViewing = sheetTargetId === "savedSheet";
      sheetTargetId = "sheet";
      if (wasViewing) {
        const ss = document.getElementById("savedSheet");
        ss.style.display = "none"; ss.innerHTML = "";
        clearCreator();
      } else renderSheet();
    }
  });
});

// ---------- SAVE / LOAD (localStorage) ----------
// Characters live in localStorage, which is keyed by origin and survives
// deploys, service worker updates, and cache purges: shipping new code does not
// touch it. What can still lose the lot is a read that fails and then gets
// written back over the good data, a write that hits the storage quota, or the
// browser evicting the origin under pressure. All three are handled here.
const STORE_KEY  = "dnd-srd-characters";
const PREV_KEY   = "dnd-srd-characters-prev";      // the list as it was when this session opened
const RESCUE_KEY = "dnd-srd-characters-unreadable"; // bytes we could not parse, kept verbatim

let storeHealthy = true;   // false once a read comes back unreadable

function loadStore() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); }
  catch(e) { storeHealthy = false; return []; }     // storage itself is unavailable
  if (raw === null || raw === "") return [];        // genuinely nothing saved yet
  try {
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list;
  } catch(e) {}
  // Unreadable. Never let this turn into an empty list that the next save
  // writes over the top: keep the original bytes, and fall back to the copy
  // taken when the session opened.
  storeHealthy = false;
  try { if (!localStorage.getItem(RESCUE_KEY)) localStorage.setItem(RESCUE_KEY, raw); } catch(e) {}
  try {
    const prev = JSON.parse(localStorage.getItem(PREV_KEY) || "null");
    if (Array.isArray(prev)) return prev;
  } catch(e) {}
  return [];
}

function saveStore(list) {
  const json = JSON.stringify(list);
  try {
    localStorage.setItem(STORE_KEY, json);
    storeHealthy = true;
    mirrorStore(json, list.length);
    return true;
  } catch(e) {
    // Out of quota, or storage blocked. The list is still in memory, so say so
    // rather than failing silently and letting the next reload lose the work.
    storeHealthy = false;
    storageTrouble(e);
    return false;
  }
}

// A second copy of the last value known to be good, which loadStore() falls
// back to if the live one ever comes back unreadable. It is written from the
// string that was just stored successfully, so it can never itself be broken.
// The sheet writes through on nearly every tap, so this is throttled: a copy
// at most fifteen seconds stale is worth having, a doubled write on every tap
// is not, and it would only bring the quota closer.
let lastMirrorAt = 0, lastMirrorCount = -1;
function mirrorStore(json, count) {
  const now = Date.now();
  if (count === lastMirrorCount && now - lastMirrorAt < 15000) return;
  try {
    localStorage.setItem(PREV_KEY, json);
    lastMirrorAt = now;
    lastMirrorCount = count;
  } catch(e) { /* the mirror is a nicety; never let it break a real save */ }
}

// And take one at startup, so a session that only reads still has a fallback.
(function mirrorOnLoad() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (Array.isArray(list)) mirrorStore(raw, list.length);
  } catch(e) {}
})();

let toldAboutStorage = false;
function storageTrouble(err) {
  console.warn("localStorage write failed:", err && err.name);
  if (toldAboutStorage) return;
  toldAboutStorage = true;
  const msg = "Your characters are still on screen. Back them up from Settings "
            + "before closing this tab.";
  const toast = document.getElementById("rollToast");
  if (toast) {
    toast.querySelector(".what").textContent = "This browser would not save";
    const totalEl = toast.querySelector(".total");
    totalEl.textContent = "!";
    totalEl.className = "total fumble";
    toast.querySelector(".detail").textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.classList.remove("show"), 12000);
  }
  const el = document.getElementById("backupStatus");
  if (el) el.innerHTML = `<span style="color:var(--accent2)">This browser would not save. ${msg}</span>`;
}

// Browsers may evict an origin's storage when the device is short of space,
// unless the origin is marked persistent. Ask for that once there is something
// worth keeping, so the prompt some browsers show has an obvious reason.
let askedToPersist = false;
function requestPersistentStorage() {
  if (askedToPersist || !navigator.storage || !navigator.storage.persist) return;
  askedToPersist = true;
  navigator.storage.persisted()
    .then(already => already || navigator.storage.persist())
    .catch(() => {});
}

function updateSavedCount() {
  const n = loadStore().length;
  document.getElementById("savedCount").textContent = n ? `(${n})` : "";
}

// Human-readable field-by-field diff for the history log
function charDiff(o, n) {
  const d = [];
  const flat = {name:"Name", cls:"Class", subclass:"Subclass", species:"Species", background:"Background", alignment:"Alignment", level:"Level", playerName:"Player", xp:"XP"};
  Object.entries(flat).forEach(([k,label])=>{
    if ((o[k]??"") !== (n[k]??"")) d.push(`${label}: ${o[k]||"(blank)"} → ${n[k]||"(blank)"}`);
  });
  ABILITIES.forEach(a=>{
    if ((o.scores?.[a]??null) !== (n.scores?.[a]??null)) d.push(`${a}: ${o.scores?.[a]??"--"} → ${n.scores?.[a]??"--"}`);
  });
  const listDiff = (label, oa, na) => {
    const added = (na||[]).filter(x=>!(oa||[]).includes(x));
    const removed = (oa||[]).filter(x=>!(na||[]).includes(x));
    if (added.length) d.push(`${label} added: ${added.join(", ")}`);
    if (removed.length) d.push(`${label} removed: ${removed.join(", ")}`);
  };
  listDiff("Skills", o.skills, n.skills);
  listDiff("Spells", o.spells, n.spells);
  listDiff("Equipment", o.gear, n.gear);
  listDiff("Conditions", o.conditions, n.conditions);
  listDiff("Attunement", o.attuned, n.attuned);
  listDiff("Feats", (o.feats||[]).map(f=>f.n), (n.feats||[]).map(f=>f.n));
  ["traits","ideals","bonds","flaws","notes"].forEach(k=>{
    if ((o[k]||"") !== (n[k]||"")) d.push(`${k[0].toUpperCase()+k.slice(1)} edited`);
  });
  return d;
}

function saveCharacter() {
  if (!state.cls || !state.species) { alert("Pick at least a class and species before saving."); return; }
  const list = loadStore();
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.savedAt = new Date().toLocaleString();
  const existingIdx = state.loadedId ? list.findIndex(ch => ch.id === state.loadedId) : -1;
  if (existingIdx >= 0) {
    snapshot.id = state.loadedId;
    const diffs = charDiff(list[existingIdx], snapshot);
    if (diffs.length) logEvent("edit", `<b>Edited</b>: ${diffs.join("; ")}`);
    list[existingIdx] = snapshot;
  } else {
    snapshot.id = Date.now();
    list.push(snapshot);
  }
  saveStore(list);
  // There is something worth keeping now, so ask the browser not to evict it
  requestPersistentStorage();
  updateSavedCount();
  // Show the saved character on the Saved tab, leaving a fresh creator form
  const id = snapshot.id;
  clearCreator();
  document.querySelector('.tabs button[data-tab="saved"]').click();
  viewCharacter(id);
}
document.getElementById("btnSave").addEventListener("click", saveCharacter);
document.getElementById("btnSaveTop").addEventListener("click", saveCharacter);

function applyCharacter(ch) {
  state.name = ch.name; state.cls = ch.cls; state.species = ch.species;
  state.background = ch.background; state.alignment = ch.alignment;
  state.scores = {...ch.scores}; state.skills = [...(ch.skills||[])];
  state.spells = [...(ch.spells||[])];
  state.level = ch.level || 1; state.dieRolls = [...(ch.dieRolls||[])];
  state.maxHp = ch.maxHp ?? null; state.curHp = ch.curHp ?? ch.maxHp ?? null;
  state.loadedId = ch.id ?? null;
  state.playerName = ch.playerName||""; state.xp = ch.xp||"";
  state.traits = ch.traits||""; state.ideals = ch.ideals||""; state.bonds = ch.bonds||""; state.flaws = ch.flaws||""; state.notes = ch.notes||"";
  state.tempHp = ch.tempHp||0; state.inspiration = !!ch.inspiration;
  state.deathS = ch.deathS||0; state.deathF = ch.deathF||0;
  state.slotsUsed = {...(ch.slotsUsed||{})}; state.hdUsed = ch.hdUsed||0; state.stable = !!ch.stable;
  state.retired = !!ch.retired;
  state.resUsed = {...(ch.resUsed||{})}; state.conc = ch.conc || null;
  state.gear = [...(ch.gear||[])]; state.dropped = [...(ch.dropped||[])];
  state.conditions = [...(ch.conditions||[])];
  state.coins = {...{pp:0,gp:0,ep:0,sp:0,cp:0}, ...(ch.coins||{})};
  state.attuned = [...(ch.attuned||[])]; state.subclass = ch.subclass||"";
  state.customSub = ch.customSub ? JSON.parse(JSON.stringify(ch.customSub)) : null;
  state.feats = (ch.feats||[]).map(f=>({...f}));
  undoStack = [];
  document.getElementById("rpTraits").value = state.traits;
  document.getElementById("rpIdeals").value = state.ideals;
  document.getElementById("rpBonds").value = state.bonds;
  document.getElementById("rpFlaws").value = state.flaws;
  document.getElementById("rpNotes").value = state.notes;
  document.getElementById("playerName").value = state.playerName;
  document.getElementById("xpField").value = state.xp;
  renderSpellChoices();
  document.getElementById("charName").value = state.name || "";
  document.getElementById("selClass").value = state.cls || "";
  document.getElementById("selSpecies").value = state.species || "";
  document.getElementById("selBackground").value = state.background || "";
  document.getElementById("selAlignment").value = state.alignment || "";
  ABILITIES.forEach(a=>document.getElementById("ab_"+a).value = state.scores[a] ?? "");
  renderSkillChoices();
}

function loadCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch) return;
  sheetTargetId = "sheet";
  applyCharacter(ch);
  document.querySelector('.tabs button[data-tab="create"]').click();
}

function viewCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch) return;
  applyCharacter(ch);
  sheetTargetId = "savedSheet";
  document.getElementById("savedSheet").style.display = "block";
  renderSheet();
  document.getElementById("savedSheet").scrollIntoView({behavior:"smooth", block:"start"});
}

// One-click random hero from the Saved tab: randomize the creator, save, and show the result
function addRandomCharacter() {
  document.getElementById("btnRandomAll").click();
  saveCharacter();
}

// Resurrect the character currently shown on a sheet
function resurrectCurrent() {
  if (!state.retired) return;
  state.retired = false; state.curHp = 1; state.deathS = 0; state.deathF = 0; state.stable = false;
  logEvent("heal", `<b>${state.name || "Unnamed Hero"} resurrected</b>: called back from beyond the veil with 1 HP`);
  renderSheet(); persistLoaded(); renderSavedList();
}

function resurrectCharacter(id) {
  const list = loadStore();
  const ch = list.find(c=>c.id===id);
  if (!ch || !ch.retired) return;
  ch.retired = false; ch.curHp = 1; ch.deathS = 0; ch.deathF = 0; ch.stable = false;
  saveStore(list);
  logEvent("heal", `<b>${ch.name || "Unnamed Hero"} resurrected</b>: called back from beyond the veil with 1 HP`);
  if (state.loadedId === id) {
    state.retired = false; state.curHp = 1; state.deathS = 0; state.deathF = 0; state.stable = false;
    renderSheet();
  }
  renderSavedList();
}

function deleteCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch || !confirm(`Delete "${ch.name || "Unnamed Hero"}"? This cannot be undone.`)) return;
  saveStore(loadStore().filter(c=>c.id!==id));
  if (state.loadedId === id) state.loadedId = null;
  renderSavedList(); updateSavedCount();
  document.getElementById("savedSheet").innerHTML = "";
}

function renderSavedList() {
  const list = loadStore();
  const el = document.getElementById("savedList");
  if (!list.length) { el.innerHTML = '<div class="empty">No saved characters yet. Build one and hit Save.</div>'; return; }
  el.innerHTML = list.map(ch=>`
    <div class="saved-card">
      <div class="who"><b>${ch.name || "Unnamed Hero"}</b>${ch.retired?' <span title="Laid to rest">🪦</span>':""}<br>
        <small>Level ${ch.level||1} ${ch.species} ${ch.cls} · ${ch.background || "no background"}${ch.retired?" · <b>dead</b>":""} · saved ${ch.savedAt}</small></div>
      <div class="btns">
        <button onclick="viewCharacter(${ch.id})">View</button>
        <button onclick="loadCharacter(${ch.id})">Edit</button>
        <button onclick="duplicateCharacter(${ch.id})" title="Make a copy, handy before a risky level-up">⧉ Copy</button>
        <button onclick="shareCharacter(${ch.id})" title="Get a link that rebuilds this character in someone else's browser">🔗 Share</button>
        <button class="btn-danger" onclick="deleteCharacter(${ch.id})">Delete</button>
      </div>
    </div>`).join("");
}

// A copy to fall back on, or a second version of the same hero
function duplicateCharacter(id) {
  const list = loadStore();
  const ch = list.find(c=>c.id===id);
  if (!ch) return;
  const copy = JSON.parse(JSON.stringify(ch));
  copy.id = Date.now();
  copy.name = `${ch.name || "Unnamed Hero"} (copy)`;
  copy.savedAt = new Date().toLocaleString();
  list.push(copy);
  saveStore(list);
  logEvent("edit", `<b>Copied</b> ${ch.name || "Unnamed Hero"} to "${copy.name}"`);
  renderSavedList(); updateSavedCount();
}

// ---------- SHARE BY LINK ----------
// The whole character rides in the URL fragment, so nothing is uploaded anywhere.
function encodeChar(ch) {
  const json = JSON.stringify(ch);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function decodeChar(s) {
  const b = s.replace(/-/g,"+").replace(/_/g,"/");
  return JSON.parse(decodeURIComponent(escape(atob(b))));
}
function shareCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch) return;
  const url = location.origin + location.pathname + "#c=" + encodeChar(ch);
  document.getElementById("refModal").innerHTML = `
    <h3>🔗 Share ${ch.name || "Unnamed Hero"}</h3>
    <div class="lvl-step">Everything about this character is packed into the link itself: nothing is uploaded, and whoever opens it gets their own copy to keep and change.</div>
    <div class="lvl-step">
      <div class="k">The link</div>
      <textarea id="shareUrl" rows="4" readonly style="font-size:.75rem;word-break:break-all">${url}</textarea>
      <div style="margin-top:.4rem"><button onclick="copyShareUrl()">📋 Copy link</button>
        <span id="shareCopied" style="color:var(--good);margin-left:.5rem"></span></div>
      ${url.length>8000?`<div class="warn-banner">This link is very long (${url.length.toLocaleString()} characters) and some chat apps will cut it. Export to a file instead if it doesn't survive the trip.</div>`:""}
    </div>
    <div class="lvl-actions"><button onclick="refClose()">Close</button></div>`;
  document.getElementById("refOverlay").classList.add("open");
}
function copyShareUrl() {
  const el = document.getElementById("shareUrl");
  el.select();
  const done = () => { document.getElementById("shareCopied").textContent = "Copied."; };
  if (navigator.clipboard) navigator.clipboard.writeText(el.value).then(done, ()=>{ document.execCommand("copy"); done(); });
  else { document.execCommand("copy"); done(); }
}
// A shared link opens with the character offered for import, never applied silently
function checkSharedLink() {
  const m = /[#&]c=([A-Za-z0-9\-_]+)/.exec(location.hash);
  if (!m) return;
  let ch;
  try { ch = decodeChar(m[1]); } catch(e) { return; }
  if (!ch || !ch.cls) return;
  history.replaceState(null, "", location.pathname + location.search);
  if (!confirm(`Add the shared character "${ch.name || "Unnamed Hero"}" (level ${ch.level||1} ${ch.species||""} ${ch.cls}) to this browser?`)) return;
  const list = loadStore();
  ch.id = Date.now();
  ch.savedAt = new Date().toLocaleString();
  list.push(ch);
  saveStore(list);
  updateSavedCount();
  document.querySelector('.tabs button[data-tab="saved"]').click();
  viewCharacter(ch.id);
}

// ---------- BACKUP & RESTORE ----------
// One JSON file holding every saved character. The wrapper carries enough to
// recognise the file later; a plain array from an older export still restores.
const BACKUP_FORMAT = "auto-character-generator-backup";
function backupStatus(msg, good) {
  const el = document.getElementById("backupStatus");
  if (el) el.innerHTML = msg ? `<span style="color:var(--${good===false?"accent2":good?"good":"muted"})">${msg}</span>` : "";
}
function backupCharacters() {
  const list = loadStore();
  if (!list.length) { backupStatus("There are no saved characters to back up yet.", false); return; }
  const stamp = new Date();
  const pad = n => String(n).padStart(2,"0");
  const payload = {
    format: BACKUP_FORMAT, version: 1,
    savedAt: stamp.toISOString(),
    count: list.length,
    characters: list,
    // The play tallies ride along so that moving to a new browser carries the
    // dice history with the characters. Restoring only adopts them into a
    // browser that has none of its own; see restoreCharacters().
    stats: STATS
  };
  // Date and time, biggest unit first, so a folder of backups sorts by name
  // into the order they were taken and the newest is the one at the bottom.
  // Seconds are in there because two backups a minute apart are common when
  // you are about to try something risky, and the browser would otherwise
  // quietly rename the second one to "(1)".
  const name = `character-backup-${stamp.getFullYear()}-${pad(stamp.getMonth()+1)}-${pad(stamp.getDate())}`
             + `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.json`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"}));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  backupStatus(`Backed up ${list.length} character${list.length===1?"":"s"} to ${a.download}, taken ${stamp.toLocaleString()}.`, true);
}
function restoreCharacters(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      // Accept both the wrapped backup and a bare array from an older export
      const incoming = Array.isArray(raw) ? raw
        : Array.isArray(raw && raw.characters) ? raw.characters : null;
      if (!incoming) throw new Error("not a character backup");
      const list = loadStore();
      const ids = new Set(list.map(c=>c.id));
      let added = 0, skipped = 0;
      incoming.forEach(ch => {
        if (!ch || !ch.cls) { skipped++; return; }
        const copy = JSON.parse(JSON.stringify(ch));
        if (copy.id == null || ids.has(copy.id)) copy.id = Date.now() + Math.floor(Math.random()*1e6);
        ids.add(copy.id);
        list.push(copy);
        added++;
      });
      saveStore(list);
      // Adopt the backup's tallies only into a browser that has never logged a
      // day of its own. Adding them to an existing tally would double every
      // number the second time the same file was restored, and there is no way
      // to tell that from a genuine second computer.
      let statsToo = false;
      if (raw && raw.stats && !Object.keys(STATS.days).length) {
        STATS = mergeStats(blankStats(), raw.stats);
        saveStats(); flushStats();   // mark dirty, then write it now rather than in a second
        statsToo = true;
      }
      renderSavedList(); updateSavedCount();
      backupStatus(added
        ? `Restored ${added} character${added===1?"":"s"}${skipped?`, skipped ${skipped} unreadable entr${skipped===1?"y":"ies"}`:""}. You now have ${list.length}.${statsToo?" The Stats page was restored with them.":""}`
        : "That file held no readable characters.", !!added);
    } catch(e) {
      backupStatus("Could not read that file. It should be a backup created by this app.", false);
    }
    input.value = "";
  };
  reader.onerror = () => { backupStatus("The file could not be read.", false); input.value = ""; };
  reader.readAsText(file);
}

const rulesInput = document.getElementById("rulesSearch");

// Category chips: everything before the "·" in an entry's category, so all the
// per-level spell buckets collapse into one "Spell" filter
// Nineteen type chips was more scrolling than sorting, so the ones that all
// describe a character fold into Character and magic items join Equipment.
// Only the chips merge: each card still shows its own specific category, so a
// Condition or an Origin Feat still says so.
const CAT_MERGE = {
  "Spellcasting":"Character", "Alignment":"Character", "Species":"Character",
  "Combat":"Character", "Class":"Character", "Subclass":"Character",
  "Action":"Character", "Rules":"Character", "Condition":"Character",
  "Species Trait":"Character", "Background":"Character", "Feat":"Character",
  "Feature":"Character", "Rest":"Character",
  "Magic Item":"Equipment"
};
const ruleCat = r => { const base = r.c.split(" · ")[0]; return CAT_MERGE[base] || base; };
let ruleFilter = null;
// Long lists are capped so a bare search doesn't build thousands of cards
const RULE_CAP = 200;
// Only Type filters the list. Each card still names the book it came from, so
// the source is there to read without being another row of chips to get past.
function renderRuleCats() {
  const counts = {};
  RULES.forEach(r=>{ const k = ruleCat(r); counts[k] = (counts[k]||0)+1; });
  const cats = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  document.getElementById("ruleCats").innerHTML =
    `<div class="chip-row"><span class="chip-lbl">Type</span>` +
    `<span class="cat-chip${ruleFilter===null?" picked":""}" onclick="setRuleFilter(null)">All <small>${RULES.length}</small></span>` +
    cats.map(c=>`<span class="cat-chip${ruleFilter===c?" picked":""}" onclick="setRuleFilter('${escQ(c)}')">${c} <small>${counts[c]}</small></span>`).join("") +
    `</div>`;
}
function setRuleFilter(c) {
  ruleFilter = (ruleFilter === c) ? null : c;
  renderRuleCats();
  renderRules(rulesInput.value);
}

function renderRules(q) {
  q = (q||"").trim().toLowerCase();
  let pool = RULES;
  if (ruleFilter) pool = pool.filter(r=>ruleCat(r)===ruleFilter);
  let hits = !q ? pool : pool.filter(r =>
    r.t.toLowerCase().includes(q) || r.d.toLowerCase().includes(q) || r.c.toLowerCase().includes(q));
  const hi = txt => q ? txt.replace(new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi"), "<mark>$1</mark>") : txt;
  // Creatures sort by challenge. Everything else keeps its natural order until
  // a search is typed, at which point a hit on the name beats a hit buried in
  // the text: with a couple of thousand items in the pool, searching "torch"
  // otherwise turned up the packs that list one long before the torch itself.
  if (ruleFilter === "Creature") hits = hits.slice().sort((a,b)=> a.cr - b.cr || a.t.localeCompare(b.t));
  else if (q) {
    const rank = r => {
      const t = r.t.toLowerCase();
      return t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : 3;
    };
    hits = hits.map((r,i)=>({r,i})).sort((a,b)=> rank(a.r) - rank(b.r) || a.i - b.i).map(x=>x.r);
  }
  const shown = hits.slice(0, RULE_CAP);
  const where = ruleFilter || "";
  const note =
    (bestiaryState === "loading" ? `<div class="rule-more">Loading 586 creature stat blocks in the background...</div>` :
     bestiaryState === "failed" ? `<div class="rule-more">Creature stat blocks could not be loaded. <span class="ref-link" onclick="bestiaryState='idle';loadBestiary()">Try again</span>.</div>` : "") +
    (itemsState === "loading" ? `<div class="rule-more">Loading the full equipment catalogue in the background...</div>` :
     itemsState === "failed" ? `<div class="rule-more">The equipment catalogue could not be loaded. <span class="ref-link" onclick="itemsState='idle';loadItems()">Try again</span>.</div>` : "") +
    (extraState === "loading" ? `<div class="rule-more">Loading the Deep Magic, Tome of Beasts, and Creature Codex entries in the background...</div>` :
     extraState === "failed" ? `<div class="rule-more">The third-party sources could not be loaded. <span class="ref-link" onclick="extraState='idle';loadExtraSources()">Try again</span>.</div>` : "");
  document.getElementById("rulesResults").innerHTML = note + (hits.length
    ? (hits.length > RULE_CAP
        ? `<div class="rule-more">Showing the first ${RULE_CAP} of <b>${hits.length}</b> matches${ruleFilter==="Creature"?", lowest challenge first":""}. Keep typing, or narrow it with the chips above.</div>` : "") +
      shown.map(r=>{
        const src = r.src || SRC_SRD;
        const open = r.creature ? ` class="rule-card clickable" onclick="creatureDetail('${escQ(r.creature)}','${escQ(src)}')" title="Full stat block"` : ` class="rule-card"`;
        return `<div${open}><div class="cat">${r.c}<span class="src-tag${src===SRC_SRD?"":" alt"}">${src}</span></div>
          <h4>${allDice(hi(r.t))}</h4><p>${allDice(hi(r.d))}</p>
          ${r.creature?`<div style="font-size:.85rem;color:var(--accent)">Open the full stat block →</div>`:""}
          ${r.url?`<a href="${r.url}" target="_blank" rel="noopener" style="font-size:.85rem">Full text at ${src===SRC_SRD?"the SRD":"a5esrd.com"} ↗</a>`:""}</div>`;
      }).join("")
    : `<div class="empty">Nothing matched${where?` in ${where}`:""}. Try another term${where?` or pick <span class="ref-link" onclick="setRuleFilter(null)">All</span>`:""}.</div>`);
}
rulesInput.addEventListener("input", ()=>renderRules(rulesInput.value));

// ---------- BESTIARY (Monstrous Menagerie) ----------
// A megabyte of stat blocks has no business loading with the app, so it is
// fetched in the background the first time the Reference tab is opened and
// folded in as a Creature type when it lands.
let bestiaryState = "idle";   // idle | loading | ready | failed
const crLabel = cr => cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr);

function loadBestiary() {
  if (bestiaryState !== "idle") return;
  bestiaryState = "loading";
  renderRuleCats();
  const s = document.createElement("script");
  s.src = "js/bestiary.js?v=" + (document.querySelector('script[src*="app.js"]').src.split("v=")[1] || "1");
  s.onerror = () => { bestiaryState = "failed"; renderRuleCats(); renderRules(rulesInput.value); };
  document.body.appendChild(s);
}
// bestiary.js calls this once it has defined A5E_CREATURES
function onBestiaryLoaded() {
  bestiaryState = "ready";
  A5E_CREATURES.forEach(c=>{
    const bits = [`Challenge ${crLabel(c.cr)}${c.xp?` (${c.xp.toLocaleString()} XP)`:""}.`,
      `${c.sz} ${c.ty}.`, `AC ${c.ac}.`, `HP ${c.hp}${c.hd?` (${c.hd})`:""}.`, `Speed ${c.spd}.`];
    if (c.se) bits.push(`Senses: ${c.se}.`);
    if (c.ri) bits.push(c.ri + ".");
    const names = [...(c.tr||[]).map(t=>t.n), ...(c.ac2||[]).map(t=>t.n)];
    if (names.length) bits.push(`Traits and actions: ${names.join(", ")}.`);
    RULES.push({ c:"Creature", t:c.n, src:"Monstrous Menagerie", cr:c.cr, creature:c.n, d:bits.join(" ") });
  });
  renderRuleCats();
  renderRules(rulesInput.value);
  refreshStatsIfOpen();
}

// ---------- EXTENDED EQUIPMENT ----------
// The full item catalogue is another megabyte, so it rides along with the
// bestiary: fetched the first time the Reference tab is opened, then folded in
// under Equipment. Compiled by the companion DM Screen project; see Settings
// for who published what.
let itemsState = "idle";      // idle | loading | ready | failed

function loadItems() {
  if (itemsState !== "idle") return;
  itemsState = "loading";
  renderRuleCats();
  const s = document.createElement("script");
  s.src = "js/items.js?v=" + (document.querySelector('script[src*="app.js"]').src.split("v=")[1] || "1");
  s.onerror = () => { itemsState = "failed"; renderRuleCats(); renderRules(rulesInput.value); };
  document.body.appendChild(s);
}

// items.js calls this once it has defined EXTRA_ITEMS
function onItemsLoaded() {
  itemsState = "ready";
  // The hand-written SRD gear and magic items stay authoritative: they are
  // wired into the sheet and the equipment picker, so a catalogue entry of the
  // same name would only show up twice saying much the same thing.
  const have = new Set(RULES
    .filter(r => /^(Equipment|Magic Item)/.test(r.c))
    .map(r => r.t.toLowerCase()));
  EXTRA_ITEMS.forEach(i => {
    if (have.has(i.n.toLowerCase())) return;
    have.add(i.n.toLowerCase());
    const head = [i.r, i.a].filter(Boolean).join(", ");
    const stats = [i.p && `Cost ${i.p}`, i.w && `Weight ${i.w}`, i.x].filter(Boolean).join(". ");
    const d = [head && head.charAt(0).toUpperCase() + head.slice(1) + ".", stats && stats + ".", i.d]
      .filter(Boolean).join(" ");
    RULES.push({
      c: (i.m ? "Magic Item" : "Equipment") + (i.c ? " · " + i.c : ""),
      t: i.n,
      src: ITEM_SOURCES[i.s],
      d: d || i.n
    });
  });
  renderRuleCats();
  renderRules(rulesInput.value);
  refreshStatsIfOpen();
}

// Every creature set that has been loaded, newest first, so a name that appears
// in more than one book resolves to the edition the card came from.
// ---------- THIRD-PARTY SOURCES ----------
// Deep Magic, the Tome of Beasts line, Creature Codex, Vault of Magic, and
// Spells That Don't Suck. Another few thousand entries, so it rides along with
// the bestiary and the item catalogue rather than loading with the app.
let extraState = "idle";      // idle | loading | ready | failed

function loadExtraSources() {
  if (extraState !== "idle") return;
  extraState = "loading";
  renderRuleCats();
  const s = document.createElement("script");
  s.src = "js/open5e-extra.js?v=" + (document.querySelector('script[src*="app.js"]').src.split("v=")[1] || "1");
  s.onerror = () => { extraState = "failed"; renderRuleCats(); renderRules(rulesInput.value); };
  document.body.appendChild(s);
}

// open5e-extra.js calls this once it has defined its arrays
function onExtraSourcesLoaded() {
  extraState = "ready";

  KP_SPELLS.forEach(s => {
    const bits = [`Casting Time: ${s.t}.`, `Range: ${s.r}.`, `Components: ${s.c || "None"}.`, `Duration: ${s.u}.`];
    if (s.conc) bits.push("Concentration.");
    if (s.rit) bits.push("Ritual.");
    RULES.push({
      c: s.l === 0 ? "Spell · Cantrip" : "Spell · Level " + s.l,
      t: s.n, src: KP_SOURCES[s.src],
      d: `<i>${s.s}${s.l ? ", level " + s.l : " cantrip"}.</i> ${bits.join(" ")}<br><br>${s.d}` +
         (s.hl ? `<br><br><b>At Higher Levels.</b> ${s.hl}` : "")
    });
  });

  KP_CREATURES.forEach(c => {
    const bits = [`Challenge ${crLabel(c.cr)}${c.xp?` (${c.xp.toLocaleString()} XP)`:""}.`,
      `${c.sz} ${c.ty}.`, `AC ${c.ac}.`, `HP ${c.hp}${c.hd?` (${c.hd})`:""}.`, `Speed ${c.spd}.`];
    if (c.se) bits.push(`Senses: ${c.se}.`);
    if (c.ri) bits.push(c.ri + ".");
    const names = [...(c.tr||[]).map(t=>t.n), ...(c.ac2||[]).map(t=>t.n)];
    if (names.length) bits.push(`Traits and actions: ${names.join(", ")}.`);
    RULES.push({ c:"Creature", t:c.n, src:KP_SOURCES[c.src], cr:c.cr, creature:c.n, d:bits.join(" ") });
  });

  // The item catalogue already carries most of Vault of Magic, so only the
  // entries it does not have are added rather than a second card per item.
  const have = new Set(RULES
    .filter(r => /^(Equipment|Magic Item)/.test(r.c))
    .map(r => r.t.toLowerCase()));
  KP_MAGICITEMS.forEach(m => {
    if (have.has(m.n.toLowerCase())) return;
    have.add(m.n.toLowerCase());
    const head = [m.r, m.a].filter(Boolean).join(", ");
    RULES.push({
      c: "Magic Item" + (m.c ? " · " + m.c : ""),
      t: m.n, src: KP_SOURCES[m.src],
      d: (head ? head.charAt(0).toUpperCase() + head.slice(1) + ". " : "") + m.d
    });
  });

  renderRuleCats();
  renderRules(rulesInput.value);
  refreshStatsIfOpen();
}

function allCreatureSets() {
  const sets = [];
  if (typeof A5E_CREATURES !== "undefined") sets.push({ rows: A5E_CREATURES, src: "Monstrous Menagerie" });
  if (typeof KP_CREATURES !== "undefined") sets.push({ rows: KP_CREATURES, src: null });
  return sets;
}
function findCreature(name, src) {
  for (const set of allCreatureSets()) {
    const hit = set.rows.find(x => x.n === name && (!src || (set.src || KP_SOURCES[x.src]) === src));
    if (hit) return { c: hit, src: set.src || KP_SOURCES[hit.src] };
  }
  for (const set of allCreatureSets()) {
    const hit = set.rows.find(x => x.n === name);
    if (hit) return { c: hit, src: set.src || KP_SOURCES[hit.src] };
  }
  return null;
}

function creatureDetail(name, src) {
  const found = findCreature(name, src);
  if (!found) return;
  const c = found.c;
  const abs = ["STR","DEX","CON","INT","WIS","CHA"];
  const line = (k,v) => v ? `<div><b>${k}</b> ${v}</div>` : "";
  document.getElementById("refModal").innerHTML = `
    <h3>${escHtml(c.n)}</h3>
    <div style="color:var(--muted);font-style:italic">${c.sz} ${c.ty} · Challenge ${crLabel(c.cr)}${c.xp?` (${c.xp.toLocaleString()} XP)`:""}</div>
    <div class="lvl-step">
      ${line("Armor Class", c.ac + (c.acd?` (${escHtml(c.acd)})`:""))}
      ${line("Hit Points", c.hp + (c.hd?` (${allDice(escHtml(c.hd))})`:""))}
      ${line("Speed", escHtml(c.spd))}
    </div>
    <div class="statgrid" style="margin-bottom:.7rem">
      ${abs.map((a,i)=>{
        const v = c.ab[i] ?? 10, m = Math.floor((v-10)/2);
        return `<div class="stat rollable" onclick="rollD20('${a} check (${escQ(c.n)})',${m},'chk')" title="Roll a ${a} check for this creature">
          <div class="nm">${a}</div><div class="mod">${fmtMod(m)}</div><div class="scr">${v}</div></div>`;
      }).join("")}
    </div>
    <div class="lvl-step">
      ${line("Saving Throws", c.sv && escHtml(c.sv))}
      ${line("Skills", c.sk && escHtml(c.sk))}
      ${line("Senses", c.se && escHtml(c.se))}
      ${line("Languages", c.lg && escHtml(c.lg))}
      ${line("Defences", c.ri && escHtml(c.ri))}
    </div>
    ${(c.tr||[]).length?`<div class="lvl-step"><div class="k">Traits</div>
      ${c.tr.map(t=>`<div style="margin-bottom:.4rem"><b>${escHtml(t.n)}.</b> ${allDice(t.d)}</div>`).join("")}</div>`:""}
    ${(c.ac2||[]).length?`<div class="lvl-step"><div class="k">Actions</div>
      ${c.ac2.map(t=>`<div style="margin-bottom:.4rem"><b>${escHtml(t.n)}.</b> ${allDice(t.d)}</div>`).join("")}</div>`:""}
    <div style="font-size:.8rem;color:var(--muted)">${escHtml(found.src)}, used under the Open Game License v1.0a. See Settings for the full notice.</div>
    <div class="lvl-actions"><button onclick="refClose()">Close</button></div>`;
  document.getElementById("refOverlay").classList.add("open");
}

// ---------- PLAY STATS ----------
// A lifetime tally of what happens at the table. The history log below answers
// "what just happened"; it is capped at 200 entries and written as HTML, so it
// cannot answer "how many natural 20s have I ever rolled". These counters can.
// They only go up, they are a few kilobytes, and they are written from the same
// places the log already fires from, so the two cannot drift apart.
const STATS_KEY = "dnd-srd-stats";
const blankStats = () => ({
  v: 1,
  firstAt: null, lastAt: null,
  days: {},                                  // YYYY-MM-DD -> events that day
  d20: {}, adv: 0, dis: 0,                   // natural d20 face -> times rolled
  dice: {},                                  // sides -> { n, sum } from the dice tray
  init: { n:0, sum:0, best:null, worst:null },
  hp: { damage:0, healed:0, temp:0, biggestHit:0, biggestHeal:0, downed:0, revived:0 },
  death: { rolls:0, pass:0, fail:0, nat20:0, nat1:0, died:0 },
  rest: { short:0, long:0, hitDice:0, interrupted:0 },
  cast: { total:0, cantrip:0, slots:0, by:{} },
  lvl: { ups:0, by:{} },
  xp: 0,
  coins: { gained:0, spent:0 },
  gear: { picked:0, dropped:0, attuned:0, by:{} },
  conds: {},
  events: {}
});
// Merge rather than assign, so a tally written by an older build keeps its
// numbers when a later one adds a counter next to them.
function mergeStats(base, raw) {
  Object.keys(raw || {}).forEach(k => {
    const b = base[k], r = raw[k];
    if (b && r && typeof b === "object" && typeof r === "object" &&
        !Array.isArray(b) && !Array.isArray(r)) mergeStats(b, r);
    else if (r !== undefined && r !== null) base[k] = r;
  });
  return base;
}
let STATS = blankStats();
try { STATS = mergeStats(blankStats(), JSON.parse(localStorage.getItem(STATS_KEY))); } catch(e) {}

// Rolling a handful of dice fires several of these in a row, so the write is
// batched. Anything still pending is flushed when the page goes away, which on
// a phone is the only reliable moment: a backgrounded tab is often killed
// outright without ever seeing unload.
let statsDirty = false, statsTimer = null;
function saveStats() {
  statsDirty = true;
  if (!statsTimer) statsTimer = setTimeout(flushStats, 1500);
}
function flushStats() {
  clearTimeout(statsTimer); statsTimer = null;
  if (!statsDirty) return;
  statsDirty = false;
  try { localStorage.setItem(STATS_KEY, JSON.stringify(STATS)); } catch(e) { /* a full quota must not break play */ }
}
window.addEventListener("pagehide", flushStats);
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState === "hidden") flushStats(); });

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function statDay() {
  const now = new Date();
  if (!STATS.firstAt) STATS.firstAt = now.toISOString();
  STATS.lastAt = now.toISOString();
  const k = dayKey(now);
  STATS.days[k] = (STATS.days[k] || 0) + 1;
  saveStats();
}
// A name tally that cannot grow without bound: a few hundred distinct spells or
// items is already more than the page shows, so the long tail is dropped.
function tally(obj, key, n) {
  if (!key) return;
  obj[key] = (obj[key] || 0) + (n == null ? 1 : n);
  const keys = Object.keys(obj);
  if (keys.length > 300) keys.sort((a,b)=>obj[b]-obj[a]).slice(200).forEach(k=>delete obj[k]);
  saveStats();
}
function noteD20(keep, adv, dis) {
  STATS.d20[keep] = (STATS.d20[keep] || 0) + 1;
  if (adv) STATS.adv++;
  if (dis) STATS.dis++;
  saveStats();
}

// ---------- DICE ROLLING & HP ----------
let toastTimer = null;

// History: rolls, level-ups, edits, rests, and status events (most recent first)
let histLog = [];
try { histLog = JSON.parse(localStorage.getItem("dnd-srd-history")) || []; } catch(e) {}
let showRollLog = false;
const HIST_ICONS = { roll:"🎲", level:"⬆️", edit:"✏️", rest:"⛺", longrest:"🌙", status:"💀", heal:"❤️", cast:"✨", resource:"🔆", gear:"🎒", xp:"✳️" };
function logEvent(type, text) {
  tally(STATS.events, type);
  statDay();
  histLog.unshift({type, text, who: state.name || "", at: new Date().toLocaleString()});
  if (histLog.length > 200) histLog.length = 200;
  try { localStorage.setItem("dnd-srd-history", JSON.stringify(histLog)); } catch(e) {}
  if (showRollLog) renderSheet();
}
function logRoll(what, dice, result) {
  logEvent("roll", `<b>${what}</b> · ${diceHtml(dice)} = <b style="color:var(--accent)">${result}</b>`);
}
function toggleRollLog() { showRollLog = !showRollLog; renderSheet(); }
function clearRollLog() {
  histLog = [];
  try { localStorage.setItem("dnd-srd-history", "[]"); } catch(e) {}
  renderSheet();
}

// Advantage / disadvantage applies to every d20 test until switched off
let rollMode = "normal";
function setRollMode(m) { rollMode = (rollMode === m) ? "normal" : m; renderSheet(); }
function rollModeLabel() { return rollMode==="adv" ? "Advantage" : rollMode==="dis" ? "Disadvantage" : null; }

// One d20 test. The manual Advantage/Disadvantage toggle and anything the
// character's conditions impose are combined here; per the rules they don't
// stack, and having both at once cancels out to a single die.
function d20Roll(kind, ability) {
  const c = kind ? condRollMode(kind, ability) : { adv:null, dis:null };
  let adv = rollMode === "adv" || !!c.adv;
  let dis = rollMode === "dis" || !!c.dis;
  const why = [];
  if (adv && dis) {
    adv = dis = false;
    why.push("Advantage and Disadvantage cancel");
  } else if (adv && c.adv) why.push(c.adv);
  else if (dis && c.dis) why.push(c.dis);
  const a = 1 + Math.floor(Math.random()*20);
  if (!adv && !dis) {
    noteD20(a, false, false);
    return { v:a, pair:null, mode: why.length ? why[0] : null, flat:!!why.length };
  }
  const b = 1 + Math.floor(Math.random()*20);
  const keep = adv ? Math.max(a,b) : Math.min(a,b);
  noteD20(keep, adv, dis);
  const drop = adv ? Math.min(a,b) : Math.max(a,b);
  const label = (adv ? "Advantage" : "Disadvantage") + (why.length ? ` · ${why[0]}` : "");
  return { v:keep, pair:[keep,drop], mode:label };
}
function d20Detail(r, modifier) {
  const sign = modifier>=0 ? "+" : "-", m = Math.abs(modifier);
  return r.pair
    ? `${dieIcon(20)} (${r.pair[0]}, <s style="opacity:.45">${r.pair[1]}</s>) ${sign} ${m}`
    : allDice(`d20 (${r.v}) ${sign} ${m}`);
}

function rollD20(what, modifier, kind, ability) {
  const r = d20Roll(kind, ability);
  const d = r.v;
  const total = d + modifier;
  if (/^Initiative/.test(what)) {
    const i = STATS.init;
    i.n++; i.sum += total;
    i.best = i.best == null ? total : Math.max(i.best, total);
    i.worst = i.worst == null ? total : Math.min(i.worst, total);
    saveStats();
  }
  logRoll(what + (r.mode?` (${r.mode})`:""), d20Detail(r, modifier), total);
  const toast = document.getElementById("rollToast");
  toast.querySelector(".what").textContent = what;
  const totalEl = toast.querySelector(".total");
  totalEl.textContent = total;
  totalEl.className = "total" + (d===20?" crit":d===1?" fumble":"");
  // A condition can make a save fail no matter what the die says
  const autoFail = kind === "sav" && ability &&
    activeConds().some(c=>(c.autoFail||[]).includes(ability));
  toast.querySelector(".detail").innerHTML =
    d20Detail(r, modifier) + (r.mode?` · ${r.mode}`:"") +
    (autoFail ? ` · <b style="color:var(--accent2)">auto-fails while ${state.conditions.filter(n=>(CONDITIONS[n].autoFail||[]).includes(ability)).join(", ")}</b>`
              : d===20?" · NAT 20!":d===1?" · Nat 1":"");
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 3500);
}

function rollDie(sides) {
  const d = 1 + Math.floor(Math.random()*sides);
  const t = STATS.dice[sides] || (STATS.dice[sides] = { n:0, sum:0 });
  t.n++; t.sum += d;
  saveStats();
  logRoll("d"+sides, `d${sides} (${d})`, d);
  const toast = document.getElementById("rollToast");
  toast.querySelector(".what").innerHTML = dieIcon(sides);
  const totalEl = toast.querySelector(".total");
  totalEl.textContent = d;
  totalEl.className = "total" + (sides===20 && d===20 ? " crit" : sides===20 && d===1 ? " fumble" : "");
  toast.querySelector(".detail").textContent = sides===20 && d===20 ? "NAT 20!" : sides===20 && d===1 ? "Nat 1" : "";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 3500);
}

// Damage or healing from the box between the − and + buttons. An empty box
// means 1, so the buttons work as a plain step when nothing is typed.
function hpFromInput(sign) {
  const el = document.getElementById("hpAmt");
  const n = Math.abs(parseInt(el && el.value, 10) || 0) || 1;
  changeHp(sign * n);
}

function changeHp(delta) {
  if (state.maxHp==null) return;
  pushUndo(delta < 0 ? `${-delta} damage` : `${delta} healing`);
  const damageTaken = delta < 0 ? -delta : 0;
  if (delta < 0 && state.tempHp > 0) {
    const absorbed = Math.min(state.tempHp, -delta);
    state.tempHp -= absorbed;
    delta += absorbed;
  }
  const before = state.curHp;
  state.curHp = Math.max(0, Math.min(state.maxHp, state.curHp + delta));
  if (damageTaken > 0) {
    STATS.hp.damage += damageTaken;
    STATS.hp.biggestHit = Math.max(STATS.hp.biggestHit, damageTaken);
  } else if (delta > 0) {
    // credit only the healing that landed: topping up at full HP heals nothing
    const got = state.curHp - before;
    STATS.hp.healed += got;
    STATS.hp.biggestHeal = Math.max(STATS.hp.biggestHeal, got);
  }
  saveStats();
  if (before > 0 && state.curHp === 0) {
    STATS.hp.downed++;
    state.stable = false;
    logEvent("status", `<b>Down!</b> Dropped to 0 HP`);
    if (state.conc) dropConc("knocked unconscious");
  }
  if (state.curHp > 0 && before === 0) {
    STATS.hp.revived++;
    state.deathS = 0; state.deathF = 0; state.stable = false;
    logEvent("heal", `<b>Back on their feet</b> with ${state.curHp} HP`);
  }
  renderSheet();
  persistLoaded();
  // Damage while concentrating forces a save, unless it already knocked them out
  if (damageTaken > 0 && state.conc && state.curHp > 0) concCheck(damageTaken);
}

function changeTempHp(delta) {
  pushUndo("the temporary HP change");
  if (delta > 0) { STATS.hp.temp += delta; saveStats(); }
  state.tempHp = Math.max(0, (state.tempHp||0) + delta);
  renderSheet();
  persistLoaded();
}

function toggleInspiration() {
  pushUndo("the Inspiration toggle");
  state.inspiration = !state.inspiration;
  renderSheet();
  persistLoaded();
}

function deathPip(kind, n) {
  pushUndo("the death save mark");
  const key = kind === "S" ? "deathS" : "deathF";
  state[key] = state[key] >= n ? n - 1 : n;
  renderSheet();
  persistLoaded();
}

// Silently write play-time changes (HP, level) back to the saved copy
function persistLoaded() {
  if (!state.loadedId) return;
  const list = loadStore();
  const i = list.findIndex(c=>c.id===state.loadedId);
  if (i < 0) return;
  const snap = JSON.parse(JSON.stringify(state));
  snap.id = state.loadedId;
  snap.savedAt = list[i].savedAt;
  list[i] = snap;
  saveStore(list);
}

// ---------- LEVEL UP (in-page, nothing applies until Confirm) ----------
let pendingLvl = null;

function levelUp() {
  if (!state.cls || state.level >= 20) return;
  const newLevel = state.level + 1;
  pendingLvl = {
    newLevel,
    rolledValue: null, hpMode: null,
    asi: {},
    hasAsi: (ASI_LEVELS[state.cls] || ASI_LEVELS.default).includes(newLevel),
    asiMode: "asi", feat: null, featFilter: "",
    // The subclass is chosen the first time you reach the subclass level
    needSub: newLevel >= SUBCLASS_LEVEL && !state.subclass && subclassChoices().length > 0,
    sub: null,
    spellMode: CLASSES[state.cls].spellcaster ? "random" : null,
    spells: [...state.spells]
  };
  renderLvlModal();
  document.getElementById("lvlOverlay").classList.add("open");
}

function lvlHpGain() {
  if (!pendingLvl || !pendingLvl.hpMode) return null;
  return pendingLvl.hpMode==="roll" ? pendingLvl.rolledValue : CLASSES[state.cls].hitDie/2 + 1;
}

function renderLvlModal() {
  if (!pendingLvl) return;
  const c = CLASSES[state.cls];
  const avg = c.hitDie/2 + 1;
  const feats = CLASS_LEVELS[state.cls][pendingLvl.newLevel] || [];
  const asiTotal = Object.values(pendingLvl.asi).reduce((a,b)=>a+b,0);
  const gain = lvlHpGain();
  const ref = refLink;

  document.getElementById("lvlModal").innerHTML = `
    <h3>Level ${pendingLvl.newLevel}!</h3>
    <div style="color:var(--muted);font-style:italic">${state.name || "Your hero"} the ${ref(state.species)} ${ref(state.cls)} grows stronger. Nothing is applied until you confirm.</div>

    ${feats.length?`<div class="lvl-step"><div class="k">New Features</div>${feats.map(f=>`<div>· ${ref(f.split(" (")[0].replace(/^Subclass: /,""))}${f.includes(" (")?" ("+f.split(" (").slice(1).join(" ("):""}</div>`).join("")}</div>`:""}

    ${pendingLvl.needSub?`<div class="lvl-step">
      <div class="k">Subclass · required</div>
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:.35rem">At level ${SUBCLASS_LEVEL} you commit to a specialty that keeps giving you features as you climb. SRD 5.2 publishes one subclass per class; pick <b>Other</b> for anything else your table plays.</div>
      ${subclassChoices().map(n=>{
        const sc = SUBCLASSES[state.cls][n];
        const lvls = Object.keys(sc.f).map(Number).sort((a,b)=>a-b);
        return `<div class="chooser-row${pendingLvl.sub===n?" current":""}" onclick="lvlSub('${escQ(n)}')">
          <div><b>${n}</b> <small style="color:var(--muted)">· SRD</small>${pendingLvl.sub===n?' <small style="color:var(--accent)">· chosen</small>':""}</div>
          <div style="font-size:.85rem;color:var(--muted)">${sc.d}</div>
          <div style="font-size:.8rem;margin-top:.2rem">${lvls.map(lv=>`<b>L${lv}</b> ${allDice(sc.f[lv].map(x=>x.split(" (")[0]).join(", "))}`).join(" · ")}</div>
        </div>`;
      }).join("")}
      <div class="chooser-row${pendingLvl.sub===OTHER_SUB?" current":""}" onclick="lvlSub('${OTHER_SUB}')">
        <div><b>Other</b> <small style="color:var(--muted)">· your own</small>${pendingLvl.sub===OTHER_SUB?' <small style="color:var(--accent)">· chosen</small>':""}</div>
        <div style="font-size:.85rem;color:var(--muted)">A subclass from another book, or one your DM made up. Name it here and add its features from your sheet afterwards.</div>
      </div>
      ${pendingLvl.sub===OTHER_SUB?`<div class="row" style="margin-top:.5rem">
        <input type="text" id="lvlSubName" placeholder="Name your subclass" value="${escAttr(pendingLvl.subName||"")}">
      </div>`:""}
    </div>`:""}
    ${(!pendingLvl.needSub && mySubclassFeatures(pendingLvl.newLevel)
        .filter(x=>x.lv===pendingLvl.newLevel).length)?`<div class="lvl-step">
      <div class="k">${escHtml(state.subclass)} Features</div>
      ${mySubclassFeatures(pendingLvl.newLevel).filter(x=>x.lv===pendingLvl.newLevel)
        .map(x=>`<div>· ${isCustomSub()?allDice(escHtml(x.f)):ref(x.f.split(" (")[0])+(x.f.includes(" (")?" ("+x.f.split(" (").slice(1).join(" ("):"")}</div>`).join("")}
    </div>`:""}

    <div class="lvl-step">
      <div class="k">${ref("Hit Points")} · ${dieIcon(c.hitDie)} + CON</div>
      <span class="asi-chip ${pendingLvl.hpMode==="roll"?"picked":""}" onclick="lvlHp('roll')">${pendingLvl.rolledValue!=null?`${dieIcon(c.hitDie)} Rolled: ${pendingLvl.rolledValue}`:`Roll the ${dieIcon(c.hitDie)}`}</span>
      <span class="asi-chip ${pendingLvl.hpMode==="avg"?"picked":""}" onclick="lvlHp('avg')">Take average (${avg})</span>
      ${gain!=null?`<div style="margin-top:.4rem">Will gain <b>+${gain}</b> on the die, + CON modifier, when you confirm.</div>`:""}
    </div>

    ${pendingLvl.spellMode?(()=>{
      const now = spellCounts(state.level), nxt = spellCounts(pendingLvl.newLevel);
      const gains = [];
      if (nxt.cant > now.cant) gains.push(`${nxt.cant-now.cant} new cantrip${nxt.cant-now.cant>1?"s":""}`);
      if (nxt.prep > now.prep) gains.push(`${nxt.prep-now.prep} more prepared spell${nxt.prep-now.prep>1?"s":""}`);
      if (nxt.maxCast > now.maxCast) gains.push(`<b>level ${nxt.maxCast} spells unlocked!</b>`);
      return `<div class="lvl-step">
      <div class="k">${ref("Spell Slots","Spells")} · ${nxt.cant?nxt.cant+" cantrips, ":""}${nxt.prep} prepared at level ${pendingLvl.newLevel}</div>
      ${gains.length?`<div style="margin-bottom:.35rem">You gain ${gains.join(", ")}.</div>`:`<div style="margin-bottom:.35rem;color:var(--muted)">No new spell picks at this level.</div>`}
      <span class="asi-chip ${pendingLvl.spellMode==="random"?"picked":""}" onclick="lvlSpellMode('random')">🎲 Choose new spells for me</span>
      <span class="asi-chip ${pendingLvl.spellMode==="manual"?"picked":""}" onclick="lvlSpellMode('manual')">✍️ I'll pick them myself</span>
      ${pendingLvl.spellMode==="manual" ? spellPickerHtml("lvl", nxt) : ""}
      </div>`;
    })():""}

    ${pendingLvl.hasAsi?`<div class="lvl-step">
      <div class="k">${ref("Ability Score Improvement")} or a ${ref("Feat","Feat")}</div>
      <span class="asi-chip ${pendingLvl.asiMode==="asi"?"picked":""}" onclick="lvlAsiMode('asi')">💪 Raise ability scores</span>
      <span class="asi-chip ${pendingLvl.asiMode==="feat"?"picked":""}" onclick="lvlAsiMode('feat')">🏅 Take a feat instead</span>
      ${pendingLvl.asiMode==="asi" ? `
        <div style="font-size:.85rem;color:var(--muted);margin:.35rem 0 .3rem">${2-asiTotal} point${2-asiTotal===1?"":"s"} left. Tap an ability to add +1 (twice for +2). Tap again to remove.</div>
        ${ABILITIES.map(a=>{
          const n = pendingLvl.asi[a]||0;
          const capped = (state.scores[a]||10) + n >= 20;
          return `<span class="asi-chip ${n?"picked":""}" onclick="lvlAsi('${a}')" title="${capped?"At the 20 cap":""}">${a} ${state.scores[a]||"--"}${n?` → ${state.scores[a]+n}`:""}</span>`;
        }).join("")}`
      : featPickerHtml()}
    </div>`:""}

    <div class="lvl-actions">
      <button onclick="lvlCancel()">Cancel</button>
      <button class="lvl-confirm" onclick="lvlConfirm()" ${lvlBlocker()?`disabled title="${lvlBlocker()}"`:""}>Confirm Level ${pendingLvl.newLevel}</button>
    </div>
    <div id="lvlBlockNote" style="text-align:right;color:var(--muted);font-size:.85rem;margin-top:.2rem">${lvlBlocker()}</div>`;
  bindLvlInputs();
}

// Keep the feat filter usable across the modal's redraws
function bindLvlInputs() {
  // Typing a custom subclass name enables Confirm without redrawing the modal,
  // which would take the caret with it
  const sn = document.getElementById("lvlSubName");
  if (sn) sn.addEventListener("input", e=>{
    pendingLvl.subName = e.target.value;
    const btn = document.querySelector("#lvlModal .lvl-confirm");
    const why = lvlBlocker();
    if (btn) { btn.disabled = !!why; btn.title = why || ""; }
    const note = document.getElementById("lvlBlockNote");
    if (note) note.textContent = why;
  });
  const f = document.getElementById("featFilter");
  if (!f) return;
  f.addEventListener("input", e=>{
    pendingLvl.featFilter = e.target.value;
    renderLvlModal();
    const again = document.getElementById("featFilter");
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });
}

// The custom subclass name, taken from the live input when it exists so the
// Confirm button reacts as it is typed
function lvlSubName() {
  const el = document.getElementById("lvlSubName");
  return ((el ? el.value : pendingLvl && pendingLvl.subName) || "").trim();
}

// What still has to be decided before the level can be confirmed
function lvlBlocker() {
  if (!pendingLvl) return "";
  if (lvlHpGain() == null) return "Choose how to gain hit points first.";
  if (pendingLvl.needSub && !pendingLvl.sub) return "Choose a subclass first.";
  if (pendingLvl.sub === OTHER_SUB && !lvlSubName()) return "Name your subclass first.";
  if (pendingLvl.hasAsi && pendingLvl.asiMode === "feat" && !pendingLvl.feat) return "Pick a feat, or switch back to ability scores.";
  return "";
}

function featPickerHtml() {
  const q = (pendingLvl.featFilter||"").toLowerCase();
  // "Ability Score Improvement" is the other chip, and a feat can only be taken once
  const taken = new Set((state.feats||[]).map(f=>f.n));
  const pool = featsAvailableAt(pendingLvl.newLevel)
    .filter(n=>n!=="Ability Score Improvement" && !taken.has(n));
  const groups = [["general","General Feats"],["style","Fighting Style Feats"],["boon","Epic Boons"]];
  const shown = pool.filter(n=>!q || n.toLowerCase().includes(q) || FEATS[n].d.toLowerCase().includes(q));
  return `
    <div style="font-size:.85rem;color:var(--muted);margin:.35rem 0 .3rem">A feat replaces the two ability points. Feats with a prerequisite are marked; the app doesn't enforce them, so check with your DM.</div>
    <input type="text" id="featFilter" placeholder="Filter feats..." value="${(pendingLvl.featFilter||"").replace(/"/g,'&quot;')}" style="margin-bottom:.4rem">
    <div class="picker-box">
      ${groups.map(([kind,label])=>{
        const g = shown.filter(n=>FEATS[n].kind===kind);
        if (!g.length) return "";
        return `<div class="spell-lvl-h">${label}</div>` + g.map(n=>`
          <div class="chooser-row${pendingLvl.feat===n?" current":""}" onclick="lvlFeat('${escQ(n)}')">
            <div><b>${n}</b>${pendingLvl.feat===n?' <small style="color:var(--accent)">· chosen</small>':""}</div>
            <div style="font-size:.85rem;color:var(--muted)">${FEATS[n].d}${FEATS[n].pre?` <b>Prerequisite: ${FEATS[n].pre}</b>`:""}</div>
          </div>`).join("");
      }).join("")}
      ${!shown.length?`<div style="color:var(--muted)">${pool.length?"No feat matches that.":"You've already taken every feat available at this level."}</div>`:""}
    </div>`;
}

function lvlHp(mode) {
  const c = CLASSES[state.cls];
  if (mode==="roll" && pendingLvl.rolledValue==null) {
    pendingLvl.rolledValue = 1 + Math.floor(Math.random()*c.hitDie);
    logRoll(`Level ${pendingLvl.newLevel} HP`, `d${c.hitDie} (${pendingLvl.rolledValue})`, pendingLvl.rolledValue);
  }
  pendingLvl.hpMode = mode;
  renderLvlModal();
}

function lvlSpellMode(m) { pendingLvl.spellMode = m; renderLvlModal(); }
function lvlSub(name) {
  // Keep whatever was typed before a re-render swaps the input out
  const typed = document.getElementById("lvlSubName");
  if (typed) pendingLvl.subName = typed.value;
  pendingLvl.sub = pendingLvl.sub === name ? null : name;
  renderLvlModal();
  const box = document.getElementById("lvlSubName");
  if (box) box.focus();
}
function lvlAsiMode(m) {
  pendingLvl.asiMode = m;
  if (m === "asi") pendingLvl.feat = null; else pendingLvl.asi = {};
  renderLvlModal();
}
function lvlFeat(name) { pendingLvl.feat = pendingLvl.feat === name ? null : name; renderLvlModal(); }

function lvlAsi(ab) {
  const cur = pendingLvl.asi[ab]||0;
  const total = Object.values(pendingLvl.asi).reduce((a,b)=>a+b,0);
  // Each tap adds +1 while points and the 20 cap allow; one more tap clears it
  if (total < 2 && (state.scores[ab]||10) + cur < 20) pendingLvl.asi[ab] = cur + 1;
  else delete pendingLvl.asi[ab];
  renderLvlModal();
}

function lvlCancel() {
  pendingLvl = null;
  document.getElementById("lvlOverlay").classList.remove("open");
}

function lvlConfirm() {
  const gain = lvlHpGain();
  if (!pendingLvl || lvlBlocker()) return;
  pushUndo(`the level up to ${pendingLvl.newLevel}`);
  state.level = pendingLvl.newLevel;
  state.dieRolls.push(gain);
  const asiText = Object.entries(pendingLvl.asi).map(([ab,n])=>`${ab} +${n}`).join(", ");
  Object.entries(pendingLvl.asi).forEach(([ab,n])=>{
    state.scores[ab] = Math.min(20, (state.scores[ab]||10) + n);
    document.getElementById("ab_"+ab).value = state.scores[ab];
  });
  // Subclass chosen at this level, and its features from here on
  let subText = "";
  if (pendingLvl.needSub && pendingLvl.sub) {
    if (pendingLvl.sub === OTHER_SUB) {
      state.subclass = lvlSubName();
      state.customSub = { d:"", feats:[] };
      subText = `${state.subclass} (custom)`;
    } else {
      state.subclass = pendingLvl.sub;
      state.customSub = null;
      subText = pendingLvl.sub;
    }
  }
  const subFeats = mySubclassFeatures(state.level)
    .filter(x=>x.lv===state.level).map(x=>x.f).join(", ");
  // A feat taken in place of the ability points
  let featText = "";
  if (pendingLvl.hasAsi && pendingLvl.asiMode === "feat" && pendingLvl.feat) {
    state.feats = [...(state.feats||[]), { n: pendingLvl.feat, at: state.level }];
    featText = pendingLvl.feat;
  }
  const mode = pendingLvl.hpMode;
  const newFeats = (CLASS_LEVELS[state.cls][state.level]||[]).join(", ");
  // New spells at the new level: auto-pick or leave to the player
  let learned = [], manualSpells = false;
  if (pendingLvl.spellMode === "random") {
    const { cant, prep, maxCast } = spellCounts(state.level);
    learned = fillSpellsRandomly(cant, prep, maxCast);
    if (learned.length) renderSpellChoices();
  } else if (pendingLvl.spellMode === "manual") {
    learned = pendingLvl.spells.filter(n=>!state.spells.includes(n));
    const dropped = state.spells.filter(n=>!pendingLvl.spells.includes(n));
    state.spells = [...pendingLvl.spells];
    manualSpells = !learned.length && !dropped.length;
    if (dropped.length) learned.push(...dropped.map(n=>`(swapped out ${n})`));
    renderSpellChoices();
  }
  STATS.lvl.ups++;
  tally(STATS.lvl.by, state.cls);
  logEvent("level", `<b>Level ${state.level}</b> ${state.cls}: +${gain} HP die (${mode==="roll"?"rolled":"average"})${subText?` · subclass: ${subText}`:""}${asiText?` · ASI: ${asiText}`:""}${featText?` · feat: ${featText}`:""}${newFeats?` · gained: ${newFeats}`:""}${subFeats?` · ${state.subclass}: ${subFeats}`:""}${learned.length?` · learned: ${learned.join(", ")}`:""}`);
  lvlCancel();
  renderSheet();
  persistLoaded();
  const toast = document.getElementById("rollToast");
  toast.querySelector(".what").textContent = `${state.name || "Hero"} reached...`;
  const totalEl = toast.querySelector(".total");
  totalEl.textContent = "Level " + state.level;
  totalEl.className = "total crit";
  toast.querySelector(".detail").textContent = `+${gain} HP${mode==="roll"?" (rolled)":""}${subText?` · ${subText}`:""}${featText?` · ${featText}`:""}${learned.length?` · learned ${learned.join(", ")}`:""}${manualSpells?" · pick your new spells in the Spells list":""}${newFeats?" · "+newFeats:""}`;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 6000);
}

// Close the modal from the backdrop or Escape (same as Cancel: nothing applied)
document.getElementById("lvlOverlay").addEventListener("click", e=>{ if (e.target.id==="lvlOverlay") lvlCancel(); });
document.addEventListener("keydown", e=>{ if (e.key==="Escape" && pendingLvl) lvlCancel(); });

// ---------- EQUIPMENT ----------
// What the character is actually carrying: starting gear minus anything dropped,
// plus anything picked up. Attacks and spellcasting both read from this.
function currentEquipment() { return equipmentOf(state); }
// The pack as it stands for any character record, saved or in play: what the
// class and background started them with, less anything dropped, plus anything
// picked up since.
function equipmentOf(who) {
  const c = who.cls ? CLASSES[who.cls] : null;
  const bg = who.background ? BACKGROUNDS[who.background] : null;
  // Starting coins are counted in the purse instead of sitting in the pack
  const base = [...(c?c.equipment:[]), ...(bg?bg.equipment:[])].filter(e=>!COIN_RE.test(e.trim()));
  const pending = [...(who.dropped||[])];
  const kept = [];
  base.forEach(item=>{
    const i = pending.indexOf(item);
    if (i >= 0) pending.splice(i,1);   // one entry dropped removes one copy
    else kept.push(item);
  });
  return [...kept, ...(who.gear||[])];
}
// Identical entries collapse into one row with a count, so twenty arrows are
// one line rather than twenty
function equipmentStacks() {
  const out = [], idx = {};
  currentEquipment().forEach(name=>{
    if (idx[name] != null) out[idx[name]].qty++;
    else { idx[name] = out.length; out.push({name, qty:1}); }
  });
  return out;
}

// ---------- ATTUNEMENT ----------
function needsAttunement(name) { return !!(MAGIC_ITEMS[name] && MAGIC_ITEMS[name].att); }
function isAttuned(name) { return (state.attuned||[]).includes(name); }
function toggleAttune(name) {
  const list = state.attuned || (state.attuned = []);
  const i = list.indexOf(name);
  if (i >= 0) {
    pushUndo(`unattuning ${name}`);
    list.splice(i,1);
    logEvent("gear", `Ended attunement to <b>${name}</b>`);
  } else {
    if (list.length >= ATTUNEMENT_MAX) {
      alert(`You can be attuned to at most ${ATTUNEMENT_MAX} items. End one attunement first.`);
      return;
    }
    pushUndo(`attuning to ${name}`);
    list.push(name);
    STATS.gear.attuned++;
    logEvent("gear", `Attuned to <b>${name}</b> (${list.length} of ${ATTUNEMENT_MAX})`);
  }
  renderSheet(); persistLoaded();
}
// A caster needs a focus (or spellbook) in hand to cast
const FOCUS_RE = /holy symbol|druidic focus|arcane focus|spellbook|component pouch/i;
function hasSpellFocus() { return currentEquipment().some(e=>FOCUS_RE.test(e)); }
function isCaster() { return !!(state.cls && CLASSES[state.cls].spellcaster); }

// Drop an item: added gear leaves state.gear, starting gear is recorded as dropped
function dropItem(name) {
  pushUndo(`dropping ${name}`);
  const i = (state.gear||[]).indexOf(name);
  if (i >= 0) state.gear.splice(i,1);
  else state.dropped = [...(state.dropped||[]), name];
  // Attunement ends with the last copy of the item
  let unattuned = false;
  if (isAttuned(name) && !currentEquipment().includes(name)) {
    state.attuned = state.attuned.filter(n=>n!==name);
    unattuned = true;
  }
  STATS.gear.dropped++;
  saveStats();
  logEvent("gear", `Dropped <b>${name}</b>${FOCUS_RE.test(name)?" · spellcasting focus lost":""}${unattuned?" · attunement ended":""}`);
  renderSheet(); persistLoaded();
}

// ---------- EQUIPMENT THE PLAYER PICKS UP ----------
function openGear() {
  document.getElementById("gearSearch") && (gearFilter = "");
  renderGearModal();
  document.getElementById("gearOverlay").classList.add("open");
}
let gearFilter = "";
function renderGearModal() {
  const q = gearFilter.toLowerCase();
  const weapons = Object.keys(WEAPONS);
  const others = Object.keys(EQUIPMENT_DEFS).filter(n=>!weapons.includes(n));
  const magic = Object.keys(MAGIC_ITEMS);
  const match = n => !q || n.toLowerCase().includes(q);
  const row = n => `<div class="chooser-row" onclick="addGear('${escQ(n)}')" title="Add ${n}">
      <div><b>${n}</b>${WEAPONS[n]?` <small style="color:var(--accent)">weapon</small>`:""}${needsAttunement(n)?` <small style="color:var(--accent2)">attunement</small>`:""}</div>
      <div style="font-size:.85rem;color:var(--muted)">${allDice(WEAPONS[n] ? `${WEAPONS[n].dmg} damage${WEAPONS[n].fin?", Finesse":""}${WEAPONS[n].rng?", Ranged":""}` : (MAGIC_ITEMS[n] ? MAGIC_ITEMS[n].d : EQUIPMENT_DEFS[n]||""))}</div>
    </div>`;
  const w = weapons.filter(match), o = others.filter(match), mi = magic.filter(match);
  document.getElementById("gearModal").innerHTML = `
    <h3>Add Equipment</h3>
    <div style="color:var(--muted);font-style:italic">Anything you add shows up in Equipment. Weapons also appear under Attacks with their bonus worked out.</div>
    <div class="lvl-step">
      <div class="k">Write it in</div>
      <div class="row">
        <input type="text" id="gearCustom" placeholder="e.g. Potion of Healing, +1 Longsword, map to the vault">
        <button onclick="addCustomGear()">Add</button>
      </div>
    </div>
    <div class="lvl-step">
      <div class="k">Or pick from the SRD</div>
      <input type="text" id="gearSearch" placeholder="Filter equipment..." value="${gearFilter.replace(/"/g,'&quot;')}" style="margin-bottom:.4rem">
      <div class="picker-box">
        ${w.length?`<div class="spell-lvl-h">Weapons</div>${w.map(row).join("")}`:""}
        ${o.length?`<div class="spell-lvl-h">Gear</div>${o.map(row).join("")}`:""}
        ${mi.length?`<div class="spell-lvl-h">Magic Items</div>${mi.map(row).join("")}`:""}
        ${!w.length && !o.length && !mi.length?`<div style="color:var(--muted)">Nothing matches. Use "Write it in" above.</div>`:""}
      </div>
    </div>
    <div class="lvl-actions"><button onclick="gearClose()">Close</button></div>`;
  // Re-rendering the modal rebuilds the input, which drops the caret back to the
  // start and makes typing come out reversed; put it back at the end.
  const s = document.getElementById("gearSearch");
  if (s) s.addEventListener("input", e=>{
    gearFilter = e.target.value;
    renderGearModal();
    const again = document.getElementById("gearSearch");
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });
  const cu = document.getElementById("gearCustom");
  if (cu) cu.addEventListener("keydown", e=>{ if (e.key==="Enter") addCustomGear(); });
}
function addGear(name, quiet) {
  pushUndo(`picking up ${name}`);
  state.gear = [...(state.gear||[]), name];
  STATS.gear.picked++;
  tally(STATS.gear.by, name);
  logEvent("gear", `Picked up <b>${name}</b>${WEAPONS[name]?" (added to Attacks)":""}${needsAttunement(name)?" · requires Attunement":""}`);
  renderSheet(); persistLoaded();
  if (!quiet) gearClose();
}
// The "+" beside an equipment row: one more of the same thing
function addOneMore(name) { addGear(name, true); }
function addCustomGear() {
  const el = document.getElementById("gearCustom");
  const v = (el.value||"").trim();
  if (!v) return;
  addGear(v);
}
function gearClose() { document.getElementById("gearOverlay").classList.remove("open"); }
document.addEventListener("click", e=>{ if (e.target.id==="gearOverlay") gearClose(); });

// ---------- CLASS RESOURCES ----------
// Resources this character has at their current level, with computed maximums
function resourcesFor() {
  if (!state.cls) return [];
  return (CLASS_RESOURCES[state.cls]||[])
    .filter(r => state.level >= r.from)
    .map(r => ({
      name: r.n,
      max: r.max(state.level, state.scores),
      rest: typeof r.rest === "function" ? r.rest(state.level) : r.rest,
      pool: !!r.pool
    }));
}
function spendRes(name, n) {
  const r = resourcesFor().find(x=>x.name===name);
  if (!r) return;
  if ((state.resUsed[name]||0) + n > r.max) return;   // nothing left to spend
  pushUndo(`spending ${name}`);
  state.resUsed[name] = Math.min(r.max, (state.resUsed[name]||0) + n);
  logEvent("resource", `Spent ${n>1?n+" ":""}<b>${name}</b> (${r.max - state.resUsed[name]} of ${r.max} left)`);
  renderSheet(); persistLoaded();
}
function restoreRes(name, n) {
  if (!(state.resUsed[name]||0)) return;
  pushUndo(`restoring ${name}`);
  state.resUsed[name] = Math.max(0, (state.resUsed[name]||0) - (n||9999));
  renderSheet(); persistLoaded();
}
// Refill resources that come back on the given rest ("short" also happens on a long rest)
function refillResources(kind) {
  const restored = [];
  resourcesFor().forEach(r=>{
    if ((kind === "long" || r.rest === "short") && (state.resUsed[r.name]||0) > 0) {
      restored.push(r.name);
      state.resUsed[r.name] = 0;
    }
  });
  return restored;
}

// ---------- CONCENTRATION ----------
let pendingConc = null;

function startConcentration(spellName) {
  if (state.conc && state.conc !== spellName) {
    logEvent("cast", `Concentration on <b>${state.conc}</b> ends (started ${spellName})`);
  }
  state.conc = spellName;
}
function dropConc(reason) {
  if (!state.conc) return;
  logEvent("cast", `Concentration on <b>${state.conc}</b> ends${reason?` (${reason})`:""}`);
  state.conc = null;
  renderSheet(); persistLoaded();
}
// Damage while concentrating forces a CON save: DC 10 or half the damage, whichever is higher
function concCheck(damage) {
  const dc = Math.max(10, Math.floor(damage/2));
  pendingConc = { dc, damage, result: null };
  renderConcModal();
  document.getElementById("concOverlay").classList.add("open");
}
function concSaveMod() {
  const c = state.cls ? CLASSES[state.cls] : null;
  const prof = 2 + Math.floor((state.level-1)/4);
  return (state.scores.CON!=null ? mod(state.scores.CON) : 0) + (c && c.saves.includes("CON") ? prof : 0);
}
function renderConcModal() {
  if (!pendingConc) return;
  const p = pendingConc, m = concSaveMod();
  document.getElementById("concModal").innerHTML = `
    <h3>🌀 ${refLink("Concentration")} Check</h3>
    <div style="color:var(--muted);font-style:italic">${state.name||"Your hero"} took ${p.damage} damage while concentrating on <b>${state.conc||"a spell"}</b>.</div>
    <div class="lvl-step">
      <div class="k">Constitution save · DC ${p.dc}</div>
      ${p.result==null
        ? `<div style="margin-bottom:.4rem">DC is 10 or half the damage taken, whichever is higher.</div>
           <button onclick="concRoll()">🎲 Roll CON save (${fmtMod(m)})</button>`
        : `<div style="font-size:1.4rem"><b style="color:${p.result.ok?"var(--good)":"var(--accent2)"}">${p.result.total}</b>
             <small style="color:var(--muted)">${p.result.detail}</small></div>
           <div style="margin-top:.3rem"><b style="color:${p.result.ok?"var(--good)":"var(--accent2)"}">
             ${p.result.ok ? `Held! You keep concentrating on ${state.conc}.` : `Broken. ${p.result.spell} ends.`}</b></div>`}
    </div>
    <div class="lvl-actions">
      ${p.result==null?`<button onclick="concGiveUp()">Drop it</button>`:""}
      <button class="lvl-confirm" onclick="concClose()">${p.result==null?"Skip":"Done"}</button>
    </div>`;
}
function concRoll() {
  const m = concSaveMod();
  const r = d20Roll("sav", "CON");
  const total = r.v + m;
  const ok = total >= pendingConc.dc;
  const spell = state.conc;
  logRoll(`Concentration save${r.mode?` (${r.mode})`:""}`, d20Detail(r, m), total);
  pendingConc.result = { total, ok, detail: d20Detail(r, m), spell };
  if (!ok) { state.conc = null; logEvent("cast", `Concentration on <b>${spell}</b> broken (DC ${pendingConc.dc})`); }
  renderConcModal(); renderSheet(); persistLoaded();
}
function concGiveUp() { dropConc("voluntarily"); concClose(); }
function concClose() {
  pendingConc = null;
  document.getElementById("concOverlay").classList.remove("open");
  renderSheet();
}
document.addEventListener("click", e=>{ if (e.target.id==="concOverlay") concClose(); });

// ---------- SPELL SLOTS ----------
function spendSlot(lv) {
  const row = getSlotRows().find(r=>r.lv===lv);
  if (!row) return;
  pushUndo(`the level ${lv} slot`);
  state.slotsUsed[lv] = Math.min(row.total, (state.slotsUsed[lv]||0) + 1);
  renderSheet(); persistLoaded();
}
function restoreSlot(lv) {
  pushUndo(`the level ${lv} slot restore`);
  state.slotsUsed[lv] = Math.max(0, (state.slotsUsed[lv]||0) - 1);
  renderSheet(); persistLoaded();
}

// ---------- RESTS ----------
let pendingRest = null;

function shortRest() {
  if (!state.cls || state.maxHp==null) return;
  pendingRest = { rolls: [] };
  renderRestModal();
  document.getElementById("restOverlay").classList.add("open");
}

function renderRestModal() {
  if (!pendingRest) return;
  const c = CLASSES[state.cls];
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  const hdLeft = state.level - state.hdUsed - pendingRest.rolls.length;
  const healed = pendingRest.rolls.reduce((a,r)=>a+r.gain,0);
  const cap = state.maxHp - state.curHp;
  document.getElementById("restModal").innerHTML = `
    <h3>⛺ ${refLink("Short Rest")}</h3>
    <div style="color:var(--muted);font-style:italic">At least 1 hour of light activity. Spend ${refLink("Hit Point Dice")} to recover HP.</div>
    <div class="lvl-step">
      <div class="k">${refLink("Hit Point Dice")} · ${hdLeft} of ${state.level} d${c.hitDie} remaining</div>
      ${pendingRest.rolls.length ? pendingRest.rolls.map(r=>`<div>· ${dieIcon(c.hitDie)} (${r.roll}) ${conMod>=0?"+":"-"} ${Math.abs(conMod)} = <b>${r.gain}</b> HP</div>`).join("") : `<div style="color:var(--muted)">No dice spent yet.</div>`}
      ${hdLeft<=0
        ? `<div style="color:var(--muted);margin-top:.3rem">No Hit Dice left. They come back on a ${refLink("Long Rest")}.</div>`
        : cap - healed <= 0
          ? `<button disabled title="You're already at full hit points" style="margin-top:.4rem">🎲 Spend a Hit Die</button>
             <div style="color:var(--good);margin-top:.3rem">${healed?"That takes you to full HP":`Already at full HP (${state.maxHp}/${state.maxHp})`}, so there's nothing left to heal. Save your dice.</div>`
          : `<button onclick="restRollHd()" style="margin-top:.4rem">🎲 Spend a Hit Die (${dieIcon(c.hitDie)} ${conMod>=0?"+":"-"} ${Math.abs(conMod)})</button>`}
    </div>
    <div class="lvl-step"><div class="k">${refLink("Healing")}</div>
      Recover <b>${Math.min(healed,cap)}</b> HP (${state.curHp} → ${Math.min(state.maxHp, state.curHp+healed)} of ${state.maxHp})${state.cls==="Warlock"?` · ${refLink("Pact Magic","Pact spell slots")} refresh on a Short Rest.`:""}
    </div>
    <div style="font-size:.8rem;color:var(--muted);margin-top:.4rem">Combat or strenuous activity causes a ${refLink("Rest Interruption")}: no benefits.</div>
    <div class="lvl-actions">
      <button onclick="restInterrupted('Short Rest')" title="The rest was broken: no benefits">✋ Interrupted</button>
      <button onclick="restCancel()">Cancel</button>
      <button class="lvl-confirm" onclick="restFinish()">Finish Rest</button>
    </div>`;
}

function restRollHd() {
  const c = CLASSES[state.cls];
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  const roll = 1 + Math.floor(Math.random()*c.hitDie);
  const gain = Math.max(0, roll + conMod);
  logRoll("Hit Die", `d${c.hitDie} (${roll}) ${conMod>=0?"+":"-"} ${Math.abs(conMod)}`, gain);
  pendingRest.rolls.push({roll, gain});
  renderRestModal();
}

function restCancel() {
  pendingRest = null;
  pendingLR = null;
  document.getElementById("restOverlay").classList.remove("open");
}

function restInterrupted(kind) {
  STATS.rest.interrupted++;
  logEvent("rest", `<b>${kind} interrupted</b>: no benefits gained`);
  restCancel();
}

function restFinish() {
  pushUndo("the Short Rest");
  const spent = pendingRest.rolls.length;
  const healed = Math.min(pendingRest.rolls.reduce((a,r)=>a+r.gain,0), state.maxHp - state.curHp);
  state.curHp += healed;
  state.hdUsed += spent;
  let extra = "";
  if (state.cls==="Warlock") { state.slotsUsed = {}; extra = ", Pact slots restored"; }
  const back = refillResources("short");
  if (back.length) extra += `, restored ${back.join(", ")}`;
  STATS.rest.short++; STATS.rest.hitDice += spent;
  logEvent("rest", `<b>Short Rest</b>: spent ${spent} Hit ${spent===1?"Die":"Dice"}, healed ${healed} HP${extra}`);
  restCancel();
  renderSheet(); persistLoaded();
}

let pendingLR = null;

function longRest() {
  if (!state.cls || state.maxHp==null) return;
  if (!pendingLR) pendingLR = { spellMode: "keep", spells: [...state.spells] };
  const healed = state.maxHp - state.curHp;
  const regain = Math.max(1, Math.floor(state.level/2));
  const hdBack = Math.min(state.hdUsed, regain);
  const isCaster = getSlotRows().length > 0;
  document.getElementById("restModal").innerHTML = `
    <h3>🌙 ${refLink("Long Rest")}</h3>
    <div style="color:var(--muted);font-style:italic">At least 8 hours: sleep for at least 6 and only light activity for the rest. A night of true rest mends body and magic alike. Nothing is applied until the rest completes.</div>
    <div class="lvl-step">
      <div class="k">On completion</div>
      <div>· ${refLink("Hit Points")} restored to maximum${healed?` (<b>+${healed}</b>, back to ${state.maxHp})`:" (already full)"}${state.tempHp?`, Temporary HP fades`:""}</div>
      ${isCaster?`<div>· All ${refLink("Spell Slots")} refreshed</div>`:""}
      <div>· ${refLink("Hit Point Dice")}: regain half your total (min 1)${state.hdUsed?` · recovers <b>${hdBack}</b> of your ${state.hdUsed} spent`:" · none spent"}</div>
      ${(state.deathS||state.deathF)?`<div>· ${refLink("Death Saving Throws")} reset</div>`:""}
      <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">Only one Long Rest per 24 hours. An hour of combat or strenuous activity causes a ${refLink("Rest Interruption")}.</div>
    </div>
    ${PREPARED_CASTERS.includes(state.cls)?`<div class="lvl-step">
      <div class="k">Change Prepared ${refLink("Spell Slots","Spells")}</div>
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:.35rem">A ${state.cls} rebuilds their prepared list after a Long Rest.</div>
      <span class="asi-chip ${pendingLR.spellMode==="keep"?"picked":""}" onclick="lrSpellMode('keep')">Keep current spells</span>
      <span class="asi-chip ${pendingLR.spellMode==="random"?"picked":""}" onclick="lrSpellMode('random')">🎲 Prepare a random new set</span>
      <span class="asi-chip ${pendingLR.spellMode==="manual"?"picked":""}" onclick="lrSpellMode('manual')">✍️ Let me choose</span>
      ${pendingLR.spellMode==="manual" ? spellPickerHtml("lr", spellCounts()) : ""}
    </div>`:(CLASSES[state.cls].spellcaster?`<div class="lvl-step">
      <div class="k">Spells</div>
      <div style="font-size:.85rem;color:var(--muted)">A ${state.cls} knows their spells rather than preparing them: you can swap one only when you gain a level.</div>
    </div>`:"")}
    <div class="lvl-actions">
      <button onclick="restInterrupted('Long Rest')" title="The rest was broken: no benefits">✋ Interrupted</button>
      <button onclick="restCancel()">Cancel</button>
      <button class="lvl-confirm" onclick="longRestConfirm()">Long Rest Completed</button>
    </div>`;
  document.getElementById("restOverlay").classList.add("open");
}

function lrSpellMode(m) { pendingLR.spellMode = m; longRest(); }

function longRestConfirm() {
  pushUndo("the Long Rest");
  const healed = state.maxHp - state.curHp;
  const regain = Math.max(1, Math.floor(state.level/2));
  const hdBack = Math.min(state.hdUsed, regain);
  state.curHp = state.maxHp; state.tempHp = 0;
  state.slotsUsed = {}; state.hdUsed = Math.max(0, state.hdUsed - regain);
  state.deathS = 0; state.deathF = 0; state.stable = false;
  const resBack = refillResources("long");
  if (state.conc) { state.conc = null; }
  let spellNote = resBack.length ? `, restored ${resBack.join(", ")}` : "";
  if (pendingLR && pendingLR.spellMode === "random") {
    randomizeSpells();
    spellNote += `, prepared a new set of spells (${state.spells.join(", ")})`;
  } else if (pendingLR && pendingLR.spellMode === "manual") {
    const added = pendingLR.spells.filter(n=>!state.spells.includes(n));
    const removed = state.spells.filter(n=>!pendingLR.spells.includes(n));
    state.spells = [...pendingLR.spells];
    renderSpellChoices();
    if (added.length||removed.length)
      spellNote += `, prepared ${added.join(", ")||"no new spells"}${removed.length?` (dropped ${removed.join(", ")})`:""}`;
  }
  STATS.rest.long++;
  logEvent("longrest", `<b>Long Rest</b>: HP fully restored${healed?` (+${healed})`:""}, spell slots refreshed${hdBack?`, recovered ${hdBack} Hit ${hdBack===1?"Die":"Dice"}`:""}${spellNote}`);
  pendingLR = null;
  restCancel();
  renderSheet(); persistLoaded();
}

// ---------- DYING / DEAD OVERLAY ----------
function retireCharacter() {
  state.retired = true;
  logEvent("status", `<b>Retired</b>: laid to rest at level ${state.level}. May their story be retold.`);
  if (state.loadedId) {
    persistLoaded();
  } else {
    // Never saved: save now so the fallen hero is kept
    const list = loadStore();
    const snapshot = JSON.parse(JSON.stringify(state));
    snapshot.id = Date.now();
    snapshot.savedAt = new Date().toLocaleString();
    state.loadedId = snapshot.id;
    list.push(snapshot);
    saveStore(list);
    updateSavedCount();
  }
  renderSheet();
}

function renderDownOverlay() {
  const el = document.getElementById("downOverlay");
  const show = state.cls && state.maxHp!=null && state.curHp===0 && !state.retired;
  el.classList.toggle("open", !!show);
  if (!show) return;
  const who = state.name || "Your hero";
  const dead = state.deathF >= 3;
  const stable = state.stable || state.deathS >= 3;
  const pips = k => [1,2,3].map(i=>state[k]>=i?"●":"○").join(" ");
  document.getElementById("downModal").innerHTML = dead ? `
    <div class="death-big">💀</div>
    <h3 style="text-align:center">${who} has died</h3>
    <p style="text-align:center;color:var(--muted)">Three ${refLink("Death Saving Throws")} failed. But in a world of magic, death is not always the end: spells like ${refLink("Revivify")} and ${refLink("Resurrection")} can call a soul back.</p>
    <div class="lvl-actions" style="flex-wrap:wrap">
      <button onclick="revive(1,'Revivify')">✨ Revivify (1 HP)</button>
      <button onclick="revive(state.maxHp,'Resurrection')">🌟 Resurrection (full HP)</button>
      <button onclick="retireCharacter()" title="Lay this hero to rest; the sheet is kept in a dead state">🪦 Retire Character</button>
    </div>`
  : stable ? `
    <div class="death-big">😮‍💨</div>
    <h3 style="text-align:center">${who} is ${refLink("Dying and Stabilization","Stable")}</h3>
    <p style="text-align:center;color:var(--muted)">Unconscious at 0 HP but no longer dying. They wake with 1 HP after 1d4 hours, or sooner with ${refLink("Healing")}.</p>
    <div class="lvl-actions" style="flex-wrap:wrap">
      <button onclick="revive(1,'Waking up')">⏰ Wake with 1 HP</button>
      <button onclick="changeHp(5)">❤️ Healed (+5 HP)</button>
    </div>`
  : `
    <div class="death-big">🩸</div>
    <h3 style="text-align:center">${who} is dying!</h3>
    <div class="down-pips">Successes ${pips("deathS")} · Failures ${pips("deathF")}</div>
    <p style="text-align:center;color:var(--muted);font-size:.9rem">At the start of each of your turns, make a ${refLink("Death Saving Throws","Death Saving Throw")}: 10+ succeeds. Three successes ${refLink("Dying and Stabilization","stabilize")} you; three failures and you die. A 20 brings you back with 1 HP; a 1 counts as two failures. ${refLink("Healing")} of any kind brings you back up.</p>
    <div class="lvl-actions">
      <button class="lvl-confirm" onclick="rollDeathSave()">🎲 Death Saving Throw</button>
    </div>
    <div class="lvl-actions" style="flex-wrap:wrap">
      <button onclick="changeHp(1)">❤️ Healed (+1)</button>
      <button onclick="changeHp(5)">❤️ (+5)</button>
      <button onclick="downStabilize()">🩹 Stabilized</button>
      <button onclick="downDamage(1)">💥 Hit (+1 ✘)</button>
      <button onclick="downDamage(2)">💥 Crit (+2 ✘)</button>
    </div>`;
}

function rollDeathSave() {
  pushUndo("the death saving throw");
  const r = d20Roll("sav");
  const d = r.v;
  logRoll(`Death Save${r.mode?` (${r.mode})`:""}`, d20Detail(r, 0), d);
  STATS.death.rolls++;
  if (d === 20) STATS.death.nat20++;
  else if (d === 1) STATS.death.nat1++;
  if (d >= 10) STATS.death.pass++; else STATS.death.fail++;
  saveStats();
  if (d === 20) { revive(1, "a natural 20 on the Death Save"); return; }
  if (d === 1) state.deathF = Math.min(3, state.deathF + 2);
  else if (d >= 10) state.deathS = Math.min(3, state.deathS + 1);
  else state.deathF = Math.min(3, state.deathF + 1);
  if (state.deathS >= 3) { state.stable = true; logEvent("status", `<b>Stabilized</b>: three Death Save successes`); }
  if (state.deathF >= 3) { STATS.death.died++; logEvent("status", `<b>Died</b>: three Death Save failures`); }
  renderSheet(); persistLoaded();
}

function downStabilize() {
  pushUndo("stabilizing");
  state.stable = true;
  logEvent("status", `<b>Stabilized</b> (Medicine check or Spare the Dying)`);
  renderSheet(); persistLoaded();
}

function downDamage(n) {
  pushUndo("the hit while down");
  const wasDying = state.deathF < 3;
  state.deathF = Math.min(3, state.deathF + n);
  state.stable = false;
  if (wasDying && state.deathF >= 3) { STATS.death.died++; logEvent("status", `<b>Died</b>: struck down while dying`); }
  renderSheet(); persistLoaded();
}

function revive(hp, how) {
  state.curHp = Math.min(state.maxHp, Math.max(1, hp));
  state.deathS = 0; state.deathF = 0; state.stable = false;
  logEvent("heal", `<b>Back from the brink</b>: ${how}, up with ${state.curHp} HP`);
  renderSheet(); persistLoaded();
}

// ---------- REFERENCE LOOKUP ----------
const escQ = s => s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
// Clickable term that opens the reference overlay; optional label shows different text
function refLink(term, label) {
  return `<span class="ref-link" onclick="refLookup('${escQ(term)}')" title="What is this?">${label||term}</span>`;
}
function refLookup(term) {
  const q = term.toLowerCase();
  let hits = RULES.filter(r=>r.t.toLowerCase()===q);
  if (!hits.length) hits = RULES.filter(r=>r.t.toLowerCase().includes(q));
  // Plurals: "Handaxes" → "Handaxe", "Pouches" → "Pouch"
  if (!hits.length && /s$/i.test(q)) {
    const singular = q.replace(/e?s$/i,"");
    hits = RULES.filter(r=>r.t.toLowerCase()===singular || r.t.toLowerCase().startsWith(singular));
  }
  // Trim trailing words ("Sneak Attack 2d6" → "Sneak Attack") until a title matches
  if (!hits.length) {
    const words = term.split(" ");
    while (!hits.length && words.length > 1) {
      words.pop();
      const part = words.join(" ").replace(/[,;]$/,"").toLowerCase();
      hits = RULES.filter(r=>r.t.toLowerCase()===part || r.t.toLowerCase().startsWith(part));
    }
  }
  if (!hits.length) hits = RULES.filter(r=>r.d.toLowerCase().includes(q)).slice(0,3);
  document.getElementById("refModal").innerHTML = `
    <h3>${term}</h3>
    ${hits.length ? hits.map(r=>`<div class="rule-card"><div class="cat">${r.c}</div><h4>${allDice(r.t)}</h4><p>${allDice(r.d)}</p>${r.url?`<a href="${r.url}" target="_blank" rel="noopener" style="font-size:.85rem">Full description on the SRD ↗</a>`:""}</div>`).join("")
      : `<div class="rule-card"><p>No reference entry found. Try the Reference tab's search.</p></div>`}
    <div class="lvl-actions"><button onclick="refClose()">Close</button></div>`;
  document.getElementById("refOverlay").classList.add("open");
}
// Chooser overlay: explains a creator choice and lists every option, selectable in place
const CHOOSERS = {
  class: { label:"Class", concept:"Class and Subclass", cat:"Class", sel:"selClass",
    tip:"Your biggest decision: it sets your hit die, what you're good at, and what you actually do on your turn. Pick the fantasy you want to play, the numbers follow." },
  species: { label:"Species", concept:"Species", cat:"Species", sel:"selSpecies",
    tip:"Your character's ancestry. It grants size, speed, and a handful of special traits like Darkvision. In the 2024 rules it does not change your ability scores, so any species works with any class." },
  background: { label:"Background", concept:"Background and Origin Feats", cat:"Background", sel:"selBackground",
    tip:"What you did before adventuring. This is where your ability score bonuses come from, plus two skills, a tool, starting gear, and an origin feat." },
  alignment: { label:"Alignment", concept:"Alignment", cat:"Alignment", sel:"selAlignment",
    tip:"A two-word shorthand for how your character behaves: their attitude toward rules and toward other people. It's a roleplaying guide with no mechanical effect, so choose what you'll enjoy playing." }
};

function refChooser(kind) {
  const cfg = CHOOSERS[kind];
  const concept = RULES.find(r=>r.t === cfg.concept);
  const opts = RULES.filter(r=>r.c === cfg.cat);
  const current = document.getElementById(cfg.sel).value;
  document.getElementById("refModal").innerHTML = `
    <h3>${cfg.label}</h3>
    <div class="lvl-step">
      ${concept ? allDice(concept.d) : ""}
      <div style="margin-top:.5rem;color:var(--accent)">${cfg.tip}</div>
    </div>
    <div class="lvl-step">
      <div class="k">Your options · click one to choose it</div>
      <div class="picker-box">
        ${opts.map(o=>`<div class="chooser-row${o.t===current?" current":""}" onclick="chooserPick('${kind}','${escQ(o.t)}')" title="Choose ${o.t}">
            <div><b>${o.t}</b>${o.t===current?' <small style="color:var(--accent)">· current</small>':""}</div>
            <div style="font-size:.85rem;color:var(--muted)">${allDice(o.d)}</div>
          </div>`).join("")}
      </div>
    </div>
    <div class="lvl-actions"><button onclick="refClose()">Close</button></div>`;
  document.getElementById("refOverlay").classList.add("open");
}

function chooserPick(kind, name) {
  const el = document.getElementById(CHOOSERS[kind].sel);
  el.value = name;
  el.dispatchEvent(new Event("change"));
  refClose();
}

// Clicking anywhere outside the conditions menu, or pressing Escape, closes it
document.addEventListener("click", e=>{
  if (condMenuOpen && !(e.target.closest && e.target.closest(".cond-wrap"))) closeCondMenu();
});
document.addEventListener("keydown", e=>{ if (e.key==="Escape" && condMenuOpen) closeCondMenu(); });

function refClose() { document.getElementById("refOverlay").classList.remove("open"); }
document.addEventListener("click", e=>{ if (e.target.id==="refOverlay") refClose(); });

// ---------- ATTACK OVERLAY (attack roll + secondary damage roll) ----------
let atkState = null;

// Damage- or healing-only roll: same overlay, no attack line
function rollDamageOnly(name, dice, type, label) {
  atkState = { name, bonus:null, d20:null, total:null, dice, type, dmgMod:0,
               dmgResult:null, extra:[], noAttack:true, label: label||"Damage" };
  renderAtkModal();
  document.getElementById("atkOverlay").classList.add("open");
}

function attackRoll(name, bonus, dice, type, dmgMod) {
  const r = d20Roll("atk");
  const d = r.v;
  logRoll(`${name}${r.mode?` (${r.mode})`:""}`, d20Detail(r, bonus), d + bonus);
  atkState = { name, bonus, d20: d, total: d + bonus, dice, type, dmgMod, dmgResult: null, extra: [],
               detail: d20Detail(r, bonus), mode: r.mode };
  renderAtkModal();
  document.getElementById("atkOverlay").classList.add("open");
}

function renderAtkModal() {
  if (!atkState) return;
  const a = atkState;
  const crit = a.d20 === 20, fumble = a.d20 === 1;
  const extraSum = a.extra.reduce((s,r)=>s+r.v,0);
  const grand = (a.dmgResult!=null ? a.dmgResult : 0) + extraSum;
  document.getElementById("atkModal").innerHTML = `
    <h3>${a.name}</h3>
    ${a.noAttack ? "" : `
    <div class="lvl-step">
      <div class="k">Attack Roll · vs target's AC${a.mode?` · ${a.mode}`:""}</div>
      <div style="font-size:1.6rem"><b style="${crit?"color:var(--good)":fumble?"color:var(--accent2)":""}">${a.total}</b>
        <small style="color:var(--muted)">${a.detail}</small></div>
      ${crit?'<b style="color:var(--good)">NATURAL 20 · Critical Hit! Roll the damage dice twice.</b>':fumble?'<b style="color:var(--accent2)">Natural 1 · automatic miss.</b>':""}
    </div>`}
    <div class="lvl-step">
      <div class="k">${a.label||"Damage"}${a.type && a.type!=="spell"?` · ${a.type}`:""}</div>
      ${a.dice
        ? (a.dmgResult==null
          ? `<button onclick="atkDamage()">🎲 Roll ${(a.label||"damage").toLowerCase()} (${crit?"2×":""}${allDice(a.dice)}${a.dmgMod?` ${a.dmgMod>0?"+":""}${a.dmgMod}`:""})</button>`
          : `<div style="font-size:1.4rem"><b>${a.dmgResult}</b> <small style="color:var(--muted)">${diceHtml(a.dmgDetail)}</small></div>`)
        : (a.type==="spell"
          ? `<div style="color:var(--muted);font-size:.85rem;margin-bottom:.3rem">Roll your spell's damage dice${crit?" twice (crit!)":""}:</div>`
          : `<div style="font-size:1.4rem"><b>${a.dmgMod}</b> <small style="color:var(--muted)">flat</small></div>`)}
      <div style="margin-top:.4rem">
        <span style="color:var(--muted);font-size:.8rem">Extra dice:</span>
        ${[4,6,8,10,12].map(s=>`<button class="minor" style="padding:.25rem .5rem;font-size:.8rem" onclick="atkExtra(${s})">+d${s}</button>`).join(" ")}
        ${a.extra.length?`<div style="margin-top:.3rem">${a.extra.map(r=>`${dieIcon(r.s)} (${r.v})`).join(" + ")} = <b>${extraSum}</b></div>`:""}
      </div>
      ${grand && (a.dmgResult!=null || a.extra.length) ? `<div style="margin-top:.4rem;border-top:1px solid var(--line);padding-top:.3rem">Total damage: <b style="font-size:1.2rem">${grand}</b></div>` : ""}
    </div>
    <div class="lvl-actions"><button onclick="atkClose()">Done</button></div>`;
}

function atkDamage() {
  const a = atkState;
  // dice may carry a flat bonus, e.g. "3d4+3"
  const [dicePart, flatPart] = a.dice.split("+");
  const flat = flatPart ? parseInt(flatPart,10) : 0;
  const [n, sides] = dicePart.trim().split("d").map(Number);
  const count = a.d20===20 ? n*2 : n;
  const rolls = Array.from({length:count}, ()=>1+Math.floor(Math.random()*sides));
  const bonus = a.dmgMod + (a.d20===20 ? flat*2 : flat);
  a.dmgResult = Math.max(0, rolls.reduce((s,v)=>s+v,0) + bonus);
  a.dmgDetail = `${count}d${sides} (${rolls.join(", ")})${bonus?` ${bonus>0?"+":""}${bonus}`:""}${a.type&&a.type!=="spell"?` ${a.type}`:""}`;
  logRoll(`${a.name} ${a.label||"Damage"}`, a.dmgDetail, a.dmgResult);
  renderAtkModal();
}

function atkExtra(sides) {
  const v = 1 + Math.floor(Math.random()*sides);
  atkState.extra.push({s:sides, v});
  logRoll(`${atkState.name} extra d${sides}`, `d${sides} (${v})`, v);
  renderAtkModal();
}

function atkClose() {
  atkState = null;
  document.getElementById("atkOverlay").classList.remove("open");
}
document.addEventListener("click", e=>{ if (e.target.id==="atkOverlay") atkClose(); });

// ---------- SPELL DETAIL / CASTING OVERLAY ----------
function spellDetail(name) {
  const s = SPELLS.find(x=>x.n===name);
  if (!s) return;
  const canCast = hasSpellFocus();
  const rows = getSlotRows().filter(r=>r.total>0 && r.lv >= s.l).map(r=>{
    const left = r.total - (state.slotsUsed[r.lv]||0);
    const off = left<=0 || !canCast;
    return `<button onclick="castSpell('${escQ(s.n)}',${r.lv})" ${off?"disabled style='opacity:.45'":""}>✨ Cast with Level ${r.lv} slot (${left} left)</button>`;
  }).join(" ");
  const roll = spellRolls(s);
  const prof = 2 + Math.floor((state.level-1)/4);
  const castAb = state.cls ? CLASSES[state.cls].spellcaster : null;
  const castMod = castAb && state.scores[castAb]!=null ? mod(state.scores[castAb]) : 0;
  const spellAtk = prof + castMod;
  const rollBtns = [
    roll.atk ? `<button onclick="attackRoll('${escQ(s.n)}',${spellAtk},${roll.dmg?`'${roll.dmg.split(" ")[0]}'`:"null"},'${roll.dmg?roll.dmg.split(" ").slice(1).join(" "):"spell"}',0)">🎯 Spell attack ${fmtMod(spellAtk)}</button>` : "",
    (!roll.atk && roll.dmg) ? `<button onclick="rollDamageOnly('${escQ(s.n)}','${roll.dmg.split(" ")[0]}','${roll.dmg.split(" ").slice(1).join(" ")}','Damage')">💥 Roll ${allDice(roll.dmg)}</button>` : "",
    roll.heal ? `<button onclick="rollDamageOnly('${escQ(s.n)}','${roll.heal}','','Healing')">❤️ Roll healing (${allDice(roll.heal)})</button>` : ""
  ].filter(Boolean).join(" ");

  const meta = spellMeta(s);
  document.getElementById("spellModal").innerHTML = `
    <h3>${s.n}</h3>
    <div style="color:var(--muted);font-style:italic;margin-bottom:.5rem">${s.l===0?"Cantrip":"Level "+s.l} · ${s.c.join(", ")}${roll.save?` · ${ABILITY_NAMES[roll.save.toUpperCase()]||roll.save} save vs DC ${8+spellAtk}`:""}</div>
    <div class="lvl-step spell-meta">
      <div><span class="k">Casting Time</span>${meta.time}</div>
      <div><span class="k">Range</span>${meta.range}</div>
      <div><span class="k">Components</span>${meta.comp}</div>
      <div><span class="k">Duration</span>${meta.dur}</div>
    </div>
    <div class="lvl-step">${allDice(s.d)}${roll.note?`<div style="margin-top:.3rem;color:var(--muted);font-size:.85rem">${roll.note}</div>`:""}
      <div style="margin-top:.5rem"><a href="${meta.url}" target="_blank" rel="noopener">Full description on the SRD ↗</a></div>
    </div>
    ${rollBtns?`<div class="lvl-step"><div class="k">Rolls</div>${rollBtns}</div>`:""}
    ${hasSpellFocus() ? "" : `<div class="warn-banner">⚠ You aren't carrying a spellcasting focus, so you can't cast this. Add one under Equipment.</div>`}
    <div class="lvl-step"><div class="k">Cast</div>
      ${s.l===0 ? `<button onclick="castSpell('${escQ(s.n)}',0)" ${canCast?"":"disabled style='opacity:.45'"}>✨ Cast cantrip</button>` : (rows || '<span style="color:var(--muted)">No spell slots of this level.</span>')}
    </div>
    <div class="lvl-actions"><button onclick="spellClose()">Close</button></div>`;
  document.getElementById("spellOverlay").classList.add("open");
}

function castSpell(name, lv) {
  if (!hasSpellFocus()) return;
  if (lv > 0) {
    const row = getSlotRows().find(r=>r.lv===lv);
    const left = row ? row.total - (state.slotsUsed[lv]||0) : 0;
    if (left <= 0) return;
    pushUndo(`casting ${name}`);
    state.slotsUsed[lv] = (state.slotsUsed[lv]||0) + 1;
  } else pushUndo(`casting ${name}`);
  const spell = SPELLS.find(s=>s.n===name);
  // the duration field is authoritative; some summaries word it loosely
  const needsConc = spell && /concentration/i.test(spellMeta(spell).dur);
  STATS.cast.total++;
  if (lv > 0) STATS.cast.slots++; else STATS.cast.cantrip++;
  tally(STATS.cast.by, name);
  logEvent("cast", `Cast <b>${name}</b>${lv?` using a Level ${lv} slot`:" (cantrip)"}${needsConc?" · concentrating":""}`);
  if (needsConc) startConcentration(name);
  spellClose();
  renderSheet(); persistLoaded();
}

function spellClose() { document.getElementById("spellOverlay").classList.remove("open"); }
document.addEventListener("click", e=>{ if (e.target.id==="spellOverlay") spellClose(); });

// ---------- THEME ----------
const THEME_KEY = "dnd-srd-theme";
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
  const on = 'background:var(--accent);color:#fff;border-color:var(--accent);font-weight:bold';
  document.getElementById("btnThemeDark").style.cssText = "flex:1;" + (theme==="dark" ? on : "");
  document.getElementById("btnThemeLight").style.cssText = "flex:1;" + (theme==="light" ? on : "");
}
document.getElementById("btnThemeDark").addEventListener("click", ()=>{ applyTheme("dark"); setNavMode(navMode); });
document.getElementById("btnThemeLight").addEventListener("click", ()=>{ applyTheme("light"); setNavMode(navMode); });
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

document.getElementById("btnNavHover").addEventListener("click", ()=>setNavMode("hover"));
document.getElementById("btnNavClick").addEventListener("click", ()=>setNavMode("click"));
setNavMode(navMode);

document.getElementById("btnBackup").addEventListener("click", backupCharacters);
document.getElementById("btnRestore").addEventListener("click", ()=>document.getElementById("restoreFile").click());
document.getElementById("restoreFile").addEventListener("change", e=>restoreCharacters(e.target));

// Whether the browser has promised to keep this data is otherwise invisible,
// and it is the difference between "saved" and "saved until the device is
// short of space", so Settings says which it is.
function renderStorageStatus() {
  const el = document.getElementById("storageStatus");
  if (!el) return;
  const n = loadStore().length;
  const bits = [`${n} character${n===1?"":"s"} in this browser's storage.`];
  if (!storeHealthy) bits.push("The saved data could not be read; what you see came from this session's copy.");
  el.textContent = bits.join(" ");

  // the unreadable bytes, if there are any, are offered as a download
  let rescue = null;
  try { rescue = localStorage.getItem(RESCUE_KEY); } catch(e) {}
  const row = document.getElementById("rescueRow");
  if (row) row.style.display = rescue ? "block" : "none";

  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const mb = est.usage != null ? (est.usage / 1048576).toFixed(1) + " MB used" : null;
      if (mb) el.textContent += ` ${mb}.`;
    }).catch(()=>{});
  }
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(p => {
      el.textContent += p
        ? " This browser has marked the data persistent, so it will not be cleared to free up space."
        : " This browser has not marked the data persistent, so it could be cleared if the device runs short of space. Keep a backup.";
    }).catch(()=>{});
  }
}

function rescueUnreadable() {
  let raw = null;
  try { raw = localStorage.getItem(RESCUE_KEY); } catch(e) {}
  if (!raw) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([raw], {type:"application/json"}));
  a.download = "character-data-unreadable.json";
  a.click();
  URL.revokeObjectURL(a.href);
  backupStatus("Saved the unreadable data to a file. Nothing was changed here.", true);
}
document.getElementById("btnRescue").addEventListener("click", rescueUnreadable);

// Restore the in-progress character from the last visit
try {
  const cur = JSON.parse(localStorage.getItem("dnd-srd-current"));
  if (cur && (cur.cls || cur.species || cur.name)) applyCharacter(cur);
} catch(e) {}

// ---------- STATS PAGE ----------
// Two different kinds of number live on this page. The play tallies come from
// STATS, which counts events as they happen and never forgets them. The
// collection figures are counted fresh from the saved characters every time the
// page is drawn, because those change when a character is edited or deleted and
// a running total would slowly go wrong.
const fmtN = n => (n == null ? "0" : Math.round(n).toLocaleString());
const stBig = (v, k, sub) =>
  `<div class="st-big"><div class="v">${v}</div><div class="k">${k}</div>${sub?`<div class="s">${sub}</div>`:""}</div>`;
const stRow = (k, v, sub) =>
  `<div class="st-row"><span>${k}${sub?`<small>${sub}</small>`:""}</span><b>${v}</b></div>`;
function stBars(entries, opts) {
  const o = opts || {};
  if (!entries.length) return `<div class="st-empty">${o.empty || "Nothing yet."}</div>`;
  const top = entries.slice(0, o.max || 6);
  const peak = Math.max(...top.map(e=>e[1]), 1);
  return top.map(([name, n]) =>
    `<div class="st-bar"><div class="st-bar-l"><span>${escHtml(name)}</span><b>${fmtN(n)}${o.unit||""}</b></div>
     <div class="st-bar-t"><i style="width:${Math.max(4, Math.round(n/peak*100))}%"></i></div></div>`).join("");
}
// A tally object as a list sorted by count, biggest first
const stSorted = obj => Object.entries(obj || {}).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));

function stDate(iso) {
  if (!iso) return "never";
  try { return new Date(iso).toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"}); }
  catch(e) { return "unknown"; }
}
// Consecutive days ending today, or ending yesterday so that a streak is not
// declared broken before the day it would actually break on, plus the longest
// run there has ever been.
function stStreaks(days) {
  const keys = Object.keys(days).sort();
  if (!keys.length) return { current:0, longest:0, active:0 };
  const dayNo = k => Math.round(Date.parse(k + "T00:00:00") / 86400000);
  let longest = 1, run = 1;
  for (let i = 1; i < keys.length; i++) {
    run = dayNo(keys[i]) - dayNo(keys[i-1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const today = dayNo(dayKey(new Date()));
  const last = dayNo(keys[keys.length-1]);
  let current = 0;
  if (today - last <= 1) {
    current = 1;
    for (let i = keys.length - 1; i > 0; i--) {
      if (dayNo(keys[i]) - dayNo(keys[i-1]) !== 1) break;
      current++;
    }
  }
  return { current, longest, active: keys.length };
}

// The d20 faces, one bar each. Every d20 the app rolls goes through d20Roll(),
// so this covers attacks, saves, checks, death saves and the loose dice.
function stD20Chart() {
  const counts = [];
  for (let f = 1; f <= 20; f++) counts.push(STATS.d20[f] || 0);
  const peak = Math.max(...counts, 1);
  return `<div class="st-hist">${counts.map((n, i) => {
    const face = i + 1;
    const cls = face === 20 ? " crit" : face === 1 ? " fumble" : "";
    return `<div class="st-hist-c${cls}" title="${face}: rolled ${n} time${n===1?"":"s"}">
      <i style="height:${Math.max(2, Math.round(n/peak*100))}%"></i><span>${face}</span></div>`;
  }).join("")}</div>`;
}

// Thirteen weeks of activity, newest column on the right, the way a
// contribution graph reads. The shade is how many events were logged that day.
function stHeatmap(days) {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - 90 - today.getDay());   // begin on a Sunday
  const peak = Math.max(1, ...Object.values(days));
  const cells = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate()+1)) {
    const k = dayKey(d), n = days[k] || 0;
    const lvl = !n ? 0 : n >= peak*0.66 ? 4 : n >= peak*0.33 ? 3 : n > 1 ? 2 : 1;
    cells.push(`<i class="l${lvl}" title="${k}: ${n} event${n===1?"":"s"}"></i>`);
  }
  return `<div class="st-heat">${cells.join("")}</div>
    <div class="st-heat-key"><span>13 weeks ago</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>today</span></div>`;
}

// The coins a character started with, which sit in the purse rather than in the
// pack. Same rule as startingCoins(), but for any record rather than the one in
// play.
function startingCoinsOf(who) {
  const cl = who.cls ? CLASSES[who.cls] : null;
  const bg = who.background ? BACKGROUNDS[who.background] : null;
  const out = {};
  [...(cl?cl.equipment:[]), ...(bg?bg.equipment:[])].forEach(e=>{
    const m = COIN_RE.exec(String(e).trim());
    if (m) { const k = m[2].toLowerCase(); out[k] = (out[k]||0) + Number(m[1]); }
  });
  return out;
}

function renderStats() {
  const el = document.getElementById("statsBody");
  if (!el) return;
  const list = loadStore();
  const S = STATS;

  // ----- play tallies -----
  const d20Total = Object.values(S.d20).reduce((a,b)=>a+b, 0);
  const d20Sum = Object.entries(S.d20).reduce((a,[f,n])=>a + Number(f)*n, 0);
  const trayTotal = Object.values(S.dice).reduce((a,t)=>a+t.n, 0);
  const nat20 = S.d20[20] || 0, nat1 = S.d20[1] || 0;
  const avgD20 = d20Total ? d20Sum / d20Total : 0;
  const streak = stStreaks(S.days);
  const events = Object.values(S.events).reduce((a,b)=>a+b, 0);

  // ----- the roster, counted fresh -----
  const alive = list.filter(c=>!c.retired);
  const levels = list.map(c=>c.level || 1);
  const byClass = {}, bySpecies = {};
  const spellUse = {}, itemUse = {}, featUse = {};
  let partyCp = 0, partyHp = 0;
  list.forEach(c => {
    if (c.cls) byClass[c.cls] = (byClass[c.cls]||0) + 1;
    if (c.species) bySpecies[c.species] = (bySpecies[c.species]||0) + 1;
    (c.spells||[]).forEach(n=>{ spellUse[n] = (spellUse[n]||0) + 1; });
    (c.feats||[]).forEach(n=>{ featUse[n] = (featUse[n]||0) + 1; });
    equipmentOf(c).forEach(n=>{ itemUse[n] = (itemUse[n]||0) + 1; });
    partyHp += c.maxHp || 0;
    const start = startingCoinsOf(c);
    COINS.forEach(k=>{ partyCp += ((start[k.k]||0) + ((c.coins||{})[k.k]||0)) * k.cp; });
  });
  const spellTotal = Object.values(spellUse).reduce((a,b)=>a+b, 0);
  const itemTotal = Object.values(itemUse).reduce((a,b)=>a+b, 0);
  const featTotal = Object.values(featUse).reduce((a,b)=>a+b, 0);

  // ----- the library -----
  const libBy = {}, libSrc = {};
  RULES.forEach(r=>{
    const c = ruleCat(r); libBy[c] = (libBy[c]||0) + 1;
    const s = r.src || SRC_SRD; libSrc[s] = (libSrc[s]||0) + 1;
  });
  const libLoading = [bestiaryState, itemsState, extraState].some(x=>x === "loading");
  const libIdle = [bestiaryState, itemsState, extraState].some(x=>x === "idle");

  if (!d20Total && !trayTotal && !events && !list.length) {
    el.innerHTML = `<section class="panel">
      <div class="st-empty" style="padding:2rem 1rem;text-align:center">
        <div style="font-size:2rem">🎲</div>
        <p>No numbers yet. Save a character, roll some dice, and this page fills itself in.</p>
        <p style="font-size:.85rem">Everything here is counted in this browser and never leaves it.</p>
      </div></section>`;
    return;
  }

  el.innerHTML = `
    <div class="st-hero">
      ${stBig(fmtN(list.length), list.length === 1 ? "character saved" : "characters saved",
              list.length ? `${fmtN(levels.reduce((a,b)=>a+b,0))} levels between them` : "")}
      ${stBig(fmtN(d20Total + trayTotal), "dice rolled", d20Total ? `${fmtN(nat20)} natural 20s` : "")}
      ${stBig(fmtN(S.hp.damage), "damage taken", `${fmtN(S.hp.healed)} HP healed back`)}
      ${stBig(fmtN(streak.active), streak.active === 1 ? "day played" : "days played", `since ${stDate(S.firstAt)}`)}
    </div>

    <div class="mod-grid">
      <section class="panel span-all">
        <h3 class="mod-h">Every d20 you have rolled</h3>
        ${d20Total ? stD20Chart() + `
          <div class="st-rows">
            ${stRow("Average roll", avgD20.toFixed(2), "a fair d20 averages 10.5")}
            ${stRow("Natural 20s", `${fmtN(nat20)} <small>(${(nat20/d20Total*100).toFixed(1)}%)</small>`, "5% is par")}
            ${stRow("Natural 1s", `${fmtN(nat1)} <small>(${(nat1/d20Total*100).toFixed(1)}%)</small>`)}
            ${stRow("Rolled with Advantage", fmtN(S.adv))}
            ${stRow("Rolled with Disadvantage", fmtN(S.dis))}
          </div>
          <div class="st-note">${avgD20 >= 10.5
            ? `Your dice are running <b>${(avgD20-10.5).toFixed(2)} above</b> a fair average. Enjoy it while it lasts.`
            : `Your dice are running <b>${(10.5-avgD20).toFixed(2)} below</b> a fair average. The odds owe you nothing, but they do even out.`}</div>`
        : `<div class="st-empty">No d20 rolled yet. Every attack, save, and check on a character sheet counts here.</div>`}
      </section>

      <section class="panel">
        <h3 class="mod-h">The dice tray</h3>
        ${stBars(Object.entries(S.dice).sort((a,b)=>Number(a[0])-Number(b[0])).map(([sides,t])=>[`d${sides}`, t.n]),
                 {empty:"No loose dice thrown yet. The Basics tab has a set.", max:9, unit:" rolls"})}
        ${trayTotal ? `<div class="st-rows">${Object.entries(S.dice).sort((a,b)=>Number(a[0])-Number(b[0]))
            .map(([sides,t])=>stRow(`d${sides} average`, (t.sum/t.n).toFixed(2), `fair average ${((Number(sides)+1)/2).toFixed(1)}`)).join("")}</div>` : ""}
      </section>

      <section class="panel">
        <h3 class="mod-h">Initiative</h3>
        ${S.init.n ? `<div class="st-rows">
          ${stRow("Rolled", fmtN(S.init.n) + (S.init.n === 1 ? " time" : " times"))}
          ${stRow("Average result", (S.init.sum/S.init.n).toFixed(1))}
          ${stRow("Best", fmtN(S.init.best))}
          ${stRow("Worst", fmtN(S.init.worst))}
        </div>` : `<div class="st-empty">No initiative rolled yet. It is the INITIATIVE box at the top of a character sheet.</div>`}
      </section>

      <section class="panel">
        <h3 class="mod-h">Wounds and mending</h3>
        <div class="st-rows">
          ${stRow("Damage taken", fmtN(S.hp.damage))}
          ${stRow("HP healed", fmtN(S.hp.healed))}
          ${stRow("Temporary HP gained", fmtN(S.hp.temp))}
          ${stRow("Biggest single hit", fmtN(S.hp.biggestHit))}
          ${stRow("Biggest single heal", fmtN(S.hp.biggestHeal))}
          ${stRow("Times dropped to 0 HP", fmtN(S.hp.downed))}
          ${stRow("Times back on their feet", fmtN(S.hp.revived))}
        </div>
        ${S.hp.damage ? `<div class="st-note">${S.hp.healed >= S.hp.damage
          ? "You have been patched up more than you have been hurt. Whoever plays the healer has earned a drink."
          : `You are carrying <b>${fmtN(S.hp.damage - S.hp.healed)} HP</b> more damage than healing.`}</div>` : ""}
      </section>

      <section class="panel">
        <h3 class="mod-h">Death saves</h3>
        ${S.death.rolls ? `<div class="st-rows">
          ${stRow("Death saves rolled", fmtN(S.death.rolls))}
          ${stRow("Passed", fmtN(S.death.pass))}
          ${stRow("Failed", fmtN(S.death.fail))}
          ${stRow("Natural 20s", fmtN(S.death.nat20), "straight back up with 1 HP")}
          ${stRow("Natural 1s", fmtN(S.death.nat1), "two failures each")}
          ${stRow("Characters who died", fmtN(S.death.died))}
        </div>` : `<div class="st-empty">Nobody has had to roll one. Long may that last.</div>`}
      </section>

      <section class="panel">
        <h3 class="mod-h">Camp and campaign</h3>
        <div class="st-rows">
          ${stRow("Long rests", fmtN(S.rest.long))}
          ${stRow("Short rests", fmtN(S.rest.short))}
          ${stRow("Hit Dice spent", fmtN(S.rest.hitDice))}
          ${stRow("Rests interrupted", fmtN(S.rest.interrupted))}
          ${stRow("Level ups", fmtN(S.lvl.ups))}
          ${stRow("XP awarded", fmtN(S.xp))}
        </div>
        ${Object.keys(S.lvl.by).length ? `<h4 class="st-sub">Levels gained by class</h4>${stBars(stSorted(S.lvl.by))}` : ""}
      </section>

      <section class="panel">
        <h3 class="mod-h">Spellwork</h3>
        <div class="st-rows">
          ${stRow("Spells cast", fmtN(S.cast.total))}
          ${stRow("Spell slots spent", fmtN(S.cast.slots))}
          ${stRow("Cantrips cast", fmtN(S.cast.cantrip))}
        </div>
        ${Object.keys(S.cast.by).length
          ? `<h4 class="st-sub">Most cast</h4>${stBars(stSorted(S.cast.by), {unit:" casts"})}`
          : `<div class="st-empty">No spells cast yet. Open a spell on a sheet to cast it.</div>`}
      </section>

      <section class="panel">
        <h3 class="mod-h">Loot and burden</h3>
        <div class="st-rows">
          ${stRow("Items picked up", fmtN(S.gear.picked))}
          ${stRow("Items dropped", fmtN(S.gear.dropped))}
          ${stRow("Attunements made", fmtN(S.gear.attuned))}
          ${stRow("Coin earned", fmtN(S.coins.gained/100) + " gp")}
          ${stRow("Coin spent", fmtN(S.coins.spent/100) + " gp")}
        </div>
        ${Object.keys(S.gear.by).length ? `<h4 class="st-sub">Most picked up</h4>${stBars(stSorted(S.gear.by))}` : ""}
      </section>

      <section class="panel">
        <h3 class="mod-h">Conditions suffered</h3>
        ${stBars(stSorted(S.conds), {empty:"None so far. Your characters lead charmed lives.", max:8})}
      </section>

      <section class="panel">
        <h3 class="mod-h">Your roster</h3>
        ${list.length ? `<div class="st-rows">
          ${stRow("Characters saved", fmtN(list.length))}
          ${stRow("Still adventuring", fmtN(alive.length))}
          ${stRow("Retired or fallen", fmtN(list.length - alive.length))}
          ${stRow("Highest level", fmtN(Math.max(...levels)))}
          ${stRow("Average level", (levels.reduce((a,b)=>a+b,0)/levels.length).toFixed(1))}
          ${stRow("Hit points between them", fmtN(partyHp))}
          ${stRow("Gold between them", fmtN(partyCp/100) + " gp")}
        </div>
        <h4 class="st-sub">By class</h4>${stBars(stSorted(byClass))}
        <h4 class="st-sub">By species</h4>${stBars(stSorted(bySpecies))}`
        : `<div class="st-empty">No saved characters yet.</div>`}
      </section>

      <section class="panel">
        <h3 class="mod-h">What they know and carry</h3>
        ${list.length ? `<div class="st-rows">
          ${stRow("Spells prepared", fmtN(spellTotal), `${fmtN(Object.keys(spellUse).length)} different`)}
          ${stRow("Items carried", fmtN(itemTotal), `${fmtN(Object.keys(itemUse).length)} different`)}
          ${stRow("Feats taken", fmtN(featTotal), `${fmtN(Object.keys(featUse).length)} different`)}
        </div>
        <h4 class="st-sub">Most prepared spells</h4>${stBars(stSorted(spellUse), {unit:" characters", empty:"Nobody has any spells prepared."})}
        <h4 class="st-sub">Most carried items</h4>${stBars(stSorted(itemUse), {unit:" characters"})}`
        : `<div class="st-empty">Nothing to count until a character is saved.</div>`}
      </section>

      <section class="panel span-all">
        <h3 class="mod-h">Days played</h3>
        ${stHeatmap(S.days)}
        <div class="st-rows">
          ${stRow("Days with something logged", fmtN(streak.active))}
          ${stRow("Current streak", fmtN(streak.current) + (streak.current === 1 ? " day" : " days"))}
          ${stRow("Longest streak", fmtN(streak.longest) + (streak.longest === 1 ? " day" : " days"))}
          ${stRow("First seen", stDate(S.firstAt))}
          ${stRow("Last played", stDate(S.lastAt))}
          ${stRow("Events logged", fmtN(events))}
        </div>
      </section>

      <section class="panel span-all">
        <h3 class="mod-h">The library</h3>
        <div class="st-rows">
          ${stRow("Reference entries loaded", fmtN(RULES.length))}
          ${stRow("Sources", fmtN(Object.keys(libSrc).length))}
        </div>
        ${libLoading ? `<div class="st-note">Still loading the bestiary, the item catalogue, and the third-party sources, so these numbers will grow.</div>` : ""}
        ${libIdle && !libLoading ? `<div class="st-note">Most of the library loads on demand. <span class="ref-link" onclick="loadBestiary();loadItems();loadExtraSources();renderStats()">Load all of it now</span> to count it.</div>` : ""}
        <h4 class="st-sub">By type</h4>${stBars(stSorted(libBy), {max:10, unit:" entries"})}
        <h4 class="st-sub">By source</h4>${stBars(stSorted(libSrc), {max:10, unit:" entries"})}
      </section>
    </div>`;
}
// The bestiary, the item catalogue, and the third-party sources land long after
// the page may have been drawn, and they change what the library holds.
function refreshStatsIfOpen() {
  const page = document.getElementById("tab-stats");
  if (page && page.classList.contains("active")) renderStats();
}

// ---------- INSTALLABLE APP ----------
// The service worker is what lets Chrome offer "Install", and it keeps the
// app working with no connection. It needs a secure context, so it is skipped
// when the page is opened straight off the filesystem.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{ /* offline support is optional */ });
  });
}

// The manifest's shortcuts open a specific tab, e.g. #create. Only read on
// load, never written, so it cannot collide with the #c= share links.
const HASH_TABS = { basics:"quickref", create:"create", characters:"saved", reference:"rules", stats:"stats", settings:"settings" };
function openTabFromHash() {
  const key = (location.hash || "").replace(/^#/, "").toLowerCase();
  const tab = HASH_TABS[key];
  if (!tab) return;
  const b = document.querySelector(`.tabs button[data-tab="${tab}"]`);
  if (b) b.click();
}

updateSavedCount();
checkSharedLink();
openTabFromHash();
renderRuleCats();
renderRules("");
renderSkillChoices();
renderSpellChoices();
renderSheet();
