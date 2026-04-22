/* ================================================================
   engine-common.js  —  Shared initialization for quiz/bank engines.
   Provides head asset injection, CSS, animations, toast, and theme.
   Load this BEFORE quiz-engine.js or bank-engine.js.
   ================================================================ */
(function () {
  'use strict';

  /* ── 1. Head Asset Injection ──────────────────────────────────── */
  function injectHeadAssets(ENGINE_BASE) {
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
    _addLink('manifest',   ENGINE_BASE + 'assets/manifest.webmanifest');
    _addLink('icon',       ENGINE_BASE + 'assets/favicon.svg', {type: 'image/svg+xml'});
    _addLink('apple-touch-icon', ENGINE_BASE + 'assets/favicon.svg');
  }

  /* ── 2. FOUC Prevention ───────────────────────────────────────── */
  function initFOUCPrevention() {
    var savedTheme = localStorage.getItem('quiz-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.style.background = savedTheme === 'light' ? '#f3f0eb' : '#0d1117';
    document.body.style.color = savedTheme === 'light' ? '#1c1917' : '#e6edf3';
    document.body.style.transition = 'background 0.2s ease, color 0.2s ease';
    document.body.style.overflow = 'hidden';
  }

  /* ── 3. Shared CSS Injection ──────────────────────────────────── */
  function injectSharedCSS() {
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
  transition: box-shadow var(--transition-slow);
}
.start-card:hover {
  box-shadow: 0 6px 28px rgba(0,0,0,0.45);
}
.start-icon {
  width: 72px; height: 72px;
  background: var(--accent-dim);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1.5rem;
  font-size: 2rem;
  transition: transform var(--transition-slow);
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
  transition: border-color var(--transition);
}
.meta-item:hover {
  border-color: var(--accent);
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
  transition: border-color var(--transition), background var(--transition);
}

@media (max-width: 480px) {
  .mode-option {
    min-height: 90px;
  }
  .start-card {
    padding: 2rem 1.5rem;
  }
}

@media (max-width: 640px) {
  .question-area .q-header {
    flex-wrap: wrap !important;
  }
  .question-area .q-number-badge {
    order: 1 !important;
    flex-shrink: 0 !important;
  }
  .question-area .q-actions {
    order: 2 !important;
    margin-left: auto !important;
  }
  .question-area .q-text {
    order: 3 !important;
    flex: 0 0 100% !important;
    width: 100% !important;
    margin-top: 0.5rem !important;
    margin-bottom: 0 !important;
    font-size: 1.15rem !important;
    line-height: 1.8 !important;
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
  contain: layout style;
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
.flag-btn svg {
  transition: transform var(--transition);
}
.flag-btn.active svg {
  transform: scale(1.1);
}

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
  transition: border-color var(--transition), background var(--transition), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}
.option-label::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--accent-dim);
  opacity: 0;
  transition: opacity var(--transition);
}
.option-label:hover {
  border-color: var(--accent);
}
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
  transition: background var(--transition), border-color var(--transition), color var(--transition);
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
.btn-nav:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.btn-nav.primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  margin-left: auto;
}
.btn-nav.primary:hover {
  opacity: 0.88;
}
.btn-nav.submit-btn {
  background: var(--correct);
  border-color: var(--correct);
  color: #fff;
  margin-left: auto;
}
.btn-nav.submit-btn:hover {
  opacity: 0.88;
}

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
  transition: border-color var(--transition);
}
.score-stat:hover {
  border-color: var(--accent);
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
.tab-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tab-btn.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}

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

/* ═══════════════════════════════════════════
   HIGHLIGHT & STRIKETHROUGH
═══════════════════════════════════════════ */
.q-highlight { border-radius: 2px; padding: 1px 0; transition: background 0.15s ease; color: var(--text); }
.q-highlight.hl-color-1 { background: rgba(255,213,79,0.35); }
.q-highlight.hl-color-2 { background: rgba(129,199,132,0.35); }
.q-highlight.hl-color-3 { background: rgba(100,181,246,0.35); }
.q-highlight.hl-color-4 { background: rgba(239,154,154,0.35); }
[data-theme="light"] .q-highlight.hl-color-1 { background: rgba(255,213,79,0.55); }
[data-theme="light"] .q-highlight.hl-color-2 { background: rgba(129,199,132,0.5); }
[data-theme="light"] .q-highlight.hl-color-3 { background: rgba(100,181,246,0.5); }
[data-theme="light"] .q-highlight.hl-color-4 { background: rgba(239,154,154,0.5); }

