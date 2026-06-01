/* ================================================================
   flashcard-engine.js  —  Standalone flashcard engine for card-deck files.
   Load this after defining BANK_CONFIG and FLASHCARD_BANK globals.

   FLASHCARD_BANK format (JSON array):
   [
     // Basic flashcard
     {
       "type": "basic",
       "front": "What is the powerhouse of the cell?",
       "back": "Mitochondria",
       "tags": ["biology"],
       "id": "bio-001"
     },
     // Cloze flashcard
     {
       "type": "cloze",
       "text": "The powerhouse of the cell is the {{c1::mitochondria}}.",
       "tags": ["biology"],
       "id": "bio-002"
     },
     // Cloze with multiple deletions
     {
       "type": "cloze",
       "text": "The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell.",
       "tags": ["biology"],
       "id": "bio-003"
     }
   ]

   BANK_CONFIG format:
   {
     "uid": "unique-id",
     "title": "My Flashcard Deck",
     "description": "A deck about ...",
     "icon": "🃏"
   }
   ================================================================ */
(function () {
  'use strict';

  var _cs  = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : (window.__FLASHCARD_ENGINE_BASE || '');

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
  var savedTheme = localStorage.getItem('flashcard-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.style.background = savedTheme === 'light' ? '#f3f0eb' : '#0d1117';
  document.body.style.color = savedTheme === 'light' ? '#1c1917' : '#e6edf3';
  document.body.style.transition = 'background 0.2s ease, color 0.2s ease';
  document.body.style.overflow = 'hidden';

  /* ════════════════════════════════════════════════════════════════
     CSS — Same design system as the quiz engine, adapted for flashcards
     ════════════════════════════════════════════════════════════════ */
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
  --card-flip:  0.5s cubic-bezier(0.16, 1, 0.3, 1);
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

/* Card count selector */
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
   STUDY SCREEN
═══════════════════════════════════════════ */
#study-screen { flex-direction: column; height: 100%; overflow: hidden; }
.topbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
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

.study-body {
  display: flex; flex: 1; overflow: hidden; position: relative;
}

/* ── Card Area ────────────────────────────────────────────── */
.card-area {
  flex: 1; overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  contain: layout style;
}
.card-area::-webkit-scrollbar { width: 6px; }
.card-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* ── Flashcard ────────────────────────────────────────────── */
.flashcard-wrapper {
  width: 100%;
  max-width: 860px;
  perspective: 1200px;
  flex: 1;
  display: flex;
  min-height: 0;
}

.flashcard {
  width: 100%;
  min-height: 0;
  max-height: 85vh;
  position: relative;
  transform-style: preserve-3d;
  transition: transform var(--card-flip);
  cursor: pointer;
}
.flashcard.flipped {
  transform: rotateY(180deg);
}

.flashcard-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 16px;
  border: 1.5px solid var(--border);
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: var(--shadow);
  transition: border-color var(--transition), box-shadow var(--transition);
  scroll-behavior: smooth;
}
.flashcard-face:hover {
  border-color: var(--accent);
}
.flashcard-face::-webkit-scrollbar { width: 5px; }
.flashcard-face::-webkit-scrollbar-track { background: transparent; }
.flashcard-face::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.flashcard-face::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
.flashcard-face.large-content {
  font-size: clamp(0.95rem, 2.5vw, 1.15rem);
}

/* Responsive: tighter padding on small screens */
@media (max-width: 600px) {
  .flashcard-face { padding: 1rem; }
  .card-content { padding: 0.5rem 0.25rem; font-size: clamp(0.95rem, 4vw, 1.15rem); }
}

.flashcard-front {
  background: var(--surface);
}
.flashcard-back {
  background: var(--surface);
  transform: rotateY(180deg);
}

/* Card header bar */
.card-face-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}
.card-type-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.card-type-badge.basic {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--accent);
}
.card-type-badge.cloze {
  background: var(--flagged-bg);
  color: var(--flagged);
  border: 1px solid var(--flagged);
}
.card-number-badge {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.card-face-label {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Card content */
.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: clamp(1.1rem, 3.2vw, 1.45rem);
  font-weight: 500;
  line-height: 1.9;
  text-align: left;
  color: var(--text);
  padding: 0.75rem 0.5rem;
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
}
.card-content.large-text {
  font-size: clamp(1rem, 2.8vw, 1.3rem);
  line-height: 1.8;
}

/* Cloze blank styles */
.cloze-blank {
  display: inline;
  border-radius: 6px;
  padding: 0.15rem 0.5rem;
  font-weight: 600;
  transition: all 0.25s ease;
  position: relative;
  cursor: pointer;
}
.cloze-blank.hidden-blank {
  background: var(--accent-dim);
  border: 2px dashed var(--accent);
  color: transparent;
  min-width: 2.5rem;
  user-select: none;
  animation: clozePulse 2s ease-in-out infinite;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  padding: 0.1rem 0.6rem;
}
@keyframes clozePulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
/* (No ::after overlay — the cloze number badge is the visual indicator) */
.cloze-blank.revealed-blank {
  background: var(--correct-bg);
  border: 2px solid var(--correct);
  color: var(--correct);
  animation: revealPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes revealPop {
  0% { transform: scale(0.8); opacity: 0; }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
.cloze-blank.revealed-blank.c1 { border-color: #f0a500; color: #f0a500; background: rgba(240,165,0,0.12); }
.cloze-blank.revealed-blank.c2 { border-color: #58a6ff; color: #58a6ff; background: rgba(88,166,255,0.12); }
.cloze-blank.revealed-blank.c3 { border-color: #d2a8ff; color: #d2a8ff; background: rgba(210,168,255,0.12); }
.cloze-blank.revealed-blank.c4 { border-color: #2ea043; color: #2ea043; background: rgba(46,160,67,0.12); }
.cloze-blank.revealed-blank.c5 { border-color: #da3633; color: #da3633; background: rgba(218,54,51,0.12); }
.cloze-number {
  font-size: 0.7em;
  font-weight: 700;
  color: inherit;
  opacity: 0.7;
}
/* Hidden blank cloze numbers (shown so user knows which #) */
.hidden-blank .cloze-number {
  color: var(--accent);
  opacity: 1;
  font-size: 0.85rem;
  line-height: 1;
}
/* Multi-line cloze: each line in its own block for proper spacing */
.cloze-line {
  margin-bottom: 0.35em;
}
.cloze-line:last-child {
  margin-bottom: 0;
}
.card-content .cloze-line {
  display: block;
}

/* Hidden blank cloze numbers (shown so user knows which #) */
.hidden-blank .cloze-number {
  color: var(--accent);
  opacity: 1;
  position: relative;
  z-index: 1;
}



.card-tap-hint svg {
  width: 14px; height: 14px;
  opacity: 0.6;
}

/* Tags on cards */
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.75rem;
  justify-content: center;
}
.card-tag {
  font-size: 0.68rem;
  padding: 0.15rem 0.55rem;
  border-radius: 5px;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-weight: 500;
}



/* ── Rating Buttons (after revealing answer) ──────────────── */
.rating-section {
  width: 100%;
  max-width: 860px;
  display: none;
  animation: fadeUp 0.3s ease-out both;
}
.rating-section.visible { display: block; }

.rating-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6rem;
  text-align: center;
}
.rating-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.rating-btn {
  padding: 0.7rem 0.5rem;
  border-radius: var(--radius);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
  transition: all var(--transition);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}
.rating-btn .rating-key {
  width: 24px; height: 24px;
  border-radius: 6px;
  background: var(--surface2);
  border: 1.5px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700;
  transition: all var(--transition);
}
.rating-btn:hover { transform: translateY(-2px); }
.rating-btn:active { transform: scale(0.97); }
.rating-btn.rate-again:hover,
.rating-btn.rate-again:active { border-color: var(--wrong); color: var(--wrong); }
.rating-btn.rate-again:hover .rating-key { background: var(--wrong); color: #fff; border-color: var(--wrong); }

.rating-btn.rate-hard:hover,
.rating-btn.rate-hard:active { border-color: var(--accent); color: var(--accent); }
.rating-btn.rate-hard:hover .rating-key { background: var(--accent); color: #000; border-color: var(--accent); }

.rating-btn.rate-good:hover,
.rating-btn.rate-good:active { border-color: var(--correct); color: var(--correct); }
.rating-btn.rate-good:hover .rating-key { background: var(--correct); color: #fff; border-color: var(--correct); }

.rating-btn.rate-easy:hover,
.rating-btn.rate-easy:active { border-color: var(--flagged); color: var(--flagged); }
.rating-btn.rate-easy:hover .rating-key { background: var(--flagged); color: #fff; border-color: var(--flagged); }

/* ── Navigation Buttons ──────────────────────────────────── */
.card-nav-btns {
  width: 100%;
  max-width: 860px;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
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

/* ── Cloze Reveal Buttons (for multi-cloze cards) ────────── */
.cloze-reveal-bar {
  width: 100%;
  max-width: 860px;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.5rem;
}
.cloze-reveal-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}
.cloze-reveal-btn:hover { border-color: var(--flagged); color: var(--flagged); transform: translateY(-1px); }
.cloze-reveal-btn.revealed {
  pointer-events: none;
  opacity: 0.6;
}
.cloze-reveal-btn .cloze-idx {
  width: 22px; height: 22px;
  border-radius: 6px;
  background: var(--surface2);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700;
}
.cloze-reveal-btn.revealed .cloze-idx {
  background: var(--correct);
  border-color: var(--correct);
  color: #fff;
}
.cloze-reveal-btn.c1 { border-color: #f0a500; }
.cloze-reveal-btn.c1 .cloze-idx { border-color: #f0a500; color: #f0a500; }
.cloze-reveal-btn.revealed.c1 .cloze-idx { background: #f0a500; border-color: #f0a500; color: #fff; }
.cloze-reveal-btn.c2 { border-color: #58a6ff; }
.cloze-reveal-btn.c2 .cloze-idx { border-color: #58a6ff; color: #58a6ff; }
.cloze-reveal-btn.revealed.c2 .cloze-idx { background: #58a6ff; border-color: #58a6ff; color: #fff; }
.cloze-reveal-btn.c3 { border-color: #d2a8ff; }
.cloze-reveal-btn.c3 .cloze-idx { border-color: #d2a8ff; color: #d2a8ff; }
.cloze-reveal-btn.revealed.c3 .cloze-idx { background: #d2a8ff; border-color: #d2a8ff; color: #fff; }
.cloze-reveal-btn.c4 { border-color: #2ea043; }
.cloze-reveal-btn.c4 .cloze-idx { border-color: #2ea043; color: #2ea043; }
.cloze-reveal-btn.revealed.c4 .cloze-idx { background: #2ea043; border-color: #2ea043; color: #fff; }
.cloze-reveal-btn.c5 { border-color: #da3633; }
.cloze-reveal-btn.c5 .cloze-idx { border-color: #da3633; color: #da3633; }
.cloze-reveal-btn.revealed.c5 .cloze-idx { background: #da3633; border-color: #da3633; color: #fff; }

/* ── Flag Button ─────────────────────────────────────────── */
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

/* ── Nav pane ────────────────────────────────────────────── */
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
.dot.seen        { background: var(--correct); }
.dot.flagged     { background: var(--flagged); }
.dot.current     { background: var(--accent); }
.dot.unseen      { background: var(--surface2); border: 1.5px solid var(--border); }

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
.nav-btn.seen {
  background: var(--correct-bg);
  border-color: var(--correct);
  color: var(--correct);
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
  .study-body { flex-direction: column; }
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
.n.blue  { color: var(--flagged); }
.n.muted { color: var(--text-muted); }

.result-list { display: flex; flex-direction: column; gap: 1rem; }
.result-item { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.result-item.seen { border-color: var(--correct); }
.result-item.flagged { border-color: var(--flagged); }
.result-item.skipped { border-color: var(--skip); }

.result-item-header { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem 1.25rem; cursor: pointer; }
.result-status-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.9rem; font-weight: 700; margin-top: 0.15rem; }
.result-item.seen .result-status-icon { background: var(--correct-bg); color: var(--correct); }
.result-item.flagged .result-status-icon { background: var(--flagged-bg); color: var(--flagged); }
.result-item.skipped .result-status-icon { background: var(--surface2); color: var(--skip); }

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
.answer-row.front-side { background: var(--accent-dim); }
.answer-row.back-side { background: var(--correct-bg); }
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
.btn-secondary {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.85rem 1.75rem;
  border-radius: var(--radius);
  background: var(--surface2); color: var(--text);
  font-weight: 600; font-size: 0.9rem;
  border: 1.5px solid var(--border);
  transition: all var(--transition);
  text-decoration: none;
}
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); opacity: 1; transform: translateY(-1px); }

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

.result-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.tab-btn {
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}
.tab-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.tab-btn.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}

.hidden { display: none !important; }

@media (max-width: 640px) {
  .card-area .flashcard-wrapper { max-width: 100%; }
  .flashcard-face { padding: 1.25rem 1rem 4rem; }
  .rating-grid { grid-template-columns: repeat(2, 1fr); }
  .card-area { padding: 0.5rem; }
}
`;
  document.head.appendChild(_style);

  /* ── Inject Animation System ────────────────────────────── */
  var _animStyle = document.createElement('style');
  _animStyle.textContent = `/* ════════════════════════════════════════════════════════════════
   SMOOTH ANIMATION SYSTEM
   Easing · Entrance · Hover · Press · Modal
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
.btn-start, .btn-nav, .btn-restart, .rating-btn {
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
.btn-start:active, .btn-nav:active, .btn-restart:active, .rating-btn:active {
  transform : scale(0.97) translateY(0px) !important;
  transition-duration: 0.09s !important;
}

/* ── Icon buttons ───────────────────────────────────────────── */
.icon-btn, .hub-back-btn, .theme-btn-fixed {
  transition: all 0.22s var(--ease-out) !important;
}
.hub-back-btn:hover, .theme-btn-fixed:hover {
  transform: translateY(-1px);
  color: var(--text) !important;
  border-color: var(--accent) !important;
}
.icon-btn:active, .hub-back-btn:active, .theme-btn-fixed:active {
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

/* ── Flashcard flip 3D ────────────────────────────────────── */
@keyframes cardEntrance {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);    }
}
.flashcard-wrapper.card-entering {
  animation: cardEntrance 0.4s var(--ease-out) both;
}

/* ── Rating section entrance ──────────────────────────────── */
@keyframes ratingSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Export PDF Section ───────────────────────────────────── */
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

/* ── Strikethrough ─────────────────────────────────────────── */


/* ── Keyboard Help Overlay ─────────────────────────────────── */
.kb-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s ease;
}
.kb-overlay.visible { opacity: 1; pointer-events: auto; }
.kb-modal {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 2rem; max-width: 520px;
  width: 90%; box-shadow: var(--shadow);
  animation: modalIn 0.35s var(--ease-spring) both;
}
.kb-modal h2 { margin: 0 0 1rem; font-size: 1.2rem; }
.kb-table { width: 100%; border-collapse: collapse; }
.kb-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
.kb-table tr:last-child td { border-bottom: none; }
.kb-table td:first-child { white-space: nowrap; text-align: right; }
.kbd { display: inline-block; padding: 2px 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; font-size: 0.78rem; font-weight: 600; font-family: inherit; }
.kb-close { margin-top: 1rem; text-align: center; }

/* ── Ripple effect ─────────────────────────────────────────── */
.ripple { position: relative; overflow: hidden; }
.ripple::after {
  content: ''; position: absolute; border-radius: 50%;
  background: rgba(255,255,255,0.15);
  width: 100px; height: 100px; margin-top: -50px; margin-left: -50px;
  top: 50%; left: 50%;
  transform: scale(0); opacity: 1;
  pointer-events: none;
}
.ripple:active::after {
  animation: rippleAnim 0.5s ease-out;
}
@keyframes rippleAnim {
  from { transform: scale(0); opacity: 0.6; }
  to   { transform: scale(4); opacity: 0; }
}
`;
  document.head.appendChild(_animStyle);

  /* ════════════════════════════════════════════════════════════════
     INJECT HTML STRUCTURE
     ════════════════════════════════════════════════════════════════ */
  var _html = document.createElement('div');
  _html.id = 'app-root';
  _html.style.cssText = 'width:100%;height:100%;';
  _html.innerHTML = `
<!-- ════════ START SCREEN ════════ -->
<div class="screen active" id="start-screen">
  <a href="index.html" class="hub-back-btn" onclick="navigateToIndex(event)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    Menu
  </a>
  <button class="theme-btn-fixed theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">☀</button>

  <div class="start-card">
    <div class="start-icon" id="start-icon">🃏</div>
    <h1 id="bank-title">Flashcard Deck</h1>
    <p class="subtitle" id="bank-subtitle">Study your flashcards</p>

    <div class="bank-stats-row">
      <div class="bank-stat-box">
        <span class="bsv" id="stat-covered">0</span>
        <span class="bsl">Seen</span>
      </div>
      <div class="bank-stat-box">
        <span class="bsv" id="stat-total">0</span>
        <span class="bsl">Total</span>
      </div>
      <div class="bank-stat-box">
        <span class="bsv" id="stat-sessions">0</span>
        <span class="bsl">Sessions</span>
      </div>
    </div>

    <div class="coverage-wrap">
      <div class="coverage-label">
        <span>Deck Coverage</span>
        <span id="coverage-pct">0%</span>
      </div>
      <div class="coverage-bar">
        <div class="coverage-fill" id="coverage-fill" style="width:0%"></div>
      </div>
    </div>

    <div class="q-count-section">
      <div class="section-label">Cards per session</div>
      <div class="time-controls">
        <button class="time-adj-btn" onclick="adjustCount(-5)">-5</button>
        <input type="number" id="q-count-input" class="time-input" value="20" min="1" onchange="onCustomCount(this.value)">
        <button class="time-adj-btn" onclick="adjustCount(5)">+5</button>
      </div>
    </div>

    <div class="mode-section">
      <div class="section-label">Study Mode</div>
      <div class="mode-grid">
        <label class="mode-label">
          <input type="radio" name="study-mode" value="classic" checked>
          <div class="mode-option mode-selected">
            <div class="mo-title">Classic</div>
          </div>
        </label>
        <label class="mode-label">
          <input type="radio" name="study-mode" value="spaced">
          <div class="mode-option">
            <div class="mo-title">Spaced</div>
          </div>
        </label>
      </div>
    </div>

    <div class="order-section">
      <div class="section-label">Order</div>
      <div class="mode-grid">
        <label class="mode-label">
          <input type="radio" name="card-order" value="sequential" checked>
          <div class="mode-option mode-selected">
            <div class="mo-title">Sequential</div>
          </div>
        </label>
        <label class="mode-label">
          <input type="radio" name="card-order" value="random">
          <div class="mode-option">
            <div class="mo-title">Random</div>
          </div>
        </label>
      </div>
    </div>

    <button class="btn-start" onclick="startStudy()">Start Studying</button>
    <button class="reset-bank-btn" onclick="resetBankProgress()">Reset Deck Progress</button>
  </div>
</div>

<!-- ════════ STUDY SCREEN ════════ -->
<div class="screen" id="study-screen">
  <div class="topbar">
    <span class="topbar-title" id="topbar-title">Flashcard Deck</span>
    <div class="timer-wrap" id="timer-display">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      <span id="timer-text">00:00</span>
    </div>
    <div class="topbar-actions">

      <button class="icon-btn" onclick="toggleTheme()" title="Toggle theme">
        <span id="theme-toggle-icon">☀</span>
      </button>
      <button class="icon-btn danger" onclick="confirmResetProgress()" title="Quit session">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </div>
  </div>
  <div class="progress-bar-wrap">
    <div class="progress-bar-fill" id="progress-fill" style="width:0%"></div>
  </div>

  <div class="study-body">
    <div class="card-area" id="card-area" style="position:relative;">
      <!-- Card renders here dynamically -->
    </div>

    <div class="nav-pane">
      <div class="nav-pane-header">
        <h3>Card Navigator</h3>
        <div class="legend">
          <div class="legend-item"><span class="dot seen"></span><span id="legend-text-seen">Seen</span></div>
          <div class="legend-item"><span class="dot flagged"></span>Flagged</div>
          <div class="legend-item"><span class="dot current"></span>Current</div>
          <div class="legend-item"><span class="dot unseen"></span>Unseen</div>
        </div>
      </div>
      <div class="nav-grid-wrap">
        <div class="nav-grid" id="nav-grid"></div>
      </div>
      <div class="nav-stats">
        <div class="stat-item"><div class="sv green" id="stat-seen">0</div><div class="sl">Seen</div></div>
        <div class="stat-item"><div class="sv blue" id="stat-flagged-q">0</div><div class="sl">Flagged</div></div>
        <div class="stat-item"><div class="sv muted" id="stat-remaining">0</div><div class="sl">Remaining</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ════════ RESULT SCREEN ════════ -->
<div class="screen" id="result-screen">
  <div class="result-topbar">
    <h2>Session Complete</h2>
    <div class="topbar-actions">
      <a href="#" class="icon-btn" onclick="navigateToIndex(event); return false;" title="Back to Hub">🏠</a>
      <button class="icon-btn" onclick="toggleTheme()" title="Toggle theme">
        <span class="theme-toggle-btn">☀</span>
      </button>
    </div>
  </div>
  <div class="result-body" id="result-body">
    <div class="score-banner">
      <div class="score-circle">
        <span class="pct" id="res-pct">0%</span>
        <span class="lbl">Complete</span>
      </div>
      <div class="score-details">
        <h3 id="res-grade">Session Done!</h3>
        <div class="score-grid">
          <div class="score-stat"><div class="n green" id="res-seen">0</div><div class="t">Cards Seen</div></div>
          <div class="score-stat"><div class="n blue" id="res-flagged">0</div><div class="t">Flagged</div></div>
          <div class="score-stat"><div class="n muted" id="res-again">0</div><div class="t">Again</div></div>
          <div class="score-stat"><div class="n muted" id="res-time">00:00</div><div class="t">Time</div></div>
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
          <input type="checkbox" name="export-again" onchange="onExportFilterChange(this)">
          <span class="export-checkbox-visual">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </span>
          <span class="export-label">Again</span>
          <span class="export-badge" id="badge-again">0</span>
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
    <div class="result-tabs" id="result-tabs">
      <button class="tab-btn active" onclick="filterResults('all',this)">All</button>
      <button class="tab-btn" onclick="filterResults('flagged',this)">Flagged</button>
      <button class="tab-btn" onclick="filterResults('again',this)">Again</button>
    </div>
    <div class="result-list" id="result-list"></div>
    <div class="result-actions">
      <button class="btn-restart" onclick="onNewSessionClick(event)">New Session</button>
      <button class="btn-secondary" onclick="navigateToIndex(event)">Back to Hub</button>
    </div>
  </div>
</div>

<!-- ════════ MODALS ════════ -->
<div class="modal-overlay" id="finish-modal">
  <div class="modal">
    <h3>Finish Session?</h3>
    <p id="finish-modal-msg">Complete your study session and view results.</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeFinishModal()">Keep Studying</button>
      <button class="btn-confirm" onclick="confirmFinishAction()">Finish Session</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="reset-modal">
  <div class="modal">
    <h3>End Session?</h3>
    <p>Your progress in this session will be lost. Cards you have already seen will still be marked as reviewed.</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeResetModal()">Cancel</button>
      <button class="btn-confirm" onclick="confirmResetAction()">End Session</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="reset-deck-modal">
  <div class="modal">
    <h3>Reset Deck Progress?</h3>
    <p>This will forget which cards you have already seen and reset all ratings. Your flashcards themselves will not be deleted.</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeResetDeckModal()">Cancel</button>
      <button class="btn-confirm danger" onclick="confirmResetDeckAction()">Reset Progress</button>
    </div>
  </div>
</div>

<!-- Keyboard Help Overlay -->
<div class="kb-overlay" id="kb-overlay" onclick="closeKbHelp()">
  <div class="kb-modal" onclick="event.stopPropagation()">
    <h2>Keyboard Shortcuts</h2>
    <table class="kb-table">
      <tr><td><span class="kbd">Space</span> / <span class="kbd">Enter</span></td><td>Flip card</td></tr>
      <tr><td><span class="kbd">←</span> / <span class="kbd">→</span></td><td>Previous / Next card</td></tr>
      <tr><td><span class="kbd">1</span> – <span class="kbd">4</span></td><td>Rate: Again, Hard, Good, Easy</td></tr>
      <tr><td><span class="kbd">F</span></td><td>Toggle flag</td></tr>
      <tr><td><span class="kbd">/</span></td><td>Show keyboard shortcuts</td></tr>
      <tr><td><span class="kbd">Esc</span></td><td>Close help / modals</td></tr>
    </table>
    <div class="kb-close"><button class="btn" onclick="closeKbHelp()">Close</button></div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>
`;
  document.body.appendChild(_html);

  /* ════════════════════════════════════════════════════════════════
     ENGINE LOGIC
     ════════════════════════════════════════════════════════════════ */

  // ── Constants ──────────────────────────────────────────────
  var CLOZE_RE = /\{\{c(\d+)::([^}]+)\}\}/g;

  // ── State ──────────────────────────────────────────────────
  var FLASHCARD_BANK = window.FLASHCARD_BANK || [];
  var SESSION_CARDS  = [];
  var SESSION_CARD_INDICES = [];
  var selectedCount  = 20;
  var uiReady        = false;
  var timerPaused    = false;
  var lastTime       = Date.now();

  var state = {
    current: 0,
    flipped: {},
    flagged: {},
    ratings: {},
    revealedClozes: {},
    elapsed: 0,
    timerID: null,
    mode: 'classic',
    submitted: false
  };

  /* ── Cloze Parsing ────────────────────────────────────────── */
  function parseCloze(text) {
    // Returns array of { cNum, answer } and the display templates
    var clozes = [];
    var re = new RegExp(CLOZE_RE.source, 'g');
    var m;
    while ((m = re.exec(text)) !== null) {
      clozes.push({ cNum: parseInt(m[1]), answer: m[2], fullMatch: m[0] });
    }
    return clozes;
  }

  function renderClozeFront(text, revealedSet) {
    // Render cloze text with blanks; supports multi-line (split by \n)
    revealedSet = revealedSet || new Set();
    var lines = text.split('\n');
    var out = [];
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var rendered = line.replace(CLOZE_RE, function(match, cNum, answer) {
        var colorClass = 'c' + cNum;
        if (revealedSet.has(parseInt(cNum))) {
          return '<span class="cloze-blank revealed-blank ' + colorClass + '"><span class="cloze-number">' + cNum + '</span>' + escapeHTML(answer) + '</span>';
        }
        return '<span class="cloze-blank hidden-blank ' + colorClass + '" onclick="event.stopPropagation();revealCloze(' + cNum + ')"><span class="cloze-number">' + cNum + '</span></span>';
      });
      out.push('<div class="cloze-line">' + rendered + '</div>');
    }
    return out.join('');
  }

  function renderClozeBack(text) {
    // Render cloze text with all answers revealed; multi-line aware
    var lines = text.split('\n');
    var out = [];
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var rendered = line.replace(CLOZE_RE, function(match, cNum, answer) {
        var colorClass = 'c' + cNum;
        return '<span class="cloze-blank revealed-blank ' + colorClass + '"><span class="cloze-number">' + cNum + '</span>' + escapeHTML(answer) + '</span>';
      });
      out.push('<div class="cloze-line">' + rendered + '</div>');
    }
    return out.join('');
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML.replace(/\n/g, '<br>');;
  }

  /* ── Session Progress Storage ─────────────────────────────── */
  var STORAGE_VERSION = 'v1';
  var STORAGE_KEY = 'flashcard_progress_' + STORAGE_VERSION + '_' + (BANK_CONFIG.uid || window.location.pathname).replace(/[^a-zA-Z0-9]/g, '_');
  var pendingRestoreData = null;
  var restoreToastTimeout = null;
  var restoreScreenTimeout = null;

  var saveProgressTimeout = null;
  function debounceSaveProgress() {
    if (saveProgressTimeout) clearTimeout(saveProgressTimeout);
    saveProgressTimeout = setTimeout(saveProgress, 500);
  }

  function saveProgress() {
    if (state.submitted) return;
    var hasRatings = Object.keys(state.ratings || {}).length > 0;
    var hasFlags = Object.values(state.flagged || {}).some(function(v) { return v; });
    var hasTime = (state.elapsed || 0) > 5;
    if (!hasRatings && !hasFlags && !hasTime) return;

    var saveData = {
      version: STORAGE_VERSION,
      deckTitle: BANK_CONFIG.title,
      totalCards: SESSION_CARDS.length,
      cardCount: selectedCount,
      sessionIndices: SESSION_CARD_INDICES,
      current: state.current,
      flipped: state.flipped,
      flagged: state.flagged,
      ratings: state.ratings,
      revealedClozes: serializeRevealedClozes(),
      elapsed: state.elapsed,
      mode: state.mode,
      timestamp: Date.now(),
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        clearOldSaves();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData)); } catch (err) {
          showToast('Storage full! Clear tracker data to save progress.');
        }
      }
    }
  }

  function serializeRevealedClozes() {
    var obj = {};
    for (var k in state.revealedClozes) {
      if (state.revealedClozes.hasOwnProperty(k) && state.revealedClozes[k] instanceof Set) {
        obj[k] = Array.from(state.revealedClozes[k]);
      }
    }
    return obj;
  }

  function deserializeRevealedClozes(obj) {
    var result = {};
    if (!obj) return result;
    for (var k in obj) {
      if (obj.hasOwnProperty(k) && Array.isArray(obj[k])) {
        result[k] = new Set(obj[k]);
      }
    }
    return result;
  }

  function clearOldSaves() {
    try {
      var now = Date.now();
      var maxAge = 7 * 24 * 60 * 60 * 1000;
      Object.keys(localStorage).forEach(function(key) {
        if (key.indexOf('flashcard_progress_') === 0) {
          try {
            var data = JSON.parse(localStorage.getItem(key));
            if (now - data.timestamp > maxAge) localStorage.removeItem(key);
          } catch (e) { localStorage.removeItem(key); }
        }
      });
    } catch (e) {}
  }

  function clearProgress() { localStorage.removeItem(STORAGE_KEY); }

  /* ── Theme ─────────────────────────────────────────────────── */
  window.toggleTheme = function() {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('flashcard-theme', next);
    document.body.style.background = next === 'light' ? '#f3f0eb' : '#0d1117';
    document.body.style.color = next === 'light' ? '#1c1917' : '#e6edf3';
    var icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.textContent = next === 'dark' ? '☀' : '🌙';
      icon.classList.remove('theme-spinning');
      void icon.offsetWidth;
      icon.classList.add('theme-spinning');
    }
  };
  window.__updateThemeIcon = function() {
    var theme = localStorage.getItem('flashcard-theme') || 'dark';
    var icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '🌙';
  };

  /* ── Keyboard Help ─────────────────────────────────────────── */
  /* (openKbHelp / closeKbHelp are on window for HTML onclick) */
  window.openKbHelp = function() {
    var overlay = document.getElementById('kb-overlay');
    if (overlay) overlay.classList.add('visible');
  };
  window.closeKbHelp = function() {
    var overlay = document.getElementById('kb-overlay');
    if (overlay) overlay.classList.remove('visible');
  };

  /* ── Tracker Integration ───────────────────────────────────── */
  var TRACKER_KEYS_KEY = 'quiz_tracker_keys';
  function getTrackerUid() {
    return BANK_CONFIG.uid || window.location.pathname.replace(/[^a-zA-Z0-9]/g, '_');
  }
  function getTrackerKey() {
    return 'quiz_tracker_v2_' + getTrackerUid();
  }
  window.saveTrackerData = function() {
    var uid = getTrackerUid();
    var wrongCount = 0;
    var flaggedCount = 0;
    var againCards = [];
    var flaggedCards = [];
    SESSION_CARDS.forEach(function(card, idx) {
      var isAgain = state.ratings[idx] === 'again';
      var isFlagged = !!state.flagged[idx];
      if (isAgain) { wrongCount++; againCards.push({ idx: idx, front: card.front || card.text, back: card.back || '', type: card.type, tags: card.tags }); }
      if (isFlagged) { flaggedCount++; flaggedCards.push({ idx: idx, front: card.front || card.text, back: card.back || '', type: card.type, tags: card.tags }); }
    });
    if (wrongCount === 0 && flaggedCount === 0) return;
    var existing = {};
    try {
      var raw = localStorage.getItem(getTrackerKey());
      if (raw) existing = JSON.parse(raw);
    } catch (e) { existing = {}; }
    var merged = {
      uid: uid,
      title: BANK_CONFIG.title || 'Flashcard Deck',
      path: window.location.pathname,
      folderPath: window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')),
      timestamp: Date.now(),
      deckType: 'flashcard',
      wrongCount: wrongCount + (existing.wrongCount || 0),
      flaggedCount: flaggedCount + (existing.flaggedCount || 0),
      wrong: mergeQuestions(existing.wrong || [], againCards, 'idx'),
      flagged: mergeQuestions(existing.flagged || [], flaggedCards, 'idx'),
    };
    merged.wrongCount = merged.wrong.length;
    merged.flaggedCount = merged.flagged.length;
    try {
      localStorage.setItem(getTrackerKey(), JSON.stringify(merged));
      var keys = JSON.parse(localStorage.getItem(TRACKER_KEYS_KEY) || '[]');
      if (keys.indexOf(uid) === -1) { keys.push(uid); localStorage.setItem(TRACKER_KEYS_KEY, JSON.stringify(keys)); }
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        showToast('Storage full! Clear tracker data to save progress.');
      }
    }
  };
  function mergeQuestions(existing, incoming, keyField) {
    var used = {};
    existing.forEach(function(item) { used[item[keyField]] = true; });
    var merged = existing.slice();
    incoming.forEach(function(item) {
      if (!used[item[keyField]]) {
        used[item[keyField]] = true;
        merged.push(item);
      }
    });
    return merged;
  }

  function checkSavedProgress() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      var data = JSON.parse(saved);
      if (data.version !== STORAGE_VERSION || data.deckTitle !== BANK_CONFIG.title) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      var maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - data.timestamp > maxAge) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      pendingRestoreData = data;
      showToast('Previous session found!', [
        { label: 'Restore', primary: true, onClick: function() {
          clearTimeout(restoreToastTimeout);
          doRestoreProgress(pendingRestoreData);
        }},
        { label: 'Dismiss', primary: false, onClick: function() {
          clearTimeout(restoreToastTimeout);
          pendingRestoreData = null;
          clearProgress();
        }}
      ]);
      restoreToastTimeout = setTimeout(function() {
        pendingRestoreData = null;
        clearProgress();
        var toast = document.getElementById('toast');
        if (toast) toast.classList.remove('show');
      }, 15000);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function doRestoreProgress(data) {
    selectedCount = data.cardCount || 20;
    var inp = document.getElementById('q-count-input');
    if (inp) inp.value = selectedCount;

    SESSION_CARD_INDICES = data.sessionIndices;
    SESSION_CARDS = data.sessionIndices.map(function(i) { return FLASHCARD_BANK[i]; });

    state.current = Math.min(data.current, SESSION_CARDS.length - 1);
    state.flipped = data.flipped || {};
    state.flagged = data.flagged || {};
    state.ratings = data.ratings || {};
    state.revealedClozes = deserializeRevealedClozes(data.revealedClozes);
    state.elapsed = data.elapsed || 0;
    state.mode = data.mode || 'classic';
    state.submitted = false;

    if (restoreScreenTimeout) clearTimeout(restoreScreenTimeout);
    restoreScreenTimeout = setTimeout(function() {
      document.documentElement.style.setProperty('--q-count', SESSION_CARDS.length);
      showScreen('study-screen');
      buildNavGrid();
      updateNavGrid();
      renderCard(state.current);
      startTimer();
    }, 500);
  }

  /* ── Bank Progress ────────────────────────────────────────── */
  var BANK_PROGRESS_KEY = 'flashcard_bank_v1_' + (BANK_CONFIG.uid || 'default').replace(/[^a-zA-Z0-9]/g, '_');

  function getBankProgress() {
    try {
      var raw = localStorage.getItem(BANK_PROGRESS_KEY);
      if (!raw) return { shownIndices: [], totalSessions: 0, cycleCount: 0, ratings: {} };
      var p = JSON.parse(raw);
      return {
        shownIndices:  Array.isArray(p.shownIndices)  ? p.shownIndices  : [],
        totalSessions: typeof p.totalSessions === 'number' ? p.totalSessions : 0,
        cycleCount:    typeof p.cycleCount === 'number' ? p.cycleCount : 0,
        ratings:       p.ratings && typeof p.ratings === 'object' ? p.ratings : {}
      };
    } catch (e) {
      return { shownIndices: [], totalSessions: 0, cycleCount: 0, ratings: {} };
    }
  }

  function saveBankProgress(progress) {
    try {
      localStorage.setItem(BANK_PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        showToast('Storage full! Clear tracker data to save deck progress.');
      }
    }
  }

  window.openResetDeckModal = function() {
    document.getElementById('reset-deck-modal').classList.add('open');
  };
  window.closeResetDeckModal = function() {
    document.getElementById('reset-deck-modal').classList.remove('open');
  };
  window.confirmResetDeckAction = function() {
    closeResetDeckModal();
    localStorage.removeItem(BANK_PROGRESS_KEY);
    updateStartScreenStats();
    showToast('Deck progress reset!');
  };

  function resetBankProgress() {
    openResetDeckModal();
  }

  /* ── Question Selection ───────────────────────────────────── */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function selectSessionCards(count, order) {
    var bankSize = FLASHCARD_BANK.length;
    var progress = getBankProgress();
    var allIndices = [];
    for (var i = 0; i < bankSize; i++) allIndices.push(i);

    // In spaced mode, prioritize 'again' and 'hard' cards
    if (state.mode === 'spaced') {
      var againHard = [];
      var good = [];
      var unseen = [];
      for (var i = 0; i < bankSize; i++) {
        var r = progress.ratings[i];
        if (progress.shownIndices.indexOf(i) === -1) {
          unseen.push(i);
        } else if (r === 'again' || r === 'hard') {
          againHard.push(i);
        } else {
          good.push(i);
        }
      }
      var prioritized = againHard.concat(shuffle(unseen)).concat(shuffle(good));
      var n = Math.min(count, bankSize);
      var picked = prioritized.slice(0, n);
      progress.shownIndices = arrayUnique(progress.shownIndices.concat(picked));
      progress.totalSessions++;
      saveBankProgress(progress);
      SESSION_CARD_INDICES = picked;
      return picked.map(function(i) { return FLASHCARD_BANK[i]; });
    }

    // Classic mode
    var unshown = allIndices.filter(function(i) { return progress.shownIndices.indexOf(i) === -1; });
    var maxAllowed = unshown.length > 0 ? unshown.length : bankSize;
    var n = Math.min(count, maxAllowed);

    var picked;
    if (unshown.length === 0) {
      progress.cycleCount++;
      progress.shownIndices = [];
      unshown = allIndices.slice();
      saveBankProgress(progress);
      showToast('Full cycle complete! Starting fresh - cycle ' + (progress.cycleCount + 1));
      picked = order === 'sequential'
        ? unshown.sort(function(a,b){return a-b;}).slice(0, n)
        : shuffle(unshown).slice(0, n);
    } else {
      picked = order === 'sequential'
        ? unshown.sort(function(a,b){return a-b;}).slice(0, n)
        : shuffle(unshown).slice(0, n);
    }

    progress.shownIndices = arrayUnique(progress.shownIndices.concat(picked));
    progress.totalSessions++;
    saveBankProgress(progress);
    SESSION_CARD_INDICES = picked;
    return picked.map(function(i) { return FLASHCARD_BANK[i]; });
  }

  function arrayUnique(arr) {
    var seen = {};
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = true; result.push(arr[i]); }
    }
    return result;
  }

  function updateStartScreenStats() {
    var progress = getBankProgress();
    var bankSize = FLASHCARD_BANK.length;
    var covered  = progress.shownIndices.length;
    var pct      = bankSize > 0 ? Math.round(covered / bankSize * 100) : 0;
    var remaining = bankSize - covered;

    if (pct === 100 && covered > 0) {
      progress.cycleCount++;
      progress.shownIndices = [];
      saveBankProgress(progress);
      showToast('Full cycle complete! Starting fresh - cycle ' + (progress.cycleCount + 1));
      document.getElementById('stat-covered').textContent  = 0;
      document.getElementById('stat-total').textContent    = bankSize;
      document.getElementById('stat-sessions').textContent = progress.totalSessions;
      document.getElementById('coverage-fill').style.width = '0%';
      document.getElementById('coverage-pct').textContent  = '0%';
      var inp = document.getElementById('q-count-input');
      selectedCount = Math.min(selectedCount || 20, bankSize);
      inp.value = selectedCount;
      inp.max = bankSize;
      inp.placeholder = bankSize;
      return;
    }

    document.getElementById('stat-covered').textContent  = covered;
    document.getElementById('stat-total').textContent    = bankSize;
    document.getElementById('stat-sessions').textContent = progress.totalSessions;
    document.getElementById('coverage-fill').style.width = pct + '%';
    document.getElementById('coverage-pct').textContent  = pct + '%';

    var inp = document.getElementById('q-count-input');
    var maxAllowed = remaining || bankSize;
    inp.max = maxAllowed;
    inp.placeholder = maxAllowed;
    if (covered === 0) {
      selectedCount = Math.min(selectedCount || 20, bankSize);
      inp.value = selectedCount;
    } else if (parseInt(inp.value) > maxAllowed) {
      inp.value = maxAllowed;
      selectedCount = maxAllowed;
    }
  }

  function adjustCount(delta) {
    var inp = document.getElementById('q-count-input');
    var bankSize = FLASHCARD_BANK.length;
    var progress = getBankProgress();
    var remaining = Math.max(1, bankSize - progress.shownIndices.length);
    var maxAllowed = remaining || bankSize;
    var cur = parseInt(inp.value) || selectedCount || 20;
    var newVal = Math.max(1, Math.min(maxAllowed, cur + delta));
    inp.value = newVal;
    selectedCount = newVal;
    if (uiReady) clearProgress();
  }

  function onCustomCount(val) {
    var bankSize = FLASHCARD_BANK.length;
    var progress = getBankProgress();
    var remaining = Math.max(1, bankSize - progress.shownIndices.length);
    var maxAllowed = remaining || bankSize;
    var n = parseInt(val) || 1;
    n = Math.max(1, Math.min(n, maxAllowed));
    selectedCount = n;
    document.getElementById('q-count-input').value = n;
    if (uiReady) clearProgress();
  }

  /* ── Mode Selection ───────────────────────────────────────── */
  document.querySelectorAll('input[name="study-mode"]').forEach(function(input) {
    input.addEventListener('change', function() {
      document.querySelectorAll('input[name="study-mode"]').forEach(function(r) {
        var opt = r.closest('label').querySelector('.mode-option');
        opt.classList.remove('mode-selected');
        opt.style.borderColor = '';
        opt.style.background  = '';
      });
      var selected = this.closest('label').querySelector('.mode-option');
      selected.classList.add('mode-selected');
      selected.style.borderColor = 'var(--accent)';
      selected.style.background  = 'var(--accent-dim)';
    });
  });
  (function() {
    var checked = document.querySelector('input[name="study-mode"]:checked');
    if (checked) {
      var opt = checked.closest('label').querySelector('.mode-option');
      opt.classList.add('mode-selected');
      opt.style.borderColor = 'var(--accent)';
      opt.style.background  = 'var(--accent-dim)';
    }
  })();

  /* ── Order Selection ──────────────────────────────────────── */
  document.querySelectorAll('input[name="card-order"]').forEach(function(input) {
    input.addEventListener('change', function() {
      document.querySelectorAll('input[name="card-order"]').forEach(function(r) {
        var opt = r.closest('label').querySelector('.mode-option');
        opt.classList.remove('mode-selected');
        opt.style.borderColor = '';
        opt.style.background  = '';
      });
      var selected = this.closest('label').querySelector('.mode-option');
      selected.classList.add('mode-selected');
      selected.style.borderColor = 'var(--accent)';
      selected.style.background  = 'var(--accent-dim)';
    });
  });
  (function() {
    var checked = document.querySelector('input[name="card-order"]:checked');
    if (checked) {
      var opt = checked.closest('label').querySelector('.mode-option');
      opt.classList.add('mode-selected');
      opt.style.borderColor = 'var(--accent)';
      opt.style.background  = 'var(--accent-dim)';
    }
  })();

  /* ── Init UI ──────────────────────────────────────────────── */
  function initUI() {
    document.title = BANK_CONFIG.title;
    document.getElementById('bank-title').textContent    = BANK_CONFIG.title;
    document.getElementById('bank-subtitle').textContent = BANK_CONFIG.description;
    document.getElementById('topbar-title').textContent  = BANK_CONFIG.title;
    if (BANK_CONFIG.icon) {
      document.getElementById('start-icon').textContent = BANK_CONFIG.icon;
    }

    var bankSize = FLASHCARD_BANK.length;
    var progress = getBankProgress();
    var covered = progress.shownIndices.length;
    var pct = bankSize > 0 ? Math.round(covered / bankSize * 100) : 0;
    if (pct === 100 && covered > 0) {
      progress.cycleCount++;
      progress.shownIndices = [];
      saveBankProgress(progress);
    }

    adjustCount(0);
    updateStartScreenStats();

    var savedTheme = localStorage.getItem('flashcard-theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
    uiReady = true;
  }

  /* ── Start Study ──────────────────────────────────────────── */
  function startStudy() {
    var mode  = document.querySelector('input[name="study-mode"]:checked');
    var order = document.querySelector('input[name="card-order"]:checked');
    if (!mode || !order) { showToast('Please select a study mode and order.'); return; }
    mode  = mode.value;
    order = order.value;
    var count = selectedCount;

    if (count < 1 || FLASHCARD_BANK.length === 0) {
      showToast('No cards available to study.');
      return;
    }

    state.mode = mode;
    clearProgress();

    SESSION_CARDS = selectSessionCards(count, order);

    if (!SESSION_CARDS || SESSION_CARDS.length === 0) {
      showToast('No cards selected. Try resetting deck progress.');
      return;
    }

    state.current   = 0;
    state.flipped   = {};
    state.flagged   = {};
    state.ratings   = {};
    state.revealedClozes = {};
    state.elapsed   = 0;
    state.submitted = false;

    document.documentElement.style.setProperty('--q-count', SESSION_CARDS.length);
    showScreen('study-screen');
    document.getElementById('timer-display').classList.remove('hidden');
    buildNavGrid();
    updateNavGrid();
    renderCard(0);
    startTimer();
  }
  window.startStudy = startStudy;
  window.adjustCount = adjustCount;
  window.onCustomCount = onCustomCount;
  window.resetBankProgress = resetBankProgress;

  /* ── Screen Manager ───────────────────────────────────────── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active');
    });
    var target = document.getElementById(id);
    if (id === 'start-screen') {
      var animEls = target.querySelectorAll('.start-card, .start-icon');
      animEls.forEach(function(el) { el.style.animation = 'none'; });
      void target.offsetHeight;
      animEls.forEach(function(el) { el.style.animation = ''; });
    }
    target.classList.add('active');
    if (id === 'start-screen') updateStartScreenStats();
  }

  /* ── Timer ────────────────────────────────────────────────── */
  function startTimer() {
    if (state.timerID) clearInterval(state.timerID);
    timerPaused = false;
    lastTime = Date.now();
    state.timerID = setInterval(function() {
      if (!timerPaused && !state.submitted) {
        var now = Date.now();
        var delta = Math.floor((now - lastTime) / 1000);
        if (delta >= 1) {
          state.elapsed += delta;
          lastTime = now;
          updateTimerDisplay();
        }
      }
    }, 500);
  }

  function stopTimer() {
    if (state.timerID) { clearInterval(state.timerID); state.timerID = null; }
    timerPaused = true;
  }

  function updateTimerDisplay() {
    var secs = state.elapsed || 0;
    var m = Math.floor(secs / 60), s = secs % 60;
    document.getElementById('timer-text').textContent =
      String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /* ── Adjust Card Max-Height ───────────────────────────────── */
  function adjustCardHeight() {
    var cardEl = document.getElementById('flashcard');
    if (!cardEl) return;
    var area = document.getElementById('card-area');
    if (!area) return;

    // Sum heights of all direct children except .flashcard-wrapper
    var otherH = 0;
    for (var i = 0; i < area.children.length; i++) {
      var child = area.children[i];
      if (child.classList && child.classList.contains('flashcard-wrapper')) continue;
      otherH += child.offsetHeight || 0;
    }

    // Add gap total (0.75rem ≈ 12px × (numChildren − 1))
    otherH += 12 * (area.children.length - 1);

    // Height left for the wrapper = card-area height minus other elements
    var wrapperH = area.clientHeight - otherH - 6; // 6px buffer
    if (wrapperH < 150) wrapperH = 150;

    // Card's max-height = wrapper's available space, capped by 85vh safety
    var vhCap = window.innerHeight * 0.85;
    cardEl.style.maxHeight = Math.min(wrapperH, vhCap) + 'px';
    cardEl.style.minHeight = '';

    // Add large-content class if content exceeds a threshold
    var frontFace = cardEl.querySelector('.flashcard-front');
    var backFace = cardEl.querySelector('.flashcard-back');
    [frontFace, backFace].forEach(function(face) {
      if (!face) return;
      var contentEl = face.querySelector('.card-content');
      if (contentEl && contentEl.scrollHeight > 400) {
        face.classList.add('large-content');
      } else if (contentEl) {
        face.classList.remove('large-content');
      }
    });
  }

  /* ── Render Card ──────────────────────────────────────────── */
  function renderCard(idx) {
    state.current = idx;
    var card = SESSION_CARDS[idx];
    var isFlipped = !!state.flipped[idx];
    var isLast = idx === SESSION_CARDS.length - 1;
    var isBasic = card.type === 'basic';
    var isCloze = card.type === 'cloze';

    var seenCount = 0;
    for (var k in state.ratings) { if (state.ratings.hasOwnProperty(k)) seenCount++; }
    document.getElementById('progress-fill').style.width =
      (seenCount / SESSION_CARDS.length * 100) + '%';

    var frontContent, backContent;
    var clozes = [];

    if (isCloze) {
      clozes = parseCloze(card.text);
      var revealedSet = state.revealedClozes[idx] || new Set();
      frontContent = renderClozeFront(card.text, revealedSet);
      backContent = renderClozeBack(card.text);
    } else {
      frontContent = escapeHTML(card.front || '');
      backContent = escapeHTML(card.back || '');
    }

    var area = document.getElementById('card-area');
    var html = '';

    // Flag button on top
    html += '<div style="width:100%;max-width:860px;display:flex;justify-content:flex-end;gap:0.5rem;">';
    html += '<button class="flag-btn ' + (state.flagged[idx] ? 'active' : '') + '" onclick="toggleFlag()">';
    html += '<svg width="13" height="13" viewBox="0 0 24 24" fill="' + (state.flagged[idx] ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2.2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
    html += (state.flagged[idx] ? 'Flagged' : 'Flag');
    html += '</button></div>';

    // Flashcard
    html += '<div class="flashcard-wrapper card-entering">';
    html += '<div class="flashcard' + (isFlipped ? ' flipped' : '') + '" id="flashcard" onclick="flipCard()">';

    // Front face
    html += '<div class="flashcard-face flashcard-front">';
    html += '<div class="card-face-header">';
    html += '<span class="card-type-badge ' + (isBasic ? 'basic' : 'cloze') + '">' + (isBasic ? 'Basic' : 'Cloze') + '</span>';
    html += '<span class="card-number-badge">C ' + (idx + 1) + ' / ' + SESSION_CARDS.length + '</span>';
    html += '<span class="card-face-label">Front</span>';
    html += '</div>';
    html += '<div class="card-content">' + frontContent + '</div>';
    if (card.tags && card.tags.length) {
      html += '<div class="card-tags">';
      card.tags.forEach(function(tag) {
        html += '<span class="card-tag">' + escapeHTML(tag) + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Back face
    html += '<div class="flashcard-face flashcard-back">';
    html += '<div class="card-face-header">';
    html += '<span class="card-type-badge ' + (isBasic ? 'basic' : 'cloze') + '">' + (isBasic ? 'Basic' : 'Cloze') + '</span>';
    html += '<span class="card-number-badge">C ' + (idx + 1) + ' / ' + SESSION_CARDS.length + '</span>';
    html += '<span class="card-face-label">Back</span>';
    html += '</div>';
    html += '<div class="card-content">' + backContent + '</div>';
    if (card.tags && card.tags.length) {
      html += '<div class="card-tags">';
      card.tags.forEach(function(tag) {
        html += '<span class="card-tag">' + escapeHTML(tag) + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '</div></div>'; // .flashcard, .flashcard-wrapper

    // Cloze reveal buttons (for multi-cloze cards that aren't flipped yet)
    if (isCloze && clozes.length > 1 && !isFlipped) {
      html += '<div class="cloze-reveal-bar">';
      var uniqueClozes = [];
      var seenCNums = {};
      clozes.forEach(function(c) {
        if (!seenCNums[c.cNum]) {
          seenCNums[c.cNum] = true;
          uniqueClozes.push(c);
        }
      });
      uniqueClozes.forEach(function(c) {
        var revealed = state.revealedClozes[idx] && state.revealedClozes[idx].has(c.cNum);
        var colorClass = 'c' + c.cNum;
        html += '<button class="cloze-reveal-btn ' + colorClass + ' ' + (revealed ? 'revealed' : '') + '" onclick="event.stopPropagation();revealCloze(' + c.cNum + ')">';
        html += '<span class="cloze-idx">' + c.cNum + '</span>' + (revealed ? 'Revealed' : 'Reveal c' + c.cNum);
        html += '</button>';
      });
      html += '</div>';
    }
    // Single-cloze or flipped: no button bar, just auto-reveal on flip

    // Rating section (shown after flip via CSS)
    html += '<div class="rating-section' + (isFlipped ? ' visible' : '') + '">';
    html += '<div class="rating-label">How well did you know this?</div>';
    html += '<div class="rating-grid">';
    html += '<button class="rating-btn rate-again" onclick="rateCard(\'again\')"><span class="rating-key">1</span>Again</button>';
    html += '<button class="rating-btn rate-hard" onclick="rateCard(\'hard\')"><span class="rating-key">2</span>Hard</button>';
    html += '<button class="rating-btn rate-good" onclick="rateCard(\'good\')"><span class="rating-key">3</span>Good</button>';
    html += '<button class="rating-btn rate-easy" onclick="rateCard(\'easy\')"><span class="rating-key">4</span>Easy</button>';
    html += '</div></div>';

    // Navigation
    html += '<div class="card-nav-btns">';
    if (idx > 0) html += '<button class="btn-nav" onclick="goTo(' + (idx - 1) + ')">Previous</button>';
    if (!isLast) html += '<button class="btn-nav primary" onclick="nextCard()">Next</button>';
    if (isLast)  html += '<button class="btn-nav submit-btn" onclick="attemptFinish()">Finish Session</button>';
    html += '</div>';

    area.innerHTML = html;
    updateNavGrid(idx);
    updateNavStats();
    area.scrollTop = 0;
    adjustCardHeight();

    // Remove entrance animation class after it plays
    var wrapper = area.querySelector('.flashcard-wrapper');
    if (wrapper) {
      wrapper.addEventListener('animationend', function() {
        wrapper.classList.remove('card-entering');
      }, { once: true });
    }
  }

  /* ── Flip Card ────────────────────────────────────────────── */
  window.flipCard = function() {
    var idx = state.current;
    state.flipped[idx] = !state.flipped[idx];
    debounceSaveProgress();

    var cardEl = document.getElementById('flashcard');
    if (cardEl) {
      if (state.flipped[idx]) {
        cardEl.classList.add('flipped');
      } else {
        cardEl.classList.remove('flipped');
      }
    }

    var ratingSection = document.querySelector('.rating-section');
    if (ratingSection) {
      if (state.flipped[idx]) {
        ratingSection.classList.add('visible');
      } else {
        ratingSection.classList.remove('visible');
      }
    }

    // Recalculate card height to leave room for rating section
    setTimeout(adjustCardHeight, 50);

    var revealBar = document.querySelector('.cloze-reveal-bar');
    if (revealBar) {
      revealBar.style.display = state.flipped[idx] ? 'none' : '';
    }

    updateNavGrid(idx);
    updateNavStats();
  };

  /* ── Reveal Cloze ─────────────────────────────────────────── */
  window.revealCloze = function(cNum) {
    var idx = state.current;
    if (!state.revealedClozes[idx]) state.revealedClozes[idx] = new Set();
    state.revealedClozes[idx].add(cNum);
    debounceSaveProgress();
    renderCard(idx);
  };

  /* ── Rate Card ────────────────────────────────────────────── */
  window.rateCard = function(rating) {
    var idx = state.current;
    state.ratings[idx] = rating;

    var progress = getBankProgress();
    var bankIdx = SESSION_CARD_INDICES[idx];
    progress.ratings[bankIdx] = rating;
    saveBankProgress(progress);

    debounceSaveProgress();
    updateNavGrid(idx);
    updateNavStats();

    if (state.current < SESSION_CARDS.length - 1) {
      setTimeout(function() { nextCard(); }, 300);
    }
  };

  /* ── Navigation ───────────────────────────────────────────── */
  window.nextCard = function() {
    if (state.current < SESSION_CARDS.length - 1) renderCard(state.current + 1);
  };
  window.goTo = function(idx) { renderCard(idx); };

  /* ── Flag ─────────────────────────────────────────────────── */
  window.toggleFlag = function() {
    var idx = state.current;
    state.flagged[idx] = !state.flagged[idx];
    debounceSaveProgress();

    var flagBtns = document.querySelectorAll('.flag-btn');
    flagBtns.forEach(function(btn) {
      if (state.flagged[idx]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      var svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', state.flagged[idx] ? 'currentColor' : 'none');
      var textNode = btn.childNodes[btn.childNodes.length - 1];
      if (textNode && textNode.nodeType === 3) {
        textNode.textContent = state.flagged[idx] ? ' Flagged' : ' Flag';
      }
    });

    updateNavGrid(idx);
    updateNavStats();
    showToast(state.flagged[idx] ? 'Card ' + (idx + 1) + ' flagged' : 'Card ' + (idx + 1) + ' unflagged');
  };

  /* ── Nav Grid ─────────────────────────────────────────────── */
  function buildNavGrid() {
    var grid = document.getElementById('nav-grid');
    grid.innerHTML = SESSION_CARDS.map(function(_, i) {
      return '<button class="nav-btn" id="nav-btn-' + i + '" onclick="goTo(' + i + ')">' + (i + 1) + '</button>';
    }).join('');
  }

  var lastCurrentIdx = -1;

  function updateNavGrid(changedIdx) {
    var updateNode = function(i) {
      if (i < 0 || i >= SESSION_CARDS.length) return;
      var btn = document.getElementById('nav-btn-' + i);
      if (!btn) return;
      var isFlagged = !!state.flagged[i];
      var isCurrent = (i === state.current);
      var isSeen = state.ratings[i] !== undefined;
      btn.className = 'nav-btn' + (isCurrent ? ' current' : isSeen ? ' seen' : '') + (isFlagged && !isCurrent ? ' flagged' : '');

      var existingDot = btn.querySelector('.flag-dot');
      if (isFlagged) {
        if (!existingDot) {
          var dot = document.createElement('span');
          dot.className = 'flag-dot';
          btn.appendChild(dot);
        }
      } else if (existingDot) {
        existingDot.remove();
      }
    };

    if (changedIdx === undefined) {
      SESSION_CARDS.forEach(function(_, i) { updateNode(i); });
    } else {
      var indicesToUpdate = [state.current, lastCurrentIdx];
      if (changedIdx !== null) indicesToUpdate.push(changedIdx);
      indicesToUpdate.forEach(function(i) { updateNode(i); });
    }
    lastCurrentIdx = state.current;
  }

  function updateNavStats() {
    var seen = 0, flagged = 0;
    for (var k in state.ratings) { if (state.ratings.hasOwnProperty(k)) seen++; }
    for (var k in state.flagged) { if (state.flagged[k]) flagged++; }
    document.getElementById('stat-seen').textContent      = seen;
    document.getElementById('stat-flagged-q').textContent = flagged;
    document.getElementById('stat-remaining').textContent = SESSION_CARDS.length - seen;
  }

  /* ── Finish / Submit ──────────────────────────────────────── */
  window.attemptFinish = function() {
    var unrated = SESSION_CARDS.length - Object.keys(state.ratings).length;
    var msg = 'You have ' + unrated + ' card(s) not yet rated.';
    document.getElementById('finish-modal-msg').textContent = unrated > 0
      ? msg + ' Finish session anyway?' : 'Ready to finish your study session?';
    document.getElementById('finish-modal').classList.add('open');
  };

  window.closeFinishModal = function() {
    document.getElementById('finish-modal').classList.remove('open');
  };

  window.confirmFinishAction = function() {
    closeFinishModal();
    if (state.submitted) return;
    state.submitted = true;
    stopTimer();
    clearProgress();
    try { saveTrackerData(); } catch (e) {}
    buildResults();
    showScreen('result-screen');
  };

  /* ── New Session Button ───────────────────────────────────── */
  window.onNewSessionClick = function(event) {
    event.preventDefault();
    showScreen('start-screen');
  };

  /* ── Build Results ────────────────────────────────────────── */
  function buildResults() {
    var total = SESSION_CARDS.length;
    var seenCount = 0, againCount = 0, flaggedCount = 0;
    SESSION_CARDS.forEach(function(_, i) {
      var r = state.ratings[i];
      if (r) {
        seenCount++;
        if (r === 'again') againCount++;
      }
      if (state.flagged[i]) flaggedCount++;
    });

    var pct = Math.round(seenCount / total * 100);
    var em = Math.floor(state.elapsed / 60), es = state.elapsed % 60;
    var timeStr = String(em).padStart(2, '0') + ':' + String(es).padStart(2, '0');

    document.getElementById('res-pct').textContent     = pct + '%';
    document.getElementById('res-seen').textContent    = seenCount;
    document.getElementById('res-flagged').textContent = flaggedCount;
    document.getElementById('res-again').textContent   = againCount;
    document.getElementById('res-time').textContent    = timeStr;

    var grade = '';
    if (pct >= 90)      grade = 'Outstanding!';
    else if (pct >= 75) grade = 'Great Work!';
    else if (pct >= 60) grade = 'Good Effort!';
    else if (pct >= 40) grade = 'Keep Studying!';
    else                grade = 'Don\'t Give Up!';
    document.getElementById('res-grade').textContent = grade;

    renderResultItems('all');
    updateExportBadges();
  }

  function renderResultItems(filter) {
    var list = document.getElementById('result-list');
    list.innerHTML = '';
    var itemsRendered = 0;

    SESSION_CARDS.forEach(function(card, i) {
      var r = state.ratings[i];
      var isSeen = r !== undefined;
      var isFlagged = !!state.flagged[i];
      var isAgain = r === 'again';
      var isSkipped = !isSeen;

      var show = filter === 'all'
        || (filter === 'flagged' && isFlagged)
        || (filter === 'again' && isAgain);
      if (!show) return;

      itemsRendered++;
      var statusClass = isSkipped ? 'skipped' : (isFlagged ? 'flagged' : 'seen');
      var icon = isSkipped ? '-' : (isFlagged ? 'F' : (isAgain ? 'A' : 'OK'));
      var ratingLabel = r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Not rated';

      var frontText, backText;
      if (card.type === 'cloze') {
        frontText = card.text.replace(CLOZE_RE, function(m, c, ans) { return '[c' + c + ': ?]'; });
        backText = card.text.replace(CLOZE_RE, function(m, c, ans) { return ans; });
      } else {
        frontText = card.front || '';
        backText = card.back || '';
      }

      var el = document.createElement('div');
      el.className = 'result-item ' + statusClass;
      el.innerHTML =
        '<div class="result-item-header" onclick="toggleResultItem(this)">' +
          '<div class="result-status-icon">' + icon + '</div>' +
          '<div class="result-q-meta">' +
            '<div class="result-q-num">Card ' + (i + 1) + (isFlagged ? ' - Flagged' : '') + ' - ' + (card.type === 'basic' ? 'Basic' : 'Cloze') + '</div>' +
            '<div class="result-q-text">' + escapeHTML(frontText) + '</div>' +
          '</div>' +
          '<div class="expand-arrow">&#9660;</div>' +
        '</div>' +
        '<div class="result-item-body">' +
          '<div class="answer-row front-side"><span class="ar-label">Front</span><span>' + escapeHTML(frontText) + '</span></div>' +
          '<div class="answer-row back-side"><span class="ar-label">Back</span><span>' + escapeHTML(backText) + '</span></div>' +
          (r ? '<div class="explanation-box"><strong>Your Rating</strong>' + ratingLabel + '</div>' : '') +
        '</div>';
      list.appendChild(el);
    });

    if (itemsRendered === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem;padding:1rem 0;">No cards in this category.</div>';
    }
  }

  window.toggleResultItem = function(header) {
    header.classList.toggle('open');
    header.nextElementSibling.classList.toggle('open');
  };

  window.filterResults = function(filter, btn) {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderResultItems(filter);
  };

  /* ── Export to PDF ──────────────────────────────────────────── */
  window.onExportFilterChange = function(cb) {
    updateExportBadges();
  };

  function updateExportBadges() {
    var total = SESSION_CARDS.length;
    var againCount = 0, flaggedCount = 0;
    SESSION_CARDS.forEach(function(card, i) {
      if (state.ratings[i] === 'again') againCount++;
      if (state.flagged[i]) flaggedCount++;
    });
    document.getElementById('badge-all').textContent = total;
    document.getElementById('badge-again').textContent = againCount;
    document.getElementById('badge-flagged').textContent = flaggedCount;
  }

  window.exportToPDF = function() {
    var allCb     = document.querySelector('input[name="export-all"]');
    var againCb   = document.querySelector('input[name="export-again"]');
    var flaggedCb = document.querySelector('input[name="export-flagged"]');

    var filter = 'all';
    if (!allCb.checked) {
      if (againCb.checked && !flaggedCb.checked)       filter = 'again';
      else if (flaggedCb.checked && !againCb.checked)  filter = 'flagged';
      else if (againCb.checked && flaggedCb.checked)   filter = 'again+flagged';
    }

    showToast('Generating PDF...');

    var total = SESSION_CARDS.length;
    var seenCount = 0, againCount = 0, flaggedCount = 0;
    SESSION_CARDS.forEach(function(card, i) {
      var r = state.ratings[i];
      if (r) { seenCount++; if (r === 'again') againCount++; }
      if (state.flagged[i]) flaggedCount++;
    });
    var pct = Math.round(seenCount / total * 100);
    var em = Math.floor(state.elapsed / 60), es = state.elapsed % 60;
    var timeStr = String(em).padStart(2, '0') + ':' + String(es).padStart(2, '0');

    var filterLabels = {
      'all':           'All Cards',
      'again':         'Again',
      'flagged':       'Flagged',
      'again+flagged': 'Again + Flagged'
    };

    var toExport = [];
    SESSION_CARDS.forEach(function(card, i) {
      var r = state.ratings[i];
      var isAgain = r === 'again';
      var isFlagged = !!state.flagged[i];
      var show = filter === 'all'
        || (filter === 'again'         && isAgain)
        || (filter === 'flagged'       && isFlagged)
        || (filter === 'again+flagged' && (isAgain || isFlagged));
      if (show) toExport.push({ card: card, i: i, r: r, isFlagged: isFlagged });
    });

    var container = document.createElement('div');

    var WRAPPER_OPEN = '<div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:20px;color:#1c1917;">';

    var headerHtml = ''
      + '<h1 style="font-size:22px;margin:0 0 4px;">' + escapeHTML(BANK_CONFIG.title) + '</h1>'
      + '<p style="color:#78716c;margin:0 0 16px;font-size:13px;">Session Report &mdash; ' + new Date().toLocaleDateString() + '</p>'
      + '<div style="background:#f8f6f1;border-radius:12px;padding:18px 20px;margin-bottom:22px;border:1px solid #d0ccc5;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">'
      +   '<div style="width:84px;height:84px;border-radius:50%;border:4px solid #c27803;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;background:rgba(194,120,3,.10);">'
      +     '<div style="font-size:20px;font-weight:700;color:#c27803;line-height:1;">' + pct + '%</div>'
      +     '<div style="font-size:9px;color:#78716c;text-transform:uppercase;letter-spacing:.04em;">Complete</div>'
      +   '</div>'
      +   '<div style="flex:1;min-width:180px;">'
      +     '<h2 style="font-family:Georgia,serif;font-size:17px;margin:0 0 10px;">' + (pct >= 90 ? 'Outstanding!' : pct >= 75 ? 'Great Work!' : pct >= 60 ? 'Good Effort!' : pct >= 40 ? 'Keep Studying!' : 'Don\'t Give Up!') + '</h2>'
      +     '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#16a34a;">' + seenCount + '</div><div style="font-size:10px;color:#78716c;">Seen</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#dc2626;">' + againCount + '</div><div style="font-size:10px;color:#78716c;">Again</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;color:#2563eb;">' + flaggedCount + '</div><div style="font-size:10px;color:#78716c;">Flagged</div></div>'
      +       '<div style="background:#fff;border:1px solid #d0ccc5;border-radius:8px;padding:7px 12px;text-align:center;min-width:62px;"><div style="font-size:16px;font-weight:700;">' + timeStr + '</div><div style="font-size:10px;color:#78716c;">Time</div></div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:0 0 12px;">'
      +   (filterLabels[filter] || 'Cards') + ' (' + toExport.length + ')'
      + '</h3>';

    var cardsPerChunk = 15;
    var currentChunkHtml = headerHtml;
    var headerRendered = false;

    toExport.forEach(function(item, idx) {
      var card = item.card, i = item.i, r = item.r;
      var isFlagged = item.isFlagged;
      var isSeen = r !== undefined;
      var isAgain = r === 'again';
      var sc   = !isSeen ? '#78716c' : (isAgain ? '#dc2626' : '#16a34a');
      var icon = !isSeen ? '-' : (isAgain ? 'A' : 'OK');
      var bgH  = !isSeen ? '#f8f6f1' : (isAgain ? 'rgba(220,38,38,.06)' : 'rgba(22,163,74,.06)');
      var ratingLabel = r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Not rated';

      var frontText, backText;
      if (card.type === 'cloze') {
        frontText = card.text.replace(CLOZE_RE, function(m, cNum, ans) { return '[c' + cNum + ': ___]'; });
        backText = card.text.replace(CLOZE_RE, function(m, cNum, ans) { return ans; });
      } else {
        frontText = card.front || '';
        backText = card.back || '';
      }

      currentChunkHtml += '<div style="border:1.5px solid ' + sc + ';border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">'
        +   '<div style="padding:12px 15px;background:' + bgH + ';">'
        +     '<div style="display:flex;gap:10px;align-items:flex-start;">'
        +       '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + sc + ';">' + icon + '</div>'
        +       '<div>'
        +         '<div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Card ' + (i+1) + (isFlagged ? ' &bull; Flagged' : '') + '</div>'
        +         '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + escapeHTML(frontText) + '</div>'
        +       '</div>'
        +     '</div>'
        +   '</div>'
        +   '<div style="padding:10px 15px 12px;border-top:1px solid #e5e0db;">'
        +     '<div style="background:rgba(22,163,74,.08);border-radius:6px;padding:7px 11px;font-size:12px;"><span style="font-size:10px;text-transform:uppercase;font-weight:700;opacity:.6;margin-right:8px;">Answer</span>' + escapeHTML(backText) + '</div>'
        +     (r ? '<div style="background:#f8f6f1;border-left:3px solid #c27803;border-radius:0 6px 6px 0;padding:9px 11px;font-size:12px;color:#44403c;line-height:1.6;margin-top:7px;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1c1917;margin-right:8px;">Rating</span>' + ratingLabel + '</div>' : '')
        +   '</div>'
        + '</div>';

      if ((idx + 1) % cardsPerChunk === 0 || idx === toExport.length - 1) {
        var chunkDiv = document.createElement('div');
        chunkDiv.innerHTML = WRAPPER_OPEN + currentChunkHtml + '</div>';
        container.appendChild(chunkDiv);
        currentChunkHtml = '';
        headerRendered = true;
      }
    });

    var filename = (BANK_CONFIG.uid || 'flashcard-session').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_report.pdf';
    var opt = {
      margin:      [10, 10, 10, 10],
      filename:    filename,
      image:       { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
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
      s.onload  = runExport;
      s.onerror = function() { showToast('Failed to load PDF library'); };
      document.head.appendChild(s);
    }
  };

  /* ── Confirm Reset (mid-session) ──────────────────────────── */
  window.confirmResetProgress = function() {
    document.getElementById('reset-modal').classList.add('open');
  };
  window.closeResetModal = function() {
    document.getElementById('reset-modal').classList.remove('open');
  };
  window.confirmResetAction = function() {
    stopTimer();
    state.submitted = false;
    state.current = 0;
    state.flipped = {};
    state.flagged = {};
    state.ratings = {};
    state.revealedClozes = {};
    state.elapsed = 0;

    var progress = getBankProgress();
    if (progress.totalSessions > 0) progress.totalSessions--;
    if (SESSION_CARD_INDICES && SESSION_CARD_INDICES.length > 0) {
      var sessionSet = {};
      SESSION_CARD_INDICES.forEach(function(i) { sessionSet[i] = true; });
      progress.shownIndices = progress.shownIndices.filter(function(i) { return !sessionSet[i]; });
    }
    saveBankProgress(progress);
    clearProgress();
    pendingRestoreData = null;
    if (restoreToastTimeout) { clearTimeout(restoreToastTimeout); restoreToastTimeout = null; }
    if (restoreScreenTimeout) { clearTimeout(restoreScreenTimeout); restoreScreenTimeout = null; }

    closeResetModal();
    showScreen('start-screen');
  };

  /* ── Theme ────────────────────────────────────────────────── */
  window.toggleTheme = function() {
    var html = document.documentElement;
    var newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    document.body.style.background = '';
    document.body.style.color = '';
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = newTheme === 'light' ? '#f3f0eb' : '#0d1117';
    localStorage.setItem('flashcard-theme', newTheme);
    updateThemeIcon();
  };

  function updateThemeIcon() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle-btn').forEach(function(b) {
      b.textContent = isDark ? '☀' : '☾';
    });
  }

  /* ── Navigate ─────────────────────────────────────────────── */
  window.navigateToIndex = function(event) {
    event.preventDefault();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'index.html';
    }
  };

  /* ── Toast ────────────────────────────────────────────────── */
  var toastTimer;
  function showToast(msg, actions) {
    actions = actions || [];
    var t = document.getElementById('toast');
    t.innerHTML = '';
    var msgSpan = document.createElement('span');
    msgSpan.textContent = msg;
    msgSpan.style.flex = '1';
    t.appendChild(msgSpan);

    if (actions.length > 0) {
      var actionsContainer = document.createElement('div');
      actionsContainer.style.cssText = 'display:flex;gap:0.5rem;margin-left:0.75rem;';
      actions.forEach(function(action) {
        var btn = document.createElement('button');
        btn.textContent = action.label;
        btn.style.cssText = 'padding:0.35rem 0.75rem;border-radius:6px;border:1px solid var(--border);background:' + (action.primary ? 'var(--accent)' : 'var(--surface2)') + ';color:' + (action.primary ? '#000' : 'var(--text)') + ';font-size:0.75rem;font-weight:600;cursor:pointer;transition:all var(--transition);';
        btn.onclick = function() { action.onClick(); t.classList.remove('show'); };
        actionsContainer.appendChild(btn);
      });
      t.appendChild(actionsContainer);
    }

    t.classList.add('show');
    clearTimeout(toastTimer);
    if (actions.length === 0) {
      toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2200);
    }
  }

  var saveIntervalId = setInterval(saveProgress, 5000);
  window.addEventListener('beforeunload', function() {
    if (!state.submitted) saveProgress();
  });

  window.addEventListener('visibilitychange', function() {
    if (document.hidden && !state.submitted) {
      stopTimer();
    } else if (!document.hidden && !state.submitted && state.timerID === null
               && document.getElementById('study-screen').classList.contains('active')) {
      startTimer();
    }
  });

  /* ── Keyboard Shortcuts ───────────────────────────────────── */
  document.addEventListener('keydown', function(e) {
    if (!document.getElementById('study-screen').classList.contains('active')) return;
    if (state.submitted) return;

    var key = e.key;
    if (key === 'Escape') {
      var kb = document.getElementById('kb-overlay');
      if (kb && kb.classList.contains('visible')) { closeKbHelp(); e.preventDefault(); return; }
      var resetModal = document.getElementById('reset-modal');
      if (resetModal && resetModal.classList.contains('visible')) { closeResetModal(); e.preventDefault(); return; }
    }
    if (key === '/') {
      e.preventDefault();
      openKbHelp();
      return;
    }
    if (key === ' ' || key === 'Enter') {
      e.preventDefault();
      flipCard();
    }
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      e.preventDefault();
      nextCard();
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') {
      e.preventDefault();
      if (state.current > 0) goTo(state.current - 1);
    }
    if (state.flipped[state.current]) {
      if (key === '1') rateCard('again');
      if (key === '2') rateCard('hard');
      if (key === '3') rateCard('good');
      if (key === '4') rateCard('easy');
    }
    if (key === 'f' || key === 'F') toggleFlag();
    if (!state.flipped[state.current] && SESSION_CARDS[state.current].type === 'cloze') {
      var cNum = parseInt(key);
      if (cNum >= 1 && cNum <= 9) revealCloze(cNum);
    }
  });

  /* ── BOOT ─────────────────────────────────────────────────── */
  initUI();
  checkSavedProgress();

  // Service worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(ENGINE_BASE + 'sw.js').catch(function () {});
    });
  }

  // Also register the theme icon update
  window.__updateThemeIcon && window.__updateThemeIcon();

})();
