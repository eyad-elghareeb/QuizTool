/* ================================================================
   quiz-engine.js  —  Shared quiz engine for all quiz files.
   Load this after defining QUIZ_CONFIG and QUESTIONS globals.
   Auto-detects its own base URL so it works at any folder depth.
   ================================================================ */
(function () {
  'use strict';

  /* ── Compute base path from our own script URL ──────────────── */
  var _cs  = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : (window.__QUIZ_ENGINE_BASE || '');

  /* ── Inject <head> assets ────────────────────────────────────── */
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

  /* ── Inject CSS ──────────────────────────────────────────────── */
  
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
  --transition: 0.2s ease;
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

/* ═══════════════════════════════════════════
   RESET & BASE
═══════════════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: 'Outfit', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  transition: background var(--transition), color var(--transition);
  overflow: hidden;
}
button { cursor: pointer; font-family: inherit; border: none; outline: none; }
input[type=radio] { display: none; }

/* ═══════════════════════════════════════════
   SCREENS
═══════════════════════════════════════════ */
.screen { display: none; width: 100%; height: 100%; position: relative; }
.screen.active { display: flex; }

/* ═══════════════════════════════════════════
   START SCREEN
═══════════════════════════════════════════ */
#start-screen {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 2rem;
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

.start-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem 2rem 1.75rem;
  max-width: 520px;
  width: 100%;
  box-shadow: var(--shadow);
  text-align: center;
  position: relative;
}
.start-icon {
  width: 72px; height: 72px;
  background: var(--accent-dim);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1.5rem;
  font-size: 2rem;
}
.start-card h1 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  color: var(--text);
  margin-bottom: 0.5rem;
  line-height: 1.2;
}
.start-card .subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 2rem;
}
.meta-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.meta-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  text-align: center;
}
.meta-item .val {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  display: block;
}
.meta-item .lbl {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.btn-start {
  width: 100%;
  padding: 0.95rem 2rem;
  border-radius: var(--radius);
  background: var(--accent);
  color: #000;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.02em;
  transition: opacity var(--transition), transform var(--transition);
}
.btn-start:hover { opacity: 0.88; transform: translateY(-1px); }
.btn-start:active { transform: translateY(0); }

/* Time selector (exam mode) */
.section-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6rem;
  text-align: left;
}
.time-section { margin-bottom: 1.25rem; text-align: left; }
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
  cursor: pointer;
  font-family: inherit;
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
  text-align: left;
}

/* Mode options - ensure equal height on mobile */
.mode-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}

@media (max-width: 480px) {
  .mode-option {
    min-height: 90px;
  }
  .start-card {
    padding: 2rem 1.5rem;
  }
}

/* ═══════════════════════════════════════════
   QUIZ SCREEN LAYOUT
═══════════════════════════════════════════ */
#quiz-screen {
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* TOP BAR */
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
.timer-wrap svg { flex-shrink: 0; }
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
.icon-btn:hover { color: var(--text); border-color: var(--accent); }
.icon-btn.danger:hover { border-color: var(--wrong); color: var(--wrong); }

/* MAIN BODY */
.quiz-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* QUESTION AREA */
.question-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.question-area::-webkit-scrollbar { width: 6px; }
.question-area::-webkit-scrollbar-track { background: transparent; }
.question-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

.q-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
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
.flag-btn:hover, .flag-btn.active {
  background: var(--flagged-bg);
  border-color: var(--flagged);
  color: var(--flagged);
}
.flag-btn svg { transition: transform 0.2s; }
.flag-btn.active svg { transform: scale(1.1); }

.q-text {
  font-size: clamp(1rem, 2.5vw, 1.2rem);
  font-weight: 500;
  color: var(--text);
  line-height: 1.7;
  flex: 1;
}

/* OPTIONS */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
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
input[type=radio]:checked + .option-label {
  border-color: var(--accent);
  background: var(--accent-dim);
}
.option-key {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: var(--surface2);
  border: 1.5px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  transition: all var(--transition);
  z-index: 1;
  text-transform: uppercase;
}
input[type=radio]:checked + .option-label .option-key {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
}
.option-text { font-size: 0.95rem; line-height: 1.5; z-index: 1; padding-top: 0.05rem; }

/* NAVIGATION BUTTONS */
.q-nav-btns {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
  flex-wrap: wrap;
}
.btn-nav {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all var(--transition);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.btn-nav:hover { border-color: var(--accent); color: var(--accent); }
.btn-nav.primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  margin-left: auto;
}
.btn-nav.primary:hover { opacity: 0.85; }
.btn-nav.submit-btn {
  background: var(--correct);
  border-color: var(--correct);
  color: #fff;
  margin-left: auto;
}
.btn-nav.submit-btn:hover { opacity: 0.85; }

/* ═══════════════════════════════════════════
   NAVIGATION PANE
═══════════════════════════════════════════ */
.nav-pane {
  width: var(--nav-size);
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}
.nav-pane-header {
  padding: 1rem 1.1rem 0.75rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.nav-pane-header h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.65rem;
  font-weight: 600;
}
.legend {
  display: flex; flex-wrap: wrap; gap: 0.4rem 0.75rem;
}
.legend-item {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.72rem; color: var(--text-muted);
}
.dot {
  width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
}
.dot.answered  { background: var(--correct); }
.dot.wrong     { background: var(--wrong); }
.dot.flagged   { background: var(--flagged); }
.dot.current   { background: var(--accent); }
.dot.unanswered{ background: var(--surface2); border: 1.5px solid var(--border); }

