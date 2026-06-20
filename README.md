# QuizTool V5 🎯

A modern, feature-rich quiz creation and management platform built with vanilla HTML, CSS, and JavaScript. Create custom quizzes, flashcards, written assessments, and deploy production-ready quiz sites — all in a beautiful, responsive interface.

> 👉 **Live Demo**: [eyad-elghareeb.github.io/QuizTool](https://eyad-elghareeb.github.io/QuizTool/)

---

## ✨ Highlights

### 🧠 8 Quiz Engines

| Engine | Purpose |
|--------|---------|
| **Quiz Engine** | Full MCQ quiz SPA with progress save, tracker, highlighter, keyboard shortcuts |
| **Bank Engine** | Large question banks with sequential/random session selection |
| **Flashcard Engine** | Basic + cloze card study modes with spaced repetition |
| **Written Engine** | Essay assessments with AI feedback, rubrics, markdown rendering |
| **UWorld Engine** | High-accuracy timed MCQ mode with detailed analytics |
| **Hub Engine** | Quiz card dashboard, tracker overview, theme management |
| **Search Engine** | Global content search across all quizzes and banks |
| **AI Assistant** | Browser-side AI Q&A for explaining concepts |

### 🛠️ 10 Authoring Tools

| Tool | What it does |
|------|-------------|
| `quiz-maker.html` | GUI quiz builder — no coding needed |
| `quiz-maker-js.html` | Paste JSON arrays for bulk import |
| `bank-maker.html` | GUI question bank builder |
| `quiz-editor.html` | Edit existing quiz/bank files |
| `index-editor.html` | Create/edit hub index pages |
| `quiz-combiner.html` | Merge quizzes into a single bank |
| `flashcard-maker.html` | Build flashcard decks (basic + cloze) |
| `flashcard-editor.html` | Edit existing flashcard decks |
| `written-maker.html` | Create written assessments |
| `pdf-exporter.html` | Export quizzes to print-ready PDFs |

All tools are **fully client-side** — no data leaves your browser.

### 🖥️ 2 Native Desktop Apps (Tauri v2)

**Project Generator** (`tauri/`) — Generate production quiz sites with a 3-step wizard. Publish to GitHub Pages, Netlify, or Vercel with one click. Ships as a native binary — no Python, no CLI.

**Admin Dashboard** (`tauri-admin/`) — Full local management for quiz projects: file browser, structured editors (6 file types), Git integration, PDF export, provider-aware deploy, HTTP preview server. All file operations run natively via Rust IPC.

### 📄 Premium PDF Export

Export quizzes to professional PDFs via a Python ReportLab sidecar:

- **5 style modes**: Standard, Styled, Compact, Detailed, MCQ Notes
- **Page sizes**: A3/A4/A5/Letter/Legal/Tabloid, portrait/landscape
- **Typography**: Poppins headings + Lora body (auto-downloaded)
- **Cover page**: Full-bleed dark with medical SVG icons
- **Hyperlinked TOC** with PDF bookmarks
- **Answer key modes**: Inline, End of Chapter, End of Book, Hidden

### 🔄 Cross-Device Sync

P2P-first sync engine for transferring quiz progress between devices:

- WebRTC P2P (primary) → MQTT relay → QR code → manual text/file (fallback chain)
- Public MQTT signaling via `broker.emqx.io` — STUN-based room discovery
- v2.1 hybrid deduplication, timestamp-based merge, corrupted-data safety

### 📊 Question Tracker

Long-term mistake tracking across all sessions. Shared between all engines and hub pages:

- Scoped dashboard (folder / all / single quiz)
- Review mode: dynamic session from tracked questions
- Background path healing via `tracker-map.json`
- O(1) badge counting with regex (no `JSON.parse`)
- Selective clearing by scope

### 🎨 Design System

| Variable | Dark | Light |
|----------|------|-------|
| Background | `#0d1117` | `#f3f0eb` |
| Surface | `#161b22` | `#ffffff` |
| Accent | `#f0a500` | `#c27803` |
| Correct | `#2ea043` | `#16a34a` |

- Google Fonts: Outfit (body) + Playfair Display (headings)
- Single-reflow animations, throttled UI timers, 4-color highlighter, keyboard shortcuts
- All CSS injected by engines — no external stylesheets in quiz files

---

## 🚀 Getting Started

### Quick Start

1. Open `index.html` in your browser — browse all tools from the hub
2. Use `quiz-maker.html` to create your first quiz in minutes
3. Use `pdf-exporter.html` to export to PDF, or generate a full quiz site

### Generating a Full Quiz Site

**Using the Tauri app (recommended):**
```bash
cd tauri && cargo tauri build
# Or run in dev mode: cargo tauri dev
```

**Using the recommended Tauri generator:**
```bash
cd tauri && cargo tauri dev
```

### Running the Tauri Admin Dashboard

```bash
cd tauri-admin && cargo tauri dev
```

Or build a standalone binary:
```bash
cd tauri-admin && cargo tauri build
```

---

## 📁 Project Structure

```
QuizTool/
├── index.html                 ← Tool hub
├── quiz-engine.js / bank-engine.js / ...  ← 8 engines
├── quiz-maker.html / bank-maker.html / ... ← 10 authoring tools
├── quiz-template.html / ...   ← 5 templates
├── tauri/                     ← Native project generator
├── tauri-admin/               ← Native admin dashboard
├── scripts/                   ← PDF generator, sync engine bundler, fonts
│   ├── pdf_generator.py       ← ReportLab PDF engine
│   ├── ensure_pdf_deps.py
│   ├── download_pdf_fonts.py
│   └── fonts/                 ← 9 TTF font files
├── sw.js / manifest.webmanifest / favicon.svg  ← PWA assets
├── AGENTS.md                  ← Full LLM reference
└── .github/workflows/         ← CI/CD
```

---

## 🔗 Links

- **Live Demo**: [QuizTool Online](https://eyad-elghareeb.github.io/QuizTool/)
- **GitHub**: [eyad-elghareeb/QuizTool](https://github.com/eyad-elghareeb/QuizTool)
- **Sample Site**: [MU61S8 Medicine Quizzes](https://eyad-elghareeb.github.io/MU61S8/)

## 📝 License

Custom Non-Commercial License — free for personal and educational use. Attribution required. No commercial use without permission.

## ⚠️ Disclaimer

This is an authoring tool. Medical content accuracy is the responsibility of the content author. The software is provided "as is" without warranty.

---

**Made with ❤️ using vanilla web technologies**
