/* ================================================================
   bank-engine.js  —  Shared engine for all question-bank files.
   Load this after defining BANK_CONFIG and QUESTION_BANK globals.
   ================================================================ */
(function () {
  'use strict';

  var _cs  = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : (window.__QUIZ_ENGINE_BASE || '');

  function _addLink(rel, href, extra) {
    var el = document.createElement('link');
    el.rel = rel; el.href = href;
    if (extra) Object.assign(el, extra);
    document.head.appendChild(el);
  }
  function _addMeta(name, content) {
    var m = document.createElement('meta'); m.name = name; m.content = content;
    document.head.appendChild(m);
  }

  _addMeta('theme-color', '#0d1117');
  _addLink('preconnect', 'https://fonts.googleapis.com');
  _addLink('preconnect', 'https://fonts.gstatic.com', {crossOrigin: ''});
  _addLink('stylesheet', 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
  _addLink('manifest',   ENGINE_BASE + 'manifest.webmanifest');
  _addLink('icon',       ENGINE_BASE + 'favicon.svg', {type: 'image/svg+xml'});
  _addLink('apple-touch-icon', ENGINE_BASE + 'favicon.svg');

  // Set background immediately to prevent flash of white
  var savedTheme = localStorage.getItem('quiz-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.style.background = savedTheme === 'light' ? '#f3f0eb' : '#0d1117';
  document.body.style.color = savedTheme === 'light' ? '#1c1917' : '#e6edf3';
  document.body.style.transition = 'background 0.2s ease, color 0.2s ease';
  document.body.style.overflow = 'hidden';

  var _style = document.createElement('style');
  _style.textContent = `/* ═══════════════════════════════════════════
   CSS VARIABLES & THEME
═══════════════════════════════════════════ */
:root {
  --bg:         #0d1117;
  --surface:    #161b22;
  --surface2:   #1c2330;
  --border:     #30363d;
  --text:       #e6edf3;
  --text-muted: #8b949e;
  --accent:     #f0a500;
  --accent-dim: rgba(240,165,0,0.12);
  --correct:    #2ea043;
  --correct-bg: rgba(46,160,67,0.12);
  --wrong:      #da3633;
  --wrong-bg:   rgba(218,54,51,0.12);
  --flagged:    #58a6ff;
  --flagged-bg: rgba(88,166,255,0.12);
  --skip:       #6e7681;
  --radius:     12px;
  --shadow:     0 4px 24px rgba(0,0,0,0.4);
  --transition: 0.2s ease-out;
  --transition-fast: 0.12s ease-out;
  --transition-slow: 0.35s ease-out;
  --nav-size:   280px;
}
[data-theme="light"] {
  --bg:         #f3f0eb;
  --surface:    #ffffff;
  --surface2:   #f8f6f1;
  --border:     #d0ccc5;
  --text:       #1c1917;
  --text-muted: #78716c;
  --accent:     #c27803;
  --accent-dim: rgba(194,120,3,0.10);
  --correct:    #16a34a;
  --correct-bg: rgba(22,163,74,0.10);
  --wrong:      #dc2626;
  --wrong-bg:   rgba(220,38,38,0.10);
  --flagged:    #2563eb;
  --flagged-bg: rgba(37,99,235,0.10);
  --shadow:     0 4px 24px rgba(0,0,0,0.10);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: 'Outfit', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  transition: background var(--transition-slow), color var(--transition-slow);
  overflow: hidden;
}
button { cursor: pointer; font-family: inherit; border: none; outline: none; }
input[type=radio] { display: none; }

/* ═══════════════════════════════════════════
   SCREENS & PAGE TRANSITIONS
═══════════════════════════════════════════ */
.screen {
  display: none;
  width: 100%;
  height: 100%;
  position: relative;
}
.screen.active {
  display: flex;
  animation: screenFadeIn 0.3s ease-out;
}
@keyframes screenFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ═══════════════════════════════════════════
   START SCREEN
═══════════════════════════════════════════ */
#start-screen {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  gap: 1rem;
  overflow-y: auto;
}
.hub-back-btn {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  transition: color var(--transition);
  z-index: 10;
}
.hub-back-btn:hover { color: var(--text); }
.hub-back-btn svg { transition: transform var(--transition); }
.hub-back-btn:hover svg { transform: translateX(-3px); }
.theme-btn-fixed {
  position: fixed;
  top: 1.1rem;
  right: 1.25rem;
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted);
  transition: all var(--transition);
  font-size: 1rem;
  z-index: 10;
}
.theme-btn-fixed:hover { color: var(--text); border-color: var(--accent); }

.start-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem 2rem 1.75rem;
  max-width: 520px;
  width: 100%;
  box-shadow: var(--shadow);
  position: relative;
  transition: box-shadow var(--transition-slow);
}
.start-card:hover {
  box-shadow: 0 6px 28px rgba(0,0,0,0.45);
}
.start-icon {
  width: 60px; height: 60px;
  background: var(--accent-dim);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1.25rem;
  font-size: 1.7rem;
  transition: transform var(--transition-slow);
}
.start-card h1 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.5rem, 4vw, 2.1rem);
  color: var(--text);
  margin-bottom: 0.35rem;
  line-height: 1.2;
  text-align: center;
}
.start-card .subtitle {
  color: var(--text-muted);
  font-size: 0.88rem;
  margin-bottom: 1.25rem;
  text-align: center;
}

/* Bank coverage stats */
.bank-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}
.bank-stat-box {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 0.5rem;
  text-align: center;
  transition: border-color var(--transition);
}
.bank-stat-box:hover {
  border-color: var(--accent);
}
.bank-stat-box .bsv {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--accent);
  display: block;
  line-height: 1;
  margin-bottom: 0.2rem;
}
.bank-stat-box .bsl {
  font-size: 0.68rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.coverage-wrap {
  margin-bottom: 1.25rem;
}
.coverage-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}
.coverage-bar {
  height: 6px;
  background: var(--surface2);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.coverage-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.35s ease-out;
}

/* Section heading */
.section-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6rem;
}

/* Question count selector */
.q-count-section { margin-bottom: 1.1rem; }

/* Time selector */
.time-section { margin-bottom: 1.1rem; }
.time-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.time-adj-btn {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--surface2);
  border: 1.5px solid var(--border);
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition);
  flex-shrink: 0;
}
.time-adj-btn:hover { border-color: var(--accent); color: var(--accent); }
.time-input {
  flex: 1;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  transition: border-color var(--transition);
}
.time-input:focus { outline: none; border-color: var(--accent); }
.time-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
}

/* Mode selection */
.mode-section { margin-bottom: 1rem; }
.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.mode-label { cursor: pointer; }
.mode-option {
  padding: 0.5rem;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface2);
  transition: border-color var(--transition), background var(--transition);
  text-align: center;
}
.mode-option:hover {
  border-color: var(--accent);
}
.mode-option .mo-title { font-weight: 600; font-size: 0.8rem; }
.mode-option .mo-sub  { display: none; }
.mode-selected {
  border-color: var(--accent) !important;
  background: var(--accent-dim) !important;
}

.btn-start {
  width: 100%;
  padding: 0.9rem 2rem;
  border-radius: var(--radius);
  background: var(--accent);
  color: #000;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.02em;
  transition: opacity var(--transition), transform var(--transition), box-shadow var(--transition);
}
.btn-start:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(240,165,0,0.25);
}
.btn-start:active {
  transform: translateY(0);
}

/* Order selection */
.order-section { margin-bottom: 1.25rem; }

/* Reset bank button */
.reset-bank-btn {
  width: 100%;
  margin-top: 0.65rem;
  padding: 0.65rem;
  border-radius: var(--radius);
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  transition: all var(--transition);
}
.reset-bank-btn:hover { border-color: var(--wrong); color: var(--wrong); }

/* ═══════════════════════════════════════════
   QUIZ SCREEN (same as quiz-template.html)
═══════════════════════════════════════════ */
#quiz-screen { flex-direction: column; height: 100%; overflow: hidden; }
.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 10;
}
.topbar-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem;
  font-weight: 700;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.timer-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.4rem 0.85rem;
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 90px;
  justify-content: center;
}
.timer-wrap.warn { border-color: var(--wrong); color: var(--wrong); animation: pulse 1s infinite; }
@keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.6 } }

.topbar-actions { display: flex; gap: 0.5rem; align-items: center; }
.icon-btn {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: var(--surface2);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted);
  transition: all var(--transition);
  font-size: 1rem;
  text-decoration: none;
}
.icon-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}
.icon-btn:active {
  transform: scale(0.95);
}
.icon-btn.danger:hover {
  border-color: var(--wrong);
  color: var(--wrong);
}

.quiz-body { display: flex; flex: 1; overflow: hidden; position: relative; }
.question-area {
  flex: 1; overflow-y: auto;
  padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}
.question-area::-webkit-scrollbar { width: 6px; }
.question-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.q-header { display: flex; align-items: flex-start; gap: 0.75rem; }
.q-number-badge {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  margin-top: 0.25rem;
  flex-shrink: 0;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.q-actions { margin-left: auto; display: flex; gap: 0.5rem; }
.flag-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 7px;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  display: flex; align-items: center; gap: 0.35rem;
  transition: all var(--transition);
}
.flag-btn:hover, .flag-btn.active { background: var(--flagged-bg); border-color: var(--flagged); color: var(--flagged); }

.q-text { font-size: clamp(1rem, 2.5vw, 1.2rem); font-weight: 500; color: var(--text); line-height: 1.7; flex: 1; }

.options-list { display: flex; flex-direction: column; gap: 0.65rem; }
.option-label {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.95rem 1.15rem;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
  overflow: hidden;
}
.option-label::before {
  content: '';
  position: absolute; inset: 0;
  background: var(--accent-dim);
  opacity: 0;
  transition: opacity var(--transition);
}
.option-label:hover { border-color: var(--accent); }
.option-label:hover::before { opacity: 1; }
input[type=radio]:checked + .option-label { border-color: var(--accent); background: var(--accent-dim); }
.option-key {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: var(--surface2);
  border: 1.5px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
  transition: all var(--transition);
  z-index: 1; text-transform: uppercase;
}
input[type=radio]:checked + .option-label .option-key { background: var(--accent); border-color: var(--accent); color: #000; }
.option-text { font-size: 0.95rem; line-height: 1.5; z-index: 1; padding-top: 0.05rem; }

.q-nav-btns { display: flex; gap: 0.75rem; padding-top: 0.5rem; flex-wrap: wrap; }
.btn-nav {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius);
  font-size: 0.9rem; font-weight: 600;
  transition: all var(--transition);
  border: 1.5px solid var(--border);
  background: var(--surface); color: var(--text);
}
.btn-nav:hover { border-color: var(--accent); color: var(--accent); }
.btn-nav.primary { background: var(--accent); color: #000; border-color: var(--accent); margin-left: auto; }
.btn-nav.primary:hover { opacity: 0.85; }
.btn-nav.submit-btn { background: var(--correct); border-color: var(--correct); color: #fff; margin-left: auto; }
.btn-nav.submit-btn:hover { opacity: 0.85; }

/* Nav pane */
.nav-pane {
  width: var(--nav-size);
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
}
.nav-pane-header { padding: 1rem 1.1rem 0.75rem; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.nav-pane-header h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.65rem; font-weight: 600; }
.legend { display: flex; flex-wrap: wrap; gap: 0.4rem 0.75rem; }
.legend-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--text-muted); }
.dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.dot.answered  { background: var(--correct); }
.dot.wrong     { background: var(--wrong); }
.dot.flagged   { background: var(--flagged); }
.dot.current   { background: var(--accent); }
.dot.unanswered{ background: var(--surface2); border: 1.5px solid var(--border); }

.nav-grid-wrap { flex: 1; overflow-y: auto; padding: 0.85rem; }
.nav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 6px; }
.nav-btn {
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 0.78rem; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition);
  position: relative;
}
.nav-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.nav-btn.answered {
  background: var(--correct-bg);
  border-color: var(--correct);
  color: var(--correct);
}
.nav-btn.wrong {
  background: var(--wrong-bg);
  border-color: var(--wrong);
  color: var(--wrong);
}
.nav-btn.flagged {
  background: var(--flagged-bg);
  border-color: var(--flagged);
  color: var(--flagged);
}
.nav-btn.current {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}
.nav-btn .flag-dot {
  position: absolute; top: 2px; right: 2px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--flagged);
}

.nav-stats { padding: 0.75rem 1rem; border-top: 1px solid var(--border); display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; flex-shrink: 0; }
.stat-item { text-align: center; }
.stat-item .sv { font-size: 1rem; font-weight: 700; }
.stat-item .sl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.sv.green { color: var(--correct); }
.sv.blue  { color: var(--flagged); }
.sv.muted { color: var(--text-muted); }

/* Portrait layout */
@media (orientation: portrait) {
  .quiz-body { flex-direction: column; }
  .nav-pane { width: 100%; height: auto; border-left: none; border-top: 1px solid var(--border); max-height: 200px; }
  .nav-pane-header { padding: 0.6rem 1rem 0.5rem; }
  .nav-grid-wrap { padding: 0.5rem 0.85rem; overflow-x: auto; overflow-y: hidden; }
  .nav-grid { grid-template-columns: repeat(var(--q-count, 20), 38px); grid-template-rows: 38px; grid-auto-flow: column; gap: 5px; }
  .nav-btn { width: 38px; height: 38px; aspect-ratio: unset; }
  .nav-stats { padding: 0.5rem 1rem; }
  .stat-item .sv { font-size: 0.9rem; }
}

/* Progress bar */
.progress-bar-wrap {
  height: 3px;
  background: var(--surface2);
  position: relative;
  flex-shrink: 0;
}
.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.35s ease-out;
  border-radius: 0 2px 2px 0;
}

/* ═══════════════════════════════════════════
   RESULTS SCREEN
═══════════════════════════════════════════ */
#result-screen { flex-direction: column; height: 100%; overflow: hidden; }
.result-topbar {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.result-topbar h2 { font-family: 'Playfair Display', serif; font-size: 1.1rem; }
.result-topbar .topbar-actions { margin-left: auto; }

.result-body {
  flex: 1; overflow-y: auto;
  padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1.5rem;
  max-width: 820px; margin: 0 auto; width: 100%;
}
.result-body::-webkit-scrollbar { width: 6px; }
.result-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.score-banner {
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
  padding: 1.75rem 2rem; display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; box-shadow: var(--shadow);
}
.score-circle {
  width: 110px; height: 110px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 4px solid var(--accent); flex-shrink: 0; background: var(--accent-dim);
}
.score-circle .pct { font-size: 1.8rem; font-weight: 700; color: var(--accent); line-height: 1; }
.score-circle .lbl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.score-details { flex: 1; min-width: 180px; }
.score-details h3 { font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 0.75rem; }
.score-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.65rem; }
.score-stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 0.65rem 0.85rem; }
.score-stat .n { font-size: 1.2rem; font-weight: 700; }
.score-stat .t { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
.n.green { color: var(--correct); }
.n.red   { color: var(--wrong); }
.n.blue  { color: var(--flagged); }

.result-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.tab-btn {
  padding: 0.45rem 1rem; border-radius: 8px;
  background: var(--surface); border: 1.5px solid var(--border);
  color: var(--text-muted); font-size: 0.85rem; font-weight: 500;
  transition: all var(--transition);
}
.tab-btn:hover { border-color: var(--accent); color: var(--accent); }
.tab-btn.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

.result-list { display: flex; flex-direction: column; gap: 1rem; }
.result-item { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.result-item.correct { border-color: var(--correct); }
.result-item.wrong   { border-color: var(--wrong); }
.result-item.skipped { border-color: var(--skip); }

.result-item-header { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem 1.25rem; cursor: pointer; }
.result-status-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.9rem; font-weight: 700; margin-top: 0.15rem; }
.result-item.correct .result-status-icon { background: var(--correct-bg); color: var(--correct); }
.result-item.wrong   .result-status-icon { background: var(--wrong-bg);   color: var(--wrong); }
.result-item.skipped .result-status-icon { background: var(--surface2);   color: var(--skip); }

.result-q-meta { flex: 1; }
.result-q-num  { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; font-weight: 600; }
.result-q-text { font-size: 0.95rem; font-weight: 500; line-height: 1.5; }
.expand-arrow  { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.2rem; transition: transform 0.2s; }
.result-item-header.open .expand-arrow { transform: rotate(180deg); }

.result-item-body { display: none; padding: 0 1.25rem 1.1rem; border-top: 1px solid var(--border); }
.result-item-body.open { display: block; }

.answer-row {
  display: flex; align-items: flex-start; gap: 0.65rem;
  padding: 0.6rem 0.75rem; border-radius: 8px; margin-top: 0.5rem; font-size: 0.88rem;
}
.answer-row.your-answer { background: var(--wrong-bg); }
.answer-row.correct-answer { background: var(--correct-bg); }
.answer-row.your-answer.is-correct { background: var(--correct-bg); }
.answer-row .ar-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; white-space: nowrap; margin-top: 0.1rem; opacity: 0.7; }
.explanation-box {
  margin-top: 0.75rem; padding: 0.75rem 1rem;
  background: var(--surface2); border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0;
  font-size: 0.875rem; line-height: 1.6; color: var(--text-muted);
}
.explanation-box strong { color: var(--text); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 0.25rem; }

.result-actions { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.btn-restart {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.85rem 1.75rem;
  border-radius: var(--radius);
  background: var(--accent); color: #000;
  font-weight: 700; font-size: 0.95rem;
  border: 1.5px solid var(--accent);
  transition: all var(--transition);
  text-decoration: none;
}
.btn-restart:hover { opacity: 0.85; transform: translateY(-1px); }
.btn-secondary { background: var(--surface2); color: var(--text); border-color: var(--border); }
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); opacity: 1; }

/* Toast */
.toast {
  position: fixed;
  bottom: 1.5rem; left: 50%; transform: translateX(-50%) translateY(80px);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.65rem 1.2rem;
  font-size: 0.88rem; font-weight: 500; box-shadow: var(--shadow);
  z-index: 9999; transition: transform 0.3s ease, opacity 0.3s ease;
  white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; max-width: 90%;
}
.toast.show { transform: translateX(-50%) translateY(0); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  z-index: 1000; display: none; align-items: center; justify-content: center; padding: 1rem;
}
.modal-overlay.open { display: flex; }
.modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
  padding: 2rem; max-width: 420px; width: 100%; box-shadow: var(--shadow);
  animation: slideUp 0.25s ease;
}
@keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
.modal h3 { font-family: 'Playfair Display', serif; font-size: 1.3rem; margin-bottom: 0.75rem; }
.modal p  { color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.25rem; }
.modal-unanswered { font-weight: 600; color: var(--wrong); }
.modal-actions { display: flex; gap: 0.75rem; }
.modal-actions .btn-cancel {
  flex: 1; padding: 0.75rem; border-radius: 10px;
  background: var(--surface2); border: 1.5px solid var(--border);
  color: var(--text); font-weight: 600; font-size: 0.9rem; transition: all var(--transition);
}
.modal-actions .btn-cancel:hover { border-color: var(--accent); }
.modal-actions .btn-confirm {
  flex: 1; padding: 0.75rem; border-radius: 10px;
  background: var(--correct); border: none;
  color: #fff; font-weight: 700; font-size: 0.9rem; transition: all var(--transition);
}
.modal-actions .btn-confirm:hover { opacity: 0.85; }

/* PDF Export Section */
.pdf-export-section {
  margin-top: 1.5rem; margin-bottom: 1rem; padding: 1rem;
  border-radius: var(--radius); background: var(--surface); border: 1.5px solid var(--border);
}
.export-options { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 0.85rem; }
.export-option {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.65rem;
  border-radius: 6px; background: var(--surface2); border: 1.5px solid var(--border);
  cursor: pointer; transition: all var(--transition); flex: 1; min-width: 120px;
}
.export-option:hover { border-color: var(--accent); background: var(--accent-dim); }
.export-option input[type="checkbox"] { display: none; }
.export-option input[type="checkbox"]:checked + .export-checkbox-visual { border-color: var(--accent); background: var(--accent); }
.export-option input[type="checkbox"]:checked + .export-checkbox-visual svg { display: block; }
.export-checkbox-visual {
  width: 16px; height: 16px; border-radius: 4px; border: 2px solid var(--border);
  background: var(--surface); transition: all var(--transition); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.export-checkbox-visual svg { display: none; width: 10px; height: 10px; stroke: #000; stroke-width: 3; fill: none; }
.export-label { font-size: 0.82rem; font-weight: 500; color: var(--text); flex: 1; }
.export-badge { font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 3px; background: var(--accent-dim); color: var(--accent); font-weight: 600; }
.btn-export-pdf {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1.75rem;
  border-radius: var(--radius); background: var(--surface2); color: var(--text);
  border: 1.5px solid var(--border); font-weight: 700; font-size: 0.95rem;
  transition: all var(--transition); text-decoration: none; width: 100%; justify-content: center;
}
.btn-export-pdf:hover { border-color: var(--accent); color: var(--accent); opacity: 1; }

.hidden { display: none !important; }



/* ═══════════════════════════════════════════
   QUESTION TRACKER DASHBOARD
   ═══════════════════════════════════════════ */
/* Dashboard overlay */
.dash-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(6px);
  z-index: 2000;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: dashFadeIn 0.2s ease;
}
.dash-overlay.open { display: flex; }
@keyframes dashFadeIn { from { opacity: 0; } to { opacity: 1; } }

.dash-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  animation: dashSlideUp 0.25s ease;
}
@keyframes dashSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.dash-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.dash-header h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.2rem;
  flex: 1;
}
.dash-close-btn {
  width: 34px; height: 34px;
  border-radius: 8px;
  background: var(--surface2);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all var(--transition);
}
.dash-close-btn:hover { color: var(--text); border-color: var(--accent); }

/* Dashboard scope tabs */
.dash-scope-bar {
  display: flex; gap: 0; padding: 0 1.5rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.dash-scope-tab {
  padding: 0.6rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition);
  background: none; border-top: none; border-left: none; border-right: none;
}
.dash-scope-tab:hover { color: var(--text); }
.dash-scope-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* Dashboard summary stats */
.dash-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.dash-stat {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem;
  text-align: center;
}
.dash-stat .ds-val { font-size: 1.5rem; font-weight: 700; line-height: 1.2; }
.dash-stat .ds-lbl { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.2rem; }
.ds-val.red { color: var(--wrong); }
.ds-val.blue { color: var(--flagged); }
.ds-val.green { color: var(--correct); }

/* Dashboard body */
.dash-body { flex: 1; overflow-y: auto; padding: 1rem 1.5rem; }
.dash-body::-webkit-scrollbar { width: 6px; }
.dash-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.dash-quiz-group { margin-bottom: 1.25rem; }
.dash-quiz-title {
  font-weight: 700; font-size: 0.9rem; color: var(--text);
  margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem;
}
.dash-quiz-title .quiz-badge { font-size: 0.65rem; padding: 0.15rem 0.5rem; border-radius: 5px; font-weight: 600; }
.dash-quiz-title .quiz-badge.wrong-badge { background: var(--wrong-bg); color: var(--wrong); }
.dash-quiz-title .quiz-badge.flag-badge { background: var(--flagged-bg); color: var(--flagged); }

.dash-q-item {
  display: flex; align-items: flex-start; gap: 0.65rem;
  padding: 0.65rem 0.85rem; border-radius: 8px; margin-bottom: 0.4rem;
  border: 1px solid var(--border); background: var(--surface2);
  transition: all var(--transition);
}
.dash-q-item:hover { border-color: var(--accent); }
.dash-q-icon {
  width: 24px; height: 24px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; flex-shrink: 0; margin-top: 0.1rem;
}
.dash-q-icon.wrong { background: var(--wrong-bg); color: var(--wrong); }
.dash-q-icon.flagged { background: var(--flagged-bg); color: var(--flagged); }
.dash-q-content { flex: 1; min-width: 0; }
.dash-q-num { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.dash-q-text { font-size: 0.85rem; font-weight: 500; line-height: 1.4; color: var(--text); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.dash-q-remove {
  width: 22px; height: 22px; border-radius: 5px;
  background: transparent; border: 1px solid transparent;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); font-size: 0.75rem; cursor: pointer;
  transition: all var(--transition); flex-shrink: 0;
}
.dash-q-remove:hover { border-color: var(--wrong); color: var(--wrong); background: var(--wrong-bg); }

/* Dashboard footer */
.dash-footer {
  padding: 1rem 1.5rem; border-top: 1px solid var(--border);
  display: flex; gap: 0.75rem; flex-shrink: 0;
}
.btn-dash-action {
  padding: 0.65rem 1.25rem; border-radius: 8px;
  background: var(--surface2); border: 1.5px solid var(--border);
  color: var(--text); font-weight: 600; font-size: 0.85rem;
  cursor: pointer; transition: all var(--transition);
}
.btn-dash-action:hover { border-color: var(--accent); color: var(--accent); }
.btn-dash-danger:hover { border-color: var(--wrong); color: var(--wrong); }
.btn-dash-close {
  flex: 1; padding: 0.65rem 1.25rem; border-radius: 8px;
  background: var(--accent); border: 1.5px solid var(--accent);
  color: #000; font-weight: 700; font-size: 0.85rem;
  cursor: pointer; transition: all var(--transition);
}
.btn-dash-close:hover { opacity: 0.85; }

/* Empty state */
.dash-empty { text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); }
.dash-empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.5; }
.dash-empty p { font-size: 0.9rem; line-height: 1.5; }

@media (max-width: 480px) {
  .dash-modal { max-height: 90vh; border-radius: 16px; }
  .dash-summary { grid-template-columns: repeat(3, 1fr); gap: 0.5rem; padding: 1rem; }
  .dash-stat { padding: 0.6rem; }
  .dash-stat .ds-val { font-size: 1.2rem; }
  .dash-body { padding: 0.75rem 1rem; }
}
`;
  document.head.appendChild(_style);

  /* ── Inject Animation System v2 ────────────────────────────── */
  var _animStyle = document.createElement('style');
  _animStyle.textContent = '/* ════════════════════════════════════════════════════════════════\n   SMOOTH ANIMATION SYSTEM  v2\n   Easing · Entrance · Hover · Press · Modal · Ripple\n════════════════════════════════════════════════════════════════ */\n\n/* ── Easing tokens ──────────────────────────────────────────── */\n:root {\n  --ease-out    : cubic-bezier(0.16, 1, 0.3, 1);\n  --ease-spring : cubic-bezier(0.34, 1.56, 0.64, 1);\n  --ease-in-out : cubic-bezier(0.65, 0, 0.35, 1);\n  --transition  : 0.22s cubic-bezier(0.16, 1, 0.3, 1);\n}\n\n/* ── Screen transitions ────────────────────────────────────── */\n@keyframes screenFadeIn {\n  from { opacity: 0; }\n  to   { opacity: 1; }\n}\n\n/* ── Start screen entrance ─────────────────────────────────── */\n@keyframes slideDown {\n  from { opacity: 0; transform: translateY(-18px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n@keyframes fadeUp {\n  from { opacity: 0; transform: translateY(24px); }\n  to   { opacity: 1; transform: translateY(0); }\n}\n@keyframes iconPop {\n  0%   { transform: scale(0.7) rotate(-8deg); opacity: 0; }\n  60%  { transform: scale(1.15) rotate(4deg); }\n  100% { transform: scale(1)    rotate(0deg); opacity: 1; }\n}\n\n.topbar { animation: slideDown 0.45s var(--ease-out) both; }\n#start-screen .start-card { animation: fadeUp 0.55s 0.1s var(--ease-out) both; }\n#start-screen .start-icon { animation: iconPop 0.5s 0.2s var(--ease-spring) both; }\n\n/* ── Card hover effects ────────────────────────────────────── */\n.start-card {\n  transition:\n    transform      0.32s var(--ease-out),\n    box-shadow     0.32s var(--ease-out),\n    border-color   0.28s var(--ease-out) !important;\n}\n.start-card:hover {\n  transform   : translateY(-5px) scale(1.008);\n  box-shadow  : 0 16px 40px rgba(0,0,0,0.45);\n}\n\n.start-icon {\n  transition: transform 0.35s var(--ease-spring) !important;\n}\n.start-card:hover .start-icon {\n  transform : scale(1.08) rotate(-4deg);\n}\n\n/* ── Button effects ────────────────────────────────────────── */\n.btn-start, .btn-nav, .btn-restart {\n  position  : relative;\n  overflow  : hidden;\n  transition:\n    opacity    0.22s var(--ease-out),\n    transform  0.22s var(--ease-out),\n    box-shadow 0.22s var(--ease-out) !important;\n}\n.btn-start:hover, .btn-nav.primary:hover, .btn-restart:hover {\n  opacity   : 0.92 !important;\n  transform : translateY(-2px) !important;\n  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 40%, transparent);\n}\n.btn-start:active, .btn-nav:active, .btn-restart:active {\n  transform : scale(0.97) translateY(0px) !important;\n  transition-duration: 0.09s !important;\n}\n\n/* ── Ripple wave ─────────────────────────────────────────────── */\n@keyframes ripple {\n  to { transform: scale(5); opacity: 0; }\n}\n.ripple-wave {\n  position      : absolute;\n  border-radius : 50%;\n  width         : 60px;\n  height        : 60px;\n  margin-top    : -30px;\n  margin-left   : -30px;\n  background    : rgba(255, 255, 255, 0.22);\n  transform     : scale(0);\n  animation     : ripple 0.55s var(--ease-out) forwards;\n  pointer-events: none;\n}\n\n/* ── Icon buttons ───────────────────────────────────────────── */\n.icon-btn, .hub-back-btn, .theme-btn-fixed {\n  transition: all 0.22s var(--ease-out) !important;\n}\n.hub-back-btn:hover, .theme-btn-fixed:hover {\n  transform: translateY(-1px);\n  color: var(--text) !important;\n  border-color: var(--accent) !important;\n}\n.icon-btn:active, .hub-back-btn:active, .theme-btn-fixed:active {\n  transform      : scale(0.87) !important;\n  transition-duration: 0.08s !important;\n}\n\n/* ── Theme toggle spin ──────────────────────────────────────── */\n@keyframes spinPop {\n  0%   { transform: rotate(0deg)   scale(1);    }\n  40%  { transform: rotate(200deg) scale(0.85); }\n  70%  { transform: rotate(320deg) scale(1.1);  }\n  100% { transform: rotate(360deg) scale(1);    }\n}\n.theme-spinning {\n  animation: spinPop 0.5s var(--ease-spring) forwards !important;\n}\n\n/* ── Option hover effects ──────────────────────────────────── */\n.option-label {\n  transition:\n    transform    0.2s var(--ease-out),\n    border-color 0.2s var(--ease-out),\n    background   0.2s var(--ease-out) !important;\n}\n.option-label:hover {\n  transform   : translateX(4px);\n  border-color: var(--accent) !important;\n}\n\n/* ── Nav button effects ────────────────────────────────────── */\n.nav-btn {\n  transition:\n    transform    0.15s var(--ease-out),\n    border-color 0.2s var(--ease-out),\n    background   0.2s var(--ease-out) !important;\n}\n.nav-btn:hover {\n  transform   : scale(1.08);\n  border-color: var(--accent) !important;\n}\n.nav-btn:active {\n  transform      : scale(0.95) !important;\n  transition-duration: 0.08s !important;\n}\n\n/* ── Flag button pulse ─────────────────────────────────────── */\n@keyframes badgePulse {\n  0%   { transform: scale(1);    }\n  50%  { transform: scale(1.15); }\n  100% { transform: scale(1);    }\n}\n.flag-btn.active svg {\n  animation: badgePulse 0.4s var(--ease-spring);\n}\n\n/* ── Modal effects ─────────────────────────────────────────── */\n.modal-overlay {\n  transition: opacity 0.25s var(--ease-out) !important;\n}\n.modal {\n  animation: modalIn 0.38s var(--ease-spring) both !important;\n}\n@keyframes modalIn {\n  from { opacity: 0; transform: translateY(28px) scale(0.93); }\n  to   { opacity: 1; transform: translateY(0)    scale(1);    }\n}\n\n/* ── Result item animations ────────────────────────────────── */\n.result-item {\n  animation: fadeUp 0.4s var(--ease-out) both;\n}\n.result-item:nth-child(1) { animation-delay: 0.05s; }\n.result-item:nth-child(2) { animation-delay: 0.1s; }\n.result-item:nth-child(3) { animation-delay: 0.15s; }\n.result-item:nth-child(4) { animation-delay: 0.2s; }\n.result-item:nth-child(5) { animation-delay: 0.25s; }\n.result-item:nth-child(n+6) { animation-delay: 0.3s; }\n\n/* ── Stat box hover ────────────────────────────────────────── */\n.bank-stat-box, .meta-item {\n  transition:\n    transform    0.2s var(--ease-out),\n    border-color 0.2s var(--ease-out) !important;\n}\n.bank-stat-box:hover, .meta-item:hover {\n  transform   : translateY(-2px);\n  border-color: var(--accent) !important;\n}\n\n/* ── Timer warning pulse ───────────────────────────────────── */\n@keyframes pulse {\n  0%, 100% { opacity: 1; }\n  50%      { opacity: 0.6; }\n}\n\n/* ── Respect prefers-reduced-motion ─────────────────────────── */\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration  : 0.01ms !important;\n    animation-delay     : 0ms    !important;\n    transition-duration : 0.01ms !important;\n  }\n}';
  document.head.appendChild(_animStyle);

  document.body.innerHTML = `
<!-- ═══════════════════════════ START SCREEN ═══════════════════════════ -->
<div id="start-screen" class="screen active">
  <a href="#" class="hub-back-btn" onclick="navigateToIndex(event); return false;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
    Back to Hub
  </a>
  <button class="theme-btn-fixed theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">☀</button>

  <div class="start-card">
<div class="start-icon" id="start-icon">🗃️</div>
    <h1 id="bank-title">Question Bank</h1>
    <p class="subtitle" id="bank-subtitle">A smart question bank that shows you fresh questions every session.</p>

    <!-- Coverage stats -->
    <div class="bank-stats-row">
      <div class="bank-stat-box">
        <span class="bsv" id="stat-covered">0</span>
        <span class="bsl">Covered</span>
      </div>
      <div class="bank-stat-box">
        <span class="bsv" id="stat-total">0</span>
        <span class="bsl">In Bank</span>
      </div>
      <div class="bank-stat-box">
        <span class="bsv" id="stat-sessions">0</span>
        <span class="bsl">Sessions</span>
      </div>
    </div>

    <!-- Coverage bar -->
    <div class="coverage-wrap">
      <div class="coverage-label">
        <span>Bank Coverage</span>
        <span id="coverage-pct">0%</span>
      </div>
      <div class="coverage-bar">
        <div class="coverage-fill" id="coverage-fill" style="width: 0%"></div>
      </div>
    </div>

    <!-- Question count -->
    <div class="q-count-section">
      <div class="section-label">Number of Questions <span style="color:var(--text-muted);font-size:0.75rem;font-weight:400;margin-left:0.35rem">(qs)</span></div>
      <div class="time-controls">
        <button class="time-adj-btn" onclick="adjustCount(-5)">−5</button>
        <input type="number" id="q-count-input" class="time-input" min="1" value="20" oninput="onCustomCount(this.value)">
        <button class="time-adj-btn" onclick="adjustCount(5)">+5</button>
      </div>
    </div>

    <!-- Time selector (exam mode only) -->
    <div class="time-section" id="time-section">
      <div class="section-label">Time Limit <span style="color:var(--text-muted);font-size:0.75rem;font-weight:400;margin-left:0.35rem">(min)</span></div>
      <div class="time-controls">
        <button class="time-adj-btn" onclick="adjustTime(-5)">−5</button>
        <input type="number" id="time-input" class="time-input" min="1" max="300" value="30">
        <button class="time-adj-btn" onclick="adjustTime(5)">+5</button>
      </div>
    </div>

    <!-- Mode selection -->
    <div class="mode-section">

      <div class="mode-grid">
        <label class="mode-label">
          <input type="radio" name="quiz-mode" value="exam" checked>
          <div class="mode-option mode-selected">
            <div class="mo-title">📝 Exam Mode</div>
          </div>
        </label>
        <label class="mode-label">
          <input type="radio" name="quiz-mode" value="learning">
          <div class="mode-option">
            <div class="mo-title">📚 Learning Mode</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Question order -->
    <div class="order-section">
      <div class="section-label">Question Order</div>
      <div class="mode-grid">
        <label class="mode-label">
          <input type="radio" name="quiz-order" value="sequential" checked>
          <div class="mode-option mode-order-selected">
            <div class="mo-title">📋 Sequential</div>
          </div>
        </label>
        <label class="mode-label">
          <input type="radio" name="quiz-order" value="random">
          <div class="mode-option">
            <div class="mo-title">🔀 Random</div>
          </div>
        </label>
      </div>
    </div>

    <button class="btn-start" onclick="startQuiz()">Start Session →</button>
    <button class="reset-bank-btn" onclick="resetBankProgress()">🗑 Reset Bank Progress</button>
  </div>
</div>

<!-- ═══════════════════════════ QUIZ SCREEN ═══════════════════════════ -->
<div id="quiz-screen" class="screen">
  <div class="topbar">
    <div class="topbar-title" id="topbar-title">Question Bank</div>
    <div class="timer-wrap" id="timer-display">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span id="timer-text">00:00</span>
    </div>
    <div class="topbar-actions">
      <a href="#" class="icon-btn" title="Back to Hub" onclick="navigateToIndex(event); return false;">🏠</a>
      <button class="icon-btn theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">☀</button>
      <button class="icon-btn danger" onclick="confirmResetProgress()" title="Reset Progress">↻</button>
    </div>
  </div>
  <div class="progress-bar-wrap">
    <div class="progress-bar-fill" id="progress-fill" style="width:0%"></div>
  </div>
  <div class="quiz-body">
    <div class="question-area" id="question-area"></div>
    <div class="nav-pane" id="nav-pane">
      <div class="nav-pane-header">
        <h3>Navigation</h3>
        <div class="legend">
          <div class="legend-item"><div class="dot current"></div> Current</div>
          <div class="legend-item"><div class="dot answered"></div> <span id="legend-text-answered">Answered</span></div>
          <div class="legend-item" id="legend-wrong" style="display:none;"><div class="dot wrong"></div> Wrong</div>
          <div class="legend-item"><div class="dot flagged"></div> Flagged</div>
          <div class="legend-item"><div class="dot unanswered"></div> Skipped</div>
        </div>
      </div>
      <div class="nav-grid-wrap"><div class="nav-grid" id="nav-grid"></div></div>
      <div class="nav-stats">
        <div class="stat-item"><div class="sv green" id="stat-answered">0</div><div class="sl">Done</div></div>
        <div class="stat-item"><div class="sv blue"  id="stat-flagged-q">0</div><div class="sl">Flagged</div></div>
        <div class="stat-item"><div class="sv muted" id="stat-skipped">0</div><div class="sl">Skipped</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════ RESULTS SCREEN ═══════════════════════════ -->
<div id="result-screen" class="screen">
  <div class="result-topbar">
    <h2>📊 Session Results</h2>
    <div class="topbar-actions">
      <a href="#" class="icon-btn" title="Back to Hub" onclick="navigateToIndex(event); return false;">🏠</a>
      <button class="icon-btn theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">☀</button>
    </div>
  </div>
  <div class="result-body">
    <div class="score-banner">
      <div class="score-circle">
        <div class="pct" id="res-pct">0%</div>
        <div class="lbl">Score</div>
      </div>
      <div class="score-details">
        <h3 id="res-grade">Loading…</h3>
        <div class="score-grid">
          <div class="score-stat"><div class="n green" id="res-correct">0</div><div class="t">Correct</div></div>
          <div class="score-stat"><div class="n red"   id="res-wrong">0</div><div class="t">Wrong</div></div>
          <div class="score-stat"><div class="n blue"  id="res-flagged">0</div><div class="t">Flagged</div></div>
          <div class="score-stat"><div class="n muted" id="res-skipped">0</div><div class="t">Skipped</div></div>
          <div class="score-stat"><div class="n" id="res-time">—</div><div class="t">Time Used</div></div>
        </div>
      </div>
    </div>

    <!-- PDF Export Section -->
    <div class="pdf-export-section">
      <div class="export-options">
        <label class="export-option">
          <input type="checkbox" name="export-all" checked onchange="onExportFilterChange(this)">
          <span class="export-checkbox-visual">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </span>
          <span class="export-label">All</span>
          <span class="export-badge" id="badge-all">0</span>
        </label>
        <label class="export-option">
          <input type="checkbox" name="export-wrong" onchange="onExportFilterChange(this)">
          <span class="export-checkbox-visual">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </span>
          <span class="export-label">Wrong</span>
          <span class="export-badge" id="badge-wrong">0</span>
        </label>
        <label class="export-option">
          <input type="checkbox" name="export-flagged" onchange="onExportFilterChange(this)">
          <span class="export-checkbox-visual">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </span>
          <span class="export-label">Flagged</span>
          <span class="export-badge" id="badge-flagged">0</span>
        </label>
      </div>
      <button class="btn-export-pdf" onclick="exportToPDF()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Export to PDF
      </button>
    </div>

    <div class="result-tabs">
      <button class="tab-btn active" onclick="filterResults('all', this)">All Questions</button>
      <button class="tab-btn" onclick="filterResults('correct', this)">✓ Correct</button>
      <button class="tab-btn" onclick="filterResults('wrong', this)">✗ Wrong</button>
      <button class="tab-btn" onclick="filterResults('skipped', this)">— Skipped</button>
      <button class="tab-btn" onclick="filterResults('flagged', this)">⚑ Flagged</button>
    </div>
    <div class="result-list" id="result-list"></div>
    <div class="result-actions">
      <button class="btn-restart" onclick="showScreen('start-screen')">↺ New Session</button>
      <a href="#" class="btn-restart btn-secondary" onclick="navigateToIndex(event); return false;">🏠 Return to Hub</a>
    </div>
  </div>
</div>

<!-- Modal -->
<div class="modal-overlay" id="submit-modal">
  <div class="modal">
    <h3>Submit Quiz?</h3>
    <p>You have <span class="modal-unanswered" id="modal-unanswered">—</span> unanswered question(s). Are you sure?</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Go Back</button>
      <button class="btn-confirm" onclick="confirmSubmit()">Submit Now</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<!-- ════════════════════════════════════════════════════════════════
     ▼ BANK CONFIGURATION — Edit below
═══════════════════════════════════════════════════════════════════ -->`;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(ENGINE_BASE + 'sw.js').catch(function () {});
    });
  }
})();

