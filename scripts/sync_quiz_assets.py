from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SW_PATH = REPO_ROOT / "sw.js"
ROOT_CACHE_ASSETS = (
    "assets/manifest.webmanifest",
    "assets/favicon.svg",
    "assets/icon-48.png",
    "assets/icon-72.png",
    "assets/icon-96.png",
    "assets/icon-144.png",
    "assets/icon-192.png",
    "assets/icon-512.png",
    "assets/index-engine.css",
)
SKIP_DIRS = {".git", ".github", "__pycache__", "_site", "scripts", "node_modules"}
GENERIC_DESCRIPTIONS = {"past years exams", "department book mcqs", "quiz loading..."}
ACRONYMS = {
    "aub": "AUB",
    "copd": "COPD",
    "fgm": "FGM",
    "hrt": "HRT",
    "mcq": "MCQ",
    "mcqs": "MCQs",
    "pcos": "PCOS",
    "pid": "PID",
    "pms": "PMS",
    "qs": "QS",
    "stis": "STIs",
}


def main() -> int:
    changed_files: list[Path] = []

    # Update root index.html with subfolder entries
    root_index = REPO_ROOT / "index.html"
    if root_index.exists():
        if update_root_index_with_folders(root_index):
            changed_files.append(root_index)

    for index_path in discover_index_files():
        if update_index_file(index_path):
            changed_files.append(index_path)

    if update_service_worker():
        changed_files.append(SW_PATH)

    if changed_files:
        print("Updated:")
        for path in changed_files:
            print(f"  - {path.relative_to(REPO_ROOT).as_posix()}")
    else:
        print("No generated updates were needed.")

    return 0


def update_root_index_with_folders(index_path: Path) -> bool:
    """Update root index.html with folder entries based on subfolders containing index.html"""
    text = index_path.read_text(encoding="utf-8")
    
    try:
        array_literal, start, end = extract_assigned_literal(text, "QUIZZES", "[", "]")
    except ValueError:
        # Root index doesn't have QUIZZES array, nothing to do
        return False
    
    existing_entries = parse_js_literal(array_literal)

    if not isinstance(existing_entries, list):
        raise ValueError(f"{index_path} has a QUIZZES assignment that is not an array.")

    # Track existing folder URLs to avoid duplicates
    existing_urls = {
        entry.get("url")
        for entry in existing_entries
        if isinstance(entry, dict) and isinstance(entry.get("url"), str)
    }

    # Discover subfolders that have their own index.html
    new_entries: list[dict[str, object]] = []
    
    for subfolder in sorted(REPO_ROOT.iterdir(), key=lambda p: natural_key(p.name)):
        # Skip if not a directory or in skip list
        if not subfolder.is_dir():
            continue
        if subfolder.name in SKIP_DIRS or subfolder.name.startswith("."):
            continue
        
        # Check if this subfolder has an index.html
        subfolder_index = subfolder / "index.html"
        if not subfolder_index.exists():
            continue
        
        # Build the relative URL for the folder — URL-encode to handle spaces/special chars
        import urllib.parse as _ul
        folder_url = _ul.quote(subfolder.name, safe='') + "/index.html"
        
        # Skip if already exists
        if folder_url in existing_urls:
            continue
        
        # Build folder entry
        icon = default_icon(subfolder.relative_to(REPO_ROOT))
        folder_name = subfolder.name
        
        # Create better folder names based on common abbreviations
        # Add entries here when adding new subject folders
        folder_titles = {
            "gyn": "Gynecology",
            "cardio": "Cardiology",
            "ai": "AI",
            "dep": "Department",
            "mans": "Mansoura",
        }
        
        title = folder_titles.get(folder_name.lower(), folder_name.replace('-', ' ').replace('_', ' ').capitalize())
        
        # Count HTML files in the subfolder (excluding index.html)
        html_count = len([f for f in subfolder.glob("*.html") if f.name != "index.html"])
        
        entry = {
            "title": f"📁 {title}",
            "description": f"{title} quizzes and resources",
            "icon": icon,
            "tags": ["Folder"],
            "url": folder_url,
        }
        new_entries.append(entry)

    if not new_entries:
        return False

    new_entry_literals = [serialize_quiz_entry(entry) for entry in new_entries]
    updated_array_literal = append_entries_to_array_literal(array_literal, new_entry_literals)
    updated_text = text[:start] + updated_array_literal + text[end:]
    index_path.write_text(updated_text, encoding="utf-8")
    return True


