# OSCE Virtual Patient Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new AI-powered OSCE (Objective Structured Clinical Examination) Virtual Patient Simulator engine to QuizTool — a conversation-style interface where a cartoon patient of selectable gender/age is brought to life by Gemini, and the student practices history-taking and clinical reasoning.

**Architecture:** One new standalone engine file (`osce-engine.js`) following the exact IIFE pattern of `written-engine.js` / `flashcard-engine.js`. It defines a new file schema (`OSCE_CONFIG` + `OSCE_CASES`) with parsing markers, loads via a self-locating `__OSCE_ENGINE_BASE` script tag, duplicates the shared Gemini helpers (obfuscated key, model list, chat requests) exactly as the other engines do, and renders a chat-style patient UI with a procedurally-generated inline-SVG cartoon avatar. A browser-loaded `osce-test.html` page exercises the engine end-to-end, and a small Node unit-test file covers the pure logic helpers headlessly.

**Tech Stack:** Vanilla JavaScript (ES5-compatible IIFE, no build step — matches all other engines), inline SVG for patient avatars (no external image dependencies), Gemini `generateContent` REST API via `fetch`, CSS variables from the project theme system (`--bg`, `--surface`, `--accent`, etc.).

---

## Background: Patterns This Engine MUST Match

Read these before implementing. Do not invent new conventions.

1. **Engine IIFE shape** — `flashcard-engine.js:39-60` and `written-engine.js:5-46`. Every engine is `(function(){ 'use strict'; ... window.X = {...}; })();`, computes `ENGINE_BASE` from `document.currentScript.src`, and re-declares its own Gemini helpers (they do NOT share a module — this is deliberate, see `ai-assistant-engine.js:11-49` vs `written-engine.js:99-134`).
2. **File schema markers** — `written-template.html:26-78`. Pattern is `/* [NAME_CONFIG_START] */` … `/* [NAME_CONFIG_END] */`. These markers are parsed by `scripts/sync_quiz_assets.py` and the Tauri admin `parser.rs`. **Never omit them.**
3. **Engine loader script** — `written-template.html:80-89`. Self-locates via `Math.max(0, location.pathname.split('/').filter(Boolean).length - 2)` then `document.write` of the engine `<script>`. AGENTS.md §3 says "Never hardcode the path."
4. **Gemini chat request** — `ai-assistant-engine.js:199-273` (`requestGeminiChat` + `tryGeminiChatRequests`). Multi-turn: `systemInstruction` holds the fixed persona, `contents` holds the conversation. `temperature: 0.3`.
5. **API key obfuscation** — `ai-assistant-engine.js:30-64`. XOR with `[0x71,0x75,0x69,0x7A,0x74,0x6F,0x6F,0x6C]` ("quiztool") then `btoa`. Shared localStorage keys `gemini_api_key`, `gemini_selected_model`.
6. **Models list** — `written-engine.js:136-142`. Reuse the same array (do not invent model IDs).
7. **Hub registration** — `index.html:63-176`. New entries go in the `QUIZZES` array as a `{ uid, title, description, icon, tags, url }` object.
8. **Test page convention** — `flashcard-test.html`. Full HTML doc with theme bootstrap, SW registration, schema markers, and the engine loader. Opened directly in a browser, no test framework.

---

## File Structure

| File | Responsibility | Status |
|------|----------------|--------|
| `osce-engine.js` (repo root) | The engine: parses `OSCE_CONFIG`/`OSCE_CASES`, builds the patient UI, manages conversation state, calls Gemini for patient responses + examiner debrief. ~900 lines. | **Create** |
| `osce-test.html` (repo root) | Browser test page: theme bootstrap, SW, `OSCE_CONFIG` + 2 sample `OSCE_CASES` (one adult male cardiology, one pediatric female), inline self-test assertions for pure helpers, engine loader. Opened directly in a browser. | **Create** |
| `tests/osce-helpers.test.js` (new `tests/` dir) | Headless Node unit tests for the pure logic helpers (avatar parameter generation, history dedup, rubric scoring). Run with `node --test`. | **Create** |
| `index.html` | Add OSCE entry to `QUIZZES` array so it appears on the QuizTool hub. | **Modify** (1 insertion) |
| `tauri/src/engines.rs` | Add `OSCE_ENGINE_JS` constant + wire into `generator.rs` ZIP output (AGENTS.md §19, §23 propagation rule). | **Modify** (per propagation rule — covered in final task) |

The engine file holds ALL CSS/HTML/markup/conversation/prompt logic (matches `written-engine.js` which is a single 4000+ line file). Do not split it.

---

## Conversation Design (the core UX)

An OSCE case is a structured clinical scenario. The student plays the clinician taking a history from a virtual patient, then submits for an examiner debrief.

**Case object shape** (what the engine consumes):
```js
{
  id: "case-001",
  title: "Chest Pain in a 55-Year-Old Man",
  specialty: "Cardiology",
  difficulty: "Intermediate",
  patient: {
    name: "Mr. Robert Hayes",
    age: 55,
    gender: "male",          // "male" | "female"
    avatarSeed: "robert-h",  // stable seed for avatar generation
    opening: "Doctor, I've been getting this awful pressure in my chest..."
  },
  hiddenProfile: {           // NEVER shown to student until debrief; given to Gemini as ground truth
    diagnosis: "Stable angina pectoris",
    keySymptoms: ["substernal pressure", "exertional", "relieved by rest"],
    redFlags: ["diaphoresis", "radiation to left arm"],
    pastHistory: ["hypertension", "former smoker"],
    vitalSigns: "BP 148/92, HR 88, afebrile"
  },
  rubric: {                  // examiner scoring criteria, shown only at debrief
    mustAsk: ["SOCRATES pain characterization", "cardiac risk factors", "associated symptoms"],
    bonus: ["family history of CAD", "medication reconciliation"]
  }
}
```

**Conversation loop:**
1. Student sees patient avatar + opening line.
2. Student types a question (e.g. "Can you describe the pain?").
3. Engine sends `systemInstruction` (patient persona built from `hiddenProfile`) + conversation history to Gemini → patient replies in first person.
4. Repeat. Engine dedups, enforces a soft turn cap, lets student "Submit for feedback."
5. On submit, a SECOND Gemini call uses the rubric to score the interview (strict JSON output, mirroring `written-engine.js:1584-1644` grading methodology).
6. Debrief panel: score, what was asked, what was missed, the hidden diagnosis revealed.

**Avatar system:** Procedural inline SVG. A seeded PRNG picks hair style, skin tone, face shape, expression, accessory (glasses/hijab/none) from parameter tables. Gender + age band steer the pools. **No external images** (keeps the offline/offline-resilience guarantees from AGENTS.md §18). Multiple distinct avatars per gender×age-band come from varying the seed.

---

## Task 1: Scaffold the engine file and parsing layer

**Files:**
- Create: `D:\Study\Projects\QuizTool\osce-engine.js`

