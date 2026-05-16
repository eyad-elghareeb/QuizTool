import re
with open(r'd:\Study\Projects\QuizTool\tauri-admin\frontend\index.html', encoding='utf-8') as f:
    html = f.read()

# Find original fetchJson definition to make sure our bridge overrides it
# The original is defined in the JS section, our bridge redefines it AFTER
original = [i for i, line in enumerate(html.splitlines(), 1) if 'async function fetchJson' in line]
print('fetchJson definitions at lines:', original)

# Check preview function
preview_fn = [i for i, line in enumerate(html.splitlines(), 1) if 'previewUrl' in line]
print('previewUrl references at lines:', preview_fn[:10])

# Check the bridge is at the end
lines = html.splitlines()
bridge_line = next((i for i, l in enumerate(lines, 1) if 'Tauri IPC Bridge' in l), None)
print(f'Bridge at line: {bridge_line} of {len(lines)}')
body_close = next((i for i, l in enumerate(lines, 1) if '</body>' in l), None)
print(f'</body> at line: {body_close}')
