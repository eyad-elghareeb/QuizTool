// main.rs — Tauri admin dashboard entry point
// Project root = directory containing this EXE (portable .exe in project root)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod deploy;
mod git;
mod parser;
mod templates;

use commands::ProjectRoot;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    http::{Request, Response},
    Manager,
};

// ── Embedded frontend ─────────────────────────────────────────────────────────
const FRONTEND_HTML: &str = include_str!("../frontend/index.html");

fn get_project_root() -> PathBuf {
    // The EXE is placed in the project root — use its parent directory
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

// ── URI scheme: quiztool-admin:// → serves the SPA ───────────────────────────
fn handle_admin_request(_req: Request<Vec<u8>>) -> Response<Vec<u8>> {
    Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(FRONTEND_HTML.as_bytes().to_vec())
        .unwrap()
}

// ── URI scheme: quiztool-preview:// → serves project files with path rewriting ──
fn handle_preview_request(req: Request<Vec<u8>>, project_root: &PathBuf) -> Response<Vec<u8>> {
    let uri = req.uri().to_string();
    // Strip scheme + host: quiztool-preview://localhost/gyn/dep/l1.html → gyn/dep/l1.html
    let path_part = uri
        .trim_start_matches("quiztool-preview://localhost/")
        .trim_start_matches("quiztool-preview://localhost")
        .trim_start_matches('/');

    // Strip query params
    let path_part = path_part.split('?').next().unwrap_or(path_part);
    let path_part = path_part.split('#').next().unwrap_or(path_part);

    if path_part.is_empty() || path_part == "." {
        return not_found();
    }

    let candidate = project_root.join(path_part);
    // Security: must stay inside project root
    let canonical = match candidate.canonicalize() {
        Ok(c) => c,
        Err(_) => return not_found(),
    };
    if !canonical.starts_with(project_root) {
        return forbidden();
    }
    if !canonical.is_file() {
        return not_found();
    }

    let ext = canonical.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "html" {
        // Rewrite engine base path for preview context
        let content = match std::fs::read_to_string(&canonical) {
            Ok(c) => c,
            Err(_) => return not_found(),
        };
        let depth = {
            let rel = canonical.strip_prefix(project_root).unwrap_or(&canonical);
            rel.components().count().saturating_sub(1)
        };
        let prefix = "../".repeat(depth);
        let re = regex::Regex::new(
            r"window\.__QUIZ_ENGINE_BASE\s*=\s*'\.\./'\.repeat\(Math\.max\(0,location\.pathname\.split\('/'[^)]*\)\.filter\(Boolean\)\.length\s*-\s*\d+\)\);?"
        ).unwrap();
        let rewritten = re.replace(&content, format!("window.__QUIZ_ENGINE_BASE='{}';", prefix).as_str());
        Response::builder()
            .status(200)
            .header("Content-Type", "text/html; charset=utf-8")
            .body(rewritten.as_bytes().to_vec())
            .unwrap()
    } else {
        // Serve static asset with correct MIME type
        let mime = match ext.as_str() {
            "js"   => "application/javascript",
            "css"  => "text/css",
            "json" | "webmanifest" => "application/json",
            "svg"  => "image/svg+xml",
            "png"  => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "ico"  => "image/x-icon",
            "woff2" => "font/woff2",
            "woff"  => "font/woff",
            "ttf"   => "font/ttf",
            _ => "application/octet-stream",
        };
        match std::fs::read(&canonical) {
            Ok(data) => Response::builder()
                .status(200)
                .header("Content-Type", mime)
                .body(data)
                .unwrap(),
            Err(_) => not_found(),
        }
    }
}

fn not_found() -> Response<Vec<u8>> {
    Response::builder().status(404).body(b"Not Found".to_vec()).unwrap()
}
fn forbidden() -> Response<Vec<u8>> {
    Response::builder().status(403).body(b"Forbidden".to_vec()).unwrap()
}

// ── Main ──────────────────────────────────────────────────────────────────────
fn main() {
    let project_root = get_project_root();

    tauri::Builder::default()
        .manage(ProjectRoot(Mutex::new(project_root.clone())))
        .register_uri_scheme_protocol("quiztool-admin", move |_app, req| {
            handle_admin_request(req)
        })
        .register_uri_scheme_protocol("quiztool-preview", {
            let root = project_root.clone();
            move |_app, req| handle_preview_request(req, &root)
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_files,
            commands::project_state,
            commands::load_file,
            commands::save_file,
            commands::validate_file,
            commands::create_folder,
            commands::create_file,
            commands::duplicate_file,
            commands::move_file,
            commands::delete_file,
            commands::delete_folder,
            commands::convert_file,
            commands::run_sync,
            commands::git_commit,
            commands::git_pull,
            commands::git_push,
            commands::provider_verify,
            commands::provider_deploy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QuizTool Admin");
}