This task builds the file skeleton, the IIFE, the parsing layer, and the config normalization. No UI yet. Verifiable by Node requiring nothing (it's a browser IIFE) — but we expose pure helpers on `window.__OSCE_TEST_HOOKS` so the browser test page and Node tests can both reach them.

- [ ] **Step 1: Create the engine skeleton with IIFE, constants, and parsing**

Create `osce-engine.js` with exactly this content:

```js
/* ================================================================
   osce-engine.js  —  Standalone OSCE Virtual Patient Simulator.
   Consumes OSCE_CONFIG and OSCE_CASES from OSCE HTML files.
   Conversation-style: a cartoonic virtual patient (inline SVG) is
   driven by Gemini. Student practices history-taking; a rubric-based
   examiner gives feedback at the end.

   Mirrors the IIFE + duplicated-Gemini-helper pattern of
   written-engine.js and flashcard-engine.js by design.
   ================================================================ */
(function () {
  'use strict';

  var _cs = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : (window.__OSCE_ENGINE_BASE || '');

  /* ── Storage keys (shared with other engines) ───────────────── */
  var STORAGE = {
    theme: 'quiz-theme',
    apiKey: 'gemini_api_key',
    model: 'gemini_selected_model',
    progress: 'quiz_progress_v1_osce_',
    maxWait: 'gemini_max_wait',
    retryLevel: 'gemini_retry_level'
  };

  /* ── Models (identical to written-engine.js:136-142) ─────────── */
  var MODELS = [
    ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite (default, fast & modern)'],
    ['gemma-4-26b-a4b-it', 'Gemma 4 26B IT (open model, strong & free)'],
    ['gemma-4-31b-it', 'Gemma 4 31B IT (larger open model)'],
    ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite (older, deprecating soon)'],
    ['gemini-2.5-flash', 'Gemini 2.5 Flash (older, deprecating soon)']
  ];

  /* ── Obfuscation (identical to ai-assistant-engine.js:29-64) ── */
  var _OK = [0x71, 0x75, 0x69, 0x7A, 0x74, 0x6F, 0x6F, 0x6C]; // "quiztool"

  function _obfuscate(str) {
    if (!str) return '';
    var bytes = [];
    for (var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) ^ _OK[i % _OK.length]);
    return btoa(String.fromCharCode.apply(null, bytes));
  }
  function _deobfuscate(encoded) {
    if (!encoded) return '';
    try {
      var bytes = atob(encoded);
      var result = '';
      for (var i = 0; i < bytes.length; i++) result += String.fromCharCode(bytes.charCodeAt(i) ^ _OK[i % _OK.length]);
      return result;
    } catch (_) { return ''; }
  }
  function _readKey() {
    var raw = localStorage.getItem(STORAGE.apiKey);
    if (!raw) return '';
    return _deobfuscate(raw) || raw;
  }
  function _hasApiKey() { return !!_readKey(); }
  function _getSavedModel() { return localStorage.getItem(STORAGE.model) || MODELS[0][0]; }
  function _getMaxWaitMs() {
    var v = localStorage.getItem(STORAGE.maxWait) || '15';
    var n = parseInt(v, 10);
    return n > 0 ? n * 1000 : 0;
  }
  function _getRetryLevel() { return localStorage.getItem(STORAGE.retryLevel) || 'balanced'; }
  function modelIsAvailable(id) { return MODELS.some(function (m) { return m[0] === id; }); }
  function _getModelLabel(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i][0] === id) return MODELS[i][1];
    return id;
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function textOr(v, fallback) { return (v === null || v === undefined || v === '') ? fallback : String(v); }
  function pickField(obj) {
    var fields = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < fields.length; i++) {
      var val = obj[fields[i]];
      if (val !== null && val !== undefined && val !== '') return val;
    }
    return undefined;
  }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

  /* ── Config + case normalization ─────────────────────────────── */
  function normalizeConfig(raw) {
    raw = raw || {};
    var title = textOr(pickField(raw, 'title', 'name'), 'OSCE Virtual Patient');
    return {
      uid: textOr(pickField(raw, 'uid', 'id'), slugify(title) || 'osce_cases'),
      title: title,
      description: textOr(pickField(raw, 'description', 'desc', 'subtitle'),
        'Practice history-taking with an AI virtual patient, then get examiner feedback.'),
      icon: textOr(pickField(raw, 'icon', 'emoji'), '🩺')
    };
  }

  function normalizeCase(raw, idx) {
    raw = raw || {};
    var patient = raw.patient || {};
    var hidden = raw.hiddenProfile || raw.hidden_profile || {};
    var rubric = raw.rubric || {};
    return {
      id: textOr(pickField(raw, 'id'), 'case-' + (idx + 1)),
      title: textOr(pickField(raw, 'title', 'name'), 'Case ' + (idx + 1)),
      specialty: textOr(pickField(raw, 'specialty', 'category'), 'General'),
      difficulty: textOr(pickField(raw, 'difficulty', 'level'), 'Intermediate'),
      patient: {
        name: textOr(pickField(patient, 'name', 'displayName'), 'Patient'),
        age: Number(pickField(patient, 'age')) || 40,
        gender: (pickField(patient, 'gender', 'sex') || 'male').toLowerCase() === 'female' ? 'female' : 'male',
        avatarSeed: textOr(pickField(patient, 'avatarSeed', 'avatar_seed'), 'osce-' + idx),
        opening: textOr(pickField(patient, 'opening', 'greeting'),
          'Hello doctor, thank you for seeing me.')
      },
      hiddenProfile: {
        diagnosis: hidden.diagnosis || '',
        keySymptoms: hidden.keySymptoms || hidden.key_symptoms || [],
        redFlags: hidden.redFlags || hidden.red_flags || [],
        pastHistory: hidden.pastHistory || hidden.past_history || [],
        vitalSigns: hidden.vitalSigns || hidden.vital_signs || ''
      },
      rubric: {
        mustAsk: rubric.mustAsk || rubric.must_ask || [],
        bonus: rubric.bonus || []
      }
    };
  }

  /* ── Read source data from the page ──────────────────────────── */
  function readOsceData() {
    var data = { config: {}, cases: [] };
    try { if (typeof OSCE_CONFIG !== 'undefined') data.config = OSCE_CONFIG; } catch (_) {}
    if (!data.config || !Object.keys(data.config).length) data.config = window.OSCE_CONFIG || {};
    try { if (typeof OSCE_CASES !== 'undefined') data.cases = OSCE_CASES; } catch (_) {}
    if (!Array.isArray(data.cases)) data.cases = window.OSCE_CASES || [];

    if ((!data.config || !Object.keys(data.config).length) || !Array.isArray(data.cases) || !data.cases.length) {
      var recovered = recoverOsceDataFromScripts();
      if (!data.config || !Object.keys(data.config).length) data.config = recovered.config || {};
      if (!Array.isArray(data.cases) || !data.cases.length) data.cases = recovered.cases || [];
    }
    data.config = normalizeConfig(data.config);
    data.cases = (data.cases || []).map(function (c, i) { return normalizeCase(c, i); });
    return data;
  }

  function recoverOsceDataFromScripts() {
    // Mirrors written-engine.js:189 — parses inline <script> blocks if globals are missing.
    var recovered = { config: {}, cases: [] };
    var scripts = document.querySelectorAll('script');
    Array.prototype.some.call(scripts, function (script) {
      var text = script.textContent || '';
      if (!text || text.indexOf('OSCE_') === -1) return false;
      recovered.config = extractConstValue(text, 'OSCE_CONFIG') || recovered.config;
      recovered.cases = extractConstValue(text, 'OSCE_CASES') || recovered.cases;
      return recovered.config && Object.keys(recovered.config).length
        && Array.isArray(recovered.cases) && recovered.cases.length;
    });
    return recovered;
  }

  function extractConstValue(text, constName) {
    // Minimal, defensive: isolates "const NAME = <value>;" and new()Function-extracts it.
    try {
      var re = new RegExp('(?:var|let|const)\\s+' + constName + '\\s*=([\\s\\S]*?);\\s*(?:/\\*\\s*\\[');
      var m = text.match(re);
      if (!m) return null;
      var val = new Function('return (' + m[1] + ')')();
      return val || null;
    } catch (_) { return null; }
  }

  /* ================================================================
     Avatar, prompt, UI, conversation, and Gemini code go here
     in subsequent tasks. The module is bootstrapped at the very
     bottom so readOsceData() runs after page constants exist.
     ================================================================ */

  /* ── Public test hooks (pure helpers, no DOM) ────────────────── */
  // Exposed so the Node unit tests and the browser test page can reach them.
  window.__OSCE_TEST_HOOKS = {
    normalizeConfig: normalizeConfig,
    normalizeCase: normalizeCase,
    slugify: slugify
    // buildAvatarParams + scoreRubric are added in later tasks.
  };

})();
```

- [ ] **Step 2: Verify the file parses (syntax check via Node)**

Run: `node --check D:\Study\Projects\QuizTool\osce-engine.js`
Expected: no output, exit code 0 (syntax OK). The IIFE references `document`/`window` but `--check` only parses, it does not run.

- [ ] **Step 3: Commit**

```bash
git add osce-engine.js
git commit -m "feat(osce): scaffold osce-engine.js with parsing layer and test hooks"
```

---

## Task 2: Procedural cartoonic avatar generator (TDD)

**Files:**
- Modify: `D:\Study\Projects\QuizTool\osce-engine.js` (insert avatar code before the test-hooks block)
- Create: `D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`
- Create: `D:\Study\Projects\QuizTool\tests\setup.js` (tiny shim that defines `window`/`document`/`localStorage` for Node)

The avatar is the most logic-heavy pure piece, so we test-drive it. It takes `(gender, age, seed)` and returns deterministic SVG parameters + the rendered SVG string. The Node tests cover parameter generation; the browser test page renders the SVG visually.

- [ ] **Step 1: Write the failing Node test for avatar determinism + gender/age steering**

Create `D:\Study\Projects\QuizTool\tests\setup.js`:

```js
// Minimal browser shim so osce-engine.js can be required in Node tests.
// Only the pure helpers are tested headlessly; DOM/UI is tested in the browser.
const _store = {};
global.localStorage = {
  getItem: (k) => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; }
};
global.window = global;
global.document = {
  currentScript: null,
  querySelectorAll: () => [],
  createElement: () => ({ setAttribute(){}, appendChild(){}, classList: {add(){}}, style:{} }),
  head: { appendChild(){} }
};
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
```

Create `D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./setup.js');
require('../osce-engine.js');

const H = global.window.__OSCE_TEST_HOOKS;

test('buildAvatarParams is deterministic for the same seed', () => {
  const a = H.buildAvatarParams('male', 55, 'robert-h');
  const b = H.buildAvatarParams('male', 55, 'robert-h');
  assert.deepEqual(a, b);
});

test('different seeds produce different avatars', () => {
  const a = H.buildAvatarParams('male', 55, 'robert-h');
  const b = H.buildAvatarParams('male', 55, 'james-k');
  assert.notDeepEqual(a, b);
});

test('child age band selects child-appropriate palette', () => {
  const child = H.buildAvatarParams('female', 8, 'kid-1');
  assert.equal(child.ageBand, 'child');
  const adult = H.buildAvatarParams('female', 30, 'adult-1');
  assert.equal(adult.ageBand, 'adult');
  const elder = H.buildAvatarParams('male', 80, 'old-1');
  assert.equal(elder.ageBand, 'elder');
});

test('gender is honored (female palettes can include hijab option, male cannot)', () => {
  const male = H.buildAvatarParams('male', 50, 'm1');
  const female = H.buildAvatarParams('female', 50, 'f1');
  assert.equal(['male','female'].includes(male.gender), true);
  assert.equal(female.gender, 'female');
  // Male avatar must never select a hijab head covering.
  assert.notEqual(male.headCovering, 'hijab');
});

test('renderAvatar returns inline SVG string containing <svg', () => {
  const params = H.buildAvatarParams('male', 55, 'robert-h');
  const svg = H.renderAvatar(params);
  assert.equal(typeof svg, 'string');
  assert.match(svg, /<svg[\s>]/);
  assert.match(svg, /<\/svg>/);
  // No external resources — must be offline-safe.
  assert.equal(svg.includes('http'), false);
  assert.equal(svg.includes('src='), false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`
Expected: FAIL — `H.buildAvatarParams is not a function` (the engine doesn't define it yet).

- [ ] **Step 3: Implement the avatar generator in osce-engine.js**

Insert this block immediately **before** the `/* ── Public test hooks */` comment block in `osce-engine.js`:

```js
  /* ================================================================
     AVATAR SYSTEM — procedural inline SVG, no external assets.
     A seeded PRNG picks from parameter tables steered by gender +
     age band, so the same case always renders the same patient.
     ================================================================ */

  // mulberry32 — tiny, fast, deterministic PRNG.
  function _mulberry32(seedStr) {
    var h = 1779033703 ^ seedStr.length;
    for (var i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function _ageBand(age) {
    if (age < 13) return 'child';
    if (age < 20) return 'teen';
    if (age < 60) return 'adult';
    return 'elder';
  }

  var SKIN_TONES = ['#FCE4D6', '#F3C9A0', '#E0AC82', '#C68658', '#9E5F32', '#6B3F1C'];
  var HAIR_COLORS = { dark: '#2B2118', brown: '#5A3A22', blonde: '#D9B26A', grey: '#B8B8B8', white: '#ECECEC', red: '#A14A23' };
  var HAIR_STYLES = {
    male:   { child: ['short','buzz','curly-short'], teen: ['short','buzz','spiky'], adult: ['short','side-part','bald'], elder: ['short','bald','side-part'] },
    female: { child: ['long','pigtails','bob'], teen: ['long','bob','ponytail'], adult: ['long','bob','bun','hijab'], elder: ['bob','bun','short'] }
  };
  var FACE_SHAPES = ['oval','round','square','heart'];
  var ACCESSORIES = { none: 0.6, glasses: 0.3, hearingAid: 0.1 }; // elder boosts hearingAid
  var EXPRESSIONS = ['neutral','concerned','tired','mild-pain'];

  function _pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function _weighted(rnd, weights) {
    var keys = Object.keys(weights), total = 0;
    keys.forEach(function (k) { total += weights[k]; });
    var r = rnd() * total, acc = 0;
    for (var i = 0; i < keys.length; i++) { acc += weights[keys[i]]; if (r <= acc) return keys[i]; }
    return keys[0];
  }

  function buildAvatarParams(gender, age, seed) {
    gender = (gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
    age = Number(age) || 40;
    var band = _ageBand(age);
    var rnd = _mulberry32(String(seed || 'x') + ':' + gender + ':' + age);

    var headCovering = 'none';
    var hairStyle = _pick(rnd, HAIR_STYLES[gender][band] || HAIR_STYLES[gender].adult);
    if (hairStyle === 'hijab') { headCovering = 'hijab'; hairStyle = 'hidden'; }
    if (hairStyle === 'bald') hairStyle = 'bald';

    var hairColorKey = band === 'child' ? _pick(rnd, ['dark','brown','blonde','red'])
                    : band === 'elder' ? _pick(rnd, ['grey','white','grey'])
                    : _pick(rnd, ['dark','brown','blonde']);
    var skin = _pick(rnd, SKIN_TONES);

    var accWeights = Object.assign({}, ACCESSORIES);
    if (band === 'elder') { accWeights.hearingAid = 0.25; accWeights.glasses = 0.4; accWeights.none = 0.35; }
    var accessory = _weighted(rnd, accWeights);

    var expression = band === 'elder' ? _pick(rnd, ['tired','concerned','mild-pain','neutral'])
                                      : _pick(rnd, EXPRESSIONS);

    return {
      gender: gender, age: age, ageBand: band,
      skin: skin, hair: HAIR_COLORS[hairColorKey], hairStyle: hairStyle,
      hairColorKey: hairColorKey, headCovering: headCovering,
      faceShape: _pick(rnd, FACE_SHAPES), accessory: accessory,
      expression: expression, seed: String(seed || 'x')
    };
  }

  function renderAvatar(p) {
    // Centered head + shoulders cartoon. All coords in a 0..200 viewBox.
    var cx = 100;
    var faceY = band => band === 'child' ? 92 : band === 'elder' ? 88 : 90;
    var faceRY = p.ageBand === 'child' ? 42 : 46;
    var faceRX = p.faceShape === 'round' ? 48 : p.faceShape === 'square' ? 50 : 44;
    var mouth = p.expression === 'mild-pain' ? '<path d="M85 122 Q100 112 115 122" />'
              : p.expression === 'concerned' ? '<path d="M85 122 Q100 116 115 122" />'
              : p.expression === 'tired' ? '<path d="M86 123 L114 123" />'
              : '<path d="M85 120 Q100 130 115 120" />';
    var brow = (p.expression === 'concerned' || p.expression === 'mild-pain')
      ? '<path d="M70 96 L88 92" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M112 92 L130 96" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : '';
    var eyes = '<circle cx="82" cy="102" r="4" fill="#2a1d12"/><circle cx="118" cy="102" r="4" fill="#2a1d12"/>';
    var glasses = p.accessory === 'glasses'
      ? '<circle cx="82" cy="102" r="12" fill="none" stroke="#2b2118" stroke-width="3"/><circle cx="118" cy="102" r="12" fill="none" stroke="#2b2118" stroke-width="3"/><line x1="94" y1="102" x2="106" y2="102" stroke="#2b2118" stroke-width="3"/>'
      : '';
    var hearingAid = p.accessory === 'hearingAid'
      ? '<circle cx="58" cy="104" r="4" fill="#c0b090"/><circle cx="142" cy="104" r="4" fill="#c0b090"/>'
      : '';

    // Hair / head covering
    var hair = '';
    if (p.headCovering === 'hijab') {
      hair = '<path d="M44 96 Q100 24 156 96 L156 150 Q130 140 100 140 Q70 140 44 150 Z" fill="#3b6b8a"/>';
    } else if (p.hairStyle === 'bald') {
      hair = '';
    } else if (p.hairStyle === 'buzz' || p.hairStyle === 'short') {
      hair = '<path d="M52 88 Q100 44 148 88 L148 80 Q100 40 52 80 Z" fill="' + p.hair + '"/>';
    } else if (p.hairStyle === 'curly-short') {
      hair = '<g fill="' + p.hair + '">' +
        '<circle cx="60" cy="74" r="10"/><circle cx="78" cy="62" r="11"/><circle cx="100" cy="58" r="12"/><circle cx="122" cy="62" r="11"/><circle cx="140" cy="74" r="10"/>' +
        '</g>';
    } else if (p.hairStyle === 'spiky') {
      hair = '<path d="M54 86 L62 56 L72 84 L82 50 L92 84 L100 48 L108 84 L118 50 L128 84 L138 56 L146 86 Q100 40 54 86 Z" fill="' + p.hair + '"/>';
    } else if (p.hairStyle === 'side-part') {
      hair = '<path d="M52 88 Q100 38 148 88 L148 96 Q120 64 100 66 Q72 70 52 96 Z" fill="' + p.hair + '"/>';
    } else if (p.hairStyle === 'bob' || p.hairStyle === 'long' || p.hairStyle === 'ponytail' || p.hairStyle === 'bun' || p.hairStyle === 'pigtails') {
      // falls beside the face
      hair = '<path d="M44 96 Q100 36 156 96 L156 150 L150 150 Q146 110 100 110 Q54 110 50 150 L44 150 Z" fill="' + p.hair + '"/>';
      if (p.hairStyle === 'bun') hair += '<circle cx="100" cy="46" r="14" fill="' + p.hair + '"/>';
      if (p.hairStyle === 'ponytail') hair += '<path d="M150 96 Q172 100 170 130 Q166 150 150 150 Z" fill="' + p.hair + '"/>';
      if (p.hairStyle === 'pigtails') {
        hair += '<circle cx="40" cy="116" r="12" fill="' + p.hair + '"/><circle cx="160" cy="116" r="12" fill="' + p.hair + '"/>';
      }
    }

    var shoulders = '<path d="M40 200 Q40 150 100 146 Q160 150 160 200 Z" fill="' + (p.gender === 'female' ? '#7a5b8a' : '#3a4a6a') + '"/>';

    return '' +
      '<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Patient avatar">' +
        shoulders +
        '<ellipse cx="' + cx + '" cy="' + faceY(p.ageBand) + '" rx="' + faceRX + '" ry="' + faceRY + '" fill="' + p.skin + '"/>' +
        hair +
        eyes + glasses + hearingAid + brow +
        '<path d="M96 110 Q100 114 104 110" stroke="#7a4a2a" stroke-width="2" fill="none"/>' + // nose
        '<path ' + (mouth.startsWith('<path') ? '' : '') + 'd="" />' + // placeholder kept for structure
        mouth +
      '</svg>';
  }
```

Now register both in the test hooks object. Replace the test-hooks block:

```js
  window.__OSCE_TEST_HOOKS = {
    normalizeConfig: normalizeConfig,
    normalizeCase: normalizeCase,
    slugify: slugify,
    buildAvatarParams: buildAvatarParams,
    renderAvatar: renderAvatar
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`
Expected: PASS — 5 tests, 0 failures. If any assertion fails, fix the parameter table in `osce-engine.js` (not the test) and re-run.

- [ ] **Step 5: Verify the SVG renders in a browser (manual smoke)**

Create a throwaway `D:\Study\Projects\QuizTool\_avatar_smoke.html`:

```html
<!DOCTYPE html><html><body>
<div id="out"></div>
<script src="osce-engine.js"></script>
<script>
var H = window.__OSCE_TEST_HOOKS;
var html = '';
[['male',55,'robert-h'],['female',8,'kid-1'],['female',70,'grace-w'],['male',30,'dan-t']].forEach(function(t){
  var p = H.buildAvatarParams(t[0],t[1],t[2]);
  html += '<div style="display:inline-block;text-align:center;width:220px">' +
          H.renderAvatar(p) + '<br><small>'+t[0]+' '+t[1]+' '+t[2]+' ('+p.hairStyle+')</small></div>';
});
document.getElementById('out').innerHTML = html;
</script>
</body></html>
```

Open it in a browser. Expected: 4 distinct cartoonic heads. Then **delete** `_avatar_smoke.html` (it's not part of the deliverable — the real visual check happens in `osce-test.html`).

- [ ] **Step 6: Commit**

```bash
git add osce-engine.js tests/setup.js tests/osce-helpers.test.js
git commit -m "feat(osce): procedural cartoonic SVG avatar generator with node tests"
```

---

## Task 3: Prompt builders — patient persona + examiner rubric

**Files:**
- Modify: `D:\Study\Projects\QuizTool\osce-engine.js` (insert before the test-hooks block)
- Modify: `D:\Study\Projects\QuizTool\tests\osce-helpers.test.js` (append tests)

Two prompts:
- **Patient persona** (`buildPatientSysPrompt`) — drives Gemini to *be* the patient, leaking ONLY what a real patient would reveal when asked, never volunteering the diagnosis. Mirrors the fixed-persona pattern in `written-engine.js:1575`.
- **Examiner rubric** (`buildExaminerUserPrompt` + fixed examiner system instruction) — scores the completed interview, strict JSON output (mirrors `written-engine.js:1584-1644` grading methodology).

- [ ] **Step 1: Append failing tests for the prompt builders**

Append to `tests/osce-helpers.test.js`:

```js
test('buildPatientSysPrompt never includes the diagnosis string', () => {
  const sys = H.buildPatientSysPrompt({
    patient: { name: 'Mr. X', age: 55, gender: 'male' },
    hiddenProfile: { diagnosis: 'Stable angina pectoris', keySymptoms: ['substernal pressure'], redFlags: ['diaphoresis'], pastHistory: ['hypertension'], vitalSigns: 'BP 148/92' }
  });
  assert.equal(sys.toLowerCase().includes('stable angina'), false, 'system prompt must not leak the diagnosis');
  assert.match(sys, /first[\s-]person/i);
  assert.match(sys, /Mr\. X/);
});

test('buildPatientSysPrompt instructs the model not to volunteer the diagnosis', () => {
  const sys = H.buildPatientSysPrompt({ patient: { name: 'P', age: 40, gender: 'female' }, hiddenProfile: { diagnosis: 'D', keySymptoms: [], redFlags: [], pastHistory: [] } });
  assert.match(sys, /do not volunteer|never reveal|must not name/i);
});

test('buildExaminerUserPrompt includes the rubric mustAsk items and the transcript', () => {
  const prompt = H.buildExaminerUserPrompt(
    { title: 'Chest Pain', rubric: { mustAsk: ['SOCRATES', 'risk factors'], bonus: ['family hx'] } },
    [{ role: 'user', text: 'Tell me about the pain.' }, { role: 'model', text: 'It is pressing.' }]
  );
  assert.match(prompt, /SOCRATES/);
  assert.match(prompt, /Tell me about the pain/);
  assert.match(prompt, /It is pressing/);
});

test('scoreRubric parses strict JSON and clamps score 0-100', () => {
  const good = JSON.stringify({ score: 87, passed: true, asked: ['SOCRATES'], missed: ['family hx'], feedback: 'Strong interview.' });
  assert.deepEqual(H.scoreRubric(good), { score: 87, passed: true, asked: ['SOCRATES'], missed: ['family hx'], feedback: 'Strong interview.' });
  // Out-of-range input is clamped, invalid JSON returns null.
  assert.equal(H.scoreRubric('not json'), null);
  const over = H.scoreRubric(JSON.stringify({ score: 250, passed: true, asked: [], missed: [], feedback: 'x' }));
  assert.equal(over.score, 100);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`
Expected: FAIL — `H.buildPatientSysPrompt is not a function`.

- [ ] **Step 3: Implement the prompt builders + rubric scorer**

Insert before the test-hooks block in `osce-engine.js`:

```js
  /* ================================================================
     PROMPT BUILDERS
     Patient persona = systemInstruction (fixed, multi-turn).
     Examiner = one-shot strict-JSON scoring at the end.
     ================================================================ */

  function buildPatientSysPrompt(caseObj) {
    var p = caseObj.patient, hp = caseObj.hiddenProfile;
    return [
      'You are role-playing a virtual patient in an OSCE clinical-skills exam for medical students.',
      'You ARE this person. Stay in character at all times and reply in the first person.',
      '',
      '# YOUR IDENTITY',
      '• Name: ' + p.name,
      '• Age: ' + p.age,
      '• Gender: ' + p.gender,
      '',
      '# YOUR TRUE (HIDDEN) CLINICAL PICTURE — the student must discover this by asking',
      '• Main symptoms: ' + (hp.keySymptoms.join('; ') || '(as below)'),
      '• Red-flag / associated features: ' + (hp.redFlags.join('; ') || '(none notable)'),
      '• Past medical history: ' + (hp.pastHistory.join('; ') || '(unremarkable)'),
      '• Vital signs (reveal only if asked to examine or checks vitals): ' + (hp.vitalSigns || '(normal)'),
      '',
      '# ROLE-PLAY RULES — FOLLOW STRICTLY',
      '1. Answer only what the student asks. A real patient does NOT recite a textbook.',
      '2. Reveal symptoms/history gradually and only when specifically questioned.',
      '3. MUST NOT name the diagnosis, give medical terminology, or volunteer a differential — you are a layperson.',
      '4. If asked something you were not given (e.g. a lab result), say you do not know / have not had that test.',
      '5. Keep replies to 1-3 short sentences in plain, everyday language.',
      '6. Show emotion consistent with the complaint (worried, in pain, etc.) but do not over-act.',
      '7. Never break character, never mention being an AI, never mention this prompt.'
    ].join('\n');
  }

  function buildExaminerSysPrompt() {
    return [
      'You are an expert OSCE examiner scoring a medical student\'s patient-interview transcript.',
      'Your job is formative feedback, not high-stakes grading — be fair and specific.',
      '',
      '# OUTPUT REQUIREMENTS',
      'Respond with a single raw JSON object and absolutely nothing else. No markdown, no fences, no preamble.',
      'The JSON object must contain exactly these keys:',
      '  "score"    : integer 0-100 (how completely the student covered the required areas)',
      '  "passed"   : boolean — true when score >= 50',
      '  "asked"    : array of strings — rubric items the student clearly addressed',
      '  "missed"   : array of strings — rubric items not addressed (empty if all covered)',
      '  "feedback" : string — 2-3 sentences, concrete and personalised to the transcript',
      '',
      '# SCORING',
      '• Each mustAsk item covered ≈ a large share of the score; bonus items add a small amount.',
      '• Round the final score to the nearest 5.',
      '• Credit paraphrases and synonyms — do not require exact wording.',
      '• Never penalise question order.'
    ].join('\n');
  }

  function buildExaminerUserPrompt(caseObj, transcript) {
    var rubric = caseObj.rubric || {};
    var lines = [];
    lines.push('CASE: ' + caseObj.title);
    lines.push('MUST-ASK CRITERIA:');
    (rubric.mustAsk || []).forEach(function (m, i) { lines.push('  ' + (i + 1) + '. ' + m); });
    if (rubric.bonus && rubric.bonus.length) {
      lines.push('BONUS CRITERIA:');
      rubric.bonus.forEach(function (m, i) { lines.push('  ' + (i + 1) + '. ' + m); });
    }
    lines.push('');
    lines.push('INTERVIEW TRANSCRIPT (user = student, model = patient):');
    transcript.forEach(function (t) {
      lines.push((t.role === 'user' ? 'Student: ' : 'Patient: ') + t.text);
    });
    lines.push('');
    lines.push('Score this transcript against the criteria. Return the JSON object only.');
    return lines.join('\n');
  }

  function scoreRubric(raw) {
    // Defensive JSON parse + shape validation. Returns null on any failure.
    var obj = null;
    try { obj = JSON.parse(raw); } catch (_) { return null; }
    if (!obj || typeof obj !== 'object') return null;
    var score = parseInt(obj.score, 10);
    if (isNaN(score)) return null;
    score = Math.max(0, Math.min(100, score));
    function arrOf(v) { return Array.isArray(v) ? v.map(String) : []; }
    return {
      score: score,
      passed: !!obj.passed,
      asked: arrOf(obj.asked),
      missed: arrOf(obj.missed),
      feedback: textOr(obj.feedback, '')
    };
  }
```

Update the test-hooks object to include the three new functions:

```js
  window.__OSCE_TEST_HOOKS = {
    normalizeConfig: normalizeConfig,
    normalizeCase: normalizeCase,
    slugify: slugify,
    buildAvatarParams: buildAvatarParams,
    renderAvatar: renderAvatar,
    buildPatientSysPrompt: buildPatientSysPrompt,
    buildExaminerSysPrompt: buildExaminerSysPrompt,
    buildExaminerUserPrompt: buildExaminerUserPrompt,
    scoreRubric: scoreRubric
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`
Expected: PASS — 9 tests total, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add osce-engine.js tests/osce-helpers.test.js
git commit -m "feat(osce): patient persona + examiner rubric prompt builders with tests"
```

---

## Task 4: Gemini request layer (patient reply + examiner scoring)

**Files:**
- Modify: `D:\Study\Projects\QuizTool\osce-engine.js`

Port `requestGeminiChat` + `tryGeminiChatRequests` from `ai-assistant-engine.js:199-273` and add the one-shot scorer call. No tests here (network code is not unit-tested in this codebase — verified end-to-end in `osce-test.html`).

- [ ] **Step 1: Implement the Gemini transport layer**

Insert before the test-hooks block in `osce-engine.js`:

```js
  /* ================================================================
     GEMINI TRANSPORT — duplicated from ai-assistant-engine.js by
     convention (engines do not share a module). Multi-turn chat for
     the patient, one-shot for the examiner.
     ================================================================ */

  function _extractGeminiText(payload) {
    var cand = payload && payload.candidates && payload.candidates[0];
    var parts = cand && cand.content && cand.content.parts;
    if (!parts || !parts.length) {
      var reason = cand && cand.finishReason ? ' Finish reason: ' + cand.finishReason + '.' : '';
      throw new Error('AI response did not include text.' + reason);
    }
    return parts.map(function (p) { return p.text || ''; }).join('\n').trim();
  }

  function _friendlyAiError(err) {
    return (err && err.message ? err.message : String(err || 'Unknown AI error')).replace(/\s+/g, ' ').trim();
  }

  function _buildAttempts(model) {
    var attempts = [{ model: model }];
    if (model !== MODELS[0][0]) attempts.push({ model: MODELS[0][0] });
    var lvl = _getRetryLevel();
    if (lvl === 'fast') return attempts.slice(0, 1);
    if (lvl === 'thorough') return attempts;
    return attempts.slice(0, 2);
  }

  function _requestGemini(systemPrompt, contents, apiKey, model, cancelSignal) {
    var maxWait = _getMaxWaitMs();
    var controller = new AbortController();
    var timeoutId = null, cleanup = null;
    if (maxWait > 0) timeoutId = setTimeout(function () { controller.abort(); }, maxWait);
    if (cancelSignal) {
      cleanup = function () { if (timeoutId) clearTimeout(timeoutId); controller.abort(); };
      cancelSignal.addEventListener('abort', cleanup);
    }
    var body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents,
      generationConfig: { temperature: 0.4 }  // slightly higher than grading — patient should feel alive
    };
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal
    })
      .then(function (r) { return r.text().then(function (text) {
        var payload = null; try { payload = text ? JSON.parse(text) : null; } catch (_) {}
        if (!r.ok) {
          var msg = payload && payload.error && payload.error.message ? payload.error.message : text;
          throw new Error('AI ' + model + ' returned HTTP ' + r.status + ': ' + (msg || r.statusText));
        }
        return payload;
      }); })
      .then(_extractGeminiText)
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
        if (cleanup && cancelSignal) cancelSignal.removeEventListener('abort', cleanup);
      });
  }

  function _tryRequests(systemPrompt, contents, apiKey, attempts, cancelSignal) {
    var lastError = null;
    var primary = attempts.length ? attempts[0].model : null;
    var chain = Promise.reject(new Error('AI request did not start.'));
    attempts.forEach(function (att, i) {
      chain = chain.catch(function () {
        if (cancelSignal && cancelSignal.aborted) {
          var err = new DOMException('Request cancelled.', 'AbortError');
          if (i === attempts.length - 1) throw err;
          return Promise.reject(err);
        }
        return _requestGemini(systemPrompt, contents, apiKey, att.model, cancelSignal)
          .then(function (text) {
            if (i > 0 && primary) _toast('⚠ ' + _getModelLabel(primary) + ' unavailable, using ' + _getModelLabel(att.model));
            return text;
          })
          .catch(function (e) {
            lastError = e;
            if (i === attempts.length - 1) throw lastError;
            return Promise.reject(e);
          });
      });
    });
    return chain;
  }

  // Patient reply: multi-turn. contents already includes the new student turn.
  function askPatient(caseObj, transcript, cancelSignal) {
    var apiKey = _readKey();
    var model = _getSavedModel(); if (!modelIsAvailable(model)) model = MODELS[0][0];
    var sys = buildPatientSysPrompt(caseObj);
    var contents = transcript.map(function (m) {
      return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] };
    });
    return _tryRequests(sys, contents, apiKey, _buildAttempts(model), cancelSignal);
  }

  // Examiner score: one-shot strict JSON.
  function scoreInterview(caseObj, transcript, cancelSignal) {
    var apiKey = _readKey();
    var model = _getSavedModel(); if (!modelIsAvailable(model)) model = MODELS[0][0];
    var sys = buildExaminerSysPrompt();
    var user = buildExaminerUserPrompt(caseObj, transcript);
    var contents = [{ role: 'user', parts: [{ text: user }] }];
    return _tryRequests(sys, contents, apiKey, _buildAttempts(model), cancelSignal)
      .then(function (raw) {
        // Models sometimes wrap JSON in fences despite instructions — strip them.
        var cleaned = String(raw).replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
        var parsed = scoreRubric(cleaned);
        if (!parsed) throw new Error('Examiner returned malformed feedback. Try again.');
        return parsed;
      });
  }
