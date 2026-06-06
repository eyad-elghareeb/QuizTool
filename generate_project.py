"""
QuizTool Project Generator
==========================
A user-friendly web UI to configure and generate a full quiz project instance
(similar to MU61S8) with index pages, engines, and assets.

Requirements:
    pip install flask

Usage:
    python generate_project.py

Then open http://localhost:5500 in your browser.
"""

import os
import sys
import json
import zipfile
import io
import threading
import webbrowser
import tempfile
import shutil
import subprocess
import re
import base64
from pathlib import Path
from flask import Flask, render_template_string, request, send_file, jsonify, send_from_directory

app = Flask(__name__)

# ============================================================
#  Paths - locate engine files from QuizTool directory
# ============================================================
BASE_DIR = Path(__file__).parent.resolve()

# When running as a PyInstaller frozen EXE, __file__ points to the
# temp extraction directory.  Detect this so we can resolve bundled
# assets correctly and place generated projects in a sensible location.
_FROZEN = getattr(sys, 'frozen', False)

def read_file(name):
    """Read a file from the QuizTool directory (or PyInstaller bundle)."""
    p = BASE_DIR / name
    if p.exists():
        return p.read_text(encoding='utf-8')
    return ''

# Read quiz engine test HTML if it exists
QUIZ_ENGINE_TEST_HTML = read_file('quiz-engine-test.html')

FAVICON_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0d1117"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="#f0a500" stroke-width="3.5"/>
  <rect x="44" y="32" width="12" height="36" rx="2" fill="#f0a500"/>
  <rect x="32" y="44" width="36" height="12" rx="2" fill="#f0a500"/>
</svg>'''

def generate_sw_js(project_name, all_file_paths):
    """
    Generate a fully functional service worker with comprehensive precaching.
    
    Args:
        project_name: Name of the project for cache naming
        all_file_paths: List of all relative file paths to precache
    """
    # Generate cache version hash from project name
    import hashlib
    cache_hash = hashlib.md5(project_name.encode()).hexdigest()[:10]
    cache_name_prefix = project_name.lower().replace(' ', '-')
    
    # Build the precache paths array
    paths_json = json.dumps(all_file_paths, indent=2)
    
    sw_content = '''/* {name} — generated precache manifest for all quiz and hub pages.
   CACHE_VERSION is content-hashed so new files activate automatically. */
const CACHE_VERSION = 'quiz-cache-{hash}';
const CACHE_NAME = '{prefix}-cache-' + CACHE_VERSION;

const GOOGLE_FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap';

const HTML2PDF_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

var PRECACHE_REL_PATHS = {paths};
'''.format(name=project_name, hash=cache_hash, prefix=cache_name_prefix, paths=paths_json)
    
    sw_content += r'''
/* ── Build a full URL from scope + relative path ── */
function hrefFromScope(scope, relPath) {
  var s = scope.endsWith('/') ? scope : scope + '/';
  return new URL(relPath, s).href;
}

function shouldStore(res) {
  return res && (res.ok || res.type === 'opaque');
}

/* ── Precache Google Fonts (CSS + @font-face files) ── */
function precacheGoogleFonts(cache) {
  return fetch(GOOGLE_FONT_CSS, { mode: 'cors', credentials: 'omit' })
    .then(function (res) {
      if (!res.ok) return;
      return cache.put(GOOGLE_FONT_CSS, res.clone()).then(function () {
        return res.text();
      });
    })
    .then(function (txt) {
      if (!txt) return;
      var re = /url\s*\(\s*([^)]+)\s*\)/g;
      var m;
      var jobs = [];
      while ((m = re.exec(txt)) !== null) {
        var raw = m[1].replace(/["']/g, '').trim();
        if (!raw || raw.indexOf('data:') === 0) continue;
        var fontUrl = new URL(raw, GOOGLE_FONT_CSS).href;
        (function (u) {
          jobs.push(
            fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) {
              if (r.ok) return cache.put(u, r);
            })
          );
        })(fontUrl);
      }
      return Promise.all(
        jobs.map(function (j) {
          return j.catch(function () {});
        })
      );
    })
    .catch(function () {});
}

/* ── Precache html2pdf.js CDN bundle for offline PDF export ── */
function precacheHtml2Pdf(cache) {
  return fetch(HTML2PDF_CDN, { mode: 'cors', credentials: 'omit' })
    .then(function (res) {
      if (res.ok) return cache.put(HTML2PDF_CDN, res);
    })
    .catch(function () {});
}

/* ══════════════════════════════════════════════════════════════
   INSTALL — precache everything
   ══════════════════════════════════════════════════════════════ */
self.addEventListener('install', function (event) {
  event.waitUntil(
    (async function () {
      var scope = self.registration.scope;
      var cache = await caches.open(CACHE_NAME);

      var REQUIRED = [
        'quiz-engine.js',
        'bank-engine.js',
        'flashcard-engine.js',
        'written-engine.js',
        'index-engine.js',
        'sync-engine.js',
        'index-engine.css',
        'index.html',
        'tracker-map.json',
        'manifest.webmanifest',
        'favicon.svg'
      ];

      /* 1. Critical assets — DO NOT CATCH (fails install on error) */
      await Promise.all(
        REQUIRED.map(function (rel) {
          return cache.add(hrefFromScope(scope, rel));
        })
      );

      /* 2. All other HTML/icons — tolerate failures */
      var others = PRECACHE_REL_PATHS.filter(function (p) {
        return REQUIRED.indexOf(p) === -1;
      });
      await Promise.all(
        others.map(function (rel) {
          return cache.add(hrefFromScope(scope, rel)).catch(function () {});
        })
      );

      /* 3. Cross-origin CDN resources */
      await precacheGoogleFonts(cache);
      await precacheHtml2Pdf(cache);

      await self.skipWaiting();
    })()
  );
});