.nav-grid-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 0.85rem;
}
.nav-grid-wrap::-webkit-scrollbar { width: 4px; }
.nav-grid-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
  gap: 6px;
}
.nav-btn {
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition);
  position: relative;
}
.nav-btn:hover { border-color: var(--accent); color: var(--accent); }
.nav-btn.answered { background: var(--correct-bg); border-color: var(--correct); color: var(--correct); }
.nav-btn.wrong    { background: var(--wrong-bg); border-color: var(--wrong); color: var(--wrong); }
.nav-btn.flagged  { background: var(--flagged-bg); border-color: var(--flagged); color: var(--flagged); }
.nav-btn.current  { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 2px var(--accent-dim); }
.nav-btn .flag-dot {
  position: absolute; top: 2px; right: 2px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--flagged);
}

/* Nav pane bottom stats */
.nav-stats {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
  flex-shrink: 0;
}
.stat-item { text-align: center; }
.stat-item .sv { font-size: 1rem; font-weight: 700; }
.stat-item .sl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.sv.green { color: var(--correct); }
.sv.blue  { color: var(--flagged); }
.sv.muted { color: var(--text-muted); }

/* ═══════════════════════════════════════════
   PORTRAIT / BOTTOM NAV PANE
═══════════════════════════════════════════ */
@media (orientation: portrait) {
  .quiz-body { flex-direction: column; }
  .nav-pane {
    width: 100%;
    height: auto;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 200px;
  }
  .nav-pane-header {
    padding: 0.6rem 1rem 0.5rem;
  }
  .nav-grid-wrap {
    padding: 0.5rem 0.85rem;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .nav-grid {
    grid-template-columns: repeat(var(--q-count, 20), 38px);
    grid-template-rows: 38px;
    grid-auto-flow: column;
    gap: 5px;
  }
  .nav-btn { width: 38px; height: 38px; aspect-ratio: unset; }
  .nav-stats { padding: 0.5rem 1rem; }
  .stat-item .sv { font-size: 0.9rem; }
}

/* Progress bar */
.progress-bar-wrap { height: 3px; background: var(--surface2); position: relative; flex-shrink: 0; }
.progress-bar-fill { height: 100%; background: var(--accent); transition: width 0.4s ease; border-radius: 0 2px 2px 0; }

/* ═══════════════════════════════════════════
   RESULTS SCREEN
═══════════════════════════════════════════ */
#result-screen {
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.result-topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.result-topbar h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.1rem;
}
.result-topbar .topbar-actions { margin-left: auto; }

.result-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}
.result-body::-webkit-scrollbar { width: 6px; }
.result-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* Score banner */
.score-banner {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.75rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
  box-shadow: var(--shadow);
}
.score-circle {
  width: 110px; height: 110px;
  border-radius: 50%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  border: 4px solid var(--accent);
  flex-shrink: 0;
  position: relative;
  background: var(--accent-dim);
}
.score-circle .pct { font-size: 1.8rem; font-weight: 700; color: var(--accent); line-height: 1; }
.score-circle .lbl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.score-details { flex: 1; min-width: 180px; }
.score-details h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem;
  margin-bottom: 0.75rem;
}
.score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.65rem;
}
.score-stat {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
}
.score-stat .n { font-size: 1.2rem; font-weight: 700; }
.score-stat .t { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; }
.n.green { color: var(--correct); }
.n.red   { color: var(--wrong); }
.n.blue  { color: var(--flagged); }

/* Result filter tabs */
.result-tabs {
  display: flex; gap: 0.5rem; flex-wrap: wrap;
}
.tab-btn {
  padding: 0.45rem 1rem;
  border-radius: 8px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all var(--transition);
}
.tab-btn:hover { border-color: var(--accent); color: var(--accent); }
.tab-btn.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

/* Result items */
.result-list { display: flex; flex-direction: column; gap: 1rem; }
.result-item {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color var(--transition);
}
.result-item.correct { border-color: var(--correct); }
.result-item.wrong   { border-color: var(--wrong); }
.result-item.skipped { border-color: var(--skip); }

.result-item-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
}
.result-status-icon {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 0.9rem; font-weight: 700;
  margin-top: 0.15rem;
}
.result-item.correct .result-status-icon { background: var(--correct-bg); color: var(--correct); }
.result-item.wrong   .result-status-icon { background: var(--wrong-bg);   color: var(--wrong); }
.result-item.skipped .result-status-icon { background: var(--surface2);   color: var(--skip); }

.result-q-meta { flex: 1; }
.result-q-num  { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; font-weight: 600; }
.result-q-text { font-size: 0.95rem; font-weight: 500; line-height: 1.5; }
.expand-arrow { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.2rem; transition: transform 0.2s; }
.result-item-header.open .expand-arrow { transform: rotate(180deg); }

.result-item-body {
  display: none;
  padding: 0 1.25rem 1.1rem;
  border-top: 1px solid var(--border);
}
.result-item-body.open { display: block; }

.answer-row {
  display: flex; align-items: flex-start; gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  margin-top: 0.5rem;
  font-size: 0.88rem;
}
.answer-row.your-answer { background: var(--wrong-bg); }
.answer-row.correct-answer { background: var(--correct-bg); }
.answer-row.your-answer.is-correct { background: var(--correct-bg); }
.answer-row .ar-label {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em;
  font-weight: 700; white-space: nowrap; margin-top: 0.1rem; opacity: 0.7;
}
.explanation-box {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--surface2);
  border-left: 3px solid var(--accent);
  border-radius: 0 8px 8px 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-muted);
}
.explanation-box strong { color: var(--text); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 0.25rem; }

