/* ================================================================
   bank-engine.js  —  Shared engine for all question-bank files.
   Load this after defining BANK_CONFIG and QUESTION_BANK globals.
   ================================================================ */
(function () {
  'use strict';

  var _cs  = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : (window.__QUIZ_ENGINE_BASE || '');

  /* ── Bootstrap: load shared dependencies if not present ─────── */
  if (!window.__EngineCommonLoaded || !window.__TrackerStorageLoaded || !window.__DashUILoaded) {
    var deps = '';
    if (!window.__EngineCommonLoaded) deps += '<script src="' + ENGINE_BASE + 'engine-common.js"><\/script>';
    if (!window.__TrackerStorageLoaded) deps += '<script src="' + ENGINE_BASE + 'tracker-storage.js"><\/script>';
    if (!window.__EngineHighlightsLoaded) deps += '<script src="' + ENGINE_BASE + 'engine-highlights.js"><\/script>';
    if (!window.__DashUILoaded) deps += '<script src="' + ENGINE_BASE + 'dash-ui.js"><\/script>';
    deps += '<script src="' + ENGINE_BASE + 'bank-engine.js"><\/script>';
    document.write(deps);
    return;
  }

  /* ── Dependencies loaded — initialize shared systems ────────── */
  EngineCommon.injectHeadAssets(ENGINE_BASE);
  EngineCommon.initFOUCPrevention();
  EngineCommon.injectSharedCSS();
  EngineCommon.injectAnimationCSS();

  /* ── Bank-specific CSS (shared CSS already injected by EngineCommon) ── */
  var _bankStyle = document.createElement('style');
  _bankStyle.textContent = `/* ═══════════════════════════════════════════
   BANK-SPECIFIC CSS (overrides & additions)
═══════════════════════════════════════════ */
/* Theme button fixed position on bank start screen */
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

/* Start card adjustments for bank */
.start-card h1 { text-align: center; }
.start-card .subtitle { text-align: center; }

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

/* Question count selector */
.q-count-section { margin-bottom: 1.1rem; }

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
`;
  document.head.appendChild(_bankStyle);

  /* ── Bank-specific animation supplements ──────────────────── */
  var _bankAnimStyle = document.createElement('style');
  _bankAnimStyle.textContent = `/* ═══════════════════════════════════════════
   BANK-SPECIFIC ANIMATION SUPPLEMENTS
═══════════════════════════════════════════ */
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

/* ── Stat box hover ────────────────────────────────────────── */
.bank-stat-box, .meta-item {
  transition:
    transform    0.2s var(--ease-out),
    border-color 0.2s var(--ease-out) !important;
}
.bank-stat-box:hover, .meta-item:hover {
  transform   : translateY(-2px);
  border-color: var(--accent) !important;
}
`;
  document.head.appendChild(_bankAnimStyle);

  /* ── Initialize shared UI systems ──────────────────────────── */
  EngineCommon.initToast();
  EngineCommon.initThemeToggle();
  QuizTracker.initRootName(ENGINE_BASE);

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
      <div class="icon-btn hl-mode-btn" role="button" tabindex="0" onclick="toggleHighlighterMode()" title="Highlighter Mode (H)">🖍<span class="hl-last-dot" style="background:rgba(255,213,79,0.8);"></span><div class="hl-color-picker" id="hl-color-picker-1"><button class="hl-color-btn cb-1 selected" onclick="hlSelectColor(1); event.stopPropagation();" title="Yellow (1)"></button><button class="hl-color-btn cb-2" onclick="hlSelectColor(2); event.stopPropagation();" title="Green (2)"></button><button class="hl-color-btn cb-3" onclick="hlSelectColor(3); event.stopPropagation();" title="Blue (3)"></button><button class="hl-color-btn cb-4" onclick="hlSelectColor(4); event.stopPropagation();" title="Red (4)"></button><button class="hl-erase-btn" onclick="hlSelectColor(0); event.stopPropagation();" title="Eraser">🧹</button><button class="hl-close-btn" onclick="disableHighlighterMode(); event.stopPropagation();" title="Close Highlighter">✕</button></div></div>
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
      <div class="icon-btn hl-mode-btn" role="button" tabindex="0" onclick="toggleHighlighterMode()" title="Highlighter Mode (H)">🖍<span class="hl-last-dot" style="background:rgba(255,213,79,0.8);"></span><div class="hl-color-picker" id="hl-color-picker-2"><button class="hl-color-btn cb-1 selected" onclick="hlSelectColor(1); event.stopPropagation();" title="Yellow (1)"></button><button class="hl-color-btn cb-2" onclick="hlSelectColor(2); event.stopPropagation();" title="Green (2)"></button><button class="hl-color-btn cb-3" onclick="hlSelectColor(3); event.stopPropagation();" title="Blue (3)"></button><button class="hl-color-btn cb-4" onclick="hlSelectColor(4); event.stopPropagation();" title="Red (4)"></button><button class="hl-erase-btn" onclick="hlSelectColor(0); event.stopPropagation();" title="Eraser">🧹</button><button class="hl-close-btn" onclick="disableHighlighterMode(); event.stopPropagation();" title="Close Highlighter">✕</button></div></div>
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
      <button class="btn-restart" onclick="onNewSessionClick(event)">↺ New Session</button>
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

<!-- Reset Confirm Modal -->
<div class="modal-overlay" id="reset-modal">
  <div class="modal">
    <h3>Reset Progress?</h3>
    <p>Are you sure you want to reset your progress? This cannot be undone.</p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeResetModal()">Go Back</button>
      <button class="btn-confirm danger" onclick="confirmResetAction()">Reset Now</button>
    </div>
  </div>
</div>

  <!-- toast element handled by EngineCommon -->

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
var KEYS = EngineCommon.KEYS;

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
  highlights: {},  // { qIndex: [ { part, start, end, color, optIndex? } ] } — uses GLOBAL bank index
  strikethrough: {}, // { qIndex: { optIndex: true } } — uses GLOBAL bank index
  isHighlighterMode: false,
  timerSecs: 0,
  elapsed:   0,
  timerID:   null,
  submitted: false,
  mode:      'exam',
};
let timerPaused = false;
let lastTime = Date.now();
// flag to prevent double-toggle (mousedown + contextmenu)
let submitTimeout = null;  // tracks the setTimeout(confirmSubmit) from timer expiry

/* -- HIGHLIGHT & STRIKETHROUGH SYSTEM ----------------------------
   Extracted to engine-highlights.js for shared use with bank-engine.
   NOTE: qIndex in highlights/strikethrough uses GLOBAL bank index
   (SESSION_QUESTION_INDICES[sessionIdx]) so highlights persist
   across different randomized sessions.
   -------------------------------------------------------------- */
function _hlGlobalIdx(sessionIdx) {
  return SESSION_QUESTION_INDICES[sessionIdx];
}
EngineHighlights.init(state, {
  indexResolver: function(idx) { return _hlGlobalIdx(idx); },
  questionsGetter: function() { return SESSION_QUESTIONS; },
  renderFn: function(idx) { renderQuestion(idx); },
  saveFn: function() { saveProgress(); }
});

/* --- SESSION PROGRESS STORAGE ─────────────────────────────────────
   Tracks quiz session progress (answers, flags, timer) across page reloads.
   Uses same pattern as misc-mcq.html for consistency.
──────────────────────────────────────────────────────────────── */
const STORAGE_VERSION = 'v1';
const STORAGE_KEY = `quiz_progress_${STORAGE_VERSION}_${(BANK_CONFIG.uid || window.location.pathname).replace(/[^a-zA-Z0-9]/g, '_')}`;
let pendingRestoreData = null;
let restoreToastTimeout = null;
let restoreScreenTimeout = null;  // tracks the setTimeout inside doRestoreProgress
let pendingTransitionTimeout = null;  // tracks screen transition timeouts to prevent race conditions

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
  const hasHighlights = Object.keys(state.highlights || {}).length > 0;
  const hasStrikethrough = Object.keys(state.strikethrough || {}).length > 0;
  if (!hasAnswers && !hasFlags && !hasTime && !hasHighlights && !hasStrikethrough) return;

  const saveData = {
    version: STORAGE_VERSION,
    quizTitle: BANK_CONFIG.title,
    totalQuestions: SESSION_QUESTIONS.length,
    questionCount: selectedCount, // Store the selected question count for validation
    sessionIndices: SESSION_QUESTION_INDICES, // Exact bank indices — lets restore skip re-selection
    current: state.current,
    answers: state.answers,
    flagged: state.flagged,
    highlights: state.highlights,
    strikethrough: state.strikethrough,
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
  // highlights and strikethrough are optional for backward compatibility
  if (data.highlights && typeof data.highlights !== 'object') return false;
  if (data.strikethrough && typeof data.strikethrough !== 'object') return false;
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
  state.highlights = data.highlights || {};
  state.strikethrough = data.strikethrough || {};
  state.elapsed = data.elapsed || 0;
  // In learning mode, timerSecs is irrelevant (count-up uses elapsed only)
  // Only restore timerSecs for exam mode to avoid confusion
  state.timerSecs = (data.mode === 'learning') ? 0 : (data.timerSecs || 0);
  state.mode = data.mode;
  state.submitted = false;

  if (restoreScreenTimeout) clearTimeout(restoreScreenTimeout);
  restoreScreenTimeout = setTimeout(() => {
    restoreScreenTimeout = null;
    // Set CSS variable for portrait nav grid (same as startQuiz does)
    document.documentElement.style.setProperty('--q-count', SESSION_QUESTIONS.length);

    document.getElementById('timer-display').classList.remove('hidden');
    showScreen('quiz-screen');
    buildNavGrid();
    renderQuestion(state.current);
    updateTimerDisplay();
    startTimer();
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
  const progress = getBankProgress();
  
  const allIndices = Array.from({ length: bankSize }, (_, i) => i);
  let unshown = allIndices.filter(i => !progress.shownIndices.includes(i));
  
  // Cap count to remaining questions in current cycle
  const maxAllowed = unshown.length > 0 ? unshown.length : bankSize;
  const n = Math.min(count, maxAllowed);
  
  let picked;
  
  if (unshown.length === 0) {
    // All questions have been shown — start a new coverage cycle
    progress.cycleCount++;
    progress.shownIndices = [];
    unshown = [...allIndices];
    saveBankProgress(progress);
    showToast(`🎉 Full cycle complete! Starting fresh — cycle ${progress.cycleCount + 1}`);
    picked = order === 'sequential'
      ? unshown.sort((a, b) => a - b).slice(0, n)
      : shuffle(unshown).slice(0, n);
  } else {
    // Sequential: pick next N questions in original bank order (no shuffle)
    // Random: shuffle then pick N for fair random coverage
    picked = order === 'sequential'
      ? unshown.sort((a, b) => a - b).slice(0, n)
      : shuffle(unshown).slice(0, n);
  }

  // Update shown indices — use Set for dedup to handle edge cases
  progress.shownIndices = [...new Set([...progress.shownIndices, ...picked])];
  progress.totalSessions++;
  saveBankProgress(progress);

  SESSION_QUESTION_INDICES = picked;
  return picked.map(i => QUESTION_BANK[i]);
}
function updateStartScreenStats() {
  const progress = getBankProgress();
  const bankSize = QUESTION_BANK.length;
  const covered  = progress.shownIndices.length;
  const pct      = bankSize > 0 ? Math.round(covered / bankSize * 100) : 0;
  const remaining = bankSize - covered;

  // If cycle is complete (100% coverage), automatically reset for new cycle
  if (pct === 100 && covered > 0) {
    progress.cycleCount++;
    progress.shownIndices = [];
    saveBankProgress(progress);
    showToast(`🎉 Full cycle complete! Starting fresh — cycle ${progress.cycleCount + 1}`);
    // Refresh progress values after reset
    const newCovered = 0;
    const newRemaining = bankSize;
    
    document.getElementById('stat-covered').textContent  = newCovered;
    document.getElementById('stat-total').textContent    = bankSize;
    document.getElementById('stat-sessions').textContent = progress.totalSessions;
    document.getElementById('coverage-fill').style.width = '0%';
    document.getElementById('coverage-pct').textContent  = '0%';
    
    // Reset input for fresh cycle
    const inp = document.getElementById('q-count-input');
    selectedCount = Math.min(selectedCount || 20, bankSize);
    inp.value = selectedCount;
    inp.max = newRemaining;
    inp.placeholder = newRemaining;
    
    // Update the +5 button
    const plusBtn = inp.parentElement.querySelector('.time-adj-btn:last-child');
    if (plusBtn) {
      plusBtn.textContent = '+5';
      plusBtn.disabled = false;
      plusBtn.style.opacity = '';
    }
    return;
  }

  document.getElementById('stat-covered').textContent  = covered;
  document.getElementById('stat-total').textContent    = bankSize;
  document.getElementById('stat-sessions').textContent = progress.totalSessions;
  document.getElementById('coverage-fill').style.width = pct + '%';
  document.getElementById('coverage-pct').textContent  = pct + '%';

  // Cap the question count input to remaining questions in current cycle
  const inp = document.getElementById('q-count-input');
  const currentVal = parseInt(inp.value) || selectedCount || 20;
  // Always cap to remaining questions
  const maxAllowed = remaining;
  inp.max = maxAllowed;
  inp.placeholder = maxAllowed;
  
  // Reset selectedCount to maxAllowed when cycle is complete to ensure user can select any number
  if (covered === 0) {
    // Fresh cycle - reset to default or keep user's last preference if within range
    selectedCount = Math.min(selectedCount || 20, bankSize);
    inp.value = selectedCount;
  } else if (currentVal > maxAllowed) {
    inp.value = maxAllowed;
    selectedCount = maxAllowed;
  }
  
  // Update the +5 button behavior based on remaining questions
  const plusBtn = inp.parentElement.querySelector('.time-adj-btn:last-child');
  if (plusBtn) {
    plusBtn.textContent = currentVal >= maxAllowed ? 'max' : '+5';
    plusBtn.disabled = currentVal >= maxAllowed;
    plusBtn.style.opacity = currentVal >= maxAllowed ? '0.4' : '';
  }
}

function adjustCount(delta) {
  const inp = document.getElementById('q-count-input');
  const bankSize = QUESTION_BANK.length;
  const progress = getBankProgress();
  const remaining = Math.max(1, bankSize - progress.shownIndices.length);
  // Always cap to remaining questions
  const maxAllowed = remaining;
  
  const cur = parseInt(inp.value) || selectedCount || 20;
  const newVal = Math.max(1, Math.min(maxAllowed, cur + delta));
  inp.value = newVal;
  selectedCount = newVal;
  autoSetTime(newVal);

  // Update +5 button state based on remaining questions
  const plusBtn = inp.parentElement.querySelector('.time-adj-btn:last-child');
  if (plusBtn) {
    plusBtn.textContent = newVal >= maxAllowed ? 'max' : '+5';
    plusBtn.disabled = newVal >= maxAllowed;
    plusBtn.style.opacity = newVal >= maxAllowed ? '0.4' : '';
  }

  // Only clear saved progress when user actively changes the count (not during init)
  if (uiReady) clearProgress();
}

function setCount(n) {
  const bankSize = QUESTION_BANK.length;
  const progress = getBankProgress();
  const remaining = Math.max(1, bankSize - progress.shownIndices.length);
  // Always cap to remaining questions
  const maxAllowed = remaining;
  
  if (n === -1) n = maxAllowed; // "All" = all remaining questions in current cycle
  n = Math.max(1, Math.min(n, maxAllowed));
  selectedCount = n;

  document.getElementById('q-count-input').value = n;
  autoSetTime(n);

  // Update +5 button state based on remaining questions
  const inp = document.getElementById('q-count-input');
  const plusBtn = inp.parentElement.querySelector('.time-adj-btn:last-child');
  if (plusBtn) {
    plusBtn.textContent = n >= maxAllowed ? 'max' : '+5';
    plusBtn.disabled = n >= maxAllowed;
    plusBtn.style.opacity = n >= maxAllowed ? '0.4' : '';
  }

  // Only clear saved progress when user actively changes the count (not during init)
  if (uiReady) clearProgress();
}

function onCustomCount(val) {
  const bankSize = QUESTION_BANK.length;
  const progress = getBankProgress();
  const remaining = Math.max(1, bankSize - progress.shownIndices.length);
  // Always cap to remaining questions
  const maxAllowed = remaining;
  
  let n = parseInt(val) || 1;
  n = Math.max(1, Math.min(n, maxAllowed));
  selectedCount = n;
  
  const inp = document.getElementById('q-count-input');
  inp.value = n;
  autoSetTime(n);

  // Update +5 button state based on remaining questions
  const plusBtn = inp.parentElement.querySelector('.time-adj-btn:last-child');
  if (plusBtn) {
    plusBtn.textContent = n >= maxAllowed ? 'max' : '+5';
    plusBtn.disabled = n >= maxAllowed;
    plusBtn.style.opacity = n >= maxAllowed ? '0.4' : '';
  }

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
  const progress = getBankProgress();
  
  // Check if cycle is complete (100% coverage) on initial load and auto-reset
  const covered = progress.shownIndices.length;
  const pct = bankSize > 0 ? Math.round(covered / bankSize * 100) : 0;
  if (pct === 100 && covered > 0) {
    progress.cycleCount++;
    progress.shownIndices = [];
    saveBankProgress(progress);
    showToast(`🎉 Full cycle complete! Starting fresh — cycle ${progress.cycleCount + 1}`);
  }
  
  const remaining = Math.max(1, bankSize - progress.shownIndices.length);
  const capCount = document.getElementById('q-count-input');

  // Set max to remaining questions (or bank size if all covered)
  capCount.max = remaining;
  capCount.placeholder = remaining;

  // Default count
  const defaultCount = Math.min(20, remaining);
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
  let count = selectedCount;

  // Clear any existing saved progress before starting a new session
  clearProgress();

  // Select questions from bank — sequential picks next N in bank order, random shuffles
  // This function automatically starts a new cycle if all questions have been shown
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

  document.getElementById('timer-display').classList.remove('hidden');

  if (mode === 'learning') {
    document.getElementById('legend-text-answered').textContent = 'Correct';
    document.getElementById('legend-wrong').style.display = 'flex';
  } else {
    document.getElementById('legend-text-answered').textContent = 'Answered';
    document.getElementById('legend-wrong').style.display = 'none';
  }

  buildNavGrid();
  renderQuestion(0);
  startTimer();
}

/* ─── SCREEN MANAGER ─────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    // Clean up stale inline opacity left by the screen-transition wrapper
    // so returning to this screen later doesn't render it invisible
    if (s.style.opacity === '0') s.style.opacity = '';
  });
  const target = document.getElementById(id);
  // Clear any lingering inline opacity on the target screen itself
  if (target.style.opacity === '0') target.style.opacity = '';
  // Force animation restart by removing and re-adding the class with a reflow
  target.classList.add('active');
  target.style.animation = 'none';
  target.offsetHeight; /* trigger reflow */
  target.style.animation = '';
  
  // Also restart animations on start-card if showing start screen
  if (id === 'start-screen') {
    const startCard = target.querySelector('.start-card');
    if (startCard) {
      startCard.style.animation = 'none';
      startCard.offsetHeight; /* trigger reflow */
      startCard.style.animation = '';
      
      const startIcon = target.querySelector('.start-icon');
      if (startIcon) {
        startIcon.style.animation = 'none';
        startIcon.offsetHeight; /* trigger reflow */
        startIcon.style.animation = '';
      }
    }
  }
  
  if (id === 'start-screen') updateStartScreenStats();
}

/* ─── TIMER ──────────────────────────────────────────────────── */
function startTimer() {
  if (state.timerID) clearInterval(state.timerID);
  timerPaused = false;
  lastTime = Date.now();
  state.timerID = setInterval(() => {
    if (!timerPaused && (state.timerSecs > 0 || state.mode === 'learning')) {
      const now = Date.now();
      const delta = Math.floor((now - lastTime) / 1000);
      if (delta >= 1) {
        state.elapsed   += delta;
        lastTime = now;
        // In exam mode, count down the timer
        if (state.mode !== 'learning') {
          state.timerSecs -= delta;
          if (state.timerSecs <= 0) {
            state.timerSecs = 0;
            stopTimer();
            showToast("⏰ Time's up! Submitting…");
            submitTimeout = setTimeout(confirmSubmit, 1500);
          }
        }
        updateTimerDisplay();
      }
    }
  }, 100);
}

function stopTimer() {
  if (state.timerID) { clearInterval(state.timerID); state.timerID = null; }
  if (submitTimeout) { clearTimeout(submitTimeout); submitTimeout = null; }
  timerPaused = true;
}

function updateTimerDisplay() {
  // In learning mode show elapsed (count-up), in exam mode show remaining (countdown)
  const secs = state.mode === 'learning'
    ? (state.elapsed || 0)
    : Math.max(0, state.timerSecs || 0);
  const m = Math.floor(secs / 60), s = secs % 60;
  document.getElementById('timer-text').textContent =
    String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  const el = document.getElementById('timer-display');
  // Warning state only in exam mode when time is low
  if (state.mode !== 'learning' && secs < 120) {
    el.classList.add('warn');
  } else {
    el.classList.remove('warn');
  }
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
        ${state.isHighlighterMode && state.highlights[_hlGlobalIdx(idx)] && state.highlights[_hlGlobalIdx(idx)].length > 0 ? '<button class="flag-btn" onclick="clearAllHighlights('+idx+')" title="Clear all highlights for this question" style="font-size:0.75rem;">✕ Clear</button>' : ''}
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
          <label class="option-label" for="opt_${i}" data-opt-idx="${i}" style="${extra}">
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

  // Apply highlights & strikethrough after DOM is built
  EngineHighlights.invalidateCache(_hlGlobalIdx(idx));  // DOM is fresh, must re-apply
  EngineHighlights.applyBulkHighlights(idx);
}

/* ─── ANSWER SELECTION ───────────────────────────────────────── */
function selectAnswer(qIdx, optIdx) {
  if (state.mode === 'learning' && state.answers[qIdx] !== undefined) return;
  state.answers[qIdx] = optIdx;
  updateNavGrid();
  updateNavStats();
  // In learning mode: re-render to show explanation and highlights
  if (state.mode === 'learning') {
    renderQuestion(qIdx);  // renderQuestion also updates progress
    return;
  }
  // Update progress bar (non-learning mode)
  var done = 0;
  for (var k in state.answers) { if (state.answers.hasOwnProperty(k)) done++; }
  document.getElementById('progress-fill').style.width = (done / SESSION_QUESTIONS.length * 100) + '%';
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
    var isFlagged = !!state.flagged[i];
    var isCurrent = (i === state.current);
    var isAnswered = state.answers[i] !== undefined;
    var isWrong = isAnswered && state.mode === 'learning' && state.answers[i] !== SESSION_QUESTIONS[i].correct;
    btn.className = 'nav-btn' + (isCurrent ? ' current' : isWrong ? ' wrong' : isAnswered ? ' answered' : '') + (isFlagged && !isCurrent ? ' flagged' : '');

    // Flag dot — reuse existing if possible
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
  });
}

