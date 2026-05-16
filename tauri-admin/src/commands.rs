use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use walkdir::WalkDir;
use regex::Regex;

#[derive(Serialize, Deserialize)]
pub struct ApiResult<T> {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    pub returncode: i32,
}

pub fn get_project_root() -> PathBuf {
    // Use the project root set at startup via AppState env bridge.
    // Falls back to current_dir for dev convenience.
    if let Ok(root) = env::var("QUIZTOOL_PROJECT_ROOT") {
        let p = PathBuf::from(&root);
        if p.exists() { 
            return p; 
        }
    }
    let fallback = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    fallback
}

fn normalize_rel_path(p: &str) -> String {
    let p = p.replace('\\', "/");
    let mut parts = Vec::new();
    for part in p.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            parts.pop();
        } else {
            parts.push(part);
        }
    }
    if parts.is_empty() {
        return ".".to_string();
    }
    parts.join("/")
}

fn is_skip_dir(name: &str) -> bool {
    let skip = [".git", ".github", ".quiztool", "__pycache__", "_site", "node_modules"];
    skip.contains(&name) || name.starts_with('.')
}

#[tauri::command]
pub fn get_project_name() -> Result<String, String> {
    let root = get_project_root();
    let name = root.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "MyMedQuiz".to_string());
    Ok(name)
}

#[derive(Serialize)]
pub struct ProjectState {
    pub project_name: String,
    pub git: GitState,
    pub summary: WorkspaceSummary,
}

#[derive(Serialize)]
pub struct GitState {
    pub available: bool,
    pub branch: String,
    pub clean: bool,
    #[serde(rename = "dirtyCount")]
    pub dirty_count: usize,
    #[serde(rename = "changedPaths")]
    pub changed_paths: Vec<GitPath>,
}

#[derive(Serialize)]
pub struct GitPath {
    pub path: String,
    pub status: String,
}

#[derive(Serialize, Default)]
pub struct WorkspaceSummary {
    #[serde(rename = "folderCount")]
    pub folder_count: usize,
    #[serde(rename = "totalQuestions")]
    pub total_questions: usize,
}

#[tauri::command]
pub fn project_state() -> Result<ApiResult<ProjectState>, String> {
    let root = get_project_root();
    
    // Git detection
    let mut available = false;
    let mut branch = String::new();
    let mut clean = true;
    let mut dirty_count = 0;
    let mut changed_paths = Vec::new();
    
    if root.join(".git").exists() {
        available = true;
        
        // Get branch
        if let Ok(output) = Command::new("git").args(&["rev-parse", "--abbrev-ref", "HEAD"]).current_dir(&root).output() {
            branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
        
        // Get status
        if let Ok(output) = Command::new("git").args(&["status", "--porcelain"]).current_dir(&root).output() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            for line in out_str.lines() {
                if line.len() > 3 {
                    let status = line[..2].trim().to_string();
                    let path = line[3..].to_string();
                    changed_paths.push(GitPath { path, status });
                }
            }
            dirty_count = changed_paths.len();
            clean = dirty_count == 0;
        }
    }
    
    // Summary calculation
    let mut folder_count = 0;
    let mut total_questions = 0;
    
    for entry in WalkDir::new(&root).into_iter().filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        if e.file_type().is_dir() {
            !is_skip_dir(&name)
        } else {
            true
        }
    }) {
        if let Ok(entry) = entry {
            if entry.file_type().is_dir() {
                folder_count += 1;
            } else if entry.path().extension().map_or(false, |ext| ext.eq_ignore_ascii_case("html")) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let (ftype, _, _, _) = parse_file_metadata(&content);
                    if ftype == "quiz" || ftype == "bank" {
                        let re = if ftype == "quiz" {
                            Regex::new(r#"(?s)(?:const|let|var)\s+QUESTIONS\s*=\s*\["#).unwrap()
                        } else {
                            Regex::new(r#"(?s)(?:const|let|var)\s+QUESTION_BANK\s*=\s*\["#).unwrap()
                        };
                        
                        if let Some(caps) = re.captures(&content) {
                            let start = caps.get(0).unwrap().end();
                            let mut depth = 1;
                            let mut count = 0;
                            let mut in_obj = false;
                            for c in content[start..].chars() {
                                if c == '[' && !in_obj { depth += 1; }
                                else if c == ']' && !in_obj { 
                                    depth -= 1; 
                                    if depth == 0 { break; }
                                }
                                else if c == '{' && depth == 1 { 
                                    in_obj = true;
                                    count += 1;
                                }
                                else if c == '}' && depth == 1 {
                                    in_obj = false;
                                }
                            }
                            total_questions += count;
                        }
                    }
                }
            }
        }
    }
    
    Ok(ApiResult {
        message: "Project state loaded.".into(),
        output: None,
        data: Some(ProjectState {
            project_name: get_project_name()?,
            git: GitState {
                available,
                branch,
                clean,
                dirty_count,
                changed_paths,
            },
            summary: WorkspaceSummary {
                folder_count,
                total_questions,
            }
        }),
        returncode: 0
    })
}