/* Result Actions (Bottom buttons) */
.result-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.btn-restart {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.85rem 1.75rem;
  border-radius: var(--radius);
  background: var(--accent);
  color: #000;
  font-weight: 700;
  font-size: 0.95rem;
  border: 1.5px solid var(--accent);
  transition: all var(--transition);
  text-decoration: none;
}
.btn-restart:hover { opacity: 0.85; transform: translateY(-1px); }

.btn-secondary {
  background: var(--surface2);
  color: var(--text);
  border-color: var(--border);
}
.btn-secondary:hover {
  border-color: var(--accent);
  color: var(--accent);
  opacity: 1;
}

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
`;
  document.head.appendChild(_style);

  /* ── Build DOM ───────────────────────────────────────────────── */
  try {
    document.body.innerHTML = `
<!-- ═══════════════════════════ START ═══════════════════════════ -->
<div id="start-screen" class="screen active">
  <a href="#" class="hub-back-btn" onclick="navigateToIndex(event); return false;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
    Back to Hub
  </a>

  <div class="start-card">
    <button class="icon-btn" onclick="openTrackerDashboard()" style="position:absolute;top:10px;right:10px" title="Question Tracker">
      <span>📊</span><span id="tracker-badge-count" style="position:absolute;top:-3px;right:-3px;min-width:15px;height:15px;border-radius:8px;background:var(--text-muted);color:var(--surface);font-size:0.55rem;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 3px;line-height:1;opacity:0.75">0</span>
    </button>

    <div class="start-icon">📝</div>
    <h1 id="quiz-title">Quiz Title</h1>
    <p class="subtitle" id="quiz-desc">Answer all questions before the timer runs out.</p>
    <div class="meta-grid">
      <div class="meta-item">
        <span class="val" id="meta-questions">—</span>
        <span class="lbl">Questions</span>
      </div>
    </div>
    
    <!-- Time Limit (exam mode only) -->
    <div class="time-section" id="time-section">
      <div class="section-label">Time Limit <span style="color:var(--text-muted);font-size:0.75rem;font-weight:400;margin-left:0.35rem">(min)</span></div>
      <div class="time-controls">
        <button class="time-adj-btn" onclick="adjustTime(-5)">−5</button>
        <input type="number" id="time-input" class="time-input" min="1" max="300" value="30">
        <button class="time-adj-btn" onclick="adjustTime(5)">+5</button>
      </div>
    </div>

    <!-- Mode Selection -->
    <div style="margin-bottom: 1.25rem;">

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <label style="cursor: pointer;">
          <input type="radio" name="quiz-mode" value="exam" checked style="display: none;">
          <div style="padding: 0.85rem; border-radius: var(--radius); border: 1.5px solid var(--border); background: var(--surface2); transition: all var(--transition); text-align: center;" class="mode-option mode-selected">
            <div style="font-weight: 600; font-size: 0.95rem;">📝 Exam Mode</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Timer + blind answers</div>
          </div>
        </label>
        <label style="cursor: pointer;">
          <input type="radio" name="quiz-mode" value="learning" style="display: none;">
          <div style="padding: 0.85rem; border-radius: var(--radius); border: 1.5px solid var(--border); background: var(--surface2); transition: all var(--transition); text-align: center;" class="mode-option">
            <div style="font-weight: 600; font-size: 0.95rem;">📚 Learning Mode</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Instant feedback</div>
          </div>
        </label>
      </div>
    </div>
    
    <button class="btn-start" onclick="startQuiz()">Start Quiz →</button>
  </div>
</div>

<!-- ═══════════════════════════ QUIZ ════════════════════════════ -->
<div id="quiz-screen" class="screen">
  <!-- Top bar -->
  <div class="topbar">
    <div class="topbar-title" id="topbar-title">Quiz</div>
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

  <!-- Progress -->
  <div class="progress-bar-wrap">
    <div class="progress-bar-fill" id="progress-fill" style="width:0%"></div>
  </div>

  <div class="quiz-body">
    <!-- Question area -->
    <div class="question-area" id="question-area">
      <!-- Dynamically filled -->
    </div>

    <!-- Navigation pane -->
    <div class="nav-pane" id="nav-pane">
      <div class="nav-pane-header">
        <h3>Navigation</h3>
        <div class="legend">
          <div class="legend-item"><div class="dot current"></div> Current</div>
          <div class="legend-item"><div class="dot answered"></div> <span id="legend-text-answered">Answered</span></div>
          <div class="legend-item" id="legend-wrong" style="display: none;"><div class="dot wrong"></div> Wrong</div>
          <div class="legend-item"><div class="dot flagged"></div> Flagged</div>
          <div class="legend-item"><div class="dot unanswered"></div> Skipped</div>
        </div>
      </div>
      <div class="nav-grid-wrap">
        <div class="nav-grid" id="nav-grid"></div>
      </div>
      <div class="nav-stats">
        <div class="stat-item"><div class="sv green" id="stat-answered">0</div><div class="sl">Done</div></div>
        <div class="stat-item"><div class="sv blue"  id="stat-flagged">0</div><div class="sl">Flagged</div></div>
        <div class="stat-item"><div class="sv muted" id="stat-skipped">0</div><div class="sl">Skipped</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════ RESULTS ═════════════════════════ -->