function updateNavStats() {
  var answered = 0, flagged = 0;
  for (var k in state.answers) { if (state.answers.hasOwnProperty(k)) answered++; }
  for (var k in state.flagged) { if (state.flagged[k]) flagged++; }
  document.getElementById('stat-answered').textContent  = answered;
  document.getElementById('stat-flagged-q').textContent = flagged;
  document.getElementById('stat-skipped').textContent   = SESSION_QUESTIONS.length - answered;
}

/* ─── SUBMIT ─────────────────────────────────────────────────── */
function attemptSubmit() {
  // Cancel any pending auto-submit from timer expiry to prevent double submission
  if (submitTimeout) { clearTimeout(submitTimeout); submitTimeout = null; }

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
  // Guard against double submission (race condition: timer expiry + user click)
  if (state.submitted) return;
  state.submitted = true;  // Set flag FIRST to close the re-entry window immediately
  clearInterval(saveIntervalId);
  if (pendingTransitionTimeout) {
    clearTimeout(pendingTransitionTimeout);
    pendingTransitionTimeout = null;
  }
  closeModal();
  stopTimer();
  saveTrackerData();

  // Clear saved progress — session is done, no restore needed
  clearProgress();

  buildResults();
  showScreen('result-screen');
}

/* ─── NEW SESSION BUTTON ─────────────────────────────────────── */
function onNewSessionClick(event) {
  event.preventDefault();
  
  // Check if bank coverage is 100% (cycle complete)
  const progress = getBankProgress();
  const bankSize = QUESTION_BANK.length;
  const covered = progress.shownIndices.length;
  const pct = bankSize > 0 ? Math.round(covered / bankSize * 100) : 0;
  
  // If cycle is complete (100% coverage), show the completed cycle toast
  if (pct === 100) {
    // Reset to start a fresh cycle
    progress.cycleCount++;
    progress.shownIndices = [];
    saveBankProgress(progress);
    showToast(`🎉 Full cycle complete! Starting fresh — cycle ${progress.cycleCount + 1}`);
    // Navigate to start screen where user can choose any number of questions
    showScreen('start-screen');
    return;
  }
  
  // For incomplete cycles, just navigate to start screen
  showScreen('start-screen');
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
  document.getElementById('reset-modal').classList.add('open');
}

