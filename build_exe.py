"""
QuizTool Generator — PyInstaller Build Script
==============================================
Builds a standalone EXE from generate_project.py.

Usage:
    pip install pyinstaller
    python build_exe.py

The EXE will be in dist/QuizTool-Generator.exe
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()

# Collect all data files that need to be bundled
datas = []

# Generator templates
templates_dir = BASE_DIR / 'generator_templates'
if templates_dir.exists():
    datas.append(str(templates_dir) + ';generator_templates')

# Engine files (needed for ZIP generation)
# Note: sw.js is NOT needed — it's generated dynamically per-project by generate_sw_js()
# Note: quiz-engine-test.html is optional — read_file() returns '' if missing
for name in ['quiz-engine.js', 'bank-engine.js', 'index-engine.js', 'index-engine.css',
             'quiz-engine-test.html']:
    p = BASE_DIR / name
    if p.exists():
        datas.append(str(p) + ';.')

# Script files
scripts_dir = BASE_DIR / 'scripts'
if scripts_dir.exists():
    datas.append(str(scripts_dir) + ';scripts')

# Icon files
for name in ['icon-48.png', 'icon-72.png', 'icon-96.png', 'icon-144.png', 'icon-192.png', 'icon-512.png']:
    p = BASE_DIR / name
    if p.exists():
        datas.append(str(p) + ';.')

# Favicon
favicon = BASE_DIR / 'favicon.svg'
if favicon.exists():
    datas.append(str(favicon) + ';.')

# Template HTML files
for name in ['quiz-template.html', 'question-bank-template.html', 'index-template.html']:
    p = BASE_DIR / name
    if p.exists():
        datas.append(str(p) + ';.')


def build():
    import PyInstaller.__main__

    args = [
        str(BASE_DIR / 'generate_project.py'),
        '--name=QuizTool-Generator',
        '--onefile',
        '--console',
        '--clean',
        f'--distpath={str(BASE_DIR / "dist")}',
        f'--workpath={str(BASE_DIR / "build")}',
        f'--specpath={str(BASE_DIR)}',
    ]

    # Add data files
    for data in datas:
        args.append(f'--add-data={data}')

    print(f"\n{'=' * 60}")
    print(f"  QuizTool Generator — Building EXE")
    print(f"{'=' * 60}")
    print(f"\n  Bundling {len(datas)} data file groups")
    print(f"  Output: dist/QuizTool-Generator.exe")
    print()

    PyInstaller.__main__.run(args)

    exe_path = BASE_DIR / 'dist' / 'QuizTool-Generator.exe'
    print(f"\n{'=' * 60}")
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"  Build complete!")
        print(f"  EXE: {exe_path}")
        print(f"  Size: {size_mb:.1f} MB")
    else:
        print(f"  Build may have failed — EXE not found at {exe_path}")
    print(f"{'=' * 60}\n")

    # Clean up build artifacts
    artifacts = [
        BASE_DIR / 'build',
        BASE_DIR / 'QuizTool-Generator.spec',
    ]
    cleaned = []
    for artifact in artifacts:
        if artifact.is_dir():
            import shutil
            shutil.rmtree(artifact, ignore_errors=True)
            cleaned.append(f"{artifact}/ (directory)")
        elif artifact.is_file():
            artifact.unlink(missing_ok=True)
            cleaned.append(str(artifact))
    if cleaned:
        print(f"  Cleaned up: {', '.join(cleaned)}")


if __name__ == '__main__':
    try:
        import PyInstaller
    except ImportError:
        print("PyInstaller is required. Install it with:")
        print("  pip install pyinstaller")
        sys.exit(1)
    build()