def discover_index_files() -> list[Path]:
    paths: list[Path] = []
    for path in REPO_ROOT.rglob("index.html"):
        rel = path.relative_to(REPO_ROOT)
        if any(part in SKIP_DIRS or part.startswith(".") for part in rel.parts[:-1]):
            continue
        paths.append(path)
    return sorted(paths, key=lambda item: natural_key(item.relative_to(REPO_ROOT).as_posix()))


def discover_html_files() -> list[Path]:
    paths: list[Path] = []
    for path in REPO_ROOT.rglob("*.html"):
        rel = path.relative_to(REPO_ROOT)
        if any(part in SKIP_DIRS or part.startswith(".") for part in rel.parts[:-1]):
            continue
        paths.append(path)
    return sorted(paths, key=lambda item: (item.relative_to(REPO_ROOT).as_posix() != "index.html", natural_key(item.relative_to(REPO_ROOT).as_posix())))


def update_index_file(index_path: Path) -> bool:
    text = index_path.read_text(encoding="utf-8")
    
    try:
        array_literal, start, end = extract_assigned_literal(text, "QUIZZES", "[", "]")
    except ValueError:
        # Skip index files without QUIZZES array (e.g., minimal redirect pages)
        return False
    
    existing_entries = parse_js_literal(array_literal)

    if not isinstance(existing_entries, list):
        raise ValueError(f"{index_path} has a QUIZZES assignment that is not an array.")

    existing_urls = {
        entry.get("url")
        for entry in existing_entries
        if isinstance(entry, dict) and isinstance(entry.get("url"), str)
    }

    existing_icon = next(
        (
            entry.get("icon")
            for entry in existing_entries
            if isinstance(entry, dict) and isinstance(entry.get("icon"), str) and entry.get("icon")
        ),
        default_icon(index_path.parent.relative_to(REPO_ROOT)),
    )

    dir_rel = index_path.parent.relative_to(REPO_ROOT)
    new_entries: list[dict[str, object]] = []

    for quiz_path in sorted(index_path.parent.glob("*.html"), key=lambda item: natural_key(item.name)):
        if quiz_path.name == "index.html":
            continue

        rel_url = quiz_path.name
        if rel_url in existing_urls:
            continue

        entry = build_quiz_entry(quiz_path, dir_rel, str(existing_icon))
        if entry is not None:  # Skip files without quiz config
            new_entries.append(entry)

    if not new_entries:
        return False

    new_entry_literals = [serialize_quiz_entry(entry) for entry in new_entries]
    updated_array_literal = append_entries_to_array_literal(array_literal, new_entry_literals)
    updated_text = text[:start] + updated_array_literal + text[end:]
    index_path.write_text(updated_text, encoding="utf-8")
    return True


def build_quiz_entry(quiz_path: Path, dir_rel: Path, icon: str) -> dict[str, object]:
    quiz_text = quiz_path.read_text(encoding="utf-8")

    # Skip files without quiz config
    config = extract_quiz_config(quiz_text)
    if not config:
        return None  # Signal that this file should be skipped

    title = beautify_title(extract_quiz_title(quiz_text) or quiz_path.stem)
    description = infer_description(title, extract_quiz_description(quiz_text), dir_rel)
    question_count = extract_question_count(quiz_text)
    primary_tag = infer_primary_tag(title, description, dir_rel, quiz_path.stem)

    return {
        "title": title,
        "description": description,
        "icon": icon,
        "tags": [primary_tag, question_label(question_count)],
        "url": quiz_path.name,
    }


def discover_asset_files() -> list[Path]:
    """Find all image, style, script, and manifest files recursively, excluding engines and skip dirs."""
    extensions = {".png", ".svg", ".jpg", ".jpeg", ".css", ".webmanifest", ".js", ".json"}
    paths: list[Path] = []
    # Known engines are handled separately to ensure they are at the top of the list
    engines = {
        "engines/quiz-engine.js",
        "engines/bank-engine.js",
        "engines/index-engine.js",
        "engines/engine-common.js",
        "engines/tracker-storage.js",
        "engines/engine-highlights.js",
        "engines/dash-ui.js",
    }
    
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(REPO_ROOT)
        if any(part in SKIP_DIRS or part.startswith(".") for part in rel.parts[:-1]):
            continue
        if path.suffix.lower() not in extensions:
            continue
        # Skip engines and sw.js as they are handled or ignored
        if path.name in engines or rel.as_posix() in engines or path.name == "sw.js":
            continue
        paths.append(path)
    return sorted(paths, key=lambda item: natural_key(item.relative_to(REPO_ROOT).as_posix()))


