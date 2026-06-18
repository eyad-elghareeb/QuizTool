# AGENTS.md — QuizTool V5

> **Purpose:** Complete reference for any LLM agent working on this repository. Read this before touching any file. Covers the authoring toolkit, engines, project generator, Tauri desktop apps, and PDF generation system.
>
> **Generated projects:** Each generated quiz site (e.g., MU61S8) has its own `AGENTS.md` with site-specific reference. That file covers the quiz-site runtime (engines, file schemas, CI/CD, sync script). This file covers QuizTool itself.

## Rules

These rules apply to every task unless explicitly overridden.

1. **Think Before Coding** — State assumptions. If uncertain, ask. Push back when a simpler approach exists.
2. **Simplicity First** — Minimum code that solves the problem. Nothing speculative. No abstractions for single-use code.
3. **Surgical Changes** — Touch only what you must. Don't "improve" adjacent code. Match existing style.
4. **Goal-Driven Execution** — Define success criteria. Loop until verified.
5. **Use the model only for judgment calls** — If code can answer, code answers.
6. **Token budgets are not advisory** — Per-task: 4,000 tokens. Per-session: 30,000 tokens.
7. **Surface conflicts, don't average them** — Pick one (more recent / more tested). Flag the other.
8. **Read before you write** — Check exports, callers, shared utilities before adding code.
9. **Tests verify intent, not just behavior** — A test that can't fail when business logic changes is wrong.
10. **Checkpoint after every significant step** — Summarize what was done, verified, and what's left.
11. **Match the codebase's conventions, even if you disagree** — Conformance > taste inside the codebase.
12. **Fail loud** — "Completed" is wrong if anything was skipped silently.

---

## 1. Project Identity

| Key | Value |
|-----|-------|
| **Type** | Authoring toolkit + project generator — static HTML tools, no backend required for the tools themselves |
| **Deployment** | GitHub Pages (the toolkit pages themselves are deployed here) |
| **Generator** | `tauri/` (Tauri Desktop App) is the primary generator. `generate_project.py` is deprecated but still maintained. |
| **Release** | V5 — 9 engines, 10 authoring tools, 2 Tauri desktop apps, ReportLab PDF exporter |
| **Output** | Generated ZIPs are MU61S8-equivalent sites (hub + quiz/bank/flashcard/written files + engines + SW) |

---

## 2. Repository Layout