.strikethrough .option-text { text-decoration: line-through; opacity: 0.45; }
.st-toggle-btn {
  width: 24px; height: 24px; border-radius: 5px;
  background: var(--surface2); border: 1px solid var(--border);
  display: none; align-items: center; justify-content: center;
  color: var(--text-muted); font-size: 0.7rem; cursor: pointer;
  transition: all 0.15s ease; flex-shrink: 0; margin-left: auto;
  position: relative; z-index: 2;
}
.st-toggle-btn:hover { border-color: var(--wrong); color: var(--wrong); background: var(--wrong-bg); }
.st-toggle-btn.active { background: var(--wrong-bg); border-color: var(--wrong); color: var(--wrong); }
.highlighter-active .st-toggle-btn { display: flex; }

/* Color button styles (used by topbar color picker) */
.hl-color-btn {
  width: 22px; height: 22px; border-radius: 5px; border: 2px solid transparent;
  cursor: pointer; transition: all 0.12s ease;
}
.hl-color-btn:hover { transform: scale(1.15); }
.hl-color-btn.cb-1 { background: rgba(255,213,79,0.7); }
.hl-color-btn.cb-2 { background: rgba(129,199,132,0.7); }
.hl-color-btn.cb-3 { background: rgba(100,181,246,0.7); }
.hl-color-btn.cb-4 { background: rgba(239,154,154,0.7); }
.hl-erase-btn {
  width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border);
  background: var(--surface2); cursor: pointer; display: flex; align-items: center;
  justify-content: center; font-size: 0.65rem; color: var(--text-muted); transition: all 0.12s ease;
}
.hl-erase-btn:hover { border-color: var(--wrong); color: var(--wrong); }

