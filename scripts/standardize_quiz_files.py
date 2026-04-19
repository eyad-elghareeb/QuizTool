import os
import re
import glob

def standardize_file(file_path):
    print(f"Processing: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update CSS comment from "Time selector" to "Time selector (exam mode)"
    content = re.sub(r'/\*\s*Time selector\s*\*/', r'/* Time selector (exam mode) */', content)
    
    # 2. Add .time-hint CSS class if it doesn't exist already
    if '.time-hint' not in content:
        # Insert after .time-input style
        time_input_end = re.search(r'\.time-input\s*\{[^}]+\}', content)
        if time_input_end:
            insert_pos = time_input_end.end()
            time_hint_css = """
.time-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
  text-align: left;
}
"""
            content = content[:insert_pos] + time_hint_css + content[insert_pos:]
    
    # 3. Change HTML h1 from "Quiz Loading..." to "Quiz Title"
    content = re.sub(r'<h1[^>]*>\s*Quiz Loading\.\.\.\s*</h1>', r'<h1 id="quiz-title">Quiz Title</h1>', content)
    
    # 4. Change topbar title from "Quiz Loading..." to "Quiz"
    content = re.sub(r'(<div[^>]+class="topbar-title"[^>]*>)\s*Quiz Loading\.\.\.\s*(</div>)', r'\1Quiz\2', content)
    
    # 5. Add [QUIZ_CONFIG_START] and [QUIZ_CONFIG_END] markers around QUIZ_CONFIG object
    if not '[QUIZ_CONFIG_START]' in content:
        # Find QUIZ_CONFIG object
        config_match = re.search(r'(const\s+QUIZ_CONFIG\s*=\s*\{[^}]+\};)', content, re.DOTALL)
        if config_match:
            config_code = config_match.group(1)
            wrapped_config = f"""/* [QUIZ_CONFIG_START] */
{config_code}
/* [QUIZ_CONFIG_END] */"""
            content = content.replace(config_code, wrapped_config)
    
    # 6. Add [QUESTIONS_START] and [QUESTIONS_END] markers around QUESTIONS array
    if not '[QUESTIONS_START]' in content:
        # Find QUESTIONS array
        questions_match = re.search(r'(const\s+QUESTIONS\s*=\s*\[.*?\];)', content, re.DOTALL)
        if questions_match:
            questions_code = questions_match.group(1)
            wrapped_questions = f"""/* [QUESTIONS_START] */
{questions_code}
/* [QUESTIONS_END] */"""
            content = content.replace(questions_code, wrapped_questions)
    
    # 7. Clean up whitespace (trim trailing spaces, normalize line endings)
    lines = content.splitlines()
    cleaned_lines = [line.rstrip() for line in lines]
    content = '\n'.join(cleaned_lines)
    
    # Remove extra blank lines
    content = re.sub(r'\n{3,}', r'\n\n', content)
    
    with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    
    print(f"✅ Completed: {file_path}")

def main():
    # Auto-discover all subject folders — no need to hard-code them
    import pathlib
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    skip = {'.git', '.github', '__pycache__', '_site', 'scripts', 'node_modules'}
    
    target_dirs = [
        str(sub / '**' / '*.html')
        for sub in repo_root.iterdir()
        if sub.is_dir() and sub.name not in skip and not sub.name.startswith('.')
    ]
    # Fall back to current-directory globs when run from repo root
    if not target_dirs:
        target_dirs = ['**/*.html']
    
    exclude_patterns = ['index.html', '*bank*.html', 'all-*.html']
    
    all_files = []
    for pattern in target_dirs:
        all_files.extend(glob.glob(pattern, recursive=True))
    
    # Filter excluded files
    process_files = []
    for fpath in all_files:
        filename = os.path.basename(fpath)
        exclude = False
        for excl in exclude_patterns:
            if glob.fnmatch.fnmatch(filename.lower(), excl.lower()):
                exclude = True
                break
        if not exclude:
            process_files.append(fpath)
    
    print(f"Found {len(process_files)} files to process")
    
    for file_path in process_files:
        try:
            standardize_file(file_path)
        except Exception as e:
            print(f"❌ Failed: {file_path} | {str(e)}")
    
    print("\n✅ All files processed successfully!")

if __name__ == "__main__":
    main()