/* ================================================================
   BANK ENGINE
   ================================================================ */
/* ══════════════════════════════════════════════════
   QUESTION BANK ENGINE
══════════════════════════════════════════════════ */
const KEYS = ['A','B','C','D','E','F','G','H'];

// Session questions (selected subset from bank for this session)
let SESSION_QUESTIONS = [];
// Bank indices corresponding to SESSION_QUESTIONS — saved so restore skips re-selection
let SESSION_QUESTION_INDICES = [];
// Set to true after initUI() completes — prevents adjustCount/setCount/onCustomCount
// from wiping saved progress during page initialisation
let uiReady = false;

// Quiz state
let state = {
  current:   0,
  answers:   {},
  flagged:   {},
  timerSecs: 0,
  elapsed:   0,
  timerID:   null,
  submitted: false,
  mode:      'exam',
};
let timerPaused = false;
let lastTime = Date.now();

// Start screen config
let selectedCount = 20;

/* ─── SESSION PROGRESS STORAGE ─────────────────────────────────────
   Tracks quiz session progress (answers, flags, timer) across page reloads.
   Uses same pattern as misc-mcq.html for consistency.
──────────────────────────────────────────────────────────────── */
const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `quiz_progress_${STORAGE_VERSION}_${(BANK_CONFIG.uid || window.location.pathname).replace(/[^a-zA-Z0-9]/g, '_')}`;
let pendingRestoreData = null;
let restoreToastTimeout = null;