<div id="result-screen" class="screen">
  <div class="result-topbar">
    <h2>📊 Quiz Results</h2>
    <div class="topbar-actions">
      <a href="#" class="icon-btn" title="Back to Hub" onclick="navigateToIndex(event); return false;">🏠</a>
      <button class="icon-btn theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">☀</button>
      <button class="icon-btn danger" onclick="confirmResetProgress()" title="Reset Progress">↻</button>
    </div>
  </div>
  <div class="result-body">
    <!-- Score banner -->
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

    <!-- Tabs -->
    <div class="result-tabs">
      <button class="tab-btn active" onclick="filterResults('all', this)">All Questions</button>
      <button class="tab-btn" onclick="filterResults('correct', this)">✓ Correct</button>
      <button class="tab-btn" onclick="filterResults('wrong', this)">✗ Wrong</button>
      <button class="tab-btn" onclick="filterResults('skipped', this)">— Skipped</button>
      <button class="tab-btn" onclick="filterResults('flagged', this)">⚑ Flagged</button>
    </div>

    <!-- Result items -->
    <div class="result-list" id="result-list"></div>

    <div class="result-actions">
      <button class="btn-restart" onclick="restartQuiz()">↺ Retake Quiz</button>
      <a href="#" class="btn-restart btn-secondary" onclick="navigateToIndex(event); return false;">🏠 Return to Hub</a>
    </div>
  </div>
</div>

<!-- ═══════════════ CONFIRM MODAL ════════════════ -->
<div class="modal-overlay" id="submit-modal">
  <div class="modal">
    <h3>Submit Quiz?</h3>
    <p>You have <span class="modal-unanswered" id="modal-unanswered">—</span> unanswered question(s). Are you sure you want to submit?</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Go Back</button>
      <button class="btn-confirm" onclick="confirmSubmit()">Submit Now</button>
    </div>
  </div>
</div>

<!-- ═══════════════ TOAST ════════════════ -->
<div class="toast" id="toast"></div>

<!-- ════════════════════════════════════════════════════════════════
     ▼ DROP IN YOUR QUESTIONS HERE ▼