```
QuizTool/
├── index.html                    ← QuizTool hub (lists all tools)
│
├── — ENGINES (8 total) —
├── quiz-engine.js                ← MCQ quiz engine (single-quiz SPA)
├── bank-engine.js                ← Question bank engine (session management)
├── index-engine.js               ← Hub page engine (cards, tracker dashboard, theme)
├── index-engine.css              ← Hub page styles
├── sync-engine.js                ← Synchronization engine (bundled/production)
├── sync-engine.src.js            ← Sync engine source (development)
├── flashcard-engine.js           ← Flashcard study engine (basic + cloze cards)
├── written-engine.js             ← Written/essay engine with AI feedback
├── uworld-engine.js              ← UWorld-style high-accuracy MCQ engine
├── search-engine.js              ← Global search across all quiz content
├── ai-assistant-engine.js        ← AI-powered Q&A assistant (browser-side)
│
├── — AUTHORING TOOLS (10) —
├── quiz-maker.html               ← GUI quiz builder → downloads quiz HTML
├── quiz-maker-js.html            ← Paste-JSON quiz builder
├── bank-maker.html               ← GUI bank builder → downloads bank HTML
├── quiz-editor.html              ← Edit existing quiz/bank files
├── index-editor.html             ← Edit/create index hub pages
├── quiz-combiner.html            ← Merge multiple quiz files into one bank
├── pdf-exporter.html             ← Export any quiz/bank to PDF standalone
├── js-question-bank.html         ← Browser-based question bank manager
├── flashcard-maker.html          ← GUI flashcard deck builder
├── flashcard-editor.html         ← Edit existing flashcard decks
├── written-maker.html            ← GUI written assessment builder
│
├── — TEMPLATES (5) —
├── quiz-template.html            ← Base template for quiz-maker output
├── question-bank-template.html   ← Base template for bank-maker output
├── index-template.html           ← Base template for index-editor output
├── flashcard-template.html       ← Base template for flashcard-maker output
├── written-template.html         ← Base template for written-maker output
│
├── — GENERATOR —
├── generate_project.py           ← [DEPRECATED] Flask server project generator
├── generator_templates/
│   └── index.html                ← 3-step wizard UI (Project Info → Structure → Publish)
├── start.bat                     ← Windows launcher (auto-installs Python deps)
├── build_exe.py                  ← PyInstaller build script for standalone EXE
├── generate_icons.py             ← Multi-size PNG icon generator
├── extract.py                    ← Bridge: extracts HTML from admin-dashboard.py → Tauri frontend
├── QUICKSTART.md                 ← 3-step quickstart guide
├── GENERATOR_UPDATES.md          ← Generator changelog
│
├── — SCRIPTS —
├── scripts/
│   ├── build_sync_engine.ps1     ← Sync engine bundler (libs + src → production)
│   ├── admin-dashboard.py       ← [DEPRECATED] Python Flask admin dashboard
│   ├── sync_quiz_assets.py       ← Auto-index + SW updater for generated sites
│   ├── standardize_quiz_files.py ← One-time file formatter
│   ├── pdf_generator.py          ← Python-sidecar PDF generator (ReportLab)
│   ├── ensure_pdf_deps.py        ← PDF dependency checker/installer
│   ├── download_pdf_fonts.py     ← Download Poppins + Lora fonts
│   ├── fonts/                    ← TTF font files for PDF generation
│
├── — DESKTOP APPS (TAURI) —
├── tauri/                        ← Tauri generator root (primary)
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs               ← App controller, command registration
│   │   ├── generator.rs           ← Project generation logic
│   │   ├── api_helpers.rs         ← GitHub/Netlify/Vercel API helpers
│   │   └── engines.rs             ← Embedded engine constants (9 engines)
│   └── frontend/
│       └── index.html            ← Generator 3-step wizard UI
│
├── tauri-admin/                  ← Tauri admin dashboard root (primary)
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs               ← App controller
│   │   ├── commands.rs           ← 25+ IPC command handlers (FS, Git, PDF, deploy)
│   │   ├── deploy.rs             ← Provider-aware deploy (GitHub/Netlify/Vercel)
│   │   ├── git.rs                 ← Git operations
│   │   ├── parser.rs             ← File type detection (6 types), validation
│   │   ├── pdf.rs                 ← PDF generation (Python sidecar orchestration)
│   │   ├── server.rs             ← Lightweight HTTP preview server (tiny_http)
│   │   └── templates.rs          ← HTML generation (quiz/bank/written/flashcard/index)
│   └── frontend/
│       ├── index.html            ← Admin dashboard SPA (extracted from admin-dashboard.py)
│       └── pdf-exporter.html     ← Built-in PDF exporter UI
│
├── — TEST FILES —
├── uworld-cardio-test.html       ← UWorld-style cardiology test
├── flashcard-test.html           ← Flashcard test deck
│
├── — DEPLOYMENT —
├── sw.js                         ← Service worker for QuizTool itself
├── manifest.webmanifest          ← PWA manifest
├── tracker-map.json              ← UID-to-Path mapping (auto-generated)
├── favicon.svg
├── icon-{48,72,96,144,192,512}.png
├── serve.py                      ← Dev server (binds 0.0.0.0 for cross-device testing)
├── dist/                         ← Built executables
│
└── .github/workflows/
    ├── jekyll-gh-pages.yml       ← Deploys QuizTool to GitHub Pages
    └── build-tauri-release.yml   ← Builds + releases Tauri desktop binaries
```

---

## 3. The Nine Engines

These JS files are the **core shared assets**. They exist in this repo, are deployed with QuizTool's GitHub Pages, and are bundled into every ZIP that the Tauri generator produces.

| Engine | Consumed by | Role |
|--------|------------|------|
| `quiz-engine.js` | Individual quiz HTML files | Full SPA: injects all CSS+HTML, runs quiz, saves progress, tracker |
| `bank-engine.js` | Question-bank HTML files | Same as quiz + session management for large question banks |
| `index-engine.js` | All `index.html` hub pages | Renders quiz cards, tracker dashboard, theme |
| `flashcard-engine.js` | Flashcard HTML files | Basic + cloze card study modes, spaced repetition |
| `written-engine.js` | Written assessment HTML files | Essay questions with AI feedback, rubric, markdown rendering |
| `uworld-engine.js` | UWorld-style quiz HTML files | High-accuracy mode, detailed analytics, timed sessions |
| `search-engine.js` | Hub pages | Global search across all quiz/bank/written/flashcard content |
| `ai-assistant-engine.js` | Any page | Browser-side AI Q&A assistant for explaining concepts |
| `osce-engine.js` | OSCE virtual-patient HTML files | Conversation-style history-taking with AI virtual patients; rubric-based examiner feedback |

