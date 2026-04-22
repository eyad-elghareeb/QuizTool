/* ================================================================
   engine-highlights.js  —  Shared highlight & strikethrough system.
   Used by both quiz-engine.js and bank-engine.js.
   Load this AFTER engine-common.js and tracker-storage.js.
   ================================================================ */
(function () {
  'use strict';

  /* ── Guard: prevent double-load ────────────────────────────── */
  if (window.__EngineHighlightsLoaded) return;
  window.__EngineHighlightsLoaded = true;

  /* ════════════════════════════════════════════════════════════════
     HIGHLIGHT & STRIKETHROUGH SYSTEM
     ═══════════════════════════════════════════════════════════════ */

  // ── Per-engine configuration (set via init()) ────────────────
  var _state = null;   // reference to the engine's state object
  var _opts  = null;   // configuration options

  // The "index resolver" function: engines set this to map their
  // local question index to the key used for highlights/strikethrough.
  // - quiz-engine: identity function (qIndex === qIndex)
  // - bank-engine: _hlGlobalIdx(sessionIdx) to map to global bank index
  var _hlIndexResolver = null;

  // ── Shared state variables ───────────────────────────────────
  var _hlInitialized    = false;  // lazy-load guard: listeners registered once
  var _hlJustApplied    = false;  // set true when highlight is applied, resets after 100ms
  var _hlSelectionTimer = null;
  var _hlCache          = {};     // memoized highlight state per resolved qIndex
  var _hlLastColor      = 1;      // last selected highlight color (1-4), default Yellow
  var _hlPickerOpen     = false;  // color picker dropdown open state
  var _hoveredOption    = -1;     // option index currently hovered (-1 = none)
  var _ctxStrikeDone    = false;  // flag to prevent double-toggle (mousedown + contextmenu)

  /**
   * Initialize the shared highlight system.
   * Called by each engine after creating its state object.
   *
   * @param {Object} state  - The engine's state object (passed by reference).
   *   Must contain: current, highlights, strikethrough, isHighlighterMode, submitted
   * @param {Object} opts   - Configuration options:
   *   indexResolver    {function}  - function(localIdx) => storageIdx
   *       quiz-engine: function(idx) { return idx; }
   *       bank-engine: function(idx) { return _hlGlobalIdx(idx); }
   *   questionsGetter  {function}  - function() => questions array
   *       quiz-engine: function() { return QUESTIONS; }
   *       bank-engine: function() { return SESSION_QUESTIONS; }
   *   renderFn         {function}  - function(localIdx) => void  (renderQuestion)
   *   saveFn           {function}  - function() => void  (saveProgress)
   */
  function init(state, opts) {
    _state = state;
    _opts  = opts;
    _hlIndexResolver = opts.indexResolver || null;
  }

  /** Resolve a local question index to the storage key */
  function _resolveIdx(localIdx) {
    return _hlIndexResolver ? _hlIndexResolver(localIdx) : localIdx;
  }

  /* ── HIGHLIGHTER MODE TOGGLE ───────────────────────────────── */

  // Lazy-init: register all highlighter event listeners on first activation
  function _hlInit() {
    if (_hlInitialized) return;
    _hlInitialized = true;

    /* ── SMART LABEL CLICK HANDLING ──────── */
    // When highlighter is ON, allow BOTH answer selection (tap) and text
    // highlighting (drag-select). Simple tap → select answer; drag-select
    // → block label click so auto-highlight fires instead.
    document.addEventListener('click', function(e) {
      if (!_state.isHighlighterMode || _state.submitted) return;
      var optLabel = e.target.closest('.option-label');
      if (!optLabel) return;
      if (e.target.closest('input[type=radio]')) return;
      if (_hlJustApplied) {
        e.preventDefault();
        e.stopPropagation();
        _hlJustApplied = false;
        return;
      }
    }, true);

    /* ── AUTO-HIGHLIGHT: MOUSE-UP + TOUCH-END + SELECTION-CHANGE ─ */
    // Desktop: mouseup triggers auto-highlight
    document.addEventListener('mouseup', function(e) {
      if (e.button !== 0) return;
      if (!_state.isHighlighterMode || _state.submitted) return;
      setTimeout(_hlAutoApply, 10);
    });

    // Touch: selectionchange detects when user finishes swiping to select
    document.addEventListener('selectionchange', function() {
      if (!_state.isHighlighterMode || _state.submitted) return;
      clearTimeout(_hlSelectionTimer);
      _hlSelectionTimer = setTimeout(_hlAutoApply, 600);
    });

    // Touch: touchend as fallback for quick taps on text
    document.addEventListener('touchend', function(e) {
      if (!_state.isHighlighterMode || _state.submitted) return;
      setTimeout(_hlAutoApply, 300);
    });

    /* ── RIGHT-CLICK / LONG-PRESS: DIRECT STRIKETHROUGH ──────── */
    document.addEventListener('mousedown', function(e) {
      _ctxStrikeDone = false;
      if (_hlPickerOpen) {
        var isPickerClick = e.target.closest('.hl-color-picker') || e.target.closest('.hl-mode-btn');
        if (!isPickerClick) _closeAllPickers();
      }
      if (e.button === 2 && _state.isHighlighterMode && !_state.submitted) {
        var optLabel = e.target.closest('.option-label');
        if (optLabel && optLabel.dataset.optIdx !== undefined) {
          e.preventDefault();
          _ctxStrikeDone = true;
          toggleStrikethrough(_state.current, parseInt(optLabel.dataset.optIdx));
        }
      }
    });

    document.addEventListener('contextmenu', function(e) {
      if (!_state.isHighlighterMode || _state.submitted) return;
      e.preventDefault();
      if (_ctxStrikeDone) { _ctxStrikeDone = false; return; }
      var optLabel = e.target.closest('.option-label');
      if (optLabel && optLabel.dataset.optIdx !== undefined) {
        toggleStrikethrough(_state.current, parseInt(optLabel.dataset.optIdx));
      }
    });

    /* ── TRACK HOVERED OPTION FOR S KEY ──────────────────────── */
    document.addEventListener('mouseover', function(e) {
      var optLabel = e.target.closest('.option-label');
      if (optLabel && optLabel.dataset.optIdx !== undefined) {
        _hoveredOption = parseInt(optLabel.dataset.optIdx);
        return;
      }
      _hoveredOption = -1;
    });
    document.addEventListener('mouseout', function(e) {
      var optLabel = e.target.closest('.option-label');
      if (optLabel) _hoveredOption = -1;
    });
  }

  // First click on highlighter button → activate mode
  // Subsequent clicks while active → toggle color picker (NOT deactivate)
  // Click ✕ in picker → deactivate
  function toggleHighlighterMode() {
    if (!_state.isHighlighterMode) {
      // Activate highlighter mode
      _hlInit();  // lazy-load listeners on first activation
      _state.isHighlighterMode = true;
      document.body.classList.add('highlighter-active');
      document.querySelectorAll('.hl-mode-btn').forEach(function(b) {
        b.classList.add('active');
      });
      if (!_state.submitted) _opts.renderFn(_state.current);
      showToast('🖍 Highlighter ON');
    } else {
      // Already active → toggle color picker open/closed
      _togglePicker();
    }
  }

  // Explicitly disable highlighter mode (called by ✕ close button)
  function disableHighlighterMode() {
    if (!_state.isHighlighterMode) return;
    _state.isHighlighterMode = false;
    document.body.classList.remove('highlighter-active');
    document.querySelectorAll('.hl-mode-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    _closeAllPickers();
    if (!_state.submitted) _opts.renderFn(_state.current);
    showToast('Highlighter OFF');
  }

  // Toggle color picker visibility
  function _togglePicker() {
    var anyVisible = false;
    document.querySelectorAll('.hl-color-picker').forEach(function(p) {
      if (p.classList.contains('visible')) anyVisible = true;
    });
    if (anyVisible) {
      _closeAllPickers();
    } else {
      document.querySelectorAll('.hl-color-picker').forEach(function(p) {
        p.classList.add('visible');
      });
      _hlPickerOpen = true;
    }
  }

  /* ── COLOR PICKER (next to topbar icon) ────────────────────── */
  function _syncPickerUI() {
    // Update selected state in all pickers
    document.querySelectorAll('.hl-color-picker').forEach(function(picker) {
      picker.querySelectorAll('.hl-color-btn').forEach(function(btn) {
        var m = btn.className.match(/cb-(\d)/);
        btn.classList.toggle('selected', m && parseInt(m[1]) === _hlLastColor);
      });
    });
    // Update the dot color on all mode buttons
    var dotColors = { 1: 'rgba(255,213,79,0.8)', 2: 'rgba(129,199,132,0.8)', 3: 'rgba(100,181,246,0.8)', 4: 'rgba(239,154,154,0.8)' };
    document.querySelectorAll('.hl-mode-btn .hl-last-dot').forEach(function(dot) {
      dot.style.background = dotColors[_hlLastColor] || dotColors[1];
    });
  }

  function hlSelectColor(colorNum) {
    if (colorNum === 0) {
      // Eraser mode: set lastColor to 0 (erase on select)
      _hlLastColor = 0;
    } else {
      _hlLastColor = colorNum;
    }
    _syncPickerUI();
    // Don't close picker immediately so user can see selection
  }

  function _closeAllPickers() {
    document.querySelectorAll('.hl-color-picker').forEach(function(p) { p.classList.remove('visible'); });
    _hlPickerOpen = false;
  }

  /* ── SELECTION OFFSET CALCULATION (tag-aware) ──────────────── */
  function _getTextOffsetRelativeTo(container, node, offset) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    var total = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === node) return total + offset;
      total += walker.currentNode.textContent.length;
    }
    return -1;
  }

  function _getSelectionParts() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var range = sel.getRangeAt(0);
    var questionArea = document.getElementById('question-area');
    if (!questionArea || !questionArea.contains(range.commonAncestorContainer)) return null;

    var part = null, optIndex = -1;

    // Check q-text
    var qText = questionArea.querySelector('.q-text');
    if (qText && qText.contains(range.commonAncestorContainer)) part = 'question';

    // Check option texts
    if (!part) {
      var optTexts = questionArea.querySelectorAll('.option-text');
      for (var i = 0; i < optTexts.length; i++) {
        if (optTexts[i].contains(range.commonAncestorContainer)) {
          part = 'option'; optIndex = i; break;
        }
      }
    }

    // Check explanation
    if (!part) {
      var expl = questionArea.querySelector('.explanation-box');
      if (expl && expl.contains(range.commonAncestorContainer)) part = 'explanation';
    }

    if (!part) return null;

    var container;
    if (part === 'question') container = qText;
    else if (part === 'option') container = questionArea.querySelectorAll('.option-text')[optIndex];
    else container = questionArea.querySelector('.explanation-box');
    if (!container) return null;

    var startOffset = _getTextOffsetRelativeTo(container, range.startContainer, range.startOffset);
    var endOffset   = _getTextOffsetRelativeTo(container, range.endContainer, range.endOffset);
    if (startOffset < 0 || endOffset < 0 || startOffset === endOffset) return null;

    return { part: part, optIndex: optIndex, start: startOffset, end: endOffset };
  }

  /* ── AUTO-HIGHLIGHT HELPERS ─────────────────────────────────── */

  // Helper: check if current selection is inside question area
  function _isSelectionInQuestionArea() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
    var questionArea = document.getElementById('question-area');
    if (!questionArea) return false;
    return questionArea.contains(sel.getRangeAt(0).commonAncestorContainer);
  }

  function _hlAutoApply() {
    if (!_state.isHighlighterMode || _state.submitted) return;
    if (!_isSelectionInQuestionArea()) return;
    _hlJustApplied = true;
    setTimeout(function() { _hlJustApplied = false; }, 100);
    if (_hlLastColor === 0) {
      hlEraseSelection();
    } else {
      hlApplyColor(_hlLastColor);
    }
  }

  /* ── HIGHLIGHT APPLY / ERASE ───────────────────────────────── */
  function hlApplyColor(colorNum) {
    if (!_state.isHighlighterMode) return;
    var info = _getSelectionParts();
    if (!info) { window.getSelection().removeAllRanges(); return; }
    var storageIdx = _resolveIdx(_state.current);
    if (storageIdx === undefined) { window.getSelection().removeAllRanges(); return; }
    if (!_state.highlights[storageIdx]) _state.highlights[storageIdx] = [];
    _state.highlights[storageIdx].push({
      part: info.part, optIndex: info.optIndex,
      start: info.start, end: info.end, color: colorNum
    });
    _hlLastColor = colorNum;
    _syncPickerUI();
    delete _hlCache[storageIdx];
    window.getSelection().removeAllRanges();
    _opts.renderFn(_state.current);
    _opts.saveFn();  // Persist immediately
  }

  function hlEraseSelection() {
    if (!_state.isHighlighterMode) return;
    var info = _getSelectionParts();
    if (!info) { window.getSelection().removeAllRanges(); return; }
    var storageIdx = _resolveIdx(_state.current);
    if (storageIdx === undefined) { window.getSelection().removeAllRanges(); return; }
    var hlList = _state.highlights[storageIdx];
    if (!hlList) { window.getSelection().removeAllRanges(); return; }
    _state.highlights[storageIdx] = hlList.filter(function(hl) {
      if (hl.part !== info.part) return true;
      if (hl.part === 'option' && hl.optIndex !== info.optIndex) return true;
      return !(hl.start < info.end && hl.end > info.start);
    });
    if (_state.highlights[storageIdx].length === 0) delete _state.highlights[storageIdx];
    delete _hlCache[storageIdx];
    window.getSelection().removeAllRanges();
    _opts.renderFn(_state.current);
    _opts.saveFn();  // Persist immediately
  }

  function clearAllHighlights(localIdx) {
    var storageIdx = _resolveIdx(localIdx);
    if (storageIdx !== undefined) {
      delete _state.highlights[storageIdx];
      delete _hlCache[storageIdx];
    }
    _opts.renderFn(localIdx);
    _opts.saveFn();  // Persist immediately
    showToast('Highlights cleared');
  }

  /* ── STRIKETHROUGH TOGGLE ──────────────────────────────────── */
  function toggleStrikethrough(localIdx, optIdx) {
    var storageIdx = _resolveIdx(localIdx);
    if (storageIdx === undefined) return;
    if (!_state.strikethrough[storageIdx]) _state.strikethrough[storageIdx] = {};
    _state.strikethrough[storageIdx][optIdx] = !_state.strikethrough[storageIdx][optIdx];
    if (!_state.strikethrough[storageIdx][optIdx]) delete _state.strikethrough[storageIdx][optIdx];
    _opts.renderFn(localIdx);
    _opts.saveFn();  // Persist immediately
  }

  /* ── KEYBOARD SHORTCUTS (H, 1-4, S) ───────────────────────── */
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    var quizActive = document.getElementById('quiz-screen') && document.getElementById('quiz-screen').classList.contains('active');
    if (!quizActive) return;

    if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleHighlighterMode();
      return;
    }
    // 1-4: set highlighter color (also apply if text is selected)
    if ((e.key >= '1' && e.key <= '4') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      _hlLastColor = parseInt(e.key);
      _syncPickerUI();
      // If text is selected, apply immediately; otherwise just change the color
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed && _state.isHighlighterMode) {
        hlApplyColor(_hlLastColor);
      }
      return;
    }
    if (_state.isHighlighterMode && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var questions = _opts.questionsGetter();
        var q = questions[_state.current];
        if (q) {
          // Strike the hovered option if any, otherwise the first un-struck one
          if (_hoveredOption >= 0) {
            toggleStrikethrough(_state.current, _hoveredOption);
            return;
          }
          var storageIdx = _resolveIdx(_state.current);
          var stMap = (storageIdx !== undefined && _state.strikethrough[storageIdx]) || {};
          for (var i = 0; i < q.options.length; i++) {
            if (!stMap[i]) { toggleStrikethrough(_state.current, i); return; }
          }
          if (storageIdx !== undefined) _state.strikethrough[storageIdx] = {};
          _opts.renderFn(_state.current);
        }
      }
    }
  });

  /* ── TAG-AWARE HIGHLIGHT INJECTION ─────────────────────────── */
  function _applyHighlightsToHTML(html, hlList, part, optIndex) {
    var relevant = hlList.filter(function(hl) {
      if (hl.part !== part) return false;
      if (part === 'option' && hl.optIndex !== optIndex) return false;
      return true;
    });
    if (relevant.length === 0) return html;
    relevant.sort(function(a, b) { return a.start - b.start || a.end - b.end; });

    var result = [], textIdx = 0, i = 0;
    var pendingOpens = [];
    var hlQueue = relevant.slice();

    while (i < html.length) {
      if (html[i] === '<') {
        var tagEnd = html.indexOf('>', i);
        if (tagEnd === -1) tagEnd = html.length - 1;
        result.push(html.substring(i, tagEnd + 1));
        i = tagEnd + 1;
        continue;
      }
      while (pendingOpens.length > 0 && pendingOpens[pendingOpens.length - 1].end <= textIdx) {
        result.push('</mark>');
        pendingOpens.pop();
      }
      while (hlQueue.length > 0 && hlQueue[0].start <= textIdx) {
        var hl = hlQueue.shift();
        result.push('<mark class="q-highlight hl-color-' + hl.color + '">');
        pendingOpens.push({ end: hl.end, color: hl.color });
        pendingOpens.sort(function(a, b) { return b.end - a.end; });
      }
      if (html[i] === '&') {
        var entityEnd = html.indexOf(';', i);
        if (entityEnd !== -1 && entityEnd - i < 8) {
          result.push(html.substring(i, entityEnd + 1));
          textIdx++; i = entityEnd + 1; continue;
        }
      }
      result.push(html[i]);
      textIdx++; i++;
    }
    while (pendingOpens.length > 0) { result.push('</mark>'); pendingOpens.pop(); }
    return result.join('');
  }

  function applyBulkHighlights(localIdx) {
    var storageIdx = _resolveIdx(localIdx);
    if (storageIdx === undefined) return;
    if (_hlCache[storageIdx]) return;
    var hlList = _state.highlights[storageIdx] || [];
    var stMap = _state.strikethrough[storageIdx] || {};
    if (hlList.length === 0 && Object.keys(stMap).length === 0) return;

    var area = document.getElementById('question-area');
    if (!area) return;

    var qText = area.querySelector('.q-text');
    if (qText && hlList.length) qText.innerHTML = _applyHighlightsToHTML(qText.innerHTML, hlList, 'question');

    var optTexts = area.querySelectorAll('.option-text');
    optTexts.forEach(function(el, i) {
      if (hlList.length) el.innerHTML = _applyHighlightsToHTML(el.innerHTML, hlList, 'option', i);
    });

    var expl = area.querySelector('.explanation-box');
    if (expl && hlList.length) expl.innerHTML = _applyHighlightsToHTML(expl.innerHTML, hlList, 'explanation');

    var optLabels = area.querySelectorAll('.option-label');
    optLabels.forEach(function(el, i) {
      if (stMap[i]) el.classList.add('strikethrough');
    });

    if (_state.isHighlighterMode) {
      optLabels.forEach(function(label, i) {
        var existing = label.querySelector('.st-toggle-btn');
        if (existing) { existing.classList.toggle('active', !!stMap[i]); return; }
        var btn = document.createElement('button');
        btn.className = 'st-toggle-btn' + (stMap[i] ? ' active' : '');
        btn.title = 'Strikethrough (S)';
        btn.textContent = '✕';
        btn.onclick = (function(ci) { return function(e) { e.preventDefault(); e.stopPropagation(); toggleStrikethrough(_state.current, ci); }; })(i);
        label.appendChild(btn);
      });
    }

    _hlCache[storageIdx] = true;
  }

  /* ── PDF HIGHLIGHT HELPER ──────────────────────────────────── */
  function _hlToPDFHTML(text, hlList, part) {
    var relevant = hlList.filter(function(hl) { return hl.part === part; });
    if (relevant.length === 0) return text;
    relevant.sort(function(a, b) { return a.start - b.start; });
    var pdfColors = { 1: '#ffd54f', 2: '#81c784', 3: '#64b5f6', 4: '#ef9a9a' };
    var result = '', last = 0;
    relevant.forEach(function(hl) {
      if (hl.start > last) result += text.substring(last, hl.start);
      result += '<span style="background:' + (pdfColors[hl.color] || '#ffd54f') + ';border-radius:2px;padding:0 2px;">';
      result += text.substring(Math.max(last, hl.start), hl.end);
      result += '</span>';
      last = hl.end;
    });
    if (last < text.length) result += text.substring(last);
    return result;
  }

  /* ── Cache management ──────────────────────────────────────── */

  /** Invalidate the highlight cache for a given question.
   *  Call this in renderQuestion before applyBulkHighlights when
   *  the DOM is rebuilt (fresh HTML = must re-apply highlights).
   *  @param {number} localIdx - the local/session question index */
  function invalidateCache(localIdx) {
    var storageIdx = _resolveIdx(localIdx);
    if (storageIdx !== undefined) delete _hlCache[storageIdx];
  }

  /** Clear the entire highlight cache. Clears in-place so external
   *  references to EngineHighlights._hlCache remain valid. */
  function clearCache() {
    for (var k in _hlCache) {
      if (_hlCache.hasOwnProperty(k)) delete _hlCache[k];
    }
  }

  /* ════════════════════════════════════════════════════════════════
     EXPOSE THE API
     ═══════════════════════════════════════════════════════════════ */

  // Global functions needed by onclick="" attributes in the HTML
  window.toggleHighlighterMode  = toggleHighlighterMode;
  window.disableHighlighterMode = disableHighlighterMode;
  window.hlSelectColor          = hlSelectColor;
  window.clearAllHighlights     = clearAllHighlights;
  window.toggleStrikethrough    = toggleStrikethrough;
  window.hlApplyColor           = hlApplyColor;
  window.hlEraseSelection       = hlEraseSelection;

  // Expose the API object for engine init and internal access
  window.EngineHighlights = {
    /* ── Initialization ─────────────────────────────────────── */
    init:                  init,

    /* ── Public highlight actions (same names as global fns) ── */
    toggleHighlighterMode: toggleHighlighterMode,
    disableHighlighterMode:disableHighlighterMode,
    hlSelectColor:         hlSelectColor,
    hlApplyColor:          hlApplyColor,
    hlEraseSelection:      hlEraseSelection,
    clearAllHighlights:    clearAllHighlights,
    toggleStrikethrough:   toggleStrikethrough,

    /* ── Bulk operations ────────────────────────────────────── */
    applyBulkHighlights:   applyBulkHighlights,

    /* ── HTML/PDF helpers ───────────────────────────────────── */
    _applyHighlightsToHTML:_applyHighlightsToHTML,
    _hlToPDFHTML:          _hlToPDFHTML,

    /* ── UI helpers ─────────────────────────────────────────── */
    _syncPickerUI:         _syncPickerUI,

    /* ── Cache management ───────────────────────────────────── */
    invalidateCache:       invalidateCache,
    clearCache:            clearCache,

    /* ── Index resolution (for engines that need it in templates) */
    resolveIdx:            _resolveIdx,

    /* ── Direct cache reference (for renderQuestion's
          `delete _hlCache[idx]` pattern — prefer invalidateCache) */
    _hlCache:              _hlCache
  };
  window.__EngineHighlightsLoaded = true;
})();
