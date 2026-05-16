"""Patch tauri-admin/frontend/index.html for Tauri IPC bridge."""
import re, os

path = r'd:\Study\Projects\QuizTool\tauri-admin\frontend\index.html'
with open(path, encoding='utf-8') as f:
    html = f.read()

# 1. Fix Flask template variable {{ project_name }} -> placeholder resolved at runtime
html = html.replace('<title>Admin Dashboard - {{ project_name }}</title>',
                    '<title>Admin Dashboard</title>')

# 2. Inject Tauri IPC bridge + fix fetchJson BEFORE the closing </body>
#    The bridge replaces fetch('/admin/...') calls with invoke() calls
IPC_BRIDGE = r"""
<script>
// ─── Tauri IPC Bridge ────────────────────────────────────────────────────────
// Replaces Flask fetch() calls with native Tauri invoke() calls.
// Maps URL patterns to Tauri command names and extracts args accordingly.

const __ROUTE_MAP = {
  '/admin/files':          { cmd: 'list_files',       method: 'GET'  },
  '/admin/project-state':  { cmd: 'project_state',    method: 'GET'  },
  '/admin/load-file':      { cmd: 'load_file',        method: 'GET', queryParam: 'path' },
  '/admin/save-file':      { cmd: 'save_file',        method: 'POST' },
  '/admin/validate-file':  { cmd: 'validate_file',    method: 'POST' },
  '/admin/create-folder':  { cmd: 'create_folder',    method: 'POST' },
  '/admin/create-file':    { cmd: 'create_file',      method: 'POST' },
  '/admin/duplicate-file': { cmd: 'duplicate_file',   method: 'POST' },
  '/admin/move-file':      { cmd: 'move_file',        method: 'POST' },
  '/admin/delete-file':    { cmd: 'delete_file',      method: 'POST' },
  '/admin/delete-folder':  { cmd: 'delete_folder',    method: 'POST' },
  '/admin/convert-file':   { cmd: 'convert_file',     method: 'POST' },
  '/admin/run-sync':       { cmd: 'run_sync',         method: 'POST' },
  '/admin/git-commit':     { cmd: 'git_commit',       method: 'POST' },
  '/admin/git-pull':       { cmd: 'git_pull',         method: 'POST' },
  '/admin/git-push':       { cmd: 'git_push',         method: 'POST' },
  '/admin/provider-verify':{ cmd: 'provider_verify',  method: 'POST' },
  '/admin/provider-deploy':{ cmd: 'provider_deploy',  method: 'POST' },
};

async function fetchJson(url, options = {}) {
  // Parse URL + query string
  const [rawPath, rawQuery] = url.split('?');
  const route = __ROUTE_MAP[rawPath];
  if (!route) {
    throw new Error('Unknown admin route: ' + rawPath);
  }

  let args = {};

  // GET with query params (e.g. /admin/load-file?path=foo)
  if (route.queryParam && rawQuery) {
    const params = new URLSearchParams(rawQuery);
    args[route.queryParam] = params.get(route.queryParam) || '';
  }

  // POST with JSON body
  if (options.body) {
    try { args = { ...args, ...JSON.parse(options.body) }; } catch(e) {}
  }

  // Normalise key names: snake_case already, but Python used snake for keys
  // The Rust commands use snake_case params so args pass through as-is.

  try {
    const result = await window.__TAURI__.core.invoke(route.cmd, args);
    return result;
  } catch (err) {
    // Tauri surfaces errors as strings; try to parse as JSON for structured errors
    let parsed = null;
    if (typeof err === 'string') {
      try { parsed = JSON.parse(err); } catch(_) {}
    }
    if (parsed && parsed.message) throw Object.assign(new Error(parsed.message), parsed);
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
  }
}

// ─── Preview URL helper ───────────────────────────────────────────────────────
function previewUrl(filePath) {
  return 'quiztool-preview://localhost/' + filePath;
}

// Override preview iframe src construction if renderPreview exists later
window.__previewUrl = previewUrl;
</script>
"""

# 3. Fix preview URLs: /admin/preview/<path> -> quiztool-preview://localhost/<path>
#    These appear inside renderPreview() and similar functions in JS
html = re.sub(
    r"['\"`]/admin/preview/\$\{([^}]+)\}['\"`]",
    r"previewUrl(\1)",
    html
)
html = re.sub(
    r"['\"`]/admin/preview/'\s*\+\s*([^'\"`;]+)",
    r"previewUrl(\1) + '",
    html
)
# Generic pattern: `/admin/preview/` + variable
html = html.replace("'/admin/preview/' + ", "previewUrl(")
html = html.replace('"/admin/preview/" + ', 'previewUrl(')
html = html.replace('`/admin/preview/${', '`' + 'quiztool-preview://localhost/${')

# 4. Fix open preview button (standalone preview link)
html = html.replace('/admin/preview/', 'quiztool-preview://localhost/')

# 5. Set project name from backend on boot, replacing the template variable
#    The existing code calls boot() -> refreshWorkspace() -> GET /admin/project-state
#    which sets state.projectName. We just need to update the title there.
#    But also replace the static title in the topbar brand if present.
html = html.replace('{{ project_name }}', '')

# 6. Inject the bridge script just before </body>
html = html.replace('</body>', IPC_BRIDGE + '\n</body>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Patched {path}')
print(f'Final size: {len(html.splitlines())} lines, {len(html)} chars')