═══════════════════════════════════════════════════════════════════ -->`;
  } catch(e) {
    console.error('[QuizEngine] Error building DOM:', e);
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;font-family:sans-serif;"><h1>❌ DOM Build Error</h1><p>' + e.message + '</p></div>';
  }

  /* ── Register Service Worker ─────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(ENGINE_BASE + 'sw.js').catch(function () {});
    });
  }

})();

/* ================================================================
   ENGINE — functions exposed globally so onclick="" attrs work.
   ================================================================ */
/* ════════════════════════════════════════════════════════════════
   QUIZ ENGINE
════════════════════════════════════════════════════════════════ */
const KEYS =['A','B','C','D','E','F','G','H'];
let state = {
  current:   0,
  answers:   {},   // { qIndex: optionIndex }
  flagged:   {},   // { qIndex: true }
  timerSecs: 0,
  elapsed:   0,
  timerID:   null,
  submitted: false,
  mode:      'exam', // 'exam' or 'learning'
};
let timerPaused = false;
let lastTime = Date.now();

/* ── MODE SELECTION HANDLERS ───────────────────────────────── */
document.querySelectorAll('input[name="quiz-mode"]').forEach(input => {
  input.addEventListener('change', function() {
    document.querySelectorAll('input[name="quiz-mode"]').forEach(r => {
      const opt = r.closest('label').querySelector('.mode-option');
      opt.classList.remove('mode-selected');
      opt.style.borderColor = 'var(--border)';
      opt.style.background = 'var(--surface2)';
    });
    const selected = this.closest('label').querySelector('.mode-option');
    selected.classList.add('mode-selected');
    selected.style.borderColor = 'var(--accent)';
    selected.style.background = 'var(--accent-dim)';
    // Show/hide time selector
    document.getElementById('time-section').style.display = this.value === 'exam' ? '' : 'none';
  });
});

// Init first selected state
(function() {
  const checked = document.querySelector('input[name="quiz-mode"]:checked');
  if (checked) {
    const opt = checked.closest('label').querySelector('.mode-option');
    opt.classList.add('mode-selected');
    opt.style.borderColor = 'var(--accent)';
    opt.style.background = 'var(--accent-dim)';
  }
})();

/* ── INIT ─────────────────────────────────────────────────── */
function initUI() {
  document.title = QUIZ_CONFIG.title;
  document.getElementById('quiz-title').textContent  = QUIZ_CONFIG.title;
  document.getElementById('quiz-desc').textContent   = QUIZ_CONFIG.description;
  document.getElementById('meta-questions').textContent = QUESTIONS.length;
  document.getElementById('topbar-title').textContent = QUIZ_CONFIG.title;

  // Set default time: ~1.5 min per question, min 5
  const defaultMins = Math.max(5, Math.ceil(QUESTIONS.length * 1.5));
  document.getElementById('time-input').value = defaultMins;

  // set CSS var for portrait nav scroll
  document.documentElement.style.setProperty('--q-count', QUESTIONS.length);

  // Check saved theme preference
  const savedTheme = localStorage.getItem('quiz-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // Theme icon
  updateThemeIcon();
}

/* ── TIME CONTROLS ─────────────────────────────────────────── */
function adjustTime(delta) {
  const inp = document.getElementById('time-input');
  const cur = parseInt(inp.value) || 10;
  inp.value = Math.max(1, Math.min(300, cur + delta));
}

/* ── START ────────────────────────────────────────────────── */
function startQuiz() {
  // Clear any existing progress when starting a new quiz
  clearProgress();

  const timeMins = parseInt(document.getElementById('time-input').value) || 30;

  state.current  = 0;
  state.answers  = {};
  state.flagged  = {};
  state.elapsed  = 0;
  state.submitted= false;
  state.timerSecs= timeMins * 60;
  state.mode     = document.querySelector('input[name="quiz-mode"]:checked').value;

  showScreen('quiz-screen');

  if(state.mode === 'learning') {
    // Hide timer in learning mode
    document.getElementById('timer-display').classList.add('hidden');
    const legendAns = document.getElementById('legend-text-answered');
    if(legendAns) legendAns.textContent = 'Correct';
    const legendWr = document.getElementById('legend-wrong');
    if(legendWr) legendWr.style.display = 'flex';
  } else {
    document.getElementById('timer-display').classList.remove('hidden');
    const legendAns = document.getElementById('legend-text-answered');
    if(legendAns) legendAns.textContent = 'Answered';
    const legendWr = document.getElementById('legend-wrong');
    if(legendWr) legendWr.style.display = 'none';
  }

  buildNavGrid();
  renderQuestion(0);

  if(state.mode !== 'learning') {
    startTimer();
  }
}

/* ── SCREENS ──────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ── TIMER ────────────────────────────────────────────────── */
function startTimer() {
  if(state.timerID) clearInterval(state.timerID);
  timerPaused = false;
  lastTime = Date.now();
  state.timerID = setInterval(() => {
    if (!timerPaused && state.timerSecs > 0) {
      const now = Date.now();
      const delta = Math.floor((now - lastTime) / 1000);
      if (delta >= 1) {
        state.elapsed += delta;
        state.timerSecs -= delta;
        lastTime = now;
        updateTimerDisplay();
        if(state.timerSecs <= 0) {
          stopTimer();
          showToast("⏰ Time's up! Submitting…");
          setTimeout(confirmSubmit, 1500);
        }
      }
    }
  }, 100);
}

function stopTimer() {
  if(state.timerID) {
    clearInterval(state.timerID);
    state.timerID = null;
  }
  timerPaused = true;
}

function updateTimerDisplay() {
  const secs = Math.max(0, state.timerSecs || 0);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  document.getElementById('timer-text').textContent =
    String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  const el = document.getElementById('timer-display');
  if(secs < 120) el.classList.add('warn'); else el.classList.remove('warn');
}

/* ── RENDER QUESTION ─────────────────────────────────────── */
function renderQuestion(idx) {
  state.current = idx;
  const q   = QUESTIONS[idx];
  const isLast = idx === QUESTIONS.length - 1;
  const sel = state.answers[idx];

  // In learning mode, check if answered
  const isLearning = state.mode === 'learning';
  const isAnswered = sel !== undefined;

  // progress
  const done = Object.keys(state.answers).length;
  document.getElementById('progress-fill').style.width = (done / QUESTIONS.length * 100) + '%';

  const area = document.getElementById('question-area');
  area.innerHTML = `
    <div class="q-header">
      <span class="q-number-badge">Q ${idx+1} / ${QUESTIONS.length}</span>
      <div class="q-text">${q.question}</div>
      <div class="q-actions">
        <button class="flag-btn ${state.flagged[idx]?'active':''}" onclick="toggleFlag(${idx})" id="flag-btn-${idx}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="${state.flagged[idx]?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          ${state.flagged[idx] ? 'Flagged' : 'Flag'}
        </button>
      </div>
    </div>

    <div class="options-list" id="options-list">
      ${q.options.map((opt, i) => {
        let extraStyle = '';
        let keyStyle = '';
        if (isLearning && isAnswered) {
          if (i === q.correct) {
            extraStyle = 'border-color: var(--correct) !important; background: var(--correct-bg) !important; pointer-events: none;';
            keyStyle = 'background: var(--correct) !important; color: white !important; border-color: var(--correct) !important;';
          } else if (sel === i) {
            extraStyle = 'border-color: var(--wrong) !important; background: var(--wrong-bg) !important; pointer-events: none;';
            keyStyle = 'background: var(--wrong) !important; color: white !important; border-color: var(--wrong) !important;';
          } else {
            extraStyle = 'pointer-events: none;';
          }
        }
        return `
        <input type="radio" name="q_opt" id="opt_${i}" value="${i}" ${sel===i?'checked':''} ${isLearning && isAnswered ? 'disabled' : ''} onchange="selectAnswer(${idx},${i})">
        <label class="option-label" for="opt_${i}" style="${extraStyle}">
          <span class="option-key" style="${keyStyle}">${KEYS[i]}</span>
          <span class="option-text">${opt}</span>
        </label>
        `;
      }).join('')}
    </div>

    ${(isLearning && isAnswered) ? `
      <div class="explanation-box" style="margin-top: 1rem;">
        <strong>${sel === q.correct ? '✅ Correct!' : '❌ Incorrect'}</strong>
        ${q.explanation}
      </div>
    ` : ''}

    <div class="q-nav-btns">
      ${idx > 0 ? `<button class="btn-nav" onclick="goTo(${idx-1})">← Previous</button>` : ''}
      ${!isLast ? `<button class="btn-nav primary" onclick="nextQuestion()">Next →</button>` : ''}
      ${isLast  ? `<button class="btn-nav submit-btn" onclick="attemptSubmit()">✓ Submit Quiz</button>` : ''}
    </div>
  `;

  updateNavGrid();
  updateNavStats();
  area.scrollTop = 0;
}

/* ── ANSWER SELECTION ────────────────────────────────────── */
function selectAnswer(qIdx, optIdx) {
  if (state.mode === 'learning' && state.answers[qIdx] !== undefined) return;

  state.answers[qIdx] = optIdx;
  updateNavGrid();
  updateNavStats();
  // update progress
  const done = Object.keys(state.answers).length;
  document.getElementById('progress-fill').style.width = (done / QUESTIONS.length * 100) + '%';

  // In learning mode: re-render to show explanation and highlights
  if(state.mode === 'learning') {
    renderQuestion(qIdx);
  }
}
/* ── NAVIGATION ──────────────────────────────────────────── */
function nextQuestion() {
  if(state.current < QUESTIONS.length - 1) renderQuestion(state.current + 1);
}
function goTo(idx) {
  renderQuestion(idx);
}

/* ── FLAG ────────────────────────────────────────────────── */
function toggleFlag(idx) {
  state.flagged[idx] = !state.flagged[idx];
  const btn = document.getElementById(`flag-btn-${idx}`);
  if(btn) {
    btn.classList.toggle('active', state.flagged[idx]);
    const svgEl = btn.querySelector('svg');
    if(svgEl) svgEl.setAttribute('fill', state.flagged[idx] ? 'currentColor' : 'none');
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="${state.flagged[idx]?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
      ${state.flagged[idx] ? 'Flagged' : 'Flag'}
    `;
    btn.classList.toggle('active', state.flagged[idx]);
  }
  updateNavGrid();
  updateNavStats();
  showToast(state.flagged[idx] ? `⚑ Question ${idx+1} flagged` : `Question ${idx+1} unflagged`);
}

