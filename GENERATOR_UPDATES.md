# Generate Project Script Updates

## Summary
Updated `generate_project.py` to generate production-ready quiz instances similar to MU61S8 structure.

## Key Changes

### 1. **Removed QuizTool Utilities from Generated Projects**
   - ❌ No quiz-maker.html
   - ❌ No quiz-maker-js.html
   - ❌ No bank-maker.html
   - ❌ No pdf-exporter.html
   - ❌ No quiz-combiner.html
   - ❌ No index-editor.html

### 2. **Added Production-Ready Files**
   - ✅ **Service Worker** - Reads from QuizTool's improved `sw.js` with:
     - html2pdf.js CDN precaching for offline PDF export
     - Clean URL matching (handles query strings/hashes)
     - Better offline support
   - ✅ **PWA Icons** - All 6 PNG icon sizes (48px, 72px, 96px, 144px, 192px, 512px)
   - ✅ **Scripts Folder**:
     - `scripts/sync_quiz_assets.py` - Auto-syncs quiz assets on deployment
     - `scripts/standardize_quiz_files.py` - Standardizes quiz file naming
   - ✅ **Diagnostic Tools** - `quiz-engine-test.html` for troubleshooting

### 3. **Enhanced PWA Manifest**
   Now includes all icon sizes for better PWA support:
   ```json
   {
     "icons": [
       {"src": "favicon.svg", "sizes": "any", "type": "image/svg+xml"},
       {"src": "icon-48.png", "sizes": "48x48", "type": "image/png"},
       {"src": "icon-72.png", "sizes": "72x72", "type": "image/png"},
       {"src": "icon-96.png", "sizes": "96x96", "type": "image/png"},
       {"src": "icon-144.png", "sizes": "144x144", "type": "image/png"},
       {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
       {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}
     ]
   }
   ```

### 4. **Improved File Count Estimation**
   Updated preview to show accurate file counts:
   - Base files: 16 (engines, assets, icons, scripts, workflows, etc.)
   - Plus: root index + folder indexes + quiz HTML files

### 5. **Updated UI Messages**
   - Generator subtitle: "Generate a production-ready quiz site (like MU61S8)..."
   - Console output now lists what's included/excluded
   - PWA badge mentions all icon sizes

## Generated Project Structure

```
project-name/
├── .github/
│   ├── workflows/
│   │   ├── sync-quiz-assets.yml    # Auto-sync on push
│   │   └── jekyll-gh-pages.yml     # Deploy to GitHub Pages
├── scripts/
│   ├── sync_quiz_assets.py         # Update index.html & sw.js
│   └── standardize_quiz_files.py   # Standardize file names
├── [folder1]/
│   └── index.html                  # Folder quiz listing
├── [folder2]/
│   └── index.html
├── index.html                      # Root folder listing
├── index-engine.js                 # Hub page engine
├── quiz-engine.js                  # Quiz playback engine
├── bank-engine.js                  # Question bank engine
├── sw.js                           # Service worker (offline support)
├── manifest.webmanifest            # PWA manifest
├── favicon.svg                     # SVG favicon
├── icon-48.png                     # PWA icons (all sizes)
├── icon-72.png
├── icon-96.png
├── icon-144.png
├── icon-192.png
├── icon-512.png
├── quiz-engine-test.html           # Diagnostic page
└── .gitignore                      # Git ignore rules
```

## Deployment Workflow

1. **Configure** project via web UI at http://localhost:5500
2. **Generate** and download ZIP
3. **Extract** to your project folder
4. **Add quiz HTML files** to appropriate folders
5. **Push to GitHub** - Workflows handle the rest:
   - `sync-quiz-assets.yml` runs first to update index pages & service worker
   - `jekyll-gh-pages.yml` deploys to GitHub Pages

## Usage

```bash
cd D:\Study\Projects\QuizTool
python generate_project.py
```

The web UI will open automatically at http://localhost:5500

## Requirements

- Python 3.x
- Flask (`pip install flask`)
