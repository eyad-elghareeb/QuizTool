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
from pathlib import Path
from flask import Flask, render_template_string, request, send_file, jsonify

app = Flask(__name__)

# ============================================================
#  Paths - locate engine files from QuizTool directory
# ============================================================
BASE_DIR = Path(__file__).parent.resolve()

def read_file(name):
    """Read a file from the QuizTool directory."""
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
        'index-engine.js',
        'index-engine.css',
        'index.html',
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

/** Navigation requests (HTML pages): network-first with cache fallback + hub fallback. */
function handleNavigate(event, request) {
  return (async function () {
    var cache = await caches.open(CACHE_NAME);
    try {
      var res = await fetch(request);
      if (res && res.ok) {
        try {
          await cache.put(request, res.clone());
        } catch (_) {}
      }
      return res;
    } catch (err) {
      /* Offline: try exact match first */
      var cached = await cache.match(request);
      if (cached) return cached;

      /* Try matching without query/hash (some browsers append them) */
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
      throw err;
    }
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
          'index-engine.js',
          'index-engine.css',
          'manifest.webmanifest',
          'favicon.svg',
          'icon-48.png',
          'icon-72.png',
          'icon-96.png',
          'icon-144.png',
          'icon-192.png',
          'icon-512.png'
        ];
        if (SHARED.indexOf(filename) !== -1) {
          cached = await cache.match(hrefFromScope(scope, filename));
        }
      }
    }

    if (cached) return cached;

    try {
      var res = await fetch(request);
      if (shouldStore(res)) {
        try {
          await cache.put(request, res.clone());
        } catch (_) {}
      }
      return res;
    } catch (err) {
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

SW_JS = read_file('sw.js')
INDEX_ENGINE_JS = read_file('index-engine.js')
INDEX_ENGINE_CSS = read_file('index-engine.css')
QUIZ_ENGINE_JS = read_file('quiz-engine.js')
BANK_ENGINE_JS = read_file('bank-engine.js')

# Read sync scripts from QuizTool's own scripts/ folder (self-contained, no MU61S8 dependency)
_SCRIPTS_DIR = BASE_DIR / 'scripts'
SYNC_SCRIPT = (_SCRIPTS_DIR / 'sync_quiz_assets.py').read_text(encoding='utf-8') if (_SCRIPTS_DIR / 'sync_quiz_assets.py').exists() else ''
STANDARDIZE_SCRIPT = (_SCRIPTS_DIR / 'standardize_quiz_files.py').read_text(encoding='utf-8') if (_SCRIPTS_DIR / 'standardize_quiz_files.py').exists() else ''

# Auto-index script
AUTO_INDEX_SCRIPT = '''#!/usr/bin/env python3
"""
Auto-index new quiz/bank HTML files.
Scans all folders for .html files with QUIZ_CONFIG or BANK_CONFIG
and updates parent folder index.html files.
"""
import os
import re
import json
from pathlib import Path

def parse_quiz_file(filepath):
    """Extract config from a quiz/bank HTML file."""
    content = filepath.read_text(encoding='utf-8')
    
    # Try QUIZ_CONFIG
    match = re.search(r'/\\*\\s*\\[QUIZ_CONFIG_START\\]\\s*\\*/[\\s\\S]*?const\\s+QUIZ_CONFIG\\s*=\\s*({[\\s\\S]*?});[\\s\\S]*?/\\*\\s*\\[QUIZ_CONFIG_END\\]\\s*\\*/', content)
    if match:
        try:
            config = eval(match.group(1))
            return {'type': 'quiz', 'config': config}
        except:
            pass
    
    # Try BANK_CONFIG
    match = re.search(r'/\\*\\s*\\[BANK_CONFIG_START\\]\\s*\\*/[\\s\\S]*?const\\s+BANK_CONFIG\\s*=\\s*({[\\s\\S]*?});[\\s\\S]*?/\\*\\s*\\[BANK_CONFIG_END\\]\\s*\\*/', content)
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
            quizzes.append({
                'title': config.get('title', html_file.stem),
                'description': config.get('description', ''),
                'icon': config.get('icon', '\\U0001F4DD' if parsed['type'] == 'quiz' else '\\U0001F5C3\\uFE0F'),
                'tags': ['Bank' if parsed['type'] == 'bank' else 'Quiz'],
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

      - name: Auto-index new quiz/bank files
        run: python scripts/auto_index.py || echo "Auto-index script not found, skipping"

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

          git commit -m "chore: sync and index quiz assets"
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

GITIGNORE_CONTENT = '''# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.sublime-*

# Generated / build output
_site/
*.zip

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.venv/

# Node (if using any tooling)
node_modules/
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
    <button class="icon-btn" id="theme-toggle" onclick="toggleTheme()" title="Toggle theme">\u2600</button>
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
    
    # Collect all file paths for service worker precaching
    all_file_paths = [
        'index-engine.js',
        'index-engine.css',
        'quiz-engine.js',
        'bank-engine.js',
        'favicon.svg',
        'manifest.webmanifest'
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
                if quiz.get('url') == filename or filename in quiz.get('url', ''):
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

        # --- Static assets ---
        zf.writestr('favicon.svg', FAVICON_SVG)
        zf.writestr('sw.js', sw_js_content)  # Use dynamically generated sw.js
        zf.writestr('manifest.webmanifest', MANIFEST_JSON(project_name))

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
                    if quiz.get('url') == filename or filename in quiz.get('url', ''):
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
        
        # --- Scripts folder (for asset synchronization) ---
        if SYNC_SCRIPT:
            zf.writestr('scripts/sync_quiz_assets.py', SYNC_SCRIPT)
        if STANDARDIZE_SCRIPT:
            zf.writestr('scripts/standardize_quiz_files.py', STANDARDIZE_SCRIPT)
        if AUTO_INDEX_SCRIPT:
            zf.writestr('scripts/auto_index.py', AUTO_INDEX_SCRIPT)

        # --- GitHub Workflows ---
        zf.writestr('.github/workflows/sync-quiz-assets.yml', SYNC_WORKFLOW_YML)
        zf.writestr('.github/workflows/jekyll-gh-pages.yml', DEPLOY_WORKFLOW_YML)

        # --- .gitignore ---
        zf.writestr('.gitignore', GITIGNORE_CONTENT)

    buf.seek(0)
    return buf


# ============================================================
#  WEB UI TEMPLATE
# ============================================================

WEB_UI_HTML = read_file('generator_templates/index.html')


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
    # engines(3) + sw + manifest + favicon + icons(6) + root index + folder indexes + scripts(2) + workflows(2) + gitignore + quiz-engine-test
    estimated_files = 16 + total_folders + total_quizzes
    return jsonify({
        'project_name': config.get('project_name', ''),
        'total_folders': total_folders,
        'total_quizzes': total_quizzes,
        'estimated_files': estimated_files
    })


# ============================================================
#  MAIN
# ============================================================

def open_browser(port):
    import time
    time.sleep(1.5)
    webbrowser.open(f'http://localhost:{port}')


def main():
    port = 5500
    print(f"\n{'=' * 60}")
    print(f"  QuizTool Project Generator")
    print(f"{'=' * 60}")
    print(f"\n  Starting web UI on http://localhost:{port}")
    print(f"  Configure your project and generate a ready-to-deploy ZIP.")
    print(f"\n  Generated project structure (similar to MU61S8):")
    print(f"    ✓ Engine files (quiz, bank, index)")
    print(f"    ✓ Service worker with offline support")
    print(f"    ✓ PWA manifest with all icon sizes")
    print(f"    ✓ GitHub Actions workflows (sync + deploy)")
    print(f"    ✓ Asset synchronization scripts")
    print(f"    ✓ Quiz engine test page")
    print(f"    ✗ No QuizTool utilities (quiz-maker, bank-maker, etc.)")
    print(f"\n  Press Ctrl+C to stop.\n")

    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    try:
        app.run(host='127.0.0.1', port=port, debug=False)
    except KeyboardInterrupt:
        print("\n  Stopped.\n")


if __name__ == '__main__':
    # Check flask dependency
    try:
        import flask
    except ImportError:
        print("Flask is required. Install it with:")
        print("  pip install flask")
        sys.exit(1)
    main()
