/* ================================================================
   written-engine.js - Standalone written-answer assessment engine.
   Consumes WRITTEN_CONFIG and WRITTEN_QUESTIONS from written files.
   ================================================================ */
(function () {
  'use strict';

  var currentScript = document.currentScript;
  var ENGINE_BASE = currentScript
    ? currentScript.src.replace(/[^\/]*$/, '')
    : (window.__WRITTEN_ENGINE_BASE || '');

  var sourceData = readWrittenData();
  var config = normalizeConfig(sourceData.config);
  var questions = normalizeQuestions(sourceData.questions);
  var currentIndex = 0;
  var answerSaveTimer = null;
  var state = {
    answers: {},
    evaluations: {},
    flagged: {}
  };

  var STORAGE = {
    theme: 'quiz-theme',
    apiKey: 'gemini_api_key',
    model: 'gemini_selected_model',
    progress: 'quiz_progress_v1_' + config.uid
  };

  var _OK = [0x71, 0x75, 0x69, 0x7A, 0x74, 0x6F, 0x6F, 0x6C]; // "quiztool"

  function _obfuscate(str) {
    if (!str) return '';
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) ^ _OK[i % _OK.length]);
    }
    return btoa(String.fromCharCode.apply(null, bytes));
  }

  function _deobfuscate(encoded) {
    if (!encoded) return '';
    try {
      var bytes = atob(encoded);
      var result = '';
      for (var i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes.charCodeAt(i) ^ _OK[i % _OK.length]);
      }
      return result;
    } catch (_) { return ''; }
  }

  function _readKey() {
    var raw = localStorage.getItem(STORAGE.apiKey);
    if (!raw) return '';
    var plain = _deobfuscate(raw);
    if (plain) return plain;
    return raw;
  }

  function _writeKey(plain) {
    if (plain) {
      localStorage.setItem(STORAGE.apiKey, _obfuscate(plain));
    } else {
      localStorage.removeItem(STORAGE.apiKey);
    }
  }

  var MODELS = [
    ['gemma-4-26b-a4b-it', 'Gemma 4 26B IT (default, fast open model)'],
    ['gemma-4-31b-it', 'Gemma 4 31B IT (larger, stronger open model)'],
    ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite (fast, stable Gemini)'],
    ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite (older, deprecating soon)'],
    ['gemini-2.5-flash', 'Gemini 2.5 Flash (older, deprecating soon)']
  ];

  function pickField(obj) {
    var fields = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < fields.length; i++) {
      var val = obj[fields[i]];
      if (val !== null && val !== undefined) return val;
    }
    return undefined;
  }

  function normalizeConfig(raw) {
    var title = textOr(pickField(raw, 'title', 'name', 'quizName', 'assessment_name', 'assessmentName'), 'Written Assessment');
    return {
      uid: textOr(pickField(raw, 'uid', 'id', 'quizId', 'uniqueId'), slugify(title) || 'written_assessment'),
      title: title,
      description: textOr(pickField(raw, 'description', 'desc', 'subtitle', 'intro'), 'Answer in your own words, compare with the model answer, and save your review progress.'),
      icon: textOr(pickField(raw, 'icon', 'emoji', 'icon_emoji'), 'WA')
    };
  }

  function readWrittenData() {
    var data = { config: {}, questions: [] };

    try {
      if (typeof WRITTEN_CONFIG !== 'undefined') data.config = WRITTEN_CONFIG;
    } catch (error) {}
    if (!data.config || !Object.keys(data.config).length) {
      data.config = window.WRITTEN_CONFIG || {};
    }

    try {
      if (typeof WRITTEN_QUESTIONS !== 'undefined') data.questions = WRITTEN_QUESTIONS;
    } catch (error) {}
    if (!Array.isArray(data.questions)) {
      data.questions = window.WRITTEN_QUESTIONS || [];
    }

    if ((!data.config || !Object.keys(data.config).length) || !Array.isArray(data.questions) || !data.questions.length) {
      var recovered = recoverWrittenDataFromScripts();
      if (!data.config || !Object.keys(data.config).length) data.config = recovered.config || {};
      if (!Array.isArray(data.questions) || !data.questions.length) data.questions = recovered.questions || [];
    }

    return data;
  }

  function recoverWrittenDataFromScripts() {
    var recovered = { config: {}, questions: [] };
    $all('script').some(function (script) {
      var text = script.textContent || '';
      if (!text || text.indexOf('WRITTEN_') === -1) return false;
      recovered.config = extractConstValue(text, 'WRITTEN_CONFIG') || recovered.config;
      recovered.questions = extractConstValue(text, 'WRITTEN_QUESTIONS') || recovered.questions;
      return recovered.config && Object.keys(recovered.config).length && Array.isArray(recovered.questions) && recovered.questions.length;
    });
    return recovered;
  }

  function extractConstValue(source, name) {
    var patterns = ['const ' + name + ' =', 'var ' + name + ' =', 'let ' + name + ' ='];
    var start = -1;
    for (var p = 0; p < patterns.length; p++) {
      start = source.indexOf(patterns[p]);
      if (start !== -1) {
        start += patterns[p].length;
        break;
      }
    }
    if (start === -1) return null;
    var end = findStatementEnd(source, start);
    if (end === -1) return null;
    var expression = source.slice(start, end).trim();
    try {
      return Function('"use strict"; return (' + expression + ');')();
    } catch (error) {
      console.error('Could not parse ' + name + ' from written template.', error);
      return null;
    }
  }

  function findStatementEnd(source, start) {
    var quote = null;
    var escape = false;
    var lineComment = false;
    var blockComment = false;
    var depth = 0;

    for (var i = start; i < source.length; i++) {
      var ch = source[i];
      var next = source[i + 1];

      if (lineComment) {
        if (ch === '\n') lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === '*' && next === '/') {
          blockComment = false;
          i++;
        }
        continue;
      }
      if (quote) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === '/' && next === '/') {
        lineComment = true;
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        blockComment = true;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{' || ch === '[' || ch === '(') depth++;
      if (ch === '}' || ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ';' && depth === 0) return i;
    }

    return -1;
  }

  function normalizeQuestions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (q, index) {
      q = q || {};
      return {
        id: textOr(pickField(q, 'id', 'questionId', 'qid', 'uid'), 'wq-' + (index + 1)),
        question: textOr(pickField(q, 'question', 'q', 'prompt', 'text', 'question_text', 'questionText'), 'Untitled written question'),
        modelAnswer: textOr(pickField(q, 'modelAnswer', 'model_answer', 'answer', 'expected_answer', 'expectedAnswer', 'correct_answer', 'correctAnswer', 'model_answer_text'), ''),
        rubric: textOr(pickField(q, 'rubric', 'grading_rubric', 'marking_scheme', 'criteria'), ''),
        explanation: textOr(pickField(q, 'explanation', 'notes', 'note', 'background', 'explanation_text'), ''),
        tags: Array.isArray(q.tags) ? q.tags.map(String).filter(Boolean) : []
      };
    });
  }

  function textOr(value, fallback) {
    if (value === null || value === undefined) return fallback;
    var text = String(value).trim();
    return text || fallback;
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function addMeta(name, content) {
    var meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
  }

  function addLink(rel, href, extra) {
    var link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        link[key] = extra[key];
      });
    }
    document.head.appendChild(link);
  }

  function initAssets() {
    var theme = localStorage.getItem(STORAGE.theme) || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.background = theme === 'light' ? '#f3f0eb' : '#0d1117';
    document.body.style.color = theme === 'light' ? '#1c1917' : '#e6edf3';
    document.body.style.overflow = 'hidden';

    addMeta('theme-color', '#0d1117');
    addLink('preconnect', 'https://fonts.googleapis.com');
    addLink('preconnect', 'https://fonts.gstatic.com', { crossOrigin: '' });
    addLink('stylesheet', 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
    addLink('manifest', ENGINE_BASE + 'manifest.webmanifest');
    addLink('icon', ENGINE_BASE + 'favicon.svg', { type: 'image/svg+xml' });
    addLink('apple-touch-icon', ENGINE_BASE + 'favicon.svg');
  }

  function initStyles() {
    var style = document.createElement('style');
    style.textContent = [
      ':root{--bg:#0d1117;--surface:#161b22;--surface2:#1c2330;--surface3:#222b3a;--surface-2:var(--surface2);--surface-3:var(--surface3);--border:#30363d;--text:#e6edf3;--text-muted:#8b949e;--muted:var(--text-muted);--accent:#f0a500;--accent-soft:rgba(240,165,0,.13);--accent-dim:rgba(240,165,0,.12);--correct:#2ea043;--correct-bg:rgba(46,160,67,.14);--ok:var(--correct);--ok-soft:var(--correct-bg);--wrong:#da3633;--wrong-bg:rgba(218,54,51,.14);--bad:var(--wrong);--bad-soft:var(--wrong-bg);--flag:#58a6ff;--flag-soft:rgba(88,166,255,.15);--flagged-bg:rgba(88,166,255,0.12);--shadow:0 4px 24px rgba(0,0,0,.4);--radius:12px;--fast:.18s ease;--nav-size:280px;}',
      '[data-theme="light"]{--bg:#f3f0eb;--surface:#fff;--surface2:#f8f6f1;--surface3:#eee9df;--border:#d0ccc5;--text:#1c1917;--text-muted:#78716c;--muted:var(--text-muted);--accent:#c27803;--accent-soft:rgba(194,120,3,.12);--accent-dim:rgba(194,120,3,0.10);--correct:#16a34a;--correct-bg:rgba(22,163,74,.12);--ok:var(--correct);--ok-soft:var(--correct-bg);--wrong:#dc2626;--wrong-bg:rgba(220,38,38,.12);--bad:var(--wrong);--bad-soft:var(--wrong-bg);--flag:#2563eb;--flag-soft:rgba(37,99,235,.12);--flagged-bg:rgba(37,99,235,0.10);--shadow:0 4px 24px rgba(0,0,0,.10);}',
      '*,*::before,*::after{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{font-family:Outfit,system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--text);line-height:1.55;transition:background .25s ease,color .25s ease}button,input,textarea,select{font:inherit}button{border:0;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.58}.written-app{height:100%;min-height:100%;display:flex;flex-direction:column;background:var(--bg);color:var(--text)}',
      '.screen{display:none;min-height:100%;height:100%;overflow:hidden}.screen.active{display:flex}.start-screen{align-items:center;justify-content:center;padding:1.5rem;overflow:auto}.start-shell{width:min(620px,100%)}.hub-back-btn{position:absolute;top:1.5rem;left:1.5rem;display:flex;align-items:center;gap:0.5rem;color:var(--muted);text-decoration:none;font-weight:600;font-size:0.95rem;transition:color var(--fast);z-index:10}.hub-back-btn:hover{color:var(--text)}.hub-back-btn svg{transition:transform var(--fast)}.hub-back-btn:hover svg{transform:translateX(-3px)}#theme-start{position:absolute;top:1.5rem;right:1.5rem;z-index:10}.start-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:2.5rem;box-shadow:var(--shadow);text-align:center}.start-icon{width:64px;height:64px;display:grid;place-items:center;border-radius:16px;background:var(--accent-soft);color:var(--accent);font-weight:800;font-size:1.8rem;margin:0 auto 1.25rem}.start-card h1{font-family:"Playfair Display",Georgia,serif;font-size:clamp(1.8rem,4vw,2.4rem);line-height:1.2;margin:0 0 .5rem}.start-card p{margin:0;color:var(--muted);font-size:.95rem}',
      '.meta-grid{display:grid;grid-template-columns:1fr;gap:1rem;margin-bottom:1.25rem}.meta-item{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;text-align:center;transition:border-color var(--fast)}.meta-item:hover{border-color:var(--accent)}.meta-item .val{font-size:1.5rem;font-weight:700;color:var(--accent);display:block}.meta-item .lbl{font-size:0.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em}',
      '.config-grid{display:grid;grid-template-columns:1fr;gap:.9rem;margin:1.5rem 0;text-align:left}.field-box{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem}.field-label{display:block;color:var(--accent);font-size:.78rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}.api-row{display:flex;gap:8px}.api-row input,.field-box select{width:100%;min-width:0;border:1.5px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);padding:.65rem .8rem;outline:0}.api-row input:focus,.field-box select:focus{border-color:var(--accent)}.field-note{font-size:.82rem;color:var(--muted);margin-top:8px}.grading-note{margin-top:10px;padding:10px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:.86rem}.start-actions{display:flex;gap:10px;align-items:center}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--radius);font-weight:700;min-height:40px;padding:.7rem 1.25rem;transition:transform var(--fast),background var(--fast),border-color var(--fast),color var(--fast)}.btn:hover{transform:translateY(-1px)}.btn-primary{background:var(--accent);color:#111}.btn-secondary{background:var(--surface2);border:1.5px solid var(--border);color:var(--text)}.btn-secondary:hover{border-color:var(--accent)}.btn-danger{background:var(--bad-soft);border:1px solid var(--bad);color:var(--bad)}.btn-icon,.icon-btn{width:36px;height:36px;min-width:36px;padding:0;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:1rem;text-decoration:none}.btn-icon:hover,.icon-btn:hover{border-color:var(--accent);color:var(--text)}.btn-icon.danger:hover,.icon-btn.danger:hover{border-color:var(--bad);color:var(--bad)}',
      '.practice-screen{flex-direction:column}.topbar{display:flex;align-items:center;gap:1rem;padding:0.75rem 1.25rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;z-index:10}.topbar-title{font-family:"Playfair Display",Georgia,serif;font-size:1.05rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}.topbar-spacer,.topbar-title{min-width:0}.topbar-actions{display:flex;gap:.5rem;align-items:center;flex-shrink:0}.layout{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) var(--nav-size);overflow:hidden}.nav-pane{min-height:0;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden}.nav-pane-header{padding:1rem;color:var(--muted);font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid var(--border)}.legend{display:flex;flex-wrap:wrap;gap:0.4rem 0.75rem;margin-top:8px}.legend-item{display:flex;align-items:center;gap:0.3rem;font-size:0.72rem;color:var(--muted)}.legend-item .dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}.legend-item .dot.answered{background:var(--correct)}.legend-item .dot.wrong{background:var(--wrong)}.legend-item .dot.flagged{background:var(--flag)}.legend-item .dot.unanswered{background:var(--surface2);border:1px solid var(--border)}.nav-grid-wrap{flex:1;min-height:0;overflow:auto;padding:.5rem}.nav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:5px}.nav-btn{aspect-ratio:1;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-muted);font-size:.85rem;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all var(--fast);position:relative;line-height:1;padding:0}.nav-btn:hover{border-color:var(--accent);color:var(--accent)}.nav-btn.active{background:var(--accent-dim);border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 2px var(--accent-dim)}.nav-btn.pass{background:var(--correct-bg);border-color:var(--correct);color:var(--correct)}.nav-btn.fail{background:var(--wrong-bg);border-color:var(--wrong);color:var(--wrong)}.nav-btn.flag{box-shadow:0 0 0 3px var(--flag-soft);background:var(--flag-soft);border-color:var(--flag);color:var(--flag)}.nav-stats{padding:0.75rem 1rem;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;flex-shrink:0}.stat-item{text-align:center}.stat-item .sv{font-size:1rem;font-weight:700}.stat-item .sl{font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em}.sv.green{color:var(--correct)}.sv.blue{color:var(--flag)}.sv.muted{color:var(--muted)}',
      '.content{position:relative;min-width:0;min-height:0;overflow:auto;padding:22px}.work-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;max-width:1100px;margin:0 auto}.panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow)}.question-panel{padding:20px}.question-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:var(--muted);font-size:.83rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.tag-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.tag{display:inline-flex;align-items:center;min-height:22px;border-radius:6px;background:var(--surface-2);border:1px solid var(--border);padding:2px 7px;color:var(--muted);font-size:.76rem;text-transform:none;letter-spacing:0}.question-text{font-size:1.14rem;font-weight:600;white-space:pre-wrap}.answer-panel{padding:16px}.answer-panel textarea{width:100%;min-height:230px;resize:vertical;border:1.5px solid var(--border);border-radius:var(--radius);background:var(--surface-2);color:var(--text);padding:14px;outline:0;transition:border-color var(--fast),box-shadow var(--fast)}.answer-panel textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}.answer-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap}.counter{color:var(--muted);font-size:.86rem;white-space:nowrap}.action-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '.feedback{display:none;gap:16px}.feedback.active{display:grid}.compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.compare-card{padding:16px;background:var(--surface2)}.compare-card.user{border-left:4px solid var(--flag)}.compare-card.model{border-left:4px solid var(--accent)}.compare-title{color:var(--muted);font-weight:800;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}.compare-body{white-space:pre-wrap;color:var(--text);font-size:.92rem;line-height:1.6}.eval-panel{padding:18px;background:var(--surface-3)}.eval-head{display:flex;align-items:center;gap:14px;margin-bottom:14px}.score{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;font-weight:800;border:3px solid var(--border);background:var(--surface)}.score.pass{border-color:var(--ok);background:var(--ok-soft);color:var(--ok)}.score.fail{border-color:var(--bad);background:var(--bad-soft);color:var(--bad)}.verdict{font-size:1.1rem;font-weight:800}.eval-source{color:var(--muted);font-size:.86rem}.bullet-list{display:grid;gap:8px;margin:12px 0}.bullet{position:relative;padding-left:18px;font-size:.92rem;line-height:1.5}.bullet::before{content:"";position:absolute;left:0;top:.65em;width:7px;height:7px;border-radius:99px;background:var(--accent)}.bullet.good::before{background:var(--ok)}.bullet.gap::before{background:var(--bad)}.feedback-text{border-top:1px solid var(--border);padding-top:12px;margin-top:8px;white-space:pre-wrap;font-size:.92rem;line-height:1.6;color:var(--text)}.manual-bar{display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 16px;text-align:center}.manual-copy strong{display:block;font-size:.95rem;margin-bottom:2px}.manual-copy span{color:var(--muted);font-size:.86rem}.manual-bar .action-row{justify-content:center}.pass-choice.active{background:var(--ok);border-color:var(--ok);color:white}.fail-choice.active{background:var(--bad);border-color:var(--bad);color:white}',
      '.loading{position:absolute;inset:0;z-index:20;display:none;place-items:center;background:rgba(13,17,23,.72);backdrop-filter:blur(5px)}[data-theme="light"] .loading{background:rgba(243,240,235,.72)}.loading.active{display:grid}.loading-box{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;box-shadow:var(--shadow);text-align:center;max-width:360px}.spinner{width:42px;height:42px;border:4px solid var(--border);border-top-color:var(--accent);border-radius:50%;margin:0 auto 14px;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.empty{padding:22px;border:1px dashed var(--border);border-radius:12px;background:var(--surface-2);color:var(--muted)}.toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(80px);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.65rem 1.2rem;font-size:.88rem;font-weight:500;box-shadow:var(--shadow);z-index:9999;transition:transform .3s ease,opacity .3s ease;white-space:nowrap;display:flex;align-items:center;gap:.5rem;max-width:90%}.toast.show{transform:translateX(-50%) translateY(0)}',
      '.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:none;align-items:center;justify-content:center;padding:1rem}.modal-overlay.open{display:flex}.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.25rem 1.5rem;max-width:400px;width:100%;box-shadow:var(--shadow);animation:slideUp .25s ease}.modal h3{font-family:"Playfair Display",Georgia,serif;font-size:1.2rem;margin:0 0 .5rem}.modal p{color:var(--muted);font-size:.88rem;line-height:1.5;margin:0 0 1rem}.modal-actions{display:flex;gap:.65rem}.modal-actions .btn-cancel{flex:1;padding:.6rem .75rem;border-radius:10px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-weight:600;font-size:.85rem;transition:all var(--fast)}.modal-actions .btn-cancel:hover{border-color:var(--accent)}.modal-actions .btn-confirm{flex:1;padding:.6rem .75rem;border-radius:10px;background:var(--correct);border:none;color:#fff;font-weight:700;font-size:.85rem;transition:all var(--fast)}.modal-actions .btn-confirm:hover{opacity:.85}.modal-actions .btn-confirm.danger{background:var(--bad);border-color:var(--bad)}@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
      '.result-screen{flex-direction:column;height:100%;overflow:hidden;background:var(--bg)}.result-topbar{display:flex;align-items:center;gap:1rem;padding:0.75rem 1.25rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}.result-topbar h2{font-family:"Playfair Display",Georgia,serif;font-size:1.1rem;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.result-topbar .topbar-actions{margin-left:auto}.result-body{flex:1;overflow-y:auto;padding:1.5rem;display:flex;flex-direction:column;gap:1.5rem;max-width:820px;margin:0 auto;width:100%}.result-body::-webkit-scrollbar{width:6px}.result-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}.score-banner{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.75rem 2rem;display:flex;align-items:center;gap:2rem;flex-wrap:wrap;box-shadow:var(--shadow)}.score-circle{width:110px;height:110px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:4px solid var(--accent);flex-shrink:0;background:var(--accent-dim)}.score-circle .pct{font-size:1.8rem;font-weight:700;color:var(--accent);line-height:1}.score-circle .lbl{font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em}.score-details{flex:1;min-width:180px}.score-details h3{font-family:"Playfair Display",Georgia,serif;font-size:1.4rem;margin:0 0 0.75rem}.score-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.65rem}.score-stat{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.65rem 0.85rem;transition:border-color var(--fast)}.score-stat:hover{border-color:var(--accent)}.score-stat .n{font-size:1.2rem;font-weight:700}.score-stat .t{font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.03em}.n.green{color:var(--correct)}.n.red{color:var(--wrong)}.n.blue{color:var(--flag)}.result-tabs{display:flex;gap:0.5rem;flex-wrap:wrap}.tab-btn{padding:0.45rem 1rem;border-radius:8px;background:var(--surface);border:1.5px solid var(--border);color:var(--text-muted);font-size:0.85rem;font-weight:500;transition:all var(--fast)}.tab-btn:hover{border-color:var(--accent);color:var(--accent)}.tab-btn.active{background:var(--accent-dim);border-color:var(--accent);color:var(--accent)}.result-list{display:flex;flex-direction:column;gap:1rem}.result-item{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color var(--fast)}.result-item.pass{border-color:var(--correct)}.result-item.fail{border-color:var(--wrong)}.result-item.skipped{border-color:var(--border)}.result-item-header{display:flex;align-items:flex-start;gap:0.75rem;padding:1rem 1.25rem;cursor:pointer;user-select:none}.result-status-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.9rem;font-weight:700;margin-top:0.15rem}.result-item.pass .result-status-icon{background:var(--correct-bg);color:var(--correct)}.result-item.fail .result-status-icon{background:var(--wrong-bg);color:var(--wrong)}.result-item.skipped .result-status-icon{background:var(--surface2);color:var(--text-muted)}.result-q-meta{flex:1;min-width:0}.result-q-num{font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.2rem;font-weight:600}.result-q-text{font-size:0.95rem;font-weight:500;line-height:1.5;word-break:break-word}.expand-arrow{color:var(--text-muted);font-size:0.8rem;margin-top:0.2rem;transition:transform .2s;flex-shrink:0}.result-item-header.open .expand-arrow{transform:rotate(180deg)}.result-item-body{display:none;padding:0 1.25rem 1.1rem;border-top:1px solid var(--border)}.result-item-body.open{display:block}.answer-row{display:flex;align-items:flex-start;gap:0.65rem;padding:0.6rem 0.75rem;border-radius:8px;margin-top:0.5rem;font-size:0.88rem;flex-direction:column}.answer-row.user-answer{background:var(--wrong-bg)}.answer-row.model-answer{background:var(--correct-bg)}.answer-row .ar-label{font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;white-space:nowrap;opacity:0.7}.answer-row .ar-text{white-space:pre-wrap;line-height:1.55;width:100%}.explanation-box{margin-top:0.75rem;padding:0.75rem 1rem;background:var(--surface2);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;font-size:0.875rem;line-height:1.6;color:var(--text-muted);white-space:pre-wrap}.explanation-box strong{color:var(--text);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:0.25rem}.result-actions{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}.btn-restart{display:flex;align-items:center;gap:0.5rem;padding:0.85rem 1.75rem;border-radius:var(--radius);background:var(--accent);color:#000;font-weight:700;font-size:0.95rem;border:1.5px solid var(--accent);transition:all var(--fast);text-decoration:none;cursor:pointer}.btn-restart:hover{opacity:0.85;transform:translateY(-1px)}.btn-restart.btn-secondary{background:var(--surface2);color:var(--text);border-color:var(--border)}.btn-restart.btn-secondary:hover{border-color:var(--accent);color:var(--accent);opacity:1}.pdf-export-section{margin-top:1.5rem;margin-bottom:1rem;padding:1rem;border-radius:var(--radius);background:var(--surface);border:1.5px solid var(--border)}.export-options{display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;margin-bottom:0.85rem}.export-option{display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.65rem;border-radius:6px;background:var(--surface2);border:1.5px solid var(--border);cursor:pointer;transition:all var(--fast);flex:1;min-width:120px}.export-option:hover{border-color:var(--accent);background:var(--accent-dim)}.export-option input[type="checkbox"]{display:none}.export-option input[type="checkbox"]:checked+.export-checkbox-visual{border-color:var(--accent);background:var(--accent)}.export-option input[type="checkbox"]:checked+.export-checkbox-visual svg{display:block}.export-checkbox-visual{width:16px;height:16px;border-radius:4px;border:2px solid var(--border);background:var(--surface);transition:all var(--fast);flex-shrink:0;display:flex;align-items:center;justify-content:center}.export-checkbox-visual svg{display:none;width:10px;height:10px;stroke:#000;stroke-width:3;fill:none}.export-label{font-size:0.82rem;font-weight:500;color:var(--text);flex:1}.export-badge{font-size:0.65rem;padding:0.1rem 0.4rem;border-radius:3px;background:var(--accent-dim);color:var(--accent);font-weight:600}.btn-export-pdf{display:flex;align-items:center;gap:0.5rem;padding:0.85rem 1.75rem;border-radius:var(--radius);background:var(--surface2);color:var(--text);border:1.5px solid var(--border);font-weight:700;font-size:0.95rem;transition:all var(--fast);text-decoration:none;width:100%;justify-content:center;cursor:pointer}.btn-export-pdf:hover{border-color:var(--accent);color:var(--accent);opacity:1}',
      '@media (orientation: portrait) and (max-width:860px){.layout{grid-template-columns:1fr}.nav-pane{border-left:0;border-top:1px solid var(--border);max-height:200px}.nav-grid-wrap{display:flex;overflow-x:auto;overflow-y:hidden;padding-bottom:10px}.nav-grid{grid-template-columns:repeat(auto-fill,minmax(42px,1fr));grid-template-rows:42px;grid-auto-flow:column;gap:5px}.nav-btn{width:42px;height:42px;min-width:42px;aspect-ratio:unset;border-radius:6px}}',
      '@media (max-width:860px){.config-grid,.compare-grid{grid-template-columns:1fr}.layout{grid-template-columns:1fr}.nav-pane{border-left:0;border-top:1px solid var(--border);max-height:200px}.nav-grid-wrap{display:flex;overflow-x:auto;overflow-y:hidden;padding-bottom:10px}.nav-grid{grid-template-columns:repeat(auto-fill,minmax(42px,1fr));grid-template-rows:42px;grid-auto-flow:column;gap:5px}.nav-btn{width:42px;height:42px;min-width:42px;aspect-ratio:unset;border-radius:6px}.content{padding:16px}.manual-bar{align-items:center}.action-row{justify-content:flex-start}.manual-bar .action-row{justify-content:center}}',
      '@media (max-width:640px){.topbar{padding:0.5rem 0.75rem;gap:0.5rem}.topbar-title{font-size:0.95rem}}',
      '@media (max-width:560px){.start-screen{padding:14px}.start-card{padding:20px}.api-row,.start-actions,.answer-foot{align-items:stretch;flex-direction:column}.topbar{padding:0.4rem 0.6rem;gap:0.35rem}.icon-btn{width:34px;height:34px;min-width:34px;font-size:0.9rem}.start-actions .btn,.answer-foot .btn,.manual-bar .btn{width:100%}.topbar-actions{gap:0.3rem}}',
      '@media (max-width:400px){.icon-btn{width:30px;height:30px;min-width:30px;font-size:0.8rem}.topbar-actions{gap:0.2rem}.topbar-title{font-size:0.85rem}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function initMarkup() {
    document.title = config.title;
    document.body.innerHTML = '';

    var app = create('div', 'written-app');
    app.innerHTML = [
      '<section class="screen start-screen active" id="start-screen">',
      '  <a class="hub-back-btn" href="index.html" id="hub-link-start">',
      '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">',
      '      <line x1="19" y1="12" x2="5" y2="12"></line>',
      '      <polyline points="12 19 5 12 12 5"></polyline>',
      '    </svg>',
      '    Back to Hub',
      '  </a>',
      '  <button class="btn btn-icon" id="theme-start" type="button" title="Toggle theme">☀</button>',
      '  <div class="start-shell">',
      '    <div class="start-card">',
      '      <div class="start-icon" id="start-icon"></div>',
      '      <h1 id="start-title"></h1>',
      '      <p id="start-description"></p>',
      '      <div class="meta-grid">',
      '        <div class="meta-item">',
      '          <span class="val" id="start-q-count">—</span>',
      '          <span class="lbl">Questions</span>',
      '        </div>',
      '      </div>',
      '      <div class="config-grid">',
      '        <div class="field-box">',
      '          <label class="field-label" for="api-key">Gemini API key</label>',
      '          <div class="api-row">',
      '            <input id="api-key" type="password" autocomplete="off" placeholder="Paste key for AI grading">',
      '            <button class="btn btn-secondary" id="save-key" type="button">Save</button>',
      '          </div>',
      '          <div class="field-note">Stored only in this browser. Manual grading works without a key.</div>',
      '        </div>',
      '        <div class="field-box">',
      '          <label class="field-label" for="model-select">AI model</label>',
      '          <select id="model-select"></select>',
      '          <div class="field-note" id="question-count"></div>',
      '        </div>',
      '      </div>',
      '      <div class="start-actions">',
      '        <button class="btn btn-primary" id="begin-assessment" type="button">Begin Assessment</button>',
      '        <button class="btn btn-secondary" id="resume-last" type="button">Resume Saved Work</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</section>',
      '<section class="screen practice-screen" id="practice-screen">',
      '  <header class="topbar">',
      '    <div class="topbar-title" id="practice-title"></div>',
      '    <div class="topbar-spacer"></div>',
      '    <div class="topbar-actions">',
      '      <button class="icon-btn" id="flag-question" type="button" title="Flag question">⚑</button>',
      '      <a class="icon-btn" href="index.html" id="hub-link-practice" title="Back to Hub">🏠</a>',
      '      <button class="icon-btn" id="theme-practice" type="button" title="Toggle theme">☀</button>',
      '      <button class="icon-btn danger" id="reset-progress" type="button" title="Reset Progress">↻</button>',
      '    </div>',
      '  </header>',
      '  <div class="layout">',
      '    <main class="content">',
      '      <div class="loading" id="loading"><div class="loading-box"><div class="spinner"></div><strong>Evaluating answer</strong><div class="field-note" id="loading-note">Comparing your response with the model answer.</div></div></div>',
      '      <div class="work-grid" id="work-grid">',
      '        <section class="panel question-panel">',
      '          <div class="question-meta"><span id="question-number"></span><div class="tag-row" id="tag-row"></div></div>',
      '          <div class="question-text" id="question-text"></div>',
      '        </section>',
      '        <section class="panel answer-panel" id="answer-panel">',
      '          <textarea id="answer-input" placeholder="Write your answer here..."></textarea>',
      '          <div class="answer-foot">',
      '            <div class="counter" id="answer-counter">0 words | 0 characters</div>',
      '            <div class="action-row">',
      '              <button class="btn btn-secondary" id="skip-question" type="button">Skip</button>',
      '              <button class="btn btn-secondary" id="self-grade" type="button">Manual Grade</button>',
      '              <button class="btn btn-primary" id="ai-grade" type="button">Grade with AI</button>',
      '            </div>',
      '          </div>',
      '          <div class="grading-note" id="grading-note">Grading tries AI first. If AI is unavailable or the request fails, this screen automatically falls back to manual grading and tells you why.</div>',
      '        </section>',
      '        <section class="feedback" id="feedback">',
      '          <div class="compare-grid">',
      '            <article class="panel compare-card user"><div class="compare-title">Your answer</div><div class="compare-body" id="feedback-user"></div></article>',
      '            <article class="panel compare-card model"><div class="compare-title">Model answer</div><div class="compare-body" id="feedback-model"></div></article>',
      '          </div>',
      '          <article class="panel eval-panel">',
      '            <div class="eval-head"><div class="score" id="score"></div><div><div class="verdict" id="verdict"></div><div class="eval-source" id="eval-source"></div></div></div>',
      '            <div class="bullet-list" id="bullet-list"></div>',
      '            <div class="feedback-text" id="feedback-text"></div>',
      '          </article>',
      '          <div class="panel manual-bar">',
      '            <div class="manual-copy"><strong>Final mark for this question</strong><span>Use these buttons to override the AI or complete self grading.</span></div>',
      '            <div class="action-row">',
      '              <button class="btn btn-secondary fail-choice" id="mark-fail" type="button">Fail</button>',
      '              <button class="btn btn-secondary pass-choice" id="mark-pass" type="button">Pass</button>',
      '              <button class="btn btn-primary" id="next-question" type="button">Next</button>',
      '            </div>',
      '          </div>',
      '        </section>',
      '      </div>',
      '    </main>',
      '    <aside class="nav-pane">',
      '      <div class="nav-pane-header">',
      '        Questions',
      '        <div class="legend">',
      '          <div class="legend-item"><div class="dot answered"></div> Done</div>',
      '          <div class="legend-item"><div class="dot wrong"></div> Wrong</div>',
      '          <div class="legend-item"><div class="dot flagged"></div> Flagged</div>',
      '          <div class="legend-item"><div class="dot unanswered"></div> Skipped</div>',
      '        </div>',
      '      </div>',
      '      <div class="nav-grid-wrap">',
      '        <div class="nav-grid" id="question-list"></div>',
      '      </div>',
      '      <div class="nav-stats">',
      '        <div class="stat-item"><div class="sv green" id="stat-done">0</div><div class="sl">Done</div></div>',
      '        <div class="stat-item"><div class="sv blue" id="stat-flagged">0</div><div class="sl">Flagged</div></div>',
      '        <div class="stat-item"><div class="sv muted" id="stat-skipped">0</div><div class="sl">Skipped</div></div>',
      '      </div>',
      '    </aside>',
      '  </div>',
      '</section>',
      '<div class="modal-overlay" id="reset-modal">',
      '  <div class="modal">',
      '    <h3>Reset Progress?</h3>',
      '    <p>Are you sure you want to reset your progress? This cannot be undone.</p>',
      '    <div class="modal-actions">',
      '      <button class="btn btn-cancel" id="close-reset-modal">Go Back</button>',
      '      <button class="btn btn-confirm danger" id="confirm-reset-action">Reset Now</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '<section class="screen result-screen" id="result-screen">',
      '  <header class="result-topbar">',
      '    <h2>Assessment Results</h2>',
      '    <div class="topbar-actions">',
      '      <a class="icon-btn" href="index.html" id="hub-link-result" title="Back to Hub">🏠</a>',
      '      <button class="icon-btn" id="theme-result" type="button" title="Toggle theme">☀</button>',
      '      <button class="icon-btn danger" id="reset-result" type="button" title="Reset Progress">↻</button>',
      '    </div>',
      '  </header>',
      '  <div class="result-body">',
      '    <div class="score-banner">',
      '      <div class="score-circle">',
      '        <div class="pct" id="res-pct">0%</div>',
      '        <div class="lbl">Pass Rate</div>',
      '      </div>',
      '      <div class="score-details">',
      '        <h3 id="res-grade">Ready</h3>',
      '        <div class="score-grid">',
      '          <div class="score-stat"><div class="n green" id="res-passed">0</div><div class="t">Passed</div></div>',
      '          <div class="score-stat"><div class="n red" id="res-failed">0</div><div class="t">Failed</div></div>',
      '          <div class="score-stat"><div class="n blue" id="res-flagged">0</div><div class="t">Flagged</div></div>',
      '          <div class="score-stat"><div class="n muted" id="res-skipped">0</div><div class="t">Skipped</div></div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="pdf-export-section">',
      '      <div class="export-options">',
      '        <label class="export-option">',
      '          <input type="checkbox" name="export-all" checked onchange="onExportFilterChange(this)">',
      '          <span class="export-checkbox-visual"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>',
      '          <span class="export-label">All</span>',
      '          <span class="export-badge" id="badge-all">0</span>',
      '        </label>',
      '        <label class="export-option">',
      '          <input type="checkbox" name="export-failed" onchange="onExportFilterChange(this)">',
      '          <span class="export-checkbox-visual"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>',
      '          <span class="export-label">Failed</span>',
      '          <span class="export-badge" id="badge-failed">0</span>',
      '        </label>',
      '        <label class="export-option">',
      '          <input type="checkbox" name="export-flagged" onchange="onExportFilterChange(this)">',
      '          <span class="export-checkbox-visual"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>',
      '          <span class="export-label">Flagged</span>',
      '          <span class="export-badge" id="badge-flagged">0</span>',
      '        </label>',
      '      </div>',
      '      <button class="btn-export-pdf" onclick="exportToPDF()">',
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">',
      '          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>',
      '          <polyline points="14 2 14 8 20 8"></polyline>',
      '          <line x1="16" y1="13" x2="8" y2="13"></line>',
      '          <line x1="16" y1="17" x2="8" y2="17"></line>',
      '          <polyline points="10 9 9 9 8 9"></polyline>',
      '        </svg>',
      '        Export to PDF',
      '      </button>',
      '    </div>',
      '    <div class="result-tabs">',
      '      <button class="tab-btn active" onclick="filterResults(\'all\', this)">All Questions</button>',
      '      <button class="tab-btn" onclick="filterResults(\'pass\', this)">✓ Passed</button>',
      '      <button class="tab-btn" onclick="filterResults(\'fail\', this)">✗ Failed</button>',
      '      <button class="tab-btn" onclick="filterResults(\'skipped\', this)">— Skipped</button>',
      '      <button class="tab-btn" onclick="filterResults(\'flagged\', this)">⚑ Flagged</button>',
      '    </div>',
      '    <div class="result-list" id="result-list"></div>',
      '    <div class="result-actions">',
      '      <button class="btn-restart" onclick="restartAssessment()">↺ Start Again</button>',
      '      <a class="btn-restart btn-secondary" href="index.html" id="hub-link-result-action">🏠 Return to Hub</a>',
      '    </div>',
      '  </div>',
      '</section>',
      '<div id="toast" class="toast"></div>'
    ].join('');

    document.body.appendChild(app);
  }

  function initContent() {
    $('#start-icon').textContent = config.icon;
    $('#start-title').textContent = config.title;
    $('#start-description').textContent = config.description;
    $('#practice-title').textContent = config.title;
    $('#start-q-count').textContent = questions.length;
    $('#question-count').textContent = questions.length + ' question' + (questions.length === 1 ? '' : 's');

    var modelSelect = $('#model-select');
    modelSelect.innerHTML = '';
    MODELS.forEach(function (model) {
      var option = document.createElement('option');
      option.value = model[0];
      option.textContent = model[1];
      modelSelect.appendChild(option);
    });
    var savedModel = localStorage.getItem(STORAGE.model);
    modelSelect.value = modelIsAvailable(savedModel) ? savedModel : MODELS[0][0];
    if (savedModel && !modelIsAvailable(savedModel)) {
      localStorage.setItem(STORAGE.model, MODELS[0][0]);
    }
    $('#api-key').value = _readKey();
    tryRestoreApiKeyFromCredentialManager();
    updateThemeButtons();
    updateResumeButton();
  }

  function bindEvents() {
    $('#theme-start').addEventListener('click', toggleTheme);
    $('#theme-practice').addEventListener('click', toggleTheme);
    $('#save-key').addEventListener('click', saveApiKey);
    $('#model-select').addEventListener('change', function () {
      localStorage.setItem(STORAGE.model, this.value);
    });
    $('#begin-assessment').addEventListener('click', beginAssessment);
    $('#resume-last').addEventListener('click', beginAssessment);
    $('#reset-progress').addEventListener('click', confirmResetProgress);
    $('#close-reset-modal').addEventListener('click', closeResetModal);
    $('#confirm-reset-action').addEventListener('click', confirmResetAction);
    $('#hub-link-practice').addEventListener('click', function () {
      saveProgress();
    });
    $('#flag-question').addEventListener('click', toggleFlag);
    $('#answer-input').addEventListener('input', onAnswerInput);
    $('#skip-question').addEventListener('click', goNext);
    $('#self-grade').addEventListener('click', function () {
      createManualEvaluation({
        source: 'Manual grade',
        feedback: 'Manual grading selected. Compare your response with the model answer, then choose Pass or Fail for the final mark.'
      });
    });
    $('#ai-grade').addEventListener('click', submitForAiGrade);
    $('#mark-pass').addEventListener('click', function () {
      markVerdict('pass');
    });
    $('#mark-fail').addEventListener('click', function () {
      markVerdict('fail');
    });
    $('#next-question').addEventListener('click', goNext);
    $('#theme-result').addEventListener('click', toggleTheme);
    $('#reset-result').addEventListener('click', confirmResetProgress);
  }

  function modelIsAvailable(modelId) {
    return MODELS.some(function (model) {
      return model[0] === modelId;
    });
  }

  function showScreen(id) {
    $all('.screen').forEach(function (screen) {
      screen.classList.toggle('active', screen.id === id);
    });
  }

  function beginAssessment() {
    if (!questions.length) {
      showToast('No written questions were found in this assessment.');
      return;
    }
    showScreen('practice-screen');
    renderQuestionList();
    showQuestion(currentIndex);
  }

  function updateResumeButton() {
    var hasSaved = Object.keys(state.answers).length || Object.keys(state.evaluations).length || Object.keys(state.flagged).length;
    $('#resume-last').disabled = !hasSaved;
  }

  function renderQuestionList() {
    var list = $('#question-list');
    list.innerHTML = '';
    if (!questions.length) {
      list.appendChild(create('div', 'empty', 'No questions found.'));
      return;
    }

    var doneCount = 0;
    var flaggedCount = 0;
    var skippedCount = 0;

    questions.forEach(function (question, index) {
      var evaluation = state.evaluations[index];
      var passed = evaluation ? isPassed(evaluation) : null;
      var isFlagged = !!state.flagged[index];
      var isAnswered = !!state.answers[index];

      if (evaluation) doneCount++;
      if (isFlagged) flaggedCount++;
      if (!isAnswered && !evaluation) skippedCount++;

      var btn = create('button', 'nav-btn' + (index === currentIndex ? ' active' : ''));
      btn.type = 'button';
      btn.textContent = index + 1;
      btn.addEventListener('click', function () {
        showQuestion(index);
      });

      if (passed === true) btn.classList.add('pass');
      if (passed === false) btn.classList.add('fail');
      if (isFlagged) btn.classList.add('flag');

      list.appendChild(btn);
    });

    $('#stat-done').textContent = doneCount;
    $('#stat-flagged').textContent = flaggedCount;
    $('#stat-skipped').textContent = skippedCount;
  }

  function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    currentIndex = index;

    var question = questions[index];
    $('#question-number').textContent = 'Question ' + (index + 1) + ' of ' + questions.length;
    $('#question-text').textContent = question.question;

    var tagRow = $('#tag-row');
    tagRow.innerHTML = '';
    question.tags.forEach(function (tag) {
      tagRow.appendChild(create('span', 'tag', tag));
    });

    var input = $('#answer-input');
    input.value = state.answers[index] || '';
    updateCounter();
    updateFlagButton();

    var evaluation = state.evaluations[index];
    if (evaluation) {
      renderFeedback(evaluation);
    } else {
      $('#answer-panel').style.display = '';
      $('#feedback').classList.remove('active');
    }

    renderQuestionList();
    input.focus({ preventScroll: true });
  }

  function onAnswerInput() {
    state.answers[currentIndex] = $('#answer-input').value;
    updateCounter();
    clearTimeout(answerSaveTimer);
    answerSaveTimer = setTimeout(function () {
      saveProgress();
      renderQuestionList();
      updateResumeButton();
    }, 250);
  }

  function updateCounter() {
    var value = ($('#answer-input').value || '').trim();
    var words = value ? value.split(/\s+/).length : 0;
    var chars = value.length;
    $('#answer-counter').textContent = words + ' word' + (words === 1 ? '' : 's') + ' | ' + chars + ' character' + (chars === 1 ? '' : 's');
  }

  function toggleFlag() {
    state.flagged[currentIndex] = !state.flagged[currentIndex];
    if (!state.flagged[currentIndex]) delete state.flagged[currentIndex];
    updateFlagButton();
    renderQuestionList();
    saveProgress();
  }

  function updateFlagButton() {
    var btn = $('#flag-question');
    var active = !!state.flagged[currentIndex];
    btn.classList.toggle('active', active);
    btn.style.color = active ? 'var(--flag)' : '';
    btn.title = active ? 'Remove flag' : 'Flag question';
  }

  function createManualEvaluation(options) {
    options = options || {};
    var answer = ($('#answer-input').value || '').trim();
    state.answers[currentIndex] = $('#answer-input').value;
    state.evaluations[currentIndex] = {
      score: null,
      passed: !!answer,
      strengths: answer ? ['Answer attempted and ready for self review.'] : [],
      gaps: answer ? [] : ['No answer was written before self grading.'],
      feedback: options.feedback || 'Compare your response with the model answer, then choose Pass or Fail for the final mark.',
      source: options.source || 'Manual grade',
      manualVerdict: answer ? 'pass' : 'fail'
    };
    renderFeedback(state.evaluations[currentIndex]);
    renderQuestionList();
    saveProgress();
    updateResumeButton();
  }

  function submitForAiGrade() {
    var apiKey = ($('#api-key').value || _readKey() || '').trim();
    var answer = ($('#answer-input').value || '').trim();
    if (!answer) {
      showToast('Write an answer before requesting AI grading.');
      return;
    }
    if (answer.length < 10 && answer.split(/\s+/).length < 3) {
      showToast('Very short answer — AI grading will work but results may be limited. Consider writing more detail.');
    }
    if (!apiKey) {
      createManualEvaluation({
        source: 'Manual fallback',
        feedback: 'AI grading is the primary grading path, but no Gemini API key is saved. Manual grading was opened instead; compare your response with the model answer and choose Pass or Fail.'
      });
      showToast('No Gemini API key found. Falling back to manual grading.');
      return;
    }

    state.answers[currentIndex] = $('#answer-input').value;
    _writeKey(apiKey);
    localStorage.setItem(STORAGE.model, $('#model-select').value);
    setLoading(true);

    gradeWithGemini(questions[currentIndex], answer, apiKey, $('#model-select').value)
      .then(function (evaluation) {
        state.evaluations[currentIndex] = evaluation;
        renderFeedback(evaluation);
        renderQuestionList();
        saveProgress();
        updateResumeButton();
      })
      .catch(function (error) {
        console.error(error);
        createManualEvaluation({
          source: 'Manual fallback',
          feedback: 'AI grading was attempted first, but the request failed. Manual grading was opened instead. Reason: ' + friendlyAiError(error)
        });
        showToast('AI grading failed. Falling back to manual grading.');
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function gradeWithGemini(question, answer, apiKey, model) {
    var prompt = [
      'You are grading a written educational answer. Be fair and consider partial credit.',
      'Return valid JSON only with keys: score, passed, strengths, gaps, feedback.',
      'score is a number from 0 to 100. Set passed to true when the answer shows reasonable understanding — generally score ≥ 60 is a pass, but use your judgment for borderline responses. If the rubric sets a different bar, follow the rubric.',
      'Be generous with partial credit. If the answer is mostly correct but has minor errors, set passed to true and note the gaps.',
      '',
      'QUESTION:',
      question.question,
      '',
      'MODEL ANSWER:',
      question.modelAnswer || '(No model answer supplied.)',
      '',
      question.rubric ? 'RUBRIC:\n' + question.rubric + '\n' : '',
      'STUDENT ANSWER:',
      answer
    ].join('\n');

    return tryGeminiRequests(prompt, apiKey, buildGeminiAttempts(model))
      .then(function (result) {
        var parsed = parseJsonResponse(extractGeminiText(result.payload));
        return normalizeEvaluation(parsed, result.label);
      });
  }

  function buildGeminiAttempts(model) {
    var attempts = [
      { model: model, jsonMode: true },
      { model: model, jsonMode: false }
    ];
    if (model !== MODELS[0][0]) {
      attempts.push({ model: MODELS[0][0], jsonMode: true });
      attempts.push({ model: MODELS[0][0], jsonMode: false });
    }
    return attempts.filter(function (attempt, index) {
      return attempts.findIndex(function (other) {
        return other.model === attempt.model && other.jsonMode === attempt.jsonMode;
      }) === index;
    });
  }

  function tryGeminiRequests(prompt, apiKey, attempts) {
    var lastError = null;
    var chain = Promise.reject(new Error('AI grading did not start.'));
    attempts.forEach(function (attempt, index) {
      chain = chain.catch(function () {
        return requestGemini(prompt, apiKey, attempt)
          .catch(function (error) {
            lastError = error;
            if (index === attempts.length - 1) throw lastError;
            return Promise.reject(error);
          });
      });
    });
    return chain;
  }

  function requestGemini(prompt, apiKey, attempt) {
    var body = {
      contents: [{ parts: [{ text: prompt }] }]
    };
    if (attempt.jsonMode) {
      body.generationConfig = { responseMimeType: 'application/json' };
    }

    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(attempt.model) + ':generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var payload = null;
          try {
            payload = text ? JSON.parse(text) : null;
          } catch (error) {}
          if (!response.ok) {
            var message = payload && payload.error && payload.error.message ? payload.error.message : text;
            throw new Error('Gemini ' + attempt.model + ' returned HTTP ' + response.status + ': ' + (message || response.statusText));
          }
          return payload;
        });
      })
      .then(function (payload) {
        return {
          payload: payload,
          label: 'Gemini ' + attempt.model + (attempt.jsonMode ? '' : ' (compatibility mode)')
        };
      });
  }

  function extractGeminiText(payload) {
    var candidate = payload && payload.candidates && payload.candidates[0];
    var parts = candidate && candidate.content && candidate.content.parts;
    if (!parts || !parts.length) {
      var reason = candidate && candidate.finishReason ? ' Finish reason: ' + candidate.finishReason + '.' : '';
      throw new Error('Gemini response did not include feedback text.' + reason);
    }
    return parts.map(function (part) { return part.text || ''; }).join('\n').trim();
  }

  function friendlyAiError(error) {
    return (error && error.message ? error.message : String(error || 'Unknown AI error')).replace(/\s+/g, ' ').trim();
  }

  function parseJsonResponse(text) {
    if (!text) throw new Error('Gemini response did not include text.');
    var cleaned = String(text).trim()
      .replace(/^```(?:json|javascript|js)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (error) {
      var start = cleaned.indexOf('{');
      var end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        var sliced = cleaned.slice(start, end + 1);
        try { return JSON.parse(sliced); } catch (_) {}
        try { return JSON.parse(fixSloppyJson(sliced)); } catch (_) {}
        try { return JSON.parse(fixSloppyJson(sliced.replace(/'/g, '"'))); } catch (_) {}
      }
      try { return JSON.parse(fixSloppyJson(cleaned)); } catch (_) {}
      try { return JSON.parse(fixSloppyJson(cleaned.replace(/'/g, '"'))); } catch (_) {}
      throw error;
    }
  }

  function fixSloppyJson(str) {
    str = str.replace(/,\s*([}\]])/g, '$1');
    str = str.replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":');
    str = str.replace(/:\s*'([^']*?)'\s*([,}\]])/g, ':"$1"$2');
    return str;
  }

  function normalizeEvaluation(raw, source) {
    raw = raw || {};
    var score = raw.score;
    if (score === null || score === undefined || score === '' || score === 'N/A' || score === 'n/a') score = null;
    if (score !== null) {
      score = Number(score);
      if (!isFinite(score)) score = null;
    }
    if (score !== null) score = Math.max(0, Math.min(100, Math.round(score)));
    var passed;
    if (typeof raw.passed === 'boolean') {
      passed = raw.passed;
    } else if (score !== null) {
      passed = score >= 60;
      if (score >= 55 && score < 60) passed = true;
    } else {
      passed = false;
    }
    return {
      score: score,
      passed: passed,
      strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String).filter(Boolean) : [],
      gaps: Array.isArray(raw.gaps) ? raw.gaps.map(String).filter(Boolean) : [],
      feedback: textOr(raw.feedback, 'Review the model answer and adjust your final mark if needed.'),
      source: source || 'Evaluation',
      manualVerdict: raw.manualVerdict || null
    };
  }

  function renderFeedback(evaluation) {
    var question = questions[currentIndex];
    $('#answer-panel').style.display = 'none';
    $('#feedback').classList.add('active');
    $('#feedback-user').textContent = state.answers[currentIndex] || '(No answer written.)';
    $('#feedback-model').textContent = question.modelAnswer || '(No model answer supplied.)';

    var passed = isPassed(evaluation);
    var score = $('#score');
    score.className = 'score ' + (passed ? 'pass' : 'fail');
    score.textContent = evaluation.score === null || evaluation.score === undefined ? 'Self' : String(evaluation.score);
    $('#verdict').textContent = passed ? 'Passed' : 'Needs revision';
    $('#eval-source').textContent = evaluation.source || 'Evaluation';

    var bullets = $('#bullet-list');
    bullets.innerHTML = '';
    (evaluation.strengths || []).forEach(function (item) {
      bullets.appendChild(create('div', 'bullet good', item));
    });
    (evaluation.gaps || []).forEach(function (item) {
      bullets.appendChild(create('div', 'bullet gap', item));
    });
    if (!bullets.children.length) {
      bullets.appendChild(create('div', 'bullet', 'No detailed points were returned for this evaluation.'));
    }

    $('#feedback-text').textContent = evaluation.feedback || '';
    $('#mark-pass').classList.toggle('active', passed);
    $('#mark-fail').classList.toggle('active', !passed);
  }

  function isPassed(evaluation) {
    if (!evaluation) return false;
    if (evaluation.manualVerdict) return evaluation.manualVerdict === 'pass';
    return !!evaluation.passed;
  }

  function markVerdict(verdict) {
    var evaluation = state.evaluations[currentIndex];
    if (!evaluation) {
      createManualEvaluation();
      evaluation = state.evaluations[currentIndex];
    }
    evaluation.manualVerdict = verdict;
    evaluation.passed = verdict === 'pass';
    renderFeedback(evaluation);
    renderQuestionList();
    saveProgress();
    showToast('Marked ' + verdict + '.');
  }

  function goNext() {
    saveProgress();
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
      return;
    }
    showResultsScreen();
  }

  function showResultsScreen() {
    localStorage.removeItem(STORAGE.progress);
    buildResults();
    showScreen('result-screen');
  }

  function buildResults() {
    var passed = 0, failed = 0, skipped = 0;
    questions.forEach(function(q, i) {
      var ev = state.evaluations[i];
      if (!ev) { skipped++; return; }
      if (isPassed(ev)) passed++;
      else failed++;
    });
    var total = questions.length;
    if (!total) { showToast('No questions loaded.'); return; }
    var pct = total ? Math.round(passed / total * 100) : 0;
    var flagged = 0;
    Object.keys(state.flagged).forEach(function(k) {
      if (state.flagged[k]) flagged++;
    });

    document.getElementById('res-pct').textContent = pct + '%';
    document.getElementById('res-passed').textContent = passed;
    document.getElementById('res-failed').textContent = failed;
    document.getElementById('res-flagged').textContent = flagged;
    document.getElementById('res-skipped').textContent = skipped;

    var grade = '';
    if (pct >= 90) grade = 'Excellent!';
    else if (pct >= 75) grade = 'Great Work!';
    else if (pct >= 60) grade = 'Good Effort!';
    else if (pct >= 40) grade = 'Keep Studying!';
    else grade = 'Keep Practicing!';
    document.getElementById('res-grade').textContent = grade;

    renderResultItems('all');
    updateExportBadges();
  }

  function renderResultItems(filter) {
    var list = document.getElementById('result-list');
    list.innerHTML = '';
    var itemsRendered = 0;

    questions.forEach(function(q, i) {
      var ev = state.evaluations[i];
      var evPassed = ev ? isPassed(ev) : null;
      var isSkipped = !ev;
      var isFlagged = !!state.flagged[i];

      var statusClass = isSkipped ? 'skipped' : (evPassed ? 'pass' : 'fail');

      var showItem = filter === 'all'
        || (filter === 'pass' && evPassed && !isSkipped)
        || (filter === 'fail' && evPassed === false && !isSkipped)
        || (filter === 'skipped' && isSkipped)
        || (filter === 'flagged' && isFlagged);

      if (!showItem) return;

      itemsRendered++;

      var statusIcon = isSkipped ? '—' : (evPassed ? '✓' : '✗');
      var userAnswer = state.answers[i] || '';

      var el = document.createElement('div');
      el.className = 'result-item ' + statusClass;
      el.dataset.idx = i;

      var header = document.createElement('div');
      header.className = 'result-item-header';
      header.onclick = function() { toggleResultItem(this); };
      header.innerHTML = '<div class="result-status-icon">' + statusIcon + '</div>'
        + '<div class="result-q-meta">'
        + '<div class="result-q-num">Question ' + (i + 1) + (isFlagged ? ' · ⚑ Flagged' : '') + '</div>'
        + '<div class="result-q-text">' + q.question + '</div>'
        + '</div>'
        + '<div class="expand-arrow">▼</div>';

      var body = document.createElement('div');
      body.className = 'result-item-body';

      var bodyHTML = '';
      if (!isSkipped) {
        bodyHTML += '<div class="answer-row user-answer">'
          + '<span class="ar-label">Your Answer</span>'
          + '<span class="ar-text">' + (userAnswer || '(No answer written)') + '</span>'
          + '</div>';
      }
      bodyHTML += '<div class="answer-row model-answer">'
        + '<span class="ar-label">Model Answer</span>'
        + '<span class="ar-text">' + (q.modelAnswer || '(No model answer supplied)') + '</span>'
        + '</div>';
      if (q.explanation) {
        bodyHTML += '<div class="explanation-box"><strong>Explanation</strong>' + q.explanation + '</div>';
      }

      body.innerHTML = bodyHTML;
      el.appendChild(header);
      el.appendChild(body);
      list.appendChild(el);
    });

    if (itemsRendered === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem;padding:1rem 0;">No questions in this category.</div>';
    }
  }

  function toggleResultItem(header) {
    header.classList.toggle('open');
    var body = header.nextElementSibling;
    if (body) body.classList.toggle('open');
  }

  function filterResults(filter, btn) {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderResultItems(filter);
  }

  function restartAssessment() {
    state.answers = {};
    state.evaluations = {};
    state.flagged = {};
    localStorage.removeItem(STORAGE.progress);
    currentIndex = 0;
    showScreen('start-screen');
    updateResumeButton();
    renderQuestionList();
    showToast('Assessment reset.');
  }

  function onExportFilterChange(checkbox) {
    var allCb = document.querySelector('input[name="export-all"]');
    var failedCb = document.querySelector('input[name="export-failed"]');
    var flaggedCb = document.querySelector('input[name="export-flagged"]');
    if (checkbox.name === 'export-all' && checkbox.checked) {
      failedCb.checked = false; flaggedCb.checked = false;
    } else if (checkbox.name !== 'export-all' && checkbox.checked) {
      allCb.checked = false;
    }
    if (!allCb.checked && !failedCb.checked && !flaggedCb.checked) allCb.checked = true;
  }

  function updateExportBadges() {
    var allC = 0, failedC = 0, flaggedC = 0;
    questions.forEach(function(q, i) {
      var ev = state.evaluations[i];
      var isFailed = ev && !isPassed(ev);
      allC++;
      if (isFailed) failedC++;
      if (state.flagged[i]) flaggedC++;
    });
    document.getElementById('badge-all').textContent = allC;
    document.getElementById('badge-failed').textContent = failedC;
    document.getElementById('badge-flagged').textContent = flaggedC;
  }

  function exportToPDF() {
    var allCb = document.querySelector('input[name="export-all"]');
    var failedCb = document.querySelector('input[name="export-failed"]');
    var flaggedCb = document.querySelector('input[name="export-flagged"]');

    var filter = 'all';
    if (!allCb.checked) {
      if (failedCb.checked && !flaggedCb.checked) filter = 'failed';
      else if (flaggedCb.checked && !failedCb.checked) filter = 'flagged';
      else if (failedCb.checked && flaggedCb.checked) filter = 'failed+flagged';
    }

    showToast('Generating PDF...');

    var title = document.title || 'Assessment Results';
    var pct = document.getElementById('res-pct').textContent;
    var grade = document.getElementById('res-grade').textContent;
    var passed = document.getElementById('res-passed').textContent;
    var failed = document.getElementById('res-failed').textContent;
    var skipped = document.getElementById('res-skipped').textContent;
    var flagged = document.getElementById('res-flagged').textContent;

    var filterLabels = {
      'all': 'All Questions',
      'failed': 'Failed Questions',
      'flagged': 'Flagged Questions',
      'failed+flagged': 'Failed + Flagged'
    };

    var toExport = [];
    questions.forEach(function(q, i) {
      var ev = state.evaluations[i];
      var evPassed = ev ? isPassed(ev) : null;
      var isSkipped = !ev;
      var isFailed = ev && !evPassed;
      var isFlagged = !!state.flagged[i];
      var show = filter === 'all'
        || (filter === 'failed' && isFailed)
        || (filter === 'flagged' && isFlagged)
        || (filter === 'failed+flagged' && (isFailed || isFlagged));
      if (show) toExport.push({ q: q, i: i, ev: ev, evPassed: evPassed, isSkipped: isSkipped, isFailed: isFailed, isFlagged: isFlagged });
    });

    var container = document.createElement('div');

    var currentChunkHtml = '<h1 style="font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">' + title + '</h1>'
      + '<p style="color:#78716c;margin:0 0 16px;font-size:13px;">Assessment Results &mdash; ' + new Date().toLocaleDateString() + '</p>'
      + '<div style="background:#f8f6f1;border-radius:12px;padding:18px 20px;margin-bottom:22px;border:1px solid #d0ccc5;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">'
      +   '<div style="width:84px;height:84px;border-radius:50%;border:4px solid #c27803;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;background:rgba(194,120,3,.10);">'
      +     '<div style="font-size:20px;font-weight:700;color:#c27803;line-height:1;">' + pct + '</div>'
      +     '<div style="font-size:9px;color:#78716c;text-transform:uppercase;letter-spacing:.04em;">Pass Rate</div>'
      +   '</div>'
      +   '<div style="flex:1;min-width:180px;">'
      +     '<h2 style="font-family:Georgia,serif;font-size:17px;margin:0 0 10px;">' + grade + '</h2>'
      +     '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#16a34a;">' + passed + '</div><div style="font-size:10px;color:#78716c;">Passed</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#dc2626;">' + failed + '</div><div style="font-size:10px;color:#78716c;">Failed</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#78716c;">' + skipped + '</div><div style="font-size:10px;color:#78716c;">Skipped</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#2563eb;">' + flagged + '</div><div style="font-size:10px;color:#78716c;">Flagged</div></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:0 0 12px;">'
      +   (filterLabels[filter] || 'Questions') + ' (' + toExport.length + ')'
      + '</h3>';

    var questionsPerChunk = 15;

    toExport.forEach(function(item, idx) {
      var q = item.q, i = item.i;
      var evPassed = item.evPassed, isSkipped = item.isSkipped, isFlagged = item.isFlagged;
      var sc = isSkipped ? '#78716c' : (evPassed ? '#16a34a' : '#dc2626');
      var icon = isSkipped ? '-' : (evPassed ? 'OK' : 'X');
      var bgH = isSkipped ? '#f8f6f1' : (evPassed ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.06)');
      var userAnswer = state.answers[i] || '';

      currentChunkHtml += '<div style="border:1.5px solid ' + sc + ';border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">'
        +   '<div style="padding:12px 15px;background:' + bgH + ';">'
        +     '<div style="display:flex;gap:10px;align-items:flex-start;">'
        +       '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + sc + ';">' + icon + '</div>'
        +       '<div>'
        +         '<div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Q' + (i+1) + (isFlagged ? ' &bull; Flagged' : '') + '</div>'
        +         '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + q.question + '</div>'
        +       '</div>'
        +     '</div>'
        +   '</div>'
        +   '<div style="padding:10px 15px 12px;border-top:1px solid #e5e0db;">'
        +     '<div style="background:' + (evPassed ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.08)') + ';border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Your Answer</span>' + (userAnswer || 'Not answered') + '</div>'
        +     '<div style="background:rgba(22,163,74,.08);border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Model Answer</span>' + (q.modelAnswer || '(No model answer supplied)') + '</div>'
        + (q.explanation ? '<div style="background:#f8f6f1;border-left:3px solid #c27803;border-radius:0 6px 6px 0;padding:9px 11px;font-size:12px;color:#44403c;line-height:1.6;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1c1917;margin-bottom:3px;">Explanation</div>' + q.explanation + '</div>' : '')
        + '</div></div>';

      if ((idx + 1) % questionsPerChunk === 0 || idx === toExport.length - 1) {
        var chunkDiv = document.createElement('div');
        chunkDiv.innerHTML = '<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;color:#1c1917;">' + currentChunkHtml + '</div>';
        container.appendChild(chunkDiv);
        currentChunkHtml = '';
      }
    });

    var filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_results.pdf';
    var opt = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    function runExport() {
      var children = Array.from(container.children);
      if (children.length === 0) return;

      var worker = html2pdf().set(opt).from(children[0]).toPdf();

      children.slice(1).forEach(function(child) {
        worker = worker.get('pdf').then(function(pdf) {
          pdf.addPage();
        }).from(child).toContainer().toCanvas().toPdf();
      });

      worker.save().catch(function() {});
    }

    if (typeof html2pdf !== 'undefined') {
      runExport();
    } else {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = runExport;
      s.onerror = function() { showToast('Failed to load PDF library'); };
      document.head.appendChild(s);
    }
  }

  function confirmResetProgress() {
    $('#reset-modal').classList.add('open');
  }

  function closeResetModal() {
    $('#reset-modal').classList.remove('open');
  }

  function confirmResetAction() {
    state.answers = {};
    state.evaluations = {};
    state.flagged = {};
    localStorage.removeItem(STORAGE.progress);
    closeResetModal();
    currentIndex = 0;
    showScreen('start-screen');
    updateResumeButton();
    showToast('Progress has been reset.');
  }

  function saveApiKey() {
    var value = ($('#api-key').value || '').trim();
    if (value) {
      _writeKey(value);
      tryStoreInCredentialManager(value);
      showToast('API key saved.');
    } else {
      _writeKey('');
      showToast('API key cleared from this browser.');
    }
  }

  function tryStoreInCredentialManager(key) {
    if (!navigator.credentials || !window.PasswordCredential) return;
    try {
      var cred = new PasswordCredential({
        id: 'gemini_api_key',
        name: 'Gemini API Key (QuizTool Written Assessment)',
        password: key
      });
      navigator.credentials.store(cred).catch(function () {});
    } catch (_) {}
  }

  function tryRestoreApiKeyFromCredentialManager() {
    if (!navigator.credentials || !navigator.credentials.get) return;
    navigator.credentials.get({ password: true }).then(function (cred) {
      if (!cred || cred.id !== 'gemini_api_key') return;
      var stored = cred.password;
      if (stored && stored !== _readKey()) {
        _writeKey(stored);
        $('#api-key').value = stored;
      }
    }).catch(function () {});
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE.theme, next);
    document.body.style.background = next === 'light' ? '#f3f0eb' : '#0d1117';
    document.body.style.color = next === 'light' ? '#1c1917' : '#e6edf3';
    updateThemeButtons();
  }

  function updateThemeButtons() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    $all('#theme-start,#theme-practice,#theme-result').forEach(function (btn) {
      btn.textContent = isDark ? '☀' : '☾';
    });
  }

  function setLoading(active) {
    $('#loading').classList.toggle('active', !!active);
    $('#ai-grade').disabled = !!active;
    $('#self-grade').disabled = !!active;
  }

  function showToast(message) {
    var t = document.getElementById('toast');
    t.textContent = message;
    t.classList.remove('show');
    void t.offsetHeight;
    t.classList.add('show');
    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(function () {
      t.classList.remove('show');
    }, 2500);
  }

  function loadProgress() {
    var raw = localStorage.getItem(STORAGE.progress);
    if (!raw) return;
    try {
      var saved = JSON.parse(raw);
      state.answers = saved.answers || {};
      state.evaluations = saved.evaluations || {};
      state.flagged = saved.flagged || {};
    } catch (error) {
      console.error('Could not restore written assessment progress.', error);
    }
  }

  function saveProgress() {
    var payload = {
      answers: state.answers,
      evaluations: state.evaluations,
      flagged: state.flagged,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(STORAGE.progress, JSON.stringify(payload));
    } catch (error) {
      showToast('Storage full. Clear old tracker data to keep saving.');
    }
  }

  function init() {
    initAssets();
    initStyles();
    initMarkup();
    loadProgress();
    initContent();
    bindEvents();
  }

  window.startWrittenAssessment = beginAssessment;
  window.toggleWrittenTheme = toggleTheme;
  window.filterResults = filterResults;
  window.restartAssessment = restartAssessment;
  window.toggleResultItem = toggleResultItem;
  window.exportToPDF = exportToPDF;
  window.onExportFilterChange = onExportFilterChange;

  init();
})();
