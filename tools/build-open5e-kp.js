// Builds js/open5e-extra.js: the spells, creatures, and magic items from the
// third-party 5e books Open5e carries, on top of the SRD and Level Up content
// that ships in js/data.js and js/open5e.js.
//
// Every one of these is Open Game Content except Spells That Don't Suck, which
// is CC BY 4.0. OGL.txt carries the Section 15 notices; keep it in step with
// the SOURCES table below.
//
// Run by hand:  node tools/build-open5e-kp.js
//   --refetch   ignore the cache under tools/raw/o5e-kp and pull again
const fs = require("fs");
const path = require("path");
const https = require("https");

const RAW = path.join(__dirname, "raw", "o5e-kp");
const OUT = path.join(__dirname, "..", "js", "open5e-extra.js");
const REFETCH = process.argv.includes("--refetch");

// Document key -> how it is labelled in the app. The chip has to fit a sidebar,
// so the long retail titles are shortened, but never to something ambiguous.
const SOURCES = {
  "deepm":                 { n: "Deep Magic",             endpoints: ["spells"] },
  "deepmx":                { n: "Deep Magic Extended",    endpoints: ["spells"] },
  "spells-that-dont-suck": { n: "Spells That Don't Suck", endpoints: ["spells"] },
  "tob":                   { n: "Tome of Beasts",         endpoints: ["creatures"] },
  "tob-2023":              { n: "Tome of Beasts 2023",    endpoints: ["creatures"] },
  "tob2":                  { n: "Tome of Beasts 2",       endpoints: ["creatures"] },
  "tob3":                  { n: "Tome of Beasts 3",       endpoints: ["creatures"] },
  "ccdx":                  { n: "Creature Codex",         endpoints: ["creatures"] },
  "vom":                   { n: "Vault of Magic",         endpoints: ["magicitems"] }
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "charactergenerator/1.0" } }, res => {
      if (res.statusCode !== 200) return reject(new Error(res.statusCode + " for " + url));
      const parts = [];
      res.on("data", d => parts.push(d));
      res.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    }).on("error", reject);
  });
}

// Walk every page of a list endpoint. The magicitems and items endpoints ignore
// document__key, so those get filtered here instead of by the server.
async function fetchAll(endpoint, docKey, serverFilters) {
  const cache = path.join(RAW, docKey + "-" + endpoint + ".json");
  if (!REFETCH && fs.existsSync(cache)) {
    const rows = JSON.parse(fs.readFileSync(cache, "utf8"));
    console.log("  " + docKey + "/" + endpoint + ": " + rows.length + " (cached)");
    return rows;
  }
  const out = [];
  let url = serverFilters
    ? "https://api.open5e.com/v2/" + endpoint + "/?document__key=" + docKey + "&limit=500"
    : "https://api.open5e.com/v2/" + endpoint + "/?limit=1000";
  while (url) {
    const page = JSON.parse(await get(url));
    out.push.apply(out, page.results);
    url = page.next;
  }
  const rows = serverFilters ? out : out.filter(r => r.document && r.document.key === docKey);
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(rows));
  console.log("  " + docKey + "/" + endpoint + ": " + rows.length + " kept");
  return rows;
}