def update_service_worker() -> bool:
    text = SW_PATH.read_text(encoding="utf-8")
    
    # Discovery
    html_paths = [path.relative_to(REPO_ROOT).as_posix() for path in discover_html_files()]
    asset_paths = [path.relative_to(REPO_ROOT).as_posix() for path in discover_asset_files()]
    
    # Engine files must always be first in the precache list for prioritized installation
    # Engines are specifically placed first to ensure cache robustness logic in sw.js works.
    engine_paths = []
    for eng in [
        "engines/quiz-engine.js",
        "engines/bank-engine.js",
        "engines/index-engine.js",
        "engines/engine-common.js",
        "engines/tracker-storage.js",
        "engines/engine-highlights.js",
        "engines/dash-ui.js",
    ]:
        if (REPO_ROOT / eng).exists():
            engine_paths.append(eng)
            
    all_cache_paths = engine_paths + html_paths + asset_paths
    cache_version = build_cache_version(all_cache_paths)

    updated = re.sub(
        r"const CACHE_VERSION = '.*?';",
        f"const CACHE_VERSION = '{cache_version}';",
        text,
        count=1,
    )

    array_literal, start, end = extract_assigned_literal(updated, "PRECACHE_REL_PATHS", "[", "]")
    new_array_literal = serialize_string_array(all_cache_paths)
    updated = updated[:start] + new_array_literal + updated[end:]

    if updated == text:
        return False

    SW_PATH.write_text(updated, encoding="utf-8")
    return True


def build_cache_version(all_paths: list[str]) -> str:
    hasher = hashlib.sha256()

    for rel_path in all_paths:
        path = REPO_ROOT / rel_path
        hasher.update(rel_path.encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(path.read_bytes())
        hasher.update(b"\0")

    return f"quiz-cache-{hasher.hexdigest()[:12]}"


def extract_quiz_title(quiz_text: str) -> str | None:
    config = extract_quiz_config(quiz_text)
    title = config.get("title")
    return normalize_spaces(str(title)) if title else None


def extract_quiz_description(quiz_text: str) -> str:
    config = extract_quiz_config(quiz_text)
    description = config.get("description")
    return normalize_spaces(str(description)) if description else ""


def extract_quiz_config(quiz_text: str) -> dict[str, object]:
    for var_name in ("QUIZ_CONFIG", "BANK_CONFIG"):
        try:
            config_literal, _, _ = extract_assigned_literal(quiz_text, var_name, "{", "}")
            config = parse_js_literal(config_literal)
            if isinstance(config, dict):
                return config
        except ValueError:
            continue
    return {}  # Return empty dict instead of raising error


def extract_question_count(quiz_text: str) -> int:
    for var_name in ("QUESTIONS", "QUESTION_BANK"):
        try:
            questions_literal, _, _ = extract_assigned_literal(quiz_text, var_name, "[", "]")
            matches = re.findall(r'["\']?question["\']?\s*:', questions_literal)
            if matches:
                return len(matches)
        except ValueError:
            continue
    return 0  # Return 0 instead of raising error


def extract_assigned_literal(text: str, variable_name: str, open_char: str, close_char: str) -> tuple[str, int, int]:
    match = re.search(rf"\b(?:const|let|var)\s+{re.escape(variable_name)}\s*=", text)
    if not match:
        raise ValueError(f"Could not find assignment for {variable_name}.")

    start = text.find(open_char, match.end())
    if start == -1:
        raise ValueError(f"Could not find literal start for {variable_name}.")

    literal, end = extract_balanced(text, start, open_char, close_char)
    return literal, start, end


def extract_balanced(text: str, start: int, open_char: str, close_char: str) -> tuple[str, int]:
    depth = 0
    in_string: str | None = None
    in_line_comment = False
    in_block_comment = False
    escape = False
    index = start

    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""

        if in_line_comment:
            if char == "\n":
                in_line_comment = False
        elif in_block_comment:
            if char == "*" and next_char == "/":
                in_block_comment = False
                index += 1
        elif in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == in_string:
                in_string = None
        else:
            if char == "/" and next_char == "/":
                in_line_comment = True
                index += 1
            elif char == "/" and next_char == "*":
                in_block_comment = True
                index += 1
            elif char in {"'", '"', "`"}:
                in_string = char
            elif char == open_char:
                depth += 1
            elif char == close_char:
                depth -= 1
                if depth == 0:
                    return text[start : index + 1], index + 1

        index += 1

    raise ValueError("Unbalanced JavaScript literal.")


def parse_js_literal(literal: str) -> object:
    # Strip JavaScript/JSON comments first
    # Remove single-line comments
    normalized = re.sub(r'//.*?$', '', literal, flags=re.MULTILINE)
    # Remove multi-line comments
    normalized = re.sub(r'/\*.*?\*/', '', normalized, flags=re.DOTALL)
    
    # Quote unquoted keys - handle newlines and whitespace properly
    # Match: after { or , (with any whitespace including newlines), capture unquoted key followed by :
    key_pattern = re.compile(r"([,{]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)", re.DOTALL)
    previous = None
    while previous != normalized:
        previous = normalized
        normalized = key_pattern.sub(r'\1"\2"\3', normalized)

    # Remove trailing commas before } or ]
    normalized = re.sub(r",(\s*[}\]])", r"\1", normalized)
    
    return json.loads(normalized)


def append_entries_to_array_literal(array_literal: str, new_entries: list[str]) -> str:
    prefix = array_literal[:-1].rstrip()
    if prefix.endswith("["):
        return prefix + "\n" + ",\n".join(new_entries) + "\n]"
    return prefix + ",\n" + ",\n".join(new_entries) + "\n]"


def serialize_quiz_entry(entry: dict[str, object]) -> str:
    title = json.dumps(entry["title"], ensure_ascii=False)
    description = json.dumps(entry["description"], ensure_ascii=False)
    icon = json.dumps(entry["icon"], ensure_ascii=False)
    tags = ", ".join(json.dumps(tag, ensure_ascii=False) for tag in entry["tags"])
    url = json.dumps(entry["url"], ensure_ascii=False)

    return (
        "  {\n"
        f"    title: {title},\n"
        f"    description: {description},\n"
        f"    icon: {icon},\n"
        f"    tags: [{tags}],\n"
        f"    url: {url}\n"
        "  }"
    )


def serialize_string_array(values: list[str]) -> str:
    lines = ["["]
    for value in values:
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"  '{escaped}',")
    if len(lines) > 1:
        lines[-1] = lines[-1].rstrip(",")
    lines.append("]")
    return "\n".join(lines)