### Engine Path Resolution

Quiz/bank/written/flashcard files self-locate their engine at runtime:

```js
window.__QUIZ_ENGINE_BASE = '../'.repeat(
  Math.max(0, location.pathname.split('/').filter(Boolean).length - 2)
);
document.write('<scr'+'ipt src="'+window.__QUIZ_ENGINE_BASE+'quiz-engine.js"><\/scr'+'ipt>');
```

Each engine uses its own `__{NAME}_ENGINE_BASE` variable. **Never hardcode the path.**

---

## 4. Templates

| Template | Used by | Markers | Engine Loaded |
|----------|---------|---------|---------------|
| `quiz-template.html` | `quiz-maker.html` | `QUIZ_CONFIG`, `QUESTIONS` | `quiz-engine.js` |
| `question-bank-template.html` | `bank-maker.html` | `BANK_CONFIG`, `QUESTION_BANK` | `bank-engine.js` |
| `index-template.html` | `index-editor.html` | `QUIZZES` | `index-engine.js` |
| `flashcard-template.html` | `flashcard-maker.html` | `FLASHCARD_CONFIG`, `FLASHCARD_BANK` | `flashcard-engine.js` |
| `written-template.html` | `written-maker.html` | `WRITTEN_CONFIG`, `WRITTEN_QUESTIONS` | `written-engine.js` |

**Critical:** Tools fetch templates at runtime. Changes to templates affect all future output. **Never remove marker comments** — `sync_quiz_assets.py` and the Tauri admin parser parse them.

---

## 5. File Schemas

### 5a. Quiz / Bank File Schema

```html
<script>
/* [QUIZ_CONFIG_START] */
const QUIZ_CONFIG = {
  "uid": "unique_snake_case_id",  // REQUIRED — stable, never change
  title: "Quiz Display Title",
  description: "Short description",
};
/* [QUIZ_CONFIG_END] */

/* [QUESTIONS_START] */
const QUESTIONS = [
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,          // 0-indexed
    "explanation": "Why A is correct.",
    "children": [           // optional sub-questions (for multi-part questions)
      { "question": "Child?", "options": [...], "correct": 0 }
    ]
  }
];
/* [QUESTIONS_END] */
</script>
```

Bank files use `BANK_CONFIG` + `QUESTION_BANK`, load `bank-engine.js`. Same entry shape.

### 5b. Flashcard File Schema

```js
/* [FLASHCARD_CONFIG_START] */
var BANK_CONFIG = {
  uid: "flashcard_deck_id",
  title: "Flashcard Deck",
  description: "Study your flashcards.",
  icon: "🃏",
};
/* [FLASHCARD_CONFIG_END] */

/* [FLASHCARD_BANK_START] */
var FLASHCARD_BANK = [
  {
    type: "basic",           // "basic" or "cloze"
    front: "Question / term",
    back: "Answer / definition",
    tags: ["tag1", "tag2"],
    id: "unique-id"
  },
  {
    type: "cloze",
    text: "The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell.",
    tags: ["biology"],
    id: "bio-003"
  }
];
/* [FLASHCARD_BANK_END] */
```

Loads `flashcard-engine.js`.

### 5c. Written Assessment File Schema

```js
/* [WRITTEN_CONFIG_START] */
const WRITTEN_CONFIG = {
  uid: "written_assessment_id",
  title: "Written Assessment",
  description: "Answer in your own words.",
  icon: "📝"
};
/* [WRITTEN_CONFIG_END] */

/* [WRITTEN_QUESTIONS_START] */
const WRITTEN_QUESTIONS = [
  {
    id: "wq-1",
    question: "Explain the difference...",
    modelAnswer: "Expected answer text",
    rubric: "Grading rubric for AI context",
    explanation: "Extra background",
    tags: ["biology", "respiration"]
  }
];
/* [WRITTEN_QUESTIONS_END] */
```

Loads `written-engine.js`. The engine supports AI feedback via browser-based LLM or API key.

### 5d. Index / Hub File Schema

```html
<body>
  <div class="topbar">...</div>
  <div class="container">
    <header class="hero">...</header>
    <div class="quiz-grid" id="quiz-grid"></div>
  </div>
  <script>
  const QUIZZES = [
    { title: "Quiz Name", description: "...", icon: "📘", tags: ["Tag1", "20 Questions"], url: "file.html" },
    { title: "📁 Subfolder", description: "...", icon: "📁", tags: ["Folder"], url: "subfolder/index.html" }
  ];
  </script>
  <div class="dash-overlay" id="tracker-dashboard">...</div>
  <script src="index-engine.js"></script>
  <script>if('serviceWorker' in navigator){...}</script>
</body>
```

