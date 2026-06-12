"""QuizTool PDF Dependencies — first-run check & install.

Usage:
    python ensure_pdf_deps.py

Returns JSON on stdout:
    {"status": "ok"} | {"status": "installed", "detail": "..."} |
    {"status": "error", "detail": "..."}
"""

import json
import subprocess
import sys
import shutil


def check_python():
    """Check Python 3 is available and usable."""
    vi = sys.version_info
    if vi.major < 3 or (vi.major == 3 and vi.minor < 8):
        return {"status": "error", "detail": f"Python 3.8+ required, got {vi.major}.{vi.minor}.{vi.micro}"}
    return {"status": "ok", "detail": f"Python {vi.major}.{vi.minor}.{vi.micro}"}


def check_reportlab():
    """Check if reportlab is importable."""
    try:
        import reportlab
        ver = getattr(reportlab, "Version", "unknown")
        return {"status": "ok", "detail": f"reportlab {ver}"}
    except ImportError:
        return {"status": "missing", "detail": "reportlab not installed"}


def install_reportlab():
    """Install reportlab via pip."""
    python = sys.executable
    try:
        result = subprocess.run(
            [python, "-m", "pip", "install", "reportlab", "--quiet"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            return {"status": "error", "detail": f"pip install failed: {result.stderr.strip()}"}
        return {"status": "installed", "detail": "reportlab installed successfully"}
    except subprocess.TimeoutExpired:
        return {"status": "error", "detail": "pip install timed out after 120s"}
    except FileNotFoundError:
        return {"status": "error", "detail": "pip not found"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def ensure_pip():
    """Ensure pip is available for the current Python."""
    python = sys.executable
    if shutil.which("pip"):
        return {"status": "ok", "detail": "pip available"}

    try:
        # Try python -m pip
        r = subprocess.run([python, "-m", "pip", "--version"], capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            return {"status": "ok", "detail": "pip available via python -m pip"}
    except Exception:
        pass

    # On Windows, try to ensure pip
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                [python, "-m", "ensurepip", "--upgrade"],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode == 0:
                return {"status": "installed", "detail": "pip installed via ensurepip"}
            return {"status": "error", "detail": f"ensurepip failed: {result.stderr.strip()}"}
        except Exception as e:
            return {"status": "error", "detail": f"ensurepip error: {e}"}

    return {"status": "error", "detail": "pip not found and ensurepip failed"}


def main():
    result = {"checks": {}}

    # Step 1: Check Python
    py_check = check_python()
    result["checks"]["python"] = py_check
    if py_check["status"] == "error":
        result["status"] = "error"
        result["detail"] = py_check["detail"]
        print(json.dumps(result))
        sys.exit(0)

    # Step 2: Check / ensure pip
    pip_check = ensure_pip()
    result["checks"]["pip"] = pip_check
    if pip_check["status"] == "error":
        result["status"] = "error"
        result["detail"] = pip_check["detail"]
        print(json.dumps(result))
        sys.exit(0)

    # Step 3: Check reportlab
    rl_check = check_reportlab()
    result["checks"]["reportlab"] = rl_check

    if rl_check["status"] == "ok":
        result["status"] = "ok"
        result["detail"] = "All dependencies satisfied"
        print(json.dumps(result))
        sys.exit(0)

    # Step 4: Install reportlab
    install_result = install_reportlab()
    result["checks"]["reportlab_install"] = install_result

    if install_result["status"] == "installed":
        # Verify
        verify = check_reportlab()
        if verify["status"] == "ok":
            result["status"] = "installed"
            result["detail"] = "reportlab was installed successfully"
            print(json.dumps(result))
            sys.exit(0)

    result["status"] = "error"
    result["detail"] = install_result.get("detail", "Unknown error installing reportlab")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
