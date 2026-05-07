# 🚀 QuizTool Generator — Quick Start

Get your quiz site live in 3 steps — no coding required.

---

## Step 1: Launch the Generator

### Option A: Double-click `start.bat` (Windows)
Automatically checks for Python, installs Flask if needed, and starts the generator.

### Option B: Use the standalone EXE
Download `QuizTool-Generator.exe` from releases and double-click it. No Python needed.

### Option C: Manual launch
```bash
pip install flask
python generate_project.py
```

Then open **http://localhost:5500** in your browser.

---

## Step 2: Configure & Publish

The generator has a 3-step wizard:

### Step 1 — Project Info
- Enter your project name (this becomes the GitHub repo name)
- Set the site title and hero text
- Choose dark or light default theme

### Step 2 — Structure
- Create subject folders (e.g. Cardiology, Neurology)
- Add quiz entries or drag-drop existing quiz HTML files
- Add subfolders for deeper organization

### Step 3 — Publish
**Option A: One-click GitHub Pages** (recommended)
1. Click **"Create a token"** to generate a GitHub PAT (scopes: `repo`, `workflow`)
2. Paste the token and click **Sign In**
3. Click **🔵 Publish to GitHub Pages**
4. Done! Your site will be live in 1–2 minutes

**Option B: Download ZIP only**
1. Click **📥 Download ZIP Only**
2. Extract and manually deploy wherever you want

---

## Step 3: Add Content

After publishing, click **🛠️ Open Admin Dashboard** to:
- Create new quiz and bank files via a visual editor
- Edit existing questions, options, and explanations
- Move/rename files and folders
- Run the sync script to update indexes automatically
- Git push from the admin UI

No coding needed — the admin dashboard handles everything.

---

## FAQ

**Q: What is a Personal Access Token (PAT)?**
A: A GitHub password replacement that lets the generator create a repo and push code on your behalf. Create one at https://github.com/settings/tokens/new with `repo` and `workflow` scopes.

**Q: Is my token saved?**
A: No. The token is used only during the current browser session and is never stored on disk or logged.

**Q: How do I update my site after publishing?**
A: Open the Admin Dashboard, edit your content, then use the "Sync & Push" button. The CI/CD workflow automatically redeploys.

**Q: Do I need to know Git?**
A: No! The Admin Dashboard has a built-in Git integration — just click "Sync & Push".

**Q: Can I add more quizzes later?**
A: Yes. Use the Admin Dashboard to create new quiz files. The sync script automatically updates all index pages and the service worker.