function closeResetModal() {
  document.getElementById('reset-modal').classList.remove('open');
}

function confirmResetAction() {
  clearInterval(saveIntervalId);
  stopTimer();
  state.submitted = false;
  state.current = 0;
  state.answers = {};
  state.flagged = {};
  state.highlights = {};
  state.strikethrough = {};
  state.isHighlighterMode = false;
  _hlCache = {};
  document.body.classList.remove('highlighter-active');
  document.querySelectorAll('.hl-mode-btn').forEach(function(b) { b.classList.remove('active'); });
  state.elapsed = 0;

  // Decrement session counter and remove shown indices so reset doesn't count toward bank progress
  const progress = getBankProgress();
  if (progress.totalSessions > 0) {
    progress.totalSessions--;
  }
  // Remove the current session's questions from shown indices
  if (SESSION_QUESTION_INDICES && SESSION_QUESTION_INDICES.length > 0) {
    const sessionSet = new Set(SESSION_QUESTION_INDICES);
    progress.shownIndices = progress.shownIndices.filter(i => !sessionSet.has(i));
  }
  saveBankProgress(progress);

  // Clear saved progress when manually resetting
  clearProgress();

  // Clear all pending async actions that could steal the screen
  pendingRestoreData = null;
  if (restoreToastTimeout) {
    clearTimeout(restoreToastTimeout);
    restoreToastTimeout = null;
  }
  if (restoreScreenTimeout) {
    clearTimeout(restoreScreenTimeout);
    restoreScreenTimeout = null;
  }

  closeResetModal();
  showScreen('start-screen');
}

