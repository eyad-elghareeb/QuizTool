/* ============================================================
   db-helper.js — MU61 Quiz · IndexedDB Wrapper
   Provides a simple, Promise-based API over raw IndexedDB.

   STORES
   ──────
   tracker  : keyed by uid  → quiz_tracker_v2 records
   progress : keyed by uid  → in-progress quiz state

   USAGE
   ─────
   const db = await QuizDB.open();
   await db.trackerSet(uid, data);
   const data = await db.trackerGet(uid);
   const all  = await db.trackerGetAll();
   await db.trackerDelete(uid);
   await db.trackerClear();

   await db.progressSet(uid, data);
   const data = await db.progressGet(uid);
   await db.progressDelete(uid);

   MIGRATION
   ─────────
   await QuizDB.migrateFromLocalStorage();
   ============================================================ */

(function (global) {
  'use strict';

  var DB_NAME    = 'MU61_Quiz_DB';
  var DB_VERSION = 1;

  /* Singleton promise — only one open() call ever executes */
  var _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('tracker')) {
          db.createObjectStore('tracker', { keyPath: 'uid' });
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'uid' });
        }
      };

      req.onsuccess = function (e) {
        resolve(e.target.result);
      };

      req.onerror = function (e) {
        console.error('[QuizDB] Failed to open database:', e.target.error);
        reject(e.target.error);
        _dbPromise = null; // allow retry
      };

      req.onblocked = function () {
        console.warn('[QuizDB] Database open blocked — another tab may have an older version open.');
      };
    });

    return _dbPromise;
  }

  /* ── Generic transaction helper ─────────────────────────── */
  function tx(storeName, mode, action) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(storeName, mode);
        var store = transaction.objectStore(storeName);
        var req = action(store);

        if (req) {
          req.onsuccess = function (e) { resolve(e.target.result); };
          req.onerror   = function (e) { reject(e.target.error); };
        } else {
          transaction.oncomplete = function () { resolve(); };
          transaction.onerror    = function (e) { reject(e.target.error); };
        }
      });
    });
  }

  /* ── Tracker store operations ───────────────────────────── */
  function trackerGet(uid) {
    return tx('tracker', 'readonly', function (s) { return s.get(uid); });
  }

  function trackerGetAll() {
    return tx('tracker', 'readonly', function (s) { return s.getAll(); });
  }

  function trackerSet(uid, data) {
    var record = Object.assign({}, data, { uid: uid });
    return tx('tracker', 'readwrite', function (s) { return s.put(record); });
  }

  function trackerDelete(uid) {
    return tx('tracker', 'readwrite', function (s) { return s.delete(uid); });
  }

  function trackerClear() {
    return tx('tracker', 'readwrite', function (s) { return s.clear(); });
  }

  function trackerGetAllKeys() {
    return tx('tracker', 'readonly', function (s) { return s.getAllKeys(); });
  }

  /* ── Progress store operations ──────────────────────────── */
  function progressGet(uid) {
    return tx('progress', 'readonly', function (s) { return s.get(uid); });
  }

  function progressSet(uid, data) {
    var record = Object.assign({}, data, { uid: uid });
    return tx('progress', 'readwrite', function (s) { return s.put(record); });
  }

  function progressDelete(uid) {
    return tx('progress', 'readwrite', function (s) { return s.delete(uid); });
  }

  /* ── localStorage → IndexedDB Migration ─────────────────── */
  function migrateFromLocalStorage() {
    return openDB().then(function () {
      var keysRaw = localStorage.getItem('quiz_tracker_keys');
      if (!keysRaw) return false; // nothing to migrate

      var uids;
      try { uids = JSON.parse(keysRaw); } catch (e) { return false; }
      if (!Array.isArray(uids) || uids.length === 0) return false;

      var promises = uids.map(function (uid) {
        var lsKey = 'quiz_tracker_v2_' + uid;
        var raw = localStorage.getItem(lsKey);
        if (!raw) return Promise.resolve();
        var data;
        try { data = JSON.parse(raw); } catch (e) { return Promise.resolve(); }
        return trackerSet(uid, data).then(function () {
          localStorage.removeItem(lsKey);
        });
      });

      return Promise.all(promises).then(function () {
        /* Also migrate in-progress sessions */
        var progressKeys = Object.keys(localStorage).filter(function (k) {
          return k.startsWith('quiz_progress_v1_') || k.startsWith('bank_progress_');
        });
        var progressMigrations = progressKeys.map(function (k) {
          var raw = localStorage.getItem(k);
          if (!raw) return Promise.resolve();
          var data;
          try { data = JSON.parse(raw); } catch (e) { return Promise.resolve(); }
          /* uid is everything after the prefix */
          var uid = k.replace(/^quiz_progress_v1_|^bank_progress_/, '');
          data.uid = uid;
          data.__lsKey = k; // remember so we can delete after restore
          return progressSet(uid, data).then(function () {
            localStorage.removeItem(k);
          });
        });
        return Promise.all(progressMigrations);
      }).then(function () {
        localStorage.removeItem('quiz_tracker_keys');
        console.log('[QuizDB] Migration from localStorage complete.');
        return true; // signals migration happened
      });
    });
  }

  /* ── Public API ─────────────────────────────────────────── */
  global.QuizDB = {
    open: openDB,
    trackerGet: trackerGet,
    trackerGetAll: trackerGetAll,
    trackerSet: trackerSet,
    trackerDelete: trackerDelete,
    trackerClear: trackerClear,
    trackerGetAllKeys: trackerGetAllKeys,
    progressGet: progressGet,
    progressSet: progressSet,
    progressDelete: progressDelete,
    migrateFromLocalStorage: migrateFromLocalStorage
  };

}(typeof globalThis !== 'undefined' ? globalThis : window));
