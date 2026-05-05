# QuizTool 🎯
A modern, feature-rich quiz creation and management platform built with vanilla HTML, CSS, and JavaScript. Create custom quizzes, manage multiple exam types, and deploy production-ready quiz sites—all in a beautiful, responsive interface.

## ✨ Features

### 🏠 Central Quiz Hub (`index.html`)
- **Unified Dashboard**: Access all your quizzes from a single, beautifully designed landing page
- **Dynamic Quiz Cards**: Automatically generated cards for each quiz/exam with icons, descriptions, and metadata
- **Search & Filter**: Built-in search bar and tag filtering to quickly find quizzes
- **Theme Support**: Built-in dark/light mode toggle with persistent user preference
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Easy Extension**: Simply add new quiz configurations to the `QUIZZES` array to expand your quiz library

### 🚀 Project Generator (`generate_project.py`)
Generate production-ready quiz sites similar to MU61S8 with a single command!

- **Web UI Configuration**: Easy-to-use interface at http://localhost:5500
- **MU61S8 Structure**: Generates clean quiz-only instances (no QuizTool utilities)
- **Automated Deployment**: Includes GitHub Actions workflows for auto-deployment
- **Asset Synchronization**: Scripts to auto-update index pages and service worker precache
- **Tracker Map Generation**: Automatically generates `tracker-map.json` for persistent link reliability
- **Complete PWA Support**: All icon sizes (48px-512px), manifest, and offline-capable service worker
- **Folder Support**: Create multi-folder quiz structures with nested index pages
- **One-Click Export**: Download ready-to-deploy ZIP with proper file structure

**Generated Project Includes:**
- ✓ Core Engine Suite (`quiz-engine.js`, `bank-engine.js`, `index-engine.js`)
- ✓ Intelligent Service Worker with content-hashed caching
- ✓ PWA Manifest with all required icon sizes (48px-512px)
- ✓ Automated GitHub Actions (Sync Assets + Jekyll Deployment)
- ✓ Asset Management Scripts (`sync_quiz_assets.py`, `standardize_quiz_files.py`)
- ✓ Integrated Local Management via `admin-dashboard.py`
- ✓ Built-in Tracker Map for long-term link reliability
- ✓ Pre-configured `.gitignore` for clean version control

**Generated Project Structure:**
```
project-name/
├── .github/workflows/           # Auto-deployment workflows
│   ├── sync-quiz-assets.yml    # Updates index pages & SW precache
│   └── jekyll-gh-pages.yml     # Deploys to GitHub Pages
├── scripts/                     # Asset management scripts
│   ├── admin-dashboard.py      # Local Flask management interface
│   ├── sync_quiz_assets.py     # Auto-sync quiz assets
│   └── standardize_quiz_files.py # File formatter
├── [folder1]/index.html        # Folder quiz listings
├── [folder2]/index.html
├── index.html                   # Root hub page
├── index-engine.js              # Hub page engine
├── quiz-engine.js               # Quiz playback engine
├── bank-engine.js               # Question bank engine
├── sw.js                        # Service worker (offline support)
├── manifest.webmanifest         # PWA manifest
├── favicon.svg                  # SVG favicon
├── icon-*.png                   # PWA icons (48px-512px)
├── tracker-map.json              # UID-to-Path mapping
└── .gitignore                   # Git ignore rules
```

**Usage:**
```bash
python generate_project.py
# Web UI opens at http://localhost:5500
```

### 🛠️ Admin Dashboard (`scripts/admin-dashboard.py`)
A comprehensive local management interface for your quiz projects, providing a GUI for file management and content editing.

- **Workspace Overview**: Real-time project stats, file tree, and git status.
- **Structured Editors**: Edit `QUIZ_CONFIG`, `BANK_CONFIG`, and `QUIZZES` arrays through an intuitive GUI without touching code.
- **Path-Safe Generation**: Automatically generates stable UIDs based on folder hierarchy for new files.
- **Multi-Tab Preview**: Live preview with dedicated routes for testing before deployment.
- **Git Integration**: Built-in "Sync & Push" flow to commit and deploy changes easily.
- **File Management**: Create, rename, move, and delete files/folders directly from the dashboard.
- **Auto-Sync**: Trigger asset indexing and service worker updates with a single click.

### ✏️ Quiz Editor (`quiz-editor.html`)
Modify existing quiz or bank files without manually editing JSON arrays.

- **File Upload**: Simply upload an existing quiz/bank HTML file to load its content.
- **Metadata Management**: Update titles, descriptions, and icons through simple form fields.
- **Question Editor**: Add, remove, reorder, and duplicate questions with ease.
- **Marker Preservation**: Automatically respects and preserves the code markers required for the sync engine.
- **Instant Export**: Download the updated file immediately after editing.