/* ── NAV GRID ────────────────────────────────────────────── */
function buildNavGrid() {
  const grid = document.getElementById('nav-grid');
  grid.innerHTML = QUESTIONS.map((_, i) => `
    <button class="nav-btn" id="nav-btn-${i}" onclick="goTo(${i})">${i+1}</button>
  `).join('');
}

function updateNavGrid() {
  QUESTIONS.forEach((_, i) => {
    const btn = document.getElementById(`nav-btn-${i}`);
    if(!btn) return;
    btn.className = 'nav-btn';

    if(i === state.current) {
      btn.classList.add('current');
    } else if(state.answers[i] !== undefined) {
      if (state.mode === 'learning' && state.answers[i] !== QUESTIONS[i].correct) {
        btn.classList.add('wrong');
      } else {
        btn.classList.add('answered');
      }
    }

    // Add flag dot
    const existing = btn.querySelector('.flag-dot');
    if(existing) existing.remove();
    if(state.flagged[i]) {
      const dot = document.createElement('span');
      dot.className = 'flag-dot';
      btn.appendChild(dot);
      if(i !== state.current) btn.classList.add('flagged');
    }
  });
}

function updateNavStats() {
  const answered = Object.keys(state.answers).length;
  const flagged  = Object.values(state.flagged).filter(Boolean).length;
  const skipped  = QUESTIONS.length - answered;
  document.getElementById('stat-answered').textContent = answered;
  document.getElementById('stat-flagged').textContent  = flagged;
  document.getElementById('stat-skipped').textContent  = skipped;
}

/* ── SUBMIT ──────────────────────────────────────────────── */
function attemptSubmit() {
  // Skip confirm modal in learning mode
  if(state.mode === 'learning') {
    confirmSubmit();
    return;
  }

  const unanswered = QUESTIONS.length - Object.keys(state.answers).length;
  if(unanswered > 0) {
    document.getElementById('modal-unanswered').textContent = unanswered;
    document.getElementById('submit-modal').classList.add('open');
  } else {
    confirmSubmit();
  }
}
function closeModal() {
  document.getElementById('submit-modal').classList.remove('open');
}
function confirmSubmit() {
  closeModal();
  stopTimer();
  state.submitted = true;
  saveTrackerData();
  clearProgress(); // Clear saved progress after successful submission
  buildResults();
  showScreen('result-screen');
}

/* ── BUILD RESULTS ───────────────────────────────────────── */
function buildResults() {
  let correct = 0, wrong = 0, skipped = 0;
  QUESTIONS.forEach((q, i) => {
    const ans = state.answers[i];
    if(ans === undefined) skipped++;
    else if(ans === q.correct) correct++;
    else wrong++;
  });
  const total   = QUESTIONS.length;
  if (!total) { showToast('No questions loaded.'); return; }
  const pct     = Math.round(correct / total * 100);
  const flagged = Object.values(state.flagged).filter(Boolean).length;

  // elapsed time
  const em = Math.floor(state.elapsed/60), es = state.elapsed%60;
  const timeStr = String(em).padStart(2,'0') + ':' + String(es).padStart(2,'0');

  document.getElementById('res-pct').textContent    = pct + '%';
  document.getElementById('res-correct').textContent= correct;
  document.getElementById('res-wrong').textContent  = wrong;
  document.getElementById('res-flagged').textContent= flagged;
  document.getElementById('res-skipped').textContent= skipped;
  document.getElementById('res-time').textContent   = timeStr;

  let grade = '';
  if(pct>=90) grade = '🏆 Outstanding!';
  else if(pct>=75) grade = '🌟 Great Work!';
  else if(pct>=60) grade = '👍 Good Effort!';
  else if(pct>=40) grade = '📚 Keep Studying!';
  else grade = '💪 Don\'t Give Up!';
  document.getElementById('res-grade').textContent = grade;

  renderResultItems('all');
  updateExportBadges();
}

