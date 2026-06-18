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
    var faceYFor = function (band) { return band === 'child' ? 92 : band === 'elder' ? 88 : 90; };
    var faceRY = p.ageBand === 'child' ? 42 : 46;
    var faceRX = p.faceShape === 'round' ? 48 : p.faceShape === 'square' ? 50 : 44;
    var mouth = p.expression === 'mild-pain' ? '<path d="M85 122 Q100 112 115 122" stroke="#7a2a2a" stroke-width="3" fill="none" stroke-linecap="round"/>'
              : p.expression === 'concerned' ? '<path d="M85 122 Q100 116 115 122" stroke="#5a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/>'
              : p.expression === 'tired' ? '<path d="M86 123 L114 123" stroke="#5a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/>'
              : '<path d="M85 120 Q100 130 115 120" stroke="#5a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/>';
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
        '<ellipse cx="' + cx + '" cy="' + faceYFor(p.ageBand) + '" rx="' + faceRX + '" ry="' + faceRY + '" fill="' + p.skin + '"/>' +
        hair +
        eyes + glasses + hearingAid + brow +
        '<path d="M96 110 Q100 114 104 110" stroke="#7a4a2a" stroke-width="2" fill="none"/>' + // nose
        mouth +
      '</svg>';
  }

  /* ================================================================
     Prompt, UI, conversation, and Gemini code go here
     in subsequent tasks. The module is bootstrapped at the very
     bottom so readOsceData() runs after page constants exist.
     ================================================================ */

  /* ── Public test hooks (pure helpers, no DOM) ────────────────── */
  // Exposed so the Node unit tests and the browser test page can reach them.
  window.__OSCE_TEST_HOOKS = {
    normalizeConfig: normalizeConfig,
    normalizeCase: normalizeCase,
    slugify: slugify,
    buildAvatarParams: buildAvatarParams,
    renderAvatar: renderAvatar
  };

})();
