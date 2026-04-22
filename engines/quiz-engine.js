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

  /* ── Bootstrap: load shared dependencies if not present ─────── */
  if (!window.__EngineCommonLoaded || !window.__TrackerStorageLoaded || !window.__DashUILoaded) {
    var deps = '';
    if (!window.__EngineCommonLoaded) deps += '<script src="' + ENGINE_BASE + 'engine-common.js"><\/script>';
    if (!window.__TrackerStorageLoaded) deps += '<script src="' + ENGINE_BASE + 'tracker-storage.js"><\/script>';
    if (!window.__EngineHighlightsLoaded) deps += '<script src="' + ENGINE_BASE + 'engine-highlights.js"><\/script>';
    if (!window.__DashUILoaded) deps += '<script src="' + ENGINE_BASE + 'dash-ui.js"><\/script>';
    deps += '<script src="' + ENGINE_BASE + 'quiz-engine.js"><\/script>';
    document.write(deps);
    return;
  }

  /* ── Dependencies loaded — initialize shared systems ────────── */
  EngineCommon.injectHeadAssets(ENGINE_BASE);
  EngineCommon.initFOUCPrevention();
  EngineCommon.injectSharedCSS();
  EngineCommon.injectAnimationCSS();

  /* ── Build DOM ───────────────────────────────────────────────── */
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
      <div class="icon-btn hl-mode-btn" role="button" tabindex="0" onclick="toggleHighlighterMode()" title="Highlighter Mode (H)">🖍<span class="hl-last-dot" style="background:rgba(255,213,79,0.8);"></span><div class="hl-color-picker" id="hl-color-picker-1"><button class="hl-color-btn cb-1 selected" onclick="hlSelectColor(1); event.stopPropagation();" title="Yellow (1)"></button><button class="hl-color-btn cb-2" onclick="hlSelectColor(2); event.stopPropagation();" title="Green (2)"></button><button class="hl-color-btn cb-3" onclick="hlSelectColor(3); event.stopPropagation();" title="Blue (3)"></button><button class="hl-color-btn cb-4" onclick="hlSelectColor(4); event.stopPropagation();" title="Red (4)"></button><button class="hl-erase-btn" onclick="hlSelectColor(0); event.stopPropagation();" title="Eraser">🧹</button><button class="hl-close-btn" onclick="disableHighlighterMode(); event.stopPropagation();" title="Close Highlighter">✕</button></div></div>
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
      <div class="icon-btn hl-mode-btn" role="button" tabindex="0" onclick="toggleHighlighterMode()" title="Highlighter Mode (H)">🖍<span class="hl-last-dot" style="background:rgba(255,213,79,0.8);"></span><div class="hl-color-picker" id="hl-color-picker-2"><button class="hl-color-btn cb-1 selected" onclick="hlSelectColor(1); event.stopPropagation();" title="Yellow (1)"></button><button class="hl-color-btn cb-2" onclick="hlSelectColor(2); event.stopPropagation();" title="Green (2)"></button><button class="hl-color-btn cb-3" onclick="hlSelectColor(3); event.stopPropagation();" title="Blue (3)"></button><button class="hl-color-btn cb-4" onclick="hlSelectColor(4); event.stopPropagation();" title="Red (4)"></button><button class="hl-erase-btn" onclick="hlSelectColor(0); event.stopPropagation();" title="Eraser">🧹</button><button class="hl-close-btn" onclick="disableHighlighterMode(); event.stopPropagation();" title="Close Highlighter">✕</button></div></div>
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

<!-- ═══════════════ RESET CONFIRM MODAL ════════════════ -->
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


<!-- ════════════════════════════════════════════════════════════════
     ▼ DROP IN YOUR QUESTIONS HERE ▼
