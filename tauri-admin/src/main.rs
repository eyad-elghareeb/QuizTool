// main.rs — Tauri admin dashboard entry point
// Project root = directory containing this EXE (portable .exe in project root)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod deploy;
mod git;
mod parser;
mod templates;
mod server;

use commands::ProjectRoot;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    http::{Request, Response},
};
use server::QuizServer;

// ── Embedded frontend ─────────────────────────────────────────────────────────
const FRONTEND_HTML: &str = include_str!("../frontend/index.html");

fn serve_embedded(content: &[u8], mime: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(200)
        .header("Content-Type", mime)
        .body(content.to_vec())
        .unwrap()
}

fn get_project_root() -> PathBuf {
    // 1. Check if we are running via 'cargo run'
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let path = PathBuf::from(manifest_dir);
        if path.ends_with("tauri-admin") {
            return path.parent().unwrap_or(&path).to_path_buf();
        }
        return path;
    }

    // 2. Portable mode: walk up from EXE directory looking for markers
    if let Ok(p) = std::env::current_exe() {
        if let Some(exe_dir) = p.parent() {
            let mut curr = exe_dir.to_path_buf();
            // Try up to 5 levels up
            for _ in 0..5 {
                if curr.join("index-engine.js").exists() || curr.join("manifest.webmanifest").exists() || curr.join("quiz-engine.js").exists() {
                    return curr;
                }
                // If we are in a 'target' folder, keep walking up
                let s = curr.to_string_lossy().replace('\\', "/");
                if s.ends_with("/target/debug") || s.ends_with("/target/release") || s.contains("/target/x86_64") {
                    // continue walking
                } else if curr.ends_with("scripts") || curr.ends_with("bin") {
                    // continue walking
                } else if curr.join("Cargo.toml").exists() && !curr.join("index-engine.js").exists() {
                    // We are in the tauri-admin source folder, root is parent
                    return curr.parent().unwrap_or(&curr).to_path_buf();
                }

                if let Some(parent) = curr.parent() {
                    curr = parent.to_path_buf();
                } else {
                    break;
                }
            }
            // If no marker found, default to EXE directory
            return exe_dir.to_path_buf();
        }
    }

    // 3. Fallback to CWD
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn canonicalize_path(p: PathBuf) -> PathBuf {
    let p = p.canonicalize().unwrap_or(p);
    let s = p.to_string_lossy();
    if s.starts_with(r"\\?\") {
        PathBuf::from(&s[4..])
    } else {
        p
    }
}

// ── URI scheme: quiztool-admin:// → serves the SPA ───────────────────────────
fn handle_admin_request(req: Request<Vec<u8>>, port: u16) -> Response<Vec<u8>> {
    let uri = req.uri().to_string();
    if uri.contains("/admin/pdf-exporter") {
        return serve_embedded(include_bytes!(concat!(env!("OUT_DIR"), "/engines/pdf-exporter.html")), "text/html; charset=utf-8");
    }

    // Inject the server port into the HTML
    let script = format!("<script>window.__QUIZ_SERVER_PORT = {};</script>", port);
    let mut html = FRONTEND_HTML.to_string();
    if let Some(pos) = html.find("<head>") {
        html.insert_str(pos + 6, &script);
    }

    Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(html.as_bytes().to_vec())
        .unwrap()
}

// ── Main ──────────────────────────────────────────────────────────────────────
fn main() {
    let project_root = canonicalize_path(get_project_root());
    let server = QuizServer::start(project_root.clone());
    let port = server.port;

    tauri::Builder::default()
        .manage(ProjectRoot(Mutex::new(project_root.clone())))
        .manage(server)
        .register_uri_scheme_protocol("quiztool-admin", move |_app, req| {
            handle_admin_request(req, port)
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
            commands::open_in_browser,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QuizTool Admin");
}