**The `QUIZZES` array** is the only thing that changes between index pages.

### 5e. OSCE Virtual Patient File Schema

```js
/* [OSCE_CONFIG_START] */
const OSCE_CONFIG = {
  uid: "osce_test_cases",
  title: "OSCE Virtual Patient — Test",
  description: "Practice history-taking with AI virtual patients.",
  icon: "🩺"
};
/* [OSCE_CONFIG_END] */

/* [OSCE_CASES_START] */
const OSCE_CASES = [
  {
    id: "case-001",
    title: "Chest Pain in a 55-Year-Old Man",
    specialty: "Cardiology",
    difficulty: "Intermediate",
    patient: {
      name: "Mr. Robert Hayes",
      age: 55,
      gender: "male",
      avatarSeed: "robert-hayes",
      opening: "Doctor, I've been getting this awful pressure in my chest..."
    },
    hiddenProfile: {     // NEVER shown to student; given to Gemini as ground truth
      diagnosis: "Stable angina pectoris",
      keySymptoms: ["substernal pressure", "exertional", "relieved by rest"],
      redFlags: ["diaphoresis", "radiation to left arm"],
      pastHistory: ["hypertension", "former smoker"],
      vitalSigns: "BP 148/92, HR 88, afebrile"
    },
    rubric: {            // examiner scoring criteria
      mustAsk: ["SOCRATES pain characterization", "cardiac risk factors", "associated symptoms"],
      bonus: ["family history of CAD", "medication reconciliation"]
    }
  }
];
/* [OSCE_CASES_END] */
```

Loads `osce-engine.js`.

---

## 6. Tauri Desktop Apps (Primary)

QuizTool provides two native desktop wrappers built with Tauri v2. **These are the primary, actively developed versions.**

### 6a. Project Generator (`tauri/`)

Replaces the deprecated `generate_project.py`.

- **Architecture**: Pure Rust backend (`generator.rs`, `api_helpers.rs`) with embedded engine files (`engines.rs`)
- **Embedded Assets (engines.rs)**: `INDEX_ENGINE_JS`, `INDEX_ENGINE_CSS`, `SEARCH_ENGINE_JS`, `QUIZ_ENGINE_JS`, `BANK_ENGINE_JS`, `SYNC_ENGINE_JS`, `FLASHCARD_ENGINE_JS`, `WRITTEN_ENGINE_JS`, `AI_ASSISTANT_ENGINE_JS` + templates, icons, configs
- **Custom Protocol**: Serves frontend via `quiztool://localhost/`
- **API helpers** (`api_helpers.rs`): GitHub (verify/publish with GIT_ASKPASS), Netlify (site + ZIP deploy), Vercel (file deployment)
- **Frontend**: 3-step wizard UI (Project Info → Structure → Publish)

### 6b. Admin Dashboard (`tauri-admin/`)

Replaces the deprecated `admin-dashboard.py`.

| Component | Role |
|-----------|------|
| `commands.rs` | 25+ IPC commands: FS CRUD, Git operations, PDF export, provider deploy, file conversion |
| `parser.rs` | File type detection (6 types: Quiz, Bank, Index, Flashcard, Written, Html), validation |
| `deploy.rs` | Provider-aware deploy (GitHub Pages, Netlify, Vercel) with metadata persistence |
| `git.rs` | Git operations with `CREATE_NO_WINDOW` flag on Windows |
| `pdf.rs` | PDF generation via Python ReportLab sidecar (see §9) |
| `server.rs` | `tiny_http` preview server with CORS, dynamic engine path rewriting, asset fallbacks |
| `templates.rs` | HTML generation for quiz/bank/written/flashcard/index files with depth-aware prefixes |

**Features:**
- File browser with type filters and context menus
- New file wizard (presets, paste JSON/text, clone existing)
- Structured editors for all 6 file types + raw HTML editor
- Multi-tab viewer (Preview / Editor / Metadata / Raw HTML)
- Convert files: quiz ↔ bank, quiz/bank → flashcard
- Provider-aware deploy (GitHub, Netlify, Vercel)
- PDF export (preview + download)
- Git integration (status, commit, pull, push)
- Quick open (`Ctrl+K`), keyboard shortcuts, unsaved changes protection

### 6c. Frontend Build Pipeline (`extract.py`)