#[derive(Serialize)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Serialize)]
pub struct FilesResponse {
    pub files: Vec<FileNode>,
    pub folders: Vec<String>,
}

#[tauri::command]
pub fn files() -> Result<ApiResult<FilesResponse>, String> {
    let root = get_project_root();
    let mut file_nodes = Vec::new();
    let mut folder_nodes = Vec::new();
    
    // add root folder
    folder_nodes.push(".".to_string());
    
    for entry in WalkDir::new(&root).into_iter().filter_entry(|e| {
        let name = e.file_name().to_string_lossy();
        if e.file_type().is_dir() {
            !is_skip_dir(&name)
        } else {
            true
        }
    }) {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path == root.as_path() { continue; }
        
        let rel_path = path.strip_prefix(&root).unwrap_or(path).to_string_lossy().replace('\\', "/");
        
        if entry.file_type().is_dir() {
            folder_nodes.push(rel_path);
        } else if path.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("html")) {
            let content = fs::read_to_string(path).unwrap_or_default();
            let (ftype, uid, title, icon) = parse_file_metadata(&content);
            file_nodes.push(FileNode {
                path: rel_path.clone(),
                name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                file_type: ftype,
                uid,
                title,
                icon,
            });
        }
    }
    
    Ok(ApiResult {
        message: "Files loaded.".into(),
        output: None,
        data: Some(FilesResponse {
            files: file_nodes,
            folders: folder_nodes,
        }),
        returncode: 0
    })
}