function renderResultItems(filter) {
  const list = document.getElementById('result-list');
  list.innerHTML = '';
  QUESTIONS.forEach((q, i) => {
    const ans = state.answers[i];
    const isCorrect = ans === q.correct;
    const isSkipped = ans === undefined;
    const isFlagged = state.flagged[i];

    let statusClass = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'wrong');
    let showItem = filter === 'all'
      || (filter === 'correct'  && isCorrect && !isSkipped)
      || (filter === 'wrong'    && !isCorrect && !isSkipped)
      || (filter === 'skipped'  && isSkipped)
      || (filter === 'flagged'  && isFlagged);

    if(!showItem) return;

    const statusIcon = isSkipped ? '—' : (isCorrect ? '✓' : '✗');
    const userOptText = ans !== undefined ? q.options[ans] : 'Not answered';
    const correctOptText = q.options[q.correct];

    const el = document.createElement('div');
    el.className = `result-item ${statusClass}`;
    el.dataset.idx = i;

    el.innerHTML = `
      <div class="result-item-header" onclick="toggleResultItem(this)">
        <div class="result-status-icon">${statusIcon}</div>
        <div class="result-q-meta">
          <div class="result-q-num">Question ${i+1}${isFlagged ? ' · ⚑ Flagged' : ''}</div>
          <div class="result-q-text">${q.question}</div>
        </div>
        <div class="expand-arrow">▼</div>
      </div>
      <div class="result-item-body">
        ${!isSkipped ? `
          <div class="answer-row your-answer ${isCorrect?'is-correct':''}">
            <span class="ar-label">Your Answer</span>
            <span>${KEYS[ans]}. ${userOptText}</span>
          </div>
        ` : ''}
        ${!isCorrect ? `
          <div class="answer-row correct-answer">
            <span class="ar-label">Correct Answer</span>
            <span>${KEYS[q.correct]}. ${correctOptText}</span>
          </div>
        ` : ''}
        <div class="explanation-box">
          <strong>Explanation</strong>
          ${q.explanation}
        </div>
      </div>
    `;
    list.appendChild(el);
  });

  if(list.children.length === 0) {
    list.innerHTML = `<div style="color:var(--text-muted);font-size:0.9rem;padding:1rem 0;">No questions in this category.</div>`;
  }
}

function toggleResultItem(header) {
  header.classList.toggle('open');
  const body = header.nextElementSibling;
  body.classList.toggle('open');
}

function filterResults(filter, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderResultItems(filter);
}

/* ── RESTART ─────────────────────────────────────────────── */
function restartQuiz() {
  clearProgress();
  showScreen('start-screen');
}

/* ── THEME ───────────────────────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);

  // Save preference to localStorage so it persists when returning to index.html
  localStorage.setItem('quiz-theme', newTheme);

  updateThemeIcon();
}

/* ── NAVIGATE BACK TO HUB ──────────────────────────────────── */
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
function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  // Note: Added .theme-toggle-btn specifically so we don't accidentally overwrite the Home 🏠 button!
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.textContent = isDark ? '☀' : '☾';
  });
}

/* ── TOAST ───────────────────────────────────────────────── */
let toastTimer;
let pendingRestoreData = null; // Store pending restore data for optional restore

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
  // If there are actions, don't auto-hide - let user dismiss manually
}

/* ── LOCAL STORAGE SAVE/RESTORE ──────────────────────────── */
// Improved storage key generation that handles special characters safely
const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `quiz_progress_${STORAGE_VERSION}_${(QUIZ_CONFIG.uid || window.location.pathname).replace(/[^a-zA-Z0-9]/g, '_')}`;

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
    quizTitle: QUIZ_CONFIG.title,
    totalQuestions: QUESTIONS.length,
    current: state.current,
    answers: state.answers,
    flagged: state.flagged,
    elapsed: state.elapsed,
    timerSecs: state.timerSecs,
    mode: state.mode,
    timestamp: Date.now(),
    savedAt: Date.now() // Separate field for time calculation
  };

  try {
    // Validate data before saving
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
  if (typeof data.current !== 'number' || data.current < 0 || data.current >= data.totalQuestions) return false;
  if (!data.answers || typeof data.answers !== 'object') return false;
  if (!data.flagged || typeof data.flagged !== 'object') return false;
  if (typeof data.timerSecs !== 'number' || data.timerSecs < 0) return false;
  if (!['exam', 'learning'].includes(data.mode)) return false;
  // savedAt is optional now since we don't use it for time calculation
  return true;
}

/**
 * Clear old saves from other quizzes to free up space
 */
function clearOldSaves() {
  try {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('quiz_progress_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (now - data.timestamp > maxAge) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid JSON, remove it
          localStorage.removeItem(key);
        }
      }
    });
  } catch (e) {
    console.error('Error clearing old saves:', e);
  }
}

