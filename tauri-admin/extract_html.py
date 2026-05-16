import sys, re, os

with open(r'd:\Study\Projects\QuizTool\scripts\admin-dashboard.py', encoding='utf-8') as f:
    content = f.read()

marker = 'DASHBOARD_HTML = r"""'
start = content.index(marker) + len(marker)
end = content.index('\n"""', start)
html = content[start:end]

print(f'Extracted {len(html.splitlines())} lines, {len(html)} chars')

os.makedirs(r'd:\Study\Projects\QuizTool\tauri-admin\frontend', exist_ok=True)
with open(r'd:\Study\Projects\QuizTool\tauri-admin\frontend\index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Written to tauri-admin/frontend/index.html')