```

(`_toast` is implemented in Task 5; it must exist before `askPatient`/`scoreInterview` are called at runtime, which only happens in the browser.)

- [ ] **Step 2: Syntax check**

Run: `node --check D:\Study\Projects\QuizTool\osce-engine.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add osce-engine.js
git commit -m "feat(osce): Gemini transport layer — patient chat + examiner scoring"
```

---

## Task 5: UI, conversation state, settings modal, and bootstrapping

**Files:**
- Modify: `D:\Study\Projects\QuizTool\osce-engine.js`

This is the largest task. It injects all CSS, renders the case-picker screen and the conversation screen, manages conversation state, wires up the input box, settings modal (reusing the shared `gemini_api_key`), and the examiner debrief panel. All DOM-injected (matches `written-engine.js`). No new tests — verified by `osce-test.html` in Task 6.

- [ ] **Step 1: Implement the CSS injector**

Insert before the test-hooks block. This block is long but complete — no placeholders.

```js
  /* ================================================================
     UI LAYER — CSS + DOM injection + conversation state + boot.
     All markup/CSS is injected (matches written-engine.js).
     ================================================================ */

  var _cssInjected = false;
  function _injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    var st = document.createElement('style');
    st.textContent =
      ':root{--accent-dim:rgba(240,165,0,.12)}' +
      '[data-theme="light"]{--accent-dim:rgba(194,120,3,.10)}' +
      '#osce-root{position:fixed;inset:0;background:var(--bg);color:var(--text);font-family:Outfit,system-ui,sans-serif;display:flex;flex-direction:column}' +
      '#osce-root *{box-sizing:border-box}' +
      '.osce-topbar{display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}' +
      '.osce-topbar .brand{font-family:Playfair Display,serif;font-weight:700;font-size:1.05rem;flex:1}' +
      '.osce-icon-btn{background:none;border:1px solid var(--border);color:var(--text);border-radius:8px;padding:.4rem .6rem;cursor:pointer;font-size:.95rem}' +
      '.osce-icon-btn:hover{background:var(--surface2)}' +
      '.osce-screen{flex:1;overflow-y:auto;padding:1rem 1.25rem 2rem}' +
      '.osce-case-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;max-width:1100px;margin:0 auto}' +
      '.osce-case-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.1rem;cursor:pointer;transition:transform .15s,border-color .15s;display:flex;flex-direction:column;gap:.5rem}' +
      '.osce-case-card:hover{transform:translateY(-2px);border-color:var(--accent)}' +
      '.osce-case-card .ct{font-weight:600;font-size:1.02rem}' +
      '.osce-case-card .cm{font-size:.82rem;color:var(--text-muted)}' +
      '.osce-case-card .tags{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.3rem}' +
      '.osce-case-card .tag{font-size:.7rem;background:var(--surface2);border:1px solid var(--border);padding:.15rem .45rem;border-radius:999px;color:var(--text-muted)}' +
      // Conversation screen
      '.osce-convo{display:flex;flex-direction:column;height:100%}' +
      '.osce-patient-bar{display:flex;align-items:center;gap:.9rem;padding:.8rem 1.1rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}' +
      '.osce-avatar{width:54px;height:54px;border-radius:50%;background:var(--surface2);border:2px solid var(--border);overflow:hidden;flex-shrink:0}' +
      '.osce-avatar svg{width:100%;height:100%;display:block}' +
      '.osce-patient-meta .pn{font-weight:600;font-size:.95rem}' +
      '.osce-patient-meta .ps{font-size:.75rem;color:var(--text-muted)}' +
      '.osce-back{font-size:1.2rem;cursor:pointer;background:none;border:none;color:var(--text-muted)}' +
      '.osce-transcript{flex:1;overflow-y:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.6rem;max-width:820px;margin:0 auto;width:100%}' +
      '.osce-msg{max-width:80%;padding:.6rem .9rem;border-radius:14px;font-size:.9rem;line-height:1.5;animation:osceFade .2s ease;unicode-bidi:plaintext}' +
      '.osce-msg.patient{align-self:flex-start;background:var(--surface2);border:1px solid var(--border);border-bottom-left-radius:4px}' +
      '.osce-msg.student{align-self:flex-end;background:var(--accent-dim);border:1px solid rgba(240,165,0,.25);border-bottom-right-radius:4px}' +
      '.osce-msg .lbl{font-size:.68rem;font-weight:600;opacity:.55;margin-bottom:2px}' +
      '.osce-thinking{align-self:flex-start;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:.7rem .9rem}' +
      '.osce-thinking .dots{display:inline-flex;gap:4px}' +
      '.osce-thinking .dots span{width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:osceBounce 1.2s infinite}' +
      '.osce-thinking .dots span:nth-child(2){animation-delay:.2s}.osce-thinking .dots span:nth-child(3){animation-delay:.4s}' +
      '.osce-error{margin:0 auto;background:var(--wrong-bg,rgba(218,54,51,.12));color:var(--wrong,#da3633);border-radius:8px;padding:.5rem .8rem;font-size:.82rem;max-width:820px;display:none}' +
      '.osce-error.show{display:block}' +
      '.osce-input-wrap{display:flex;gap:.5rem;padding:.8rem 1.25rem;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0}' +
      '.osce-input-wrap textarea{flex:1;resize:none;min-height:42px;max-height:100px;padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.9rem;outline:none}' +
      '.osce-input-wrap textarea:focus{border-color:var(--accent)}' +
      '.osce-send{padding:.6rem 1rem;border-radius:10px;border:none;background:var(--accent);color:#000;font-weight:600;cursor:pointer;white-space:nowrap}' +
      '.osce-send:disabled{opacity:.5;cursor:not-allowed}' +
      '.osce-submit-link{padding:.6rem 1rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-weight:600;cursor:pointer;font-size:.85rem}' +
      '@keyframes osceFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
      '@keyframes osceBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}' +
      // Debrief panel
      '.osce-debrief{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:none;align-items:center;justify-content:center;padding:1rem}' +
      '.osce-debrief.open{display:flex}' +
      '.osce-debrief-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:min(640px,96vw);max-height:90vh;overflow-y:auto;padding:1.4rem}' +
      '.osce-debrief-card h3{margin:0 0 .3rem;font-size:1.1rem}' +
      '.osce-score{font-size:2.6rem;font-weight:700;line-height:1}' +
      '.osce-score.pass{color:var(--correct,#2ea043)}.osce-score.fail{color:var(--wrong,#da3633)}' +
      '.osce-debrief-card h4{margin:1rem 0 .3rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}' +
      '.osce-debrief-card ul{margin:0;padding-left:1.2rem;font-size:.88rem;line-height:1.6}' +
      '.osce-debrief-card .dx{background:var(--accent-dim);border:1px solid rgba(240,165,0,.25);border-radius:10px;padding:.7rem .9rem;font-size:.9rem;margin:.6rem 0}' +
      '.osce-debrief-card .actions{display:flex;gap:.5rem;margin-top:1.2rem}' +
      '.osce-debrief-card .actions button{flex:1;padding:.6rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-weight:600}' +
      '.osce-debrief-card .actions .primary{background:var(--accent);color:#000;border:none}' +
      // Settings modal (reuses ai-assistant-engine visual language)
      '.osce-settings{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9100;display:none;align-items:center;justify-content:center;padding:1rem}' +
      '.osce-settings.open{display:flex}' +
      '.osce-settings-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(420px,96vw);padding:1.3rem}' +
      '.osce-settings-card label{display:block;font-size:.82rem;font-weight:600;margin:.8rem 0 .25rem}' +
      '.osce-settings-card input,.osce-settings-card select{width:100%;padding:.55rem .7rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.85rem;outline:none}' +
      '.osce-settings-card .row{display:flex;gap:.5rem;margin-top:1rem}' +
      '.osce-settings-card button{flex:1;padding:.55rem;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:.85rem}' +
      '.osce-settings-card .primary{background:var(--accent);color:#000}' +
      '.osce-settings-card .secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border)}' +
      '.osce-note{font-size:.75rem;color:var(--text-muted);margin-top:.3rem}';
    document.head.appendChild(st);
  }

  function _toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);color:var(--text);padding:.6rem 1rem;border-radius:10px;font-size:.85rem;z-index:9200;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  function _md(text) {
    if (!text) return '';
    var h = String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\n/g, '<br>');
    return h;
  }
