/* ================================================================
   dash-ui.js  —  Tracker Dashboard UI for index/hub pages.
   Separated from index-engine.js for cleaner separation of concerns.
   The tracker panel should ONLY be accessible from index files.
   Load this AFTER tracker-storage.js and index-engine.js.
   ================================================================ */
(function () {
  'use strict';

  // Access ENGINE_BASE from the parent index-engine.js scope via a global
  var ENGINE_BASE = window.__IndexEngineBase || '';

  // Compute _rootName locally (same logic as QuizTracker.initRootName)
  var _rootName = '';
  try {
    _rootName = new URL(ENGINE_BASE || '', location.href).pathname
      .replace(/\/$/, '').replace(/^\//, '');
  } catch (e) {}

  /* ── Utility: HTML escaping ─────────────────────────────────── */
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ── Folder title cache (shared via QuizTracker) ───────────── */
  var _folderTitleCache = QuizTracker._folderTitleCache;
  var getFolderForEntry = QuizTracker.getFolderForEntry;
  var getTopLevelFolder = QuizTracker.getTopLevelFolder;
  var fetchFolderTitle = function(folderPath) { return QuizTracker.fetchFolderTitle(folderPath, ENGINE_BASE); };
  var discoverAndCacheFolderTitles = function(data) { return QuizTracker.discoverAndCacheFolderTitles(data, ENGINE_BASE); };
  var cleanTitle = QuizTracker.cleanTitle;
  var _normalizeFolderPath = QuizTracker._normalizeFolderPath;

  /* ── State variables ───────────────────────────────────────── */
  var currentScope = 'folder';
  var currentScopePath = '';
  var _activeDashboard = null; // null | 'tracker' | 'review'
  var _collapsedFolders = {};
  var _selectedQuizzes = {};

  // Expose shared state for cross-module access (e.g., review mode, PDF export)
  window.__DashState = {
    get currentScope() { return currentScope; },
    set currentScope(v) { currentScope = v; },
    get currentScopePath() { return currentScopePath; },
    set currentScopePath(v) { currentScopePath = v; },
    get _activeDashboard() { return _activeDashboard; },
    set _activeDashboard(v) { _activeDashboard = v; },
    get _collapsedFolders() { return _collapsedFolders; },
    set _collapsedFolders(v) { _collapsedFolders = v; },
    get _selectedQuizzes() { return _selectedQuizzes; },
    set _selectedQuizzes(v) { _selectedQuizzes = v; }
  };

  /* ── Inject tracker dashboard extra styles ─────────────────── */
  var _trackerStyle = document.createElement('style');
  _trackerStyle.textContent = '.dash-folder-title{font-family:"Playfair Display",serif;font-size:1.05rem;font-weight:700;color:var(--accent);padding:0.75rem 0 0.4rem;margin-bottom:0.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.4rem;cursor:pointer;user-select:none}.dash-folder-title:hover{opacity:0.85}.dash-folder-toggle{font-size:0.9rem;transition:transform 0.2s ease;display:inline-block}.dash-folder-toggle.collapsed{transform:rotate(-90deg)}.dash-folder-content{transition:max-height 0.3s ease,opacity 0.25s ease;overflow:visible;max-height:none;opacity:1;padding-bottom:0.5rem;flex:1}.dash-folder-content.collapsed{max-height:0;opacity:0;overflow:hidden}.dash-folder-header{display:flex;align-items:center;justify-content:space-between;gap:0.5rem}.dash-folder-select{margin-left:auto;width:18px;height:18px;cursor:pointer;accent-color:var(--accent)}' +
    '.btn-dash-review{padding:0.65rem 1.25rem;border-radius:8px;background:var(--correct);border:1.5px solid var(--correct);color:#ffffff;font-weight:700;font-size:0.85rem;cursor:pointer;transition:all var(--transition);margin-left:auto}.btn-dash-review:hover{opacity:0.85}.btn-dash-review:disabled{opacity:0.4;cursor:not-allowed}' +
    '.dash-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);font-style:italic}';
  document.head.appendChild(_trackerStyle);

  /* ── Clear Tracker Modal HTML ─────────────────────────────── */
  if (!document.getElementById('clear-tracker-modal')) {
    var _modalEl = document.createElement('div');
    _modalEl.className = 'modal-overlay';
    _modalEl.id = 'clear-tracker-modal';
    _modalEl.innerHTML = '<div class="modal"><h3>Clear Questions?</h3><p id="clear-tracker-message">Are you sure you want to clear all questions for this section? This cannot be undone.</p><div class="modal-actions"><button class="btn-cancel" onclick="closeClearTrackerModal()">Go Back</button><button class="btn-confirm danger" onclick="clearAllTrackerData()">Clear Now</button></div></div>';
    document.body.appendChild(_modalEl);
  }

  /* ── Tracker Dashboard HTML ───────────────────────────────── */
  if (!document.getElementById('tracker-dashboard')) {
    var _dashEl = document.createElement('div');
    _dashEl.className = 'dash-overlay';
    _dashEl.id = 'tracker-dashboard';
    _dashEl.innerHTML = '<div class="dash-modal">' +
      '<div class="dash-header">' +
        '<h2 id="dash-title-text">📊 Question Tracker</h2>' +
        '<button class="dash-close-btn" onclick="closeTrackerDashboard()">✕</button>' +
      '</div>' +
      '<div class="dash-scope-bar" id="dash-scope-bar">' +
        '<div id="dash-scope-tabs"></div>' +
        '<button id="dash-master-toggle" class="dash-master-toggle" onclick="toggleMasterSelection()"></button>' +
      '</div>' +
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
  }

  /* ── Badge ─────────────────────────────────────────────────── */
  function updateBadge() {
    var segments = QuizTracker.getFolderSegments(location.pathname);
    var folderPath = segments.length > 0 ? segments[segments.length - 1] : '';
    var data = folderPath
      ? QuizTracker.getAllTrackerData().filter(function (d) {
          var fp = (d.folderPath || '').replace(/^\//, '');
          var dp = QuizTracker._normStoredPath(d.path);
          var target = folderPath.replace(/^\//, '');
          return (fp && fp.indexOf(target) === 0) || (dp && dp.indexOf(target) === 0);
        })
      : QuizTracker.getAllTrackerData();
    var total = 0;
    data.forEach(function (d) { total += (d.wrong || []).length + (d.flagged || []).length; });
    var badge = document.getElementById('tracker-badge-count');
    if (badge) badge.textContent = total > 0 ? total : '';
  }

  window.openTrackerDashboard = function (scope, fromPopState) {
    if (!fromPopState) {
      history.pushState({ dash: 'tracker' }, '');
    }
    _activeDashboard = 'tracker';

    // Reset selection state when opening dashboard (all folders selected by default)
    _selectedQuizzes = {};

    // Reset footer review button text and action
    var revBtn = document.getElementById('btn-start-review');
    if (revBtn) {
      revBtn.textContent = '▶ Start Review';
      revBtn.onclick = startReviewMode;
    }

    var segments = QuizTracker.getFolderSegments(location.pathname);
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
    var allData = QuizTracker.getAllTrackerData();
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
      if (segments.length >= 1) {
        var folderKey = segments[segments.length - 1] + '/';
        var folderLabel = _folderTitleCache[folderKey] || decodeURIComponent(segments[segments.length - 1]);
        tabs.push({ id: 'folder', label: folderLabel, path: segments[segments.length - 1], level: segments.length - 1 });
      }
      if (segments.length >= 2) {
        for (var i = 0; i < segments.length - 1; i++) {
          var folderKey = segments[i] + '/';
          var folderLabel = _folderTitleCache[folderKey] || decodeURIComponent(segments[i]);
          tabs.push({ id: 'folder', label: folderLabel, path: segments[i], level: i });
        }
      }
      tabs.push({ id: 'all', label: 'All Quizzes', path: '' });

      var tabsContainer = document.getElementById('dash-scope-tabs');
      var masterToggle = document.getElementById('dash-master-toggle');
      if (!tabsContainer || !masterToggle) {
        scopeBar.innerHTML = '<div id="dash-scope-tabs"></div><button id="dash-master-toggle" class="dash-master-toggle" onclick="toggleMasterSelection()"></button>';
        tabsContainer = document.getElementById('dash-scope-tabs');
        masterToggle = document.getElementById('dash-master-toggle');
      }
      if (!tabsContainer || !masterToggle) return;

      var scopeHTML = '';
      tabs.forEach(function (t, i) {
        var isActive = t.id === currentScope && (t.id === 'all' || t.path === currentScopePath);
        scopeHTML += '<button class="dash-scope-tab' + (isActive ? ' active' : '')
          + '" data-scope="' + t.id + '" data-path="' + (t.path || '') + '"'
          + ' onclick="switchDashScope(\'' + t.id + '\',\'' + (t.path || '') + '\')">'
          + escHtml(t.label) + '</button>';
      });
      tabsContainer.innerHTML = scopeHTML;

      renderDashboard();
      var overlay = document.getElementById('tracker-dashboard');
      if (overlay) {
        overlay.classList.remove('closing');
        overlay.classList.add('open');
      }
    };

    // Open dashboard IMMEDIATELY
    buildTabs();

    // Fetch titles in background to refresh labels later
    if (foldersToFetch.length > 0) {
      Promise.all(foldersToFetch.map(function (f) { return fetchFolderTitle(f); }))
        .then(function () {
          // Check if dashboard still open to avoid unnecessary work
          if (_activeDashboard === 'tracker') buildTabs();
        })
        .catch(function () {});
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
  function renderDashboard() {
    var data = QuizTracker.getDataForScope(currentScope, currentScopePath);
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

    // 1. Render IMMEDIATELY with current cache (Optimistic Render)
    // This makes the dashboard pop up instantly with raw paths if titles are missing.
    renderDashboardContent(body, data);
    updateMasterToggleState(data);

    // 2. Discover missing titles in the background
    discoverAndCacheFolderTitles(data).then(function () {
      // 3. Re-render once we have better names
      // Check if we are still on the tracker dashboard to avoid background layout thrashing
      if (_activeDashboard === 'tracker') {
          renderDashboardContent(body, data);
          updateMasterToggleState(data);
      }
    });
  }

  function updateMasterToggleState(data) {
    var masterToggle = document.getElementById('dash-master-toggle');
    if (!masterToggle) return;

    var allSelected = data.every(function(d) { return _selectedQuizzes[d.uid] !== false; });
    masterToggle.textContent = allSelected ? 'Deselect All' : 'Select All';
    masterToggle.classList.toggle('active', allSelected);
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

    // Selection buttons removed from here (now a single toggle in scope bar)

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

      if (!isCollapsed) {
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
      }

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
  window.closeTrackerDashboard = function (fromPopState) {
    if (!fromPopState && _activeDashboard === 'tracker') {
      history.back();
      return;
    }
    _activeDashboard = null;
    var overlay = document.getElementById('tracker-dashboard');
    if (overlay) {
      overlay.classList.add('closing');
      var onEnd = function () {
        overlay.removeEventListener('animationend', onEnd);
        overlay.classList.remove('open', 'closing');
      };
      overlay.addEventListener('animationend', onEnd);
    }
  };

  /* ── Toggle folder collapse ────────────────────────────────── */
  window.toggleFolder = function (folder) {
    _collapsedFolders[folder] = !_collapsedFolders[folder];
    // Re-render because lazy rendering skips collapsed folder children
    renderDashboard();
  };

  /* ── Toggle selection logic ───────────────────────────────── */
  window.toggleQuizSelection = function (uid, checked) {
    _selectedQuizzes[uid] = checked;
    renderDashboard();
  };

  window.toggleFolderSelection = function (folder, checked) {
    var data = QuizTracker.getDataForScope(currentScope, currentScopePath);
    data.forEach(function(d) {
       var dFolder = getFolderForEntry(d) || '__root__';
       if (dFolder === folder) _selectedQuizzes[d.uid] = checked;
    });
    renderDashboard();
  };

  window.toggleAllSelection = function(checked) {
    var data = QuizTracker.getDataForScope(currentScope, currentScopePath);
    data.forEach(function(d) {
       _selectedQuizzes[d.uid] = checked;
    });
    renderDashboard();
  };

  window.toggleMasterSelection = function() {
    var data = QuizTracker.getDataForScope(currentScope, currentScopePath);
    var allSelected = data.every(function(d) { return _selectedQuizzes[d.uid] !== false; });
    toggleAllSelection(!allSelected);
  };

  /* ── Remove single item ────────────────────────────────────── */
  window.removeTrackerItem = function (uid, qIdx) {
    try {
      var raw = localStorage.getItem(QuizTracker.getStorageKey(uid));
      if (!raw) return;
      var data = JSON.parse(raw);
      data.wrong   = (data.wrong || []).filter(function (q) { return q.idx !== qIdx; });
      data.flagged = (data.flagged || []).filter(function (q) { return q.idx !== qIdx; });
      if (!data.wrong.length && !data.flagged.length) {
        localStorage.removeItem(QuizTracker.getStorageKey(uid));
        var keys = JSON.parse(localStorage.getItem(QuizTracker.KEYS_LIST_KEY) || '[]');
        localStorage.setItem(QuizTracker.KEYS_LIST_KEY, JSON.stringify(keys.filter(function (k) { return k !== uid; })));
      } else {
        localStorage.setItem(QuizTracker.getStorageKey(uid), JSON.stringify(data));
      }
      renderDashboard();
      updateBadge();
    } catch (e) {}
  };

  /* ── Batch Remove Items (Performance Update) ── */
  window.batchRemoveTrackerItems = function (items) {
    try {
      var uidMap = {};
      items.forEach(function(it) {
        if (!uidMap[it.uid]) uidMap[it.uid] = [];
        uidMap[it.uid].push(it.idx);
      });

      var keys = JSON.parse(localStorage.getItem(QuizTracker.KEYS_LIST_KEY) || '[]');
      var keysChanged = false;

      Object.keys(uidMap).forEach(function(uid) {
        var indices = uidMap[uid];
        var raw = localStorage.getItem(QuizTracker.getStorageKey(uid));
        if (!raw) return;
        var data = JSON.parse(raw);
        data.wrong = (data.wrong || []).filter(function(q) { return !indices.includes(q.idx); });
        data.flagged = (data.flagged || []).filter(function(q) { return !indices.includes(q.idx); });

        if (!data.wrong.length && !data.flagged.length) {
          localStorage.removeItem(QuizTracker.getStorageKey(uid));
          keys = keys.filter(function(k) { return k !== uid; });
          keysChanged = true;
        } else {
          localStorage.setItem(QuizTracker.getStorageKey(uid), JSON.stringify(data));
        }
      });

      if (keysChanged) {
        localStorage.setItem(QuizTracker.KEYS_LIST_KEY, JSON.stringify(keys));
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
      var keys = JSON.parse(localStorage.getItem(QuizTracker.KEYS_LIST_KEY) || '[]');
      var allData = QuizTracker.getAllTrackerData();

      // Filter data based on current scope AND selection
      var dataToClear = QuizTracker.getDataForScope(currentScope, currentScopePath);
      var uidsToClear = {};
      dataToClear.forEach(function (d) {
        if (_selectedQuizzes[d.uid] !== false) uidsToClear[d.uid] = true;
      });

      // Only remove items that match the current scope
      keys.forEach(function (uid) {
        if (uidsToClear[uid]) {
          localStorage.removeItem(QuizTracker.getStorageKey(uid));
        }
      });

      // Update keys list - keep only keys not being cleared
      var remainingKeys = keys.filter(function (uid) { return !uidsToClear[uid]; });
      localStorage.setItem(QuizTracker.KEYS_LIST_KEY, JSON.stringify(remainingKeys));

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

  /* ── Init ──────────────────────────────────────────────────── */
  updateBadge();

  // Signal that this module has loaded
  window.__DashUILoaded = true;
})();