### 📝 Index Editor (`index-editor.html`)
Create and manage custom index/hub pages for any project!

- **Visual Configuration**: Edit hub settings (title, description, theme) without touching code
- **Quiz Entry Manager**: Add, edit, and remove quiz entries with an intuitive form interface
- **Tag Management**: Easy tag creation and management with visual chip interface
- **Import/Export**:
  - Import JSON configurations or extract from existing HTML files
  - Export as JSON for sharing or as a complete standalone HTML file
- **Auto-Save**: Your work is automatically saved in browser storage
- **Live Preview**: See your configuration as JSON in real-time
- **Template-Based**: Generates hubs using the `index-template.html` for consistency

### 🌐 Index Template (`index-template.html`)
A reusable, customizable template for creating custom index/hub pages for any project!

- **Configurable Layout**: Customize titles, descriptions, and themes
- **Search & Filter**: Built-in search functionality and tag filtering
- **Self-Contained**: Works standalone with no dependencies
- **Easy to Customize**: Simply edit the `INDEX_CONFIG` object to personalize

### 🔧 Quiz Maker (`quiz-maker.html`)
Create custom quizzes without any coding required!

- **Visual Question Builder**: Add questions with multiple-choice options (A-E)
- **Flexible Configuration**:
  - Custom quiz titles and descriptions
  - Unlimited questions
  - Multiple answer options per question
  - Correct answer selection
  - Optional explanations for each question
- **Live Preview**: Generate and preview quiz JSON output instantly
- **Export Functionality**: Download your custom quiz as a standalone HTML file
- **Form Management**: Reset form with confirmation and draft support
- **Toast Notifications**: User-friendly feedback for actions

### 💻 Quiz Maker JS (`quiz-maker-js.html`)
JavaScript-based interactive quiz creation tool with enhanced functionality.

- **Large File Support**: Optimized parser handles 1000+ question arrays without freezing
- **Smart Parsing**: Tries JSON.parse first for speed, falls back to JS parser when needed
- **Error Recovery**: Shows multiple validation errors at once for faster debugging

### 🔀 Quiz Combiner (`quiz-combiner.html`)
Merge multiple quiz HTML files into a unified Question Bank!

- **Multi-File Import**: Drop any number of quiz HTML files to combine
- **Duplicate Removal**: Automatically detects and removes duplicate questions
- **Custom Bank Naming**: Configure your combined bank with a custom name
- **One-Click Download**: Export the merged question bank instantly
- **Perfect for**: Building comprehensive test banks from multiple sources

### 🏦 Bank Maker (`bank-maker.html`)
Create smart Question Banks with intelligent session tracking!

- **JS Array Input**: Build banks from large JavaScript question arrays
- **Large File Support**: Optimized parser handles 500+ question banks efficiently
- **Session Memory**: Remembers which questions you've already seen
- **Fresh Questions**: Always serves unseen questions each session
- **Coverage Tracking**: Monitors progress through the entire question pool
- **Ideal for**: Large question pools where variety is essential

### 📄 PDF Exporter (`pdf-exporter.html`)
Export your quizzes to clean, printable PDF format!

- **HTML to PDF**: Convert quiz HTML files to professional PDF documents
- **Print-Ready**: Clean formatting optimized for printing
- **Offline Distribution**: Share quizzes in a universally accessible format
- **Perfect for**: Creating physical test materials or study guides

### ⚡ JavaScript Mastery Bank (`js-question-bank.html`)
Comprehensive JavaScript question bank with 51 questions!

- **Extensive Coverage**: Closures, async/await, arrays, prototypes, and more
- **Flexible Session Size**: Pick how many questions to answer each session
- **Smart Selection**: Fresh questions every time with automatic tracking
- **Progress Monitoring**: Track your coverage of the entire question set
- **Great for**: Mastering JavaScript concepts through repeated practice

### 📚 Quiz Templates (`quiz-template.html`)
Pre-built quiz template for creating standardized exams with:
- Professional styling matching the main theme
- Score tracking and progress indicators
- Immediate feedback on answers
- Explanation display after answering
- Final score summary
- **Tracker Persistence**: Mistakes and flagged questions are saved to the long-term tracker
- **Highlighter & Markup**: Built-in 4-color highlighter and option strikethrough system
- **Keyboard Shortcuts**: Full keyboard interface for rapid answering (Arrows, 1-4, F, H, S)

