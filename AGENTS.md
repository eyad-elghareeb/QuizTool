# AGENTS.md — QuizTool

> **Purpose:** Complete reference for any LLM agent working on this repository. Read this before touching any file. Covers both the authoring toolkit and the project generator.

---

## 1. Project Identity

| Key | Value |
|-----|-------|
| **Type** | Authoring toolkit + project generator — static HTML tools, no backend required for the tools themselves |
| **Deployment** | GitHub Pages (the toolkit pages themselves are deployed here) |
| **Generator** | `generate_project.py` (Flask, port 5500) — produces self-contained quiz site ZIPs |
| **Output** | Generated ZIPs are MU61S8-equivalent sites (see `AGENTS.md` in generated projects) |

---

## 2. Repository Layout

```
QuizTool/
├── index.html                    ← QuizTool hub (lists all tools)
├── index-engine.js               ← Hub engine (shared with generated sites)
├── index-engine.css              ← Hub styles (shared with generated sites)
├── quiz-engine.js                ← Quiz engine (shared with generated sites)
├── bank-engine.js                ← Bank engine (shared with generated sites)
├── sw.js                         ← Service worker for QuizTool itself
├── manifest.webmanifest          ← PWA manifest
├── favicon.svg
├── icon-{48,72,96,144,192,512}.png
│
├── — AUTHORING TOOLS —
├── quiz-maker.html               ← GUI quiz builder → downloads quiz HTML
├── quiz-maker-js.html            ← Paste-JSON quiz builder
├── bank-maker.html               ← GUI bank builder → downloads bank HTML
├── quiz-editor.html              ← Edit existing quiz files
├── index-editor.html             ← Edit/create index hub pages
├── quiz-combiner.html            ← Merge multiple quiz files into one bank
├── pdf-exporter.html             ← Export any quiz/bank to PDF standalone
├── js-question-bank.html         ← Browser-based question bank manager
│
├── — TEMPLATES (read by tools) —
├── quiz-template.html            ← Base template for quiz-maker output
├── question-bank-template.html   ← Base template for bank-maker output
├── index-template.html           ← Base template for index-editor output
│
├── — GENERATOR —
├── generate_project.py           ← Flask server: full project generator
├── generator_templates/
│   └── index.html                ← Web UI for the generator (Flask serves this)
│
├── — SCRIPTS (bundled into generated ZIPs) —
├── scripts/
│   ├── sync_quiz_assets.py       ← Auto-index + SW updater for generated sites
│   └── standardize_quiz_files.py ← One-time file formatter
│
└── .github/workflows/
    └── jekyll-gh-pages.yml       ← Deploys QuizTool itself to GitHub Pages
```

---

## 3. The Three Engines

These three JS files are the **core shared assets**. They exist here, get deployed with QuizTool's own GitHub Pages, and are also **bundled into every ZIP** that `generate_project.py` produces.

| Engine | Consumed by | Role |
|--------|------------|------|
| `quiz-engine.js` | Individual quiz HTML files | Full SPA: injects all CSS+HTML, runs quiz, saves progress, tracker |
| `bank-engine.js` | Question-bank HTML files | Same as quiz + session management for large question banks |
| `index-engine.js` | All `index.html` hub pages | Renders quiz cards, tracker dashboard, theme |

### Engine Path Resolution

Quiz/bank files self-locate the engine at runtime:

```js
window.__QUIZ_ENGINE_BASE = '../'.repeat(
  Math.max(0, location.pathname.split('/').filter(Boolean).length - 2)
);
document.write('<scr'+'ipt src="'+window.__QUIZ_ENGINE_BASE+'quiz-engine.js"><\/scr'+'ipt>');
```

This means a file at `gyn/dep/l1.html` computes `../../` and a file at `gyn/l1.html` computes `../`. **Never hardcode the path.**

---

## 4. Templates — What They Are and How Tools Use Them

### `quiz-template.html`
Base template for `quiz-maker.html` output. Contains:
- FOUC-prevention inline script
- `/* [QUIZ_CONFIG_START] */` + `/* [QUIZ_CONFIG_END] */` markers around `QUIZ_CONFIG`
- `/* [QUESTIONS_START] */` + `/* [QUESTIONS_END] */` markers around `QUESTIONS`
- The `__QUIZ_ENGINE_BASE` / `document.write` engine loader snippet