def infer_description(title: str, raw_description: str, dir_rel: Path) -> str:
    cleaned = normalize_spaces(raw_description)
    lowered = cleaned.casefold()

    if cleaned and lowered not in GENERIC_DESCRIPTIONS:
        return cleaned

    if "past years" in dir_rel.as_posix().casefold():
        return f"Gynecology {title} Exam"

    lecture_match = re.match(r"^L\d+\s+(.+)$", title, flags=re.IGNORECASE)
    if lecture_match:
        return lecture_match.group(1)

    if cleaned:
        return cleaned

    return f"{title} Quiz"


def infer_primary_tag(title: str, description: str, dir_rel: Path, stem: str) -> str:
    haystack = " ".join([title, description, dir_rel.as_posix(), stem]).casefold()

    if "end round" in haystack:
        return "End Round"
    if "midterm" in haystack:
        return "Midterm"
    if re.search(r"\bmid\b", haystack):
        return "Mid"
    if "final" in haystack:
        return "Final"
    if re.search(r"\bqs\b", haystack):
        return "QS"
    if "misc" in haystack:
        return "Misc"
    if "dep" in dir_rel.parts or "department book" in haystack:
        return "Lecture"
    return "Quiz"


def question_label(question_count: int) -> str:
    suffix = "Question" if question_count == 1 else "Questions"
    return f"{question_count} {suffix}"


def beautify_title(raw_title: str) -> str:
    cleaned = normalize_spaces(raw_title.replace("_", " ").replace("-", " "))

    def replacer(match: re.Match[str]) -> str:
        token = match.group(0)
        lower = token.casefold()

        acronym = ACRONYMS.get(lower)
        if acronym:
            return acronym

        ordinal_match = re.fullmatch(r"(\d+)(st|nd|rd|th)", token, flags=re.IGNORECASE)
        if ordinal_match:
            return ordinal_match.group(1) + ordinal_match.group(2).lower()

        lecture_match = re.fullmatch(r"l(\d+)", token, flags=re.IGNORECASE)
        if lecture_match:
            return "L" + lecture_match.group(1)

        if token.isupper() and len(token) <= 4:
            return token

        return token[:1].upper() + token[1:].lower()

    return re.sub(r"[A-Za-z0-9]+", replacer, cleaned)


def default_icon(dir_rel: Path) -> str:
    lowered = dir_rel.as_posix().casefold()
    if "gyn" in lowered:
        return "🤰"
    if "cardio" in lowered:
        return "🫀"
    return "📘"


def normalize_spaces(value: str) -> str:
    return " ".join(value.split())


def natural_key(value: str) -> list[tuple[int, object]]:
    parts = re.split(r"(\d+)", value.casefold())
    key: list[tuple[int, object]] = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part))
    return key


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - surfaced directly in CI logs
        print(f"sync_quiz_assets.py failed: {exc}", file=sys.stderr)
        raise