/**
 * Safely save quiz progress to localStorage
 * Handles quota errors and validates data before saving
 */
function saveProgress() {
  if (state.submitted) return;

  // Don't save if there's no progress yet (prevents blank saves on first load/exit)
  const hasAnswers = Object.keys(state.answers || {}).length > 0;
  const hasFlags = Object.values(state.flagged || {}).some(v => v === true);
  const hasTime = (state.elapsed || 0) > 10;
  if (!hasAnswers && !hasFlags && !hasTime) return;

  const saveData = {
    version: STORAGE_VERSION,
    quizTitle: BANK_CONFIG.title,
    totalQuestions: SESSION_QUESTIONS.length,
    questionCount: selectedCount, // Store the selected question count for validation
    sessionIndices: SESSION_QUESTION_INDICES, // Exact bank indices — lets restore skip re-selection
    current: state.current,
    answers: state.answers,
    flagged: state.flagged,
    elapsed: state.elapsed,
    timerSecs: state.timerSecs,
    mode: state.mode,
    timestamp: Date.now(),
    savedAt: Date.now()
  };

  try {
    if (!isValidSaveData(saveData)) {
      console.warn('Invalid save data, skipping save');
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    console.log('Progress saved successfully');
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('LocalStorage quota exceeded, clearing old saves...');
      clearOldSaves();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      } catch (retryError) {
        console.error('Failed to save progress even after cleanup:', retryError);
      }
    } else {
      console.error('Error saving progress:', e);
    }
  }
}