Tools fill in `QUIZ_CONFIG` and `QUESTIONS` at download time. **Never remove the marker comments** — `sync_quiz_assets.py` parses them to extract metadata.

### `question-bank-template.html`
Same structure as quiz template but for `bank-maker.html` output. Uses `BANK_CONFIG` and `QUESTION_BANK`, loads `bank-engine.js`.

### `index-template.html`
Template for `index-editor.html` output. Contains:
- Standardized topbar, hero, and grid structure
- `const QUIZZES = [...]` array (populated by editor)
- Full tracker dashboard HTML block
- **Modernized Structure:** Uses `<link rel="stylesheet" href="index-engine.css">` instead of embedded styles.
- SW registration block (depth-aware in generated output)

**Critical:** `index-editor.html` fetches this template. Changes to the template affect all future hub pages produced by the editor.

---

## 5. File Schemas

### 5a. Quiz File Schema

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function(){var t=localStorage.getItem('quiz-theme')||'dark';var s=document.createElement('style');
s.textContent='html,body{background:'+(t==='light'?'#f3f0eb':'#0d1117')+';color:'+(t==='light'?'#1c1917':'#e6edf3')+';margin:0;padding:0;overflow:hidden;height:100%}';
document.head.appendChild(s)})();
</script>
<title>Quiz Title</title>
</head>
<body>
<script>

/* [QUIZ_CONFIG_START] */
const QUIZ_CONFIG = {
  "uid": "unique_snake_case_id",  // REQUIRED — stable, never change after first use
  title: "Quiz Display Title",
  description: "Short description shown on start screen",
};
/* [QUIZ_CONFIG_END] */

/* [QUESTIONS_START] */
const QUESTIONS = [
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,          // 0-indexed
    "explanation": "Why A is correct."
  }
];
/* [QUESTIONS_END] */

</script>
<script>
(function(){
  window.__QUIZ_ENGINE_BASE='../'.repeat(Math.max(0,location.pathname.split('/').filter(Boolean).length-2));
  document.write('<scr'+'ipt src="'+window.__QUIZ_ENGINE_BASE+'quiz-engine.js"><\/scr'+'ipt>');
})();
</script>
</body>
</html>
```

### 5b. Bank File Schema

Identical structure but with `BANK_CONFIG` + `QUESTION_BANK`, loads `bank-engine.js`:

```js
/* [BANK_CONFIG_START] */
const BANK_CONFIG = {
  "uid": "unique_bank_id",
  "title": "Bank Display Title",
  "description": "Description",
  "icon": "🗃️"             // optional
};
/* [BANK_CONFIG_END] */

/* [QUESTION_BANK_START] */
const QUESTION_BANK = [ /* same entry shape as QUESTIONS */ ];
/* [QUESTION_BANK_END] */
```

Bank engine extras: sequential progress tracking, random vs sequential selection, configurable question count.

### 5c. Index / Hub File Schema

```html
<body>
  <div class="topbar">
    <!-- For sub-hubs, add: <a href="../index.html" class="icon-btn back-btn">←</a> -->
    <div class="topbar-title">Page Title</div>
    <button class="icon-btn btn-tracker" onclick="openTrackerDashboard()">
      <svg ...></svg><span class="tracker-badge" id="tracker-badge-count"></span>
    </button>
    <button class="icon-btn" id="theme-toggle" onclick="toggleTheme()">☀</button>
  </div>
  <div class="container">
    <header class="hero"><h1>Title</h1><p>Description</p></header>
    <div class="quiz-grid" id="quiz-grid"></div>
  </div>

<script>
const QUIZZES = [
  { title: "Quiz Name", description: "...", icon: "📘", tags: ["Tag1", "20 Questions"], url: "file.html" },
  { title: "📁 Subfolder", description: "...", icon: "📁", tags: ["Folder"], url: "subfolder/index.html" }
];
</script>

<!-- Tracker dashboard block — must be present exactly once -->
<div class="dash-overlay" id="tracker-dashboard">...</div>

