/* ================================================================
   tracker-storage.js  —  Shared tracker storage and path utilities.
   Used by quiz-engine.js, bank-engine.js, and index-engine.js.
   Load this BEFORE any engine that needs tracker functionality.
   ================================================================ */
(function () {
  'use strict';

  /* ── Storage constants ─────────────────────────────────────── */
  var STORAGE_PREFIX  = 'quiz_tracker_';
  var KEYS_LIST_KEY   = 'quiz_tracker_keys';
  var TRACKER_VERSION = 'v2';

  /* ── Root name (project root derived from ENGINE_BASE) ─────── */
  var _rootName = '';

  /** Compute _rootName from ENGINE_BASE.
   *  Must be called once during engine init before any path functions are used.
   *  e.g.  QuizTracker.initRootName(ENGINE_BASE);  */
  function initRootName(ENGINE_BASE) {
    _rootName = '';
    try {
      _rootName = new URL(ENGINE_BASE || '', location.href).pathname
        .replace(/\/$/, '').replace(/^\//, '');
    } catch (e) { /* ignore */ }
  }

  /* ── Path normalization ────────────────────────────────────── */

  /** Strip the project-root prefix from a stored d.path.
   *  e.g. "/MU61S8/gyn/dep/l1.html" → "gyn/dep/l1.html"          */
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

  /** Normalize a folder path: strip root prefix, ensure trailing slash.
   *  e.g. "MU61S8/gyn/dep/" → "gyn/dep/"
   *  e.g. "gyn/dep"         → "gyn/dep/"                         */
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

  /** Get folder segments RELATIVE to the project root.
   *  e.g. "/MU61S8/gyn/dep/l1-anatomy.html" → ["gyn", "gyn/dep"]
   *  Matches the format used by computeFolderPath().                 */
  function getFolderSegments(path) {
    var cleaned = path.replace(/\/[^/]*$/, '').replace(/^\//, '');
    if (_rootName && cleaned.indexOf(_rootName + '/') === 0) {
      cleaned = cleaned.substring(_rootName.length + 1);
    } else if (_rootName && cleaned === _rootName) {
      cleaned = '';
    }
    var parts = cleaned.split('/').filter(Boolean);
    var segments = [];
    for (var i = 0; i < parts.length; i++) {
      segments.push(parts.slice(0, i + 1).join('/'));
    }
    return segments;
  }

  /** Compute the folder of the current page relative to the project root.
   *  @param {string} ENGINE_BASE  – absolute or relative URL to project root
   *  e.g. on page /MU61S8/gyn/dep/l1.html with ENGINE_BASE pointing to
   *       /MU61S8/, returns "gyn/dep/"                                */
  function computeFolderPath(ENGINE_BASE) {
    try {
      var rootUrl = ENGINE_BASE || '';
      var rootAbs = new URL(rootUrl, location.href).href;
      var pageAbs = location.href;
      var relative = pageAbs.substring(rootAbs.length);
      var folderPath = relative.replace(/[^/]*$/, '');
      return folderPath || '';
    } catch (e) {
      // Fallback: path-based extraction
      var cleaned = location.pathname.replace(/^\//, '');
      var parts = cleaned.split('/');
      if (parts.length > 1) return parts.slice(0, -1).join('/') + '/';
      return '';
    }
  }

  /* ── Storage key ───────────────────────────────────────────── */

  /** Build the localStorage key for a given uid.
   *  Result: "quiz_tracker_v2_<uid>"                                */
  function getStorageKey(uid) {
    return STORAGE_PREFIX + TRACKER_VERSION + '_' + uid;
  }

  /* ── Data read ─────────────────────────────────────────────── */

  /** Read all tracker entries from localStorage. */
  function getAllTrackerData() {
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      var results = [];
      keys.forEach(function (uid) {
        var raw = localStorage.getItem(getStorageKey(uid));
        if (raw) try { results.push(JSON.parse(raw)); } catch (e) { /* skip */ }
      });
      return results;
    } catch (e) { return []; }
  }

  /** Filter tracker data by scope.
   *  @param {string} scope      – "folder" | "all"
   *  @param {string} scopePath  – folder path for scope="folder"
   *  The "quiz" scope is intentionally omitted here because it
   *  requires engine-specific config (QUIZ_CONFIG / BANK_CONFIG).
   *  Each engine can add its own quiz-scoped filter on top.         */
  function getDataForScope(scope, scopePath) {
    var all = getAllTrackerData();

    if (scope === 'folder' && scopePath) {
      var target = scopePath.replace(/^\/|\/$/g, ''); // normalize
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
        // Match if the quiz's folder starts with the target folder path.
        // This ensures "gyn/dep" matches when target is "gyn",
        // but "gyn-extra" does not.
        return (fp && (fp === target || fp.indexOf(target + '/') === 0))
            || (dpFolder && (dpFolder === target || dpFolder.indexOf(target + '/') === 0));
      });
    }

    return all; // scope === 'all'
  }

  /** Extract the folder path from a tracker entry.
   *  Prefers the stored folderPath; falls back to deriving it
   *  from d.path relative to the project root.
   *  Always returns a normalized path (root-relative, trailing slash). */
  function getFolderForEntry(d) {
    if (d.folderPath) {
      return _normalizeFolderPath(d.folderPath);
    }
    // Fallback: derive from d.path
    if (d.path) {
      var normalized = _normStoredPath(d.path);
      var parts = normalized.split('/');
      if (parts.length > 1) {
        return _normalizeFolderPath(parts.slice(0, -1).join('/') + '/');
      }
    }
    return '';
  }

  /** Get the top-level folder from a full folder path.
   *  e.g. "gyn/dep/" → "gyn/",  "Cardio/" → "Cardio/"           */
  function getTopLevelFolder(folderPath) {
    if (!folderPath) return '';
    var parts = folderPath.replace(/\/$/, '').split('/');
    return parts.length > 0 ? parts[0] + '/' : '';
  }

  /* ── Folder title cache ────────────────────────────────────── */
  var _folderTitleCache = {};

  /** Strip common prefixes from HTML titles.
   *  e.g. "QuizTool - Anatomy" → "Anatomy"                        */
  function cleanTitle(raw) {
    if (!raw) return '';
    return raw.replace(/^(?:QuizTool|MU61\s+Quiz|Mansoura\s+MCQ)\s*[-–—]\s*/i, '').trim();
  }

  /** Fetch and cache the folder title from its index.html.
   *  @param {string} folderPath  – relative folder path (e.g. "gyn/dep/")
   *  @param {string} ENGINE_BASE – project root URL
   *  Returns a Promise that resolves to the cleaned title string
   *  or null if the fetch fails.                                    */
  function fetchFolderTitle(folderPath, ENGINE_BASE) {
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

  /** Discover and cache folder titles for entries that don't have
   *  a stored folderTitle.  Also fetches titles for parent folders
   *  that are still missing from the cache.
   *  @param {Array}  data        – array of tracker entry objects
   *  @param {string} ENGINE_BASE – project root URL               */
  function discoverAndCacheFolderTitles(data, ENGINE_BASE) {
    var folders = {};

    // First pass: cache any stored folderTitle values
    data.forEach(function (d) {
      if (d.folderTitle) {
        // ONLY cache for the exact folder path — never derive parent
        // titles from child data (that causes wrong titles).
        var folder = _normalizeFolderPath(d.folderPath) || getFolderForEntry(d);
        if (folder && !_folderTitleCache[folder]) {
          _folderTitleCache[folder] = cleanTitle(d.folderTitle);
        }
      }
    });

    // Second pass: collect folders that still need fetching
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
      promises.push(fetchFolderTitle(folder, ENGINE_BASE));
    });
    return Promise.all(promises);
  }

  /* ── Data modification ─────────────────────────────────────── */

  /** Remove a single tracked question from a quiz entry.
   *  Updates localStorage, then dispatches a "tracker-data-changed"
   *  event so each engine can re-render its own dashboard.          */
  function removeTrackerItem(uid, qIdx) {
    try {
      var raw = localStorage.getItem(getStorageKey(uid));
      if (!raw) return;
      var data = JSON.parse(raw);
      data.wrong   = (data.wrong   || []).filter(function (q) { return q.idx !== qIdx; });
      data.flagged = (data.flagged || []).filter(function (q) { return q.idx !== qIdx; });
      data.wrongCount   = data.wrong.length;
      data.flaggedCount = data.flagged.length;

      if (!data.wrong.length && !data.flagged.length) {
        localStorage.removeItem(getStorageKey(uid));
        var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
        localStorage.setItem(KEYS_LIST_KEY, JSON.stringify(keys.filter(function (k) { return k !== uid; })));
      } else {
        localStorage.setItem(getStorageKey(uid), JSON.stringify(data));
      }
      updateDashboardBadge();
      // Notify engines so they can re-render their dashboards
      try { window.dispatchEvent(new CustomEvent('tracker-data-changed')); } catch (e) { /* ignore */ }
    } catch (e) { console.error('Remove tracker item error:', e); }
  }

  /** Clear ALL tracker data from localStorage.
   *  Shows a confirm dialog before proceeding.
   *  After clearing, dispatches a "tracker-data-changed" event.     */
  function clearAllTrackerData() {
    if (!confirm('Clear all tracked questions? This cannot be undone.')) return;
    try {
      var keys = JSON.parse(localStorage.getItem(KEYS_LIST_KEY) || '[]');
      keys.forEach(function (uid) { localStorage.removeItem(getStorageKey(uid)); });
      localStorage.removeItem(KEYS_LIST_KEY);
      updateDashboardBadge();
      // Notify engines so they can re-render their dashboards
      try { window.dispatchEvent(new CustomEvent('tracker-data-changed')); } catch (e) { /* ignore */ }
    } catch (e) { console.error('Clear tracker error:', e); }
  }

  /* ── Badge ─────────────────────────────────────────────────── */

  /** Update the tracker badge count in the topbar.
   *  Counts total wrong + flagged across ALL tracker entries.       */
  function updateDashboardBadge() {
    var data = getAllTrackerData();
    var total = 0;
    data.forEach(function (d) { total += (d.wrong || []).length + (d.flagged || []).length; });
    var badge = document.getElementById('tracker-badge-count');
    if (badge) badge.textContent = total > 0 ? total : '';
  }

  /* ══════════════════════════════════════════════════════════════
     Expose global API
     ══════════════════════════════════════════════════════════════ */
  window.QuizTracker = {
    // Constants
    STORAGE_PREFIX:  STORAGE_PREFIX,
    KEYS_LIST_KEY:   KEYS_LIST_KEY,
    TRACKER_VERSION: TRACKER_VERSION,

    // Storage key
    getStorageKey: getStorageKey,

    // Path normalization
    initRootName:         initRootName,
    _normStoredPath:      _normStoredPath,
    _normalizeFolderPath: _normalizeFolderPath,
    getFolderSegments:    getFolderSegments,
    computeFolderPath:    computeFolderPath,

    // Data read
    getAllTrackerData:    getAllTrackerData,
    getDataForScope:     getDataForScope,
    getFolderForEntry:   getFolderForEntry,
    getTopLevelFolder:   getTopLevelFolder,

    // Folder titles
    cleanTitle:                    cleanTitle,
    fetchFolderTitle:              fetchFolderTitle,
    discoverAndCacheFolderTitles:  discoverAndCacheFolderTitles,
    _folderTitleCache:             _folderTitleCache,

    // Data modification
    removeTrackerItem:   removeTrackerItem,
    clearAllTrackerData: clearAllTrackerData,

    // Badge
    updateDashboardBadge: updateDashboardBadge
  };

  /* ── Backward compatibility ──────────────────────────────────
     Some onclick handlers in dashboard HTML reference these as
     window globals (e.g. onclick="removeTrackerItem(...)").
     Engines that need different behavior (e.g. index-engine's
     scope-aware clearAllTrackerData) can overwrite these after
     loading tracker-storage.js.                                    */
  window.removeTrackerItem   = removeTrackerItem;
  window.clearAllTrackerData = clearAllTrackerData;
  window.updateDashboardBadge = updateDashboardBadge;

  /* Signal that this module has loaded */
  window.__TrackerStorageLoaded = true;
})();