### 📊 Question Tracker & Reliability
- **Background Tracker Healing**: Uses `tracker-map.json` to automatically update stored quiz paths in the background if files are moved or renamed.
- **Quota Exceeded Safety**: Intercepts `localStorage` limit errors and provides recovery instructions to prevent data loss.
- **Safe Parsing**: Robust JSON parsing for tracker data to prevent application crashes on corrupted storage entries.
- **O(1) Badge Rendering**: High-performance regex-based badge counting for fast hub loading even with hundreds of tracked quizzes.

## 🎨 Design & Theming

QuizTool features a sophisticated design system with:

- **Modern Typography**: Uses Google Fonts (Outfit for body, Playfair Display for headings)
- **CSS Variables**: Comprehensive theming with customizable colors, spacing, and effects
- **Smooth Transitions**: Polished animations and hover effects throughout
  - **Single-Reflow Transitions**: Optimized screen transitions use a single reflow for smooth 60fps performance on mobile
  - **Mode Switching**: Smooth border and background animations when toggling between exam/learning modes
  - **Card Interactions**: Lift, glow, and scale effects with spring easing
  - **Modal Animations**: Scale-up entrances with overshoot curves
- **Accessible UI**: High contrast ratios and clear visual hierarchy
- **Performance-First Rendering**: Throttled UI timers (500ms) reduce main-thread load during active quiz sessions
- **Custom Color Palettes**:
  - Dark Theme: Deep blues and grays with amber accent (#f0a500)
  - Light Theme: Warm neutrals with golden accent (#c27803)

## 🚀 Getting Started

### Quick Start
1. Open `index.html` in your web browser
2. Select an existing quiz or use the Quiz Maker to create your own
3. Toggle between dark/light themes using the sun/moon icon

### Creating a Custom Quiz

1. Navigate to `quiz-maker.html`
2. Enter your quiz title and description
3. Add questions:
   - Type your question text
   - Fill in 2-5 answer options (A-E)
   - Select the correct answer from the dropdown
   - (Optional) Add an explanation
4. Click **"+ Add Question"** to add more questions
5. Click **"📥 Generate Quiz File"** to preview
6. Click **"💾 Download as HTML File"** to save your custom quiz

### Creating a Custom Hub for Another Project

Use the Index Editor to create branded hub pages for any collection of tools or quizzes:

1. Open `index-editor.html` in your browser
2. Configure your hub:
   - Set the top bar title and hero section
   - Choose a default theme (dark/light)
3. Add quiz/tool entries:
   - Enter title, description, and icon (emoji)
   - Provide the URL to each tool or quiz
   - Add tags for categorization and filtering
4. Export your hub:
   - **Option A**: Download as a complete HTML file (ready to deploy)
   - **Option B**: Export as JSON to import later or share
5. The generated hub includes search, filtering, and theme toggle out of the box

**Pro Tip**: You can also import an existing `index.html` file into the editor to modify it, or paste a JSON configuration directly.

### Generating a Production-Ready Quiz Site

Use the Project Generator to create a deployable quiz site (like MU61S8):

1. Run the generator:
   ```bash
   python generate_project.py
   ```
2. Configure your project in the web UI (opens at http://localhost:5500):
   - Set project name, titles, and description
   - Add folders for different subjects/categories
   - Add quiz entries with URLs for each folder
3. Click **"📥 Generate & Download ZIP"**
4. Extract the ZIP to your project folder
5. Add your quiz HTML files to the appropriate folders
6. Commit and push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial quiz project"
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```
7. GitHub Actions will automatically:
   - Sync quiz assets (update index pages and service worker)
   - Deploy to GitHub Pages

**Note**: The generated project includes `scripts/sync_quiz_assets.py` which auto-discovers quiz files and updates:
- All `index.html` files with proper quiz listings
- Service worker precache list with all HTML files
- Cache version hash for automatic updates

### Adding New Quizzes to the Hub

Edit the `QUIZZES` array in `index.html`:

```javascript
const QUIZZES = [
  {
    title: "Your Quiz Title",
    description: "Brief description of your quiz",
    icon: "🎯",
    tags: ["Category", "Questions"],
    url: "path/to/your/quiz.html"
  }
];
```

### Running the Admin Dashboard

For day-to-day management of your quiz project, use the Admin Dashboard:

1. Navigate to your project folder
2. Run the dashboard script:
   ```bash
   python scripts/admin-dashboard.py
   ```
3. The dashboard will automatically open at `http://localhost:5500/admin/`
4. Use the sidebar to browse files and the editors to update content

## 📁 Project Structure
```
QuizTool/
├── .github/workflows/            # CI/CD pipelines
│   └── jekyll-gh-pages.yml       # Automated GitHub Pages deployment
├── generator_templates/          # Web UI assets for generate_project.py
│   └── index.html                # Generator dashboard HTML
├── scripts/                      # Backend utility scripts
│   ├── admin-dashboard.py       # Comprehensive local management GUI
│   ├── sync_quiz_assets.py      # Asset indexing & SW manifest generator
│   └── standardize_quiz_files.py # Batch file formatter & validator
├── index.html                    # Main tool hub & landing page
├── index-engine.js               # Logic for hub pages & tracker dashboard
├── index-engine.css              # Styling for hubs & navigation
├── quiz-engine.js                # Core quiz playback & state engine
├── bank-engine.js                # Advanced question bank logic & session management
├── sw.js                         # Service worker for offline-first toolkit usage
├── tracker-map.json              # Persistent UID-to-Path mapping
├── manifest.webmanifest          # PWA configuration for installability
├── favicon.svg                   # Vector app icon
├── icon-*.png                    # PWA icons (48px-512px)
├── generate_project.py           # Flask-based project generator server
├── generate_icons.py             # Utility to rebuild PNG icons from SVG
├── quiz-editor.html              # Visual editor for existing files
├── quiz-maker.html               # GUI for creating new quiz files
├── quiz-maker-js.html            # High-performance JS-array importer
├── bank-maker.html               # GUI for building large question banks
├── index-editor.html             # Hub page creator & manager
├── quiz-combiner.html            # Tool to merge quizzes into banks
├── pdf-exporter.html             # Standalone PDF generation utility
├── js-question-bank.html         # Local JavaScript practice question pool
├── quiz-template.html            # Prototype for generated quiz files
├── question-bank-template.html   # Prototype for generated bank files
├── index-template.html           # Prototype for generated hub pages
├── AGENTS.md                     # Technical reference for LLM agents
├── GENERATOR_UPDATES.md          # Changelog for generator features
├── .gitignore                    # Project-wide git exclusions
└── README.md                     # Main documentation
```

## 🛠️ Technical Details

### Architecture
- **Vanilla Core**: Zero dependencies, zero build steps, zero frameworks. Runs directly in the browser.
- **Shared Engines**: A "Single Source of Truth" approach where one JS engine powers thousands of quiz files.
- **PWA Excellence**: Fully installable as a standalone app with a network-first service worker for hubs and cache-first for assets.
- **Persistent State**: Automatic progress saving and long-term mistake tracking using `localStorage`.

### Performance Optimizations
- **Regex Parsing**: O(1) performance for badge counting and metadata extraction.
- **Throttled Timers**: Reduced main-thread load on mobile devices during active sessions.
- **Single-Reflow Transitions**: UI animations optimized for 60fps performance on low-end hardware.

---

## 🌟 Key Benefits

1. **Production-Ready**: Generate deployable medical/academic quiz sites with one command.
2. **Offline-First**: Built-in service worker ensures quizzes work without an internet connection.
3. **Beautiful UX**: Modern design with vibrant themes, fluid animations, and high accessibility.
4. **Authoring Freedom**: No coding required to create, edit, or merge complex question banks.
5. **Privacy First**: All user data and progress stay strictly local on your device.
6. **Scalable Architecture**: Engines handle massive question banks (1000+) without performance degradation.
7. **Automated Maintenance**: CI scripts keep your project indexed and caches updated automatically.

## 🔗 Links

- **Live Demo**: [QuizTool Online](https://eyad-elghareeb.github.io/QuizTool/)
- **GitHub Repository**: [eyad-elghareeb/QuizTool](https://github.com/eyad-elghareeb/QuizTool)
- **Sample Site**: [MU61S8 Medicine Quizzes](https://eyad-elghareeb.github.io/MU61S8/)

## 📝 License

This project is licensed under a **Custom Non-Commercial License**:
- **Free for Personal/Educational Use**: You are free to use, modify, and distribute this software for personal, academic, or non-profit educational purposes.
- **Non-Commercial**: You may not use this software or any part of it for commercial monetization or as part of a paid service without explicit permission.
- **Attribution Required**: Any distribution must include original authorship credit to Eyad Elghareeb.

## ⚠️ Disclaimer

**Medical Content Accuracy**: This platform is an authoring tool and does not provide medical advice. The accuracy, completeness, or timeliness of any quiz content (medical or otherwise) created or hosted with this tool is the sole responsibility of the content author. Users should verify medical information against authoritative sources.

**Warranty**: The software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors be liable for any claim, damages or other liability.

---

**Made with ❤️ using vanilla web technologies**