// Parses basic metadata without a full AST
fn parse_file_metadata(content: &str) -> (String, Option<String>, Option<String>, Option<String>) {
    let mut ftype = "html".to_string();
    let mut uid = None;
    let mut title = None;
    let mut icon = None;
    
    if content.contains("QUIZ_CONFIG") && content.contains("QUESTIONS") {
        ftype = "quiz".to_string();
        let re = Regex::new(r#"(?s)(?:const|let|var)\s+QUIZ_CONFIG\s*=\s*\{([^}]*)\}"#).unwrap();
        if let Some(caps) = re.captures(content) {
            let block = caps.get(1).unwrap().as_str();
            uid = extract_json_like_val(block, "uid");
            title = extract_json_like_val(block, "title");
            icon = extract_json_like_val(block, "icon").or(Some("📘".to_string()));
        }
    } else if content.contains("BANK_CONFIG") && content.contains("QUESTION_BANK") {
        ftype = "bank".to_string();
        let re = Regex::new(r#"(?s)(?:const|let|var)\s+BANK_CONFIG\s*=\s*\{([^}]*)\}"#).unwrap();
        if let Some(caps) = re.captures(content) {
            let block = caps.get(1).unwrap().as_str();
            uid = extract_json_like_val(block, "uid");
            title = extract_json_like_val(block, "title");
            icon = extract_json_like_val(block, "icon").or(Some("🗃️".to_string()));
        }
    } else if content.contains("const QUIZZES = [") || content.contains("const QUIZZES=[") {
        ftype = "index".to_string();
    }
    
    (ftype, uid, title, icon)
}

fn extract_json_like_val(block: &str, key: &str) -> Option<String> {
    let re = Regex::new(&format!(r#"['"]?{}['"]?\s*:\s*['"]([^'"]*)['"]"#, regex::escape(key))).unwrap();
    re.captures(block).map(|c| c.get(1).unwrap().as_str().to_string())
}

#[derive(Deserialize)]
pub struct PathPayload {
    pub path: String,
}

#[derive(Serialize)]
pub struct LoadFileResponse {
    pub content: String,
    pub meta: FileMeta,
}

#[derive(Serialize, Default)]
pub struct FileMeta {
    #[serde(rename = "type")]
    pub file_type: String,
    pub uid: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub questions: Vec<serde_json::Value>,
    pub quizzes: Vec<serde_json::Value>,
}

#[tauri::command]
pub fn load_file(payload: PathPayload) -> Result<ApiResult<LoadFileResponse>, String> {
    let root = get_project_root();
    let norm = normalize_rel_path(&payload.path);
    let target = root.join(&norm);
    if !target.starts_with(&root) || !target.exists() || target.is_dir() {
        return Err("File not found or invalid path".into());
    }
    
    let content = fs::read_to_string(&target).map_err(|e| e.to_string())?;
    
    let mut meta = FileMeta::default();
    let (ftype, uid, title, icon) = parse_file_metadata(&content);
    meta.file_type = ftype;
    meta.uid = uid.unwrap_or_default();
    meta.title = title.unwrap_or_default();
    meta.icon = icon.unwrap_or_default();
    
    Ok(ApiResult {
        message: "File loaded.".into(),
        output: None,
        data: Some(LoadFileResponse {
            content,
            meta,
        }),
        returncode: 0
    })
}

#[derive(Deserialize)]
pub struct SaveFilePayload {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn save_file(payload: SaveFilePayload) -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let norm = normalize_rel_path(&payload.path);
    let target = root.join(&norm);
    if !target.starts_with(&root) || !target.exists() || target.is_dir() {
        return Err("File not found or invalid path".into());
    }
    
    fs::write(&target, &payload.content).map_err(|e| e.to_string())?;
    
    Ok(ApiResult {
        message: format!("Saved {}.", norm),
        output: None,
        data: None,
        returncode: 0
    })
}

#[tauri::command]
pub fn create_file(payload: serde_json::Value) -> Result<ApiResult<serde_json::Value>, String> {
    let root = get_project_root();
    let folder = payload.get("folder").and_then(|v| v.as_str()).unwrap_or(".");
    let filename = payload.get("filename").and_then(|v| v.as_str()).unwrap_or("untitled");
    let ftype = payload.get("type").and_then(|v| v.as_str()).unwrap_or("quiz");
    
    let folder_path = root.join(normalize_rel_path(folder));
    if !folder_path.exists() {
        fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
    }
    
    let mut final_filename = filename.to_string();
    if !final_filename.ends_with(".html") {
        final_filename.push_str(".html");
    }
    
    let target_path = folder_path.join(&final_filename);
    if target_path.exists() {
        return Err("File already exists".into());
    }
    
    let template_name = if ftype == "bank" { "question-bank-template.html" } else { "quiz-template.html" };
    let template_path = root.join(template_name);
    let mut content = if template_path.exists() {
        fs::read_to_string(template_path).map_err(|e| e.to_string())?
    } else {
        return Err(format!("Template {} not found at repo root", template_name));
    };
    
    // Fill in basic metadata from payload if provided
    if let Some(title) = payload.get("title").and_then(|v| v.as_str()) {
        content = content.replace("<title>Quiz Title</title>", &format!("<title>{}</title>", title));
        content = content.replace("title: \"Quiz Display Title\"", &format!("title: \"{}\"", title));
    }
    
    if let Some(uid) = payload.get("uid").and_then(|v| v.as_str()) {
        content = content.replace("\"uid\": \"unique_snake_case_id\"", &format!("\"uid\": \"{}\"", uid));
    }
    
    if let Some(questions) = payload.get("questions") {
        let q_json = serde_json::to_string_pretty(questions).unwrap_or_else(|_| "[]".into());
        let marker = if ftype == "bank" { "QUESTION_BANK = [" } else { "QUESTIONS = [" };
        let re = Regex::new(&format!(r#"(?s)(?:const|let|var)\s+{}\s*=\s*\[.*?\];"#, marker)).unwrap();
        content = re.replace(&content, format!("const {} = {};", marker.replace(" = [", ""), q_json)).into_owned();
    }

    // Fix depth
    let depth = if folder == "." { 0 } else { folder.split('/').filter(|s| !s.is_empty()).count() };
    let prefix = "../".repeat(depth);
    content = content.replace("window.__QUIZ_ENGINE_BASE='../'.repeat", &format!("window.__QUIZ_ENGINE_BASE='{}'; //", prefix));

    fs::write(&target_path, content).map_err(|e| e.to_string())?;
    
    let result_path = if folder == "." { final_filename.clone() } else { format!("{}/{}", folder, final_filename) };
    
    Ok(ApiResult { 
        message: format!("Created {}.", final_filename), 
        output: None, 
        data: Some(serde_json::json!({ "path": result_path })),
        returncode: 0 
    })
}

#[tauri::command]
pub fn duplicate_file(payload: serde_json::Value) -> Result<ApiResult<serde_json::Value>, String> {
    let root = get_project_root();
    let source = payload.get("path").and_then(|v| v.as_str()).ok_or("Source path missing")?;
    let folder = payload.get("folder").and_then(|v| v.as_str()).unwrap_or(".");
    let filename = payload.get("filename").and_then(|v| v.as_str()).ok_or("Target filename missing")?;
    
    let source_path = root.join(normalize_rel_path(source));
    let mut final_filename = filename.to_string();
    if !final_filename.ends_with(".html") { final_filename.push_str(".html"); }
    let target_path = root.join(normalize_rel_path(folder)).join(&final_filename);
    
    if !source_path.exists() { return Err("Source file not found".into()); }
    if target_path.exists() { return Err("Target file already exists".into()); }
    
    let mut content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    
    // Update UID if it's a quiz/bank
    let (ftype, old_uid, _, _) = parse_file_metadata(&content);
    if (ftype == "quiz" || ftype == "bank") && old_uid.is_some() {
        let stem = final_filename.replace(".html", "");
        let new_uid = build_derived_uid(folder, &stem);
        content = content.replace(&format!("\"uid\": \"{}\"", old_uid.unwrap()), &format!("\"uid\": \"{}\"", new_uid));
    }
    
    // Fix depth if folder changed
    let source_folder = if source.contains('/') { source.split('/').take(source.split('/').count()-1).collect::<Vec<&str>>().join("/") } else { ".".to_string() };
    if source_folder != folder {
        let depth = if folder == "." { 0 } else { folder.split('/').filter(|s| !s.is_empty()).count() };
        let prefix = "../".repeat(depth);
        let re = Regex::new(r#"window\.__QUIZ_ENGINE_BASE\s*=\s*['"].*?['"];?"#).unwrap();
        content = re.replace(&content, format!("window.__QUIZ_ENGINE_BASE='{}';", prefix)).into_owned();
    }

    fs::write(&target_path, content).map_err(|e| e.to_string())?;
    
    let rel_target_path = if folder == "." { final_filename.clone() } else { format!("{}/{}", folder, final_filename) };
    Ok(ApiResult {
        message: format!("Duplicate created at {}", rel_target_path),
        output: None,
        data: Some(serde_json::json!({ "path": rel_target_path })),
        returncode: 0
    })
}

fn build_derived_uid(folder: &str, stem: &str) -> String {
    let mut parts = Vec::new();
    if folder != "." {
        parts.extend(folder.split('/').filter(|s| !s.is_empty()));
    }
    parts.push(stem);
    parts.join("_").to_lowercase().replace('-', "_").replace(' ', "_")
}

#[tauri::command]
pub fn move_file(payload: serde_json::Value) -> Result<ApiResult<serde_json::Value>, String> {
    let root = get_project_root();
    let source = payload.get("path").and_then(|v| v.as_str()).ok_or("Source path missing")?;
    let folder = payload.get("folder").and_then(|v| v.as_str()).unwrap_or(".");
    let filename = payload.get("filename").and_then(|v| v.as_str()).ok_or("Target filename missing")?;
    
    let source_path = root.join(normalize_rel_path(source));
    let mut final_filename = filename.to_string();
    if !final_filename.ends_with(".html") { final_filename.push_str(".html"); }
    let target_path = root.join(normalize_rel_path(folder)).join(&final_filename);
    
    if !source_path.exists() { return Err("Source file not found".into()); }
    if target_path.exists() && source_path != target_path { return Err("Target file already exists".into()); }
    
    // If moving to a different depth, update engine base
    let source_folder = if source.contains('/') { source.split('/').take(source.split('/').count()-1).collect::<Vec<&str>>().join("/") } else { ".".to_string() };
    if source_folder != folder {
        let mut content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
        let depth = if folder == "." { 0 } else { folder.split('/').filter(|s| !s.is_empty()).count() };
        let prefix = "../".repeat(depth);
        let re = Regex::new(r#"window\.__QUIZ_ENGINE_BASE\s*=\s*['"].*?['"];?"#).unwrap();
        content = re.replace(&content, format!("window.__QUIZ_ENGINE_BASE='{}';", prefix)).into_owned();
        fs::write(&source_path, content).map_err(|e| e.to_string())?;
    }

    fs::rename(&source_path, &target_path).map_err(|e| e.to_string())?;
    
    let rel_target_path = if folder == "." { final_filename.clone() } else { format!("{}/{}", folder, final_filename) };
    Ok(ApiResult {
        message: format!("File moved to {}", rel_target_path),
        output: None,
        data: Some(serde_json::json!({ "path": rel_target_path })),
        returncode: 0
    })
}

#[tauri::command]
pub fn delete_file(payload: serde_json::Value) -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let path = payload.get("path").and_then(|v| v.as_str()).ok_or("Path missing")?;
    let target = root.join(normalize_rel_path(path));
    
    if target.exists() && target.is_file() {
        fs::remove_file(target).map_err(|e| e.to_string())?;
        Ok(ApiResult { message: "File deleted.".into(), output: None, data: None, returncode: 0 })
    } else {
        Err("File not found".into())
    }
}

#[tauri::command]
pub fn delete_folder(payload: serde_json::Value) -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let path = payload.get("path").and_then(|v| v.as_str()).ok_or("Path missing")?;
    if path == "." || path == "/" { return Err("Cannot delete root".into()); }
    
    let target = root.join(normalize_rel_path(path));
    if target.exists() && target.is_dir() {
        fs::remove_dir_all(target).map_err(|e| e.to_string())?;
        Ok(ApiResult { message: "Folder deleted.".into(), output: None, data: None, returncode: 0 })
    } else {
        Err("Folder not found".into())
    }
}

#[tauri::command]
pub fn convert_file(payload: serde_json::Value) -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let path = payload.get("path").and_then(|v| v.as_str()).ok_or("Path missing")?;
    let target = root.join(normalize_rel_path(path));
    
    let mut content = fs::read_to_string(&target).map_err(|e| e.to_string())?;
    let (ftype, _, _, _) = parse_file_metadata(&content);
    
    if ftype == "quiz" {
        content = content.replace("quiz-engine.js", "bank-engine.js");
        content = content.replace("QUIZ_CONFIG", "BANK_CONFIG");
        content = content.replace("QUESTIONS", "QUESTION_BANK");
    } else if ftype == "bank" {
        content = content.replace("bank-engine.js", "quiz-engine.js");
        content = content.replace("BANK_CONFIG", "QUIZ_CONFIG");
        content = content.replace("QUESTION_BANK", "QUESTIONS");
    } else {
        return Err("Only quiz or bank files can be converted".into());
    }
    
    fs::write(&target, content).map_err(|e| e.to_string())?;
    Ok(ApiResult { message: "File converted.".into(), output: None, data: None, returncode: 0 })
}

#[tauri::command]
pub fn create_folder(payload: serde_json::Value) -> Result<ApiResult<serde_json::Value>, String> {
    let root = get_project_root();
    let name = payload.get("name").and_then(|v| v.as_str()).ok_or("Name missing")?;
    let title = payload.get("title").and_then(|v| v.as_str()).unwrap_or(name);
    let description = payload.get("description").and_then(|v| v.as_str()).unwrap_or("");
    
    let folder_path = root.join(normalize_rel_path(name));
    if folder_path.exists() { return Err("Folder already exists".into()); }
    
    fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
    
    // Create index.html from template
    let template_path = root.join("index-template.html");
    if template_path.exists() {
        let mut content = fs::read_to_string(template_path).map_err(|e| e.to_string())?;
        content = content.replace("<title>Quiz Hub</title>", &format!("<title>{}</title>", title));
        content = content.replace("<div class=\"topbar-title\">Quiz Hub</div>", &format!("<div class=\"topbar-title\">{}</div>", title));
        content = content.replace("<h1>Select Your <span>Exam</span></h1>", &format!("<h1>{}</h1>", title));
        content = content.replace("<p>Test your knowledge across various subjects. Choose an exam below to begin.</p>", &format!("<p>{}</p>", description));
        
        let depth = name.split('/').filter(|s| !s.is_empty()).count();
        let prefix = "../".repeat(depth);
        content = content.replace("href=\"index-engine.css\"", &format!("href=\"{}index-engine.css\"", prefix));
        content = content.replace("src=\"index-engine.js\"", &format!("src=\"{}index-engine.js\"", prefix));
        content = content.replace("register('sw.js')", &format!("register('{}sw.js')", prefix));
        content = content.replace("href=\"favicon.svg\"", &format!("href=\"{}favicon.svg\"", prefix));
        content = content.replace("href=\"manifest.webmanifest\"", &format!("href=\"{}manifest.webmanifest\"", prefix));

        fs::write(folder_path.join("index.html"), content).map_err(|e| e.to_string())?;
    }
    
    Ok(ApiResult {
        message: format!("Folder created at {}", name),
        output: None,
        data: Some(serde_json::json!({ "path": name })),
        returncode: 0
    })
}

#[tauri::command]
pub fn validate_file(payload: serde_json::Value) -> Result<ApiResult<serde_json::Value>, String> {
    let content = payload.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let mut issues = Vec::new();
    let mut fatal = false;
    
    let (ftype, uid, title, _) = parse_file_metadata(content);
    if ftype == "quiz" || ftype == "bank" {
        if uid.is_none() { 
            issues.push(serde_json::json!({ "level": "error", "message": "Missing UID in config" }));
            fatal = true;
        }
        if title.is_none() { issues.push(serde_json::json!({ "level": "warning", "message": "Missing Title in config" })); }
        
        // Basic question check
        let q_re = Regex::new(r#"\{[\s\S]*?"question"\s*:\s*".*?"[\s\S]*?\}"#).unwrap();
        let q_count = q_re.find_iter(content).count();
        if q_count == 0 {
            issues.push(serde_json::json!({ "level": "warning", "message": "No questions found" }));
        }
    }
    
    Ok(ApiResult {
        message: "Validation complete.".into(),
        output: None,
        data: Some(serde_json::json!({ "issues": issues, "fatal": fatal })),
        returncode: 0
    })
}

#[tauri::command]
pub fn run_sync() -> Result<ApiResult<()>, String> {
    crate::sync::run_sync().map_err(|e| e.to_string())?;
    Ok(ApiResult {
        message: "Sync completed successfully.".to_string(),
        output: None,
        data: None,
        returncode: 0
    })
}

#[derive(Deserialize)]
pub struct CommitPayload {
    pub payload: Option<serde_json::Value>,
    pub message: Option<String>,
}

#[tauri::command]
pub fn git_commit(payload: CommitPayload) -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let message = payload.message
        .or_else(|| {
            payload.payload.as_ref()
                .and_then(|p| p.get("message"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "Update quiz project files".to_string());
    let _ = Command::new("git").args(&["add", "-A"]).current_dir(&root).output();
    let res = Command::new("git")
        .args(&["commit", "-m", &message])
        .current_dir(&root)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&res.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&res.stderr).into_owned();
    Ok(ApiResult {
        message: if res.status.success() { "Commit created successfully.".into() } else { stderr.clone() },
        output: Some(format!("{}{}", stdout, stderr)),
        data: None,
        returncode: if res.status.success() { 0 } else { 1 }
    })
}

#[tauri::command]
pub fn git_pull() -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let res = Command::new("git").args(&["pull", "--rebase", "--autostash"]).current_dir(&root).output().map_err(|e| e.to_string())?;
    Ok(ApiResult {
        message: "Pull completed successfully.".into(),
        output: Some(String::from_utf8_lossy(&res.stdout).into_owned()),
        data: None,
        returncode: if res.status.success() { 0 } else { 1 }
    })
}

#[tauri::command]
pub fn git_push() -> Result<ApiResult<()>, String> {
    let root = get_project_root();
    let res = Command::new("git").args(&["push"]).current_dir(&root).output().map_err(|e| e.to_string())?;
    Ok(ApiResult {
        message: "Push completed successfully.".into(),
        output: Some(String::from_utf8_lossy(&res.stderr).into_owned()),
        data: None,
        returncode: if res.status.success() { 0 } else { 1 }
    })
}

#[tauri::command]
pub fn provider_verify(_payload: serde_json::Value) -> Result<ApiResult<()>, String> {
    Ok(ApiResult { message: "Provider verify not available in native app. Use QuizTool generator.".into(), output: None, data: None, returncode: 1 })
}

#[tauri::command]
pub fn provider_deploy(_payload: serde_json::Value) -> Result<ApiResult<()>, String> {
    Ok(ApiResult { message: "Provider deploy not available in native app. Use QuizTool generator.".into(), output: None, data: None, returncode: 1 })
}

// End of commands.rs