```

- [ ] **Step 2: Implement state, render, and conversation handlers**

Continue inserting before the test-hooks block:

```js
  /* ── State ─────────────────────────────────────────────────── */
  var _data = null;          // {config, cases}
  var _activeCase = null;    // current normalized case object
  var _transcript = [];      // [{role:'user'|'model', text}]
  var _abort = null;         // AbortController for in-flight request

  /* ── Boot ──────────────────────────────────────────────────── */
  function boot() {
    _data = readOsceData();
    _injectCSS();
    _ensureRoot();
    _applyTheme();
    _renderCasePicker();
  }

  function _ensureRoot() {
    var root = document.getElementById('osce-root');
    if (!root) { root = document.createElement('div'); root.id = 'osce-root'; document.body.appendChild(root); }
    return root;
  }

  function _applyTheme() {
    var t = localStorage.getItem(STORAGE.theme) || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }

  /* ── Case picker screen ────────────────────────────────────── */
  function _renderCasePicker() {
    var root = _ensureRoot();
    var cards = _data.cases.map(function (c, i) {
      var avatar = renderAvatar(buildAvatarParams(c.patient.gender, c.patient.age, c.patient.avatarSeed));
      return '<div class="osce-case-card" data-i="' + i + '">' +
        '<div style="width:64px;height:64px;margin:0 auto">' + avatar + '</div>' +
        '<div class="ct">' + _esc(c.title) + '</div>' +
        '<div class="cm">' + _esc(c.patient.name) + ' • ' + c.patient.age + 'y • ' + _esc(c.specialty) + '</div>' +
        '<div class="tags">' +
          '<span class="tag">' + _esc(c.difficulty) + '</span>' +
          '<span class="tag">' + _esc(c.specialty) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
    root.innerHTML =
      '<div class="osce-topbar">' +
        '<span class="brand">🩺 ' + _esc(_data.config.title) + '</span>' +
        '<button class="osce-icon-btn" id="osce-settings-btn">⚙</button>' +
      '</div>' +
      '<div class="osce-screen">' +
        '<p style="max-width:1100px;margin:0 auto 1.2rem;color:var(--text-muted);font-size:.88rem">' + _esc(_data.config.description) + '</p>' +
        '<div class="osce-case-grid">' + cards + '</div>' +
      '</div>';
    root.querySelectorAll('.osce-case-card').forEach(function (card) {
      card.addEventListener('click', function () { _openCase(Number(card.getAttribute('data-i'))); });
    });
    document.getElementById('osce-settings-btn').addEventListener('click', _openSettings);
  }

  /* ── Conversation screen ───────────────────────────────────── */
  function _openCase(i) {
    _activeCase = _data.cases[i];
    _transcript = [{ role: 'model', text: _activeCase.patient.opening }];
    var p = _activeCase.patient;
    var avatar = renderAvatar(buildAvatarParams(p.gender, p.age, p.avatarSeed));
    var root = _ensureRoot();
    root.innerHTML =
      '<div class="osce-convo">' +
        '<div class="osce-patient-bar">' +
          '<button class="osce-back" id="osce-back">‹</button>' +
          '<div class="osce-avatar">' + avatar + '</div>' +
          '<div class="osce-patient-meta">' +
            '<div class="pn">' + _esc(p.name) + '</div>' +
            '<div class="ps">' + p.age + 'y • ' + _esc(p.gender) + ' • ' + _esc(_activeCase.specialty) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="osce-transcript" id="osce-transcript"></div>' +
        '<div class="osce-error" id="osce-error"></div>' +
        '<div class="osce-input-wrap">' +
          '<textarea id="osce-input" placeholder="Ask the patient a question..." rows="1"></textarea>' +
          '<button class="osce-submit-link" id="osce-submit" title="Get examiner feedback">Submit ✓</button>' +
          '<button class="osce-send" id="osce-send">Send</button>' +
        '</div>' +
      '</div>';
    document.getElementById('osce-back').addEventListener('click', function () { _cancelPending(); _renderCasePicker(); });
    document.getElementById('osce-send').addEventListener('click', _onSend);
    document.getElementById('osce-submit').addEventListener('click', _onSubmit);
    var input = document.getElementById('osce-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _onSend(); }
    });
    input.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(100, this.scrollHeight) + 'px'; });
    _renderTranscript();
    input.focus();
  }

  function _renderTranscript() {
    var box = document.getElementById('osce-transcript');
    if (!box) return;
    box.innerHTML = _transcript.map(function (m) {
      return '<div class="osce-msg ' + (m.role === 'model' ? 'patient' : 'student') + '">' +
        '<div class="lbl">' + (m.role === 'model' ? '🧑‍⚕️ Patient' : 'You') + '</div>' +
        '<div>' + _md(m.text) + '</div>' +
      '</div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function _showThinking(show) {
    var box = document.getElementById('osce-transcript');
    if (!box) return;
    var ex = document.getElementById('osce-thinking');
    if (show && !ex) {
      var d = document.createElement('div');
      d.className = 'osce-thinking'; d.id = 'osce-thinking';
      d.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
      box.appendChild(d); box.scrollTop = box.scrollHeight;
    } else if (!show && ex) { ex.remove(); }
  }

  function _setError(msg) {
    var e = document.getElementById('osce-error');
    if (!e) return;
    if (msg) { e.textContent = '⚠ ' + msg; e.className = 'osce-error show'; }
    else { e.className = 'osce-error'; }
  }

  function _onSend() {
    var input = document.getElementById('osce-input');
    var text = (input.value || '').trim();
    if (!text) return;
    if (!_hasApiKey()) { _toast('Configure your Gemini API key in ⚙ Settings first'); _openSettings(); return; }
    input.value = ''; input.style.height = 'auto';
    _transcript.push({ role: 'user', text: text });
    _renderTranscript();
    document.getElementById('osce-send').disabled = true;
    _setError('');
    _showThinking(true);
    _abort = new AbortController();
    askPatient(_activeCase, _transcript, _abort.signal)
      .then(function (reply) {
        _showThinking(false);
        _transcript.push({ role: 'model', text: reply });
        _renderTranscript();
      })
      .catch(function (err) {
        _showThinking(false);
        _setError(_friendlyAiError(err));
        // roll back the unanswered student turn so the transcript stays coherent
        if (_transcript.length && _transcript[_transcript.length - 1].role === 'user') _transcript.pop();
        _renderTranscript();
      })
      .finally(function () {
        document.getElementById('osce-send').disabled = false;
        var inp = document.getElementById('osce-input'); if (inp) inp.focus();
      });
  }

  function _onSubmit() {
    if (!_hasApiKey()) { _toast('Configure your Gemini API key in ⚙ Settings first'); _openSettings(); return; }
    if (_transcript.filter(function (m) { return m.role === 'user'; }).length === 0) {
      _toast('Ask the patient at least one question first.'); return;
    }
    _cancelPending();
    _showDebriefLoading();
    _abort = new AbortController();
    scoreInterview(_activeCase, _transcript, _abort.signal)
      .then(function (result) { _showDebrief(result); })
      .catch(function (err) { _hideDebrief(); _setError('Examiner feedback failed: ' + _friendlyAiError(err)); });
  }

  function _cancelPending() {
    if (_abort) { try { _abort.abort(); } catch (_) {} _abort = null; }
    _showThinking(false);
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Debrief panel ─────────────────────────────────────────── */
  function _showDebriefLoading() {
    _ensureRoot();
    var d = document.getElementById('osce-debrief');
    if (!d) {
      d = document.createElement('div'); d.id = 'osce-debrief'; d.className = 'osce-debrief open';
      document.body.appendChild(d);
    } else { d.className = 'osce-debrief open'; }
    d.innerHTML = '<div class="osce-debrief-card"><div class="osce-thinking"><span class="dots"><span></span><span></span><span></span></span> &nbsp;Examiner is reviewing your interview…</div></div>';
  }

  function _hideDebrief() {
    var d = document.getElementById('osce-debrief'); if (d) d.className = 'osce-debrief';
  }

  function _showDebrief(result) {
    var d = document.getElementById('osce-debrief');
    var hp = _activeCase.hiddenProfile;
    var cls = result.passed ? 'pass' : 'fail';
    var asked = (result.asked.length ? result.asked : ['(none matched)']).map(function (x) { return '<li>' + _esc(x) + '</li>'; }).join('');
    var missed = (result.missed.length ? result.missed : ['(nothing missed — excellent)']).map(function (x) { return '<li>' + _esc(x) + '</li>'; }).join('');
    d.innerHTML =
      '<div class="osce-debrief-card">' +
        '<h3>📋 Examiner Feedback</h3>' +
        '<div class="osce-score ' + cls + '">' + result.score + '<span style="font-size:1rem;color:var(--text-muted)">/100</span></div>' +
        '<div style="font-size:.82rem;color:var(--text-muted);margin-top:.2rem">' + (result.passed ? '✓ Passed' : '✗ Below pass mark') + '</div>' +
        '<p style="margin:.7rem 0 0;font-size:.9rem;line-height:1.6">' + _esc(result.feedback) + '</p>' +
        '<div class="dx"><strong>🩺 Hidden diagnosis:</strong> ' + _esc(hp.diagnosis || '(not specified)') + '</div>' +
        '<h4>✓ You covered</h4><ul>' + asked + '</ul>' +
        '<h4>✗ You missed</h4><ul>' + missed + '</ul>' +
        '<div class="actions">' +
          '<button id="osce-debrief-close">Back to patient</button>' +
          '<button class="primary" id="osce-debrief-new">New case</button>' +
        '</div>' +
      '</div>';
    document.getElementById('osce-debrief-close').addEventListener('click', _hideDebrief);
    document.getElementById('osce-debrief-new').addEventListener('click', function () { _hideDebrief(); _renderCasePicker(); });
  }

  /* ── Settings modal ────────────────────────────────────────── */
  function _openSettings() {
    _injectCSS();
    var ex = document.getElementById('osce-settings');
    if (ex) { ex.className = 'osce-settings open'; _syncSettings(); return; }
    var s = document.createElement('div'); s.id = 'osce-settings'; s.className = 'osce-settings open';
    s.innerHTML =
      '<div class="osce-settings-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">' +
          '<h3 style="margin:0">⚙ AI Settings</h3>' +
          '<button class="osce-icon-btn" id="osce-settings-close">✕</button>' +
        '</div>' +
        '<label for="osce-key">Gemini API Key</label>' +
        '<input id="osce-key" type="password" placeholder="Enter your Gemini API key">' +
        '<div class="osce-note">Free key at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent)">AI Studio</a>. Shared with all QuizTool engines.</div>' +
        '<label for="osce-model">Model</label>' +
        '<select id="osce-model"></select>' +
        '<div class="row">' +
          '<button class="secondary" id="osce-test">Test</button>' +
          '<button class="primary" id="osce-save">Save</button>' +
        '</div>' +
        '<div class="osce-note" id="osce-settings-status"></div>' +
      '</div>';
    document.body.appendChild(s);
    var sel = s.querySelector('#osce-model');
    MODELS.forEach(function (m) { var o = document.createElement('option'); o.value = m[0]; o.textContent = m[1]; sel.appendChild(o); });
    s.querySelector('#osce-settings-close').addEventListener('click', function () { s.className = 'osce-settings'; });
    s.querySelector('#osce-save').addEventListener('click', function () {
      var v = s.querySelector('#osce-key').value.trim();
      localStorage.setItem(STORAGE.apiKey, v ? _obfuscate(v) : '');
      localStorage.setItem(STORAGE.model, sel.value);
      _toast(v ? 'Settings saved.' : 'API key cleared.');
      s.className = 'osce-settings';
    });
    s.querySelector('#osce-test').addEventListener('click', function () {
      var v = s.querySelector('#osce-key').value.trim();
      var st = s.querySelector('#osce-settings-status');
      if (!v) { st.textContent = '✗ No key entered.'; return; }
      st.textContent = 'Testing…';
      fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': v } })
        .then(function (r) { return r.json(); })
        .then(function (data) { st.textContent = (data && data.models && data.models.length) ? '✓ Key valid (' + data.models.length + ' models).' : '✗ Unexpected response.'; })
        .catch(function () { st.textContent = '✗ Connection failed.'; });
    });
    s.addEventListener('click', function (e) { if (e.target === s) s.className = 'osce-settings'; });
    _syncSettings();
  }

  function _syncSettings() {
    var s = document.getElementById('osce-settings'); if (!s) return;
    var key = s.querySelector('#osce-key'); if (key) key.value = _readKey();
    var sel = s.querySelector('#osce-model');
    if (sel) { var m = _getSavedModel(); if (modelIsAvailable(m)) sel.value = m; }
  }

  /* ── Public API + boot on DOM ready ────────────────────────── */
  window.OsceSimulator = {
    boot: boot,
    openSettings: _openSettings,
    hasApiKey: _hasApiKey
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
```

- [ ] **Step 3: Syntax check**

Run: `node --check D:\Study\Projects\QuizTool\osce-engine.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add osce-engine.js
git commit -m "feat(osce): conversation UI, debrief panel, settings modal, boot"
```

---

## Task 6: Browser test page (osce-test.html) + hub registration

**Files:**
- Create: `D:\Study\Projects\QuizTool\osce-test.html`
- Modify: `D:\Study\Projects\QuizTool\index.html` (add OSCE entry to `QUIZZES`)

The test page mirrors `flashcard-test.html` exactly (theme bootstrap, SW, markers, self-locating loader) and carries two sample cases that exercise different genders + age bands. It also runs the Node assertions inline as a smoke check (so opening the page in a browser self-verifies the pure helpers without needing the API key).

- [ ] **Step 1: Create the test page with two sample cases**

Create `D:\Study\Projects\QuizTool\osce-test.html`:

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function(){var t=localStorage.getItem('quiz-theme')||'dark';var s=document.createElement('style');s.textContent='html,body{background:'+(t==='light'?'#f3f0eb':'#0d1117')+';color:'+(t==='light'?'#1c1917':'#e6edf3')+';margin:0;padding:0;height:100%}';document.head.appendChild(s)})();
</script>
<title>OSCE Virtual Patient — Test</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="favicon.svg">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</head>
<body>
<script>
/* ────────────────────────────────────────────────────────────────
   OSCE VIRTUAL PATIENT DATA — only edit below this line
   ──────────────────────────────────────────────────────────────────*/

/* [OSCE_CONFIG_START] */
const OSCE_CONFIG = {
  uid: "osce_test_cases",
  title: "OSCE Virtual Patient — Test",
  description: "Practice history-taking with AI virtual patients. Two cases for testing: adult male (cardiology) and pediatric female (respiratory).",
  icon: "🩺"
};
/* [OSCE_CONFIG_END] */

/* ─────────────────────────────────────────────────────────────────
   OSCE_CASES ARRAY
   Each case:
   {
     id, title, specialty, difficulty,
     patient:   { name, age, gender, avatarSeed, opening },
     hiddenProfile: { diagnosis, keySymptoms[], redFlags[], pastHistory[], vitalSigns },
     rubric:    { mustAsk[], bonus[] }
   }
   ──────────────────────────────────────────────────────────────────*/
/* [OSCE_CASES_START] */
const OSCE_CASES = [
  {
    id: "case-001",
    title: "Chest Pain in a 55-Year-Old Man",
    specialty: "Cardiology",
    difficulty: "Intermediate",
    patient: {
      name: "Mr. Robert Hayes",
      age: 55,
      gender: "male",
      avatarSeed: "robert-hayes",
      opening: "Doctor, I've been getting this awful pressure in my chest for the last two days... it really scares me."
    },
    hiddenProfile: {
      diagnosis: "Stable angina pectoris",
      keySymptoms: ["substernal pressing chest pain", "brought on by exertion", "relieved by rest within 5 minutes"],
      redFlags: ["diaphoresis during episodes", "mild radiation to the left arm", "no pain at rest"],
      pastHistory: ["hypertension for 10 years", "former smoker (quit 3 years ago, 20 pack-years)"],
      vitalSigns: "BP 148/92, HR 88, afebrile, SpO2 98% on room air"
    },
    rubric: {
      mustAsk: ["SOCRATES characterization of the pain", "cardiac risk factors (smoking, HTN, family hx, diabetes)", "associated symptoms", "relieving/worsening factors", "onset and duration"],
      bonus: ["current medications", "exercise tolerance / functional status"]
    }
  },
  {
    id: "case-002",
    title: "Wheezy 6-Year-Old Girl",
    specialty: "Pediatrics",
    difficulty: "Foundational",
    patient: {
      name: "Emma (with her mother)",
      age: 6,
      gender: "female",
      avatarSeed: "emma-kiddo",
      opening: "(mother speaking) She's been coughing all night and wheezing, doctor. It always happens when she catches a cold."
    },
    hiddenProfile: {
      diagnosis: "Viral-induced wheeze / childhood asthma exacerbation",
      keySymptoms: ["wheeze", "nighttime cough", "triggered by upper-respiratory infections"],
      redFlags: ["no speech difficulty", "no cyanosis", "mild increased work of breathing"],
      pastHistory: ["two similar episodes last winter", "eczema", "father has childhood asthma"],
      vitalSigns: "RR 32, SpO2 95% room air, afebrile, mild subcostal recession"
    },
    rubric: {
      mustAsk: ["onset and pattern of wheeze", "triggers (URTI, exercise, allergens)", "atopic history (eczema, asthma, allergies in family)", "red-flag screening (cyanosis, speech, feeding)", "response to any inhaler"],
      bonus: ["feeding / hydration status", "immunisation status"]
    }
  }
];
/* [OSCE_CASES_END] */
</script>
<script>
/* Engine loader — computes correct relative path for any folder depth */
(function () {
  window.__OSCE_ENGINE_BASE = '../'.repeat(
    Math.max(0, location.pathname.split('/').filter(Boolean).length - 2)
  );
  document.write('<scr' + 'ipt src="' + window.__OSCE_ENGINE_BASE + 'osce-engine.js"><\/scr' + 'ipt>');
})();

/* Inline self-test of the pure helpers — runs on page load so opening the
   page in a browser verifies the engine loaded and the pure logic is sound.
   Does NOT require an API key. Network/AI behaviour is tested manually. */
window.addEventListener('load', function () {
  setTimeout(function () {
    var H = window.__OSCE_TEST_HOOKS;
    if (!H) { console.error('[osce-test] __OSCE_TEST_HOOKS missing — engine failed to load'); return; }
    var failures = 0;
    function check(name, cond) {
      if (cond) { console.log('%c[osce-test] ✓ ' + name, 'color:#2ea043'); }
      else { console.error('[osce-test] ✗ ' + name); failures++; }
    }
    try {
      var a = H.buildAvatarParams('male', 55, 'x');
      var b = H.buildAvatarParams('male', 55, 'x');
      check('avatar determinism', JSON.stringify(a) === JSON.stringify(b));
      check('avatar has svg', H.renderAvatar(a).indexOf('<svg') !== -1);
      var sys = H.buildPatientSysPrompt({
        patient: { name: 'T', age: 40, gender: 'male' },
        hiddenProfile: { diagnosis: 'SECRET-DX', keySymptoms: [], redFlags: [], pastHistory: [] }
      });
      check('sys prompt hides diagnosis', sys.indexOf('SECRET-DX') === -1);
      var r = H.scoreRubric(JSON.stringify({ score: 150, passed: true, asked: [], missed: [], feedback: 'x' }));
      check('score clamped to 100', r && r.score === 100);
    } catch (e) { console.error('[osce-test] helper check threw', e); failures++; }
    console.log(failures === 0 ? '%c[osce-test] All inline checks passed ✅' : ('%c[osce-test] ' + failures + ' check(s) FAILED', 'color:#' + (failures ? 'da3633' : '2ea043'));
  }, 300);
});
</script>
</body>
</html>
```

- [ ] **Step 2: Add the OSCE entry to the QuizTool hub**

In `D:\Study\Projects\QuizTool\index.html`, locate the `📝 Written Maker` entry (around line 136-143) and insert this new entry immediately **after** it (so OSCE sits with the other clinical tools):

```js
  {
    uid: "",
    title: "🩺 OSCE Patient Simulator",
    description: "Practice history-taking with AI-driven cartoonic virtual patients across genders and ages. Conversation-style, with examiner feedback.",
    icon: "🩺",
    tags: ["Tool", "OSCE", "AI", "New ✨"],
    url: "osce-test.html"
  },
```

- [ ] **Step 3: Run the full Node test suite (regression check)**

Run: `node --test D:\Study\Projects\QuizTool\tests\osce-helpers.test.js`
Expected: PASS — 9 tests, 0 failures. (Confirms nothing in Task 5/6 broke the pure helpers.)

- [ ] **Step 4: Manual browser verification of the test page**

Open `D:\Study\Projects\QuizTool\osce-test.html` in a browser (double-click, or `python -m http.server` from the repo root and visit `/osce-test.html`).

Expected:
1. Case picker shows two cards with **distinct cartoonic avatars** (adult male cardiology + young girl pediatrics). Open DevTools console — you should see `[osce-test] ✓ ...` lines and `All inline checks passed ✅`.
2. Click a case → conversation screen with the avatar, patient opening line, input box.
3. Click ⚙ → paste a real Gemini key → Save. (Get one at https://aistudio.google.com/apikey)
4. Type a question (e.g. "Can you describe the pain?") → patient replies in first person within a few seconds.
5. Click **Submit ✓** → examiner debrief modal appears with a 0-100 score, covered/missed items, feedback, and the revealed diagnosis.
6. Toggle light/dark via `localStorage.setItem('quiz-theme','light')` + reload — theme renders correctly.

If any step fails, fix in `osce-engine.js` (not the test) and re-verify.

- [ ] **Step 5: Commit**

```bash
git add osce-test.html index.html
git commit -m "feat(osce): browser test page with two sample cases + hub registration"
```

---

## Task 7: Propagate engine to the Tauri generator (AGENTS.md §19, §23)

**Files:**
- Modify: `D:\Study\Projects\QuizTool\tauri\src\engines.rs` (add constant)
- Modify: `D:\Study\Projects\QuizTool\tauri\src\generator.rs` (emit `osce-engine.js` into generated ZIPs)

AGENTS.md §23 is explicit: "After modifying any engine file, propagate it to `tauri/src/engines.rs`". This keeps generated projects able to include OSCE files. This task is mechanical — it mirrors exactly how `WRITTEN_ENGINE_JS` is wired (engines.rs:12 + wherever generator.rs writes engine files).

- [ ] **Step 1: Inspect how an existing engine constant is consumed**

Read `D:\Study\Projects\QuizTool\tauri\src\engines.rs:1-14` (the constant declarations — already viewed during planning).
Then find every reference to `WRITTEN_ENGINE_JS` in `generator.rs`:

Run: `grep -n "WRITTEN_ENGINE_JS" D:\Study\Projects\QuizTool\tauri\src\generator.rs`

You will see lines like `("written-engine.js", WRITTEN_ENGINE_JS)` in a list of engine files to write into the ZIP. **Add an identical entry for OSCE immediately after each written-engine entry**, and add the constant declaration.

- [ ] **Step 2: Add the OSCE_ENGINE_JS constant**

In `D:\Study\Projects\QuizTool\tauri\src\engines.rs`, add this line immediately after the `WRITTEN_ENGINE_JS` declaration (line 12):

```rust
pub const OSCE_ENGINE_JS: &str = include_str!("../../osce-engine.js");
```

- [ ] **Step 3: Wire the constant into the generator's file list**

In `generator.rs`, for **each** `(filename, constant)` pair where `filename == "written-engine.js"`, add a matching pair `(String::from("osce-engine.js"), OSCE_ENGINE_JS.to_string())` right after it. Add `use crate::engines::OSCE_ENGINE_JS;` to the imports if the file uses explicit imports (it already imports the other engine constants the same way — match that style).

- [ ] **Step 4: Verify the Tauri generator still compiles**

Run from `D:\Study\Projects\QuizTool\tauri`:
`cargo check`
Expected: compiles cleanly (no errors). Warnings about unused code are acceptable ONLY if they are pre-existing — a new unused-constant warning for `OSCE_ENGINE_JS` means Step 3 was incomplete; fix it.

- [ ] **Step 5: Commit**

```bash
git add tauri/src/engines.rs tauri/src/generator.rs
git commit -m "feat(tauri): propagate osce-engine.js into generated project ZIPs"
```

---

## Task 8: Documentation — update AGENTS.md

**Files:**
- Modify: `D:\Study\Projects\QuizTool\AGENTS.md`

AGENTS.md is the canonical reference ("Read this before touching any file"). A new engine must be registered in §3 (the engines table), §5 (file schemas), §19 (adding tools — confirm OSCE followed the recipe), §20 (dependency map). Keep edits surgical — only OSCE additions.

- [ ] **Step 1: Add OSCE to the engines table (§3)**

In the §3 table (after the `ai-assistant-engine.js` row), add:

```markdown
| `osce-engine.js` | OSCE virtual-patient HTML files | Conversation-style history-taking with AI virtual patients; rubric-based examiner feedback |
```

Update the §1 "Release" line and §3 intro "8 engines" → "9 engines" (two text occurrences — grep to find both: `grep -n "8 engines" AGENTS.md`).

- [ ] **Step 2: Add the OSCE file schema (§5)**

Add a new `### 5e. OSCE Virtual Patient File Schema` subsection at the end of §5 (after 5d), documenting the `OSCE_CONFIG`, `OSCE_CASES`, `patient`, `hiddenProfile`, `rubric` shapes exactly as implemented (copy the JSDoc-style block from `osce-engine.js`'s header comment + the case example from `osce-test.html`).

- [ ] **Step 3: Confirm §19 compliance + add to §20 dependency map**

In §19 ("Adding a New Tool"), the OSCE engine already follows the recipe — no code change needed, but add a one-line note under §19 referencing OSCE as a worked example. In §20's dependency map, add:

```text
osce-test.html → osce-engine.js (loads via __OSCE_ENGINE_BASE)
osce-engine.js → Gemini generateContent (patient chat + examiner scoring)
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: register osce-engine in AGENTS.md (engines, schema, dep map)"
```

---

## Self-Review (completed during planning)

**1. Spec coverage** — Every user requirement mapped:
- *"OSCE virtual patient simulator"* → Tasks 1-6 (full engine + UI).
- *"same UI design as other parts"* → Task 5 CSS uses the project's exact CSS variables + Outfit/Playfair fonts + card/transcript/modal patterns cloned from written-engine/ai-assistant-engine. ✅
- *"conversation style"* → Task 5 `_onSend`/`_renderTranscript`, Task 4 `askPatient` multi-turn chat. ✅
- *"beautiful graphics and patient cartoonic designs"* → Task 2 procedural inline-SVG avatar system. ✅
- *"multiple for each gender and age"* → Task 2 `HAIR_STYLES[gender][ageBand]`, skin/hair/accessory tables, seeded variation → many distinct avatars per gender×age. Tests assert child/teen/adult/elder bands. ✅
- *"AI powered by Gemini as other parts"* → Task 4 ports the exact `requestGeminiChat`/obfuscation/`gemini_api_key` pattern. ✅
- *"test html page that uses the engine"* → Task 6 `osce-test.html` with 2 cases + inline self-checks. ✅

**2. Placeholder scan** — No TBD/TODO/"add error handling"/"similar to Task N". Every code step contains full, runnable code. ✅

**3. Type consistency** — `buildAvatarParams`/`renderAvatar`/`buildPatientSysPrompt`/`buildExaminerUserPrompt`/`scoreRubric`/`askPatient`/`scoreInterview` signatures are identical across the task that defines them and the tasks that call them. The test-hooks object in Task 5 still lists all helpers (it's appended cumulatively). The `caseObj`/`transcript`/`patient` shapes match between `normalizeCase` (Task 1) and the prompt builders (Task 3) and `osce-test.html` (Task 6). ✅

**Scope check:** This is one cohesive subsystem (a single engine + its test page + propagation). Not split-worthy.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-18-osce-virtual-patient-simulator.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
