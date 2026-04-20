/* ================================================================
   index-engine.js  —  Shared engine for all index/hub pages.
   Handles theme toggle, quiz card rendering, and tracker dashboard.
   Load this after defining QUIZZES config and #quiz-grid element.
   ================================================================ */
(function () {
  'use strict';

  var _cs = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : '';

  /* ── Inject tracker dashboard extra styles ─────────────────── */
  var _trackerStyle = document.createElement('style');
  _trackerStyle.textContent = '.dash-folder-title{font-family:"Playfair Display",serif;font-size:1.05rem;font-weight:700;color:var(--accent);padding:0.75rem 0 0.4rem;margin-bottom:0.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.4rem;cursor:pointer;user-select:none}.dash-folder-title:hover{opacity:0.85}.dash-folder-toggle{font-size:0.9rem;transition:transform 0.2s ease;display:inline-block}.dash-folder-toggle.collapsed{transform:rotate(-90deg)}.dash-folder-content{transition:max-height 0.3s ease,opacity 0.25s ease;overflow:visible;max-height:none;opacity:1;padding-bottom:0.5rem;flex:1}.dash-folder-content.collapsed{max-height:0;opacity:0;overflow:hidden}.dash-folder-header{display:flex;align-items:center;justify-content:space-between;gap:0.5rem}.dash-folder-select{margin-left:auto;width:18px;height:18px;cursor:pointer;accent-color:var(--accent)}' +
    '.btn-dash-review{flex:1;padding:0.65rem 1.25rem;border-radius:8px;background:var(--correct);border:1.5px solid var(--correct);color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;transition:opacity 0.2s ease}.btn-dash-review:hover{opacity:0.85}.btn-dash-review:disabled{opacity:0.4;cursor:not-allowed}#review-overlay{position:fixed;inset:0;z-index:3000;background:var(--bg);display:none;flex-direction:column;font-family:"Outfit",sans-serif}#review-overlay.open{display:flex}#review-overlay .rev-topbar{display:flex;align-items:center;gap:1rem;padding:0.75rem 1.25rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}#review-overlay .rev-topbar-title{font-family:"Playfair Display",serif;font-size:1.05rem;font-weight:700;flex:1}#review-overlay .rev-progress-text{font-size:0.82rem;color:var(--text-muted);font-weight:600}#review-overlay .rev-body{flex:1;overflow-y:auto;padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem;max-width:720px;margin:0 auto;width:100%}#review-overlay .rev-q-text{font-size:clamp(1rem,2.5vw,1.2rem);font-weight:500;line-height:1.7;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius,12px);padding:1.25rem 1.5rem}#review-overlay .rev-source-badge{font-size:0.72rem;color:var(--text-muted);font-weight:500;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.6rem;display:inline-block;margin-bottom:0.25rem}#review-overlay .rev-options{display:flex;flex-direction:column;gap:0.65rem}#review-overlay .rev-option{display:flex;align-items:flex-start;gap:0.85rem;padding:0.95rem 1.15rem;border-radius:var(--radius,12px);border:1.5px solid var(--border);background:var(--surface);cursor:pointer;transition:all 0.2s ease}#review-overlay .rev-option:hover{border-color:var(--accent)}#review-overlay .rev-option.selected{border-color:var(--accent);background:rgba(240,165,0,0.12)}#review-overlay .rev-option.correct-reveal{border-color:var(--correct);background:rgba(46,160,67,0.12)}#review-overlay .rev-option.wrong-reveal{border-color:var(--wrong);background:rgba(218,54,51,0.12)}#review-overlay .rev-option-key{width:28px;height:28px;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;transition:all 0.2s ease;text-transform:uppercase}#review-overlay .rev-option.selected .rev-option-key{background:var(--accent);border-color:var(--accent);color:#000}#review-overlay .rev-option.correct-reveal .rev-option-key{background:var(--correct);border-color:var(--correct);color:#fff}#review-overlay .rev-option.wrong-reveal .rev-option-key{background:var(--wrong);border-color:var(--wrong);color:#fff}#review-overlay .rev-option-text{font-size:0.95rem;line-height:1.5}#review-overlay .rev-explanation{display:none;margin-top:0.75rem;padding:0.85rem 1.1rem;background:var(--surface2);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;font-size:0.875rem;line-height:1.6;color:var(--text-muted)}#review-overlay .rev-explanation.visible{display:block}#review-overlay .rev-explanation strong{color:var(--text);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:0.25rem}#review-overlay .rev-nav{display:flex;gap:0.75rem;padding-top:0.5rem}#review-overlay .rev-btn{display:flex;align-items:center;gap:0.4rem;padding:0.75rem 1.25rem;border-radius:var(--radius,12px);font-size:0.9rem;font-weight:600;transition:all 0.2s ease;border:1.5px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer}#review-overlay .rev-btn:hover{border-color:var(--accent);color:var(--accent)}#review-overlay .rev-btn.primary{background:var(--accent);color:#000;border-color:var(--accent);margin-left:auto}#review-overlay .rev-btn.primary:hover{opacity:0.88}#review-overlay .rev-btn.submit{background:var(--correct);border-color:var(--correct);color:#fff;margin-left:auto}#review-overlay .rev-btn.submit:hover{opacity:0.88}#review-overlay .rev-results-body{flex:1;overflow-y:auto;padding:1.5rem;display:none;flex-direction:column;gap:1.5rem;max-width:720px;margin:0 auto;width:100%}#review-overlay .rev-results-body.active{display:flex}#review-overlay .rev-score-banner{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem 2rem;display:flex;align-items:center;gap:2rem;flex-wrap:wrap}#review-overlay .rev-score-num{font-size:2.5rem;font-weight:700;color:var(--correct)}#review-overlay .rev-score-label{font-size:0.85rem;color:var(--text-muted)}#review-overlay .rev-update-toggle{display:flex;align-items:flex-start;gap:0.75rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius,12px);padding:1rem 1.25rem;cursor:pointer}#review-overlay .rev-update-toggle input[type=checkbox]{width:18px;height:18px;accent-color:var(--correct);margin-top:2px;flex-shrink:0;cursor:pointer}#review-overlay .rev-update-label{font-size:0.9rem;font-weight:600}#review-overlay .rev-update-sub{font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem}#review-overlay .rev-done-btn{padding:0.85rem 2rem;border-radius:var(--radius,12px);background:var(--accent);border:none;color:#000;font-weight:700;font-size:1rem;cursor:pointer;align-self:flex-start;transition:opacity 0.2s ease}#review-overlay .rev-done-btn:hover{opacity:0.88}#review-overlay .rev-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:1rem;color:var(--text-muted)}#review-overlay .rev-spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:revSpin 0.8s linear infinite}@keyframes revSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(_trackerStyle);
  
  /* ── Toast Notification Styles ────────────────────────────── */
  var _toastStyle = document.createElement('style');
  _toastStyle.textContent = '.toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(80px);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.65rem 1.2rem;font-size:0.88rem;font-weight:500;box-shadow:var(--shadow);z-index:9999;transition:transform 0.3s ease,opacity 0.3s ease;white-space:nowrap;display:flex;align-items:center;gap:0.5rem;max-width:90%}.toast.show{transform:translateX(-50%) translateY(0)}';
  document.head.appendChild(_toastStyle);
  
  /* ── Modal Styles ─────────────────────────────────────────── */
  var _modalStyle = document.createElement('style');
  _modalStyle.textContent = '.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:2100;display:none;align-items:center;justify-content:center;padding:1rem}.modal-overlay.open{display:flex}.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:2rem;max-width:420px;width:100%;box-shadow:var(--shadow);animation:modalIn 0.38s var(--ease-spring) both}.modal h3{font-family:\'Playfair Display\',serif;font-size:1.3rem;margin-bottom:0.75rem}.modal p{color:var(--text-muted);font-size:0.9rem;line-height:1.6;margin-bottom:1.25rem}.modal-actions{display:flex;gap:0.75rem}.modal-actions .btn-cancel{flex:1;padding:0.75rem;border-radius:10px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-weight:600;font-size:0.9rem;transition:all var(--transition)}.modal-actions .btn-cancel:hover{border-color:var(--accent)}.modal-actions .btn-confirm{flex:1;padding:0.75rem;border-radius:10px;background:var(--correct);border:none;color:#fff;font-weight:700;font-size:0.9rem;transition:all var(--transition)}.modal-actions .btn-confirm:hover{opacity:0.85}.modal-actions .btn-confirm.danger{background:var(--wrong)}@keyframes modalIn{from{opacity:0;transform:translateY(28px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}';
  document.head.appendChild(_modalStyle);
  
  /* ── Toast HTML Element ───────────────────────────────────── */
  var _toastEl = document.createElement('div');
  _toastEl.id = 'toast';
  _toastEl.className = 'toast';
  document.body.appendChild(_toastEl);
  
  /* ── Clear Tracker Modal HTML ─────────────────────────────── */
  var _modalEl = document.createElement('div');
  _modalEl.className = 'modal-overlay';
  _modalEl.id = 'clear-tracker-modal';
  _modalEl.innerHTML = '<div class="modal"><h3>Clear Questions?</h3><p id="clear-tracker-message">Are you sure you want to clear all questions for this section? This cannot be undone.</p><div class="modal-actions"><button class="btn-cancel" onclick="closeClearTrackerModal()">Go Back</button><button class="btn-confirm danger" onclick="clearAllTrackerData()">Clear Now</button></div></div>';
  document.body.appendChild(_modalEl);
  
  /* ── Tracker Dashboard HTML ───────────────────────────────── */
  var _dashEl = document.createElement('div');
  _dashEl.className = 'dash-overlay';
  _dashEl.id = 'tracker-dashboard';
  _dashEl.innerHTML = '<div class="dash-modal">' +
    '<div class="dash-header">' +
      '<h2 id="dash-title-text">📊 Question Tracker</h2>' +
      '<button class="dash-close-btn" onclick="closeTrackerDashboard()">✕</button>' +
    '</div>' +
    '<div class="dash-scope-bar" id="dash-scope-bar"></div>' +
    '<div class="dash-summary">' +
      '<div class="dash-stat"><div class="ds-val red" id="dash-total-wrong">0</div><div class="ds-lbl">Wrong</div></div>' +
      '<div class="dash-stat"><div class="ds-val blue" id="dash-total-flagged">0</div><div class="ds-lbl">Flagged</div></div>' +
      '<div class="dash-stat"><div class="ds-val green" id="dash-total-quizzes">0</div><div class="ds-lbl">Quizzes</div></div>' +
    '</div>' +
    '<div class="dash-body" id="dash-body"></div>' +
    '<div class="dash-footer">' +
      '<button class="btn-dash-action" onclick="exportTrackerToPDF()" title="Export to PDF">📄 Export PDF</button>' +
      '<button class="btn-dash-action btn-dash-danger" onclick="confirmClearTrackerData()">🗑 Clear All</button>' +
      '<button class="btn-dash-review" id="btn-start-review" onclick="startReviewMode()">▶ Start Review</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(_dashEl);
  
  /* ── Review Overlay HTML ──────────────────────────────────── */
  var _revEl = document.createElement('div');
  _revEl.id = 'review-overlay';
  _revEl.innerHTML = '<div class="rev-topbar">' +
    '<button class="icon-btn" onclick="revCloseOverlay()">✕</button>' +
    '<div class="rev-topbar-title">Review Session</div>' +
    '<div class="rev-progress-text" id="rev-progress-text"></div>' +
  '</div>' +
  '<div class="rev-body" id="rev-body"></div>' +
  '<div class="rev-results-body" id="rev-results-body">' +
    '<div class="rev-score-banner">' +
      '<div>' +
        '<div class="rev-score-num" id="rev-score-num">0%</div>' +
        '<div class="rev-score-label" id="rev-score-val">0 / 0 correct</div>' +
      '</div>' +
    '</div>' +
    '<label class="rev-update-toggle">' +
      '<input type="checkbox" id="rev-update-checkbox" checked>' +
      '<div>' +
        '<div class="rev-update-label">Update tracker with these results</div>' +
        '<div class="rev-update-sub">Questions you answered correctly will be removed from your tracker.</div>' +
      '</div>' +
    '</label>' +
    '<button class="rev-done-btn" onclick="revFinishReview()">Back to Hub</button>' +
  '</div>';
  document.body.appendChild(_revEl);
  
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

  /* ── Tracker storage ───────────────────────────────────────── */
  var STORAGE_PREFIX = 'quiz_tracker_v2_';
  var KEYS_LIST_KEY  = 'quiz_tracker_keys';

  function getStorageKey(uid) { return STORAGE_PREFIX + uid; }

  /* -- Get the project root name from ENGINE_BASE (e.g. "MU61S8") -- */
  var _rootName = '';
  try {
    _rootName = new URL(ENGINE_BASE || '', location.href).pathname
      .replace(/\/$/, '').replace(/^\//, '');
  } catch (e) {}

  /* -- Normalize a stored d.path by stripping the project root prefix -- */
  function _normStoredPath(p) {
    if (!p) return '';
    var s = p.replace(/^\//, '');
    if (_rootName && s.indexOf(_rootName + '/') === 0) {
      s = s.substring(_rootName.length + 1);
    } else if (_rootName && s === _rootName) {
      s = '';
    }
    return s;
  }

  /* -- Normalize a folder path to strip the project root prefix --
     e.g. "MU61S8/gyn/dep/" -> "gyn/dep/"
     e.g. "gyn/dep/" -> "gyn/dep/" (no change) */
  function _normalizeFolderPath(p) {
    if (!p) return '';
    var s = p.replace(/^\//, '');
    if (_rootName && s.indexOf(_rootName + '/') === 0) {
      s = s.substring(_rootName.length + 1);
    } else if (_rootName && s === _rootName) {
      s = '';
    }
    // Ensure trailing slash
    if (s && s.charAt(s.length - 1) !== '/') s += '/';
    return s;
  }

  /* -- Get folder segments RELATIVE to ENGINE_BASE (project root) --
     e.g. "/MU61S8/gyn/dep/index.html" -> ["gyn", "gyn/dep"]
     This matches the format used by computeFolderPath() in quiz/bank-engine.js */
  function getFolderSegments(path) {
    var cleaned = path.replace(/\/[^\/]*$/, '').replace(/^\//, '');
    // Strip project root prefix
    if (_rootName && cleaned.indexOf(_rootName + '/') === 0) {
      cleaned = cleaned.substring(_rootName.length + 1);
    } else if (_rootName && cleaned === _rootName) {
      cleaned = '';
    }
    var parts = cleaned.split('/').filter(Boolean);
    var segs = [];
    for (var i = 0; i < parts.length; i++) segs.push(parts.slice(0, i + 1).join('/'));
    return segs;
  }

  function getAllTrackerData() {
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      var results = [];
      keys.forEach(function (uid) {
        var raw = localStorage.getItem(getStorageKey(uid));
        if (raw) try { results.push(JSON.parse(raw)); } catch (e) {}
      });
      return results;
    } catch (e) { return []; }
  }

  function getDataForScope(scope, scopePath) {
    var all = getAllTrackerData();
    if (scope === 'folder' && scopePath) {
      var target = scopePath.replace(/^\/|\/$/g, ''); // normalize: remove leading/trailing slashes
      return all.filter(function (d) {
        // Check stored folderPath (ENGINE_BASE-relative) and d.path (full URL, normalized)
        var fp = (d.folderPath || '').replace(/^\/|\/$/g, '');
        var dp = _normStoredPath(d.path);
        // Extract folder from full path for comparison
        var dpFolder = '';
        if (dp) {
          var dpParts = dp.split('/');
          if (dpParts.length > 1) {
            dpFolder = dpParts.slice(0, -1).join('/').replace(/^\/|\/$/g, '');
          }
        }
        // Match if the quiz's folder starts with the target folder path
        // This ensures "gyn/dep" matches when target is "gyn", but "gyn-extra" does not
        return (fp && (fp === target || fp.indexOf(target + '/') === 0)) 
            || (dpFolder && (dpFolder === target || dpFolder.indexOf(target + '/') === 0));
      });
    }
    return all;
  }

  /* ── Folder title cache ────────────────────────────────────── */
  var _folderTitleCache = {};

  /* Extract folder path from tracker entry — prefer stored folderPath,
     otherwise fall back to deriving it from the URL path relative to ENGINE_BASE.
     ALWAYS normalizes the result to be relative to the project root. */
  function getFolderForEntry(d) {
    var raw = '';

    // Use folderPath stored by quiz-engine.js (relative to project root)
    if (d.folderPath) {
      raw = d.folderPath;
    } else {
      // Fallback: derive from d.path relative to ENGINE_BASE
      try {
        var rootAbs = new URL(ENGINE_BASE || '', location.href).href;
        // Build absolute URL from stored path
        var absUrl = new URL(d.path || '', location.origin).href;
        if (absUrl.indexOf(rootAbs) === 0) {
          var relative = absUrl.substring(rootAbs.length);
          raw = relative.replace(/[^/]*$/, '') || '';
        }
      } catch (e) {}

      // Last resort: extract from d.path and strip root prefix
      if (!raw && d.path) {
        var cleaned = d.path.replace(/^\//, '').replace(/\\/g, '/');
        var parts = cleaned.split('/');
        if (parts.length > 1) raw = parts.slice(0, -1).join('/') + '/';
      }
    }

    // ALWAYS normalize: strip project root prefix to get relative path
    return _normalizeFolderPath(raw);
  }

  /* Get the top-level folder from a full folder path for grouping.
     e.g. "gyn/dep/" → "gyn/", "Cardio/" → "Cardio/" */
  function getTopLevelFolder(folderPath) {
    if (!folderPath) return '';
    var parts = folderPath.replace(/\/$/, '').split('/');
    return parts.length > 0 ? parts[0] + '/' : '';
  }

  function fetchFolderTitle(folderPath) {
    if (!folderPath) return Promise.resolve(null);
    if (_folderTitleCache[folderPath]) return Promise.resolve(_folderTitleCache[folderPath]);

    try {
      var rootAbs = new URL(ENGINE_BASE || '', location.href).href;
      var indexUrl = rootAbs + folderPath + 'index.html';
      return fetch(indexUrl)
        .then(function (resp) {
          if (!resp.ok) return null;
          return resp.text();
        })
        .then(function (html) {
          if (!html) return null;
          var match = html.match(/<title>([^<]+)<\/title>/i);
          if (match) {
            var title = cleanTitle(match[1].trim());
            if (title) _folderTitleCache[folderPath] = title;
            return title;
          }
          return null;
        })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* Discover and cache folder titles for entries that don't have stored folderTitle */
  function discoverAndCacheFolderTitles(data) {
    var folders = {};
    data.forEach(function (d) {
      if (d.folderTitle) {
        // ONLY cache for the exact folder path — never derive parent titles
        // from child data (that causes wrong titles like surg showing Gynecology).
        var folder = _normalizeFolderPath(d.folderPath) || getFolderForEntry(d);
        if (folder && !_folderTitleCache[folder]) {
          _folderTitleCache[folder] = cleanTitle(d.folderTitle);
        }
      }
    });
    // For entries without stored folderTitle, try to fetch from index.html
    data.forEach(function (d) {
      if (!d.folderTitle) {
        var folder = _normalizeFolderPath(d.folderPath) || getFolderForEntry(d);
        if (folder && !_folderTitleCache[folder]) {
          folders[folder] = true;
        }
      }
    });
    // Also fetch titles for parent folders that are still missing
    data.forEach(function (d) {
      var folder = _normalizeFolderPath(d.folderPath) || getFolderForEntry(d);
      if (folder) {
        var top = getTopLevelFolder(folder);
        if (top && top !== folder && !_folderTitleCache[top]) {
          folders[top] = true;
        }
      }
    });
    var promises = [];
    Object.keys(folders).forEach(function (folder) {
      promises.push(fetchFolderTitle(folder));
    });
    return Promise.all(promises);
  }

  /* ── Badge ─────────────────────────────────────────────────── */
  function updateBadge() {
    var segments = getFolderSegments(location.pathname);
    var folderPath = segments.length > 0 ? segments[segments.length - 1] : '';
    var data = folderPath
      ? getAllTrackerData().filter(function (d) {
          var fp = (d.folderPath || '').replace(/^\//, '');
          var dp = _normStoredPath(d.path);
          var target = folderPath.replace(/^\//, '');
          return (fp && fp.indexOf(target) === 0) || (dp && dp.indexOf(target) === 0);
        })
      : getAllTrackerData();
    var total = 0;
    data.forEach(function (d) { total += (d.wrong || []).length + (d.flagged || []).length; });
    var badge = document.getElementById('tracker-badge-count');
    if (badge) badge.textContent = total > 0 ? total : '';
  }

  /* ── Scope state ───────────────────────────────────────────── */
  var currentScope = 'folder';
  var currentScopePath = '';

  /* ── Extract a clean folder display name from a full HTML <title> ── */
  function cleanTitle(raw) {
    if (!raw) return '';
    // Strip common prefixes like "MU61 Quiz - ", "Mansoura MCQ - ", etc.
    return raw.replace(/^(?:MU61\s+Quiz|Mansoura\s+MCQ)\s*[-–—]\s*/i, '').trim();
  }

  window.openTrackerDashboard = function () {
    // Reset selection state when opening dashboard (all folders selected by default)
    _selectedQuizzes = {};

    var segments = getFolderSegments(location.pathname);
    var scopeBar = document.getElementById('dash-scope-bar');
    if (!scopeBar) return;

    // Step 1: Pre-cache titles from document.title (current page only)
    var pageFolder = segments.length > 0 ? segments[segments.length - 1] + '/' : '';
    if (pageFolder && !_folderTitleCache[pageFolder]) {
      var cleaned = cleanTitle(document.title);
      if (cleaned) _folderTitleCache[pageFolder] = cleaned;
    }

    // Step 2: Pre-cache from stored tracker data (sync — only for EXACT folder paths).
    // Do NOT set parent folder titles here — that causes wrong titles (e.g., surg gets Gynecology).
    // Parent folder titles are resolved via eager fetch from the parent's own index.html.
    var allData = getAllTrackerData();
    allData.forEach(function (d) {
      if (d.folderTitle) {
        var f = _normalizeFolderPath(d.folderPath) || '';
        if (f && !_folderTitleCache[f]) {
          _folderTitleCache[f] = cleanTitle(d.folderTitle);
        }
      }
    });

    // Step 3: Eagerly fetch any folder titles that are still missing BEFORE building tabs.
    // This is critical for parent-folder tabs whose index.html we haven't loaded yet.
    var foldersToFetch = [];
    if (segments.length >= 1) {
      var fk1 = segments[segments.length - 1] + '/';
      if (!_folderTitleCache[fk1]) foldersToFetch.push(fk1);
    }
    if (segments.length >= 2) {
      var fk2 = segments[segments.length - 2] + '/';
      if (!_folderTitleCache[fk2]) foldersToFetch.push(fk2);
    }
    // Also fetch the top-level subject folder if we have 3+ depth
    if (segments.length >= 3) {
      var fk3 = segments[segments.length - 3] + '/';
      if (!_folderTitleCache[fk3]) foldersToFetch.push(fk3);
    }

    var buildTabs = function () {
      var tabs = [];

      // Tab: Current/deepest folder (first/leftmost, only if we have at least 1 segment)
      if (segments.length >= 1) {
        var folderKey = segments[segments.length - 1] + '/';
        var folderLabel = _folderTitleCache[folderKey] || decodeURIComponent(segments[segments.length - 1]);
        tabs.push({ id: 'folder', label: folderLabel, path: segments[segments.length - 1], level: segments.length - 1 });
      }

      // Tab: Intermediate folders (parent directories) - only if we have nested structure
      // e.g., for gyn/dep/file.html, add "gyn" as an intermediate folder tab
      if (segments.length >= 2) {
        // Add all intermediate folders except the deepest one
        for (var i = 0; i < segments.length - 1; i++) {
          var folderKey = segments[i] + '/';
          var folderLabel = _folderTitleCache[folderKey] || decodeURIComponent(segments[i]);
          tabs.push({ id: 'folder', label: folderLabel, path: segments[i], level: i });
        }
      }

      // Tab: All quizzes from all folders
      tabs.push({ id: 'all', label: 'All Quizzes', path: '' });

      var scopeHTML = '';
      tabs.forEach(function (t, i) {
        scopeHTML += '<button class="dash-scope-tab' + (i === 0 ? ' active' : '')
          + '" data-scope="' + t.id + '" data-path="' + (t.path || '') + '"'
          + ' onclick="switchDashScope(\'' + t.id + '\',\'' + (t.path || '') + '\')">'
          + escHtml(t.label) + '</button>';
      });
      scopeBar.innerHTML = scopeHTML;

      // Set default tab to current/deepest folder (first tab)
      if (tabs.length > 0 && tabs[0].id === 'folder') {
        currentScope = 'folder';
        currentScopePath = tabs[0].path;
      } else {
        currentScope = 'all';
        currentScopePath = '';
      }
      
      // Update active state on tabs
      document.querySelectorAll('.dash-scope-tab').forEach(function (tab) {
        var isActive = tab.getAttribute('data-scope') === currentScope && 
                       tab.getAttribute('data-path') === currentScopePath;
        tab.classList.toggle('active', isActive);
      });
      
      renderDashboard();
      var overlay = document.getElementById('tracker-dashboard');
      if (overlay) overlay.classList.add('open');
    };

    if (foldersToFetch.length > 0) {
      // Fetch missing titles, then build tabs with complete cache
      Promise.all(foldersToFetch.map(function (f) { return fetchFolderTitle(f); }))
        .then(function () { buildTabs(); })
        .catch(function () { buildTabs(); }); // build tabs even if fetch fails
    } else {
      buildTabs();
    }
  };

  window.switchDashScope = function (scope, path) {
    currentScope = scope;
    currentScopePath = path;
    document.querySelectorAll('.dash-scope-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-path') === path && tab.getAttribute('data-scope') === scope);
    });
    renderDashboard();
  };

  /* ── Render dashboard ──────────────────────────────────────── */
  var _collapsedFolders = {};
  var _selectedQuizzes = {};
  function renderDashboard() {
    var data = getDataForScope(currentScope, currentScopePath);
    var totalWrong = 0, totalFlagged = 0;
    data.forEach(function (d) { totalWrong += (d.wrong || []).length; totalFlagged += (d.flagged || []).length; });

    var elW = document.getElementById('dash-total-wrong');
    var elF = document.getElementById('dash-total-flagged');
    var elQ = document.getElementById('dash-total-quizzes');
    if (elW) elW.textContent = totalWrong;
    if (elF) elF.textContent = totalFlagged;
    if (elQ) elQ.textContent = data.length;

    var body = document.getElementById('dash-body');
    if (!body) return;

    if (!data.length) {
      body.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">\uD83D\uDCCB</div>'
        + '<p>No tracked questions yet.<br>Complete a quiz to start tracking wrong and flagged questions.</p></div>';
      return;
    }

    data.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    // Discover folder titles first, then render
    discoverAndCacheFolderTitles(data).then(function () {
      renderDashboardContent(body, data);
    });
  }

  function renderDashboardContent(body, data) {
    // Group items by folder
    var groups = []; // { folder, folderTitle, items }
    var currentFolder = null;
    var currentGroup = null;

    data.forEach(function (d) {
      var wrongItems = d.wrong || [];
      var flaggedItems = d.flagged || [];
      var wrongIdxs = {};
      wrongItems.forEach(function (q) { wrongIdxs[q.idx] = true; });
      var uniqueFlagged = flaggedItems.filter(function (q) { return !wrongIdxs[q.idx]; });
      if (!wrongItems.length && !uniqueFlagged.length) return;

      var folder = getFolderForEntry(d);
      var topFolder = getTopLevelFolder(folder);
      // Build title lookup: try stored title (cleaned), then cache for folder, then cache for topFolder
      var storedTitle = d.folderTitle ? cleanTitle(d.folderTitle) : '';
      var folderTitle = storedTitle || _folderTitleCache[folder] || _folderTitleCache[topFolder] || null;

      // Create a new group for this quiz
      groups.push({
        folder: folder,
        topFolder: topFolder,
        folderTitle: folderTitle,
        uid: d.uid,
        title: d.title || 'Unknown Quiz',
        wrongItems: wrongItems,
        flaggedItems: uniqueFlagged,
        flaggedItemsAll: flaggedItems,
        timestamp: d.timestamp
      });
    });

    var html = '';
    
    html += '<div style="display:flex; justify-content:flex-end; padding:0 0 10px; border-bottom:1px solid var(--border); margin-bottom:10px;">';
    html += '<button onclick="toggleAllSelection(true)" style="background:none;border:none;color:var(--text);border-bottom:1.5px solid var(--accent);cursor:pointer;font-weight:600;font-size:0.8rem;margin-right:15px;padding:2px">Select All</button>';
    html += '<button onclick="toggleAllSelection(false)" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-weight:600;font-size:0.8rem;padding:2px">Deselect All</button>';
    html += '</div>';

    var lastTopFolder = '__none__';
    var folderGroups = {}; // folder -> [groups]

    // First pass: organize groups by folder
    groups.forEach(function (g) {
      if (!g.folder) g.folder = '__root__';
      if (!folderGroups[g.folder]) folderGroups[g.folder] = [];
      folderGroups[g.folder].push(g);
    });

    // Render each folder section
    Object.keys(folderGroups).forEach(function (folder) {
      var fGroups = folderGroups[folder];
      if (!fGroups.length) return;

      var firstGroup = fGroups[0];
      // Try to get the folder title from multiple sources in order of preference
      var displayFolderTitle = firstGroup.folderTitle
        || _folderTitleCache[firstGroup.folder]
        || decodeURIComponent(firstGroup.folder.replace(/\/$/, ''));

      // Don't show raw folder name if it matches the project root
      if (displayFolderTitle && displayFolderTitle === _rootName) {
        displayFolderTitle = '';
      }

      var isCollapsed = _collapsedFolders[folder] || false;
      var folderUids = fGroups.map(function(g) { return g.uid; });
      var isFolderSelected = folderUids.every(function(uid) { return _selectedQuizzes[uid] !== false; });

      if (displayFolderTitle) {
        html += '<div class="dash-folder-header" style="align-items:center;">';
        html += '<div class="dash-folder-title" onclick="toggleFolder(\'' + escHtml(folder) + '\')">';
        html += '<span class="dash-folder-toggle' + (isCollapsed ? ' collapsed' : '') + '">\u25BC</span> ';
        html += escFolderIcon(escHtml(displayFolderTitle));
        html += '</div>';
        html += '<input type="checkbox" class="dash-folder-select" ';
        html += (isFolderSelected ? 'checked' : '') + ' ';
        html += 'onclick="event.stopPropagation(); toggleFolderSelection(\'' + escHtml(folder) + '\', this.checked)" ';
        html += 'title="Select all in folder">';
        html += '</div>';
      }

      html += '<div class="dash-folder-content' + (isCollapsed ? ' collapsed' : '') + '" id="folder-content-' + escHtml(folder) + '">';

      fGroups.forEach(function (g) {
        var isQuizSelected = _selectedQuizzes[g.uid] !== false;
        var dateStr = g.timestamp
          ? new Date(g.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '';

        html += '<div class="dash-quiz-group">';
        html += '<div class="dash-quiz-title" style="cursor:pointer; display:flex; align-items:center;" onclick="document.getElementById(\'chk-\'+\''+g.uid+'\').click()">';
        html += '<input type="checkbox" id="chk-'+g.uid+'" class="dash-quiz-select" style="margin-right:8px; width:16px; height:16px; cursor:pointer; accent-color:var(--accent)" ' + (isQuizSelected ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleQuizSelection(\'' + g.uid + '\', this.checked)"> ';
        html += escHtml(g.title);
        if (g.wrongItems.length)   html += ' <span class="quiz-badge wrong-badge">' + g.wrongItems.length + ' wrong</span>';
        if (g.flaggedItemsAll.length) html += ' <span class="quiz-badge flag-badge">' + g.flaggedItemsAll.length + ' flagged</span>';
        if (dateStr)             html += ' <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400;margin-left:auto;">' + dateStr + '</span>';
        html += '</div>';

        g.wrongItems.forEach(function (q) {
          var isAlsoFlagged = g.flaggedItemsAll.some(function (f) { return f.idx === q.idx; });
          html += buildItem(g.uid, q, isAlsoFlagged ? 'Wrong + Flagged' : 'Wrong', 'wrong', '\u2717');
        });
        g.flaggedItems.forEach(function (q) {
          html += buildItem(g.uid, q, 'Flagged', 'flagged', '\u2691');
        });
        html += '</div>';
      });

      html += '</div>'; // close dash-folder-content
    });

    body.innerHTML = html || '<div class="dash-empty"><div class="dash-empty-icon">\u2705</div><p>No wrong or flagged questions tracked. Great job!</p></div>';
  }

  function escFolderIcon(title) {
    // Add a folder icon before the title
    return '\uD83D\uDCC1 ' + title;
  }

  function buildItem(uid, q, typeLabel, iconClass, iconText) {
    var esc = (q.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="dash-q-item">'
      + '<div class="dash-q-icon ' + iconClass + '">' + iconText + '</div>'
      + '<div class="dash-q-content">'
      +   '<div class="dash-q-num">Q' + ((q.idx || 0) + 1) + ' \u00B7 ' + typeLabel + '</div>'
      +   '<div class="dash-q-text">' + esc + '</div>'
      + '</div>'
      + '<button class="dash-q-remove" onclick="removeTrackerItem(\'' + uid + '\',' + (q.idx || 0) + ')" title="Remove">\u2715</button>'
      + '</div>';
  }

  /* ── Close dashboard ───────────────────────────────────────── */
  window.closeTrackerDashboard = function () {
    var overlay = document.getElementById('tracker-dashboard');
    if (overlay) overlay.classList.remove('open');
  };

  /* ── Toggle folder collapse ────────────────────────────────── */
  window.toggleFolder = function (folder) {
    _collapsedFolders[folder] = !_collapsedFolders[folder];
    var contentEl = document.getElementById('folder-content-' + folder);
    var toggleEl = contentEl ? contentEl.previousElementSibling.querySelector('.dash-folder-toggle') : null;
    if (contentEl) {
      contentEl.classList.toggle('collapsed', _collapsedFolders[folder]);
    }
    if (toggleEl) {
      toggleEl.classList.toggle('collapsed', _collapsedFolders[folder]);
    }
  };

  /* ── Toggle selection logic ───────────────────────────────── */
  window.toggleQuizSelection = function (uid, checked) {
    _selectedQuizzes[uid] = checked;
    renderDashboard();
  };

  window.toggleFolderSelection = function (folder, checked) {
    var data = getDataForScope(currentScope, currentScopePath);
    data.forEach(function(d) {
       var dFolder = getFolderForEntry(d) || '__root__';
       if (dFolder === folder) _selectedQuizzes[d.uid] = checked;
    });
    renderDashboard();
  };

  window.toggleAllSelection = function(checked) {
    var data = getDataForScope(currentScope, currentScopePath);
    data.forEach(function(d) {
       _selectedQuizzes[d.uid] = checked;
    });
    renderDashboard();
  };

  /* ── Remove single item ────────────────────────────────────── */
  window.removeTrackerItem = function (uid, qIdx) {
    try {
      var raw = localStorage.getItem(getStorageKey(uid));
      if (!raw) return;
      var data = JSON.parse(raw);
      data.wrong   = (data.wrong || []).filter(function (q) { return q.idx !== qIdx; });
      data.flagged = (data.flagged || []).filter(function (q) { return q.idx !== qIdx; });
      if (!data.wrong.length && !data.flagged.length) {
        localStorage.removeItem(getStorageKey(uid));
        var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
        localStorage.setItem(KEYS_LIST_KEY, JSON.stringify(keys.filter(function (k) { return k !== uid; })));
      } else {
        localStorage.setItem(getStorageKey(uid), JSON.stringify(data));
      }
      renderDashboard();
      updateBadge();
    } catch (e) {}
  };

  /* ── Clear all ─────────────────────────────────────────────── */
  window.confirmClearTrackerData = function () {
    // Update the message to show current scope
    var scopeName = getCurrentScopeDisplayName();
    var messageEl = document.getElementById('clear-tracker-message');
    if (messageEl && scopeName) {
      messageEl.textContent = 'Are you sure you want to clear all questions for "' + scopeName + '"? This cannot be undone.';
    }
    document.getElementById('clear-tracker-modal').classList.add('open');
  };
  
  window.closeClearTrackerModal = function () {
    document.getElementById('clear-tracker-modal').classList.remove('open');
  };
  
  window.clearAllTrackerData = function () {
    // Close modal first
    closeClearTrackerModal();
    
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      var allData = getAllTrackerData();
      
      // Filter data based on current scope AND selection
      var dataToClear = getDataForScope(currentScope, currentScopePath);
      var uidsToClear = {};
      dataToClear.forEach(function (d) { 
        if (_selectedQuizzes[d.uid] !== false) uidsToClear[d.uid] = true; 
      });
      
      // Only remove items that match the current scope
      keys.forEach(function (uid) {
        if (uidsToClear[uid]) {
          localStorage.removeItem(getStorageKey(uid));
        }
      });
      
      // Update keys list - keep only keys not being cleared
      var remainingKeys = keys.filter(function (uid) { return !uidsToClear[uid]; });
      localStorage.setItem(KEYS_LIST_KEY, JSON.stringify(remainingKeys));
      
      renderDashboard();
      updateBadge();
      showToast('🗑 Questions cleared for this section!');
    } catch (e) {}
  };
  
  function getCurrentScopeDisplayName() {
    if (currentScope === 'folder' && currentScopePath) {
      var folderPath = currentScopePath + '/';
      if (_folderTitleCache[folderPath]) {
        return _folderTitleCache[folderPath];
      }
      return decodeURIComponent(currentScopePath);
    } else if (currentScope === 'all') {
      return 'All Selected Exams';
    }
    return 'this section';
  }

  /* ── Review Mode Logic ─────────────────────────────────────── */
  var _reviewQuestionsAll = [];
  var _reviewQuestions = [];
  var _revAnswers = {};
  var _revCurrent = 0;
  var _reviewCountTarget = 40;
  
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

  window.startReviewMode = function() {
    var data = getDataForScope(currentScope, currentScopePath);
    
    data = data.filter(function(d) {
        return _selectedQuizzes[d.uid] !== false;
    });

    if (!data || !data.length) {
      showToast('No questions selected. Please check at least one folder.');
      return;
    }
    
    var b = document.getElementById('rev-body');
    var r = document.getElementById('rev-results-body');
    if (b) b.style.display = 'flex';
    if (r) r.classList.remove('active');
    if (b) b.innerHTML = '<div class="rev-loading"><div class="rev-spinner"></div><div>Preparing your review session...</div></div>';
    
    closeTrackerDashboard();
    var revLayer = document.getElementById('review-overlay');
    if (revLayer) revLayer.classList.add('open');

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
             // To prevent options being pre-marked with an answer state, we clean them
             // Wait, options are just text arrays.
            finalQs.push({
              question: srcQuestion.question || tq.text,
              options: srcQuestion.options,
              correct: srcQuestion.correct,
              explanation: srcQuestion.explanation || tq.explanation || '',
              _uid: group.uid,
              _idx: tq.idx,
              _source: group.title,
              _fallback: false
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
              question: tq.text,
              options: opts,
              correct: cIdx,
              explanation: tq.explanation || '',
              _uid: group.uid,
              _idx: tq.idx,
              _source: group.title,
              _fallback: true
            });
          }
        });
      });

      for (var k = finalQs.length - 1; k > 0; k--) {
        var m = Math.floor(Math.random() * (k + 1));
        var tmp2 = finalQs[k]; finalQs[k] = finalQs[m]; finalQs[m] = tmp2;
      }

      if (!finalQs.length) {
        if (b) b.innerHTML = '<div class="rev-loading">No questions found.</div>';
        return;
      }

      _reviewQuestionsAll = finalQs;
      
      if (finalQs.length > 40) {
         revRenderStartScreen();
      } else {
         _reviewQuestions = finalQs;
         _revAnswers = {};
         _revCurrent = 0;
         revRenderQuestion();
      }
    });
  };

  function revRenderStartScreen() {
      var b = document.getElementById('rev-body');
      if (!b) return;
      document.getElementById('rev-progress-text').textContent = 'Session Settings';
      var maxQ = _reviewQuestionsAll.length;
      _reviewCountTarget = Math.min(maxQ, 40);
      
      var html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center;padding:2rem;">';
      html += '<h2 style="font-family:\'Playfair Display\',serif;font-size:2rem;margin-bottom:0.5rem;color:var(--text);">\uD83D\uDCDA Multiple Questions</h2>';
      html += '<p style="color:var(--text-muted);margin-bottom:2rem;">You have <strong>' + maxQ + '</strong> tracked questions. How many would you like to review?</p>';
      
      html += '<div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:3rem;background:var(--surface2);padding:1rem 2rem;border-radius:24px;border:1px solid var(--border);">';
      html += '<button class="icon-btn" style="width:48px;height:48px;font-size:1.5rem;border-radius:12px;background:var(--surface);border:1px solid var(--border);" onclick="revAdjustCount(-10)">-</button>';
      html += '<div id="rev-count-display" style="font-size:3rem;font-weight:700;width:100px;color:var(--accent);">' + _reviewCountTarget + '</div>';
      html += '<button class="icon-btn" style="width:48px;height:48px;font-size:1.5rem;border-radius:12px;background:var(--surface);border:1px solid var(--border);" onclick="revAdjustCount(10)">+</button>';
      html += '</div>';
      
      html += '<button class="rev-done-btn" style="align-self:center;padding:1rem 3rem;font-size:1.1rem;border-radius:16px;" onclick="revStartSession()">Start \u2192</button>';
      html += '</div>';
      
      b.innerHTML = html;
  }

  window.revAdjustCount = function(delta) {
      var maxQ = _reviewQuestionsAll.length;
      _reviewCountTarget += delta;
      if (_reviewCountTarget < 5) _reviewCountTarget = (maxQ < 5 ? maxQ : 5);
      if (_reviewCountTarget > maxQ) _reviewCountTarget = maxQ;
      var d = document.getElementById('rev-count-display');
      if (d) d.textContent = _reviewCountTarget;
  };

  window.revStartSession = function() {
      _reviewQuestions = _reviewQuestionsAll.slice(0, _reviewCountTarget);
      _revAnswers = {};
      _revCurrent = 0;
      revRenderQuestion();
  };

  function revRenderQuestion() {
    var b = document.getElementById('rev-body');
    if (!b) return;
    
    document.getElementById('rev-progress-text').textContent = (_revCurrent + 1) + ' of ' + _reviewQuestions.length;
    var q = _reviewQuestions[_revCurrent];
    var isAnswered = _revAnswers.hasOwnProperty(_revCurrent);
    var uAns = isAnswered ? _revAnswers[_revCurrent] : -1;

    var html = '<div class="rev-source-badge">\uD83D\uDCC1 ' + escHtml(q._source || 'Review') + '</div>';
    html += '<div class="rev-q-text">' + q.question + '</div>';
    html += '<div class="rev-options">';
    
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (var i = 0; i < q.options.length; i++) {
        var oClass = 'rev-option';
        if (isAnswered) {
            if (i === q.correct) oClass += ' correct-reveal';
            else if (i === uAns) oClass += ' wrong-reveal';
        }
        var onClick = isAnswered ? '' : ' onclick="revSelectOption(' + i + ')"';
        html += '<div class="' + oClass + '"' + onClick + '>';
        html += '<div class="rev-option-key">' + letters[i] + '</div>';
        html += '<div class="rev-option-text">' + escHtml(q.options[i]) + '</div>';
        html += '</div>';
    }
    html += '</div>';

    if (isAnswered && q.explanation) {
        html += '<div class="rev-explanation visible"><strong>Explanation</strong>' + q.explanation + '</div>';
    }

    html += '<div class="rev-nav">';
    if (_revCurrent < _reviewQuestions.length - 1) {
        if (isAnswered) {
            html += '<button class="rev-btn primary" onclick="revNextQuestion()">Next \u2192</button>';
        }
    } else {
        if (isAnswered) {
            html += '<button class="rev-btn submit" onclick="revSubmitReview()">Finish Review</button>';
        }
    }
    html += '</div>';

    b.innerHTML = html;
  }

  window.revSelectOption = function(optIdx) {
      if (_revAnswers.hasOwnProperty(_revCurrent)) return;
      _revAnswers[_revCurrent] = optIdx;
      revRenderQuestion();
  };

  window.revNextQuestion = function() {
      if (_revCurrent < _reviewQuestions.length - 1) {
          _revCurrent++;
          revRenderQuestion();
      }
  };

  window.revSubmitReview = function() {
      var b = document.getElementById('rev-body');
      var r = document.getElementById('rev-results-body');
      if (b) b.style.display = 'none';
      if (r) r.classList.add('active');
      document.getElementById('rev-progress-text').textContent = 'Results';

      var correctCount = 0;
      for (var i = 0; i < _reviewQuestions.length; i++) {
          if (_revAnswers[i] === _reviewQuestions[i].correct) correctCount++;
      }
      
      var pct = Math.round((correctCount / Math.max(1, _reviewQuestions.length)) * 100);
      document.getElementById('rev-score-num').textContent = pct + '%';
      document.getElementById('rev-score-val').textContent = correctCount + ' of ' + _reviewQuestions.length + ' correct';
  };

  window.revFinishReview = function() {
      var r = document.getElementById('rev-results-body');
      var b = document.getElementById('rev-body');
      var revLayer = document.getElementById('review-overlay');
      var chk = document.getElementById('rev-update-checkbox');

      if (chk && chk.checked) {
          for (var i = 0; i < _reviewQuestions.length; i++) {
              if (_revAnswers[i] === _reviewQuestions[i].correct) {
                  var q = _reviewQuestions[i];
                  removeTrackerItem(q._uid, q._idx);
              }
          }
      }

      if (r) r.classList.remove('active');
      if (b) b.style.display = 'flex';
      if (b) b.innerHTML = '';
      if (revLayer) revLayer.classList.remove('open');
      _reviewQuestionsAll = [];
      _reviewQuestions = [];
      _revAnswers = {};
  };

  window.revCloseOverlay = function() {
      window.revFinishReview();
  };

  /* ── PDF Export ────────────────────────────────────────────── */
  window.exportTrackerToPDF = function () {
    var data = getDataForScope(currentScope, currentScopePath);
    
    // Filter data based on explicitly selected quizzes
    data = data.filter(function (d) {
      return _selectedQuizzes[d.uid] !== false;
    });

    if (!data.length) { showToast('No tracked questions to export.'); return; }

    var totalWrong = 0, totalFlagged = 0;
    data.forEach(function (d) { totalWrong += (d.wrong || []).length; totalFlagged += (d.flagged || []).length; });
    // Use cached folder title for PDF scope label instead of raw path
    var scopeFolderKey = currentScopePath ? currentScopePath + '/' : '';
    var scopeLabel = currentScope === 'folder'
      ? (_folderTitleCache[scopeFolderKey] || decodeURIComponent(currentScopePath))
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
  updateBadge();
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

    /* 4. Smooth modal close (add .closing class before hiding) */
    var _origClose = window.closeTrackerDashboard;
    window.closeTrackerDashboard = function () {
      var overlay = document.getElementById('tracker-dashboard');
      if (!overlay || !overlay.classList.contains('open')) return;
      overlay.classList.add('closing');
      overlay.addEventListener('animationend', function onEnd() {
        overlay.removeEventListener('animationend', onEnd);
        overlay.classList.remove('open', 'closing');
      });
    };
  })();

})();