/* toggleTheme handled by EngineCommon */
/* updateThemeIcon handled by EngineCommon */

/* ─── NAVIGATE ───────────────────────────────────────────────── */
function navigateToIndex(event) {
  event.preventDefault();
  // Always navigate to index.html to prevent history.back() loops
  // within the quiz flow (start → quiz → results → back would bounce)
  window.location.href = 'index.html';
}

/* showToast handled by EngineCommon */

// Auto-save every 5 seconds
let saveIntervalId = setInterval(saveProgress, 5000);

// Save progress before page unload (tab close, refresh, navigation)
window.addEventListener('beforeunload', function() {
  if (!state.submitted) {
    saveProgress();
  }
});

/* ─── VISIBILITY CHANGE ──────────────────────────────────────── */
// Pause timer when user leaves the page/tab, resume when they come back
window.addEventListener('visibilitychange', () => {
  if (document.hidden && !state.submitted) {
    stopTimer();
  } else if (!document.hidden && !state.submitted && state.timerID === null
             && document.getElementById('quiz-screen').classList.contains('active')) {
    // Only restart the interval if the quiz screen is actually showing
    startTimer();
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
    var gIdx = SESSION_QUESTION_INDICES[i];
    var stMap = (gIdx !== undefined && state.strikethrough[gIdx]) || {};
    var uAns = ans !== undefined ? (KEYS[ans] + '. ' + (stMap[ans] ? '<span style="text-decoration:line-through;opacity:0.5;">' + q.options[ans] + '</span>' : q.options[ans])) : 'Not answered';
    var cAns = KEYS[q.correct] + '. ' + (stMap[q.correct] ? '<span style="text-decoration:line-through;opacity:0.5;">' + q.options[q.correct] + '</span>' : q.options[q.correct]);
    html += '<div style="border:1.5px solid ' + sc + ';border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">'
      +   '<div style="padding:12px 15px;background:' + bgH + ';">'
      +     '<div style="display:flex;gap:10px;align-items:flex-start;">'
      +       '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + sc + ';">' + icon + '</div>'
      +       '<div>'
      +         '<div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Q' + (i+1) + (isFlagged ? ' &bull; Flagged' : '') + '</div>'
      +         '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + EngineHighlights.hlToPDFHTML(q.question, (gIdx !== undefined && state.highlights[gIdx]) || [], 'question') + '</div>'
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
   TRACKER — saveTrackerData using QuizTracker API
   ================================================================ */
window.saveTrackerData = function() {
  try {
    var cfg = (typeof QUIZ_CONFIG !== 'undefined' && QUIZ_CONFIG)
      || (typeof BANK_CONFIG !== 'undefined' && BANK_CONFIG)
      || { uid: location.pathname, title: document.title };
    var qs  = (typeof SESSION_QUESTIONS !== 'undefined' && SESSION_QUESTIONS && SESSION_QUESTIONS.length)
      ? SESSION_QUESTIONS
      : (typeof QUESTIONS !== 'undefined' ? QUESTIONS : []);
    if (!qs.length) return;

    var wrongQs = [], flaggedQs = [];
    var currentSessionIndices = {};
    var currentSessionTexts = {};
    var hasGlobalIndices = (typeof SESSION_QUESTION_INDICES !== 'undefined' && SESSION_QUESTION_INDICES);
    
    qs.forEach(function(q, i) {
      var ans = state.answers[i];
      var isWrong   = ans !== undefined && ans !== q.correct;
      var isFlagged = state.flagged && state.flagged[i];

      // Determine the global index
      var qIdx = hasGlobalIndices ? SESSION_QUESTION_INDICES[i] : (q.idx !== undefined ? q.idx : i);
      
      // Track by index if we have global indices, otherwise track by text
      if (hasGlobalIndices || q.idx !== undefined) {
        currentSessionIndices[qIdx] = true;
      } else {
        currentSessionTexts[q.question] = true;
      }

      var qData = {
        idx: qIdx,
        text: q.question,
        yourAnswer:   ans !== undefined ? KEYS[ans] + '. ' + q.options[ans] : 'Not answered',
        correctAnswer: KEYS[q.correct] + '. ' + q.options[q.correct],
        explanation: q.explanation || ''
      };
      if (isWrong)   wrongQs.push(qData);
      if (isFlagged) flaggedQs.push(qData);
    });

    var storageKey = QuizTracker.getStorageKey(cfg.uid || location.pathname);
    var existingRaw = localStorage.getItem(storageKey);
    var existingData = existingRaw ? JSON.parse(existingRaw) : null;

    // Merge with existing data to ensure we don't overwrite previous sessions
    if (existingData) {
      var oldWrong = (existingData.wrong || []).filter(function(wq) {
        if (hasGlobalIndices || wq.idx !== undefined) {
          return !currentSessionIndices[wq.idx];
        } else {
          return !currentSessionTexts[wq.text];
        }
      });
      var oldFlagged = (existingData.flagged || []).filter(function(fq) {
        if (hasGlobalIndices || fq.idx !== undefined) {
          return !currentSessionIndices[fq.idx];
        } else {
          return !currentSessionTexts[fq.text];
        }
      });
      wrongQs = oldWrong.concat(wrongQs);
      flaggedQs = oldFlagged.concat(flaggedQs);
    }

    if (!wrongQs.length && !flaggedQs.length) {
       localStorage.removeItem(storageKey);
       var keys = JSON.parse(localStorage.getItem(QuizTracker.KEYS_LIST_KEY) || '[]');
       localStorage.setItem(QuizTracker.KEYS_LIST_KEY, JSON.stringify(keys.filter(function(k) { return k !== (cfg.uid || location.pathname); })));
       QuizTracker.updateDashboardBadge();
       return;
    }

    var folderPath = QuizTracker.computeFolderPath(ENGINE_BASE);

    var data = {
      uid:         cfg.uid || location.pathname,
      title:       cfg.title || document.title,
      timestamp:   Date.now(),
      totalQs:     typeof QUESTION_BANK !== 'undefined' ? QUESTION_BANK.length : (existingData ? Math.max(existingData.totalQs || 0, qs.length) : qs.length),
      wrongCount:  wrongQs.length,
      flaggedCount: flaggedQs.length,
      wrong:       wrongQs,
      flagged:     flaggedQs,
      path:        location.pathname,
      folderPath:  folderPath
    };

    // Try to fetch folder title and save it with the data
    QuizTracker.fetchFolderTitle(folderPath, ENGINE_BASE).then(function(folderTitle) {
      if (folderTitle) data.folderTitle = folderTitle;
      localStorage.setItem(QuizTracker.getStorageKey(data.uid), JSON.stringify(data));

      var keys = JSON.parse(localStorage.getItem(QuizTracker.KEYS_LIST_KEY) || '[]');
      if (keys.indexOf(data.uid) === -1) { keys.push(data.uid); }
      localStorage.setItem(QuizTracker.KEYS_LIST_KEY, JSON.stringify(keys));

      QuizTracker.updateDashboardBadge();
    }).catch(function() {
      // Save without folder title if fetch fails
      localStorage.setItem(QuizTracker.getStorageKey(data.uid), JSON.stringify(data));
      var keys = JSON.parse(localStorage.getItem(QuizTracker.KEYS_LIST_KEY) || '[]');
      if (keys.indexOf(data.uid) === -1) { keys.push(data.uid); }
      localStorage.setItem(QuizTracker.KEYS_LIST_KEY, JSON.stringify(keys));
      QuizTracker.updateDashboardBadge();
    });
  } catch (e) { console.error('Tracker save error:', e); }
};

/* ── Init badge on load ── */
QuizTracker.updateDashboardBadge();

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
  background: rgba(0,0,0,0.65);
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
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">←</span><span class="kb-key">→</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Previous / Next question</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">F</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Toggle flag</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">H</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Toggle highlighter mode</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">1</span><span class="kb-key">2</span><span class="kb-key">3</span><span class="kb-key">4</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Highlight color (Yellow / Green / Blue / Red)</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">S</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Strikethrough (highlighter mode)</div>';
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
        var target = document.getElementById(id);
        // Don't animate if already on the same screen or no current screen
        if (current === target || !current) {
          _origShowScreen(id);
          return;
        }
        current.style.opacity = '0';
        setTimeout(function () {
          current.classList.remove('active');
          current.style.opacity = ''; // clean up so returning later works
          _origShowScreen(id);
        }, 150);
      };
    }
  })();


window.__HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
