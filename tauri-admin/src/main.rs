// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sync;

use std::env;
use std::path::Path;
use std::sync::Mutex;
use tauri::{
    http::{Request, Response, header::CONTENT_TYPE},
    Manager, State,
};

/// App state — holds the project root directory (set at startup from argv or cwd).
pub struct AppState {
    pub project_root: Mutex<String>,
}

// Custom protocol: serve quiz HTML files with __QUIZ_ENGINE_BASE rewritten.
fn handle_preview_protocol(
    app: &tauri::AppHandle,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();

    // URI form: quiztool-preview://localhost/<relative-path>
    let path_str = uri
        .trim_start_matches("quiztool-preview://localhost/")
        .split('?')   // drop any query string added by ?v=timestamp
        .next()
        .unwrap_or("");

    let decoded_path = percent_encoding::percent_decode_str(path_str)
        .decode_utf8_lossy()
        .into_owned();

    // Resolve against the stored project root
    let project_root = {
        let state: State<AppState> = app.state();
        let guard = state.project_root.lock().unwrap();
        let x = guard.clone();
        x
    };

    let root = std::path::PathBuf::from(&project_root);
    let file_path = root.join(&decoded_path);

    if !file_path.exists() || !file_path.is_file() {
        return Response::builder()
            .status(404)
            .body(format!("File not found: {}", decoded_path).into_bytes())
            .unwrap();
    }

    let content = match std::fs::read_to_string(&file_path) {
        Ok(c) => c,
        Err(e) => {
            return Response::builder()
                .status(500)
                .body(format!("Read error: {}", e).into_bytes())
                .unwrap();
        }
    };

    // Calculate __QUIZ_ENGINE_BASE depth from the relative path
    let parent = Path::new(&decoded_path).parent().unwrap_or(Path::new(""));
    let depth = if parent.as_os_str().is_empty() || parent == Path::new(".") {
        0
    } else {
        parent.components().count()
    };
    let prefix = "../".repeat(depth);

    // Rewrite the dynamic JS engine-base calculation with the static prefix
    let re_str = r#"(?m)window\.__QUIZ_ENGINE_BASE\s*=\s*['"].*?['"]\s*\.repeat\(Math\.max\(0,\s*location\.pathname\.split\(\s*['"/].*?['"]\s*\)\.filter\(Boolean\)\.length\s*-\s*\d+\)\);?"#;
    let re = regex::Regex::new(re_str).unwrap();
    let new_content = re
        .replace_all(&content, format!("window.__QUIZ_ENGINE_BASE='{}';", prefix))
        .into_owned();

    Response::builder()
        .header(CONTENT_TYPE, "text/html; charset=utf-8")
        .body(new_content.into_bytes())
        .unwrap()
}

fn main() {
    // Determine project root: first CLI arg if provided, otherwise cwd.
    let project_root = env::args()
        .nth(1)
        .unwrap_or_else(|| {
            env::current_dir()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned()
        });

    let state = AppState {
        project_root: Mutex::new(project_root.clone()),
    };

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            // Push project root into commands module via env so it can use it
            // without needing the Tauri State in every command.
            let state: State<AppState> = app.state();
            let root = state.project_root.lock().unwrap().clone();
            env::set_var("QUIZTOOL_PROJECT_ROOT", &root);
            Ok(())
        })
        .register_uri_scheme_protocol("quiztool-preview", |ctx, request| {
            handle_preview_protocol(ctx.app_handle(), request)
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_project_name,
            commands::project_state,
            commands::files,
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
        .expect("error while running tauri application");
}