<script src="index-engine.js"></script>  <!-- depth-adjusted -->
<script>(function(){...theme + renderQuizzes init...})();</script>
<script>if('serviceWorker' in navigator){...sw.js registration...}</script>
</body>
```

**The `QUIZZES` array** is the only thing that changes between index pages. Everything else is boilerplate.

---

## 6. generate_project.py — The Project Generator

### Running it

```bash
pip install flask
python generate_project.py
# Opens http://localhost:5500 automatically
```

### What it does

Serves a web UI (`generator_templates/index.html`) where the user configures their project, then calls `/api/generate` which returns a ready-to-deploy `.zip`.

### API endpoints

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/` | GET | — | Web UI HTML |
| `/api/generate` | POST | JSON config | ZIP download |
| `/api/preview` | POST | JSON config | JSON stats |

### Config schema (POST to `/api/generate`)

```json
{
  "project_name": "MyMedQuiz",
  "topbar_title": "MyMed Quiz Hub",
  "hero_title": "Select Your <span>Subject</span>",
  "hero_description": "Choose a subject to begin.",
  "folders": [
    {
      "name": "Gynecology",
      "icon": "🤰",
      "description": "Gynecology topics",
      "quizzes": [
        {
          "title": "L1 Anatomy",
          "description": "Pelvic anatomy",
          "icon": "📘",
          "tags": ["Lecture", "30 Questions"],
          "url": "l1-anatomy.html"
        }
      ],
      "subfolders": [
        {
          "name": "Past Years",
          "icon": "📅",
          "description": "Past year exams",
          "quizzes": [...],
          "subfolders": []
        }
      ]
    }
  ],
  "dropped_files": {
    "l1-anatomy.html": "<entire file content as string>"
  }
}
```

### What the generator produces (ZIP contents)

```
project/
├── index.html                 ← Root hub
├── <FolderName>/
│   ├── index.html             ← Folder hub
│   └── *.html                 ← Quiz/bank files (from dropped_files)
│   └── <SubFolder>/
│       ├── index.html
│       └── *.html
├── index-engine.js            ← Copied from QuizTool
├── index-engine.css           ← Copied from QuizTool
├── quiz-engine.js             ← Copied from QuizTool
├── bank-engine.js             ← Copied from QuizTool
├── sw.js                      ← Dynamically generated with full precache list
├── manifest.webmanifest       ← Named after project_name
├── favicon.svg
├── icon-*.png
├── scripts/
│   ├── sync_quiz_assets.py    ← Copied from QuizTool/scripts/
│   └── standardize_quiz_files.py
└── .github/workflows/
    ├── sync-quiz-assets.yml
    └── jekyll-gh-pages.yml
```

| Function | Purpose |
|----------|---------|
| `generate_sw_js(project_name, paths)` | Builds a robust `sw.js` with `REQUIRED` vs `others` install logic and `SHARED` asset fallback. |
| `gen_index_html(...)` | Produces hub pages linking to `index-engine.css`. |
| `build_project_zip(config)` | Full pipeline: ensures engines are prioritized in precache list. |
| `read_file(name)` | Read from QuizTool root. |

### 6a. Robust SW Logic in Generator
The generated `sw.js` includes:
- **REQUIRED List**: Critical assets (engines, manifest, hubs) that must load for successful installation.
- **SHARED Fallback**: Resolves `index-engine.css`, etc., from the root if requested from subfolders.
- **Cache Name**: Prefixed with `quiz-cache-` for generated projects.

### Script self-sufficiency