/* ══════════════════════════════════════════════════════════════
   ACTIVATE — clean old caches, claim clients immediately
   ══════════════════════════════════════════════════════════════ */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      var keys = await caches.keys();
      await Promise.all(
        keys.map(function (k) {
          return k !== CACHE_NAME ? caches.delete(k) : Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

/* ══════════════════════════════════════════════════════════════
   FETCH — routing strategy
   ══════════════════════════════════════════════════════════════ */

/** Navigation requests (HTML pages): network-first with timeout, then cache fallback + hub fallback. */
function handleNavigate(event, request) {
  return (async function () {
    var cache = await caches.open(CACHE_NAME);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    var netRes = null;

    try {
      var res = await fetch(request, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res && res.ok) {
        try { await cache.put(request, res.clone()); } catch (_) {}
        return res; // only return good responses from network
      }
      netRes = res; // non-ok (404/500) — keep for last resort, try cache first
    } catch (err) {
      clearTimeout(timeoutId);
      // Offline or timeout — fall through to cache
    }

    /* Try exact cache match */
    var cached = await cache.match(request);
    if (cached) return cached;

    /* Try matching without query/hash */
    var url = new URL(request.url);
    var cleanUrl = url.origin + url.pathname;
    cached = await cache.match(cleanUrl);
    if (cached) return cached;

    /* Directory support: if URL ends in / or has no extension, try appending index.html */
    if (url.pathname.endsWith('/') || !url.pathname.split('/').pop().includes('.')) {
      var indexUrl = cleanUrl.endsWith('/') ? cleanUrl + 'index.html' : cleanUrl + '/index.html';
      cached = await cache.match(indexUrl);
      if (cached) return cached;
    }

    /* Last resort: serve the main hub page */
    var fb = await cache.match(hrefFromScope(self.registration.scope, 'index.html'));
    if (fb) return fb;

    /* If we had a non-ok network response, return it (better than nothing) */
    if (netRes) return netRes;
    throw new Error('No cache match and network failed');
  })();
}

/** Assets & cross-origin: cache-first, then network (populates cache on miss). */
function handleAsset(event, request) {
  return (async function () {
    var cache = await caches.open(CACHE_NAME);
    var cached = await cache.match(request);

    /* Root fallback for shared assets (e.g. index-engine.css loaded from subfolders) */
    if (!cached) {
      var url = new URL(request.url);
      var scope = self.registration.scope;
      if (url.origin === self.location.origin && url.href.indexOf(scope) === 0) {
        var filename = url.pathname.split('/').pop();
        var SHARED = [
          'quiz-engine.js',
          'bank-engine.js',
          'flashcard-engine.js',
          'written-engine.js',
          'ai-assistant-engine.js',
          'index-engine.js',
          'sync-engine.js',
          'index-engine.css',
          'manifest.webmanifest',
          'favicon.svg',
          'icon-48.png',
          'icon-72.png',
          'icon-96.png',
          'icon-144.png',
          'icon-192.png',
          'icon-512.png',
          'tracker-map.json'
        ];
        if (SHARED.indexOf(filename) !== -1) {
          cached = await cache.match(hrefFromScope(scope, filename));
        }
      }
    }

    if (cached) return cached;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      var res = await fetch(request, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (shouldStore(res)) {
        try {
          await cache.put(request, res.clone());
        } catch (_) {}
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      /* Offline miss for asset — try matching without query string */
      var cleanUrl = request.url.split('?')[0].split('#')[0];
      var cachedClean = await cache.match(cleanUrl);
      if (cachedClean) return cachedClean;
      throw err;
    }
  })();
}

/** Decide whether to use network-first (HTML) or cache-first (everything else). */
function shouldNetworkFirst(req) {
  if (req.mode === 'navigate') return true;
  try {
    var u = new URL(req.url);
    if (u.origin !== self.location.origin) return false;
    var p = u.pathname;
    return p.endsWith('manifest.webmanifest') || p.endsWith('favicon.svg');
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var req = event.request;
  if (shouldNetworkFirst(req)) {
    event.respondWith(handleNavigate(event, req));
    return;
  }
  event.respondWith(handleAsset(event, req));
});
'''
    
    return sw_content

INDEX_ENGINE_JS = read_file('index-engine.js')
INDEX_ENGINE_CSS = read_file('index-engine.css')
QUIZ_ENGINE_JS = read_file('quiz-engine.js')
BANK_ENGINE_JS = read_file('bank-engine.js')
FLASHCARD_ENGINE_JS = read_file('flashcard-engine.js')
WRITTEN_ENGINE_JS = read_file('written-engine.js')
AI_ASSISTANT_ENGINE_JS = read_file('ai-assistant-engine.js')
SYNC_ENGINE_JS = read_file('sync-engine.js')

# Read sync scripts from QuizTool's own scripts/ folder (self-contained, no MU61S8 dependency)
_SCRIPTS_DIR = BASE_DIR / 'scripts'
SYNC_SCRIPT = (_SCRIPTS_DIR / 'sync_quiz_assets.py').read_text(encoding='utf-8') if (_SCRIPTS_DIR / 'sync_quiz_assets.py').exists() else ''
STANDARDIZE_SCRIPT = (_SCRIPTS_DIR / 'standardize_quiz_files.py').read_text(encoding='utf-8') if (_SCRIPTS_DIR / 'standardize_quiz_files.py').exists() else ''
ADMIN_DASHBOARD_SCRIPT = (_SCRIPTS_DIR / 'admin-dashboard.py').read_text(encoding='utf-8') if (_SCRIPTS_DIR / 'admin-dashboard.py').exists() else ''

# Read QuizTool-Admin.exe
_ADMIN_EXE_PATH = BASE_DIR / 'tauri-admin' / 'target' / 'release' / 'quiztool-admin.exe'
QUIZTOOL_ADMIN_EXE = _ADMIN_EXE_PATH.read_bytes() if _ADMIN_EXE_PATH.exists() else None

# Auto-index script
AUTO_INDEX_SCRIPT = '''#!/usr/bin/env python3
"""
Auto-index new quiz/bank/flashcard HTML files.
Scans all folders for .html files with QUIZ_CONFIG, BANK_CONFIG, or FLASHCARD_CONFIG
and updates parent folder index.html files.
"""
import os
import re
import json
from pathlib import Path

def parse_quiz_file(filepath):
    """Extract config from a quiz/bank/flashcard HTML file."""
    content = filepath.read_text(encoding='utf-8')
    
    # Try QUIZ_CONFIG
    match = re.search(r'/\\*\\s*\\[QUIZ_CONFIG_START\\]\\s*\\*/[\\s\\S]*?(?:const|var)\\s+QUIZ_CONFIG\\s*=\\s*({[\\s\\S]*?});[\\s\\S]*?/\\*\\s*\\[QUIZ_CONFIG_END\\]\\s*\\*/', content)
    if match:
        try:
            config = eval(match.group(1))
            return {'type': 'quiz', 'config': config}
        except:
            pass
    
    # Try WRITTEN_CONFIG
    match = re.search(r'/\\*\\s*\\[WRITTEN_CONFIG_START\\]\\s*\\*/[\\s\\S]*?(?:const|var)\\s+WRITTEN_CONFIG\\s*=\\s*({[\\s\\S]*?});[\\s\\S]*?/\\*\\s*\\[WRITTEN_CONFIG_END\\]\\s*\\*/', content)
    if match:
        try:
            config = eval(match.group(1))
            return {'type': 'written', 'config': config}
        except:
            pass

    # Try FLASHCARD_CONFIG first (flashcard files use FLASHCARD_CONFIG markers)
    match = re.search(r'/\\*\\s*\\[FLASHCARD_CONFIG_START\\]\\s*\\*/[\\s\\S]*?(?:const|var)\\s+BANK_CONFIG\\s*=\\s*({[\\s\\S]*?});[\\s\\S]*?/\\*\\s*\\[FLASHCARD_CONFIG_END\\]\\s*\\*/', content)
    if match:
        try:
            config = eval(match.group(1))
            return {'type': 'flashcard', 'config': config}
        except:
            pass
    
    # Try BANK_CONFIG
    match = re.search(r'/\\*\\s*\\[BANK_CONFIG_START\\]\\s*\\*/[\\s\\S]*?(?:const|var)\\s+BANK_CONFIG\\s*=\\s*({[\\s\\S]*?});[\\s\\S]*?/\\*\\s*\\[BANK_CONFIG_END\\]\\s*\\*/', content)
    if match:
        try:
            config = eval(match.group(1))
            return {'type': 'bank', 'config': config}
        except:
            pass
    
    return None

def scan_folder(folder_path):
    """Scan a folder for quiz/bank files and return quiz entries."""
    quizzes = []
    subfolders = []
    
    if not folder_path.is_dir():
        return None
    
    # Find all HTML files
    for html_file in sorted(folder_path.glob('*.html')):
        # Skip index.html
        if html_file.name == 'index.html':
            continue
        
        parsed = parse_quiz_file(html_file)
        if parsed:
            config = parsed['config']
            rel_path = html_file.name
            type_icon = config.get('icon', '\\U0001F4DD' if parsed['type'] == 'quiz' else ('\\U0001F0CF' if parsed['type'] == 'flashcard' else ('\\u270D\\uFE0F' if parsed['type'] == 'written' else '\\U0001F5C3\\uFE0F')))
            type_label = {'quiz': 'Quiz', 'bank': 'Bank', 'flashcard': 'Flashcard', 'written': 'Written'}.get(parsed['type'], 'Quiz')
            quizzes.append({
                'title': config.get('title', html_file.stem),
                'description': config.get('description', ''),
                'icon': type_icon,
                'tags': [type_label],
                'url': rel_path
            })
    
    # Find subfolders
    for subfolder in sorted(folder_path.iterdir()):
        if subfolder.is_dir() and not subfolder.name.startswith('.') and (subfolder / 'index.html').exists():
            subfolders.append(subfolder)
    
    return {
        'quizzes': quizzes,
        'subfolders': subfolders
    }

def update_index(folder_path, folder_info):
    """Update or create index.html for a folder."""
    # This is a simplified version - in production, you'd use the full gen_index_html
    # For now, we just ensure the folder has been scanned
    pass

def main():
    root = Path('.')
    
    # Scan root folder
    root_info = scan_folder(root)
    if root_info:
        print(f"Found {len(root_info['quizzes'])} quiz files in root")
        for sf in root_info['subfolders']:
            sf_info = scan_folder(sf)
            if sf_info:
                print(f"  {sf.name}: {len(sf_info['quizzes'])} quiz files")
                update_index(sf, sf_info)
    
    print("Auto-index complete")

if __name__ == '__main__':
    main()
'''

# Read icon files if they exist
def read_icon(name):
    p = BASE_DIR / name
    if p.exists():
        return p.read_bytes()
    return None

ICON_FILES = {}
for icon_name in ['icon-48.png', 'icon-72.png', 'icon-96.png', 'icon-144.png', 'icon-192.png', 'icon-512.png']:
    data = read_icon(icon_name)
    if data:
        ICON_FILES[icon_name] = data

MANIFEST_JSON = lambda name: json.dumps({
    "name": f"{name} Quiz",
    "short_name": f"{name} Quiz",
    "description": f"{name} Interactive Quiz. Test your knowledge.",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#0d1117",
    "icons": [
        {
            "src": "favicon.svg",
            "sizes": "any",
            "type": "image/svg+xml",
            "purpose": "any"
        },
        {
            "src": "icon-48.png",
            "sizes": "48x48",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "icon-72.png",
            "sizes": "72x72",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "icon-96.png",
            "sizes": "96x96",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "icon-144.png",
            "sizes": "144x144",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any maskable"
        },
        {
            "src": "icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ]
}, indent=2)

FOOTER_NOTE = 'Made By: <a href="https://github.com/eyad-elghareeb/QuizTool" target="_blank" rel="noopener noreferrer">QuizTool</a>'

# ============================================================
#  GITHUB WORKFLOWS
# ============================================================

SYNC_WORKFLOW_YML = '''name: Sync Quiz Assets

on:
  push:
    branches: ["main"]
    paths:
      - "**/*.html"
      - "**/*.js"
      - "**/*.css"
      - "**/*.svg"
      - "**/*.png"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.x"

      - name: Update generated quiz assets
        run: python scripts/sync_quiz_assets.py


      - name: Commit generated changes
        run: |
          if git diff --quiet; then
            echo "No generated changes to commit."
            exit 0
          fi

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          # Add all changes except scripts folder
          git add -- ':!scripts/'

          if git diff --cached --quiet; then
            echo "No changes to commit (scripts changes excluded)."
            exit 0
          fi

          git commit -m "chore: sync quiz assets"
          git push
'''

DEPLOY_WORKFLOW_YML = '''name: Deploy to GitHub Pages

on:
  workflow_run:
    workflows: ["Sync Quiz Assets"]
    types:
      - completed

  push:
    branches: ["main"]

  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    if: github.event_name == 'push' || github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_run' && 'refs/heads/main' || github.ref }}
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Build with Jekyll
        uses: actions/jekyll-build-pages@v1
        with:
          source: ./
          destination: ./_site
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3

  deploy:
    if: github.event_name == 'push' || github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
'''

NETLIFY_TOML = '''# Netlify static deploy configuration for QuizTool-generated sites.
# The generator deploys the project root directly, with no build step.
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json"
'''

VERCEL_JSON = '''{
  "version": 2,
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [
        { "key": "Content-Type", "value": "application/manifest+json" }
      ]
    }
  ]
}
'''

GITIGNORE_CONTENT = '''# Compiled and build artifacts
*.pyc
__pycache__/
*.o
*.obj
*.class
*.exe
*.dll
*.so
*.a
*.out

# Dependencies
node_modules/
venv/
.venv/
.env
.env.local
.env.*

# Logs and temp files
*.log
*.tmp
*.swp
*.swo

# Editors
.vscode/
.idea/

# System files
.DS_Store
Thumbs.db

# Coverage
coverage/
htmlcov/
.coverage

# Build directories
dist/
build/
target/
.gradle/

# Python cache
.mypy_cache/
.pytest_cache/

# Compressed files
*.zip
*.gz
*.tar
*.tgz
*.bz2
*.xz
*.7z
*.rar

# Local helpers
admin-dashboard.bat
QuizTool-Admin.exe
.quiztool/
.qwen/
'''

# ============================================================
#  INDEX HTML GENERATOR  (mirrors MU61S8 index structure)
# ============================================================

def gen_index_html(topbar_title, hero_title, hero_desc, quizzes,
                     engine_prefix='', parent_path=None):
    """
    Generate an index.html that uses index-engine.js.
    engine_prefix is relative path to the engine files (e.g. '../' for subfolders).
    parent_path is the relative path to the parent index.html (one level up).
    """
    q_json = json.dumps(quizzes, indent=2)
    sw_path = engine_prefix + 'sw.js'
    manifest_path = engine_prefix + 'manifest.webmanifest'
    favicon_path = engine_prefix + 'favicon.svg'
    engine_path = engine_prefix + 'index-engine.js'
    css_path = engine_prefix + 'index-engine.css'

    back_btn = ''
    if parent_path:
        back_btn = f'<a href="{parent_path}/index.html" class="icon-btn back-btn" title="Back to Parent">\u2190</a>\n    '
    elif engine_prefix:
        # Fallback to old behavior if no parent_path specified
        parent = engine_prefix.rstrip('/').rstrip('\\')
        back_btn = f'<a href="{parent}/index.html" class="icon-btn back-btn" title="Back to Home">\u2190</a>\n    '

    html = f'''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{topbar_title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{css_path}">
<meta name="description" content="{topbar_title} Interactive Quiz">
<meta name="theme-color" content="#0d1117">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="{manifest_path}">
<link rel="icon" href="{favicon_path}" type="image/svg+xml">
<link rel="apple-touch-icon" href="{favicon_path}">
</head>
<body>

  <div class="topbar">
    {back_btn}<div class="topbar-title">{topbar_title}</div>
    <button class="icon-btn btn-tracker" onclick="openTrackerDashboard()" title="Question Tracker">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 5-9"/></svg>
      <span class="tracker-badge" id="tracker-badge-count"></span>
    </button>
    <button class="icon-btn btn-sync" onclick="openSyncModal()" title="Sync Progress">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
    </button>
    <button class="icon-btn" id="theme-toggle" onclick="toggleTheme()" title="Toggle theme">☀</button>
  </div>

  <div class="container">
    <header class="hero">
      <h1>{hero_title}</h1>
      <p>{hero_desc}</p>
    </header>
    <div class="quiz-grid" id="quiz-grid"></div>
    <div class="footer-note">{FOOTER_NOTE}</div>
  </div>

<script>
const QUIZZES = {q_json};
</script>



<script src="{engine_path}"></script>
<script>
(function(){{var s=localStorage.getItem('quiz-theme');if(s)document.documentElement.setAttribute('data-theme',s);if(window.__updateThemeIcon)window.__updateThemeIcon();if(window.renderQuizzes)window.renderQuizzes();}})();
</script>
<script>
if('serviceWorker' in navigator){{window.addEventListener('load',function(){{navigator.serviceWorker.register('{sw_path}').catch(function(){{}});}});}}
</script>

</body>
</html>'''
    return html


# ============================================================
#  PROJECT BUILDER
# ============================================================

def build_project_zip(config):
    """
    Build a ZIP containing a full working quiz project.
    Mirrors the MU61S8 structure - quizzes only, no tools.
    Supports nested folders via path splitting.
    """
    buf = io.BytesIO()
    project_name = config.get('project_name', 'MyQuiz')
    
    all_file_paths = [
        'index-engine.js',
        'index-engine.css',
        'quiz-engine.js',
        'bank-engine.js',
        'flashcard-engine.js',
        'written-engine.js',
        'ai-assistant-engine.js',
        'sync-engine.js',
        'tracker-map.json',
        'favicon.svg',
        'manifest.webmanifest',
        'netlify.toml',
        'vercel.json'
    ]
    
    # Add icon files
    all_file_paths.extend([
        'icon-48.png', 'icon-72.png', 'icon-96.png',
        'icon-144.png', 'icon-192.png', 'icon-512.png'
    ])
    
    # Add quiz-engine-test.html if it exists
    if QUIZ_ENGINE_TEST_HTML:
        all_file_paths.append('quiz-engine-test.html')
    
    # Track all folder paths for root index
    all_folder_paths = []

    def process_folders_for_paths(folders, current_path=''):
        """Collect all file paths from folder structure."""
        for folder in folders:
            folder_name = folder['name']
            folder_path = f"{current_path}/{folder_name}" if current_path else folder_name
            all_folder_paths.append({
                'path': folder_path,
                'folder': folder
            })
            
            # Add folder index.html
            all_file_paths.append(f"{folder_path}/index.html")
            
            # Add quiz files from this folder
            for quiz in folder.get('quizzes', []):
                quiz_url = quiz.get('url', '')
                if quiz_url and not quiz_url.startswith('http'):
                    full_path = f"{folder_path}/{quiz_url}"
                    all_file_paths.append(full_path)
            
            # Process subfolders recursively
            if 'subfolders' in folder and folder['subfolders']:
                process_folders_for_paths(folder['subfolders'], folder_path)

    # Process all folders to collect paths
    process_folders_for_paths(config.get('folders', []))
    
    # Add root index.html
    all_file_paths.insert(0, 'index.html')
    
    # Add dropped files to paths
    dropped_files = config.get('dropped_files', {})
    for filename in dropped_files.keys():
        # Check if this file belongs to any folder
        placed = False
        for folder_info in all_folder_paths:
            folder = folder_info['folder']
            folder_path = folder_info['path']
            folder_quizzes = folder.get('quizzes', [])
            
            for quiz in folder_quizzes:
                if quiz.get('url') == filename:
                    full_path = f'{folder_path}/{filename}'
                    if full_path not in all_file_paths:
                        all_file_paths.append(full_path)
                    placed = True
                    break
            if placed:
                break
        
        # If not placed in any folder, it goes to root
        if not placed:
            if filename not in all_file_paths:
                all_file_paths.append(filename)
    
    # Sort paths for consistency
    all_file_paths.sort()
    
    # Generate service worker with all file paths
    sw_js_content = generate_sw_js(project_name, all_file_paths)

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:

        # --- Shared engines (root level) ---
        zf.writestr('index-engine.js', INDEX_ENGINE_JS)
        zf.writestr('index-engine.css', INDEX_ENGINE_CSS)
        zf.writestr('quiz-engine.js', QUIZ_ENGINE_JS)
        zf.writestr('bank-engine.js', BANK_ENGINE_JS)
        zf.writestr('flashcard-engine.js', FLASHCARD_ENGINE_JS)
        zf.writestr('written-engine.js', WRITTEN_ENGINE_JS)
        zf.writestr('ai-assistant-engine.js', AI_ASSISTANT_ENGINE_JS)
        zf.writestr('sync-engine.js', SYNC_ENGINE_JS)

        # --- Static assets ---
        zf.writestr('favicon.svg', FAVICON_SVG)
        zf.writestr('sw.js', sw_js_content)  # Use dynamically generated sw.js
        zf.writestr('manifest.webmanifest', MANIFEST_JSON(project_name))
        zf.writestr('netlify.toml', NETLIFY_TOML)
        zf.writestr('vercel.json', VERCEL_JSON)

        # --- Tracker Map (UID mapping) ---
        # Generate initial tracker map based on configured quizzes
        tracker_map = {}
        def collect_tracker_entries(folders, current_path=''):
            for folder in folders:
                folder_name = folder['name']
                folder_path = f"{current_path}/{folder_name}" if current_path else folder_name
                # Quizzes in this folder
                for quiz in folder.get('quizzes', []):
                    uid = quiz.get('uid')
                    url = quiz.get('url')
                    if uid and url:
                        tracker_map[uid] = {
                            "path": f"{folder_path}/{url}",
                            "folderPath": f"{folder_path}/"
                        }
                # Subfolders
                if 'subfolders' in folder and folder['subfolders']:
                    collect_tracker_entries(folder['subfolders'], folder_path)
        
        collect_tracker_entries(config.get('folders', []))
        zf.writestr('tracker-map.json', json.dumps(tracker_map, separators=(',', ':')))

        # --- Icon files (PNG icons for PWA) ---
        for icon_name, icon_data in ICON_FILES.items():
            zf.writestr(icon_name, icon_data)

        # --- Diagnostic test page ---
        if QUIZ_ENGINE_TEST_HTML:
            zf.writestr('quiz-engine-test.html', QUIZ_ENGINE_TEST_HTML)

        # --- Process folders (supports nested structure) ---
        # Track all folder paths for root index
        all_folder_paths = []
        
        def process_folders(folders, current_path=''):
            """Recursively process folders and create index pages."""
            for folder in folders:
                folder_name = folder['name']
                folder_path = f"{current_path}/{folder_name}" if current_path else folder_name
                all_folder_paths.append({
                    'path': folder_path,
                    'folder': folder
                })
                
                # Process subfolders recursively
                if 'subfolders' in folder and folder['subfolders']:
                    process_folders(folder['subfolders'], folder_path)
        
        # Process all folders and build the path list
        process_folders(config.get('folders', []))
        
        # --- Root index.html ---
        root_quizzes = []
        for folder_info in all_folder_paths:
            folder = folder_info['folder']
            folder_path = folder_info['path']
            
            # Only show top-level folders in root index
            if '/' not in folder_path:
                root_quizzes.append({
                    'title': f"{folder.get('icon', '📁')} {folder['name']}",
                    'description': folder.get('description', ''),
                    'icon': folder.get('icon', '📁'),
                    'tags': ['Folder'],
                    'url': f"{folder_path}/index.html"
                })

        root_html = gen_index_html(
            topbar_title=config.get('topbar_title', project_name),
            hero_title=config.get('hero_title', 'Select Your <span>Subject</span>'),
            hero_desc=config.get('hero_description',
                                 'Test your knowledge across various subjects. Choose a subject below to begin.'),
            quizzes=root_quizzes,
            engine_prefix=''
        )
        zf.writestr('index.html', root_html)

        # --- Folder index pages (supports nested) ---
        def create_folder_indexes(folders, parent_path=''):
            """Create index.html for each folder, handling nested structure."""
            for folder in folders:
                folder_name = folder['name']
                folder_path = f"{parent_path}/{folder_name}" if parent_path else folder_name

                # Collect quizzes for this folder
                folder_quizzes = folder.get('quizzes', [])

                # Add links to subfolders
                subfolder_links = []
                if 'subfolders' in folder and folder['subfolders']:
                    for subfolder in folder['subfolders']:
                        subfolder_links.append({
                            'title': f"{subfolder.get('icon', '📁')} {subfolder['name']}",
                            'description': subfolder.get('description', ''),
                            'icon': subfolder.get('icon', '📁'),
                            'tags': ['Folder'],
                            'url': f"{subfolder['name']}/index.html"
                        })

                # Combine subfolder links + quizzes
                all_quizzes = subfolder_links + folder_quizzes

                # Calculate engine prefix based on depth
                depth = folder_path.count('/') + 1
                engine_prefix = '../' * depth
                
                # Calculate parent path (one level up)
                # If folder_path is "Cardiology/Exams", parent is "Cardiology"
                # If folder_path is "Cardiology", parent is "" (root)
                path_parts = folder_path.split('/')
                folder_parent_path = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''

                # Create hero text
                hero_title = f"Select your <span>{folder_name}</span> exam"
                hero_desc = f"Test your knowledge across various {folder_name.lower()} topics. Choose an exam below to begin."

                folder_html = gen_index_html(
                    topbar_title=f"{config.get('topbar_title', project_name)} - {folder_path.replace('/', ' / ')}",
                    hero_title=hero_title,
                    hero_desc=hero_desc,
                    quizzes=all_quizzes,
                    engine_prefix=engine_prefix,
                    parent_path=folder_parent_path
                )
                zf.writestr(f'{folder_path}/index.html', folder_html)

                # Recursively process subfolders
                if 'subfolders' in folder and folder['subfolders']:
                    create_folder_indexes(folder['subfolders'], folder_path)
        
        create_folder_indexes(config.get('folders', []))

        # --- Include dropped quiz/bank files ---
        dropped_files = config.get('dropped_files', {})
        topbar_title = config.get('topbar_title', project_name)

        for filename, file_content in dropped_files.items():
            # Try to determine which folder this file belongs to
            # Check if file is referenced in any folder's quizzes
            placed = False

            for folder_info in all_folder_paths:
                folder = folder_info['folder']
                folder_path = folder_info['path']
                folder_quizzes = folder.get('quizzes', [])

                # Check if any quiz in this folder references this file
                for quiz in folder_quizzes:
                    if quiz.get('url') == filename:
                        # Optionally update the file's title tag to include project name
                        # (Only if it has a standard <title> tag)
                        import re
                        modified_content = re.sub(
                            r'<title>.*?</title>',
                            f'<title>{topbar_title} - {quiz.get("title", filename)}</title>',
                            file_content
                        )

                        # Place file in this folder
                        full_path = f'{folder_path}/{filename}'
                        zf.writestr(full_path, modified_content)
                        
                        # Add to precache paths if not already there
                        if full_path not in all_file_paths:
                            all_file_paths.append(full_path)
                        
                        placed = True
                        break

                if placed:
                    break

            # If not placed in any folder, put in root
            if not placed:
                zf.writestr(filename, file_content)
                # Add to precache paths if not already there
                if filename not in all_file_paths:
                    all_file_paths.append(filename)
        
        # --- Scripts folder (for asset synchronization and admin dashboard) ---
        if SYNC_SCRIPT:
            zf.writestr('scripts/sync_quiz_assets.py', SYNC_SCRIPT)
        if STANDARDIZE_SCRIPT:
            zf.writestr('scripts/standardize_quiz_files.py', STANDARDIZE_SCRIPT)
        if ADMIN_DASHBOARD_SCRIPT:
            zf.writestr('scripts/admin-dashboard.py', ADMIN_DASHBOARD_SCRIPT)
            
        # --- Native Admin App ---
        if QUIZTOOL_ADMIN_EXE:
            zf.writestr('QuizTool-Admin.exe', QUIZTOOL_ADMIN_EXE)

        # --- GitHub Workflows ---
        zf.writestr('.github/workflows/sync-quiz-assets.yml', SYNC_WORKFLOW_YML)
        zf.writestr('.github/workflows/jekyll-gh-pages.yml', DEPLOY_WORKFLOW_YML)

        # --- .gitignore ---
        zf.writestr('.gitignore', GITIGNORE_CONTENT)

        # --- Local admin dashboard launcher (gitignored) ---
        admin_bat = f'''@echo off
REM Launch the local admin dashboard for the {project_name} project.
REM This file is intended for local use only and is gitignored.
cd /d "%~dp0"
python "scripts\\admin-dashboard.py"
'''
        zf.writestr('admin-dashboard.bat', admin_bat)

    buf.seek(0)
    return buf


# ============================================================
#  WEB UI TEMPLATE
# ============================================================

WEB_UI_HTML = read_file('generator_templates/index.html')


# ============================================================
#  GITHUB API HELPERS
# ============================================================

def _gh_request(method, path, token, json_data=None, timeout=30):
    """Make an authenticated GitHub API request. Returns (status_code, json_or_None)."""
    import urllib.request
    import urllib.error

    url = f'https://api.github.com{path}'
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'QuizTool-Generator',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    body = json.dumps(json_data).encode() if json_data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    if body:
        req.add_header('Content-Type', 'application/json')

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp_data = resp.read().decode('utf-8')
            return resp.status, json.loads(resp_data) if resp_data else None
    except urllib.error.HTTPError as e:
        resp_data = e.read().decode('utf-8') if e.fp else ''
        try:
            return e.code, json.loads(resp_data)
        except Exception:
            return e.code, {'message': resp_data}
    except Exception as e:
        return 0, {'message': str(e)}


def _http_json_request(method, url, token=None, json_data=None, body=None, headers=None, timeout=60):
    """Make a JSON-oriented HTTPS request with optional bearer token auth."""
    import urllib.request
    import urllib.error

    req_headers = {
        'User-Agent': 'QuizTool-Generator'
    }
    if token:
        req_headers['Authorization'] = f'Bearer {token}'
    if headers:
        req_headers.update(headers)

    req_body = body
    if json_data is not None:
        req_body = json.dumps(json_data).encode('utf-8')
        req_headers['Content-Type'] = 'application/json'

    req = urllib.request.Request(url, data=req_body, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp_data = resp.read()
            text = resp_data.decode('utf-8') if resp_data else ''
            try:
                parsed = json.loads(text) if text else None
            except Exception:
                parsed = {'message': text}
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        resp_data = e.read().decode('utf-8') if e.fp else ''
        try:
            return e.code, json.loads(resp_data)
        except Exception:
            return e.code, {'message': resp_data}
    except Exception as e:
        return 0, {'message': str(e)}


def _netlify_request(method, path, token, json_data=None, body=None, content_type=None, timeout=60):
    headers = {}
    if content_type:
        headers['Content-Type'] = content_type
    return _http_json_request(
        method,
        f'https://api.netlify.com/api/v1{path}',
        token=token,
        json_data=json_data,
        body=body,
        headers=headers,
        timeout=timeout
    )


def _vercel_request(method, path, token, json_data=None, timeout=60):
    return _http_json_request(
        method,
        f'https://api.vercel.com{path}',
        token=token,
        json_data=json_data,
        timeout=timeout
    )


def _safe_project_slug(project_name, fallback='quiz-project'):
    """Create a hosting-safe slug while preserving readable project names."""
    slug = re.sub(r'[^a-zA-Z0-9._-]', '-', project_name or '').strip('-._').lower()
    slug = re.sub(r'-{2,}', '-', slug)
    return slug or fallback


def _write_deploy_metadata(project_dir, metadata):
    """Persist non-secret provider deployment metadata for the admin dashboard."""
    deploy_dir = Path(project_dir) / '.quiztool'
    deploy_dir.mkdir(parents=True, exist_ok=True)
    deploy_path = deploy_dir / 'deploy.json'
    deploy_path.write_text(json.dumps(metadata, indent=2), encoding='utf-8')


def _save_zip_to_project_dir(zip_buf, project_name):
    """Extract an already-built ZIP into the persistent local project directory."""
    safe_name = _safe_project_slug(project_name)
    project_dir = _get_projects_dir() / safe_name
    os.makedirs(project_dir, exist_ok=True)

    zip_buf.seek(0)
    with zipfile.ZipFile(zip_buf, 'r') as zf:
        zf.extractall(project_dir)

    _active_projects[safe_name] = {'path': str(project_dir), 'admin_pid': None}
    return str(project_dir)


def _zip_entries_for_vercel(zip_buf):
    """Convert a generated project ZIP into Vercel's inline file payload."""
    files = []
    zip_buf.seek(0)
    with zipfile.ZipFile(zip_buf, 'r') as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            content = zf.read(info.filename)
            files.append({
                'file': info.filename.replace('\\', '/'),
                'data': base64.b64encode(content).decode('ascii'),
                'encoding': 'base64'
            })
    return files


def _get_projects_dir():
    """Get the directory where generated projects are stored.

    When running from source: projects go next to the QuizTool repo.
        e.g. /some/path/QuizTool -> /some/path/<project_name>

    When running as a PyInstaller EXE: projects go next to the EXE.
        e.g. C:/Users/Eyad/Desktop/QuizTool-Generator.exe
             -> C:/Users/Eyad/Desktop/<project_name>
    """
    if _FROZEN:
        # sys.executable is the EXE path in frozen mode
        return Path(sys.executable).parent
    return BASE_DIR.parent


def _ensure_tool(tool_name, winget_id=None, post_install_hook=None):
    """Ensure a CLI tool is available on PATH. If missing and running on
    Windows with winget, offer to install it automatically.

    Args:
        tool_name: Name to search on PATH (e.g. 'git', 'python')
        winget_id: winget package ID for auto-install (e.g. 'Git.Git')
        post_install_hook: Optional callable after install (e.g. pip install flask)

    Returns:
        (exe_path, message) — exe_path is the full path if found, None if not.
        message describes what happened (found, installed, or failed).
    """
    import shutil as _shutil
    exe = _shutil.which(tool_name) or _shutil.which(tool_name + '.exe')
    if exe:
        return exe, f'{tool_name} found at {exe}'

    # Not on PATH — try winget auto-install (Windows only)
    if sys.platform == 'win32' and winget_id:
        winget = _shutil.which('winget')
        if winget:
            try:
                # Install with winget (--accept-source-agreements avoids interactive prompts)
                result = subprocess.run(
                    [winget, 'install', '--id', winget_id, '-e', '--accept-source-agreements',
                     '--accept-package-agreements'],
                    capture_output=True, text=True, timeout=300
                )
                if result.returncode == 0:
                    # Re-check PATH after install
                    exe = _shutil.which(tool_name) or _shutil.which(tool_name + '.exe')
                    if exe:
                        # Run post-install hook (e.g. pip install flask)
                        if post_install_hook:
                            try:
                                post_install_hook(exe)
                            except Exception:
                                pass
                        return exe, f'{tool_name} installed via winget'
                    # winget may require a new shell to see the PATH change
                    return None, (f'{tool_name} was installed via winget but requires a terminal '
                                  f'restart to take effect. Please close and reopen this application.')
                else:
                    return None, f'winget install failed: {result.stderr.strip()}'
            except Exception as e:
                return None, f'winget install error: {e}'

    return None, (f'{tool_name} is not installed and winget is not available. '
                   f'Please install {tool_name} manually.')


def _install_flask(python_exe):
    """pip install flask using the given Python executable."""
    subprocess.run(
        [python_exe, '-m', 'pip', 'install', 'flask', '--quiet'],
        capture_output=True, timeout=120
    )


def _robust_rmtree(path):
    """Delete a directory tree, handling Windows-specific issues.

    Handles two common Windows failures:
    - Read-only files (git objects): clears the read-only bit before deletion.
    - File-in-use errors ([WinError 32]): retries with a small delay,
      because git or antivirus may briefly hold a handle on files.
    """
    if not os.path.exists(path):
        return

    def _on_error(func, path, exc_info):
        """onerror/onexc callback: clear read-only bit and retry."""
        import time
        if isinstance(exc_info[1], PermissionError):
            # Try making the file writable
            try:
                os.chmod(path, 0o777)
            except OSError:
                pass
            # Retry up to 3 times with a short delay (file may be briefly locked)
            for attempt in range(3):
                try:
                    func(path)
                    return
                except PermissionError:
                    time.sleep(0.3 * (attempt + 1))
            # Final attempt — let it raise
            func(path)
        else:
            raise

    shutil.rmtree(path, onexc=_on_error)


def _extract_and_push(config, token, repo_name, username):
    """Extract ZIP to project dir, git init, commit, push to GitHub.

    The project directory persists after this call so the admin dashboard
    and future content additions work.  On re-runs, existing files are
    overwritten in-place — any user-added content is preserved.

    Security: Uses GIT_ASKPASS to provide the token via a temp script
    instead of embedding it in the remote URL, which avoids leaking
    the token into .git/config or the process argument list.
    """
    # Ensure git is available (auto-install via winget if missing)
    git_exe, git_msg = _ensure_tool('git', winget_id='Git.Git')
    if not git_exe:
        raise Exception(f'Git is required for publishing. {git_msg}')

    zip_buf = build_project_zip(config)

    # Create project directory as sibling of QuizTool (do NOT delete — must persist for admin dashboard)
    project_dir = _get_projects_dir() / repo_name
    os.makedirs(project_dir, exist_ok=True)

    # Extract ZIP into project dir
    with zipfile.ZipFile(zip_buf, 'r') as zf:
        zf.extractall(project_dir)

    # Create a temporary GIT_ASKPASS script to securely provide the token
    # This avoids embedding the token in the remote URL (which persists in .git/config)
    askpass_dir = os.path.join(tempfile.gettempdir(), 'quiztool-askpass')
    os.makedirs(askpass_dir, exist_ok=True)
    askpass_script = os.path.join(askpass_dir, f'askpass-{repo_name}.bat')
    with open(askpass_script, 'w') as f:
        f.write('@echo %GIT_PASSWORD%\n')

    # Set up environment with the token
    push_env = os.environ.copy()
    push_env['GIT_PASSWORD'] = token
    push_env['GIT_ASKPASS'] = askpass_script
    push_env['GIT_TERMINAL_PROMPT'] = '0'  # Never prompt interactively

    # Use a clean remote URL (no token embedded)
    remote_url = f'https://{username}@github.com/{username}/{repo_name}.git'

    git_cmds = [
        ['git', 'init'],
        ['git', 'config', 'user.name', username],
        ['git', 'config', 'user.email', f'{username}@users.noreply.github.com'],
        ['git', 'remote', 'add', 'origin', remote_url],
        ['git', 'add', '-A'],
        ['git', 'commit', '-m', 'Initial commit from QuizTool Generator'],
        ['git', 'branch', '-M', 'main'],
        ['git', 'push', '-u', 'origin', 'main'],
    ]

    try:
        for cmd in git_cmds:
            result = subprocess.run(cmd, cwd=project_dir, capture_output=True,
                                    text=True, timeout=120, env=push_env)
            if result.returncode != 0:
                if 'push' in cmd:
                    raise Exception(f'Git push failed: {result.stderr}')
                elif 'remote' in cmd and 'add' in cmd:
                    # remote add may fail if origin already exists — update URL instead
                    subprocess.run(['git', 'remote', 'set-url', 'origin', remote_url],
                                   cwd=project_dir, capture_output=True, timeout=30)
                elif 'init' not in cmd and 'config' not in cmd and 'branch' not in cmd:
                    raise Exception(f'Git command failed ({cmd[0]}): {result.stderr}')
    finally:
        # Clean up the askpass script immediately after use
        try:
            os.remove(askpass_script)
        except OSError:
            pass

    return str(project_dir)


# ============================================================
#  ACTIVE PROJECT TRACKING (for admin dashboard launch)
# ============================================================

_active_projects = {}  # repo_name -> {'path': str, 'admin_pid': int|None}


# ============================================================
#  FLASK ROUTES
# ============================================================

@app.route('/')
def index():
    return render_template_string(WEB_UI_HTML)


@app.route('/api/generate', methods=['POST'])
def generate():
    config = request.json
    try:
        zip_buf = build_project_zip(config)
        project_name = config.get('project_name', 'MyQuiz')
        # Sanitize filename
        safe_name = ''.join(c if c.isalnum() or c in ' _-' else '_' for c in project_name).strip()
        return send_file(
            zip_buf,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'{safe_name}.zip'
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/preview', methods=['POST'])
def preview():
    config = request.json
    folders = config.get('folders', [])

    def count_items(folder_list):
        """Recursively count quizzes and folders."""
        total_quizzes = 0
        total_folders = 0
        for folder in folder_list:
            total_folders += 1
            total_quizzes += len(folder.get('quizzes', []))
            if 'subfolders' in folder and folder['subfolders']:
                sub_folders, sub_quizzes = count_items(folder['subfolders'])
                total_folders += sub_folders
                total_quizzes += sub_quizzes
        return total_folders, total_quizzes

    total_folders, total_quizzes = count_items(folders)
    # engines/styles + sw + manifest + favicon + icons + provider configs + root index + folder indexes + scripts + workflows + gitignore + optional test page
    estimated_files = 18 + total_folders + total_quizzes
    return jsonify({
        'project_name': config.get('project_name', ''),
        'total_folders': total_folders,
        'total_quizzes': total_quizzes,
        'estimated_files': estimated_files
    })


# ── GitHub Auth ──

@app.route('/api/github/verify', methods=['POST'])
def github_verify():
    """Verify a GitHub PAT, check scopes, and return the authenticated user info."""
    token = request.json.get('token', '').strip()
    if not token:
        return jsonify({'ok': False, 'error': 'Token is required'}), 400

    import urllib.request
    import urllib.error

    url = 'https://api.github.com/user'
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'QuizTool-Generator',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            # Check scopes from response header
            scopes_header = resp.headers.get('X-OAuth-Scopes', '')
            scopes = [s.strip() for s in scopes_header.split(',') if s.strip()]
            missing = []
            if 'repo' not in scopes:
                missing.append('repo')
            if 'workflow' not in scopes:
                missing.append('workflow')

            if missing:
                return jsonify({
                    'ok': False,
                    'error': f'Token is missing required scopes: {", ".join(missing)}. Please create a new token with repo and workflow scopes.',
                    'username': data.get('login', ''),
                }), 403

            return jsonify({
                'ok': True,
                'username': data.get('login', ''),
                'name': data.get('name', '') or data.get('login', ''),
                'avatar': data.get('avatar_url', ''),
                'repos_count': data.get('public_repos', 0)
            })
    except urllib.error.HTTPError as e:
        msg = 'Invalid token'
        try:
            err_data = json.loads(e.read().decode('utf-8'))
            msg = err_data.get('message', msg)
        except Exception:
            pass
        return jsonify({'ok': False, 'error': msg}), 401
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


# ── GitHub Publish ──

@app.route('/api/github/publish', methods=['POST'])
def github_publish():
    """Create a GitHub repo, push project, and enable Pages."""
    payload = request.json
    token = payload.get('token', '').strip()
    config = payload.get('config', {})
    visibility = payload.get('visibility', 'public')  # public or private

    if not token:
        return jsonify({'ok': False, 'error': 'Token is required'}), 400
    if not config.get('project_name'):
        return jsonify({'ok': False, 'error': 'Project name is required'}), 400

    # Step 1: Verify token and get username
    status, user_data = _gh_request('GET', '/user', token)
    if status != 200 or not user_data:
        return jsonify({'ok': False, 'error': 'Invalid GitHub token'}), 401

    username = user_data['login']
    repo_name = re.sub(r'[^a-zA-Z0-9._-]', '-', config['project_name']).strip('-')

    if not repo_name:
        return jsonify({'ok': False, 'error': 'Invalid project name for repo'}), 400

    # Step 2: Create repository
    create_body = {
        'name': repo_name,
        'description': f'{config.get("topbar_title", repo_name)} — Quiz Site powered by QuizTool',
        'private': visibility == 'private',
        'auto_init': False
    }
    status, repo_data = _gh_request('POST', '/user/repos', token, create_body)

    if status == 422 and repo_data:
        # Repo already exists — try to push to it
        errors = repo_data.get('errors', [])
        if any(e.get('message', '').startswith('name already exists') for e in errors):
            # Check if user owns it
            check_status, _ = _gh_request('GET', f'/repos/{username}/{repo_name}', token)
            if check_status == 200:
                pass  # Will try to push below
            else:
                return jsonify({'ok': False, 'error': f'Repository "{repo_name}" already exists and belongs to another user'}), 409
        elif status != 201:
            msg = repo_data.get('message', 'Failed to create repository') if repo_data else 'Failed to create repository'
            return jsonify({'ok': False, 'error': msg}), status

    elif status != 201:
        msg = repo_data.get('message', 'Failed to create repository') if repo_data else 'Failed to create repository'
        return jsonify({'ok': False, 'error': msg}), status

    # Step 3: Extract and push
    try:
        project_dir = _extract_and_push(config, token, repo_name, username)
    except Exception as e:
        # Still track the extracted project directory so admin dashboard can be used
        project_dir = _get_projects_dir() / repo_name
        if project_dir.exists():
            _active_projects[repo_name] = {'path': str(project_dir), 'admin_pid': None}
        # Do NOT delete the repo — it may contain user content.
        # Instead, inform the user so they can decide what to do.
        return jsonify({
            'ok': False,
            'project_dir': str(project_dir) if project_dir.exists() else None,
            'error': f'Git push failed: {str(e)}. The repository "{repo_name}" was created on GitHub but is empty. You can push manually or delete it from GitHub settings.'
        }), 500

    # Track for admin dashboard launch
    _active_projects[repo_name] = {'path': project_dir, 'admin_pid': None}

    # Step 4: Enable GitHub Pages (with Actions source)
    # Wait a moment for GitHub to register the repo
    import time
    time.sleep(2)

    pages_body = {
        'build_type': 'workflow'
    }
    pages_status, pages_data = _gh_request('POST', f'/repos/{username}/{repo_name}/pages', token, pages_body)

    pages_warning = None
    if pages_status not in (200, 201):
        # Pages may fail if the repo is private without Pro, or if it needs time
        pages_warning = 'GitHub Pages could not be enabled automatically. Please enable it manually in your repository settings under Pages → Source → GitHub Actions.'

    repo_url = f'https://github.com/{username}/{repo_name}'
    pages_url = f'https://{username}.github.io/{repo_name}/'

    _write_deploy_metadata(project_dir, {
        'provider': 'github',
        'projectName': repo_name,
        'liveUrl': pages_url,
        'providerUrl': repo_url,
        'github': {
            'owner': username,
            'repo': repo_name,
            'branch': 'main'
        }
    })

    result = {
        'ok': True,
        'repo_url': repo_url,
        'pages_url': pages_url,
        'repo_name': repo_name,
        'username': username,
        'project_dir': project_dir
    }
    if pages_warning:
        result['pages_warning'] = pages_warning

    return jsonify(result)


# ── Netlify Auth / Publish ──

@app.route('/api/netlify/verify', methods=['POST'])
def netlify_verify():
    """Verify a Netlify personal access token and return user info."""
    token = request.json.get('token', '').strip()
    if not token:
        return jsonify({'ok': False, 'error': 'Token is required'}), 400

    status, data = _netlify_request('GET', '/user', token, timeout=15)
    if status != 200 or not data:
        msg = data.get('message', 'Invalid Netlify token') if data else 'Invalid Netlify token'
        return jsonify({'ok': False, 'error': msg}), 401

    display_name = data.get('full_name') or data.get('name') or data.get('email') or data.get('slug') or 'Netlify user'
    username = data.get('slug') or data.get('email') or display_name

    return jsonify({
        'ok': True,
        'username': username,
        'name': display_name,
        'avatar': data.get('avatar_url', ''),
        'email': data.get('email', '')
    })


@app.route('/api/netlify/publish', methods=['POST'])
def netlify_publish():
    """Create a Netlify site and deploy the generated project ZIP through the API."""
    payload = request.json
    token = payload.get('token', '').strip()
    config = payload.get('config', {})

    if not token:
        return jsonify({'ok': False, 'error': 'Token is required'}), 400
    if not config.get('project_name'):
        return jsonify({'ok': False, 'error': 'Project name is required'}), 400

    # Verify token first so provider errors are clearer.
    status, user_data = _netlify_request('GET', '/user', token, timeout=15)
    if status != 200 or not user_data:
        return jsonify({'ok': False, 'error': 'Invalid Netlify token'}), 401

    import secrets
    import time

    requested_name = _safe_project_slug(config.get('project_name'))
    site_name = requested_name
    create_body = {'name': site_name}
    status, site_data = _netlify_request('POST', '/sites', token, json_data=create_body, timeout=30)

    if status in (400, 409, 422):
        # Netlify site names are global. Keep the flow seamless by retrying once
        # with a short suffix instead of making the user rename the project.
        site_name = f'{requested_name}-{secrets.token_hex(3)}'
        status, site_data = _netlify_request('POST', '/sites', token, json_data={'name': site_name}, timeout=30)

    if status not in (200, 201) or not site_data:
        msg = site_data.get('message', 'Failed to create Netlify site') if site_data else 'Failed to create Netlify site'
        return jsonify({'ok': False, 'error': msg}), status if status else 500

    site_id = site_data.get('id') or site_data.get('site_id') or site_data.get('name')
    if not site_id:
        return jsonify({'ok': False, 'error': 'Netlify did not return a site ID'}), 500

    zip_buf = build_project_zip(config)
    project_dir = _save_zip_to_project_dir(zip_buf, config.get('project_name', site_name))

    zip_bytes = zip_buf.getvalue()
    deploy_status, deploy_data = _netlify_request(
        'POST',
        f'/sites/{site_id}/deploys',
        token,
        body=zip_bytes,
        content_type='application/zip',
        timeout=120
    )

    if deploy_status not in (200, 201) or not deploy_data:
        msg = deploy_data.get('message', 'Failed to upload ZIP deploy to Netlify') if deploy_data else 'Failed to upload ZIP deploy to Netlify'
        return jsonify({'ok': False, 'project_dir': project_dir, 'error': msg}), deploy_status if deploy_status else 500

    deploy_id = deploy_data.get('id')
    deploy_state = deploy_data.get('state')
    publish_warning = None

    if deploy_id and deploy_state != 'ready':
        deadline = time.time() + 90
        while time.time() < deadline:
            time.sleep(2)
            poll_status, poll_data = _netlify_request('GET', f'/deploys/{deploy_id}', token, timeout=20)
            if poll_status == 200 and poll_data:
                deploy_data = poll_data
                deploy_state = poll_data.get('state')
                if deploy_state == 'ready':
                    break
                if deploy_state in ('error', 'failed'):
                    msg = poll_data.get('error_message') or poll_data.get('message') or 'Netlify deploy failed'
                    return jsonify({'ok': False, 'project_dir': project_dir, 'error': msg}), 500
        if deploy_state != 'ready':
            publish_warning = 'Netlify accepted the deploy, but it is still processing. The live URL should start working shortly.'

    live_url = (
        deploy_data.get('ssl_url') or
        deploy_data.get('deploy_ssl_url') or
        site_data.get('ssl_url') or
        site_data.get('url') or
        f'https://{site_name}.netlify.app'
    )
    admin_url = site_data.get('admin_url') or f'https://app.netlify.com/sites/{site_name}/overview'

    _write_deploy_metadata(project_dir, {
        'provider': 'netlify',
        'projectName': site_name,
        'liveUrl': live_url,
        'providerUrl': admin_url,
        'netlify': {
            'siteId': site_id,
            'siteName': site_name
        }
    })

    result = {
        'ok': True,
        'provider': 'netlify',
        'site_name': site_name,
        'live_url': live_url,
        'provider_url': admin_url,
        'provider_label': 'Netlify Site',
        'project_dir': project_dir
    }
    if publish_warning:
        result['publish_warning'] = publish_warning
    return jsonify(result)


# ── Vercel Auth / Publish ──

@app.route('/api/vercel/verify', methods=['POST'])
def vercel_verify():
    """Verify a Vercel access token and return user info."""
    token = request.json.get('token', '').strip()
    if not token:
        return jsonify({'ok': False, 'error': 'Token is required'}), 400

    status, data = _vercel_request('GET', '/v2/user', token, timeout=15)
    if status != 200 or not data:
        msg = data.get('error', {}).get('message') or data.get('message', 'Invalid Vercel token') if data else 'Invalid Vercel token'
        return jsonify({'ok': False, 'error': msg}), 401

    user = data.get('user', data)
    avatar = user.get('avatar', '')
    if avatar and not avatar.startswith('http'):
        avatar = f'https://vercel.com/api/www/avatar/{avatar}'

    return jsonify({
        'ok': True,
        'username': user.get('username') or user.get('email') or user.get('id', ''),
        'name': user.get('name') or user.get('username') or user.get('email') or 'Vercel user',
        'avatar': avatar,
        'email': user.get('email', '')
    })


@app.route('/api/vercel/publish', methods=['POST'])
def vercel_publish():
    """Create a production Vercel deployment directly from generated files."""
    payload = request.json
    token = payload.get('token', '').strip()
    config = payload.get('config', {})

    if not token:
        return jsonify({'ok': False, 'error': 'Token is required'}), 400
    if not config.get('project_name'):
        return jsonify({'ok': False, 'error': 'Project name is required'}), 400

    status, user_data = _vercel_request('GET', '/v2/user', token, timeout=15)
    if status != 200 or not user_data:
        return jsonify({'ok': False, 'error': 'Invalid Vercel token'}), 401

    import time

    project_name = _safe_project_slug(config.get('project_name'))
    zip_buf = build_project_zip(config)
    project_dir = _save_zip_to_project_dir(zip_buf, config.get('project_name', project_name))
    vercel_files = _zip_entries_for_vercel(zip_buf)

    deploy_body = {
        'name': project_name,
        'project': project_name,
        'target': 'production',
        'files': vercel_files,
        'projectSettings': {
            'framework': None,
            'buildCommand': None,
            'devCommand': None,
            'installCommand': None,
            'outputDirectory': None
        },
        'meta': {
            'source': 'quiztool-generator'
        }
    }

    deploy_status, deploy_data = _vercel_request(
        'POST',
        '/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1',
        token,
        json_data=deploy_body,
        timeout=180
    )

    if deploy_status not in (200, 201) or not deploy_data:
        err = deploy_data.get('error', {}) if deploy_data else {}
        msg = err.get('message') or deploy_data.get('message', 'Failed to create Vercel deployment') if deploy_data else 'Failed to create Vercel deployment'
        return jsonify({'ok': False, 'project_dir': project_dir, 'error': msg}), deploy_status if deploy_status else 500

    deployment_id = deploy_data.get('id')
    ready_state = deploy_data.get('readyState') or deploy_data.get('status')
    publish_warning = None

    if deployment_id and ready_state not in ('READY', 'ERROR', 'CANCELED'):
        deadline = time.time() + 90
        while time.time() < deadline:
            time.sleep(2)
            poll_status, poll_data = _vercel_request('GET', f'/v13/deployments/{deployment_id}', token, timeout=20)
            if poll_status == 200 and poll_data:
                deploy_data = poll_data
                ready_state = poll_data.get('readyState') or poll_data.get('status')
                if ready_state in ('READY', 'ERROR', 'CANCELED'):
                    break

    if ready_state == 'ERROR':
        msg = deploy_data.get('errorMessage') or deploy_data.get('errorCode') or 'Vercel deployment failed'
        return jsonify({'ok': False, 'project_dir': project_dir, 'error': msg}), 500
    if ready_state == 'CANCELED':
        return jsonify({'ok': False, 'project_dir': project_dir, 'error': 'Vercel deployment was canceled'}), 500
    if ready_state != 'READY':
        publish_warning = 'Vercel accepted the deployment, but it is still building. The live URL should start working shortly.'

    raw_url = deploy_data.get('url') or deploy_data.get('aliasFinal') or ''
    live_url = raw_url if raw_url.startswith('http') else f'https://{raw_url}'
    provider_url = deploy_data.get('inspectorUrl') or live_url

    _write_deploy_metadata(project_dir, {
        'provider': 'vercel',
        'projectName': project_name,
        'liveUrl': live_url,
        'providerUrl': provider_url,
        'vercel': {
            'projectName': project_name,
            'deploymentUrl': live_url
        }
    })

    result = {
        'ok': True,
        'provider': 'vercel',
        'site_name': project_name,
        'live_url': live_url,
        'provider_url': provider_url,
        'provider_label': 'Vercel Deployment',
        'project_dir': project_dir
    }
    if publish_warning:
        result['publish_warning'] = publish_warning
    return jsonify(result)


# ── Launch Admin Dashboard ──

@app.route('/api/launch-admin', methods=['POST'])
def launch_admin():
    """Launch the admin dashboard for a project directory."""
    payload = request.json
    project_dir = payload.get('project_dir', '').strip()

    if not project_dir or not os.path.isdir(project_dir):
        return jsonify({'ok': False, 'error': 'Invalid project directory'}), 400

    admin_script = os.path.join(project_dir, 'scripts', 'admin-dashboard.py')
    if not os.path.isfile(admin_script):
        return jsonify({'ok': False, 'error': 'Admin dashboard script not found in project'}), 400

    try:
        # Admin dashboard runs on port 5501 to avoid conflict with generator on 5500
        admin_port = 5501
        env = os.environ.copy()
        env['FLASK_APP'] = admin_script
        env['QUIZTOOL_ADMIN_PORT'] = str(admin_port)

        if _FROZEN:
            # In frozen/EXE mode, sys.executable is the EXE itself, not Python.
            # Auto-install Python + Flask via winget if missing.
            python_exe, py_msg = _ensure_tool(
                'python',
                winget_id='Python.Python.3.12',
                post_install_hook=_install_flask
            )
            if not python_exe:
                return jsonify({
                    'ok': False,
                    'error': f'Python is required for the Admin Dashboard. {py_msg}'
                }), 400
            # Ensure flask is installed for the found Python
            _install_flask(python_exe)
        else:
            python_exe = sys.executable

        proc = subprocess.Popen(
            [python_exe, admin_script, '--port', str(admin_port)],
            cwd=project_dir,
            env=env,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
        )

        return jsonify({
            'ok': True,
            'admin_url': f'http://localhost:{admin_port}/admin/',
            'pid': proc.pid
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


# ── Download ZIP to a local directory (for admin dashboard use) ──

@app.route('/api/download-local', methods=['POST'])
def download_local():
    """Generate ZIP and extract it to a local directory for admin dashboard use."""
    config = request.json
    project_name = config.get('project_name', 'MyQuiz')
    safe_name = re.sub(r'[^a-zA-Z0-9._-]', '-', project_name).strip('-') or 'quiz-project'

    project_dir = str(_get_projects_dir() / safe_name)
    # Do NOT delete existing project — preserve user-added content.
    # ZIP extraction overwrites matching files but leaves extras intact.
    os.makedirs(project_dir, exist_ok=True)

    try:
        zip_buf = build_project_zip(config)
        with zipfile.ZipFile(zip_buf, 'r') as zf:
            zf.extractall(project_dir)

        _active_projects[safe_name] = {'path': project_dir, 'admin_pid': None}

        return jsonify({
            'ok': True,
            'project_dir': project_dir,
            'project_name': safe_name
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


# ============================================================
#  MAIN
# ============================================================

def open_browser(port):
    import time
    # When running as a Tauri sidecar, skip opening a browser tab —
    # the Tauri WebView window is the UI instead.
    if os.environ.get('TAURI_SIDECAR', '') == '1':
        print(f'  [tauri sidecar] Skipping browser open (WebView will connect)')
        return
    time.sleep(1.5)
    webbrowser.open(f'http://localhost:{port}')


# Track server state for clean shutdown
_server_shutdown = False


@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    """Gracefully shut down the Flask server."""
    global _server_shutdown
    _server_shutdown = True
    # Use a background thread to avoid deadlocking the response
    def do_shutdown():
        import time
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=do_shutdown, daemon=True).start()
    return jsonify({'ok': True, 'message': 'Server shutting down...'})


def main():
    import argparse

    parser = argparse.ArgumentParser(description='QuizTool Project Generator')
    parser.add_argument('--port', type=int, default=None,
                        help='Port to run the Flask server on (default: 5500, or QUIZTOOL_PORT env var)')
    args = parser.parse_args()

    # Port priority: --port CLI arg > QUIZTOOL_PORT env var > default 5500
    if args.port is not None:
        port = args.port
    else:
        port = int(os.environ.get('QUIZTOOL_PORT', '5500'))

    is_sidecar = os.environ.get('TAURI_SIDECAR', '') == '1'

    print(f"\n{'=' * 60}")
    print(f"  QuizTool Project Generator")
    print(f"{'=' * 60}")
    print(f"\n  Starting web UI on http://localhost:{port}")
    if is_sidecar:
        print(f"  [tauri sidecar mode] WebView will connect automatically")
    print(f"  Configure your project and generate a ready-to-deploy ZIP.")
    print(f"\n  Generated project structure (similar to MU61S8):")
    print(f"    [v] Engine files (quiz, bank, index)")
    print(f"    [v] Service worker with offline support")
    print(f"    [v] PWA manifest with all icon sizes")
    print(f"    [v] GitHub Actions workflows (sync + deploy)")
    print(f"    [v] Asset synchronization scripts")
    print(f"    [v] Quiz engine test page")
    print(f"    [x] No QuizTool utilities (quiz-maker, bank-maker, etc.)")
    print(f"\n  Press Ctrl+C to stop.\n")

    # Only open browser when NOT running as a Tauri sidecar
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    try:
        app.run(host='127.0.0.1', port=port, debug=False)
    except KeyboardInterrupt:
        print("\n  Stopped.\n")
        os._exit(0)


if __name__ == '__main__':
    # Check flask dependency
    try:
        import flask
    except ImportError:
        print("Flask is required. Install it with:")
        print("  pip install flask")
        sys.exit(1)
    main()