═══════════════════════════════════════════════════════════════════ -->`;

  /* ── Initialize shared UI systems (after DOM is built) ──────── */
  EngineCommon.initToast();
  EngineCommon.initThemeToggle();

  /* ── Initialize tracker root name ───────────────────────────── */
  QuizTracker.initRootName(ENGINE_BASE);

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
var KEYS = EngineCommon.KEYS;
let state = {
  current:   0,
  answers:   {},   // { qIndex: optionIndex }
  flagged:   {},   // { qIndex: true }
  highlights: {},  // { qIndex: [ { part, start, end, color, optIndex? } ] }
  strikethrough: {}, // { qIndex: { optIndex: true } }
  isHighlighterMode: false,
  timerSecs: 0,
  elapsed:   0,
  timerID:   null,
  submitted: false,
  mode:      'exam', // 'exam' or 'learning'
};
let timerPaused = false;
let lastTime = Date.now();
let submitTimeout = null;  // tracks the setTimeout(confirmSubmit) from timer expiry
// Highlight vars moved to engine-highlights.js

/* -- HIGHLIGHT & STRIKETHROUGH SYSTEM ----------------------------
   Extracted to engine-highlights.js for shared use with bank-engine.
   Initialize the shared system with quiz-engine-specific config.
   -------------------------------------------------------------- */
EngineHighlights.init(state, {
  indexResolver: function(idx) { return idx; },
  questionsGetter: function() { return QUESTIONS; },
  renderFn: function(idx) { renderQuestion(idx); },
  saveFn: function() { saveProgress(); }
});

/* -- MODE SELECTION HANDLERS ───────────────────────────────── */
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

  // Set default time: 1 min per question
  const defaultMins = Math.max(1, QUESTIONS.length);
  document.getElementById('time-input').value = defaultMins;

  // set CSS var for portrait nav scroll
  document.documentElement.style.setProperty('--q-count', QUESTIONS.length);

  // Check saved theme preference
  const savedTheme = localStorage.getItem('quiz-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // Theme icon
  window.__updateThemeIcon();
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

  document.getElementById('timer-display').classList.remove('hidden');

  if(state.mode === 'learning') {
    const legendAns = document.getElementById('legend-text-answered');
    if(legendAns) legendAns.textContent = 'Correct';
    const legendWr = document.getElementById('legend-wrong');
    if(legendWr) legendWr.style.display = 'flex';
  } else {
    const legendAns = document.getElementById('legend-text-answered');
    if(legendAns) legendAns.textContent = 'Answered';
    const legendWr = document.getElementById('legend-wrong');
    if(legendWr) legendWr.style.display = 'none';
  }

  buildNavGrid();
  renderQuestion(0);
  startTimer();
}

/* ── SCREENS ──────────────────────────────────────────────── */
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
}

/* ── TIMER ────────────────────────────────────────────────── */
function startTimer() {
  if(state.timerID) clearInterval(state.timerID);
  timerPaused = false;
  lastTime = Date.now();
  state.timerID = setInterval(() => {
    if (!timerPaused && (state.timerSecs > 0 || state.mode === 'learning')) {
      const now = Date.now();
      const delta = Math.floor((now - lastTime) / 1000);
      if (delta >= 1) {
        state.elapsed += delta;
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
  if(state.timerID) {
    clearInterval(state.timerID);
    state.timerID = null;
  }
  if (submitTimeout) {
    clearTimeout(submitTimeout);
    submitTimeout = null;
  }
  timerPaused = true;
}

function updateTimerDisplay() {
  // In learning mode show elapsed (count-up), in exam mode show remaining (countdown)
  const secs = state.mode === 'learning'
    ? (state.elapsed || 0)
    : Math.max(0, state.timerSecs || 0);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
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
        ${state.isHighlighterMode && state.highlights[idx] && state.highlights[idx].length > 0 ? '<button class="flag-btn" onclick="clearAllHighlights('+idx+')" title="Clear all highlights for this question" style="font-size:0.75rem;">✕ Clear</button>' : ''}
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
        <label class="option-label" for="opt_${i}" data-opt-idx="${i}" style="${extraStyle}">
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

  // Apply highlights & strikethrough after DOM is built
  EngineHighlights.invalidateCache(idx);  // DOM is fresh, must re-apply
  EngineHighlights.applyBulkHighlights(idx);
}

/* ── ANSWER SELECTION ────────────────────────────────────── */
function selectAnswer(qIdx, optIdx) {
  if (state.mode === 'learning' && state.answers[qIdx] !== undefined) return;

  state.answers[qIdx] = optIdx;
  updateNavGrid();
  updateNavStats();
  // In learning mode: re-render to show explanation and highlights
  if(state.mode === 'learning') {
    renderQuestion(qIdx);  // renderQuestion also updates progress
    return;
  }
  // Update progress bar (non-learning mode)
  var done = 0;
  for (var k in state.answers) { if (state.answers.hasOwnProperty(k)) done++; }
  document.getElementById('progress-fill').style.width = (done / QUESTIONS.length * 100) + '%';
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
    // Build class list efficiently — avoid resetting className which triggers reflow
    var isFlagged = !!state.flagged[i];
    var isCurrent = (i === state.current);
    var isAnswered = state.answers[i] !== undefined;
    var isWrong = isAnswered && state.mode === 'learning' && state.answers[i] !== QUESTIONS[i].correct;
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
  document.getElementById('stat-answered').textContent = answered;
  document.getElementById('stat-flagged').textContent  = flagged;
  document.getElementById('stat-skipped').textContent  = QUESTIONS.length - answered;
}

/* ── SUBMIT ──────────────────────────────────────────────── */
function attemptSubmit() {
  // Cancel any pending auto-submit from timer expiry to prevent double submission
  if (submitTimeout) { clearTimeout(submitTimeout); submitTimeout = null; }

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
  clearInterval(saveIntervalId);
  if (pendingTransitionTimeout) {
    clearTimeout(pendingTransitionTimeout);
    pendingTransitionTimeout = null;
  }
  stopTimer();  // ← kill the running interval first
  clearProgress();

  // Clear pending restore data to prevent auto-restore prompt
  pendingRestoreData = null;
  if (restoreToastTimeout) {
    clearTimeout(restoreToastTimeout);
    restoreToastTimeout = null;
  }
  if (restoreScreenTimeout) {
    clearTimeout(restoreScreenTimeout);
    restoreScreenTimeout = null;
  }

  showScreen('start-screen');
}

function navigateToIndex(event) {
  event.preventDefault();
  // Always navigate to index.html to prevent history.back() loops
  // within the quiz flow (start → quiz → results → back would bounce)
  window.location.href = 'index.html';
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
  const hasHighlights = Object.keys(state.highlights || {}).length > 0;
  const hasStrikethrough = Object.keys(state.strikethrough || {}).length > 0;
  if (!hasAnswers && !hasFlags && !hasTime && !hasHighlights && !hasStrikethrough) return;

  const saveData = {
    version: STORAGE_VERSION,
    quizTitle: QUIZ_CONFIG.title,
    totalQuestions: QUESTIONS.length,
    current: state.current,
    answers: state.answers,
    flagged: state.flagged,
    highlights: state.highlights,
    strikethrough: state.strikethrough,
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
  // highlights and strikethrough are optional for backward compatibility
  if (data.highlights && typeof data.highlights !== 'object') return false;
  if (data.strikethrough && typeof data.strikethrough !== 'object') return false;
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

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Confirm and reset quiz progress
 */
function confirmResetProgress() {
  document.getElementById('reset-modal').classList.add('open');
}

function closeResetModal() {
  document.getElementById('reset-modal').classList.remove('open');
}

function confirmResetAction() {
  stopTimer();
  clearProgress();
  // Reset state
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
  state.timerSecs = (parseInt(document.getElementById('time-input').value) || 30) * 60;
  state.submitted = false;
  state.mode = 'exam';

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
  showToast('🔄 Progress reset! Starting fresh...');
}

// Pause timer when user leaves the page/tab, resume when they come back
window.addEventListener('visibilitychange', function() {
  if (document.hidden && !state.submitted) {
    stopTimer();
  } else if (!document.hidden && !state.submitted && state.timerID === null
             && document.getElementById('quiz-screen').classList.contains('active')) {
    // Only restart the interval if the quiz screen is actually showing
    startTimer();
  }
});

// Auto-save every 5 seconds
let saveIntervalId = setInterval(saveProgress, 5000);

// Save progress before page unload (tab close, refresh, navigation)
window.addEventListener('beforeunload', function() {
  if (!state.submitted) {
    saveProgress();
  }
});

// Check for saved progress on init
let restoreToastTimeout = null;
let restoreScreenTimeout = null;  // tracks the setTimeout inside doRestoreProgress
let pendingTransitionTimeout = null;  // tracks screen transition timeouts to prevent race conditions

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
  state.highlights = data.highlights || {};
  state.strikethrough = data.strikethrough || {};

  // Restore timer values exactly as saved (time doesn't count while page is closed)
  state.elapsed = data.elapsed || 0;
  // In learning mode, timerSecs is irrelevant (count-up uses elapsed only)
  // Only restore timerSecs for exam mode to avoid confusion
  state.timerSecs = (data.mode === 'learning') ? 0 : (data.timerSecs || 0);

  state.mode = data.mode;
  state.submitted = false;

  if (restoreScreenTimeout) clearTimeout(restoreScreenTimeout);
  restoreScreenTimeout = setTimeout(() => {
    restoreScreenTimeout = null;
    document.getElementById('timer-display').classList.remove('hidden');
    showScreen('quiz-screen');
    buildNavGrid();
    renderQuestion(state.current);
    updateTimerDisplay();
    startTimer();
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
    var stMap = (state.strikethrough[i] || {});
    var uAns = ans !== undefined ? (KEYS[ans] + '. ' + (stMap[ans] ? '<span style="text-decoration:line-through;opacity:0.5;">' + q.options[ans] + '</span>' : q.options[ans])) : 'Not answered';
    var cAns = KEYS[q.correct] + '. ' + (stMap[q.correct] ? '<span style="text-decoration:line-through;opacity:0.5;">' + q.options[q.correct] + '</span>' : q.options[q.correct]);
    html += '<div style="border:1.5px solid ' + sc + ';border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">'
      +   '<div style="padding:12px 15px;background:' + bgH + ';">'
      +     '<div style="display:flex;gap:10px;align-items:flex-start;">'
      +       '<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;background:rgba(0,0,0,.06);color:' + sc + ';">' + icon + '</div>'
      +       '<div>'
      +         '<div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Q' + (i+1) + (isFlagged ? ' &bull; Flagged' : '') + '</div>'
      +         '<div style="font-size:14px;font-weight:500;line-height:1.5;">' + EngineHighlights.hlToPDFHTML(q.question, state.highlights[i] || [], 'question') + '</div>'
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
initUI();
checkSavedProgress();


/* ================================================================
   TRACKER — saves wrong/flagged data using QuizTracker API
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
  
  // Quiz screen shortcuts
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">←</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Previous question</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">→</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Next question</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">F</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Toggle flag</div>';
  _kbHelpHTML += '      </div>';
  _kbHelpHTML += '      <div class="kb-shortcut-item">';
  _kbHelpHTML += '        <div class="kb-keys"><span class="kb-key">Enter</span></div>';
  _kbHelpHTML += '        <div class="kb-desc">Submit quiz</div>';
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
      if (typeof state !== 'undefined' && state.current < QUESTIONS.length - 1) renderQuestion(state.current + 1);
    }

    // Flag: F
    if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (typeof state !== 'undefined') toggleFlag(state.current);
    }

    // Submit: Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (typeof state !== 'undefined' && state.submitted !== true) {
        attemptSubmit();
      }
    }
  });

  /* ── Animation Helpers ─────────────────────────────────────── */
  (function () {
    'use strict';

    /* 1. Ripple effect for primary buttons */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-start, .btn-nav.primary, .btn-restart, .btn-take-quiz');
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
      var btn = e.target.closest('#theme-toggle');
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
        // Clear any pending transition to prevent race conditions
        if (pendingTransitionTimeout) {
          clearTimeout(pendingTransitionTimeout);
          pendingTransitionTimeout = null;
        }
        var current = document.querySelector('.screen.active');
        var target = document.getElementById(id);
        // Don't animate if already on the same screen or no current screen
        if (current === target || !current) {
          _origShowScreen(id);
          return;
        }
        current.style.opacity = '0';
        pendingTransitionTimeout = setTimeout(function () {
          pendingTransitionTimeout = null;
          current.classList.remove('active');
          current.style.opacity = ''; // clean up so returning later works
          _origShowScreen(id);
        }, 150);
      };
    }
  })();
window.__HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
