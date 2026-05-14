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
- Enter your project name (this becomes the repo/site/project name)
- Set the site title and hero text
- Choose dark or light default theme

### Step 2 — Structure
- Create subject folders (e.g. Cardiology, Neurology)
- Add quiz entries or drag-drop existing quiz HTML files
- Add subfolders for deeper organization

### Step 3 — Publish
**Option A: One-click hosting provider** (recommended)
1. Click **"Create a token"** to generate a GitHub PAT (scopes: `repo`, `workflow`)
2. Or use the Netlify/Vercel provider card to create that provider's access token
3. Paste the token and click **Sign In**
4. Click **Publish to GitHub Pages**, **Publish to Netlify**, or **Publish to Vercel**
5. Done! Your site will be live after the provider finishes deploying

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
- Use **Deploy** to update GitHub Pages, Netlify, or Vercel from the admin UI

No coding needed — the admin dashboard handles everything.

---

## FAQ

**Q: What is a Personal Access Token (PAT)?**
A: A provider password replacement that lets the generator deploy on your behalf. GitHub tokens need `repo` and `workflow` scopes; Netlify and Vercel tokens can be created from their provider cards in the Publish step.

**Q: Is my token saved?**
A: No. The token is used only during the current browser session and is never stored on disk or logged.

**Q: How do I update my site after publishing?**
A: Open the Admin Dashboard, edit your content, then click **Deploy**. It syncs generated assets and redeploys to GitHub Pages, Netlify, or Vercel using a session-only token.

**Q: Do I need to know Git?**
A: No! The Admin Dashboard has a provider-aware deploy flow — just click **Deploy**.

**Q: Can I add more quizzes later?**
A: Yes. Use the Admin Dashboard to create new quiz files. The sync script automatically updates all index pages and the service worker.