The Tauri admin frontend is **not hand-written** — it is extracted from the deprecated `admin-dashboard.py`:

```
admin-dashboard.py
    ↓ [extract.py]
    ├── tauri-admin/frontend/index.html          (DASHBOARD_HTML → invoke-based IPC)
    └── tauri-admin/frontend/pdf-exporter.html   (PDF_EXPORTER_HTML → standalone)
```

`extract.py` does:
1. Extracts `DASHBOARD_HTML` and `PDF_EXPORTER_HTML` via regex
2. Injects global Tauri bridge (`window.__TAURI__.core.invoke`)
3. Replaces `fetchJson()` with IPC-based Rust command calls
4. Rewrites preview URLs to `quiztool-preview://localhost/`
5. Patches `/admin/pdf-exporter` links to local `pdf-exporter.html`
6. Injects project name bootstrap script
7. Writes output to `tauri-admin/frontend/`

**Run after modifying `admin-dashboard.py`:**
```bash
python extract.py
```

### 6d. Build Instructions

```bash
# Generator
cd tauri/
npm run tauri build

# Admin Dashboard
cd tauri-admin/
npm run tauri build

# Extract frontend (after admin-dashboard.py changes)
python extract.py
```

---

## 7. generate_project.py — The Python Generator (Deprecated)

> **DEPRECATED:** All new features should be implemented in the Tauri native build (`tauri/`). This Python version is kept for backwards compatibility only.

