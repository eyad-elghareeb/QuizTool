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

FAVICON_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0d1117"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="#f0a500" stroke-width="3.5"/>
  <rect x="44" y="32" width="12" height="36" rx="2" fill="#f0a500"/>
  <rect x="32" y="44" width="36" height="12" rx="2" fill="#f0a500"/>
</svg>'''

SW_JS = read_file('sw.js')
INDEX_ENGINE_JS = read_file('index-engine.js')
QUIZ_ENGINE_JS = read_file('quiz-engine.js')
BANK_ENGINE_JS = read_file('bank-engine.js')

# Read sync scripts from MU61S8
MU61S8_BASE = BASE_DIR.parent / 'MU61S8'
SYNC_SCRIPT = (MU61S8_BASE / 'scripts' / 'sync_quiz_assets.py').read_text(encoding='utf-8') if (MU61S8_BASE / 'scripts' / 'sync_quiz_assets.py').exists() else ''
STANDARDIZE_SCRIPT = (MU61S8_BASE / 'scripts' / 'standardize_quiz_files.py').read_text(encoding='utf-8') if (MU61S8_BASE / 'scripts' / 'standardize_quiz_files.py').exists() else ''

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
                     engine_prefix=''):
    """
    Generate an index.html that uses index-engine.js.
    engine_prefix is relative path to the engine files (e.g. '../' for subfolders).
    """
    q_json = json.dumps(quizzes, indent=2)
    sw_path = engine_prefix + 'sw.js'
    manifest_path = engine_prefix + 'manifest.webmanifest'
    favicon_path = engine_prefix + 'favicon.svg'
    engine_path = engine_prefix + 'index-engine.js'

    back_btn = ''
    if engine_prefix:
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
<style>
:root{{--bg:#0d1117;--surface:#161b22;--surface2:#1c2330;--border:#30363d;--text:#e6edf3;--text-muted:#8b949e;--accent:#f0a500;--accent-dim:rgba(240,165,0,0.12);--correct:#2ea043;--correct-bg:rgba(46,160,67,0.12);--wrong:#da3633;--wrong-bg:rgba(218,54,51,0.12);--flagged:#58a6ff;--flagged-bg:rgba(88,166,255,0.12);--skip:#6e7681;--radius:12px;--shadow:0 4px 24px rgba(0,0,0,0.4);--transition:0.2s ease-out}}
[data-theme="light"]{{--bg:#f3f0eb;--surface:#fff;--surface2:#f8f6f1;--border:#d0ccc5;--text:#1c1917;--text-muted:#78716c;--accent:#c27803;--accent-dim:rgba(194,120,3,0.10);--shadow:0 4px 24px rgba(0,0,0,0.10);--correct:#16a34a;--correct-bg:rgba(22,163,74,0.10);--wrong:#dc2626;--wrong-bg:rgba(220,38,38,0.10);--flagged:#2563eb;--flagged-bg:rgba(37,99,235,0.10)}}
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
html,body{{height:100%}}
body{{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;transition:background var(--transition),color var(--transition);display:flex;flex-direction:column}}
button,a{{cursor:pointer;font-family:inherit;border:none;outline:none;text-decoration:none}}
.topbar{{display:flex;align-items:center;padding:0.75rem 1.5rem;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;position:sticky;top:0;z-index:10}}
.topbar-title{{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;flex:1;color:var(--text)}}
.icon-btn{{width:38px;height:38px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:all var(--transition);font-size:1.1rem}}
.icon-btn:hover{{color:var(--text);border-color:var(--accent)}}
.icon-btn.back-btn{{margin-right:1rem}}
.container{{flex:1;overflow-y:auto;padding:3rem 1.5rem;display:flex;flex-direction:column;align-items:center}}
.hero{{text-align:center;max-width:600px;margin-bottom:3.5rem}}
.hero h1{{font-family:'Playfair Display',serif;font-size:clamp(2.2rem,5vw,3.2rem);line-height:1.1;margin-bottom:1rem}}
.hero h1 span{{color:var(--accent)}}
.hero p{{color:var(--text-muted);font-size:1.05rem}}
.quiz-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;width:100%;max-width:1100px}}
.quiz-card{{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:2rem;box-shadow:var(--shadow);display:flex;flex-direction:column;transition:transform 0.3s ease,border-color 0.3s ease}}
.quiz-card:hover{{transform:translateY(-5px);border-color:var(--accent)}}
.card-icon{{width:56px;height:56px;background:var(--accent-dim);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin-bottom:1.25rem}}
.card-title{{font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--text);margin-bottom:0.5rem;line-height:1.2}}
.card-desc{{color:var(--text-muted);font-size:0.9rem;margin-bottom:1.5rem;flex:1}}
.card-meta{{display:flex;gap:1rem;margin-bottom:1.5rem}}
.meta-badge{{background:var(--surface2);border:1px solid var(--border);padding:0.35rem 0.75rem;border-radius:8px;font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em}}
.btn-take-quiz{{display:inline-block;text-align:center;width:100%;padding:0.85rem;border-radius:var(--radius);background:var(--accent);color:#000;font-weight:700;font-size:0.95rem;transition:opacity var(--transition),transform var(--transition)}}
.btn-take-quiz:hover{{opacity:0.88;transform:translateY(-1px)}}
.btn-take-quiz:active{{transform:translateY(0)}}
.footer-note{{margin-top:3rem;text-align:center;color:var(--text-muted);font-size:0.85rem}}
.footer-note a{{color:var(--accent);text-decoration:none}}
.btn-tracker{{width:38px;height:38px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.1rem;transition:all var(--transition);cursor:pointer;position:relative;margin-right:0.5rem}}
.btn-tracker:hover{{color:var(--accent);border-color:var(--accent)}}
.btn-tracker .tracker-badge{{position:absolute;top:-3px;right:-3px;min-width:15px;height:15px;border-radius:8px;background:var(--text-muted);color:var(--surface);font-size:0.55rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1;opacity:0.75}}
.btn-tracker .tracker-badge:empty{{display:none}}
.dash-overlay{{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);z-index:2000;display:none;align-items:center;justify-content:center;padding:1rem}}
.dash-overlay.open{{display:flex;animation:dashFadeIn 0.2s ease}}
@keyframes dashFadeIn{{from{{opacity:0}}to{{opacity:1}}}}
.dash-modal{{background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:680px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.5);animation:dashSlideUp 0.25s ease}}
@keyframes dashSlideUp{{from{{opacity:0;transform:translateY(20px)}}to{{opacity:1;transform:translateY(0)}}}}
.dash-header{{display:flex;align-items:center;gap:0.75rem;padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);flex-shrink:0}}
.dash-header h2{{font-family:'Playfair Display',serif;font-size:1.2rem;flex:1}}
.dash-close-btn{{width:34px;height:34px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.1rem;cursor:pointer;transition:all var(--transition)}}
.dash-close-btn:hover{{color:var(--text);border-color:var(--accent)}}
.dash-scope-bar{{display:flex;gap:0;padding:0 1.5rem;border-bottom:1px solid var(--border);flex-shrink:0}}
.dash-scope-tab{{padding:0.6rem 1rem;font-size:0.8rem;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;cursor:pointer;transition:all var(--transition);background:none;border-top:none;border-left:none;border-right:none}}
.dash-scope-tab:hover{{color:var(--text)}}
.dash-scope-tab.active{{color:var(--accent);border-bottom-color:var(--accent)}}
.dash-summary{{display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);flex-shrink:0}}
.dash-stat{{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;text-align:center}}
.dash-stat .ds-val{{font-size:1.5rem;font-weight:700;line-height:1.2}}
.dash-stat .ds-lbl{{font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem}}
.ds-val.red{{color:var(--wrong)}}.ds-val.blue{{color:var(--flagged)}}.ds-val.green{{color:var(--correct)}}
.dash-body{{flex:1;overflow-y:auto;padding:1rem 1.5rem}}
.dash-body::-webkit-scrollbar{{width:6px}}.dash-body::-webkit-scrollbar-thumb{{background:var(--border);border-radius:3px}}
.dash-quiz-group{{margin-bottom:1.25rem}}
.dash-quiz-title{{font-weight:700;font-size:0.9rem;color:var(--text);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.5rem}}
.dash-quiz-title .quiz-badge{{font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:5px;font-weight:600}}
.dash-quiz-title .quiz-badge.wrong-badge{{background:var(--wrong-bg);color:var(--wrong)}}
.dash-quiz-title .quiz-badge.flag-badge{{background:var(--flagged-bg);color:var(--flagged)}}
.dash-q-item{{display:flex;align-items:flex-start;gap:0.65rem;padding:0.65rem 0.85rem;border-radius:8px;margin-bottom:0.4rem;border:1px solid var(--border);background:var(--surface2);transition:all var(--transition)}}
.dash-q-item:hover{{border-color:var(--accent)}}
.dash-q-icon{{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0;margin-top:0.1rem}}
.dash-q-icon.wrong{{background:var(--wrong-bg);color:var(--wrong)}}
.dash-q-icon.flagged{{background:var(--flagged-bg);color:var(--flagged)}}
.dash-q-content{{flex:1;min-width:0}}
.dash-q-num{{font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;font-weight:600}}
.dash-q-text{{font-size:0.85rem;font-weight:500;line-height:1.4;color:var(--text);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
.dash-q-remove{{width:22px;height:22px;border-radius:5px;background:transparent;border:1px solid transparent;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.75rem;cursor:pointer;transition:all var(--transition);flex-shrink:0}}
.dash-q-remove:hover{{border-color:var(--wrong);color:var(--wrong);background:var(--wrong-bg)}}
.dash-footer{{padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:0.75rem;flex-shrink:0}}
.btn-dash-action{{padding:0.65rem 1.25rem;border-radius:8px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-weight:600;font-size:0.85rem;cursor:pointer;transition:all var(--transition)}}
.btn-dash-action:hover{{border-color:var(--accent);color:var(--accent)}}
.btn-dash-danger:hover{{border-color:var(--wrong);color:var(--wrong)}}
.btn-dash-close{{flex:1;padding:0.65rem 1.25rem;border-radius:8px;background:var(--accent);border:1.5px solid var(--accent);color:#000;font-weight:700;font-size:0.85rem;cursor:pointer;transition:all var(--transition)}}
.btn-dash-close:hover{{opacity:0.85}}
.dash-empty{{text-align:center;padding:2.5rem 1rem;color:var(--text-muted)}}
.dash-empty-icon{{font-size:2.5rem;margin-bottom:0.75rem;opacity:0.5}}
.dash-empty p{{font-size:0.9rem;line-height:1.5}}
@media(max-width:480px){{.dash-modal{{max-height:90vh;border-radius:16px}}.dash-summary{{grid-template-columns:repeat(3,1fr);gap:0.5rem;padding:1rem}}.dash-stat{{padding:0.6rem}}.dash-stat .ds-val{{font-size:1.2rem}}.dash-body{{padding:0.75rem 1rem}}}}
</style>
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

<div class="dash-overlay" id="tracker-dashboard">
  <div class="dash-modal">
    <div class="dash-header">
      <h2 id="dash-title-text">\U0001F4CA Question Tracker</h2>
      <button class="dash-close-btn" onclick="closeTrackerDashboard()">\u2715</button>
    </div>
    <div class="dash-scope-bar" id="dash-scope-bar"></div>
    <div class="dash-summary">
      <div class="dash-stat"><div class="ds-val red" id="dash-total-wrong">0</div><div class="ds-lbl">Wrong</div></div>
      <div class="dash-stat"><div class="ds-val blue" id="dash-total-flagged">0</div><div class="ds-lbl">Flagged</div></div>
      <div class="dash-stat"><div class="ds-val green" id="dash-total-quizzes">0</div><div class="ds-lbl">Quizzes</div></div>
    </div>
    <div class="dash-body" id="dash-body"></div>
    <div class="dash-footer">
      <button class="btn-dash-action" onclick="exportTrackerToPDF()" title="Export to PDF">\U0001F4C4 Export PDF</button>
      <button class="btn-dash-action btn-dash-danger" onclick="clearAllTrackerData()">\U0001F5D1 Clear All</button>
      <button class="btn-dash-close" onclick="closeTrackerDashboard()">Close</button>
    </div>
  </div>
</div>

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
    """
    buf = io.BytesIO()
    project_name = config.get('project_name', 'MyQuiz')

    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:

        # --- Shared engines (root level) ---
        zf.writestr('index-engine.js', INDEX_ENGINE_JS)
        zf.writestr('quiz-engine.js', QUIZ_ENGINE_JS)
        zf.writestr('bank-engine.js', BANK_ENGINE_JS)

        # --- Static assets ---
        zf.writestr('favicon.svg', FAVICON_SVG)
        zf.writestr('sw.js', SW_JS)
        zf.writestr('manifest.webmanifest', MANIFEST_JSON(project_name))

        # --- Icon files (PNG icons for PWA) ---
        for icon_name, icon_data in ICON_FILES.items():
            zf.writestr(icon_name, icon_data)

        # --- Diagnostic test page ---
        if QUIZ_ENGINE_TEST_HTML:
            zf.writestr('quiz-engine-test.html', QUIZ_ENGINE_TEST_HTML)

        # --- Root index.html ---
        root_quizzes = []
        for folder in config.get('folders', []):
            root_quizzes.append({
                'title': f"{folder.get('icon', '\U0001F4C1')} {folder['name']}",
                'description': folder.get('description', ''),
                'icon': folder.get('icon', '\U0001F4C1'),
                'tags': ['Folder'],
                'url': f"{folder['name']}/index.html"
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

        # --- Folder index pages ---
        for folder in config.get('folders', []):
            folder_name = folder['name']
            folder_quizzes = folder.get('quizzes', [])

            folder_html = gen_index_html(
                topbar_title=f"{config.get('topbar_title', project_name)} - {folder_name}",
                hero_title=f"Select your <span>{folder_name}</span> exam",
                hero_desc=f"Test your knowledge across various {folder_name.lower()} topics. Choose an exam below to begin.",
                quizzes=folder_quizzes,
                engine_prefix='../'
            )
            zf.writestr(f'{folder_name}/index.html', folder_html)

        # --- Scripts folder (for asset synchronization) ---
        if SYNC_SCRIPT:
            zf.writestr('scripts/sync_quiz_assets.py', SYNC_SCRIPT)
        if STANDARDIZE_SCRIPT:
            zf.writestr('scripts/standardize_quiz_files.py', STANDARDIZE_SCRIPT)

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
    total_quizzes = sum(len(f.get('quizzes', [])) for f in folders)
    # engines(3) + sw + manifest + favicon + icons(6) + root index + folder indexes + scripts(2) + workflows(2) + gitignore + quiz-engine-test
    estimated_files = 16 + len(folders) + total_quizzes
    return jsonify({
        'project_name': config.get('project_name', ''),
        'total_folders': len(folders),
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