.hl-mode-btn {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--surface2); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); font-size: 0.95rem; transition: all 0.15s ease;
  cursor: pointer; position: relative;
}
.hl-mode-btn:hover { border-color: var(--accent); color: var(--accent); }
.hl-mode-btn.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }
.highlighter-active .q-text, .highlighter-active .option-text, .highlighter-active .explanation-box {
  cursor: text; user-select: text; -webkit-user-select: text;
  touch-action: manipulation;
}
/* In highlighter mode, allow text selection on option labels for highlighting */
.highlighter-active .option-label {
  touch-action: manipulation !important;
}
.highlighter-active .option-text {
  user-select: text; -webkit-user-select: text;
}
/* Color picker dropdown next to highlighter button */
.hl-color-picker {
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  margin-top: 6px; z-index: 9001;
  display: none; align-items: center; gap: 4px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 5px 7px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  animation: hlMenuIn 0.15s ease;
}
.hl-color-picker.visible { display: flex; }
.hl-color-picker .hl-color-btn { width: 24px; height: 24px; }
.hl-color-picker .hl-color-btn.selected { border: 2px solid var(--text); box-shadow: 0 0 0 1px var(--accent); }
.hl-color-picker .hl-erase-btn { width: 24px; height: 24px; }
.hl-color-picker .hl-close-btn { width: 24px; height: 24px; background: rgba(255,255,255,0.08); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-muted); margin-left: 2px; }
.hl-color-picker .hl-close-btn:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
/* Last-color indicator dot on the mode button */
.hl-mode-btn .hl-last-dot {
  position: absolute; bottom: 2px; right: 2px;
  width: 8px; height: 8px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  pointer-events: none;
}
.hidden { display: none !important; }

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
  background: rgba(0,0,0,0.7);
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
  }

  /* ── 4. Animation System CSS ──────────────────────────────────── */
  function injectAnimationCSS() {
    var _animStyle = document.createElement('style');
    _animStyle.textContent = `/* ════════════════════════════════════════════════════════════════
   SMOOTH ANIMATION SYSTEM  v2
   Easing · Entrance · Hover · Press · Modal · Ripple
════════════════════════════════════════════════════════════════ */

/* ── Easing tokens ──────────────────────────────────────────── */
:root {
  --ease-out    : cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring : cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out : cubic-bezier(0.65, 0, 0.35, 1);
  --transition  : 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Screen transitions ────────────────────────────────────── */
@keyframes screenFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Start screen entrance ─────────────────────────────────── */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes iconPop {
  0%   { transform: scale(0.7) rotate(-8deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(4deg); }
  100% { transform: scale(1)    rotate(0deg); opacity: 1; }
}

.topbar { animation: slideDown 0.45s var(--ease-out) both; }
#start-screen .start-card { animation: fadeUp 0.55s 0.1s var(--ease-out) both; }
#start-screen .start-icon { animation: iconPop 0.5s 0.2s var(--ease-spring) both; }

/* ── Card hover effects ────────────────────────────────────── */
.start-card {
  transition:
    transform      0.32s var(--ease-out),
    box-shadow     0.32s var(--ease-out),
    border-color   0.28s var(--ease-out) !important;
}
.start-card:hover {
  transform   : translateY(-5px) scale(1.008);
  box-shadow  : 0 16px 40px rgba(0,0,0,0.45);
}

.start-icon {
  transition: transform 0.35s var(--ease-spring) !important;
}
.start-card:hover .start-icon {
  transform : scale(1.08) rotate(-4deg);
}

/* ── Button effects ────────────────────────────────────────── */
.btn-start, .btn-nav, .btn-restart {
  position  : relative;
  overflow  : hidden;
  transition:
    opacity    0.22s var(--ease-out),
    transform  0.22s var(--ease-out),
    box-shadow 0.22s var(--ease-out) !important;
}
.btn-start:hover, .btn-nav.primary:hover, .btn-restart:hover {
  opacity   : 0.92 !important;
  transform : translateY(-2px) !important;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 40%, transparent);
}
.btn-start:active, .btn-nav:active, .btn-restart:active {
  transform : scale(0.97) translateY(0px) !important;
  transition-duration: 0.09s !important;
}

/* ── Ripple wave ─────────────────────────────────────────────── */
@keyframes ripple {
  to { transform: scale(5); opacity: 0; }
}
.ripple-wave {
  position      : absolute;
  border-radius : 50%;
  width         : 60px;
  height        : 60px;
  margin-top    : -30px;
  margin-left   : -30px;
  background    : rgba(255, 255, 255, 0.22);
  transform     : scale(0);
  animation     : ripple 0.55s var(--ease-out) forwards;
  pointer-events: none;
}

/* ── Icon buttons ───────────────────────────────────────────── */
.icon-btn {
  transition: all 0.22s var(--ease-out) !important;
}
.icon-btn:hover {
  transform: translateY(-1px);
  color: var(--text) !important;
  border-color: var(--accent) !important;
}
.icon-btn:active {
  transform      : scale(0.87) !important;
  transition-duration: 0.08s !important;
}

/* ── Theme toggle spin ──────────────────────────────────────── */
@keyframes spinPop {
  0%   { transform: rotate(0deg)   scale(1);    }
  40%  { transform: rotate(200deg) scale(0.85); }
  70%  { transform: rotate(320deg) scale(1.1);  }
  100% { transform: rotate(360deg) scale(1);    }
}
.theme-spinning {
  animation: spinPop 0.5s var(--ease-spring) forwards !important;
}

/* ── Option hover effects ──────────────────────────────────── */
.option-label {
  transition:
    transform    0.2s var(--ease-out),
    border-color 0.2s var(--ease-out),
    background   0.2s var(--ease-out) !important;
}
.option-label:hover {
  transform   : translateX(4px);
  border-color: var(--accent) !important;
}

/* ── Nav button effects ────────────────────────────────────── */
.nav-btn {
  transition:
    transform    0.15s var(--ease-out),
    border-color 0.2s var(--ease-out),
    background   0.2s var(--ease-out) !important;
}
.nav-btn:hover {
  transform   : scale(1.08);
  border-color: var(--accent) !important;
}
.nav-btn:active {
  transform      : scale(0.95) !important;
  transition-duration: 0.08s !important;
}

/* ── Flag button pulse ─────────────────────────────────────── */
@keyframes badgePulse {
  0%   { transform: scale(1);    }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1);    }
}
.flag-btn.active svg {
  animation: badgePulse 0.4s var(--ease-spring);
}

/* ── Modal effects ─────────────────────────────────────────── */
.modal-overlay {
  transition: opacity 0.25s var(--ease-out) !important;
}
.modal {
  animation: modalIn 0.38s var(--ease-spring) both !important;
}
@keyframes modalIn {
  from { opacity: 0; transform: translateY(28px) scale(0.93); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}

/* ── Result item animations ────────────────────────────────── */
.result-item {
  animation: fadeUp 0.4s var(--ease-out) both;
}
.result-item:nth-child(1) { animation-delay: 0.05s; }
.result-item:nth-child(2) { animation-delay: 0.1s; }
.result-item:nth-child(3) { animation-delay: 0.15s; }
.result-item:nth-child(4) { animation-delay: 0.2s; }
.result-item:nth-child(5) { animation-delay: 0.25s; }
.result-item:nth-child(n+6) { animation-delay: 0.3s; }

/* ── Timer warning pulse ───────────────────────────────────── */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}

/* ── Respect prefers-reduced-motion ─────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration  : 0.01ms !important;
    animation-delay     : 0ms    !important;
    transition-duration : 0.01ms !important;
  }
}`;
    document.head.appendChild(_animStyle);
  }

  /* ── 5. KEYS Array ────────────────────────────────────────────── */
  var KEYS = 'ABCDEFGH';

  /* ── 6. Toast Setup ───────────────────────────────────────────── */
  var toastTimer;

  function initToast() {
    var t = document.createElement('div');
    t.className = 'toast';
    t.id = 'toast';
    document.body.appendChild(t);

    window.showToast = function showToast(msg, actions) {
      if (!actions) actions = [];

      // Clear any existing content
      t.innerHTML = '';

      // Create message span
      var msgSpan = document.createElement('span');
      msgSpan.textContent = msg;
      msgSpan.style.flex = '1';
      t.appendChild(msgSpan);

      // Add action buttons if provided
      if (actions.length > 0) {
        var actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '0.5rem';
        actionsContainer.style.marginLeft = '0.75rem';

        actions.forEach(function (action) {
          var btn = document.createElement('button');
          btn.textContent = action.label;
          btn.style.cssText =
            'padding: 0.35rem 0.75rem;' +
            'border-radius: 6px;' +
            'border: 1px solid var(--border);' +
            'background: ' + (action.primary ? 'var(--accent)' : 'var(--surface2)') + ';' +
            'color: ' + (action.primary ? '#000' : 'var(--text)') + ';' +
            'font-size: 0.75rem;' +
            'font-weight: 600;' +
            'cursor: pointer;' +
            'transition: all var(--transition);';
          btn.onclick = function () {
            action.onClick();
            t.classList.remove('show');
          };
          btn.onmouseenter = function () {
            if (!action.primary) {
              btn.style.borderColor = 'var(--accent)';
              btn.style.color = 'var(--accent)';
            }
          };
          btn.onmouseleave = function () {
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
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
      }
      // If there are actions, don't auto-hide - let user dismiss manually
    };
  }

  /* ── 7. Theme Toggle ──────────────────────────────────────────── */
  function initThemeToggle() {
    window.toggleTheme = function toggleTheme() {
      var html = document.documentElement;
      var isDark = html.getAttribute('data-theme') === 'dark';
      var newTheme = isDark ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);

      // Remove FOUC-prevention inline styles so the CSS-variable rules on body take over.
      // Without this, body.style.background/color set during init would permanently
      // override the stylesheet regardless of the data-theme attribute changing.
      document.body.style.background = '';
      document.body.style.color = '';

      // Keep the browser chrome (address bar / status bar) in sync.
      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.content = newTheme === 'light' ? '#f3f0eb' : '#0d1117';

      // Save preference to localStorage so it persists when returning to index.html
      localStorage.setItem('quiz-theme', newTheme);

      window.__updateThemeIcon();
    };

    window.__updateThemeIcon = function updateThemeIcon() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      // Note: Added .theme-toggle-btn specifically so we don't accidentally overwrite the Home 🏠 button!
      document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
        btn.textContent = isDark ? '\u2600' : '\u263E';
      });
    };
  }

  /* ── Expose global API ────────────────────────────────────────── */
  window.EngineCommon = {
    injectHeadAssets: injectHeadAssets,
    initFOUCPrevention: initFOUCPrevention,
    injectSharedCSS: injectSharedCSS,
    injectAnimationCSS: injectAnimationCSS,
    initToast: initToast,
    initThemeToggle: initThemeToggle,
    KEYS: KEYS
  };

  window.__EngineCommonLoaded = true;
})();
