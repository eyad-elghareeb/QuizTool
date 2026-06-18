/* ================================================================
   osce-engine.js  —  Standalone OSCE Virtual Patient Simulator.
   Consumes OSCE_CONFIG and OSCE_CASES from OSCE HTML files.
   PLAB 2–style: station door card, 8-min timer, domain-scored
   examiner feedback. Conversation-driven history-taking via Gemini.
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
    retryLevel: 'gemini_retry_level',
    session: 'osce_session_'
  };

  var MAX_TURNS = 30;
  var WARN_TURNS = 25;
  var EXAM_TIME = 480; // 8 minutes in seconds

  /* ── Models ─────────────────────────────────────────────────── */
  var MODELS = [
    ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite (default, fast & modern)'],
    ['gemma-4-26b-a4b-it', 'Gemma 4 26B IT (open model, strong & free)'],
    ['gemma-4-31b-it', 'Gemma 4 31B IT (larger open model)'],
    ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite (older, deprecating soon)'],
    ['gemini-2.5-flash', 'Gemini 2.5 Flash (older, deprecating soon)']
  ];

  /* ── Obfuscation ────────────────────────────────────────────── */
  var _OK = [0x71, 0x75, 0x69, 0x7A, 0x74, 0x6F, 0x6F, 0x6C];

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

  /* ── Helpers ────────────────────────────────────────────────── */
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

  function _addLink(rel, href, extra) {
    var link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (extra) {
      Object.keys(extra).forEach(function (key) { link[key] = extra[key]; });
    }
    document.head.appendChild(link);
  }

  /* ── Config + case normalization ────────────────────────────── */
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
      task: textOr(pickField(raw, 'task', 'instructions'), 'Take a focused history from this patient.'),
      time: Number(pickField(raw, 'time')) || EXAM_TIME,
      patient: {
        name: textOr(pickField(patient, 'name', 'displayName'), 'Patient'),
        age: Number(pickField(patient, 'age')) || 40,
        gender: (pickField(patient, 'gender', 'sex') || 'male').toLowerCase() === 'female' ? 'female' : 'male',
        avatarSeed: textOr(pickField(patient, 'avatarSeed', 'avatar_seed'), 'osce-' + idx),
        opening: textOr(pickField(patient, 'opening', 'greeting'), 'Hello doctor, thank you for seeing me.')
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

  /* ── Read source data from the page ─────────────────────────── */
  function readOsceData() {
    var config = null, caseObj = null;
    try { if (typeof OSCE_CONFIG !== 'undefined') config = OSCE_CONFIG; } catch (_) {}
    if (!config || !Object.keys(config).length) config = window.OSCE_CONFIG || {};
    try { if (typeof OSCE_CASE !== 'undefined') caseObj = OSCE_CASE; } catch (_) {}
    if (!caseObj) { try { if (typeof OSCE_CASES !== 'undefined') caseObj = OSCE_CASES[0]; } catch (_) {} }
    if (!caseObj) caseObj = recoverOsceCaseFromScripts();
    config = normalizeConfig(config);
    caseObj = normalizeCase(caseObj, 0);
    return { config: config, case: caseObj };
  }

  function recoverOsceCaseFromScripts() {
    var scripts = document.querySelectorAll('script');
    var result = null;
    Array.prototype.some.call(scripts, function (script) {
      var text = script.textContent || '';
      if (!text || text.indexOf('OSCE_') === -1) return false;
      try {
        var re = /(?:var|let|const)\s+OSCE_CASE\s*=([\s\S]*?);\s*(?:\/\*\s*\[)/;
        var m = text.match(re);
        if (m) { result = new Function('return (' + m[1] + ')')(); return !!result; }
        re = /(?:var|let|const)\s+OSCE_CASES\s*=([\s\S]*?);\s*(?:\/\*\s*\[)/;
        m = text.match(re);
        if (m) { var arr = new Function('return (' + m[1] + ')')(); result = Array.isArray(arr) ? arr[0] : null; return !!result; }
      } catch (_) {}
      return false;
    });
    return result;
  }

  /* ================================================================
     AVATAR SYSTEM — procedural inline SVG, no external assets.
     ================================================================ */

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
  var FACE_SHAPES = ['oval','round','square'];

  function _faceYFor(band) { return band === 'child' ? 92 : band === 'elder' ? 88 : 90; }
  var ACCESSORIES = { none: 0.6, glasses: 0.3, hearingAid: 0.1 };
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
    var bandLabel = p.ageBand === 'elder' ? 'Older adult' : p.ageBand === 'child' ? 'Child' : p.ageBand === 'teen' ? 'Teenager' : 'Adult';
    var accent = p.gender === 'female' ? '#b35c8a' : '#2f7fb9';
    var muted = p.ageBand === 'elder' ? '#d1d5db' : p.skin;
    return '' +
      '<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Patient identity card">' +
        '<rect x="18" y="18" width="164" height="174" rx="22" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.18)" stroke-width="2"/>' +
        '<rect x="34" y="34" width="132" height="30" rx="15" fill="' + accent + '" opacity=".9"/>' +
        '<circle cx="100" cy="104" r="38" fill="' + muted + '" opacity=".9"/>' +
        '<path d="M54 170 Q60 135 100 135 Q140 135 146 170 Z" fill="' + accent + '" opacity=".75"/>' +
        '<path d="M74 104 Q100 78 126 104" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="8" stroke-linecap="round"/>' +
        '<circle cx="84" cy="108" r="4" fill="rgba(0,0,0,.45)"/><circle cx="116" cy="108" r="4" fill="rgba(0,0,0,.45)"/>' +
        '<path d="M82 126 Q100 134 118 126" fill="none" stroke="rgba(0,0,0,.38)" stroke-width="4" stroke-linecap="round"/>' +
        '<text x="100" y="55" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fff">PATIENT</text>' +
        '<text x="100" y="185" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="currentColor">' + bandLabel + '</text>' +
      '</svg>';
  }

  /* ================================================================
     PROMPT BUILDERS
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
      'Provide structured formative feedback across four domains.',
      '',
      '# OUTPUT REQUIREMENTS',
      'Respond with a single raw JSON object and absolutely nothing else. No markdown, no fences, no preamble.',
      'The JSON object must contain exactly these keys:',
      '  "score"      : integer 0-100 (overall performance, rounded to nearest 5)',
      '  "passed"     : boolean — true when score >= 50',
      '  "domains"    : object with 4 sub-scores — { "communication": 0-25, "infoGathering": 0-25, "clinicalReasoning": 0-25, "professionalism": 0-25 }',
      '  "asked"      : array of strings — rubric items the student clearly addressed',
      '  "missed"     : array of strings — rubric items not addressed (empty if all covered)',
      '  "feedback"   : string — 2-3 sentences, concrete and personalised to the transcript',
      '',
      '# DOMAIN DESCRIPTIONS',
      '• Communication (0-25): Greeting, introductions, open-to-closed questioning, active listening, empathy, summarising.',
      '• Information Gathering (0-25): Systematic history, SOCRATES for pain, past medical hx, drug hx, social hx, FH.',
      '• Clinical Reasoning (0-25): Appropriate focus, recognising red flags, differential thinking.',
      '• Professionalism (0-25): Respect, confidentiality, not interrupting, explaining plans.',
      '',
      '# SCORING',
      '• Each mustAsk item covered ≈ a large share of the score; bonus items add a small amount.',
      '• Credit paraphrases and synonyms — do not require exact wording.',
      '• Never penalise question order.',
      '• Domain scores should sum to approximately the overall score.'
    ].join('\n');
  }

  function buildExaminerUserPrompt(caseObj, transcript) {
    var rubric = caseObj.rubric || {};
    var lines = [];
    lines.push('CASE: ' + caseObj.title);
    lines.push('CASE TASK: ' + (caseObj.task || 'Take a focused history.'));
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
    var obj = null;
    try { obj = JSON.parse(raw); } catch (_) { return null; }
    if (!obj || typeof obj !== 'object') return null;
    var score = parseInt(obj.score, 10);
    if (isNaN(score)) return null;
    score = Math.max(0, Math.min(100, score));
    function arrOf(v) { return Array.isArray(v) ? v.map(String) : []; }
    function clamp25(v) {
      var n = parseInt(v, 10);
      if (isNaN(n)) return 0;
      return Math.max(0, Math.min(25, n));
    }
    var domains = obj.domains || {};
    return {
      score: score,
      passed: !!obj.passed,
      domains: {
        communication: clamp25(domains.communication),
        infoGathering: clamp25(domains.infoGathering || domains.info_gathering),
        clinicalReasoning: clamp25(domains.clinicalReasoning || domains.clinical_reasoning),
        professionalism: clamp25(domains.professionalism)
      },
      asked: arrOf(obj.asked),
      missed: arrOf(obj.missed),
      feedback: textOr(obj.feedback, '')
    };
  }

  /* ================================================================
     GEMINI TRANSPORT
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
      generationConfig: { temperature: 0.4 }
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

  function askPatient(caseObj, transcript, cancelSignal) {
    var apiKey = _readKey();
    var model = _getSavedModel(); if (!modelIsAvailable(model)) model = MODELS[0][0];
    var sys = buildPatientSysPrompt(caseObj);
    var contents = transcript.map(function (m) {
      return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] };
    });
    return _tryRequests(sys, contents, apiKey, _buildAttempts(model), cancelSignal);
  }

  function scoreInterview(caseObj, transcript, cancelSignal) {
    var apiKey = _readKey();
    var model = _getSavedModel(); if (!modelIsAvailable(model)) model = MODELS[0][0];
    var sys = buildExaminerSysPrompt();
    var user = buildExaminerUserPrompt(caseObj, transcript);
    var contents = [{ role: 'user', parts: [{ text: user }] }];
    return _tryRequests(sys, contents, apiKey, _buildAttempts(model), cancelSignal)
      .then(function (raw) {
        var cleaned = String(raw).replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
        var parsed = scoreRubric(cleaned);
        if (!parsed) throw new Error('Examiner returned malformed feedback. Try again.');
        return parsed;
      });
  }

  /* ================================================================
     UI LAYER — Premium medical OSCE design
     ================================================================ */

  var _cssInjected = false;
  function _injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    var st = document.createElement('style');
    st.textContent =
      ':root{--bg:#0d1117;--surface:#161b22;--surface2:#1c2330;--surface3:#101722;--border:#30363d;--text:#e6edf3;--text-muted:#8b949e;--accent:#f0a500;--accent-dim:rgba(240,165,0,.1);--correct:#2ea043;--wrong:#da3633;--flagged:#58a6ff;--medical:#38bdf8;--plab:#8b5cf6;--radius:10px;--radius-sm:8px;--shadow:0 12px 36px rgba(0,0,0,.34);--shadow-lg:0 18px 54px rgba(0,0,0,.48);--radius-btn:8px;--ease-out:cubic-bezier(0.16,1,0.3,1);--transition:0.18s cubic-bezier(0.16,1,0.3,1)}' +
      '[data-theme="light"]{--bg:#f3f0eb;--surface:#ffffff;--surface2:#f8f6f1;--surface3:#ffffff;--border:#d0ccc5;--text:#1c1917;--text-muted:#78716c;--accent:#c27803;--accent-dim:rgba(194,120,3,.1);--correct:#16a34a;--wrong:#dc2626;--flagged:#2563eb;--medical:#0284c7;--plab:#7c3aed;--shadow:0 12px 32px rgba(28,25,23,.1);--shadow-lg:0 18px 54px rgba(28,25,23,.16)}' +
      '#osce-root{position:fixed;inset:0;background:var(--bg);color:var(--text);font-family:Inter,Outfit,system-ui,-apple-system,sans-serif;display:flex;flex-direction:column}' +
      '#osce-root *{box-sizing:border-box}' +
      '@keyframes slideDown{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}' +
      '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}' +
      '@keyframes timerUrgent{0%,100%{color:var(--wrong,#da3633);transform:scale(1)}50%{color:#ff4444;transform:scale(1.06)}}' +
      '@keyframes barFill{from{width:0%}}' +
      '@keyframes floatIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes ripple{to{transform:scale(5);opacity:0}}' +
      '.osce-icon-btn{width:36px;height:36px;border-radius:var(--radius-sm);background:var(--surface2);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all var(--transition)}' +
      '.osce-icon-btn:hover{color:var(--text);border-color:var(--accent);background:var(--accent-dim)}' +
      '.osce-icon-btn:active{transform:scale(.87);transition-duration:.08s}' +
      '.osce-primary-btn,.osce-secondary-btn{min-height:40px;padding:.65rem 1rem;border-radius:var(--radius-btn);font-weight:800;font-size:.85rem;cursor:pointer;transition:transform var(--transition),border-color var(--transition),background var(--transition);position:relative;overflow:hidden}.osce-primary-btn{border:0;background:var(--accent);color:#000}.osce-secondary-btn{border:1px solid var(--border);background:var(--surface2);color:var(--text)}.osce-primary-btn:hover,.osce-secondary-btn:hover{transform:translateY(-1px)}.osce-secondary-btn:hover{border-color:var(--accent)}' +
      '.osce-door-shell{min-height:100%;display:grid;place-items:center;padding:1.25rem;background:var(--bg)}' +
      '.osce-door{width:min(980px,100%);display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:1rem;animation:fadeUp .25s var(--ease-out)}' +
      '.osce-door-left,.osce-door-main{background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow)}' +
      '.osce-door-left{padding:1rem;display:flex;flex-direction:column;gap:.85rem}.osce-door-main{padding:1.1rem}' +
      '.osce-door-kicker{font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:.4rem}.osce-door-title{font-size:1.45rem;font-weight:900;line-height:1.14;margin:0 0 .35rem}.osce-door-sub{font-size:.86rem;color:var(--text-muted);line-height:1.5;margin:0 0 1rem}' +
      '.osce-door-meta{display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin:.9rem 0}.osce-door-stat{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.65rem}.osce-door-stat .k{font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);font-weight:800}.osce-door-stat .v{font-size:.9rem;font-weight:850;margin-top:.2rem}' +
      '.osce-door-task{background:var(--surface2);border:1px solid var(--border);border-left:4px solid var(--medical);border-radius:8px;padding:.85rem;font-size:.93rem;line-height:1.55;margin:0 0 1rem}.osce-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin:.9rem 0}.osce-flow-step{border:1px solid var(--border);background:var(--surface2);border-radius:8px;padding:.55rem;font-size:.72rem;font-weight:800;color:var(--text-muted)}.osce-flow-step span{display:block;color:var(--text);font-size:.82rem;margin-bottom:.12rem}.osce-door-actions{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-top:1rem}' +
      '.osce-convo{display:grid;grid-template-rows:auto auto 1fr auto;height:100%;min-height:0;position:relative}' +
      '.osce-station-bar{display:flex;align-items:center;gap:.85rem;padding:.75rem 1.1rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}' +
      '.osce-case-chip{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);background:var(--accent-dim);border:1px solid rgba(240,165,0,.28);border-radius:999px;padding:.22rem .52rem;white-space:nowrap}' +
      '.osce-station-title{min-width:0;flex:1}.osce-station-title .name{font-weight:800;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.osce-station-title .task{font-size:.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}' +
      '.osce-station-actions{display:flex;gap:.4rem;align-items:center}' +
      '.osce-timer{font-variant-numeric:tabular-nums;font-weight:800;font-size:1.15rem;letter-spacing:0;font-family:Inter,Outfit,system-ui,-apple-system,sans-serif;flex-shrink:0;min-width:60px;text-align:center;transition:color .3s ease}' +
      '.osce-timer.ok{color:var(--correct)}' +
      '.osce-timer.warn{color:var(--accent)}' +
      '.osce-timer.danger{animation:timerUrgent .8s infinite;font-weight:800}' +
      '.osce-timer-label{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);text-align:center;line-height:1}' +
      '.osce-timer-wrap{display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0;padding:0 .2rem}' +
      '.osce-room{min-height:0;display:grid;grid-template-columns:minmax(230px,300px) minmax(0,1fr);gap:0;overflow:hidden}' +
      '.osce-patient-panel{background:var(--surface2);border-right:1px solid var(--border);padding:1rem;display:flex;flex-direction:column;gap:.8rem;min-height:0}' +
      '.osce-patient-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.8rem;box-shadow:var(--shadow)}' +
      '.osce-patient-id{display:grid;grid-template-columns:76px minmax(0,1fr);gap:.75rem;align-items:center}.osce-patient-id .av-mini{width:76px;height:82px;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:var(--surface3)}.osce-patient-id .av-mini svg{width:100%;height:100%;display:block}.osce-patient-id .pn{font-weight:800;font-size:.95rem;line-height:1.2}.osce-patient-id .ps{font-size:.76rem;color:var(--text-muted);margin-top:.18rem;line-height:1.45}' +
      '.osce-door-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.85rem}.osce-door-card .label,.osce-mission .label,.osce-structure .label{font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:.35rem}.osce-door-card .prompt{font-size:.88rem;line-height:1.5;color:var(--text)}' +
      '.osce-mission{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.85rem}.osce-mission-row{display:flex;align-items:center;justify-content:space-between;font-size:.78rem;color:var(--text-muted);margin:.34rem 0}.osce-mission-row strong{color:var(--text);font-variant-numeric:tabular-nums}.osce-xp{height:7px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:.55rem}.osce-xp-fill{height:100%;width:0%;background:linear-gradient(90deg,var(--medical),var(--accent));transition:width .28s var(--ease-out)}' +
      '.osce-structure{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.85rem}.osce-structure-list{display:grid;gap:.34rem}.osce-structure-item{display:flex;align-items:center;gap:.45rem;font-size:.75rem;color:var(--text-muted)}.osce-structure-item:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--border);flex:0 0 auto}.osce-structure-item.active{color:var(--text);font-weight:750}.osce-structure-item.active:before{background:var(--accent)}' +
      '.osce-coach{display:flex;flex-wrap:wrap;gap:.38rem}.osce-chip{border:1px solid var(--border);background:var(--surface);color:var(--text-muted);border-radius:999px;padding:.28rem .5rem;font-size:.72rem;font-weight:650;cursor:pointer;transition:all var(--transition)}.osce-chip:hover{border-color:var(--accent);color:var(--text);background:var(--accent-dim)}' +
      '.osce-chat-zone{min-height:0;display:grid;grid-template-rows:1fr auto auto;background:linear-gradient(180deg,var(--bg),var(--surface3))}' +
      '.osce-transcript{overflow-y:auto;padding:1rem 1.15rem;display:flex;flex-direction:column;gap:.65rem;max-width:880px;margin:0 auto;width:100%}' +
      '.osce-msg{max-width:min(78%,660px);padding:.62rem .82rem;font-size:.9rem;line-height:1.55;animation:fadeUp .22s var(--ease-out);unicode-bidi:plaintext;position:relative;border-radius:8px}' +
      '.osce-msg .lbl{font-size:.62rem;font-weight:800;opacity:.75;margin-bottom:4px;letter-spacing:.05em;text-transform:uppercase}' +
      '.osce-msg.patient{align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--medical);box-shadow:0 2px 10px rgba(0,0,0,.12)}' +
      '.osce-msg.patient .lbl{color:var(--medical)}' +
      '.osce-msg.student{align-self:flex-end;background:var(--accent-dim);border:1px solid rgba(240,165,0,.28);box-shadow:0 2px 8px rgba(0,0,0,.08)}' +
      '.osce-msg.student .lbl{color:var(--accent)}' +
      '.osce-thinking{align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.65rem .9rem;animation:fadeUp .2s var(--ease-out)}' +
      '.osce-thinking .dots{display:inline-flex;gap:4px}' +
      '.osce-thinking .dots span{width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:bounce 1.3s infinite}' +
      '.osce-thinking .dots span:nth-child(2){animation-delay:.22s}.osce-thinking .dots span:nth-child(3){animation-delay:.44s}' +
      '.osce-error{margin:0 auto .5rem;background:rgba(218,54,51,.12);color:var(--wrong);border-radius:var(--radius-sm);padding:.5rem .8rem;font-size:.8rem;max-width:820px;width:calc(100% - 2rem);display:none;animation:fadeUp .2s var(--ease-out)}' +
      '.osce-error.show{display:block}' +
      '.osce-input-wrap{display:flex;gap:.5rem;padding:.75rem 1.1rem;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0}' +
      '.osce-input-wrap textarea{flex:1;resize:none;min-height:40px;max-height:100px;padding:.55rem .85rem;border-radius:var(--radius-sm);border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-family:Outfit,system-ui,-apple-system,sans-serif;font-size:.85rem;outline:none;transition:border-color var(--transition)}' +
      '.osce-input-wrap textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}' +
      '.osce-input-wrap textarea::placeholder{color:var(--text-muted)}' +
      '.osce-send{min-height:40px;padding:.55rem 1.1rem;border-radius:var(--radius-btn);border:none;background:var(--accent);color:#000;font-weight:700;font-size:.82rem;cursor:pointer;position:relative;overflow:hidden;transition:transform var(--transition),opacity var(--transition),box-shadow var(--transition)}' +
      '.osce-send:hover{opacity:.92;transform:translateY(-1px);box-shadow:0 4px 14px rgba(240,165,0,.25)}' +
      '.osce-send:active{transform:scale(.97) translateY(0);transition-duration:.09s}' +
      '.ripple-wave{position:absolute;border-radius:50%;background:rgba(255,255,255,.25);transform:scale(0);animation:ripple .55s var(--ease-out);pointer-events:none}' +
      '.osce-send:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}' +
      '.osce-submit-link{min-height:40px;padding:.55rem .9rem;border-radius:var(--radius-btn);border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:600;cursor:pointer;font-size:.8rem;white-space:nowrap;position:relative;overflow:hidden;transition:border-color var(--transition),color var(--transition)}' +
      '.osce-submit-link:hover{border-color:var(--medical);color:var(--medical)}' +
      '.osce-debrief{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9000;display:none;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)}' +
      '.osce-debrief.open{display:flex}' +
      '.osce-debrief-card{background:var(--surface3);border:1px solid var(--border);border-radius:12px;width:min(760px,96vw);max-height:92vh;overflow-y:auto;padding:1.35rem;backdrop-filter:blur(14px);box-shadow:var(--shadow-lg);animation:slideUp .25s ease}' +
      '.osce-debrief-card h3{margin:0 0 .3rem;font-size:1.25rem}' +
      '.osce-debrief-card .sub{font-size:.78rem;color:var(--text-muted);margin-bottom:.75rem}' +
      '.osce-debrief-score{display:flex;align-items:center;gap:1.4rem;margin:.5rem 0 1rem;padding:1rem 1.2rem;background:var(--surface2);border-radius:8px;border:1px solid var(--border)}' +
      '.osce-score-ring{width:110px;height:110px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:4px solid var(--accent);flex-shrink:0;background:var(--accent-dim)}' +
      '.osce-score-ring .num{font-size:1.6rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}' +
      '.osce-score-ring .unit{font-size:.58rem;color:var(--text-muted);letter-spacing:.03em}' +
      '.osce-score-ring.pass{border-color:var(--correct)}.osce-score-ring.pass .num{color:var(--correct)}' +
      '.osce-score-ring.fail{border-color:var(--wrong)}.osce-score-ring.fail .num{color:var(--wrong)}' +
      '.osce-verdict-text{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}' +
      '.osce-verdict-text.pass{color:var(--correct)}.osce-verdict-text.fail{color:var(--wrong)}' +
      '.osce-domain-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.75rem 0}' +
      '.osce-domain-item{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.55rem .75rem}' +
      '.osce-domain-item .dl{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:2px}' +
      '.osce-domain-item .dv{font-size:1rem;font-weight:700;font-variant-numeric:tabular-nums}' +
      '.osce-domain-item .dv.out-of{font-size:.6rem;font-weight:400;color:var(--text-muted)}' +
      '.osce-domain-bar{height:4px;border-radius:2px;background:var(--border);margin-top:4px;overflow:hidden}' +
      '.osce-domain-bar .fill{height:100%;border-radius:2px;background:var(--accent);animation:barFill .8s var(--ease-out) both}' +
      '.osce-domain-item.good .fill{background:var(--correct)}' +
      '.osce-domain-item.avg .fill{background:var(--accent)}' +
      '.osce-domain-item.low .fill{background:var(--wrong)}' +
      '.osce-debrief-card .feedback-text{margin:.3rem 0 0;font-size:.85rem;line-height:1.6;color:var(--text);padding:.7rem .9rem;background:var(--surface2);border-radius:10px;border:1px solid var(--border)}' +
      '.osce-debrief-card .dx{background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:var(--radius-sm);padding:.6rem .85rem;font-size:.85rem;margin:.65rem 0}' +
      '.osce-debrief-card .dx strong{color:var(--medical)}' +
      '.osce-debrief-card h4{margin:.9rem 0 .3rem;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted)}' +
      '.osce-debrief-card ul{margin:0;padding-left:1.2rem;font-size:.82rem;line-height:1.65;color:var(--text)}' +
      '.osce-debrief-card ul li{animation:floatIn .3s var(--ease-out) both}' +
      '.osce-debrief-card .actions{display:flex;gap:.6rem;margin-top:1.2rem}' +
      '.osce-debrief-card .actions button{flex:1;padding:.6rem .8rem;border-radius:var(--radius-btn);border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-weight:600;font-size:.82rem;position:relative;overflow:hidden;transition:border-color var(--transition),background var(--transition)}' +
      '.osce-debrief-card .actions button:hover{border-color:var(--accent)}' +
      '.osce-debrief-card .actions .primary{background:var(--accent);color:#000;border:none;position:relative;overflow:hidden}' +
      '.osce-debrief-card .actions .primary:hover{opacity:.9}' +
      '#osce-settings-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center}' +
      '#osce-settings-overlay:not(.open){display:none}' +
      '#osce-settings-modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);width:min(400px,92vw);padding:1.25rem;box-shadow:0 12px 36px rgba(0,0,0,0.5)}' +
      '#osce-settings-modal h3{margin:0 0 1rem;font-size:1rem}' +
      '#osce-settings-modal .field-label{display:block;font-size:.82rem;font-weight:600;margin-bottom:4px;color:var(--text)}' +
      '#osce-settings-modal input[type=password],#osce-settings-modal select{width:100%;padding:.5rem .7rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.85rem;outline:none}' +
      '#osce-settings-modal input:focus,#osce-settings-modal select:focus{border-color:var(--accent)}' +
      '#osce-settings-modal .field-box{margin-bottom:1rem}' +
      '#osce-settings-modal .api-row{display:flex;gap:.5rem}' +
      '#osce-settings-modal .api-row input{flex:1}' +
      '#osce-settings-modal .field-note{font-size:.75rem;color:var(--text-muted);margin-top:4px}' +
      '#osce-settings-modal .btn-row{display:flex;gap:.5rem;margin-top:.5rem}' +
      '#osce-settings-modal .btn-row button{padding:.5rem .9rem;border-radius:6px;border:none;font-size:.82rem;font-weight:600;cursor:pointer}' +
      '#osce-settings-modal .btn-primary{background:var(--accent);color:#000}' +
      '#osce-settings-modal .btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border)}' +
      '#osce-settings-modal #osce-settings-status{font-size:.8rem;margin-top:6px}' +
      '#osce-settings-modal .field-row{display:flex;gap:.5rem;align-items:center}' +
      '#osce-settings-modal .field-row select{flex:1}' +
      '.osce-toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(80px);background:var(--surface);border:1px solid var(--border);color:var(--text);padding:.65rem 1.2rem;border-radius:10px;font-size:.88rem;font-weight:500;z-index:9999;box-shadow:var(--shadow-lg);opacity:0;transition:opacity .3s ease,transform .3s ease;pointer-events:none;backdrop-filter:blur(12px)}' +
      '.osce-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.osce-time-up{background:var(--wrong);color:#fff;font-weight:700;font-size:.82rem;text-align:center;padding:.35rem;animation:pulse 1s infinite;flex-shrink:0}' +
      '.osce-timer-bar{height:3px;background:var(--border);flex-shrink:0;position:relative}' +
      '.osce-timer-bar .fill{height:100%;transition:width 1s linear,background .5s ease}' +
      '.osce-timer-bar .fill.ok{background:var(--correct)}' +
      '.osce-timer-bar .fill.warn{background:var(--accent)}' +
      '.osce-timer-bar .fill.danger{background:var(--wrong)}' +
      '@media(max-width:760px){.osce-door-shell{padding:.75rem;place-items:stretch}.osce-door{grid-template-columns:1fr}.osce-door-left{display:none}.osce-door-title{font-size:1.2rem}.osce-door-meta{grid-template-columns:1fr 1fr}.osce-flow{grid-template-columns:1fr 1fr}.osce-station-bar{padding:.65rem .75rem;gap:.55rem}.osce-case-chip{display:none}.osce-room{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.osce-patient-panel{border-right:0;border-bottom:1px solid var(--border);padding:.6rem;display:grid;grid-template-columns:1fr;gap:.5rem}.osce-patient-card,.osce-structure{display:none}.osce-door-card{padding:.65rem}.osce-door-card .prompt{font-size:.8rem}.osce-mission{padding:.6rem}.osce-coach{display:none}.osce-msg{max-width:92%;font-size:.88rem}.osce-input-wrap{padding:.65rem}.osce-submit-link{padding:.55rem .65rem}.osce-domain-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  function _addRipple(btn) {
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.addEventListener('click', function (e) {
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var x = e.clientX - rect.left - size / 2;
      var y = e.clientY - rect.top - size / 2;
      var wave = document.createElement('span');
      wave.className = 'ripple-wave';
      wave.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + x + 'px;top:' + y + 'px';
      btn.appendChild(wave);
      setTimeout(function () { if (wave.parentNode) wave.parentNode.removeChild(wave); }, 600);
    });
  }

  function _toast(msg) {
    var t = document.createElement('div');
    t.className = 'osce-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); }, 2200);
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

  /* ── State ─────────────────────────────────────────────────── */
  var _data = null;
  var _activeCase = null;
  var _activeCaseIdx = -1;
  var _transcript = [];
  var _abort = null;
  var _lastFailedText = '';
  var _timerRemaining = EXAM_TIME;
  var _timerInterval = null;
  var _timerStarted = false;

  /* ── Session persistence ────────────────────────────────────── */
  function _sessionKey() { return STORAGE.session + (_data ? _data.config.uid : 'osce'); }

  function _saveSession() {
    if (!_activeCase || !_transcript.length) return;
    try {
      var data = JSON.stringify({
        transcript: _transcript,
        timerRemaining: _timerRemaining,
        timerStarted: _timerStarted
      });
      localStorage.setItem(_sessionKey(), data);
    } catch (_) {}
  }

  function _loadSession() {
    try {
      var raw = localStorage.getItem(_sessionKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function _clearSession() {
    try { localStorage.removeItem(_sessionKey()); } catch (_) {}
  }

  /* ── Timer ──────────────────────────────────────────────────── */
  function _startTimer() {
    if (_timerStarted) return;
    _timerStarted = true;
    _timerInterval = setInterval(function () {
      _timerRemaining = Math.max(0, _timerRemaining - 1);
      _updateTimerDisplay();
      _updateTimerBar();
      if (_timerRemaining <= 0) { _onTimeUp(); }
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  }

  function _formatTime(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function _timerState(secs) {
    if (secs > 120) return 'ok';
    if (secs > 30) return 'warn';
    return 'danger';
  }

  function _stationDuration() {
    return (_activeCase && _activeCase.time) || EXAM_TIME;
  }

  function _updateTimerDisplay() {
    var el = document.getElementById('osce-timer-num');
    if (!el) return;
    el.textContent = _formatTime(_timerRemaining);
    var state = _timerState(_timerRemaining);
    el.className = 'osce-timer ' + state;
    _updateStationStats();
  }

  function _updateTimerBar() {
    var el = document.getElementById('osce-timer-bar-fill');
    if (!el) return;
    var pct = (_timerRemaining / _stationDuration()) * 100;
    el.style.width = pct + '%';
    el.className = 'fill ' + _timerState(_timerRemaining);
  }

  function _onTimeUp() {
    _stopTimer();
    _toast('⏱ Time is up! Click "Submit ✓" for examiner feedback.');
    var bar = document.getElementById('osce-time-up-bar');
    if (bar) bar.className = 'osce-time-up';
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  function boot() {
    _data = readOsceData();
    _injectCSS();
    _addLink('preconnect', 'https://fonts.googleapis.com');
    _addLink('preconnect', 'https://fonts.gstatic.com', { crossOrigin: '' });
    _addLink('stylesheet', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&display=swap');
    _ensureRoot();
    _applyTheme();
    _activeCase = _data.case;
    _activeCaseIdx = 0;
    _timerRemaining = _data.case.time || EXAM_TIME;
    var saved = _loadSession();
    if (saved && saved.transcript && saved.transcript.length && saved.transcript[0]) {
      _transcript = saved.transcript;
      _timerRemaining = saved.timerRemaining || _timerRemaining;
      _timerStarted = false;
      _openConversation();
      setTimeout(function () { _toast('📋 Session restored — continue your consultation.'); }, 500);
    } else {
      _showDoorCard();
    }
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

  /* ── Theme toggle ────────────────────────────────────────────── */
  function _toggleTheme() {
    var t = localStorage.getItem(STORAGE.theme) || 'dark';
    t = t === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE.theme, t);
    document.documentElement.setAttribute('data-theme', t);
    var el = document.getElementById('osce-theme-btn');
    if (el) el.textContent = t === 'dark' ? '☀️' : '🌙';
    var doorEl = document.getElementById('osce-door-theme');
    if (doorEl) doorEl.textContent = t === 'dark' ? '☀️' : '🌙';
  }

  function _gamifiedProgress() {
    var turns = _userTurnCount();
    var turnPct = Math.min(100, Math.round((turns / Math.max(1, WARN_TURNS)) * 100));
    var timeUsed = _stationDuration() - _timerRemaining;
    var timePct = Math.min(100, Math.max(0, Math.round((timeUsed / _stationDuration()) * 100)));
    var momentum = Math.min(100, Math.round((turnPct * 0.7) + (Math.min(timePct, 90) * 0.3)));
    return { turns: turns, turnPct: turnPct, timePct: timePct, momentum: momentum };
  }

  function _updateStationStats() {
    var p = _gamifiedProgress();
    var q = document.getElementById('osce-q-count');
    var xp = document.getElementById('osce-xp-fill');
    var used = document.getElementById('osce-time-used');
    if (q) q.textContent = p.turns + ' / ' + MAX_TURNS;
    if (xp) xp.style.width = p.momentum + '%';
    if (used) used.textContent = p.timePct + '%';
    _updateStructure();
  }

  function _insertPrompt(text) {
    var input = document.getElementById('osce-input');
    if (!input) return;
    input.value = text;
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(100, input.scrollHeight) + 'px';
  }

  function _structureStep() {
    var turns = _userTurnCount();
    if (turns < 2) return 'opening';
    if (turns < 7) return 'history';
    if (turns < 12) return 'background';
    if (turns < 17) return 'ice';
    return 'summary';
  }

  function _structureHTML() {
    var active = _structureStep();
    var steps = [
      ['opening', 'Opening', 'Introductions, consent'],
      ['history', 'HPC', 'Explore the main problem'],
      ['background', 'Background', 'PMH, drugs, family, social'],
      ['ice', 'ICE', 'Ideas, concerns, expectations'],
      ['summary', 'Close', 'Summarise and safety-net']
    ];
    return steps.map(function (s) {
      return '<div class="osce-structure-item ' + (active === s[0] ? 'active' : '') + '"><span>' + s[1] + ' - ' + s[2] + '</span></div>';
    }).join('');
  }

  function _updateStructure() {
    var el = document.getElementById('osce-structure-list');
    if (el) el.innerHTML = _structureHTML();
  }

  function _showDoorCard() {
    var p = _activeCase.patient;
    var avatar = renderAvatar(buildAvatarParams(p.gender, p.age, p.avatarSeed));
    var root = _ensureRoot();
    var durationMin = Math.floor(_stationDuration() / 60);
    var themeIcon = (localStorage.getItem(STORAGE.theme) || 'dark') === 'dark' ? '☀️' : '🌙';
    root.innerHTML =
      '<div class="osce-door-shell">' +
        '<div class="osce-door">' +
          '<aside class="osce-door-left">' +
            '<div class="osce-patient-card"><div class="osce-patient-id">' +
              '<div class="av-mini">' + avatar + '</div>' +
              '<div><div class="pn">' + _esc(p.name) + '</div><div class="ps">' + p.age + ' years • ' + _esc(p.gender) + '<br>' + _esc(_activeCase.specialty) + '</div></div>' +
            '</div></div>' +
            '<div class="osce-mission">' +
              '<div class="label">Station Rules</div>' +
              '<div class="osce-mission-row"><span>Time</span><strong>' + durationMin + ' minutes</strong></div>' +
              '<div class="osce-mission-row"><span>Mode</span><strong>History taking</strong></div>' +
              '<div class="osce-mission-row"><span>Feedback</span><strong>Examiner scorecard</strong></div>' +
            '</div>' +
          '</aside>' +
          '<main class="osce-door-main">' +
            '<div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start">' +
              '<div><div class="osce-door-kicker">PLAB 2 OSCE Simulator</div><h1 class="osce-door-title">' + _esc(_activeCase.title) + '</h1></div>' +
              '<button class="osce-icon-btn" id="osce-door-theme" title="Toggle theme">' + themeIcon + '</button>' +
            '</div>' +
            '<p class="osce-door-sub">Read the candidate instructions. The timer starts only when you enter the room.</p>' +
            '<div class="osce-door-task">' + _esc(_activeCase.task) + '</div>' +
            '<div class="osce-door-meta">' +
              '<div class="osce-door-stat"><div class="k">Patient</div><div class="v">' + _esc(p.name) + '</div></div>' +
              '<div class="osce-door-stat"><div class="k">Difficulty</div><div class="v">' + _esc(_activeCase.difficulty) + '</div></div>' +
              '<div class="osce-door-stat"><div class="k">Station</div><div class="v">' + _esc(_activeCase.specialty) + '</div></div>' +
              '<div class="osce-door-stat"><div class="k">Questions</div><div class="v">Up to ' + MAX_TURNS + '</div></div>' +
            '</div>' +
            '<div class="osce-flow">' +
              '<div class="osce-flow-step"><span>1. Open</span>Introduce, confirm identity</div>' +
              '<div class="osce-flow-step"><span>2. Explore</span>Focused history</div>' +
              '<div class="osce-flow-step"><span>3. Context</span>PMH, meds, social</div>' +
              '<div class="osce-flow-step"><span>4. ICE</span>Concerns and expectations</div>' +
              '<div class="osce-flow-step"><span>5. Close</span>Summarise clearly</div>' +
              '<div class="osce-flow-step"><span>6. Debrief</span>Submit for marking</div>' +
            '</div>' +
            '<div class="osce-door-actions">' +
              '<button class="osce-primary-btn" id="osce-start-station">Enter room</button>' +
              '<button class="osce-secondary-btn" id="osce-door-settings">AI settings</button>' +
            '</div>' +
          '</main>' +
        '</div>' +
      '</div>';
    _addRipple(document.getElementById('osce-start-station'));
    _addRipple(document.getElementById('osce-door-settings'));
    document.getElementById('osce-start-station').addEventListener('click', function () {
      _transcript = [];
      _timerRemaining = _activeCase.time || EXAM_TIME;
      _timerStarted = false;
      _openConversation();
    });
    document.getElementById('osce-door-settings').addEventListener('click', _openSettings);
    document.getElementById('osce-door-theme').addEventListener('click', _toggleTheme);
  }

  /* ── Conversation (starts immediately) ──────────────────────── */
  function _openConversation() {
    var p = _activeCase.patient;
    var avatar = renderAvatar(buildAvatarParams(p.gender, p.age, p.avatarSeed));
    var root = _ensureRoot();
    var themeIcon = (localStorage.getItem(STORAGE.theme) || 'dark') === 'dark' ? '☀️' : '🌙';
    var durationMin = Math.floor(_stationDuration() / 60);
    root.innerHTML =
      '<div class="osce-convo">' +
        '<div class="osce-station-bar">' +
          '<div class="osce-case-chip">PLAB 2 Station</div>' +
          '<div class="osce-station-title">' +
            '<div class="name">' + _esc(_activeCase.title) + '</div>' +
            '<div class="task">' + _esc(_activeCase.task) + '</div>' +
          '</div>' +
          '<div class="osce-timer-wrap">' +
            '<div class="osce-timer ' + _timerState(_timerRemaining) + '" id="osce-timer-num">' + _formatTime(_timerRemaining) + '</div>' +
            '<div class="osce-timer-label">' + durationMin + ' min</div>' +
          '</div>' +
          '<div class="osce-station-actions">' +
            '<button class="osce-icon-btn" id="osce-theme-btn" title="Toggle theme" style="width:30px;height:30px;font-size:.75rem">' + themeIcon + '</button>' +
            '<button class="osce-icon-btn" id="osce-settings-btn" title="AI Settings" style="width:30px;height:30px;font-size:.75rem">⚙</button>' +
          '</div>' +
        '</div>' +
        '<div class="osce-timer-bar" id="osce-timer-bar"><div class="fill ' + _timerState(_timerRemaining) + '" id="osce-timer-bar-fill" style="width:' + (_timerRemaining / _stationDuration() * 100) + '%"></div></div>' +
        '<div class="osce-time-up" id="osce-time-up-bar" style="display:none">⏱ Time expired — submit your consultation for feedback</div>' +
        '<div class="osce-room">' +
          '<aside class="osce-patient-panel">' +
            '<div class="osce-patient-card"><div class="osce-patient-id">' +
              '<div class="av-mini">' + avatar + '</div>' +
              '<div><div class="pn">' + _esc(p.name) + '</div><div class="ps">' + p.age + ' years • ' + _esc(p.gender) + '<br>' + _esc(_activeCase.specialty) + ' • ' + _esc(_activeCase.difficulty) + '</div></div>' +
            '</div></div>' +
            '<div class="osce-door-card"><div class="label">Candidate Instructions</div><div class="prompt">' + _esc(_activeCase.task) + '</div></div>' +
            '<div class="osce-mission">' +
              '<div class="label">Station Run</div>' +
              '<div class="osce-mission-row"><span>Questions</span><strong id="osce-q-count">0 / ' + MAX_TURNS + '</strong></div>' +
              '<div class="osce-mission-row"><span>Time used</span><strong id="osce-time-used">0%</strong></div>' +
              '<div class="osce-xp" title="Consultation momentum"><div class="osce-xp-fill" id="osce-xp-fill"></div></div>' +
            '</div>' +
            '<div class="osce-structure">' +
              '<div class="label">Consultation Map</div>' +
              '<div class="osce-structure-list" id="osce-structure-list">' + _structureHTML() + '</div>' +
            '</div>' +
            '<div class="osce-coach" aria-label="Quick question prompts">' +
              '<button class="osce-chip" data-prompt="Can you tell me more about what brought you in today?">Open</button>' +
              '<button class="osce-chip" data-prompt="When did this start, and what were you doing at the time?">Timing</button>' +
              '<button class="osce-chip" data-prompt="Does anything make it better or worse?">Triggers</button>' +
              '<button class="osce-chip" data-prompt="Do you have any medical conditions or take any regular medicines?">PMH/Meds</button>' +
              '<button class="osce-chip" data-prompt="Is there anything you are particularly worried this might be?">ICE</button>' +
            '</div>' +
          '</aside>' +
          '<main class="osce-chat-zone">' +
            '<div class="osce-transcript" id="osce-transcript"></div>' +
            '<div class="osce-error" id="osce-error"></div>' +
          '</main>' +
        '</div>' +
        '<div class="osce-input-wrap">' +
          '<textarea id="osce-input" placeholder="Ask the patient a question…" rows="1"></textarea>' +
          '<button class="osce-send" id="osce-send">Send</button>' +
          '<button class="osce-submit-link" id="osce-submit" title="Get examiner feedback">Submit</button>' +
        '</div>' +
      '</div>';
    document.getElementById('osce-theme-btn').addEventListener('click', _toggleTheme);
    document.getElementById('osce-settings-btn').addEventListener('click', _openSettings);
    _addRipple(document.getElementById('osce-send'));
    _addRipple(document.getElementById('osce-submit'));
    document.getElementById('osce-send').addEventListener('click', _onSend);
    document.getElementById('osce-submit').addEventListener('click', _onSubmit);
    Array.prototype.forEach.call(document.querySelectorAll('.osce-chip'), function (btn) {
      btn.addEventListener('click', function () { _insertPrompt(btn.getAttribute('data-prompt') || ''); });
    });
    var input = document.getElementById('osce-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _onSend(); }
    });
    input.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(100, this.scrollHeight) + 'px'; });
    _renderTranscript();
    if (!_transcript.length) {
      _transcript.push({ role: 'model', text: p.opening });
      _renderTranscript();
    }
    _updateStationStats();
    input.focus();
    _startTimer();
    _saveSession();
    document.addEventListener('keydown', _onKeyDown);
  }

  function _onKeyDown(e) {
    if (e.key === 'Escape') {
      var d = document.getElementById('osce-debrief');
      if (d && d.className.indexOf('open') !== -1) { _hideDebrief(); e.preventDefault(); return; }
      var overlay = document.getElementById('osce-settings-overlay');
      if (overlay && overlay.className.indexOf('open') !== -1) { overlay.className = ''; e.preventDefault(); return; }
    }
  }

  function _renderTranscript() {
    var box = document.getElementById('osce-transcript');
    if (!box) return;
    box.innerHTML = _transcript.map(function (m) {
      var isPatient = m.role === 'model';
      return '<div class="osce-msg ' + (isPatient ? 'patient' : 'student') + '">' +
        '<div class="lbl">' + (isPatient ? '🧑‍⚕️ Patient' : 'You') + '</div>' +
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

  function _onRetry() {
    var input = document.getElementById('osce-input');
    if (input && _lastFailedText) { input.value = _lastFailedText; input.focus(); }
  }

  function _setError(msg, showRetry) {
    var e = document.getElementById('osce-error');
    if (!e) return;
    if (msg) {
      e.className = 'osce-error show';
      e.innerHTML = '⚠ ' + _esc(msg) + (showRetry && _lastFailedText
        ? ' <button id="osce-retry-btn" style="margin-left:.5rem;padding:.15rem .5rem;border-radius:4px;border:1px solid var(--wrong);background:transparent;color:var(--wrong);cursor:pointer;font-size:.8rem">↻ Retry</button>'
        : '');
      if (showRetry) {
        var btn = document.getElementById('osce-retry-btn');
        if (btn) btn.addEventListener('click', _onRetry);
      }
    } else { e.className = 'osce-error'; }
  }

  function _userTurnCount() {
    var count = 0;
    for (var i = 0; i < _transcript.length; i++) { if (_transcript[i].role === 'user') count++; }
    return count;
  }

  function _onSend() {
    var input = document.getElementById('osce-input');
    var text = (input.value || '').trim();
    if (!text) return;
    if (!_hasApiKey()) { _toast('Configure your Gemini API key in ⚙ Settings first'); _openSettings(); return; }
    var turns = _userTurnCount();
    if (turns >= MAX_TURNS) {
      _toast('Maximum ' + MAX_TURNS + ' questions reached. Click "Submit ✓" for examiner feedback.');
      return;
    }
    if (turns >= WARN_TURNS) {
      _toast('⚠ ' + (MAX_TURNS - turns) + ' of ' + MAX_TURNS + ' questions remaining. Consider submitting for feedback.');
    }
    _lastFailedText = text;
    input.value = ''; input.style.height = 'auto';
    _transcript.push({ role: 'user', text: text });
    _renderTranscript();
    _updateStationStats();
    document.getElementById('osce-send').disabled = true;
    _setError('');
    _showThinking(true);
    _abort = new AbortController();
    askPatient(_activeCase, _transcript, _abort.signal)
      .then(function (reply) {
        _showThinking(false);
        _transcript.push({ role: 'model', text: reply });
        _renderTranscript();
        _updateQCount();
        _saveSession();
      })
      .catch(function (err) {
        _showThinking(false);
        _setError(_friendlyAiError(err), true);
        if (_transcript.length && _transcript[_transcript.length - 1].role === 'user') _transcript.pop();
        _renderTranscript();
      })
      .finally(function () {
        document.getElementById('osce-send').disabled = false;
        var inp = document.getElementById('osce-input'); if (inp) inp.focus();
      });
  }

  function _updateQCount() {
    _updateStationStats();
  }

  function _onSubmit() {
    if (!_hasApiKey()) { _toast('Configure your Gemini API key in ⚙ Settings first'); _openSettings(); return; }
    if (_transcript.filter(function (m) { return m.role === 'user'; }).length === 0) {
      _toast('Ask the patient at least one question first.'); return;
    }
    _stopTimer();
    _cancelPending();
    _showDebriefLoading();
    _abort = new AbortController();
    scoreInterview(_activeCase, _transcript, _abort.signal)
      .then(function (result) { _clearSession(); _showDebrief(result); })
      .catch(function (err) { _hideDebrief(); _setError('Examiner feedback failed: ' + _friendlyAiError(err)); });
  }

  function _cancelPending() {
    if (_abort) { try { _abort.abort(); } catch (_) {} _abort = null; }
    _showThinking(false);
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

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
    var c = _activeCase;
    var hp = c.hiddenProfile;
    var cls = result.passed ? 'pass' : 'fail';
    var band = result.score >= 80 ? 'Excellent station' : result.score >= 65 ? 'Strong pass' : result.score >= 50 ? 'Borderline pass' : result.score >= 35 ? 'Needs another run' : 'Restart recommended';
    var xp = Math.max(0, Math.min(100, result.score));

    var domainHTML = '';
    var doms = result.domains || {};
    var domainNames = [
      { key: 'communication', label: 'Communication', max: 25 },
      { key: 'infoGathering', label: 'Information Gathering', max: 25 },
      { key: 'clinicalReasoning', label: 'Clinical Reasoning', max: 25 },
      { key: 'professionalism', label: 'Professionalism', max: 25 }
    ];
    domainNames.forEach(function (dinfo) {
      var val = doms[dinfo.key] || 0;
      var pct = (val / dinfo.max) * 100;
      var barCls = pct >= 70 ? 'good' : pct >= 40 ? 'avg' : 'low';
      domainHTML +=
        '<div class="osce-domain-item ' + barCls + '">' +
          '<div class="dl">' + dinfo.label + '</div>' +
          '<div class="dv">' + val + ' <span class="out-of">/ ' + dinfo.max + '</span></div>' +
          '<div class="osce-domain-bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    });

    var asked = (result.asked.length ? result.asked : ['(none matched)']).map(function (x, i) {
      return '<li style="--i:' + i + '">' + _esc(x) + '</li>';
    }).join('');
    var missed = (result.missed.length ? result.missed : ['(nothing missed — excellent)']).map(function (x, i) {
      return '<li style="--i:' + i + '">' + _esc(x) + '</li>';
    }).join('');

    d.innerHTML =
      '<div class="osce-debrief-card">' +
        '<h3>PLAB 2 Examiner Scorecard</h3>' +
        '<div class="sub">' + _esc(c.title) + ' • ' + _esc(c.patient.name) + '</div>' +
        '<div class="osce-debrief-score">' +
          '<div class="osce-score-ring ' + cls + '"><div class="num">' + result.score + '</div><div class="unit">/ 100</div></div>' +
          '<div><div class="osce-verdict-text ' + cls + '">' + (result.passed ? '✓ Passed' : '✗ Below pass mark') + '</div>' +
          '<div style="font-size:.9rem;font-weight:800;margin-top:.18rem">' + _esc(band) + '</div>' +
          '<div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem">Station XP</div>' +
          '<div class="osce-xp" style="width:220px;max-width:48vw"><div class="osce-xp-fill" style="width:' + xp + '%"></div></div></div>' +
        '</div>' +
        '<div class="osce-domain-grid">' + domainHTML + '</div>' +
        '<div class="feedback-text">' + _md(result.feedback) + '</div>' +
        '<div class="dx"><strong>🩺 Hidden diagnosis:</strong> ' + _esc(hp.diagnosis || '(not specified)') + '</div>' +
        '<h4>✓ You covered</h4><ul>' + asked + '</ul>' +
        '<h4>✗ Areas to improve</h4><ul>' + missed + '</ul>' +
        '<div class="actions">' +
          '<button id="osce-debrief-close">Back to consultation</button>' +
          '<button class="primary" id="osce-debrief-new">New case</button>' +
        '</div>' +
      '</div>';
    _addRipple(document.getElementById('osce-debrief-close'));
    _addRipple(document.getElementById('osce-debrief-new'));
    document.getElementById('osce-debrief-close').addEventListener('click', _hideDebrief);
    document.getElementById('osce-debrief-new').addEventListener('click', function () {
      _stopTimer(); _hideDebrief(); _clearSession();
      _transcript = [];
      _timerRemaining = _activeCase.time || EXAM_TIME;
      _timerStarted = false;
      _showDoorCard();
    });
  }

  /* ── Settings (matches ai-assistant modal structure) ─────────── */
  function _renderSettingsHTML() {
    var ex = document.getElementById('osce-settings-overlay');
    if (ex) { ex.className = 'open'; _syncSettingsValues(); return; }
    var div = document.createElement('div');
    div.id = 'osce-settings-overlay';
    div.className = 'open';
    div.innerHTML =
      '<div id="osce-settings-modal">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
          '<h3 style="margin:0">⚙ AI Settings</h3>' +
          '<button class="osce-icon-btn" id="osce-settings-close" title="Close">✕</button>' +
        '</div>' +
        '<div class="field-box">' +
          '<label class="field-label" for="osce-key-input">Gemini API Key</label>' +
          '<div class="api-row">' +
            '<input id="osce-key-input" type="password" autocomplete="off" placeholder="Enter your Gemini API key">' +
          '</div>' +
          '<div class="field-note">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank">AI Studio</a>. Shared with all QuizTool engines.</div>' +
          '<div class="btn-row">' +
            '<button class="btn-primary" id="osce-key-save">Save</button>' +
            '<button class="btn-secondary" id="osce-key-clear">Clear</button>' +
            '<button class="btn-secondary" id="osce-key-test">Test Connection</button>' +
          '</div>' +
          '<div id="osce-settings-status" style="font-size:.8rem;margin-top:6px"></div>' +
        '</div>' +
        '<div class="field-box">' +
          '<label class="field-label" for="osce-model-select">AI Model</label>' +
          '<select id="osce-model-select" style="width:100%;padding:.5rem .7rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.85rem"></select>' +
        '</div>' +
        '<div class="field-box">' +
          '<label class="field-label">Max Wait</label>' +
          '<div class="field-row">' +
            '<select id="osce-max-wait" style="flex:1;padding:.5rem .7rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.85rem">' +
              '<option value="15">15 seconds</option>' +
              '<option value="30">30 seconds</option>' +
              '<option value="60">60 seconds</option>' +
              '<option value="0">No limit</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field-box">' +
          '<label class="field-label">Retry on Failure</label>' +
          '<div class="field-row">' +
            '<select id="osce-retry-level" style="flex:1;padding:.5rem .7rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:.85rem">' +
              '<option value="fast">Fast (1 attempt)</option>' +
              '<option value="balanced">Balanced (2 attempts)</option>' +
              '<option value="thorough">Thorough (3 attempts)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(div);

    var modelSelect = document.getElementById('osce-model-select');
    MODELS.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m[0];
      opt.textContent = m[1];
      modelSelect.appendChild(opt);
    });

    _syncSettingsValues();

    document.getElementById('osce-settings-close').addEventListener('click', _closeSettings);
    document.getElementById('osce-key-save').addEventListener('click', _saveKey);
    document.getElementById('osce-key-clear').addEventListener('click', _clearKey);
    document.getElementById('osce-key-test').addEventListener('click', _testKey);
    document.getElementById('osce-model-select').addEventListener('change', function () {
      localStorage.setItem(STORAGE.model, this.value);
    });
    document.getElementById('osce-max-wait').addEventListener('change', function () {
      localStorage.setItem(STORAGE.maxWait, this.value);
    });
    document.getElementById('osce-retry-level').addEventListener('change', function () {
      localStorage.setItem(STORAGE.retryLevel, this.value);
    });
    div.addEventListener('click', function (e) { if (e.target === div) _closeSettings(); });
  }

  function _syncSettingsValues() {
    var key = document.getElementById('osce-key-input');
    if (key) key.value = _readKey();
    var ms = document.getElementById('osce-model-select');
    if (ms) { var sm = _getSavedModel(); if (modelIsAvailable(sm)) ms.value = sm; }
    var mw = document.getElementById('osce-max-wait');
    if (mw) mw.value = localStorage.getItem(STORAGE.maxWait) || '15';
    var rl = document.getElementById('osce-retry-level');
    if (rl) rl.value = _getRetryLevel();
  }

  function _openSettings() {
    _renderSettingsHTML();
    setTimeout(function () {
      var k = document.getElementById('osce-key-input');
      if (k) k.focus();
    }, 100);
  }

  function _closeSettings() {
    var overlay = document.getElementById('osce-settings-overlay');
    if (overlay) overlay.className = '';
  }

  function _saveKey() {
    var v = document.getElementById('osce-key-input').value.trim();
    localStorage.setItem(STORAGE.apiKey, v ? _obfuscate(v) : '');
    var status = document.getElementById('osce-settings-status');
    if (status) status.textContent = v ? '✓ Settings saved.' : '✗ API key cleared.';
    _closeSettings();
  }

  function _clearKey() {
    localStorage.removeItem(STORAGE.apiKey);
    var key = document.getElementById('osce-key-input');
    if (key) key.value = '';
    var status = document.getElementById('osce-settings-status');
    if (status) status.textContent = '✗ API key cleared.';
  }

  function _testKey() {
    var v = document.getElementById('osce-key-input').value.trim();
    var st = document.getElementById('osce-settings-status');
    if (!v) { st.textContent = '✗ No key entered.'; return; }
    st.textContent = 'Testing…';
    fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': v } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        st.textContent = (data && data.models && data.models.length) ? '✓ Key is valid (' + data.models.length + ' models available).' : '✗ Unexpected response. Check the key.';
      })
      .catch(function () { st.textContent = '✗ Connection failed. Check key or network.'; });
  }

  /* ── Public API ─────────────────────────────────────────────── */
  window.OsceSimulator = {
    boot: boot,
    openSettings: _openSettings,
    hasApiKey: _hasApiKey
  };

  if (_cs) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

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

})();
