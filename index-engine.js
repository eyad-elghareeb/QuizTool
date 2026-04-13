/* ================================================================
   index-engine.js  —  Shared engine for all index/hub pages.
   Handles theme toggle, quiz card rendering, and tracker dashboard.
   Load this after defining QUIZZES config and #quiz-grid element.
   ================================================================ */
(function () {
  'use strict';

  var _cs = document.currentScript;
  var ENGINE_BASE = _cs ? _cs.src.replace(/[^\/]*$/, '') : '';

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

  function getFolderSegments(path) {
    var parts = path.replace(/\/[^/]*$/, '').split('/').filter(Boolean);
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
      return all.filter(function (d) {
        var _n = function (p) { return p.replace(/^\//, ''); };
        return d.path && _n(d.path).indexOf(_n(scopePath)) === 0;
      });
    }
    return all;
  }

  /* ── Badge ─────────────────────────────────────────────────── */
  function updateBadge() {
    var segments = getFolderSegments(location.pathname);
    var folderPath = segments.length > 0 ? segments[segments.length - 1] : '';
    var _norm = function (p) { return p.replace(/^\//, ''); };
    var data = folderPath
      ? getAllTrackerData().filter(function (d) { return d.path && _norm(d.path).indexOf(_norm(folderPath)) === 0; })
      : getAllTrackerData();
    var total = 0;
    data.forEach(function (d) { total += (d.wrong || []).length + (d.flagged || []).length; });
    var badge = document.getElementById('tracker-badge-count');
    if (badge) badge.textContent = total > 0 ? total : '';
  }

  /* ── Scope state ───────────────────────────────────────────── */
  var currentScope = 'folder';
  var currentScopePath = '';

  /* ── Open dashboard ────────────────────────────────────────── */
  window.openTrackerDashboard = function () {
    var segments = getFolderSegments(location.pathname);
    var scopeBar = document.getElementById('dash-scope-bar');
    if (!scopeBar) return;

    var tabs = [];
    if (segments.length >= 1) {
      tabs.push({ id: 'folder', label: decodeURIComponent(segments[segments.length - 1]), path: segments[segments.length - 1] });
    }
    if (segments.length >= 2) {
      tabs.push({ id: 'folder', label: decodeURIComponent(segments[segments.length - 2]), path: segments[segments.length - 2] });
    }
    tabs.push({ id: 'all', label: 'All Quizzes', path: '' });

    var scopeHTML = '';
    tabs.forEach(function (t, i) {
      scopeHTML += '<button class="dash-scope-tab' + (i === 0 ? ' active' : '')
        + '" data-scope="' + t.id + '" data-path="' + (t.path || '') + '"'
        + ' onclick="switchDashScope(\'' + t.id + '\',\'' + (t.path || '') + '\')">'
        + t.label + '</button>';
    });
    scopeBar.innerHTML = scopeHTML;

    currentScope = 'folder';
    currentScopePath = tabs.length > 0 ? tabs[0].path : '';
    renderDashboard();
    var overlay = document.getElementById('tracker-dashboard');
    if (overlay) overlay.classList.add('open');
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

    var html = '';
    data.forEach(function (d) {
      var wrongItems = d.wrong || [];
      var flaggedItems = d.flagged || [];
      var wrongIdxs = {};
      wrongItems.forEach(function (q) { wrongIdxs[q.idx] = true; });
      var uniqueFlagged = flaggedItems.filter(function (q) { return !wrongIdxs[q.idx]; });
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

      wrongItems.forEach(function (q) {
        var isAlsoFlagged = flaggedItems.some(function (f) { return f.idx === q.idx; });
        html += buildItem(d.uid, q, isAlsoFlagged ? 'Wrong + Flagged' : 'Wrong', 'wrong', '\u2717');
      });
      uniqueFlagged.forEach(function (q) {
        html += buildItem(d.uid, q, 'Flagged', 'flagged', '\u2691');
      });
      html += '</div>';
    });

    body.innerHTML = html || '<div class="dash-empty"><div class="dash-empty-icon">\u2705</div><p>No wrong or flagged questions tracked. Great job!</p></div>';
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
  window.clearAllTrackerData = function () {
    if (!confirm('Clear all tracked questions? This cannot be undone.')) return;
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      keys.forEach(function (uid) { localStorage.removeItem(getStorageKey(uid)); });
      localStorage.removeItem(KEYS_LIST_KEY);
      renderDashboard();
      updateBadge();
    } catch (e) {}
  };

  /* ── PDF Export ────────────────────────────────────────────── */
  window.exportTrackerToPDF = function () {
    var data = getDataForScope(currentScope, currentScopePath);
    if (!data.length) { alert('No tracked questions to export.'); return; }

    var totalWrong = 0, totalFlagged = 0;
    data.forEach(function (d) { totalWrong += (d.wrong || []).length; totalFlagged += (d.flagged || []).length; });
    var scopeLabel = currentScope === 'folder' ? decodeURIComponent(currentScopePath) : 'All Quizzes';
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
      s.onerror = function () { alert('Failed to load PDF library'); };
      document.head.appendChild(s);
    }
  };

  /* ── Init ──────────────────────────────────────────────────── */
  updateBadge();
  window.__indexEngineReady = true;

})();
