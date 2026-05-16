"""
QuizTool Generator — Build Script
===================================
Builds the QuizTool Generator as either:
  1. Standard PyInstaller EXE (generate_project.py → QuizTool-Generator.exe)
  2. Standalone Tauri EXE  (pure Rust, no sidecar, no Python)

Standalone Tauri EXE is the recommended approach — produces a single .exe
with all generator logic compiled in. No Python, no Flask, no sidecar.

Usage:
    pip install pyinstaller
    python build_exe.py                  # Standard PyInstaller EXE
    python build_exe.py --tauri          # Standalone Tauri EXE (recommended)
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()

# ============================================================
#  STANDALONE TAURI BUILD (pure Rust, no sidecar)
# ============================================================

def build_tauri_standalone():
    """Build the standalone Tauri EXE with no Python/Flask dependency.
    
    This produces a single .exe in dist/QuizTool.exe that:
    - Serves the wizard frontend from embedded static files
    - Generates project ZIPs entirely in Rust
    - Calls GitHub / Netlify / Vercel APIs via ureq (embedded HTTPS)
    - Has zero runtime dependencies (no Python, no Flask, no sidecar)
    """
    print(f"\n{'=' * 60}")
    print(f"  QuizTool Generator — Standalone Tauri Build")
    print(f"  (pure Rust, no Python/Flask/sidecar)")
    print(f"{'=' * 60}\n")

    tauri_dir = BASE_DIR / 'tauri'
    if not tauri_dir.exists():
        print(f"  ERROR: tauri/ directory not found at {tauri_dir}")
        sys.exit(1)

    # Ensure Cargo/Rust is available
    try:
        result = subprocess.run(['cargo', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            raise FileNotFoundError
        print(f"  Rust toolchain: {result.stdout.strip()}")
    except (FileNotFoundError, OSError):
        print("  Cargo (Rust) is required. Install it from https://rustup.rs")
        print("  Then install MSVC Build Tools (needed for Windows):")
        print("    https://visualstudio.microsoft.com/visual-cpp-build-tools/")
        sys.exit(1)

    # Build the Tauri binary
    print(f"\n  Building Rust code (release mode)...")
    result = subprocess.run(
        ['cargo', 'build', '--release'],
        cwd=str(tauri_dir),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ERROR: Build failed with code {result.returncode}")
        print(f"  {result.stderr}")
        if 'link.exe' in result.stderr:
            print(f"\n  The MSVC linker (link.exe) was not found.")
            print(f"  Install Visual Studio Build Tools from:")
            print(f"    https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022")
            print(f"  Or use: winget install Microsoft.VisualStudio.2022.BuildTools")
        sys.exit(1)
    
    print(f"  Build successful!")

    # Locate the compiled binary
    if sys.platform == 'win32':
        src_binary = tauri_dir / 'target' / 'release' / 'quiztool-tauri.exe'
        final_name = 'QuizTool.exe'
    else:
        src_binary = tauri_dir / 'target' / 'release' / 'quiztool-tauri'
        final_name = 'QuizTool'

    if not src_binary.exists():
        print(f"  ERROR: Compiled binary not found at {src_binary}")
        sys.exit(1)

    # Copy to dist/
    dist_dir = BASE_DIR / 'dist'
    dist_dir.mkdir(exist_ok=True)
    final_path = dist_dir / final_name
    shutil.copy2(src_binary, final_path)

    # Also copy frontend folder for runtime (Tauri resolves frontendDist relative to exe)
    frontend_src = tauri_dir / 'frontend'
    frontend_dst = dist_dir / 'frontend'
    if frontend_src.exists():
        if frontend_dst.exists():
            shutil.rmtree(frontend_dst, ignore_errors=True)
        shutil.copytree(frontend_src, frontend_dst)

    size_mb = final_path.stat().st_size / (1024 * 1024)

    print(f"\n{'=' * 60}")
    print(f"  Build Complete!")
    print(f"  Output: {final_path}  ({size_mb:.1f} MB)")
    print(f"  Type:   Standalone EXE (no dependencies)")
    print(f"  \n  Run QuizTool.exe to start the generator.")
    print(f"{'=' * 60}\n")


# ============================================================
#  LEGACY PYINSTALLER BUILD (requires Python + Flask)
# ============================================================

def build_pyinstaller():
    """Build the legacy PyInstaller EXE (generate_project.py → QuizTool-Generator.exe).
    
    This is the OLD approach — it bundles Python + Flask into an EXE.
    The Tauri build above is the RECOMMENDED approach.
    """
    print(f"\n{'=' * 60}")
    print(f"  QuizTool Generator — Legacy PyInstaller EXE")
    print(f"  (bundles Python + Flask — deprecated, use --tauri instead)")
    print(f"{'=' * 60}\n")

    # Collect data files
    datas = []

    # Generator templates
    templates_dir = BASE_DIR / 'generator_templates'
    if templates_dir.exists():
        datas.append(str(templates_dir) + ';generator_templates')

    # Engine files
    for name in ['quiz-engine.js', 'bank-engine.js', 'index-engine.js', 
                 'sync-engine.js', 'index-engine.css', 'quiz-engine-test.html']:
        p = BASE_DIR / name
        if p.exists():
            datas.append(str(p) + ';.')

    # Script files
    scripts_dir = BASE_DIR / 'scripts'
    if scripts_dir.exists():
        datas.append(str(scripts_dir) + ';scripts')

    # Icon files
    for name in ['icon-48.png', 'icon-72.png', 'icon-96.png', 
                 'icon-144.png', 'icon-192.png', 'icon-512.png']:
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

    try:
        import PyInstaller.__main__
    except ImportError:
        print("PyInstaller is required. Install it with: pip install pyinstaller")
        sys.exit(1)

    args = [
        str(BASE_DIR / 'generate_project.py'),
        '--name=QuizTool-Generator',
        '--onefile',
        '--console',
        '--clean',
        '--icon=icon-512.png',
        f'--distpath={str(BASE_DIR / "dist")}',
        f'--workpath={str(BASE_DIR / "build")}',
        f'--specpath={str(BASE_DIR)}',
    ]

    for data in datas:
        args.append(f'--add-data={data}')

    print(f"\n  Bundling {len(datas)} data file groups")
    print(f"  Output: dist/QuizTool-Generator.exe\n")

    PyInstaller.__main__.run(args)

    exe_path = BASE_DIR / 'dist' / 'QuizTool-Generator.exe'
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"\n  Legacy build complete! ({size_mb:.1f} MB)")
    else:
        print(f"\n  Build may have failed — EXE not found at {exe_path}")

    # Clean up build artifacts
    for artifact in [BASE_DIR / 'build', BASE_DIR / 'QuizTool-Generator.spec']:
        if artifact.is_dir():
            shutil.rmtree(artifact, ignore_errors=True)
        elif artifact.is_file():
            artifact.unlink(missing_ok=True)


if __name__ == '__main__':
    use_tauri = '--tauri' in sys.argv

    if use_tauri:
        build_tauri_standalone()
    else:
        print(f"  {'=' * 60}")
        print(f"  Recommend using --tauri for a standalone EXE with no dependencies.")
        print(f"  python build_exe.py --tauri")
        print(f"  {'=' * 60}\n")
        build_pyinstaller()