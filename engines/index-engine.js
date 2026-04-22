/* ================================================================
   index-engine.js  —  Shared engine for all index/hub pages.
   Handles theme toggle, quiz card rendering, review mode, and PDF export.
   Tracker dashboard UI is now in dash-ui.js (loaded by bootstrap).
   Load this after defining QUIZZES config and #quiz-grid element.
   ================================================================ */
(function () {
  'use strict';

  var _cs = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : '';

  // Expose for dash-ui.js (loaded after this file)
  window.__IndexEngineBase = ENGINE_BASE;

  /* ── Bootstrap: load shared dependencies if not present ─────── */
  if (!window.__TrackerStorageLoaded || !window.__DashUILoaded) {
    var deps = '';
    if (!window.__TrackerStorageLoaded) deps += '<script src="' + ENGINE_BASE + 'tracker-storage.js"><\/script>';
    if (!window.__DashUILoaded) deps += '<script src="' + ENGINE_BASE + 'dash-ui.js"><\/script>';
    deps += '<script src="' + ENGINE_BASE + 'index-engine.js"><\/script>';
    document.write(deps);
    return;
  }

  // Initialize tracker root name for path computation
  QuizTracker.initRootName(ENGINE_BASE);


  /* ── Toast Notification Styles ────────────────────────────── */
  var _toastStyle = document.createElement('style');
  _toastStyle.textContent = '.toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(80px);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.65rem 1.2rem;font-size:0.88rem;font-weight:500;box-shadow:var(--shadow);z-index:9999;transition:transform 0.3s ease,opacity 0.3s ease;white-space:nowrap;display:flex;align-items:center;gap:0.5rem;max-width:90%}.toast.show{transform:translateX(-50%) translateY(0)}';
  document.head.appendChild(_toastStyle);
  
  /* ── Modal Styles ─────────────────────────────────────────── */
  var _modalStyle = document.createElement('style');
  _modalStyle.textContent = '.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2100;display:none;align-items:center;justify-content:center;padding:1rem}.modal-overlay.open{display:flex}.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:2rem;max-width:420px;width:100%;box-shadow:var(--shadow);animation:modalIn 0.38s var(--ease-spring) both}.modal h3{font-family:\'Playfair Display\',serif;font-size:1.3rem;margin-bottom:0.75rem}.modal p{color:var(--text-muted);font-size:0.9rem;line-height:1.6;margin-bottom:1.25rem}.modal-actions{display:flex;gap:0.75rem}.modal-actions .btn-cancel{flex:1;padding:0.75rem;border-radius:10px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-weight:600;font-size:0.9rem;transition:border-color 0.2s var(--ease-out), background 0.2s var(--ease-out)}.modal-actions .btn-cancel:hover{border-color:var(--accent)}.modal-actions .btn-confirm{flex:1;padding:0.75rem;border-radius:10px;background:var(--correct);border:none;color:#fff;font-weight:700;font-size:0.9rem;transition:opacity 0.2s var(--ease-out)}.modal-actions .btn-confirm:hover{opacity:0.85}.modal-actions .btn-confirm.danger{background:var(--wrong)}@keyframes modalIn{from{opacity:0;transform:translateY(28px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}';
  document.head.appendChild(_modalStyle);
  
  /* ── Toast HTML Element ───────────────────────────────────── */
  var _toastEl = document.createElement('div');
  _toastEl.id = 'toast';
  _toastEl.className = 'toast';
  document.body.appendChild(_toastEl);
  
  /* ── Toast Function ───────────────────────────────────────── */
  var toastTimer;
  window.showToast = function(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    clearTimeout(toastTimer);
    t.innerHTML = '';
    var msgSpan = document.createElement('span');
    msgSpan.textContent = msg;
    t.appendChild(msgSpan);
    t.classList.add('show');
    toastTimer = setTimeout(function() {
      t.classList.remove('show');
    }, 2200);
  };

  /* ── Inject Animation System v2 ────────────────────────────── */
  var _animStyle = document.createElement('style');
  _animStyle.textContent = '/* ════════════════════════════════════════════════════════════════\n   SMOOTH ANIMATION SYSTEM  v2 (Mobile Optimized)\n   Easing · Entrance · Hover · Press · Modal · Ripple\n════════════════════════════════════════════════════════════════ */\n\n/* ── Easing tokens ──────────────────────────────────────────── */\n:root {\n  --ease-out    : cubic-bezier(0.16, 1, 0.3, 1);\n  --ease-spring : cubic-bezier(0.34, 1.56, 0.64, 1);\n  --ease-in-out : cubic-bezier(0.65, 0, 0.35, 1);\n  --transition  : 0.22s cubic-bezier(0.16, 1, 0.3, 1);\n}\n\n/* ── Page-load entrance keyframes ──────────────────────────── */\n@keyframes slideDown {\n  from { opacity: 0; transform: translateY(-18px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n@keyframes fadeUp {\n  from { opacity: 0; transform: translateY(24px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n@keyframes fadeIn {\n  from { opacity: 0; }\n  to   { opacity: 1; }\n}\n@keyframes cardReveal {\n  from { opacity: 0; transform: translateY(32px) scale(0.96); }\n  to   { opacity: 1; transform: translateY(0)    scale(1);    }\n}\n@keyframes iconPop {\n  0%   { transform: scale(0.7); opacity: 0; }\n  60%  { transform: scale(1.15); }\n  100% { transform: scale(1);    opacity: 1; }\n}\n\n/* ── Topbar ─────────────────────────────────────────────────── */\n.topbar {\n  animation: slideDown 0.45s var(--ease-out) both;\n}\n\n/* ── Hero ────────────────────────────────────────────────────── */\n.hero h1 {\n  animation: fadeUp 0.55s 0.1s var(--ease-out) both;\n}\n.hero p {\n  animation: fadeUp 0.55s 0.22s var(--ease-out) both;\n}\n\n/* ── Card entrance (stagger via --i set by JS) ──────────────── */\n.quiz-card {\n  animation: cardReveal 0.5s calc(0.28s + var(--i, 0) * 70ms) var(--ease-out) both;\n}\n\n/* ── Card icon pop ──────────────────────────────────────────── */\n.card-icon {\n  animation: iconPop 0.5s calc(0.38s + var(--i, 0) * 70ms) var(--ease-spring) both;\n}\n\n/* ── Card hover: simplified for mobile performance ─────────── */\n.quiz-card {\n  transition:\n    transform      0.32s var(--ease-out),\n    box-shadow     0.32s var(--ease-out),\n    border-color   0.28s var(--ease-out);\n}\n.quiz-card:hover {\n  transform   : translateY(-6px);\n  border-color: var(--accent);\n  box-shadow  : 0 16px 32px rgba(0,0,0,0.15);\n}\n\n/* ── Card active press ──────────────────────────────────────── */\n.quiz-card:active {\n  transform   : translateY(-2px) scale(0.99) !important;\n  transition-duration: 0.1s !important;\n}\n\n/* ── Card icon: removed rotation for mobile performance ─────── */\n.quiz-card:hover .card-icon {\n  transform : scale(1.08);\n  transition: transform 0.35s var(--ease-spring);\n}\n.quiz-card .card-icon {\n  transition: transform 0.28s var(--ease-out);\n}\n\n/* ── Primary button ─────────────────────────────────────────── */\n.btn-take-quiz {\n  position  : relative;\n  overflow  : hidden;\n  transition:\n    opacity    0.22s var(--ease-out),\n    transform  0.22s var(--ease-out),\n    box-shadow 0.22s var(--ease-out) !important;\n}\n.btn-take-quiz:hover {\n  opacity   : 1 !important;\n  transform : translateY(-2px) !important;\n  box-shadow: 0 8px 24px rgba(0,0,0,0.15);\n}\n.btn-take-quiz:active {\n  transform : scale(0.97) translateY(0px) !important;\n  transition-duration: 0.09s !important;\n}\n\n/* ── GitHub button (QuizTool) ───────────────────────────────── */\n.github-btn {\n  position  : relative;\n  overflow  : hidden;\n  transition:\n    transform    0.28s var(--ease-out),\n    border-color 0.22s var(--ease-out),\n    color        0.22s var(--ease-out),\n    box-shadow   0.28s var(--ease-out) !important;\n}\n.github-btn:hover {\n  transform   : translateY(-3px);\n  border-color: var(--accent);\n  color       : var(--accent);\n  box-shadow  : 0 6px 20px rgba(0,0,0,0.12);\n}\n.github-btn:active {\n  transform      : scale(0.97) !important;\n  transition-duration: 0.09s !important;\n}\n\n/* ── Ripple wave ─────────────────────────────────────────────── */\n@keyframes ripple {\n  to { transform: scale(4); opacity: 0; }\n}\n.ripple-wave {\n  position      : absolute;\n  border-radius : 50%;\n  width         : 50px;\n  height        : 50px;\n  margin-top    : -25px;\n  margin-left   : -25px;\n  background    : rgba(255, 255, 255, 0.3);\n  transform     : scale(0);\n  animation     : ripple 0.4s var(--ease-out) forwards;\n  pointer-events: none;\n}\n\n/* ── Icon buttons ───────────────────────────────────────────── */\n.icon-btn {\n  transition: all 0.22s var(--ease-out) !important;\n}\n.icon-btn:hover {\n  transform: translateY(-1px);\n  color: var(--text) !important;\n  border-color: var(--accent) !important;\n}\n.icon-btn:active {\n  transform      : scale(0.87) !important;\n  transition-duration: 0.08s !important;\n}\n\n/* ── Theme toggle spin ──────────────────────────────────────── */\n@keyframes spinPop {\n  0%   { transform: rotate(0deg)   scale(1);    }\n  50%  { transform: rotate(180deg) scale(0.9); }\n  100% { transform: rotate(360deg) scale(1);    }\n}\n.theme-spinning {\n  animation: spinPop 0.4s var(--ease-out) forwards !important;\n}\n\n/* ── Tracker badge pulse ────────────────────────────────────── */\n@keyframes badgePulse {\n  0%   { transform: scale(1);    }\n  50%  { transform: scale(1.25); }\n  100% { transform: scale(1);    }\n}\n.tracker-badge:not(:empty) {\n  animation: badgePulse 0.3s var(--ease-out);\n}\n\n/* ── Dash overlay: removed expensive blur for mobile ────────── */\n@keyframes overlayIn {\n  from { opacity: 0; }\n  to   { opacity: 1; }\n}\n.dash-overlay.open {\n  animation: overlayIn 0.25s var(--ease-out) both !important;\n}\n\n/* ── Modal: simplified animation ────────────────────────────── */\n@keyframes modalIn {\n  from { opacity: 0; transform: translateY(20px) scale(0.95); }\n  to   { opacity: 1; transform: translateY(0)    scale(1);    }\n}\n.dash-modal {\n  animation: modalIn 0.3s var(--ease-out) both !important;\n}\n\n/* ── Modal close ────────────────────────────────────────────── */\n@keyframes modalOut {\n  from { opacity: 1; transform: translateY(0)    scale(1);    }\n  to   { opacity: 0; transform: translateY(12px) scale(0.97); }\n}\n.dash-overlay.closing {\n  animation: overlayOut 0.2s var(--ease-out) both !important;\n}\n.dash-overlay.closing .dash-modal {\n  animation: modalOut 0.2s var(--ease-out) both !important;\n}\n@keyframes overlayOut {\n  from { opacity: 1; }\n  to   { opacity: 0; }\n}\n\n/* ── Dash q-item hover ──────────────────────────────────────── */\n.dash-q-item {\n  transition:\n    border-color 0.2s var(--ease-out),\n    transform    0.2s var(--ease-out),\n    background   0.2s var(--ease-out) !important;\n}\n.dash-q-item:hover {\n  border-color: var(--accent);\n  transform   : translateX(3px);\n}\n\n/* ── Dash close/action buttons ──────────────────────────────── */\n.dash-close-btn:active,\n.btn-dash-action:active,\n.btn-dash-close:active {\n  transform      : scale(0.94) !important;\n  transition-duration: 0.08s !important;\n}\n\n/* ── Footer note ────────────────────────────────────────────── */\n.footer-note {\n  animation: fadeIn 0.6s 0.7s var(--ease-out) both;\n}\n\n/* ── Mobile optimization: disable heavy animations on touch devices ── */\n@media (max-width: 768px), (hover: none), (pointer: coarse) {\n  .quiz-card:hover {\n    transform: none;\n    box-shadow: none;\n  }\n  .quiz-card:hover .card-icon {\n    transform: none;\n  }\n  .btn-take-quiz:hover,\n  .github-btn:hover {\n    transform: none;\n  }\n  .icon-btn:hover {\n    transform: none;\n  }\n}\n\n/* ── Respect prefers-reduced-motion ─────────────────────────── */\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration  : 0.01ms !important;\n    animation-delay     : 0ms    !important;\n    transition-duration : 0.01ms !important;\n  }\n}';
  document.head.appendChild(_animStyle);

  /* ── Theme ─────────────────────────────────────────────────── */
  var savedTheme = localStorage.getItem('quiz-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  window.toggleTheme = function () {
    var html = document.documentElement;
    var isDark = html.getAttribute('data-theme') === 'dark';
    var newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('quiz-theme', newTheme);
    window.__updateThemeIcon && window.__updateThemeIcon();
  };

  window.__updateThemeIcon = function () {
    var el = document.getElementById('theme-toggle');
    if (!el) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    el.textContent = isDark ? '\u2600' : '\u263E';
  };
  window.__updateThemeIcon();

  /* ── Render quizzes ────────────────────────────────────────── */
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  window.renderQuizzes = function () {
    var grid = document.getElementById('quiz-grid');
    if (!grid || typeof QUIZZES === 'undefined') return;
    grid.innerHTML = QUIZZES.map(function (quiz) {
      return '<div class="quiz-card">'
        + '<div class="card-icon">' + escHtml(quiz.icon) + '</div>'
        + '<h2 class="card-title">' + escHtml(quiz.title) + '</h2>'
        + '<p class="card-desc">' + escHtml(quiz.description) + '</p>'
        + '<div class="card-meta">'
        +   (quiz.tags || []).map(function (t) { return '<span class="meta-badge">' + escHtml(t) + '</span>'; }).join('')
        + '</div>'
        + '<a href="' + escHtml(quiz.url) + '" class="btn-take-quiz">Start \u2192</a>'
        + '</div>';
    }).join('');
  };

  /* ── Tracker storage (using shared QuizTracker API) ────────── */
  // All storage, path normalization, and data functions are now in tracker-storage.js
  // Access via: QuizTracker.getAllTrackerData(), QuizTracker.getDataForScope(), etc.
  // Dashboard UI is now in dash-ui.js — functions accessed via window.* globals


  function fetchAndParseQuestions(path) {
    var url = window.location.origin + path;
    if (path && window.location.pathname.endsWith('index.html') && path.startsWith('.')) {
        url = new URL(path, window.location.href).href;
    } else if (path && !path.startsWith('http') && !path.startsWith('/')) {
        var rootAbs = new URL(ENGINE_BASE || '', window.location.href).href;
        url = rootAbs + path;
    } else if (path && path.startsWith('/')) {
        url = location.origin + path;
    }

    return fetch(url)
      .then(function(r) { return r.ok ? r.text() : null; })
      .then(function(html) {
        if (!html) return null;
        var match = html.match(/\/\*\s*\[QUESTIONS_START\]\s*\*\/([\s\S]*?)\/\*\s*\[QUESTIONS_END\]\s*\*\//);
        if (!match) {
          match = html.match(/\/\*\s*\[QUESTION_BANK_START\]\s*\*\/([\s\S]*?)\/\*\s*\[QUESTION_BANK_END\]\s*\*\//);
        }
        if (!match) return null;
        var block = match[1].trim();
        block = block.replace(/^const\s+(?:QUESTIONS|QUESTION_BANK)\s*=\s*/, '').replace(/;\s*$/, '');
        
        try {
          var arr;
          eval('arr = ' + block + ';');
          if (Array.isArray(arr)) return arr;
        } catch(e) {}
        
        try { return JSON.parse(block); } catch(e) { return null; }
      })
      .catch(function() { return null; });
  }

  var _isSyncRequested = true;
  var _currentReviewQs = [];

  window.startReviewMode = function() {
    var data = QuizTracker.getDataForScope(window.__DashState.currentScope, window.__DashState.currentScopePath);
    
    data = data.filter(function(d) {
        return window.__DashState._selectedQuizzes[d.uid] !== false;
    });

    if (!data || !data.length) {
      showToast('No questions selected. Please check at least one folder.');
      return;
    }
    
    var b = document.getElementById('dash-body');
    if (b) b.innerHTML = '<div class="dash-empty" style="padding:4rem 1rem;"><div>Generating review session...</div></div>';
    
    var qByPath = {};
    data.forEach(function(d) {
      var p = d.path || '';
      if (!qByPath[p]) qByPath[p] = { uid: d.uid, title: d.title || 'Unknown', qs: [] };
      
      var seenMsg = {};
      (d.wrong || []).forEach(function(q) {
        if (!seenMsg[q.idx]) { seenMsg[q.idx] = true; qByPath[p].qs.push({ q: q, type: 'wrong' }); }
      });
      (d.flagged || []).forEach(function(q) {
        if (!seenMsg[q.idx]) { seenMsg[q.idx] = true; qByPath[p].qs.push({ q: q, type: 'flagged' }); }
      });
    });

    var paths = Object.keys(qByPath);
    var fetches = paths.map(function(p) {
        if (!p) return Promise.resolve({ p: p, arr: null });
        return fetchAndParseQuestions(p).then(function(arr) { return { p: p, arr: arr }; });
    });

    Promise.all(fetches).then(function(results) {
      var arrMap = {};
      results.forEach(function(res) { arrMap[res.p] = res.arr; });

      var finalQs = [];
      paths.forEach(function(p) {
        var group = qByPath[p];
        var sourceArr = arrMap[p];
        
        group.qs.forEach(function(item) {
          var tq = item.q;
          var srcQuestion = (sourceArr && sourceArr[tq.idx]) ? sourceArr[tq.idx] : null;

          if (srcQuestion && srcQuestion.options && srcQuestion.options.length) {
            finalQs.push({
              question: '<span style="font-size:0.7em;color:var(--text-muted);display:block;margin-bottom:8px;">\uD83D\uDCC1 ' + escHtml(group.title) + '</span>' + (srcQuestion.question || tq.text),
              options: srcQuestion.options,
              correct: srcQuestion.correct,
              explanation: srcQuestion.explanation || tq.explanation || '',
              _sourceUid: group.uid,
              _sourceIdx: tq.idx
            });
          } else {
            var cText = (tq.correctAnswer || '').replace(/^[A-Z]\.\s*/, '');
            var yText = (tq.yourAnswer || '').replace(/^[A-Z]\.\s*/, '');
            var isNotAns = tq.yourAnswer === 'Not answered';
            var opts = [cText];
            if (!isNotAns && yText && yText !== cText) opts.push(yText);
            
            for (var i = opts.length - 1; i > 0; i--) {
              var j = Math.floor(Math.random() * (i + 1));
              var temp = opts[i]; opts[i] = opts[j]; opts[j] = temp;
            }
            var cIdx = opts.indexOf(cText);
            
            finalQs.push({
              question: '<span style="font-size:0.7em;color:var(--text-muted);display:block;margin-bottom:8px;">\uD83D\uDCC1 ' + escHtml(group.title) + '</span>' + tq.text,
              options: opts,
              correct: cIdx,
              explanation: tq.explanation || '',
              _sourceUid: group.uid,
              _sourceIdx: tq.idx
            });
          }
        });
      });

      for (var k = finalQs.length - 1; k > 0; k--) {
        var m = Math.floor(Math.random() * (k + 1));
        var tmp2 = finalQs[k]; finalQs[k] = finalQs[m]; finalQs[m] = tmp2;
      }

      if (!finalQs.length) {
        if (b) b.innerHTML = '<div class="dash-empty"><div>No questions found.</div></div>';
        return;
      }

      // Update footer button to launch final session
      var revBtn = document.getElementById('btn-start-review');
      if (revBtn) {
        revBtn.textContent = 'Start Session \u2192';
        revBtn.onclick = launchReviewFinal;
      }

      renderReviewSetup(finalQs);
    });
  };

  function renderReviewSetup(qs) {
    var b = document.getElementById('dash-body');
    if (!b) return;
    var count = qs.length;
    
    var html = '<div class="dash-empty" style="padding:2rem 1rem; text-align:center;">';
    html += '<div style="font-size:1.4rem; color:var(--text); margin-bottom:1.5rem; font-family:\'Playfair Display\', serif;">\uD83D\uDCDD Review Mode</div>';
    html += '<p style="color:var(--text-muted); margin-bottom:2rem; line-height:1.6;">You are about to review <strong>' + count + '</strong> questions from your tracker.</p>';
    
    html += '<label style="display:flex; align-items:center; justify-content:center; gap:0.75rem; background:var(--surface2); padding:0.9rem 1.4rem; border-radius:14px; border:1px solid var(--border); cursor:pointer; margin-bottom:2.5rem; margin-inline:auto; max-width:fit-content; transition: border-color 0.2s;">';
    html += '<input type="checkbox" id="rev-sync-checkbox" checked style="width:20px; height:20px; accent-color:var(--correct); cursor:pointer;">';
    html += '<span style="font-size:0.92rem; font-weight:500;">Remove corrected questions from tracker</span>';
    html += '</label>';
    
    html += '</div>';
    
    b.innerHTML = html;
    _currentReviewQs = qs;
  }

  window.launchReviewFinal = function() {
    var qs = _currentReviewQs;
    var isSyncChecked = document.getElementById('rev-sync-checkbox').checked;
    _isSyncRequested = isSyncChecked;

    closeTrackerDashboard(true);
    history.pushState({ dash: 'review' }, '');
    window.__DashState._activeDashboard = 'review';

    var useBank = qs.length > 40;
    var engineScript = useBank ? 'bank-engine.js' : 'quiz-engine.js';
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    // Purge previous review session state to ensure a fresh batch start
    localStorage.removeItem('quiz_progress_v1_review_session');
    localStorage.removeItem('bank_progress_v1_review_session');

    var blobHTML = '<!DOCTYPE html>\n<html lang="en" data-theme="' + currentTheme + '">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<script>(function(){' +
      'var t="' + currentTheme + '";' +
      'var s=document.createElement("style");' +
      's.textContent="html,body{background:"+(t==="light"?"#f3f0eb":"#0d1117")+";color:"+(t==="light"?"#1c1917":"#e6edf3")+";margin:0;padding:0;overflow:hidden;height:100%}";' +
      'document.head.appendChild(s);' +
      '})();</script>\n' +
      '<base href="' + window.location.href + '">\n' +
      '<title>Review Session</title>\n' +
      '<script>\n' +
      '  localStorage.setItem("quiz-theme", "' + currentTheme + '");\n' +
      '  window.__QUIZ_ENGINE_BASE = "' + (ENGINE_BASE || '') + '";\n' +
      '  const QUIZ_CONFIG = { uid: "review_session", title: "Review Mode", description: "Reviewing mistakes across sections" };\n' +
      '  const BANK_CONFIG = { uid: "review_session", title: "Review Mode", description: "Reviewing mistakes across sections" };\n' +
      '  const QUESTIONS = ' + JSON.stringify(qs) + ';\n' +
      '  const QUESTION_BANK = QUESTIONS;\n' +
      '  window.navigateToIndex = function(e){\n' +
      '    if(e) e.preventDefault();\n' +
      '    try { window.parent.postMessage("close-review", "*"); } catch(err){}\n' +
      '  };\n' +
      '</script>\n' +
      '</head>\n<body>\n' +
      '<script src="' + (ENGINE_BASE || '') + engineScript + '"></script>\n' +
      '<script>\n' +
      '  (function(){\n' +
      '    const originalSave = window.saveTrackerData;\n' +
      '    window.saveTrackerData = function() {\n' +
      '      const correct = [];\n' +
      '      const qsArr = (typeof SESSION_QUESTIONS !== "undefined") ? SESSION_QUESTIONS : QUESTIONS;\n' +
      '      qsArr.forEach((q, i) => {\n' +
      '        if (typeof state !== "undefined" && state.answers[i] === q.correct && q._sourceUid) {\n' +
      '          correct.push({ uid: q._sourceUid, idx: q._sourceIdx });\n' +
      '        }\n' +
      '      });\n' +
      '      if (correct.length > 0) {\n' +
      '        try { window.parent.postMessage({ type: "review-sync", correctItems: correct }, "*"); } catch(err){}\n' +
      '      }\n' +
      '    };\n' +
      '  })();\n' +
      '</script>\n' +
      '</body>\n</html>';

    // Use srcdoc for better Service Worker and Origin inheritance (Offline PWA compatibility)
    // Note: single quotes in JSON stringified data are fine because they are double-quoted in JSON.
    // However, we escape the HTML string for safe insertion into the attribute.
    var iframe = document.createElement('iframe');
    iframe.id = 'review-iframe';
    iframe.srcdoc = blobHTML;
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.background = currentTheme === 'light' ? '#f3f0eb' : '#0d1117';
    
    document.body.appendChild(iframe);
  };


  window.closeReviewMode = function(fromPopState) {
    if (!fromPopState && (window.__DashState._activeDashboard === 'review' || document.getElementById('review-iframe'))) {
      if (window.__DashState._activeDashboard === 'review') {
        history.back();
        return;
      }
    }
    window.__DashState._activeDashboard = null;
    var iframe = document.getElementById('review-iframe');
    if (iframe) {
      iframe.remove();
      // Re-open dashboard instantly when exiting review to show changes!
      openTrackerDashboard(null, true);
    }
  };

  window.addEventListener('message', function(e) {
      if (e.data === 'close-review') {
          closeReviewMode();
      } else if (e.data && e.data.type === 'review-sync') {
          if (_isSyncRequested && Array.isArray(e.data.correctItems)) {
              batchRemoveTrackerItems(e.data.correctItems);
          }
      }
  });

  window.addEventListener('popstate', function(e) {
    var state = e.state;
    if (state && state.dash === 'tracker') {
      openTrackerDashboard(null, true);
    } else if (state && state.dash === 'review') {
      // Review mode is launched via launchReviewFinal; 
      // if we're here, it means we went forward to a review state.
      // For simplicity, we just close everything if the state is unexpected.
    } else {
      // No dashboard state -> close any open overlays
      if (window.__DashState._activeDashboard === 'tracker') closeTrackerDashboard(true);
      
      // Always check for and remove review iframe when navigating to a non-review state
      var iframe = document.getElementById('review-iframe');
      if (iframe) iframe.remove();
      if (window.__DashState._activeDashboard === 'review') window.__DashState._activeDashboard = null;
    }
  });

  /* ── PDF Export ────────────────────────────────────────────── */
  window.exportTrackerToPDF = function () {
    var data = QuizTracker.getDataForScope(window.__DashState.currentScope, window.__DashState.currentScopePath);
    
    // Filter data based on explicitly selected quizzes
    data = data.filter(function (d) {
      return window.__DashState._selectedQuizzes[d.uid] !== false;
    });

    if (!data.length) { showToast('No tracked questions to export.'); return; }

    var totalWrong = 0, totalFlagged = 0;
    data.forEach(function (d) { totalWrong += (d.wrong || []).length; totalFlagged += (d.flagged || []).length; });
    // Use cached folder title for PDF scope label instead of raw path
    var scopeFolderKey = window.__DashState.currentScopePath ? window.__DashState.currentScopePath + '/' : '';
    var scopeLabel = window.__DashState.currentScope === 'folder'
      ? (QuizTracker._folderTitleCache[scopeFolderKey] || decodeURIComponent(window.__DashState.currentScopePath))
      : 'Selected Exams';
    var now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var html = '<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;color:#1c1917;">'
      + '<h1 style="font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">\uD83D\uDCCA Question Tracker</h1>'
      + '<p style="color:#78716c;margin:0 0 4px;font-size:13px;">Scope: ' + scopeLabel + ' &mdash; ' + now + '</p>'
      + '<div style="background:#f8f6f1;border-radius:12px;padding:18px 20px;margin-bottom:22px;border:1px solid #d0ccc5;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">'
      +   '<div style="flex:1;min-width:180px;">'
      +     '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#dc2626;">' + totalWrong + '</div><div style="font-size:10px;color:#78716c;">Wrong</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#2563eb;">' + totalFlagged + '</div><div style="font-size:10px;color:#78716c;">Flagged</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#16a34a;">' + data.length + '</div><div style="font-size:10px;color:#78716c;">Quizzes</div></div>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    data.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    data.forEach(function (d) {
      var wrongItems = d.wrong || [], flaggedItems = d.flagged || [];
      var wrongIdxs = {};
      wrongItems.forEach(function (q) { wrongIdxs[q.idx] = true; });
      var uniqueFlagged = flaggedItems.filter(function (q) { return !wrongIdxs[q.idx]; });
      if (!wrongItems.length && !uniqueFlagged.length) return;

      html += '<h3 style="font-size:14px;margin:18px 0 8px;font-family:Georgia,serif;">' + (d.title || 'Quiz') + '</h3>';

      var allItems = [];
      wrongItems.forEach(function (q) {
        var also = flaggedItems.some(function (f) { return f.idx === q.idx; });
        allItems.push({ q: q, type: also ? 'Wrong + Flagged' : 'Wrong', color: '#dc2626', bg: 'rgba(220,38,38,.06)' });
      });
      uniqueFlagged.forEach(function (q) {
        allItems.push({ q: q, type: 'Flagged', color: '#2563eb', bg: 'rgba(37,99,235,.06)' });
      });

      allItems.forEach(function (item) {
        var q = item.q;
        html += '<div style="border:1.5px solid ' + item.color + ';border-radius:10px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid;">'
          + '<div style="padding:12px 15px;background:' + item.bg + ';">'
          + '<div style="display:flex;gap:10px;align-items:flex-start;">'
          + '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + item.color + ';">' + (item.type === 'Flagged' ? '\u2691' : '\u2717') + '</div>'
          + '<div><div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Q' + ((q.idx || 0) + 1) + ' \u00B7 ' + item.type + '</div>'
          + '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + q.text + '</div></div></div></div>'
          + '<div style="padding:10px 15px 12px;border-top:1px solid #e5e0db;">'
          + '<div style="background:rgba(220,38,38,.08);border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Your Answer</span>' + q.yourAnswer + '</div>'
          + '<div style="background:rgba(22,163,74,.08);border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Correct Answer</span>' + q.correctAnswer + '</div>';
        if (q.explanation) {
          html += '<div style="background:#f8f6f1;border-left:3px solid #c27803;border-radius:0 6px 6px 0;padding:9px 11px;font-size:12px;color:#44403c;line-height:1.6;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1c1917;margin-bottom:3px;">Explanation</div>' + q.explanation + '</div>';
        }
        html += '</div></div>';
      });
    });
    html += '</div>';

    var filename = 'question_tracker_' + scopeLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    var opt = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    var container = document.createElement('div');
    container.innerHTML = html;

    function runExport() {
      html2pdf().set(opt).from(container).save().catch(function () {});
    }

    if (typeof html2pdf !== 'undefined') {
      runExport();
    } else {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = runExport;
      s.onerror = function () { showToast('Failed to load PDF library'); };
      document.head.appendChild(s);
    }
  };

  /* ── Init ──────────────────────────────────────────────────── */
  // updateBadge() is now called by dash-ui.js on init
  window.__indexEngineReady = true;

  /* ── Animation Helpers ─────────────────────────────────────── */
  (function () {
    'use strict';

    /* 1. Stagger cards by setting CSS --i on each .quiz-card */
    function staggerCards() {
      document.querySelectorAll('.quiz-card').forEach(function (card, i) {
        card.style.setProperty('--i', i);
      });
    }

    /* Patch renderQuizzes to stagger after each render */
    var _origRender = window.renderQuizzes;
    window.renderQuizzes = function () {
      if (_origRender) _origRender.apply(this, arguments);
      staggerCards();
    };

    /* Also stagger whatever is already in the DOM */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', staggerCards);
    } else {
      staggerCards();
    }

    /* 2. Ripple effect for primary CTA + github buttons */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-take-quiz, .github-btn');
      if (!btn) return;
      var wave = document.createElement('span');
      wave.className = 'ripple-wave';
      var r = btn.getBoundingClientRect();
      wave.style.left = (e.clientX - r.left) + 'px';
      wave.style.top  = (e.clientY - r.top)  + 'px';
      btn.appendChild(wave);
      wave.addEventListener('animationend', function () { wave.remove(); });
    });

    /* 3. Theme toggle spin */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#theme-toggle');
      if (!btn) return;
      btn.classList.remove('theme-spinning');
      void btn.offsetWidth; /* reflow to restart */
      btn.classList.add('theme-spinning');
      btn.addEventListener('animationend', function () {
        btn.classList.remove('theme-spinning');
      }, { once: true });
    });

    /* 4. [Legacy] Patch for back-compat if needed, though now handled by popstate */
    // window.closeTrackerDashboard is now history-aware in the main scope.
  })();

})();