/**
 * Validate save data structure
 */
function isValidSaveData(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.current !== 'number' || data.current < 0) return false;
  if (!data.answers || typeof data.answers !== 'object') return false;
  if (!data.flagged || typeof data.flagged !== 'object') return false;
  if (typeof data.timerSecs !== 'number' || data.timerSecs < 0) return false;
  if (!['exam', 'learning'].includes(data.mode)) return false;
  if (typeof data.questionCount !== 'number' || data.questionCount < 1) return false;
  if (typeof data.totalQuestions !== 'number' || data.totalQuestions < 1) return false;
  // sessionIndices must exist and every index must be a valid bank index
  if (!Array.isArray(data.sessionIndices) || data.sessionIndices.length === 0) return false;
  if (data.sessionIndices.some(i => typeof i !== 'number' || i < 0 || i >= QUESTION_BANK.length)) return false;
  return true;
}

/**
 * Clear old saves from other quizzes to free up space
 */
function clearOldSaves() {
  try {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('quiz_progress_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (now - data.timestamp > maxAge) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    });
  } catch (e) {
    console.error('Error clearing old saves:', e);
  }
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check for saved progress on init and show optional restore toast
 */
function checkSavedProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);

    if (data.version !== STORAGE_VERSION) {
      console.log('Incompatible save version, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (data.quizTitle !== BANK_CONFIG.title) {
      console.log('Save is for a different quiz, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Validate basic structure before showing restore option
    if (!isValidSaveData(data)) {
      console.log('Invalid save data structure, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > maxAge) {
      console.log('Save is too old, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    pendingRestoreData = data;

    showToast("📂 Previous progress found!", [
      {
        label: "Restore",
        primary: true,
        onClick: () => {
          clearTimeout(restoreToastTimeout);
          doRestoreProgress(pendingRestoreData);
        }
      },
      {
        label: "Dismiss",
        primary: false,
        onClick: () => {
          clearTimeout(restoreToastTimeout);
          pendingRestoreData = null;
          clearProgress();
        }
      }
    ]);

    restoreToastTimeout = setTimeout(() => {
      console.log('Auto-dismissing restore toast after 15 seconds');
      pendingRestoreData = null;
      clearProgress();
      const toast = document.getElementById('toast');
      if (toast) {
        toast.classList.remove('show');
      }
    }, 15000);

  } catch(e) {
    console.error('Error checking saved progress:', e);
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Actually perform the restore with validated data
 */
function doRestoreProgress(data) {
  if (!data.savedAt) {
    data.savedAt = data.timestamp;
  }

  // Restore the selectedCount from saved data
  selectedCount = data.questionCount || 20;
  
  // Update the input field to reflect restored count
  const inp = document.getElementById('q-count-input');
  if (inp) inp.value = selectedCount;

  // Restore session questions DIRECTLY from saved indices — do NOT call
  // selectSessionQuestions() here because that would pick NEW questions,
  // corrupt bank progress (double-count the session), and mismatch answers.
  SESSION_QUESTION_INDICES = data.sessionIndices;
  SESSION_QUESTIONS = data.sessionIndices.map(i => QUESTION_BANK[i]);

  // Validate all answer indices are still valid
  for (const [qIdx, optIdx] of Object.entries(data.answers)) {
    const qIndex = parseInt(qIdx);
    if (qIndex >= 0 && qIndex < SESSION_QUESTIONS.length) {
      const optCount = SESSION_QUESTIONS[qIndex].options.length;
      if (optIdx < 0 || optIdx >= optCount) {
        delete data.answers[qIdx];
      }
    } else {
      delete data.answers[qIdx];
    }
  }

  state.current = Math.min(data.current, SESSION_QUESTIONS.length - 1);
  state.answers = data.answers;
  state.flagged = data.flagged || {};
  state.elapsed = data.elapsed || 0;
  state.timerSecs = data.timerSecs || 0;
  state.mode = data.mode;
  state.submitted = false;

  setTimeout(() => {
    // Set CSS variable for portrait nav grid (same as startQuiz does)
    document.documentElement.style.setProperty('--q-count', SESSION_QUESTIONS.length);

    if(state.mode === 'learning') {
      document.getElementById('timer-display').classList.add('hidden');
      document.getElementById('legend-text-answered').textContent = 'Correct';
      document.getElementById('legend-wrong').style.display = 'flex';
    } else {
      document.getElementById('timer-display').classList.remove('hidden');
      document.getElementById('legend-text-answered').textContent = 'Answered';
      document.getElementById('legend-wrong').style.display = 'none';
    }
    showScreen('quiz-screen');
    buildNavGrid();
    renderQuestion(state.current);
    updateTimerDisplay();
    if(state.mode !== 'learning') {
      startTimer();
    }
  }, 500);
}

/* ─── BANK PROGRESS STORAGE ─────────────────────────────────────
   Tracks which questions from the bank have been shown across sessions.
   Structure: { shownIndices: number[], totalSessions: number, cycleCount: number }
──────────────────────────────────────────────────────────────── */
const BANK_PROGRESS_KEY = `bank_progress_v1_${(BANK_CONFIG.uid || 'default').replace(/[^a-zA-Z0-9]/g,'_')}`;

function getBankProgress() {
  try {
    const raw = localStorage.getItem(BANK_PROGRESS_KEY);
    if (!raw) return { shownIndices: [], totalSessions: 0, cycleCount: 0 };
    const p = JSON.parse(raw);
    return {
      shownIndices:   Array.isArray(p.shownIndices)   ? p.shownIndices   : [],
      totalSessions:  typeof p.totalSessions === 'number' ? p.totalSessions : 0,
      cycleCount:     typeof p.cycleCount    === 'number' ? p.cycleCount    : 0,
    };
  } catch(e) {
    return { shownIndices: [], totalSessions: 0, cycleCount: 0 };
  }
}

function saveBankProgress(progress) {
  try {
    localStorage.setItem(BANK_PROGRESS_KEY, JSON.stringify(progress));
  } catch(e) {
    console.error('Failed to save bank progress:', e);
  }
}

function resetBankProgress() {
  if (!confirm('Reset all bank progress? This will forget which questions you have already seen.')) return;
  localStorage.removeItem(BANK_PROGRESS_KEY);
  updateStartScreenStats();
  showToast('🔄 Bank progress reset!');
}

/* ─── QUESTION SELECTION ─────────────────────────────────────
   Picks `count` questions preferring unshown ones.
   When all questions have been shown, starts a new coverage cycle.
──────────────────────────────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function selectSessionQuestions(count, order = 'sequential') {
  const bankSize = QUESTION_BANK.length;
  const n = Math.min(count, bankSize);
  const progress = getBankProgress();

  const allIndices = Array.from({ length: bankSize }, (_, i) => i);
  let unshown = allIndices.filter(i => !progress.shownIndices.includes(i));

  // If we've exhausted the bank (or nearly so), reset cycle
  if (unshown.length < n) {
    progress.shownIndices = [];
    progress.cycleCount++;
    unshown = [...allIndices];
    saveBankProgress(progress);
    showToast(`🎉 Full cycle complete! Starting fresh — cycle ${progress.cycleCount + 1}`);
  }

  // Sequential: pick next N questions in original bank order (no shuffle)
  // Random: shuffle then pick N for fair random coverage
  const picked = order === 'sequential'
    ? unshown.sort((a, b) => a - b).slice(0, n)
    : shuffle(unshown).slice(0, n);

  // Update shown indices
  progress.shownIndices = [...new Set([...progress.shownIndices, ...picked])];
  progress.totalSessions++;
  saveBankProgress(progress);

  SESSION_QUESTION_INDICES = picked;
  return picked.map(i => QUESTION_BANK[i]);
}

/* ─── START SCREEN LOGIC ────────────────────────────────────── */
function updateStartScreenStats() {
  const progress = getBankProgress();
  const bankSize = QUESTION_BANK.length;
  const covered  = progress.shownIndices.length;
  const pct      = bankSize > 0 ? Math.round(covered / bankSize * 100) : 0;

  document.getElementById('stat-covered').textContent  = covered;
  document.getElementById('stat-total').textContent    = bankSize;
  document.getElementById('stat-sessions').textContent = progress.totalSessions;
  document.getElementById('coverage-fill').style.width = pct + '%';
  document.getElementById('coverage-pct').textContent  = pct + '%';
}

function adjustCount(delta) {
  const inp = document.getElementById('q-count-input');
  const bankSize = QUESTION_BANK.length;
  const cur = parseInt(inp.value) || selectedCount || 20;
  const newVal = Math.max(1, Math.min(bankSize, cur + delta));
  inp.value = newVal;
  selectedCount = newVal;
  autoSetTime(newVal);
  
  // Only clear saved progress when user actively changes the count (not during init)
  if (uiReady) clearProgress();
}

function setCount(n) {
  const bankSize = QUESTION_BANK.length;
  if (n === -1) n = bankSize; // "All"
  n = Math.max(1, Math.min(n, bankSize));
  selectedCount = n;

  document.getElementById('q-count-input').value = n;
  autoSetTime(n);
  
  // Only clear saved progress when user actively changes the count (not during init)
  if (uiReady) clearProgress();
}

function onCustomCount(val) {
  const bankSize = QUESTION_BANK.length;
  let n = parseInt(val) || 1;
  n = Math.max(1, Math.min(n, bankSize));
  selectedCount = n;
  autoSetTime(n);
  
  // Only clear saved progress when user actively changes the count (not during init)
  if (uiReady) clearProgress();
}

function autoSetTime(n) {
  const autoMins = Math.max(1, n);
  document.getElementById('time-input').value = autoMins;
}

function adjustTime(delta) {
  const inp = document.getElementById('time-input');
  const cur = parseInt(inp.value) || 10;
  inp.value = Math.max(1, Math.min(300, cur + delta));
}

/* ─── MODE SELECTION ────────────────────────────────────────── */
document.querySelectorAll('input[name="quiz-mode"]').forEach(input => {
  input.addEventListener('change', function() {
    document.querySelectorAll('input[name="quiz-mode"]').forEach(r => {
      const opt = r.closest('label').querySelector('.mode-option');
      opt.classList.remove('mode-selected');
      opt.style.borderColor = '';
      opt.style.background  = '';
    });
    const selected = this.closest('label').querySelector('.mode-option');
    selected.classList.add('mode-selected');
    // Show/hide time selector
    const timeSec = document.getElementById('time-section');
    timeSec.style.display = this.value === 'exam' ? '' : 'none';
  });
});
// Init mode selection visuals
(function() {
  const checked = document.querySelector('input[name="quiz-mode"]:checked');
  if (checked) {
    const opt = checked.closest('label').querySelector('.mode-option');
    opt.classList.add('mode-selected');
    opt.style.borderColor = 'var(--accent)';
    opt.style.background  = 'var(--accent-dim)';
  }
})();

/* ─── ORDER SELECTION ───────────────────────────────────────── */
document.querySelectorAll('input[name="quiz-order"]').forEach(input => {
  input.addEventListener('change', function() {
    document.querySelectorAll('input[name="quiz-order"]').forEach(r => {
      const opt = r.closest('label').querySelector('.mode-option');
      opt.classList.remove('mode-order-selected');
      opt.style.borderColor = '';
      opt.style.background  = '';
    });
    const selected = this.closest('label').querySelector('.mode-option');
    selected.classList.add('mode-order-selected');
    selected.style.borderColor = 'var(--accent)';
    selected.style.background  = 'var(--accent-dim)';
  });
});
// Init order selection visuals
(function() {
  const checked = document.querySelector('input[name="quiz-order"]:checked');
  if (checked) {
    const opt = checked.closest('label').querySelector('.mode-option');
    opt.classList.add('mode-order-selected');
    opt.style.borderColor = 'var(--accent)';
    opt.style.background  = 'var(--accent-dim)';
  }
})();

/* ─── INIT UI ────────────────────────────────────────────────── */
function initUI() {
  document.title = BANK_CONFIG.title;
  document.getElementById('bank-title').textContent    = BANK_CONFIG.title;
  document.getElementById('bank-subtitle').textContent = BANK_CONFIG.description;
  document.getElementById('topbar-title').textContent  = BANK_CONFIG.title;
  if (BANK_CONFIG.icon) {
    document.getElementById('start-icon').textContent = BANK_CONFIG.icon;
  }

  const bankSize = QUESTION_BANK.length;
  const capCount = document.getElementById('q-count-input');
  capCount.max = bankSize;

  // Default count
  const defaultCount = Math.min(20, bankSize);
  adjustCount(0); // Initialize with default value

  updateStartScreenStats();

  // Theme
  const savedTheme = localStorage.getItem('quiz-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon();

  // Mark UI as fully initialised — count-change handlers may now clear saved progress
  uiReady = true;
}

/* ─── START QUIZ ─────────────────────────────────────────────── */
function startQuiz() {
  const mode = document.querySelector('input[name="quiz-mode"]:checked').value;
  const order = document.querySelector('input[name="quiz-order"]:checked').value;
  const timeMins = parseInt(document.getElementById('time-input').value) || 30;
  const count = selectedCount;

  // Clear any existing saved progress before starting a new session
  clearProgress();

  // Select questions from bank — sequential picks next N in bank order, random shuffles
  SESSION_QUESTIONS = selectSessionQuestions(count, order);

  state.current   = 0;
  state.answers   = {};
  state.flagged   = {};
  state.elapsed   = 0;
  state.submitted = false;
  state.mode      = mode;
  state.timerSecs = timeMins * 60;

  // Set CSS variable for portrait nav grid
  document.documentElement.style.setProperty('--q-count', SESSION_QUESTIONS.length);

  showScreen('quiz-screen');

  if (mode === 'learning') {
    document.getElementById('timer-display').classList.add('hidden');
    document.getElementById('legend-text-answered').textContent = 'Correct';
    document.getElementById('legend-wrong').style.display = 'flex';
  } else {
    document.getElementById('timer-display').classList.remove('hidden');
    document.getElementById('legend-text-answered').textContent = 'Answered';
    document.getElementById('legend-wrong').style.display = 'none';
  }

  buildNavGrid();
  renderQuestion(0);
  if (mode !== 'learning') startTimer();
}

/* ─── SCREEN MANAGER ─────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'start-screen') updateStartScreenStats();
}

/* ─── TIMER ──────────────────────────────────────────────────── */
function startTimer() {
  if (state.timerID) clearInterval(state.timerID);
  timerPaused = false;
  lastTime = Date.now();
  state.timerID = setInterval(() => {
    if (!timerPaused && state.timerSecs > 0) {
      const now = Date.now();
      const delta = Math.floor((now - lastTime) / 1000);
      if (delta >= 1) {
        state.elapsed   += delta;
        state.timerSecs -= delta;
        lastTime = now;
        updateTimerDisplay();
        if (state.timerSecs <= 0) {
          stopTimer();
          showToast("⏰ Time's up! Submitting…");
          setTimeout(confirmSubmit, 1500);
        }
      }
    }
  }, 100);
}

function stopTimer() {
  if (state.timerID) { clearInterval(state.timerID); state.timerID = null; }
  timerPaused = true;
}

function updateTimerDisplay() {
  const secs = Math.max(0, state.timerSecs || 0);
  const m = Math.floor(secs / 60), s = secs % 60;
  document.getElementById('timer-text').textContent =
    String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  const el = document.getElementById('timer-display');
  if (secs < 120) el.classList.add('warn'); else el.classList.remove('warn');
}

/* ─── RENDER QUESTION ────────────────────────────────────────── */
function renderQuestion(idx) {
  state.current = idx;
  const q        = SESSION_QUESTIONS[idx];
  const isLast   = idx === SESSION_QUESTIONS.length - 1;
  const sel      = state.answers[idx];
  const isLearning  = state.mode === 'learning';
  const isAnswered  = sel !== undefined;

  const done = Object.keys(state.answers).length;
  document.getElementById('progress-fill').style.width =
    (done / SESSION_QUESTIONS.length * 100) + '%';

  const area = document.getElementById('question-area');
  area.innerHTML = `
    <div class="q-header">
      <span class="q-number-badge">Q ${idx+1} / ${SESSION_QUESTIONS.length}</span>
      <div class="q-text">${q.question}</div>
      <div class="q-actions">
        <button class="flag-btn ${state.flagged[idx]?'active':''}" onclick="toggleFlag(${idx})" id="flag-btn-${idx}">
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill="${state.flagged[idx]?'currentColor':'none'}"
               stroke="currentColor" stroke-width="2.2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          ${state.flagged[idx] ? 'Flagged' : 'Flag'}
        </button>
      </div>
    </div>

    <div class="options-list">
      ${q.options.map((opt, i) => {
        let extra = '', keyStyle = '';
        if (isLearning && isAnswered) {
          if (i === q.correct) {
            extra = 'border-color: var(--correct) !important; background: var(--correct-bg) !important; pointer-events: none;';
            keyStyle = 'background: var(--correct) !important; color: white !important; border-color: var(--correct) !important;';
          } else if (sel === i) {
            extra = 'border-color: var(--wrong) !important; background: var(--wrong-bg) !important; pointer-events: none;';
            keyStyle = 'background: var(--wrong) !important; color: white !important; border-color: var(--wrong) !important;';
          } else {
            extra = 'pointer-events: none;';
          }
        }
        return `
          <input type="radio" name="q_opt" id="opt_${i}" value="${i}"
                 ${sel===i?'checked':''} ${isLearning && isAnswered ? 'disabled' : ''}
                 onchange="selectAnswer(${idx},${i})">
          <label class="option-label" for="opt_${i}" style="${extra}">
            <span class="option-key" style="${keyStyle}">${KEYS[i]}</span>
            <span class="option-text">${opt}</span>
          </label>`;
      }).join('')}
    </div>

    ${(isLearning && isAnswered) ? `
      <div class="explanation-box" style="margin-top: 1rem;">
        <strong>${sel === q.correct ? '✅ Correct!' : '❌ Incorrect'}</strong>
        ${q.explanation}
      </div>` : ''}

    <div class="q-nav-btns">
      ${idx > 0         ? `<button class="btn-nav" onclick="goTo(${idx-1})">← Previous</button>` : ''}
      ${!isLast         ? `<button class="btn-nav primary" onclick="nextQuestion()">Next →</button>` : ''}
      ${isLast          ? `<button class="btn-nav submit-btn" onclick="attemptSubmit()">✓ Submit</button>` : ''}
    </div>`;

  updateNavGrid();
  updateNavStats();
  area.scrollTop = 0;
}

/* ─── ANSWER SELECTION ───────────────────────────────────────── */
function selectAnswer(qIdx, optIdx) {
  if (state.mode === 'learning' && state.answers[qIdx] !== undefined) return;
  state.answers[qIdx] = optIdx;
  updateNavGrid();
  updateNavStats();
  const done = Object.keys(state.answers).length;
  document.getElementById('progress-fill').style.width =
    (done / SESSION_QUESTIONS.length * 100) + '%';
  if (state.mode === 'learning') renderQuestion(qIdx);
}

/* ─── NAVIGATION ─────────────────────────────────────────────── */
function nextQuestion() {
  if (state.current < SESSION_QUESTIONS.length - 1) renderQuestion(state.current + 1);
}
function goTo(idx) { renderQuestion(idx); }

/* ─── FLAG ───────────────────────────────────────────────────── */
function toggleFlag(idx) {
  state.flagged[idx] = !state.flagged[idx];
  renderQuestion(idx);
  showToast(state.flagged[idx] ? `⚑ Question ${idx+1} flagged` : `Question ${idx+1} unflagged`);
}

/* ─── NAV GRID ───────────────────────────────────────────────── */
function buildNavGrid() {
  const grid = document.getElementById('nav-grid');
  grid.innerHTML = SESSION_QUESTIONS.map((_, i) =>
    `<button class="nav-btn" id="nav-btn-${i}" onclick="goTo(${i})">${i+1}</button>`
  ).join('');
}

function updateNavGrid() {
  SESSION_QUESTIONS.forEach((_, i) => {
    const btn = document.getElementById(`nav-btn-${i}`);
    if (!btn) return;
    btn.className = 'nav-btn';
    if (i === state.current) {
      btn.classList.add('current');
    } else if (state.answers[i] !== undefined) {
      if (state.mode === 'learning' && state.answers[i] !== SESSION_QUESTIONS[i].correct) {
        btn.classList.add('wrong');
      } else {
        btn.classList.add('answered');
      }
    }
    const existing = btn.querySelector('.flag-dot');
    if (existing) existing.remove();
    if (state.flagged[i]) {
      const dot = document.createElement('span');
      dot.className = 'flag-dot';
      btn.appendChild(dot);
      if (i !== state.current) btn.classList.add('flagged');
    }
  });
}

function updateNavStats() {
  const answered = Object.keys(state.answers).length;
  const flagged  = Object.values(state.flagged).filter(Boolean).length;
  const skipped  = SESSION_QUESTIONS.length - answered;
  document.getElementById('stat-answered').textContent  = answered;
  document.getElementById('stat-flagged-q').textContent = flagged;
  document.getElementById('stat-skipped').textContent   = skipped;
}

/* ─── SUBMIT ─────────────────────────────────────────────────── */
function attemptSubmit() {
  if (state.mode === 'learning') { confirmSubmit(); return; }
  const unanswered = SESSION_QUESTIONS.length - Object.keys(state.answers).length;
  if (unanswered > 0) {
    document.getElementById('modal-unanswered').textContent = unanswered;
    document.getElementById('submit-modal').classList.add('open');
  } else {
    confirmSubmit();
  }
}
function closeModal() { document.getElementById('submit-modal').classList.remove('open'); }
function confirmSubmit() {
  closeModal();
  stopTimer();
  state.submitted = true;
  saveTrackerData();
  
  // Clear saved progress — session is done, no restore needed
  clearProgress();
  
  buildResults();
  showScreen('result-screen');
}

/* ─── BUILD RESULTS ──────────────────────────────────────────── */
function buildResults() {
  let correct = 0, wrong = 0, skipped = 0;
  SESSION_QUESTIONS.forEach((q, i) => {
    const ans = state.answers[i];
    if (ans === undefined) skipped++;
    else if (ans === q.correct) correct++;
    else wrong++;
  });
  const total   = SESSION_QUESTIONS.length;
  const pct     = Math.round(correct / total * 100);
  const flagged = Object.values(state.flagged).filter(Boolean).length;
  const em = Math.floor(state.elapsed/60), es = state.elapsed%60;
  const timeStr = String(em).padStart(2,'0') + ':' + String(es).padStart(2,'0');

  document.getElementById('res-pct').textContent     = pct + '%';
  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-wrong').textContent   = wrong;
  document.getElementById('res-flagged').textContent = flagged;
  document.getElementById('res-skipped').textContent = skipped;
  document.getElementById('res-time').textContent    = timeStr;

  let grade = '';
  if (pct>=90) grade='🏆 Outstanding!';
  else if(pct>=75) grade='🌟 Great Work!';
  else if(pct>=60) grade='👍 Good Effort!';
  else if(pct>=40) grade='📚 Keep Studying!';
  else grade='💪 Don\'t Give Up!';
  document.getElementById('res-grade').textContent = grade;

  renderResultItems('all');
  updateExportBadges();
}

function renderResultItems(filter) {
  const list = document.getElementById('result-list');
  list.innerHTML = '';
  SESSION_QUESTIONS.forEach((q, i) => {
    const ans = state.answers[i];
    const isCorrect = ans === q.correct;
    const isSkipped = ans === undefined;
    const isFlagged = state.flagged[i];
    let statusClass = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'wrong');
    let show = filter === 'all'
      || (filter === 'correct' && isCorrect && !isSkipped)
      || (filter === 'wrong'   && !isCorrect && !isSkipped)
      || (filter === 'skipped' && isSkipped)
      || (filter === 'flagged' && isFlagged);
    if (!show) return;

    const icon = isSkipped ? '—' : (isCorrect ? '✓' : '✗');
    const userOpt = ans !== undefined ? q.options[ans] : 'Not answered';
    const corrOpt = q.options[q.correct];

    const el = document.createElement('div');
    el.className = `result-item ${statusClass}`;
    el.innerHTML = `
      <div class="result-item-header" onclick="toggleResultItem(this)">
        <div class="result-status-icon">${icon}</div>
        <div class="result-q-meta">
          <div class="result-q-num">Question ${i+1}${isFlagged?' · ⚑ Flagged':''}</div>
          <div class="result-q-text">${q.question}</div>
        </div>
        <div class="expand-arrow">▼</div>
      </div>
      <div class="result-item-body">
        ${!isSkipped ? `
          <div class="answer-row your-answer ${isCorrect?'is-correct':''}">
            <span class="ar-label">Your Answer</span>
            <span>${KEYS[ans]}. ${userOpt}</span>
          </div>` : ''}
        ${!isCorrect ? `
          <div class="answer-row correct-answer">
            <span class="ar-label">Correct Answer</span>
            <span>${KEYS[q.correct]}. ${corrOpt}</span>
          </div>` : ''}
        <div class="explanation-box">
          <strong>Explanation</strong>
          ${q.explanation}
        </div>
      </div>`;
    list.appendChild(el);
  });
  if (!list.children.length) {
    list.innerHTML = `<div style="color:var(--text-muted);font-size:0.9rem;padding:1rem 0;">No questions in this category.</div>`;
  }
}

function toggleResultItem(header) {
  header.classList.toggle('open');
  header.nextElementSibling.classList.toggle('open');
}
function filterResults(filter, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderResultItems(filter);
}

/* ─── CONFIRM RESET (mid-quiz) ───────────────────────────────── */
function confirmResetProgress() {
  if (!confirm('End this session and go back to start?')) return;
  stopTimer();
  state.submitted = false;
  
  // Clear saved progress when manually resetting
  clearProgress();
  
  showScreen('start-screen');
}

/* ─── THEME ──────────────────────────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('quiz-theme', newTheme);
  updateThemeIcon();
}
function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('.theme-toggle-btn').forEach(b => {
    b.textContent = isDark ? '☀' : '☾';
  });
}

/* ─── NAVIGATE ───────────────────────────────────────────────── */
function navigateToIndex(event) {
  event.preventDefault();
  // If we arrived from another page on this site, go back; otherwise fall
  // back to the sibling index.html (correct for any subfolder depth).
  if (document.referrer && new URL(document.referrer).origin === location.origin) {
    history.back();
  } else {
    window.location.href = 'index.html';
  }
}

/* ─── TOAST ──────────────────────────────────────────────────── */
let toastTimer;

function showToast(msg, actions = []) {
  const t = document.getElementById('toast');

  // Clear any existing content
  t.innerHTML = '';

  // Create message span
  const msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  msgSpan.style.flex = '1';
  t.appendChild(msgSpan);

  // Add action buttons if provided
  if (actions.length > 0) {
    const actionsContainer = document.createElement('div');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = '0.5rem';
    actionsContainer.style.marginLeft = '0.75rem';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = `
        padding: 0.35rem 0.75rem;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: ${action.primary ? 'var(--accent)' : 'var(--surface2)'};
        color: ${action.primary ? '#000' : 'var(--text)'};
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition);
      `;
      btn.onclick = () => {
        action.onClick();
        t.classList.remove('show');
      };
      btn.onmouseenter = () => {
        if (!action.primary) {
          btn.style.borderColor = 'var(--accent)';
          btn.style.color = 'var(--accent)';
        }
      };
      btn.onmouseleave = () => {
        if (!action.primary) {
          btn.style.borderColor = 'var(--border)';
          btn.style.color = 'var(--text)';
        }
      };
      actionsContainer.appendChild(btn);
    });

    t.appendChild(actionsContainer);
  }

  t.classList.add('show');
  clearTimeout(toastTimer);

  // Auto-hide only if no actions (for simple toasts)
  if (actions.length === 0) {
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
}

// Auto-save every 5 seconds
setInterval(saveProgress, 5000);

// Save progress before page unload (tab close, refresh, navigation)
window.addEventListener('beforeunload', function() {
  if (!state.submitted) {
    saveProgress();
  }
});

/* ─── VISIBILITY CHANGE ──────────────────────────────────────── */
window.addEventListener('visibilitychange', () => {
  if (document.hidden && !state.submitted && state.mode !== 'learning') {
    stopTimer();
  } else if (!document.hidden && !state.submitted && state.mode !== 'learning' && state.timerID === null) {
    lastTime = Date.now();
    timerPaused = false;
  }
});


/* ── PDF EXPORT ─────────────────────────────────────────────── */
function onExportFilterChange(checkbox) {
  const allCb     = document.querySelector('input[name="export-all"]');
  const wrongCb   = document.querySelector('input[name="export-wrong"]');
  const flaggedCb = document.querySelector('input[name="export-flagged"]');
  if (checkbox.name === 'export-all' && checkbox.checked) {
    wrongCb.checked = false; flaggedCb.checked = false;
  } else if (checkbox.name !== 'export-all' && checkbox.checked) {
    allCb.checked = false;
  }
  if (!allCb.checked && !wrongCb.checked && !flaggedCb.checked) allCb.checked = true;
}

function updateExportBadges() {
  const qs = (typeof SESSION_QUESTIONS !== 'undefined' && SESSION_QUESTIONS && SESSION_QUESTIONS.length)
    ? SESSION_QUESTIONS : QUESTIONS;
  let allC = 0, wrongC = 0, flaggedC = 0;
  qs.forEach((q, i) => {
    const ans = state.answers[i];
    allC++;
    if (ans !== undefined && ans !== q.correct) wrongC++;
    if (state.flagged[i]) flaggedC++;
  });
  document.getElementById('badge-all').textContent     = allC;
  document.getElementById('badge-wrong').textContent   = wrongC;
  document.getElementById('badge-flagged').textContent = flaggedC;
}

function exportToPDF() {
  const allCb     = document.querySelector('input[name="export-all"]');
  const wrongCb   = document.querySelector('input[name="export-wrong"]');
  const flaggedCb = document.querySelector('input[name="export-flagged"]');

  let filter = 'all';
  if (!allCb.checked) {
    if (wrongCb.checked && !flaggedCb.checked)      filter = 'wrong';
    else if (flaggedCb.checked && !wrongCb.checked) filter = 'flagged';
    else if (wrongCb.checked && flaggedCb.checked)  filter = 'wrong+flagged';
  }

  showToast('Generating PDF...');

  const qs      = (typeof SESSION_QUESTIONS !== 'undefined' && SESSION_QUESTIONS && SESSION_QUESTIONS.length)
    ? SESSION_QUESTIONS : QUESTIONS;
  const title   = document.title || 'Quiz Results';
  const pct     = document.getElementById('res-pct').textContent;
  const grade   = document.getElementById('res-grade').textContent;
  const correct = document.getElementById('res-correct').textContent;
  const wrongN  = document.getElementById('res-wrong').textContent;
  const skipped = document.getElementById('res-skipped').textContent;
  const timeEl  = document.getElementById('res-time');
  const timeUsed = timeEl ? timeEl.textContent : '--';

  const filterLabels = {
    'all':          'All Questions',
    'wrong':        'Wrong Answers',
    'flagged':      'Flagged Questions',
    'wrong+flagged':'Wrong + Flagged'
  };

  const toExport = [];
  qs.forEach((q, i) => {
    const ans       = state.answers[i];
    const isCorrect = ans === q.correct;
    const isSkipped = ans === undefined;
    const isFlagged = !!state.flagged[i];
    const show = filter === 'all'
      || (filter === 'wrong'         && !isCorrect && !isSkipped)
      || (filter === 'flagged'       && isFlagged)
      || (filter === 'wrong+flagged' && ((!isCorrect && !isSkipped) || isFlagged));
    if (show) toExport.push({ q, i, ans, isCorrect, isSkipped, isFlagged });
  });

  let html = '<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;color:#1c1917;">'
    + '<h1 style="font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">' + title + '</h1>'
    + '<p style="color:#78716c;margin:0 0 16px;font-size:13px;">Quiz Results &mdash; ' + new Date().toLocaleDateString() + '</p>'
    + '<div style="background:#f8f6f1;border-radius:12px;padding:18px 20px;margin-bottom:22px;border:1px solid #d0ccc5;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">'
    +   '<div style="width:84px;height:84px;border-radius:50%;border:4px solid #c27803;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;background:rgba(194,120,3,.10);">'
    +     '<div style="font-size:20px;font-weight:700;color:#c27803;line-height:1;">' + pct + '</div>'
    +     '<div style="font-size:9px;color:#78716c;text-transform:uppercase;letter-spacing:.04em;">Score</div>'
    +   '</div>'
    +   '<div style="flex:1;min-width:180px;">'
    +     '<h2 style="font-family:Georgia,serif;font-size:17px;margin:0 0 10px;">' + grade + '</h2>'
    +     '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#16a34a;">' + correct + '</div><div style="font-size:10px;color:#78716c;">Correct</div></div>'
    +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#dc2626;">' + wrongN  + '</div><div style="font-size:10px;color:#78716c;">Wrong</div></div>'
    +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#78716c;">' + skipped + '</div><div style="font-size:10px;color:#78716c;">Skipped</div></div>'
    +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;">' + timeUsed + '</div><div style="font-size:10px;color:#78716c;">Time</div></div>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:0 0 12px;">'
    +   (filterLabels[filter] || 'Questions') + ' (' + toExport.length + ')'
    + '</h3>';

  toExport.forEach(function(item) {
    var q = item.q, i = item.i, ans = item.ans;
    var isCorrect = item.isCorrect, isSkipped = item.isSkipped, isFlagged = item.isFlagged;
    var sc   = isSkipped ? '#78716c' : (isCorrect ? '#16a34a' : '#dc2626');
    var icon = isSkipped ? '-' : (isCorrect ? 'OK' : 'X');
    var bgH  = isSkipped ? '#f8f6f1' : (isCorrect ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.06)');
    var uAns = ans !== undefined ? (KEYS[ans] + '. ' + q.options[ans]) : 'Not answered';
    var cAns = KEYS[q.correct] + '. ' + q.options[q.correct];
    html += '<div style="border:1.5px solid ' + sc + ';border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">'
      +   '<div style="padding:12px 15px;background:' + bgH + ';">'
      +     '<div style="display:flex;gap:10px;align-items:flex-start;">'
      +       '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + sc + ';">' + icon + '</div>'
      +       '<div>'
      +         '<div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Q' + (i+1) + (isFlagged ? ' &bull; Flagged' : '') + '</div>'
      +         '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + q.question + '</div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div style="padding:10px 15px 12px;border-top:1px solid #e5e0db;">';
    if (!isSkipped) {
      html += '<div style="background:' + (isCorrect ? 'rgba(22,163,74,.08)' : 'rgba(220,38,38,.08)') + ';border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Your Answer</span>' + uAns + '</div>';
    }
    if (!isCorrect) {
      html += '<div style="background:rgba(22,163,74,.08);border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Correct Answer</span>' + cAns + '</div>';
    }
    if (q.explanation) {
      html += '<div style="background:#f8f6f1;border-left:3px solid #c27803;border-radius:0 6px 6px 0;padding:9px 11px;font-size:12px;color:#44403c;line-height:1.6;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1c1917;margin-bottom:3px;">Explanation</div>' + q.explanation + '</div>';
    }
    html += '</div></div>';
  });
  html += '</div>';

  var filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_results.pdf';
  var opt = {
    margin:      [10, 10, 10, 10],
    filename:    filename,
    image:       { type: 'jpeg', quality: 0.97 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  var container = document.createElement('div');
  container.innerHTML = html;

  function runExport() {
    if (typeof html2pdf === 'undefined') {
      showToast('PDF library still loading, try again in a moment');
      return;
    }
    try {
      html2pdf().set(opt).from(container).save()
        .catch(function(err) { 
          console.error('PDF export error:', err);
           
        });
    } catch (err) {
      console.error('PDF export error:', err);
      
    }
  }

  if (typeof html2pdf !== 'undefined') {
    runExport();
  } else {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload  = runExport;
    s.onerror = function() { showToast('Failed to load PDF library'); };
    document.head.appendChild(s);
  }
}

/* ─── BOOT ───────────────────────────────────────────────────── */
initUI();
checkSavedProgress();

/* ================================================================
   TRACKER PANEL
   ================================================================ */
/* ════════════════════════════════════════════════════════════════
   QUESTION TRACKER DASHBOARD  v2
   ─────────────────────────────────────────────────────────────
   • Folder-aware: groups data by URL path segments
   • No hardcoded values: auto-detects config & question sources
   • Dynamic scopes: this-quiz / this-folder / all
   • PDF export for tracked questions
   • Fully expandable — drop into any quiz page
   ════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── Storage keys ── */
  const TRACKER_VERSION = 'v2';
  const STORAGE_PREFIX = 'quiz_tracker_';
  const KEYS_LIST_KEY  = 'quiz_tracker_keys';

  /* ── Auto-detect config & questions source ── */
  function getConfig() {
    return (typeof QUIZ_CONFIG !== 'undefined' && QUIZ_CONFIG)
      || (typeof BANK_CONFIG !== 'undefined' && BANK_CONFIG)
      || { uid: location.pathname, title: document.title };
  }
  function getQuestions() {
    return (typeof SESSION_QUESTIONS !== 'undefined' && SESSION_QUESTIONS && SESSION_QUESTIONS.length)
      ? SESSION_QUESTIONS
      : (typeof QUESTIONS !== 'undefined' ? QUESTIONS : []);
  }

  /* ── Path-based group resolution ── */
  function getFolderSegments(path) {
    // e.g. "/MU61S8/gyn/dep/l1-anatomy.html" → ["MU61S8", "MU61S8/gyn", "MU61S8/gyn/dep"]
    var parts = path.replace(/\/[^/]*$/, '').split('/').filter(Boolean);
    var segments = [];
    for (var i = 0; i < parts.length; i++) {
      segments.push(parts.slice(0, i + 1).join('/'));
    }
    return segments;
  }

  function getStorageKey(uid) {
    return STORAGE_PREFIX + TRACKER_VERSION + '_' + uid;
  }

  /* ── Get path stored with a tracker entry ── */
  function getPathForUid(uid) {
    var raw = localStorage.getItem(getStorageKey(uid));
    if (raw) try { return JSON.parse(raw).path || ''; } catch(e) {}
    return '';
  }

  /* ══════════════════════════════════════════
     SAVE — called after quiz submission
     ══════════════════════════════════════════ */
  window.saveTrackerData = function() {
    try {
      var cfg = getConfig();
      var qs  = getQuestions();
      if (!qs.length) return;

      var wrongQs = [], flaggedQs = [];
      qs.forEach(function(q, i) {
        var ans = state.answers[i];
        var isWrong   = ans !== undefined && ans !== q.correct;
        var isFlagged = state.flagged && state.flagged[i];

        var qData = {
          idx: i,
          text: q.question,
          yourAnswer:   ans !== undefined ? KEYS[ans] + '. ' + q.options[ans] : 'Not answered',
          correctAnswer: KEYS[q.correct] + '. ' + q.options[q.correct],
          explanation: q.explanation || ''
        };
        if (isWrong)   wrongQs.push(qData);
        if (isFlagged) flaggedQs.push(qData);
      });

      if (!wrongQs.length && !flaggedQs.length) return;

      var data = {
        uid:         cfg.uid || location.pathname,
        title:       cfg.title || document.title,
        timestamp:   Date.now(),
        totalQs:     qs.length,
        wrongCount:  wrongQs.length,
        flaggedCount: flaggedQs.length,
        wrong:       wrongQs,
        flagged:     flaggedQs,
        path:        location.pathname
      };

      localStorage.setItem(getStorageKey(data.uid), JSON.stringify(data));

      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      if (keys.indexOf(data.uid) === -1) { keys.push(data.uid); }
      localStorage.setItem(KEYS_LIST_KEY, JSON.stringify(keys));

      updateDashboardBadge();
    } catch (e) { console.error('Tracker save error:', e); }
  };

  /* ══════════════════════════════════════════
     READ — fetch tracker entries
     ══════════════════════════════════════════ */
  function getAllTrackerData() {
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      var results = [];
      keys.forEach(function(uid) {
        var raw = localStorage.getItem(getStorageKey(uid));
        if (raw) try { results.push(JSON.parse(raw)); } catch(e) {}
      });
      return results;
    } catch(e) { return []; }
  }

  function getTrackerDataForScope(scope, scopePath) {
    var all = getAllTrackerData();
    var cfg = getConfig();

    if (scope === 'quiz') {
      return all.filter(function(d) { return d.uid === cfg.uid; });
    }

    if (scope === 'folder' && scopePath) {
      return all.filter(function(d) {
        var _n = function(p) { return p.replace(/^\//, ''); };
        return d.path && _n(d.path).indexOf(_n(scopePath)) === 0;
      });
    }

    return all; // scope === 'all'
  }

  /* ══════════════════════════════════════════
     BADGE — count on the dashboard button
     ══════════════════════════════════════════ */
  window.updateDashboardBadge = function() {
    var data = getAllTrackerData();
    var total = 0;
    data.forEach(function(d) { total += (d.wrong || []).length + (d.flagged || []).length; });
    var badge = document.getElementById('tracker-badge-count');
    if (badge) badge.textContent = total > 0 ? total : '';
  };

  /* ══════════════════════════════════════════
     CURRENT SCOPE STATE
     ══════════════════════════════════════════ */
  var currentScope = 'quiz';
  var currentScopePath = '';

  /* ══════════════════════════════════════════
     OPEN DASHBOARD
     ══════════════════════════════════════════ */
  window.openTrackerDashboard = function(requestedScope) {
    var cfg = getConfig();
    var segments = getFolderSegments(location.pathname);

    // Build scope tabs
    var scopeBar = document.getElementById('dash-scope-bar');
    var tabs = [];

    // Tab: This Quiz
    tabs.push({ id: 'quiz', label: 'This Quiz' });

    // Tab: nearest meaningful folder (skip the root project dir if only 1 segment)
    if (segments.length >= 2) {
      var folderName = decodeURIComponent(segments[segments.length - 1]);
      tabs.push({ id: 'folder', label: folderName, path: segments[segments.length - 1] });
    }

    // Tab: All
    tabs.push({ id: 'all', label: 'All' });

    var scopeHTML = '';
    tabs.forEach(function(t) {
      scopeHTML += '<button class="dash-scope-tab' + (t.id === 'quiz' ? ' active' : '')
        + '" data-scope="' + t.id + '" data-path="' + (t.path || '') + '"'
        + ' onclick="switchDashScope(\'' + t.id + '\',\'' + (t.path || '') + '\')">'
        + t.label + '</button>';
    });
    scopeBar.innerHTML = scopeHTML;

    // Set initial scope
    currentScope = 'quiz';
    currentScopePath = '';
    if (requestedScope && requestedScope !== 'quiz') {
      currentScope = requestedScope;
    }

    renderDashboard();
    document.getElementById('tracker-dashboard').classList.add('open');
  };

  window.switchDashScope = function(scope, path) {
    currentScope = scope;
    currentScopePath = path;

    // Update tab active state
    var tabs = document.querySelectorAll('.dash-scope-tab');
    tabs.forEach(function(tab) {
      tab.classList.toggle('active', tab.getAttribute('data-scope') === scope);
    });

    renderDashboard();
  };

  /* ══════════════════════════════════════════
     RENDER DASHBOARD CONTENT
     ══════════════════════════════════════════ */
  function renderDashboard() {
    var data = getTrackerDataForScope(currentScope, currentScopePath);
    var totalWrong = 0, totalFlagged = 0;

    data.forEach(function(d) {
      totalWrong   += (d.wrong || []).length;
      totalFlagged += (d.flagged || []).length;
    });

    document.getElementById('dash-total-wrong').textContent   = totalWrong;
    document.getElementById('dash-total-flagged').textContent = totalFlagged;
    document.getElementById('dash-total-quizzes').textContent = data.length;

    var body = document.getElementById('dash-body');

    if (!data.length) {
      body.innerHTML = '<div class="dash-empty"><div class="dash-empty-icon">📋</div>'
        + '<p>No tracked questions yet.<br>Complete a quiz to start tracking wrong and flagged questions.</p></div>';
      return;
    }

    // Sort most recent first
    data.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    var html = '';
    data.forEach(function(d) {
      var wrongItems   = d.wrong || [];
      var flaggedItems = d.flagged || [];
      var wrongIdxs    = {};
      wrongItems.forEach(function(q) { wrongIdxs[q.idx] = true; });
      var uniqueFlagged = flaggedItems.filter(function(q) { return !wrongIdxs[q.idx]; });
      if (!wrongItems.length && !uniqueFlagged.length) return;

      var dateStr = d.timestamp
        ? new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

      html += '<div class="dash-quiz-group">';
      html += '<div class="dash-quiz-title">' + (d.title || 'Unknown Quiz');
      if (wrongItems.length)   html += ' <span class="quiz-badge wrong-badge">' + wrongItems.length + ' wrong</span>';
      if (flaggedItems.length) html += ' <span class="quiz-badge flag-badge">' + flaggedItems.length + ' flagged</span>';
      if (dateStr)             html += ' <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400;margin-left:auto;">' + dateStr + '</span>';
      html += '</div>';

      wrongItems.forEach(function(q) {
        var isAlsoFlagged = flaggedItems.some(function(f) { return f.idx === q.idx; });
        html += buildDashQItem(d.uid, q, isAlsoFlagged ? 'Wrong + Flagged' : 'Wrong', 'wrong', '✗');
      });

      uniqueFlagged.forEach(function(q) {
        html += buildDashQItem(d.uid, q, 'Flagged', 'flagged', '⚑');
      });

      html += '</div>';
    });

    body.innerHTML = html || '<div class="dash-empty"><div class="dash-empty-icon">✅</div><p>No wrong or flagged questions tracked. Great job!</p></div>';
  }

  function buildDashQItem(uid, q, typeLabel, iconClass, iconText) {
    var esc = (q.text || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<div class="dash-q-item">'
      + '<div class="dash-q-icon ' + iconClass + '">' + iconText + '</div>'
      + '<div class="dash-q-content">'
      +   '<div class="dash-q-num">Q' + ((q.idx || 0) + 1) + ' · ' + typeLabel + '</div>'
      +   '<div class="dash-q-text">' + esc + '</div>'
      + '</div>'
      + '<button class="dash-q-remove" onclick="removeTrackerItem(\'' + uid + '\',' + (q.idx || 0) + ')" title="Remove">✕</button>'
      + '</div>';
  }

  /* ══════════════════════════════════════════
     CLOSE DASHBOARD
     ══════════════════════════════════════════ */
  window.closeTrackerDashboard = function() {
    document.getElementById('tracker-dashboard').classList.remove('open');
  };

  /* ══════════════════════════════════════════
     REMOVE / CLEAR
     ══════════════════════════════════════════ */
  window.removeTrackerItem = function(uid, qIdx) {
    try {
      var raw = localStorage.getItem(getStorageKey(uid));
      if (!raw) return;
      var data = JSON.parse(raw);
      data.wrong   = (data.wrong   || []).filter(function(q) { return q.idx !== qIdx; });
      data.flagged = (data.flagged || []).filter(function(q) { return q.idx !== qIdx; });
      data.wrongCount   = data.wrong.length;
      data.flaggedCount = data.flagged.length;

      if (!data.wrong.length && !data.flagged.length) {
        localStorage.removeItem(getStorageKey(uid));
        var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
        localStorage.setItem(KEYS_LIST_KEY, JSON.stringify(keys.filter(function(k) { return k !== uid; })));
      } else {
        localStorage.setItem(getStorageKey(uid), JSON.stringify(data));
      }
      renderDashboard();
      updateDashboardBadge();
    } catch(e) { console.error('Remove tracker item error:', e); }
  };

  window.clearAllTrackerData = function() {
    if (!confirm('Clear all tracked questions? This cannot be undone.')) return;
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      keys.forEach(function(uid) { localStorage.removeItem(getStorageKey(uid)); });
      localStorage.removeItem(KEYS_LIST_KEY);
      renderDashboard();
      updateDashboardBadge();
    } catch(e) { console.error('Clear tracker error:', e); }
  };

  /* ══════════════════════════════════════════
     PDF EXPORT
     ══════════════════════════════════════════ */
  window.exportTrackerToPDF = function() {
    var data = getTrackerDataForScope(currentScope, currentScopePath);
    if (!data.length) { showToast('No tracked questions to export.'); return; }

    var totalWrong = 0, totalFlagged = 0;
    data.forEach(function(d) { totalWrong += (d.wrong || []).length; totalFlagged += (d.flagged || []).length; });

    var scopeLabel = currentScope === 'quiz' ? 'This Quiz' : (currentScope === 'folder' ? currentScopePath : 'All Quizzes');
    var now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var html = '<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;color:#1c1917;">'
      + '<h1 style="font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">📊 Question Tracker</h1>'
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

    data.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    data.forEach(function(d) {
      var wrongItems   = d.wrong || [];
      var flaggedItems = d.flagged || [];
      var wrongIdxs    = {};
      wrongItems.forEach(function(q) { wrongIdxs[q.idx] = true; });
      var uniqueFlagged = flaggedItems.filter(function(q) { return !wrongIdxs[q.idx]; });

      if (!wrongItems.length && !uniqueFlagged.length) return;

      html += '<h3 style="font-size:14px;margin:18px 0 8px;font-family:Georgia,serif;">' + (d.title || 'Quiz') + '</h3>';

      var allItems = [];
      wrongItems.forEach(function(q) {
        var alsoFlagged = flaggedItems.some(function(f) { return f.idx === q.idx; });
        allItems.push({ q: q, type: alsoFlagged ? 'Wrong + Flagged' : 'Wrong', color: '#dc2626', bg: 'rgba(220,38,38,.06)' });
      });
      uniqueFlagged.forEach(function(q) {
        allItems.push({ q: q, type: 'Flagged', color: '#2563eb', bg: 'rgba(37,99,235,.06)' });
      });

      allItems.forEach(function(item) {
        var q = item.q;
        html += '<div style="border:1.5px solid ' + item.color + ';border-radius:10px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid;">'
          +   '<div style="padding:12px 15px;background:' + item.bg + ';">'
          +     '<div style="display:flex;gap:10px;align-items:flex-start;">'
          +       '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + item.color + ';">' + (item.type === 'Flagged' ? '⚑' : '✗') + '</div>'
          +       '<div>'
          +         '<div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Q' + ((q.idx || 0) + 1) + ' · ' + item.type + '</div>'
          +         '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + q.text + '</div>'
          +       '</div>'
          +     '</div>'
          +   '</div>'
          +   '<div style="padding:10px 15px 12px;border-top:1px solid #e5e0db;">'
          +     '<div style="background:rgba(220,38,38,.08);border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Your Answer</span>' + q.yourAnswer + '</div>'
          +     '<div style="background:rgba(22,163,74,.08);border-radius:6px;padding:7px 11px;margin-bottom:7px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Correct Answer</span>' + q.correctAnswer + '</div>';
        if (q.explanation) {
          html += '<div style="background:#f8f6f1;border-left:3px solid #c27803;border-radius:0 6px 6px 0;padding:9px 11px;font-size:12px;color:#44403c;line-height:1.6;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1c1917;margin-bottom:3px;">Explanation</div>' + q.explanation + '</div>';
        }
        html += '</div></div>';
      });
    });

    html += '</div>';

    var filename = 'question_tracker_' + scopeLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    var opt = {
      margin: [10,10,10,10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    var container = document.createElement('div');
    container.innerHTML = html;

    function runExport() {
      html2pdf().set(opt).from(container).save()
        .catch(function() {});
    }

    if (typeof html2pdf !== 'undefined') {
      runExport();
    } else {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload  = runExport;
      s.onerror = function() { showToast('Failed to load PDF library'); };
      document.head.appendChild(s);
    }
  };

  /* ── Init badge on load ── */
  updateDashboardBadge();

  /* ═══════════════════════════════════════════════════════════
     KEYBOARD SHORTCUTS & HELP CARD
     ═══════════════════════════════════════════════════════════ */
  
  /* Inject CSS for keyboard help card */
  var _kbStyle = document.createElement('style');
  _kbStyle.textContent = `
/* Keyboard Shortcuts Help Card */
.kb-help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(3px);
  z-index: 2000;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.2s ease-out;
}
.kb-help-overlay.open {
  display: flex;
  opacity: 1;
}
.kb-help-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.5rem 1.75rem;
  max-width: 440px;
  width: 100%;
  box-shadow: 0 6px 32px rgba(0,0,0,0.4);
  position: relative;
}
.kb-help-card h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.2rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.kb-help-card .kb-close-btn {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
  font-size: 0.85rem;
}
.kb-help-card .kb-close-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.kb-shortcut-list {
  display: grid;
  gap: 0.5rem;
}
.kb-shortcut-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0;
}
.kb-shortcut-item:not(:last-child) {
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}
.kb-keys {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  min-width: 90px;
}
.kb-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 0.35rem;
  border-radius: 4px;
  background: var(--surface2);
  border: 1px solid var(--border);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text);
  font-family: 'Outfit', sans-serif;
}
.kb-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  flex: 1;
}
.kb-hint {
  margin-top: 0.85rem;
  padding: 0.5rem 0.75rem;
  background: var(--accent-dim);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}
.kb-hint strong { color: var(--accent); }
`;
  document.head.appendChild(_kbStyle);

  /* Build help card HTML */
  var _kbHelpHTML = '';
  _kbHelpHTML += '<div class="kb-help-overlay" id="kb-help-overlay" onclick="if(event.target===this)closeKbHelp()">';
  _kbHelpHTML += '  <div class="kb-help-card">';
  _kbHelpHTML += '    <button class="kb-close-btn" onclick="closeKbHelp()">✕</button>';
  _kbHelpHTML += '    <h3>⌨️ Keyboard Shortcuts</h3>';
  _kbHelpHTML += '    <div class="kb-shortcut-list">';
  
  // Bank screen shortcuts
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">↑</span><span class="kb-key">↓</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Navigate topics/options</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">Enter</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Select topic / Start quiz</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">A</span><span class="kb-key">B</span><span class="kb-key">C</span><span class="kb-key">D</span><span class="kb-key">E</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Select answer</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">←</span><span class="kb-key">→</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Previous / Next question</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">F</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Toggle flag</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">1</span><span class="kb-key">2</span><span class="kb-key">3</span>...</div>';
  _kbHelpHTML += '        <div class="kb-desc">Jump to question</div>';
  _kbHelpHTML += '      </div>';
  
  _kbHelpHTML += '    </div>';
  _kbHelpHTML += '    <div class="kb-hint">Press <strong>/</strong> to show/hide this help</div>';
  _kbHelpHTML += '  </div>';
  _kbHelpHTML += '</div>';

  /* Append to body */
  var _kbDiv = document.createElement('div');
  _kbDiv.innerHTML = _kbHelpHTML;
  document.body.appendChild(_kbDiv);

  /* Keyboard help open/close functions */
  window.openKbHelp = function() {
    var overlay = document.getElementById('kb-help-overlay');
    if (overlay) {
      overlay.classList.add('open');
    }
  };
  window.closeKbHelp = function() {
    var overlay = document.getElementById('kb-help-overlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
  };

  /* Keyboard event listener */
  document.addEventListener('keydown', function(e) {
    // Don't capture if user is typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    var overlay = document.getElementById('kb-help-overlay');
    var isOpen = overlay && overlay.classList.contains('open');

    // Close help with Escape
    if (e.key === 'Escape' && isOpen) {
      closeKbHelp();
      return;
    }

    // Toggle help with /
    if (e.key === '/') {
      e.preventDefault();
      if (isOpen) {
        closeKbHelp();
      } else {
        openKbHelp();
      }
      return;
    }

    // Don't process shortcuts if help is open
    if (isOpen) return;

    // Don't process shortcuts if restore toast is showing
    var restoreToast = document.getElementById('toast');
    if (restoreToast && restoreToast.classList.contains('show')) {
      // Check if it has action buttons (restore/dismiss)
      if (restoreToast.querySelector('button')) return;
    }

    // Only process if quiz screen is active
    var quizScreen = document.getElementById('quiz-screen');
    if (!quizScreen || !quizScreen.classList.contains('active')) return;

    // Navigation: Arrow keys
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (typeof state !== 'undefined' && state.current > 0) renderQuestion(state.current - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (typeof state !== 'undefined' && state.current < SESSION_QUESTIONS.length - 1) renderQuestion(state.current + 1);
    }

    // Answer selection: A, B, C, D, E
    var answerKeys = ['a', 'b', 'c', 'd', 'e'];
    if (answerKeys.includes(e.key.toLowerCase())) {
      e.preventDefault();
      var keyIndex = answerKeys.indexOf(e.key.toLowerCase());
      if (typeof state !== 'undefined' && keyIndex < SESSION_QUESTIONS[state.current].options.length) {
        state.answers[state.current] = keyIndex;
        var radio = document.getElementById('opt-' + state.current + '-' + keyIndex);
        if (radio) {
          radio.checked = true;
          // In learning mode, show feedback immediately
          if (state.mode === 'learning') {
            var isCorrect = keyIndex === SESSION_QUESTIONS[state.current].correct;
            showToast(isCorrect ? '✓ Correct!' : '✗ Incorrect');
          }
        }
        updateNavGrid();
        updateNavStats();
      }
    }

    // Flag: F
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (typeof state !== 'undefined') toggleFlag(state.current);
    }

    // Submit: Enter (only on quiz screen, not start screen)
    if (e.key === 'Enter' && !e.shiftKey) {
      var startScreen = document.getElementById('start-screen');
      if (startScreen && startScreen.classList.contains('active')) {
        // On start screen, trigger start
        e.preventDefault();
        var startBtn = document.querySelector('.btn-start');
        if (startBtn) startBtn.click();
      } else if (typeof state !== 'undefined' && state.submitted !== true) {
        e.preventDefault();
        attemptSubmit();
      }
    }

    // Jump to question: Number keys (1-9)
    if (e.key >= '1' && e.key <= '9') {
      var qNum = parseInt(e.key) - 1;
      if (typeof state !== 'undefined' && qNum < SESSION_QUESTIONS.length) {
        e.preventDefault();
        renderQuestion(qNum);
      }
    }
  });

  /* ── Animation Helpers ─────────────────────────────────────── */
  (function () {
    'use strict';

    /* 1. Ripple effect for primary buttons */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-start, .btn-nav.primary, .btn-restart');
      if (!btn) return;
      var wave = document.createElement('span');
      wave.className = 'ripple-wave';
      var r = btn.getBoundingClientRect();
      wave.style.left = (e.clientX - r.left) + 'px';
      wave.style.top  = (e.clientY - r.top)  + 'px';
      btn.appendChild(wave);
      wave.addEventListener('animationend', function () { wave.remove(); });
    });

    /* 2. Theme toggle spin */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.theme-toggle-btn, #theme-toggle');
      if (!btn) return;
      btn.classList.remove('theme-spinning');
      void btn.offsetWidth; /* reflow to restart */
      btn.classList.add('theme-spinning');
      btn.addEventListener('animationend', function () {
        btn.classList.remove('theme-spinning');
      }, { once: true });
    });

    /* 3. Smooth screen transitions */
    var _origShowScreen = window.showScreen;
    if (_origShowScreen) {
      window.showScreen = function (id) {
        var current = document.querySelector('.screen.active');
        if (current) {
          current.style.opacity = '0';
          setTimeout(function () {
            current.classList.remove('active');
            _origShowScreen(id);
          }, 150);
        } else {
          _origShowScreen(id);
        }
      };
    }
  })();

})();

window.__HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