/** @deprecated Use checkSavedProgress() — kept only so old bookmarks don't crash. */
function restoreProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;

  try {
    const data = JSON.parse(saved);

    // Check if data is from a compatible version
    if (data.version !== STORAGE_VERSION) {
      console.log('Incompatible save version, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    // Verify this save is for the same quiz
    if (data.quizTitle !== QUIZ_CONFIG.title) {
      console.log('Save is for a different quiz, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    // Verify question count hasn't changed
    if (data.totalQuestions !== QUESTIONS.length) {
      console.log('Quiz structure has changed, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    // Only restore if less than 7 days old
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > maxAge) {
      console.log('Save is too old, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    // Do the actual restore
    doRestoreProgress(data);
    return true;
  } catch(e) {
    console.error('Error restoring progress:', e);
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Confirm and reset quiz progress
 */
function confirmResetProgress() {
  if (confirm('Are you sure you want to reset your quiz progress? This cannot be undone.')) {
    clearProgress();
    // Reset state
    state.current = 0;
    state.answers = {};
    state.flagged = {};
    state.elapsed = 0;
    state.timerSecs = (parseInt(document.getElementById('time-input').value) || 30) * 60;
    state.submitted = false;
    state.mode = 'exam';

    showToast('🔄 Progress reset! Starting fresh...');

    setTimeout(() => {
      showScreen('start-screen');
    }, 1000);
  }
}

// Stop timer when user leaves the page/tab
window.addEventListener('visibilitychange', function() {
  if (document.hidden && !state.submitted && state.mode !== 'learning') {
    stopTimer();
  } else if (!document.hidden && !state.submitted && state.mode !== 'learning' && state.timerID === null) {
    // Resume timer when user comes back (only if it was stopped due to visibility change)
    lastTime = Date.now();
    timerPaused = false;
  }
});

// Auto-save every 5 seconds
setInterval(saveProgress, 5000);

// Save progress before page unload (tab close, refresh, navigation)
window.addEventListener('beforeunload', function() {
  if (!state.submitted) {
    saveProgress();
  }
});

// Check for saved progress on init
let restoreToastTimeout = null;

function checkSavedProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);

    // Validate the saved data
    if (data.version !== STORAGE_VERSION) {
      console.log('Incompatible save version, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (data.quizTitle !== QUIZ_CONFIG.title) {
      console.log('Save is for a different quiz, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (data.totalQuestions !== QUESTIONS.length) {
      console.log('Quiz structure has changed, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > maxAge) {
      console.log('Save is too old, starting fresh');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Store pending restore data
    pendingRestoreData = data;

    // Show toast with optional restore button
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

    // Auto-dismiss after 15 seconds if user hasn't interacted
    restoreToastTimeout = setTimeout(() => {
      console.log('Auto-dismissing restore toast after 15 seconds');
      pendingRestoreData = null;
      clearProgress();
      // Hide the toast if it's still visible
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
  // Handle backward compatibility: if savedAt doesn't exist, use timestamp
  if (!data.savedAt) {
    data.savedAt = data.timestamp;
  }

  // Validate all answer indices are still valid
  for (const [qIdx, optIdx] of Object.entries(data.answers)) {
    const qIndex = parseInt(qIdx);
    if (qIndex >= 0 && qIndex < QUESTIONS.length) {
      const optCount = QUESTIONS[qIndex].options.length;
      if (optIdx < 0 || optIdx >= optCount) {
        delete data.answers[qIdx];
      }
    } else {
      delete data.answers[qIdx];
    }
  }

  // Restore state
  state.current = Math.min(data.current, QUESTIONS.length - 1);
  state.answers = data.answers;
  state.flagged = data.flagged || {};

  // Restore timer values exactly as saved (time doesn't count while page is closed)
  state.elapsed = data.elapsed || 0;
  state.timerSecs = data.timerSecs || 0;

  state.mode = data.mode;
  state.submitted = false;

  setTimeout(() => {
    if(state.mode === 'learning') {
      document.getElementById('timer-display').classList.add('hidden');
    }
    showScreen('quiz-screen');
    buildNavGrid();
    renderQuestion(state.current);
    updateTimerDisplay(); // Ensure timer display is correct on restore
    if(state.mode !== 'learning') {
      startTimer();
    }
  }, 500);
}


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
}

/* ── BOOT ────────────────────────────────────────────────── */
try {
  console.log('[QuizEngine] Initializing quiz engine...');
  console.log('[QuizEngine] QUIZ_CONFIG defined:', typeof QUIZ_CONFIG !== 'undefined');
  console.log('[QuizEngine] QUESTIONS defined:', typeof QUESTIONS !== 'undefined');
  
  if (typeof QUIZ_CONFIG === 'undefined') {
    console.error('[QuizEngine] ERROR: QUIZ_CONFIG is not defined!');
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;font-family:sans-serif;"><h1>❌ Error</h1><p>QUIZ_CONFIG is not defined. Please check your quiz file.</p></div>';
  } else if (typeof QUESTIONS === 'undefined') {
    console.error('[QuizEngine] ERROR: QUESTIONS is not defined!');
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;font-family:sans-serif;"><h1>❌ Error</h1><p>QUESTIONS is not defined. Please check your quiz file.</p></div>';
  } else {
    console.log('[QuizEngine] Quiz config loaded:', QUIZ_CONFIG.title);
    console.log('[QuizEngine] Questions count:', QUESTIONS.length);
    initUI();
    checkSavedProgress();
    console.log('[QuizEngine] UI initialized successfully');
  }
} catch(e) {
  console.error('[QuizEngine] Fatal error during initialization:', e);
  document.body.innerHTML = '<div style="padding:2rem;text-align:center;font-family:sans-serif;"><h1>❌ Quiz Engine Error</h1><p>' + e.message + '</p><pre style="text-align:left;max-width:600px;margin:1rem auto;background:#f5f5f5;padding:1rem;">' + e.stack + '</pre></div>';
}

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

})();

/* ── html2pdf (loaded lazily inside exportToPDF when needed) ────── */
window.__HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
