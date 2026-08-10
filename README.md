# 🎲 Character Generator

**▶️ Play it now: [charactergenerator.github.io](https://charactergenerator.github.io/)**

A complete D&D character builder, live character sheet, and rules companion for **levels 1-20**, built on the System Reference Document 5.2 (D&D 2024 rules) and EN Publishing's Level Up: Advanced 5th Edition. Plain HTML, CSS, and vanilla JavaScript: no server, no account, no build step. Your characters live in your browser.

---

## ⚔️ Build a Hero

- 🎲 **Randomize everything** with one click (always fully rested), roll individual choices with per-field dice buttons, or pick it all by hand. There is also **Add Random Character** on the Characters tab for an instant saved hero
- 🛡️ All **12 classes**, **9 species**, **12 subclasses**, and **4 backgrounds** from the SRD, plus the **Marshal** class and its three archetypes from Level Up, and an **Other** subclass option for anything your table plays
- 💪 Ability scores via 4d6-drop-lowest, standard array, or one-click **optimize for class**
- ✨ Full **spell picker** for casters: 227 SRD spells from cantrips through level 9, with class-filtered lists, level-scaled known/prepared counts, and random selection
- 📜 Personality traits, ideals, bonds, and flaws, hand-written or rolled from tables, plus freeform backstory notes

## 🗡️ Play at the Table

The sheet is a live play surface, not a printout:

- **Click anything to roll it**: abilities, saves, skills, initiative, weapon attacks, spell attacks. Results show the matching die icon in the toast and history
- ⬆⬇ **Advantage and disadvantage** toggle that applies to every d20 test, showing both dice with the discarded one struck through
- 🤢 **Conditions that actually do something**: a Conditions button drops down the full list to toggle, and the sheet applies what you pick: Poisoned rolls your attacks and checks at disadvantage, Restrained drops your Speed to 0, Paralyzed flags the saves that auto-fail, and anything incapacitating breaks your concentration. Manual advantage and a condition's disadvantage cancel, exactly as the rules say
- ↶ **Undo** for any misclick, 25 steps deep: HP, spell slots, class resources, death saves, conditions, coins, attunement, gear, XP, rests, and whole level-ups (subclass, feat, ability points, and new spells all roll back together)
- 💥 **Type any amount** to take or heal, plus temporary HP tracking
- ❤️‍🩹 **Bloodied** highlighting at half hit points, and buttons that grey out when there's nothing to spend, so no hit dice at full HP, no casting without a slot, no spending a resource you're out of
- 🔆 **Class resources** tracked as spendable pips (Rage, Channel Divinity, Second Wind, Action Surge, Bardic Inspiration, Focus and Sorcery Points, Lay On Hands), refilled by the right rest
- 🌀 **Concentration**: casting a concentration spell flags it, and taking damage prompts the CON save at the correct DC, breaking it on a failure
- ⚔️ Attack overlay rolls to-hit and damage (crits double your dice automatically), with extra-dice buttons for Sneak Attack and friends
- ✨ **Cast spells** from the sheet: click a spell for its casting time, range, components and duration, a link to the full SRD text, cast options, and roll buttons. Spell attacks, save-based damage, and healing all roll for you; slots are tracked as clickable pips (full, half, and pact casters all supported)
- 🎒 **Add equipment** as you loot it, from the SRD list, the **44 magic items**, or typed in freehand; weapons flow straight into your Attacks, duplicates stack with a count, and items requiring **Attunement** get a toggle that enforces the limit of three
- 💰 A **purse** seeded from your starting gear, in all five coin types, with a running gold total
- 📝 A **Notes** box on the sheet that saves as you type
- ❤️ Hit point, temp HP, and Heroic Inspiration tracking
- ⛺🌙 **Short and Long Rest overlays** that spend hit dice, restore HP and spell slots, and handle interruptions. Nothing applies until you confirm, and casters can swap their prepared spells overnight (random or hand-picked)
- ⬆️ **Level up to 20** through an in-page flow: per-class features that scale correctly (Rage, Sneak Attack, Martial Arts, spell counts...), rolled or average HP, your **subclass** chosen at level 3 (an SRD one, or your own named subclass with features you enter by level) with its features arriving on schedule, ability score improvements **or one of 73 feats**, new spells rolled for you or picked yourself, cancel anytime
- 💀 At 0 HP the sheet locks into a **dying overlay**: automated death saves, stabilization, resurrection, or an honorable 🪦 retirement. Dead heroes can be ✨ resurrected later from their sheet
- 📖 **History log** of every roll, rest, cast, level-up, edit, and near-death experience

## 📚 Look Anything Up

- 🔍 A **Reference** tab with **3,500+ searchable entries**: every spell, all class features, subclasses, feats, and species traits, conditions, combat actions, spellcasting and rests, 586 creature stat blocks, and an **Equipment catalogue of 1,800+ items** from adventuring gear and trade goods to artifacts. Typing a name puts that name at the top rather than everything that merely mentions it
- 🏷️ **Type chips** with live counts filter the list and combine with the search box. Types condense to Spell, Creature, Character, and Equipment; each card still names its own kind and the book it came from
- 🐉 **586 creatures** from the Monstrous Menagerie sit in the Reference as a Creature type: search them alongside everything else by name, type, size, or trait, and open a full stat block with rollable ability checks. The megabyte of stat blocks loads in the background the first time you open Reference
- ℹ️ Nearly everything is clickable: sheet features, species traits, equipment, the level-up and rest overlays, and the Basics page all open in-place reference definitions
- 🧭 A beginner-friendly **Basics** tab (the whole game on one page, with clickable dice-shaped icons)

## 💾 Your Characters, Kept

- Characters save to browser localStorage and survive restarts and reboots
- View, edit, and update saved characters; play-time changes (HP, slots, levels) persist automatically
- ⧉ **Duplicate** a hero before a risky level-up, and 🔗 **share** one as a link that carries the whole character in the URL itself, so nothing is uploaded anywhere
- ⬇️⬆️ **Backup & Restore** under Settings writes every character to one JSON file stamped with the date **and time**, so a folder of them sorts into the order they were taken, and reads them back on any machine. Restoring adds to what is already there rather than replacing it
- 🔒 Characters are held in browser storage, which survives deploys, updates, and cache clears. The app keeps a second copy of the last good list and refuses to write an empty one over your data if a read ever comes back unreadable, says so plainly if the browser rejects a write, and asks the browser to mark the data persistent so it is not evicted when the device runs short of space. Settings shows where all that stands
- 🌙 Modern dark mode by default, ☀️ parchment light mode in settings
- 📱 Sidebar navigation on desktop and tablet, app-style bottom bar on phones. Settings sits in its own block at the foot of the sidebar. The sidebar switches on hover by default; Settings has a hover-or-click toggle
- 📲 On a phone the bar's last stop is **More**, a sheet of tiles holding Settings and the sister tools, since five slots cannot hold everything the sidebar does
- 🧱 Every page is built from modules: the heading sits on the page and each block of content is its own card, rather than one box wrapping the whole tab
- 🔗 A **More** group at the bottom of the sidebar links out to the sister tools, [Auto Roll Tables](https://autorolltables.github.io/) and [DM Screen](https://dmscreen.github.io/)
- 📲 **Installable**: Chrome offers an Install button in the address bar, and iOS can Add to Home Screen. It then opens in its own window with no browser chrome, and works with no connection at all

## 🚀 Run It

Visit **[charactergenerator.github.io](https://charactergenerator.github.io/)**, or clone and open `index.html` in any browser. Structure: `index.html` (markup), `css/style.css` (both themes), `js/data.js` (SRD content), `js/open5e.js` (Level Up spells, feats, backgrounds, conditions, and the Marshal), `js/bestiary.js` (creatures) and `js/items.js` (the equipment catalogue), both loaded on demand, `js/app.js` (app logic). No dependencies; works offline once loaded.

## 📄 License

Built from freely licensed game content. Full attribution is in the app under **Settings**.

- **System Reference Document 5.2** (c) 2025 Wizards of the Coast LLC, licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode).
- **Level Up: Advanced 5th Edition** *Adventurer's Guide*, *Dungeon Delver's Guide*, and *Gate Pass Gazette* (c) EN Publishing, dual licensed CC BY 4.0 / OGL 1.0a and used here under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). See [a5esrd.com](https://a5esrd.com/a5esrd).
- **Level Up: Monstrous Menagerie** (c) 2021 EN Publishing, author Paul Hughes, released under the Open Game License v1.0a only and used here under that licence. See [OGL.txt](OGL.txt) for the licence and its Section 15 notice.
- **System Reference Document 5.1** (c) 2023 Wizards of the Coast LLC, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). Source of much of the Reference tab's equipment; where an item is in both, the SRD 5.2 version is the one the sheet uses.
- **Vault of Magic for 5th Edition** (c) 2022 and **Tome of Heroes** (c) 2022 Open Design LLC, published by [Kobold Press](https://koboldpress.com), and **Critical Role: Tal'Dorei Campaign Setting** (c) 2017 Green Ronin Publishing, LLC: further magic items, used under the Open Game License v1.0a. See [OGL.txt](OGL.txt).
- The extended equipment catalogue is the item set compiled by the companion [DM Screen](https://dmscreen.github.io/) project.
- EN Publishing content was retrieved through the [Open5e](https://open5e.com) API.

Content has been abridged and reformatted. Not affiliated with, endorsed, or sponsored by any of these publishers. Dungeons & Dragons is a trademark of Wizards of the Coast LLC; Level Up: Advanced 5th Edition is a trademark of EN Publishing.