`generate_project.py` reads scripts from `BASE_DIR / 'scripts'` (QuizTool's own `scripts/` folder). It does **not** depend on any sibling directory (e.g., MU61S8). If `scripts/` is missing, script fields in the ZIP will be empty — always ensure `scripts/sync_quiz_assets.py` and `scripts/standardize_quiz_files.py` exist.

---

## 7. Authoring Tools Reference

| Tool | Input | Output | Notes |
|------|-------|--------|-------|
| `quiz-maker.html` | GUI form | `*.html` quiz file download | Uses `quiz-template.html` as base |
| `quiz-maker-js.html` | Paste JSON `QUESTIONS` array | `*.html` quiz file | Fast path for bulk import |
| `bank-maker.html` | GUI form | `*.html` bank file download | Uses `question-bank-template.html` |
| `quiz-editor.html` | Upload existing quiz/bank | Modified `*.html` download | Reads `QUIZ_CONFIG` + `QUESTIONS` |
| `index-editor.html` | Upload existing `index.html` or fresh | Modified `index.html` download | Fetches `index-template.html` as base |
| `quiz-combiner.html` | Upload multiple quiz/bank files | Single merged bank file | Deduplicates questions |
| `pdf-exporter.html` | Upload quiz/bank HTML | PDF download | Client-side via html2pdf |
| `js-question-bank.html` | Manual entry in browser | localStorage bank, exportable | In-browser bank manager |

All tools are **fully client-side** — no data is sent anywhere. Files are read via `FileReader` and downloaded via `Blob` + `URL.createObjectURL`.

---

## 8. The Sync Script (`scripts/sync_quiz_assets.py`)

This script is bundled into every generated ZIP and is designed to run inside a generated project (not inside QuizTool itself).

### What it does when run in a generated project

1. Scans all `index.html` files for `QUIZZES` arrays
2. Scans each index's folder for new `*.html` files with `QUIZ_CONFIG` or `BANK_CONFIG`
3. Appends missing quiz entries to the `QUIZZES` array (never removes existing ones)
4. Updates root `index.html` with any new subject folders
5. Rebuilds `sw.js` `PRECACHE_REL_PATHS` and `CACHE_VERSION` hash

### Skipped directories

`.git`, `.github`, `__pycache__`, `_site`, `scripts`, `node_modules`

### Cache version prefix

`quiz-cache-<sha256_12chars>` — generic, not project-specific.

### Running it

```bash
cd your-generated-project/
python scripts/sync_quiz_assets.py
```

---

## 9. localStorage Key Reference

| Key | Set by | Value |
|-----|--------|-------|
| `quiz-theme` | All pages | `'dark'` \| `'light'` |
| `quiz_progress_v1_<uid>` | quiz-engine / bank-engine | In-progress quiz state |
| `quiz_tracker_v2_<uid>` | quiz/bank-engine post-submit | Wrong + flagged questions |
| `quiz_tracker_keys` | Tracker system | JSON array of all tracked quiz UIDs |
| `bank_progress_<uid>` | bank-engine | Sequential progress: `{seenIndices, lastIdx}` |

---

## 10. Global API: What the Engines Expose

### quiz-engine.js (global functions)

`startQuiz()`, `goTo(idx)`, `nextQuestion()`, `toggleFlag(idx)`, `attemptSubmit()`, `confirmSubmit()`, `restartQuiz()`, `filterResults(filter, btn)`, `exportToPDF()`, `toggleTheme()`, `navigateToIndex(event)`, `showToast(msg, actions[])`, `confirmResetProgress()`, `saveTrackerData()`, `updateDashboardBadge()`, `openTrackerDashboard(scope?)`, `openKbHelp()`, `closeKbHelp()`

**`navigateToIndex`** always goes to `index.html` — relative to the quiz file's location, navigating to its immediate parent folder's hub.

### bank-engine.js extras

`selectSessionQuestions(count, order)` — `order` is `'sequential'` or `'random'`
`getBankProgress()`, `saveBankProgress(p)`, `resetBankProgress()`
`adjustCount(delta)`, `setCount(n)`, `autoSetTime(n)`

### index-engine.js (global functions)

`renderQuizzes()`, `toggleTheme()`, `showToast(msg)`, `openTrackerDashboard()`, `closeTrackerDashboard()`, `confirmClearTrackerData()`, `closeClearTrackerModal()`, `clearAllTrackerData()`, `removeTrackerItem(uid, qIdx)`, `exportTrackerToPDF()`, `updateDashboardBadge()`

The modal (`#clear-tracker-modal`) and its styles are **dynamically injected by `index-engine.js`** at load time — do not add them to HTML manually.

---

## 11. Question Tracker System

The tracker is a persistence layer that aggregates mistakes and flagged items across all sessions for long-term review. It is shared between all engines and hub pages.

### 11a. Data Lifecycle
1. **Capture**: On `confirmSubmit()`, the engine calls `saveTrackerData()`.
2. **Merge**: It reads existing data for the UID and merges it with the current session.
   - Questions in the **current session** (by global index for banks, or by text for quizzes) are updated.
   - Historical questions **not present** in the current session are preserved.
3. **Storage**: Data is saved in `localStorage` under `quiz_tracker_v2_<uid>`. The UID is added to a global index `quiz_tracker_keys`.

### 11b. Dashboard Features
- **Scoped View**: Hub pages automatically filter the dashboard to the current folder's quizzes.
- **Review Mode**: Users can select specific quizzes or folders and click "Start Review" to launch a dynamic session containing only those tracked questions.
- **Deduplication**: The tracker identifies questions by text to prevent duplicates if the same question appears in multiple quizzes.
- **Selective Clearing**: `confirmClearTrackerData()` only deletes data for the currently visible scope (Current Folder, All, or This Quiz).

---

## 12. Highlighter & Markup System

A robust toolset for annotating questions during a session. Markups are persisted in the user's progress and restored on reload.

### 12a. Highlighting
- **Activation**: Toggle via the 🖍️ icon in the topbar or the `H` key.
- **Colors**: Provides 4 highlight colors (Yellow, Green, Blue, Red) and an Eraser mode.
- **Auto-Apply**: When active, simply selecting text (Mouse drag or Touch selection) automatically applies the last selected color.
- **Persistence**: Stored in `state.highlights[qIdx]` as offsets. These are saved to `localStorage` progress automatically.

### 12b. Strikethrough (Process of Elimination)
- **Usage**: Right-click on an option label, or press the `S` key while hovering over an option.
- **Visual**: Places a red line through the option text and dims it.
- **Persistence**: Stored in `state.strikethrough[qIdx]`.

### 12c. Technical Implementation
Markups are applied dynamically during `renderQuestion()` by injecting `<mark>` tags into the text nodes based on stored offsets. This prevents breaking the underlying data while allowing rich visuals.

---

## 13. Keyboard Shortcut System

The engine includes a full keyboard interface to speed up MCQ solving.

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next question |
| `1` - `4` | Select option A, B, C, or D (or set highlight color in hl mode) |
| `F` | Toggle Flag for review |
| `H` | Toggle Highlighter mode |
| `S` | Toggle Strikethrough (while hovering an option) |
| `Enter` | Submit quiz (from question screen) |
| `/` | Show / Hide keyboard shortcut help |
| `Esc` | Close modals or help panel |

---

## 14. Session Management & Persistence

The engine ensures that a user's progress is never lost, even if they close the browser or refresh the page.

### 14a. Auto-Save Logic
- **Triggers**: Every time an option is selected, a question is flagged, or a highlight is applied, `saveProgress()` is called.
- **Data**: The current `state` (answers, flags, elapsed time, highlights, etc.) is serialized to JSON.
- **Storage**: Saved in `localStorage` under `quiz_progress_v1_<uid_sanitized>`.

### 14b. Restore Workflow
1. **Detection**: On page load, the engine checks for an existing progress key for the current UID.
2. **Toast**: If found, a toast notification appears: *"Resume previous session? [Restore] [Dismiss]"*.
3. **Action**: 
   - **Restore**: Overwrites the initial state with the saved data and jumps to the last seen question.
   - **Dismiss**: Deletes the saved progress and starts fresh.

---

## 15. CSS / Theme System

All CSS is injected by the engines — do not add external stylesheets to quiz/bank files.

| Variable | Dark value | Light value |
|----------|-----------|------------|
| `--bg` | `#0d1117` | `#f3f0eb` |
| `--surface` | `#161b22` | `#ffffff` |
| `--surface2` | `#1c2330` | `#f8f6f1` |
| `--border` | `#30363d` | `#d0ccc5` |
| `--text` | `#e6edf3` | `#1c1917` |
| `--text-muted` | `#8b949e` | `#78716c` |
| `--accent` | `#f0a500` | `#c27803` |
| `--correct` | `#2ea043` | `#16a34a` |
| `--wrong` | `#da3633` | `#dc2626` |
| `--flagged` | `#58a6ff` | `#2563eb` |

`index-engine.css` handles hub page layout only (topbar, grid, cards). Quiz/bank pages have all styles embedded by their engine.

---

## 16. CRITICAL RULES: DO NOT BREAK

To maintain the stability of the toolkit, the accuracy of the project generator, and the offline functionality of all produced sites, every agent MUST follow these rules:

### 16a. Project Generator (`generate_project.py`)
- **Never reference external directories**: The generator MUST be self-contained. It should only read from the `QuizTool` root or its own subfolders. Never reference `../MU61S8/` or other sibling repos.
- **Never skip `generate_sw_js`**: In the `build_project_zip` function, always use the dynamic `generate_sw_js` helper instead of reading a static `sw.js`. The generated SW needs a manifest specific to the new project's files.
- **Prioritize Engines in ZIP**: When building the precache list for a generated project, the engines (`quiz-engine.js`, `index-engine.js`, etc.) MUST be included in the `REQUIRED` list to ensure the PWA is functional even if some quiz files fail to cache.

### 16b. Templates & Markers
- **Never remove parsing markers**: The comments `/* [QUIZ_CONFIG_START/END] */`, `/* [QUESTIONS_START/END] */`, etc., are functional code. Removing them breaks the `sync_quiz_assets.py` script and the GUI editors (`quiz-editor.html`, etc.).
- **SW Registration in `index-template.html`**: Every index page produced by the toolkit MUST include the service worker registration block. Never remove this from the template.

### 16c. Path Resolution & Engines
- **Preserve `__QUIZ_ENGINE_BASE`**: This snippet is the only thing allowing quizzes to work in deep subfolders. Never replace it with a hardcoded `../` or `/` path.
- **Shared Assets**: The `SHARED` fallback list in the service worker is critical. If you rename a core asset (like `index-engine.css`), you MUST update the fallback logic in both the toolkit `sw.js` and the generator's `generate_sw_js`.

### 16d. Data Safety (localStorage)
- **Stable UIDs**: Never modify the `uid` of a quiz file once it has been distributed. This orphans all user progress and tracker data.
- **Scoped Clear**: In `index-engine.js`, always use `confirmClearTrackerData()` before performing any deletion. Never call `localStorage.removeItem()` directly in a UI button without a confirmation step.

### 16e. Offline Logic
- **Toolkit vs Project Caches**: The toolkit uses `quiz-tool-` as a cache prefix. Generated projects use `quiz-cache-`. Never mix these, as it causes cross-contamination of offline data.
- **Network-First for Hubs**: All `index.html` (hub) pages MUST use a network-first strategy in the service worker to ensure users see the latest quiz list when online.

---

## 14. Adding a New Tool to QuizTool

1. Create `new-tool.html` in the repo root
2. Add it to `QUIZZES` in `index.html`:
   ```js
   { title: "New Tool", description: "What it does", icon: "🔧", tags: ["Tool"], url: "new-tool.html" }
   ```
3. The tool should be **fully client-side** — no server calls, no dependencies beyond what's already in the toolkit
4. Use `localStorage.getItem('quiz-theme')` to respect the current theme

---

## 15. Dependency Map

```
QuizTool (toolkit pages)
  index.html → index-engine.js, index-engine.css, sw.js (prefix: quiz-tool-)

  quiz-maker.html      → quiz-template.html (fetched at runtime)
  bank-maker.html      → question-bank-template.html (fetched at runtime)
  index-editor.html    → index-template.html (fetched at runtime)
  quiz-editor.html     → [uploads existing quiz file]
  quiz-combiner.html   → [uploads multiple quiz/bank files]

generate_project.py (Flask)
  → reads: index-engine.js, index-engine.css, quiz-engine.js, bank-engine.js
  → reads: scripts/sync_quiz_assets.py, scripts/standardize_quiz_files.py
  → reads: generator_templates/index.html  (the Web UI)
  → reads: icon-*.png
  → generates: gen_index_html() for all index pages
  → generates: generate_sw_js() for sw.js with full precache list
  → outputs: project.zip
```

No npm. No bundler. No build step. Everything is plain static HTML/JS/CSS.
