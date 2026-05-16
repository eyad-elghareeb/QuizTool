import re
from pathlib import Path

# Always read with utf-8 to preserve icons/emojis
src = Path('scripts/admin-dashboard.py').read_text(encoding='utf-8')

# ── 1. Extract DASHBOARD_HTML ─────────────────────────────────────────────────
match = re.search(r'DASHBOARD_HTML\s*=\s*r"""(.*?)"""', src, re.DOTALL)
if not match:
    raise SystemExit('❌  Could not find DASHBOARD_HTML in admin-dashboard.py')
html = match.group(1)

# ── 2. Handle Jinja placeholders ──────────────────────────────────────────────
# Remove from title (handled by JS boot script) to avoid invalid HTML
html = html.replace('<title>Admin Dashboard - {{ project_name }}</title>', '<title>Admin Dashboard</title>')
# Replace in body
html = html.replace('{{ project_name }}', '<span id="project-name-display"></span>')

# ── 3. Inject Global Tauri Bridge ─────────────────────────────────────────────
# Declare invoke at the start of the script block so it's globally available
TAURI_BRIDGE_INIT = """
  <script>
    const invoke = window.__TAURI__ ? window.__TAURI__.core.invoke : async () => ({});
"""
html = html.replace('  <script>', TAURI_BRIDGE_INIT, 1)

# ── 4. Replace fetchJson with IPC Bridge ──────────────────────────────────────
# Using a less restrictive regex for robust replacement
TAURI_FETCH = r"""
    async function fetchJson(url, options = {}) {
      const qIdx = url.indexOf('?');
      const base = qIdx >= 0 ? url.slice(0, qIdx) : url;
      const qs   = qIdx >= 0 ? url.slice(qIdx + 1) : '';
      const endpoint = base.replace('/admin/', '').replace(/-/g, '_');

      let payload = {};
      if (qs) {
        qs.split('&').forEach(part => {
          const [k, v] = part.split('=');
          if (k && k !== 't') payload[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
      }
      if (options.body) {
        Object.assign(payload, JSON.parse(options.body));
      }

      try {
        const res = await invoke(endpoint, payload);
        return res;
      } catch (error) {
        const err = new Error(error.message || error || 'Request failed');
        err.payload = { message: err.message };
        throw err;
      }
    }
"""
# Match the function body regardless of exact whitespace/newlines
html = re.sub(
    r'async function fetchJson\(url, options = \{\}\) \{.*?\n    \}',
    TAURI_FETCH.strip(),
    html,
    count=1,
    flags=re.DOTALL
)

# ── 5. Resilience: refreshWorkspace ───────────────────────────────────────────
# Ensure boot sequence continues even if git or project state fails
REFRESH_FIX = r"""
    async function refreshWorkspace({ preserveCurrent = true } = {}) {
      const [filePayload, projectState] = await Promise.all([
        fetchJson(`/admin/files?t=${Date.now()}`).catch(() => ({ files: [], folders: ['.'] })),
        fetchJson(`/admin/project-state?t=${Date.now()}`).catch(() => ({ git: { available: false }, project_name: '' })),
      ]);
      state.files = filePayload.files || [];
      state.folders = filePayload.folders || [];
      state.projectState = projectState;
"""
html = re.sub(
    r'async function refreshWorkspace\(\{ preserveCurrent = true \} = \{\}\) \{.*?\n      state\.projectState = projectState;',
    REFRESH_FIX.strip(),
    html,
    count=1,
    flags=re.DOTALL
)

# ── 6. Fix Asset/Preview URLs ─────────────────────────────────────────────────
html = html.replace(
    "`/admin/preview/${encodePath(state.currentFile)}?v=${Date.now()}`",
    "`quiztool-preview://localhost/${encodePath(state.currentFile)}`"
)
html = html.replace('/admin/preview/', 'quiztool-preview://localhost/')
html = html.replace('href="/admin/pdf-exporter"', 'href="pdf-exporter.html"')
html = html.replace("href='/admin/pdf-exporter'", "href='pdf-exporter.html'")

# ── 7. Inject Initialization Script ───────────────────────────────────────────
# This sets the project name and document title once the dashboard is loaded.
TITLE_BOOTSTRAP = """
    setTimeout(async () => {
      try {
        const p = await invoke("get_project_name");
        document.title = "Admin Dashboard - " + p;
        document.querySelectorAll("#project-name-display").forEach(d => d.textContent = p);
      } catch(e) {}
    }, 200);
"""
# Inject before the closing </script> tag
html = html.replace('    boot().catch', TITLE_BOOTSTRAP + '\n    boot().catch')

# ── 8. Write Output Files ─────────────────────────────────────────────────────
out_dir = Path('tauri-admin/frontend')
out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / 'index.html').write_text(html, encoding='utf-8')
print('[OK] Extracted index.html (Patched for Tauri)')

match_pdf = re.search(r'PDF_EXPORTER_HTML\s*=\s*r"""(.*?)"""', src, re.DOTALL)
if match_pdf:
    (out_dir / 'pdf-exporter.html').write_text(match_pdf.group(1), encoding='utf-8')
    print('[OK] Extracted pdf-exporter.html')