// Markdown down to the small subset of HTML the app already renders, with no em
// dashes and no curly quotes left in the output.
function md(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, " ")
    .replace(/\s*\u2014\s*/g, " - ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const clean = s => String(s || "")
  .replace(/\s+/g, " ")
  .replace(/\s*\u2014\s*/g, " - ")
  .replace(/[‘’]/g, "'")
  .trim();

function mapSpell(s, srcIndex) {
  const comp = [s.verbal && "V", s.somatic && "S", s.material && "M"].filter(Boolean).join(", ");
  const o = {
    n: s.name,
    l: s.level,
    s: (s.school && s.school.name) || "",
    t: clean(s.casting_time || "").replace(/_/g, " "),
    r: clean(s.range_text || (s.range != null ? s.range + " feet" : "")) || "Self",
    c: comp + (s.material_specified ? " (" + clean(s.material_specified) + ")" : ""),
    u: clean(s.duration || "Instantaneous"),
    d: md(s.desc),
    src: srcIndex
  };
  if (s.concentration) o.conc = 1;
  if (s.ritual) o.rit = 1;
  if (s.higher_level) o.hl = md(s.higher_level);
  return o;
}

// Same keys as A5E_CREATURES in js/bestiary.js, so one stat-block renderer
// serves both. `src` is the only addition.
function mapCreature(c, srcIndex) {
  const sp = c.speed || {};
  const speed = Object.entries(sp)
    .filter(([k, v]) => k !== "unit" && v)
    .map(([k, v]) => (k === "walk" ? v + " ft." : k + " " + v + " ft.")).join(", ");
  const senses = [];
  if (c.blindsight_range) senses.push("blindsight " + c.blindsight_range + " ft.");
  if (c.darkvision_range) senses.push("darkvision " + c.darkvision_range + " ft.");
  if (c.tremorsense_range) senses.push("tremorsense " + c.tremorsense_range + " ft.");
  if (c.truesight_range) senses.push("truesight " + c.truesight_range + " ft.");
  if (c.passive_perception) senses.push("passive Perception " + c.passive_perception);
  const ri = c.resistances_and_immunities || {};
  const listOf = v => (Array.isArray(v) ? v.map(x => (x && (x.name || x.key)) || x).join(", ") : "");
  const risum = [];
  if (listOf(ri.damage_vulnerabilities)) risum.push("Vulnerable: " + listOf(ri.damage_vulnerabilities));
  if (listOf(ri.damage_resistances)) risum.push("Resistant: " + listOf(ri.damage_resistances));
  if (listOf(ri.damage_immunities)) risum.push("Immune: " + listOf(ri.damage_immunities));
  if (listOf(ri.condition_immunities)) risum.push("Condition immunities: " + listOf(ri.condition_immunities));
  const a = c.ability_scores || {};
  const saves = Object.entries(c.saving_throws || {})
    .map(([k, v]) => k.slice(0, 3).toUpperCase() + " " + (v >= 0 ? "+" : "") + v).join(", ");
  const skills = Object.entries(c.skill_bonuses || {})
    .map(([k, v]) => k[0].toUpperCase() + k.slice(1) + " " + (v >= 0 ? "+" : "") + v).join(", ");
  const o = {
    n: c.name,
    sz: (c.size && c.size.name) || "",
    ty: (c.type && c.type.name) || "",
    cr: c.challenge_rating,
    xp: c.experience_points || 0,
    ac: c.armor_class,
    acd: clean(c.armor_detail || ""),
    hp: c.hit_points,
    hd: clean(c.hit_dice || ""),
    spd: speed,
    ab: [a.strength, a.dexterity, a.constitution, a.intelligence, a.wisdom, a.charisma],
    src: srcIndex
  };
  if (saves) o.sv = saves;
  if (skills) o.sk = skills;
  if (senses.length) o.se = senses.join(", ");
  if (c.languages && c.languages.as_string) o.lg = clean(c.languages.as_string);
  if (risum.length) o.ri = risum.join(". ");
  const trts = (c.traits || []).map(x => ({ n: x.name, d: md(x.desc || "") }));
  const acts = (c.actions || []).map(x => ({ n: x.name, d: md(x.desc || "") }));
  if (trts.length) o.tr = trts;
  if (acts.length) o.ac2 = acts;
  return o;
}

function mapMagicItem(m, srcIndex) {
  const o = {
    n: m.name,
    c: (m.category && m.category.name) || "Wondrous item",
    d: md(m.desc),
    src: srcIndex
  };
  if (m.rarity && m.rarity.name) o.r = m.rarity.name;
  if (m.requires_attunement) o.a = "requires attunement";
  return o;
}

(async () => {
  const keys = Object.keys(SOURCES);
  const names = keys.map(k => SOURCES[k].n);
  const spells = [], creatures = [], magicitems = [];

  for (const key of keys) {
    const idx = keys.indexOf(key);
    for (const ep of SOURCES[key].endpoints) {
      const serverFilters = ep !== "magicitems" && ep !== "items";
      const rows = await fetchAll(ep, key, serverFilters);
      if (ep === "spells") spells.push.apply(spells, rows.map(r => mapSpell(r, idx)));
      if (ep === "creatures") creatures.push.apply(creatures, rows.map(r => mapCreature(r, idx)));
      if (ep === "magicitems") magicitems.push.apply(magicitems, rows.map(r => mapMagicItem(r, idx)));
    }
  }

  const banner =
    "// GENERATED by tools/build-open5e-kp.js - do not hand-edit.\n" +
    "// Spells, creatures, and magic items from the third-party 5e books Open5e\n" +
    "// carries. The Kobold Press titles are Open Game Content under the OGL\n" +
    "// 1.0a; Spells That Don't Suck is CC BY 4.0. See OGL.txt and Settings.\n" +
    "// Loaded on demand the first time the Reference tab is opened.\n";

  const js = banner +
    "const KP_SOURCES = " + JSON.stringify(names) + ";\n" +
    "const KP_SPELLS = " + JSON.stringify(spells) + ";\n" +
    "const KP_CREATURES = " + JSON.stringify(creatures) + ";\n" +
    "const KP_MAGICITEMS = " + JSON.stringify(magicitems) + ";\n" +
    "if (typeof onExtraSourcesLoaded === \"function\") onExtraSourcesLoaded();\n";

  fs.writeFileSync(OUT, js);

  const by = arr => {
    const c = {};
    arr.forEach(x => { c[names[x.src]] = (c[names[x.src]] || 0) + 1; });
    return c;
  };
  console.log("\n" + path.relative(process.cwd(), OUT) + "  " + (js.length / 1048576).toFixed(2) + " MB");
  console.log("  spells     " + spells.length, by(spells));
  console.log("  creatures  " + creatures.length, by(creatures));
  console.log("  magicitems " + magicitems.length, by(magicitems));
})().catch(e => { console.error("\n" + e.message); process.exit(1); });
