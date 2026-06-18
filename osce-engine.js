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