Full documentation preserved in the [previous version of AGENTS.md](https://github.com/eyad-elghareeb/QuizTool). Key points:

- Flask server on `http://localhost:5500`
- 3-step wizard UI at `generator_templates/index.html`
- API endpoints for generate, preview, GitHub/Netlify/Vercel publish
- Same engine files + scripts bundled
- Same ZIP output structure
- Project directories persist on disk (never deleted)

---

## 8. Authoring Tools Reference

| Tool | Input | Output | Notes |
|------|-------|--------|-------|
| `quiz-maker.html` | GUI form | `*.html` quiz file | Uses `quiz-template.html` |
| `quiz-maker-js.html` | Paste JSON `QUESTIONS` | `*.html` quiz file | Fast bulk import |
| `bank-maker.html` | GUI form | `*.html` bank file | Uses `question-bank-template.html` |
| `quiz-editor.html` | Upload existing quiz/bank | Modified `*.html` | Reads QUIZ_CONFIG + QUESTIONS |
| `index-editor.html` | Upload index.html or fresh | Modified `index.html` | Fetches `index-template.html` |
| `quiz-combiner.html` | Upload multiple quiz/bank files | Single merged bank | Deduplicates questions |
| `flashcard-maker.html` | GUI form + JSON paste | `*.html` flashcard deck | Basic + cloze cards |
| `flashcard-editor.html` | Upload existing deck | Modified `*.html` | Edits FLASHCARD_BANK |
| `written-maker.html` | GUI form | `*.html` written assessment | Questions with model answers |
| `pdf-exporter.html` | Upload quiz/bank HTML | PDF download | Client-side via html2pdf |
| `js-question-bank.html` | Manual entry | localStorage bank | Exportable |

All tools are **fully client-side** — no data sent anywhere.

---

## 9. PDF Generator System

The Tauri admin dashboard uses a **Python sidecar** architecture for premium PDF generation. The Rust backend (`pdf.rs`) orchestrates a Python process running `pdf_generator.py` (ReportLab).

### Architecture

```
tauri-admin frontend
    → invoke('export_pdf', {config})
    → pdf.rs::generate_pdf()
        → writes config.json to temp dir
        → spawns python pdf_generator.py config.json output.pdf
        → reads output.pdf bytes
        → returns base64 to frontend
    → frontend downloads
```

### Key Files

| File | Role |
|------|------|
| `tauri-admin/src/pdf.rs` | Rust sidecar orchestrator: `QuestionData`, `ChildQuestionData`, `QuizData`, `ExportConfig`, `ensure_deps()`, `generate_pdf()` |
| `scripts/pdf_generator.py` | ReportLab PDF engine (1650 lines). Cover page, hyperlinked TOC, chapter headers, question rendering (standard/styled/detailed/written/mcqnotes), answer key, page templates |
| `scripts/ensure_pdf_deps.py` | Checks Python 3.8+, pip, ReportLab; auto-installs if missing |
| `scripts/download_pdf_fonts.py` | Downloads Poppins (headings) + Lora (body) from Google Fonts |
| `scripts/fonts/` | 9 TTF font files: Poppins (Bold, BoldItalic, Italic, Light, LightItalic, Medium, Regular) + Lora (Italic, Regular) |

### Design Principles

- **Typography**: Poppins for headings/labels, Lora for body, LiberationMono for code
- **Grid**: 4pt spacing base (4, 8, 12, 16, 24, 36, 48)
- **Color 60/30/10**: Navy dominant (#1A3A5C), Cobalt/Emerald structure, Gold accent
- **Cover**: Full-bleed dark with medical SVG icons (stethoscope, DNA, ECG, syringe)
- **Page sizes**: A3/A4/A5/Letter/Legal/Tabloid, portrait/landscape, compact mode scaling

### Style Modes

| Mode | Description |
|------|-------------|
| `standard` | Clean black-on-white, question + options + answer key |
| `styled` | Gold badge headers, rounded option cards, gradient chapter banners |
| `detailed` | Extended spacing, section banners, callout explanations |
| `written` | Essay questions with model answer callout box, children support |
| `mcqnotes` | Ultra-compact: question + ✓ answer + explanation on tight spacing |

### Child Question Support (`build_written_question`)

Questions with `children` array render sub-questions first (with `a.`, `b.`, etc. labels inline with question text), followed by a single combined `MODEL ANSWER` callout box. Tighter spacing between children (`sp(0.5, fs)`).

---

## 10. Synchronization System (v2)

Implemented in `sync-engine.src.js`, bundled into `sync-engine.js` via `scripts/build_sync_engine.ps1`.

### Architecture
- **Signaling**: Public MQTT (`broker.emqx.io`) via WebSockets (Port 8084)
- **Discovery**: STUN-based room hashing. Devices on same public IP share a room.
- **Data Transfer**: WebRTC P2P (primary) → MQTT Relay → Multi-Page QR → Text/File (fallback chain)

### Data Integrity (v2.1)
- Hybrid deduplication using `idx` + `text` matching
- 1-to-1 matching prevents squashing
- Counts recalculated post-merge
- `timestamp`-based progress merging
- `try...catch` per key for corrupted data safety

### Critical Rules
- Use `v2` topic prefix
- `deviceId` stored in `sessionStorage`
- MQTT auto-disconnect after 60s inactivity
- Presence messages NOT retained
- Camera scanning restricted to HTTPS/Localhost

---

## 11. localStorage Key Reference

| Key | Set by | Value |
|-----|--------|-------|
| `quiz-theme` | All pages | `'dark'` \| `'light'` |
| `quiz_progress_v1_<uid>` | quiz-engine / bank-engine | In-progress quiz state |
| `quiz_tracker_v2_<uid>` | quiz/bank-engine post-submit | Wrong + flagged questions |
| `quiz_tracker_keys` | Tracker system | JSON array of all tracked quiz UIDs |
| `bank_progress_<uid>` | bank-engine | Sequential progress: `{seenIndices, lastIdx}` |

---

## 12. Global API: Engine Functions

### quiz-engine.js
`startQuiz()`, `goTo(idx)`, `nextQuestion()`, `toggleFlag(idx)`, `attemptSubmit()`, `confirmSubmit()`, `restartQuiz()`, `filterResults(filter, btn)`, `exportToPDF()`, `toggleTheme()`, `navigateToIndex(event)`, `showToast(msg, actions[])`, `confirmResetProgress()`, `saveTrackerData()`, `updateDashboardBadge()`, `openTrackerDashboard(scope?)`, `openKbHelp()`, `closeKbHelp()`

### bank-engine.js extras
`selectSessionQuestions(count, order)`, `getBankProgress()`, `saveBankProgress(p)`, `resetBankProgress()`, `adjustCount(delta)`, `setCount(n)`, `autoSetTime(n)`

### index-engine.js
`renderQuizzes()`, `toggleTheme()`, `showToast(msg)`, `openTrackerDashboard()`, `closeTrackerDashboard()`, `confirmClearTrackerData()`, `closeClearTrackerModal()`, `clearAllTrackerData()`, `removeTrackerItem(uid, qIdx)`, `exportTrackerToPDF()`, `updateDashboardBadge()`

### flashcard-engine.js
`startSession()`, `flipCard()`, `nextCard()`, `prevCard()`, `rateCard(difficulty)`, `shuffleDeck()`, `getDueCards()`, `resetSession()`

### written-engine.js
`startAssessment()`, `submitAnswer(qIdx)`, `getAiFeedback(qIdx)`, `renderMarkdown(text)`, `saveDraft()`, `loadDraft()`, `exportToPDF()`

### search-engine.js
`searchAll(query)`, `searchContent(query)`, `searchFiles(query)`, `highlightMatches(text, query)`, `openResult(result)`

---

## 13. Question Tracker System

Aggregates mistakes and flagged items across all sessions for long-term review. Shared between all engines and hub pages.

### Data Lifecycle
1. **Capture**: `confirmSubmit()` calls `saveTrackerData()`
2. **Merge**: Existing data merged with current session (by global index for banks, by text for quizzes)
3. **Storage**: `localStorage` under `quiz_tracker_v2_<uid>`, UID added to `quiz_tracker_keys`

### Dashboard Features
- Scoped view (current folder, all, or single quiz)
- Review mode: dynamic session from tracked questions
- Deduplication by text + index
- Tracker Healing: auto-updates stored paths via `tracker-map.json`
- Selective clearing by scope

---

## 14. Highlighter & Markup System

- **Highlighting**: Toggle via 🖍️ icon or `H` key. 4 colors + Eraser. Auto-apply on selection.
- **Strikethrough**: Right-click option label or `S` key while hovering. Red line + dim.
- **Persistence**: Offsets stored in `state.highlights[qIdx]`, `state.strikethrough[qIdx]`, saved to localStorage.

---

## 15. Keyboard Shortcut System

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next question |
| `1` - `4` | Select option / set highlight color |
| `F` | Toggle Flag |
| `H` | Toggle Highlighter |
| `S` | Toggle Strikethrough (on hover) |
| `Enter` | Submit quiz |
| `/` | Toggle keyboard help |
| `Esc` | Close modals / help panel |

---

## 16. Session Management & Persistence

- **Auto-Save**: Every option select, flag, or highlight triggers `saveProgress()`
- **Restore**: On load, detects existing progress → toast with [Restore] [Dismiss]
- **Storage**: `quiz_progress_v1_<uid_sanitized>` in localStorage

---

## 17. CSS / Theme System

All CSS injected by engines. No external stylesheets in quiz/bank/written/flashcard files.

| Variable | Dark | Light |
|----------|------|-------|
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

---

## 18. Performance & Offline Resilience

### Eager Folder Title Caching
`saveTrackerData()` uses `_folderTitleCache` to maintain human-readable folder names offline. Never remove `_eagerFolderTitle` or `fetchFolderTitle`.

### O(1) Badge Rendering
`updateDashboardBadge` uses regex on raw localStorage string — never `JSON.parse`. Preserve `wrongCount` and `flaggedCount` as top-level JSON properties.

### Quota Exceeded Safety
All storage mutations wrapped in `try...catch`. `QuotaExceededError` (code 22) shows toast to clear tracker data.

### Debounced State Persistence
`debounceSaveProgress()` (500ms) ensures no data loss on quick close.

### Tracker Healing
Fetches `tracker-map.json` on dashboard open, silently updates stale `path`/`folderPath` entries.

### Animation Optimizations
Single-reflow transitions, reduced `will-change`, timer throttled to 500ms.

---

## 19. Adding a New Tool to QuizTool

1. Create `new-tool.html` in the repo root
2. Add it to `QUIZZES` in `index.html`:
   ```js
   { title: "New Tool", description: "What it does", icon: "🔧", tags: ["Tool"], url: "new-tool.html" }
   ```
3. Fully client-side — no server calls
4. Use `localStorage.getItem('quiz-theme')` to respect the current theme
5. If it defines a new file format: add markers, add a template, register in `parser.rs` `FileType` enum, add validation in `validate_dashboard_content()`, add to `templates.rs::create_*_html()`, add engine to `engines.rs`, add the engine file to the repo root.

---

## 20. Dependency Map

```
QuizTool (toolkit pages)
  index.html → index-engine.js, index-engine.css, sw.js (prefix: quiz-tool-)

  quiz-maker.html      → quiz-template.html
  bank-maker.html      → question-bank-template.html
  index-editor.html    → index-template.html
  flashcard-maker.html → flashcard-template.html
  written-maker.html   → written-template.html
  osce-test.html       → osce-engine.js (loads via __OSCE_ENGINE_BASE)
  osce-engine.js       → Gemini generateContent (patient chat + examiner scoring)

tauri/ (Rust Generator)
  engines.rs → embeds: 9 engines, templates, scripts, icons
  generator.rs → build_project_zip()
  api_helpers.rs → GitHub/Netlify/Vercel API

tauri-admin/ (Rust Admin Dashboard)
  commands.rs → 25+ IPC commands
  parser.rs → FileType enum (6 types), validation
  pdf.rs → Python ReportLab sidecar
  deploy.rs → Provider publish
  server.rs → HTTP preview server
  templates.rs → HTML generators
  frontend/ ← extracted from admin-dashboard.py via extract.py

PDF Pipeline
  pdf.rs → scripts/ensure_pdf_deps.py → scripts/pdf_generator.py → ReportLab
```

---

## 21. CI/CD — GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `jekyll-gh-pages.yml` | Push to `main` | Deploys QuizTool hub to GitHub Pages |
| `build-tauri-release.yml` | Push tags / manual | Builds `tauri/` and `tauri-admin/` → creates platform-specific release artifacts |

---

## 22. CRITICAL RULES: DO NOT BREAK

### Engines & Templates
- **Never remove parsing markers**: `/* [QUIZ_CONFIG_START/END] */`, `/* [FLASHCARD_CONFIG_START/END] */`, etc. break `sync_quiz_assets.py`, editors, and the Tauri admin parser.
- **Preserve engine path resolution**: Never replace `__{NAME}_ENGINE_BASE` with hardcoded paths.
- **SW Registration**: Every index page MUST include the service worker registration block.

### Data Safety
- **Stable UIDs**: Never modify a file's `uid` after distribution — it orphans all learner progress.
- **Scoped Clear**: Always use `confirmClearTrackerData()` before deleting tracker data.

### Tauri
- **Never commit `target/`**: Rust build directories can be 1GB+. `.gitignore` entries for `tauri/target/` and `src-tauri/target/` must remain.
- **Run `extract.py` after `admin-dashboard.py` changes**: The Tauri admin frontend is derived from it. Without extraction, the frontend is stale.
- **Keep CSP at `null`**: All engines inject inline `<style>` and `<script>` tags. A strict CSP breaks everything.

### PDF Generator
- **Always check dependencies first**: `ensure_pdf_deps()` before `generate_pdf()`. Missing Python or ReportLab causes silent failure.
- **Font fallback chain**: Poppins → Lora → LiberationMono → built-in Helvetica. Never assume a font is available.
- **Thread safety**: `OnceLock` in `pdf.rs` ensures dep check runs once per session. Do not remove.
- **Windows console**: Use `CREATE_NO_WINDOW` flag when spawning Python sidecar to prevent CMD popups.

### Python Generator (deprecated but still maintained)
- **Never embed tokens in git URLs**: Use `GIT_ASKPASS` with env var.
- **Never delete project directories**: Persist for admin dashboard. `rmtree` is banned.
- **Guard all `fetch()` with `resp.text()` → `JSON.parse()`**: Never `resp.json()` directly.
- **Use exact filename matching for dropped files**: `quiz.get('url') == filename`. No substring matching.

### Offline Logic
- **Cache prefixes**: toolkit uses `quiz-tool-`, generated projects use `quiz-cache-`. Never mix.
- **Network-First for Hubs**: All `index.html` pages use network-first SW strategy.

---

## 23. Build & Maintenance

### Bundling the Sync Engine
```powershell
.\scripts\build_sync_engine.ps1
```
Fetches CDN dependencies (LZString, Paho MQTT, QRCode.js, Html5Qrcode) and bundles with `sync-engine.src.js` into `sync-engine.js`.

### Extracting the Tauri Admin Frontend
```bash
python extract.py
```
Must be run whenever `scripts/admin-dashboard.py` is modified. Extracts and patches `DASHBOARD_HTML` and `PDF_EXPORTER_HTML` into `tauri-admin/frontend/`.

### Propagating Changes
After modifying any engine file, propagate it to:
1. `tauri/src/engines.rs` (embedded constant for generator ZIPs)
2. Any maintained generated projects that vendor the engine files

### Icon Generation
```bash
python generate_icons.py
```
Generates `icon-{48,72,96,144,192,512}.png` from a source SVG.

---

## 24. Local Development

| Command | Purpose |
|---------|---------|
| `python serve.py` | Dev server on `0.0.0.0:5500` for cross-device sync testing |
| `python scripts/admin-dashboard.py` | Deprecated Python admin dashboard on `http://localhost:5500/admin/` |
| `cd tauri && cargo tauri dev` | Tauri generator in dev mode (native window + hot-reload) |
| `cd tauri-admin && cargo tauri dev` | Tauri admin dashboard in dev mode |
| `python generate_project.py` | Deprecated Python project generator on `http://localhost:5500` |
