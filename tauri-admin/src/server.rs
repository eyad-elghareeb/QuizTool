use rocket::{get, options, routes, State, Config};
use rocket::http::{Status, ContentType, Header};
use rocket::response::{self, Response, Responder};
use rocket::request::Request;
use rocket::fairing::{Fairing, Info, Kind};
use std::path::{PathBuf};
use std::fs;
use std::thread;
use std::sync::Arc;
use regex::Regex;

pub struct QuizServer {
    pub port: u16,
}

pub struct ServerState {
    pub root: PathBuf,
    pub re_base: Regex,
}

pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Response
        }
    }

    async fn on_response<'r>(&self, _request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new("Access-Control-Allow-Methods", "GET, POST, OPTIONS"));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Cross-Origin-Resource-Policy", "cross-origin"));
    }
}

pub struct RawResponse {
    pub bytes: Vec<u8>,
    pub mime: ContentType,
}

impl<'r> Responder<'r, 'static> for RawResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        Response::build()
            .header(self.mime)
            .sized_body(self.bytes.len(), std::io::Cursor::new(self.bytes))
            .ok()
    }
}

#[options("/<path..>")]
fn options_handler(path: PathBuf) -> Status {
    let _ = path;
    Status::NoContent
}

#[get("/")]
async fn index_root(state: &State<Arc<ServerState>>) -> Result<RawResponse, Status> {
    serve_file(PathBuf::from("index.html"), state).await
}

#[get("/<path..>")]
async fn serve_file(path: PathBuf, state: &State<Arc<ServerState>>) -> Result<RawResponse, Status> {
    let path_str = path.to_string_lossy().to_string().replace('\\', "/");
    let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
    
    // 1. Try embedded engines first
    let embedded: Option<(&'static [u8], ContentType)> = match path_str.as_str() {
        "quiz-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/quiz-engine.js")), ContentType::JavaScript)),
        "bank-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/bank-engine.js")), ContentType::JavaScript)),
        "index-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/index-engine.js")), ContentType::JavaScript)),
        "index-engine.css" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/index-engine.css")), ContentType::CSS)),
        "sync-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/sync-engine.js")), ContentType::JavaScript)),
        "favicon.svg" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/favicon.svg")), ContentType::SVG)),
        "sw.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/sw.js")), ContentType::JavaScript)),
        "manifest.webmanifest" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/manifest.webmanifest")), ContentType::JSON)),
        "pdf-exporter.html" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/pdf-exporter.html")), ContentType::HTML)),
        _ => None,
    };

    if let Some((bytes, mime)) = embedded {
        return Ok(RawResponse { bytes: bytes.to_vec(), mime });
    }

    // 2. Serve from disk
    let candidate = state.root.join(&path);
    if candidate.is_file() {
        let ext = candidate.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        if ext == "html" {
            if let Ok(data) = fs::read(&candidate) {
                let content = String::from_utf8_lossy(&data);
                let depth = {
                    let rel = candidate.strip_prefix(&state.root).unwrap_or(&candidate);
                    rel.components().count().saturating_sub(1)
                };
                let prefix = "../".repeat(depth);
                let rewritten = state.re_base.replace(&content, format!("window.__QUIZ_ENGINE_BASE='{}';", prefix).as_str()).into_owned();
                return Ok(RawResponse {
                    bytes: rewritten.into_bytes(),
                    mime: ContentType::HTML,
                });
            }
        } else {
            let mime = ContentType::from_extension(&ext).unwrap_or(ContentType::Binary);
            if let Ok(data) = fs::read(&candidate) {
                return Ok(RawResponse { bytes: data, mime });
            }
        }
    }

    // 3. Fallback for shared assets by filename
    let shared_fallback: Option<(&'static [u8], ContentType)> = match filename {
        "quiz-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/quiz-engine.js")), ContentType::JavaScript)),
        "bank-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/bank-engine.js")), ContentType::JavaScript)),
        "index-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/index-engine.js")), ContentType::JavaScript)),
        "index-engine.css" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/index-engine.css")), ContentType::CSS)),
        "sync-engine.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/sync-engine.js")), ContentType::JavaScript)),
        "sw.js" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/sw.js")), ContentType::JavaScript)),
        "manifest.webmanifest" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/manifest.webmanifest")), ContentType::JSON)),
        "favicon.svg" | "favicon.ico" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/favicon.svg")), ContentType::SVG)),
        "pdf-exporter.html" => Some((include_bytes!(concat!(env!("OUT_DIR"), "/engines/pdf-exporter.html")), ContentType::HTML)),
        _ => None,
    };

    if let Some((bytes, mime)) = shared_fallback {
        return Ok(RawResponse { bytes: bytes.to_vec(), mime });
    }

    // 4. Fallback for user assets in project root (e.g. icon-*.png)
    if path.components().count() > 1 {
        let root_candidate = state.root.join(filename);
        if root_candidate.is_file() {
            let ext = root_candidate.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            if let Ok(data) = fs::read(&root_candidate) {
                let mime = ContentType::from_extension(&ext).unwrap_or(ContentType::Binary);
                return Ok(RawResponse { bytes: data, mime });
            }
        }
    }

    Err(Status::NotFound)
}

impl QuizServer {
    pub fn start(project_root: PathBuf) -> Self {
        let port = portpicker::pick_unused_port().expect("No free ports available");
        let root = project_root.clone();

        thread::spawn(move || {
            let re_base = Regex::new(
                r#"(?s)window\.__QUIZ_ENGINE_BASE\s*=\s*['"][^'"]*['"](?:\s*\.repeat\(.*?\))?\s*;?"#
            ).unwrap();

            let state = Arc::new(ServerState { root, re_base });
            
            let config = Config {
                port,
                address: "127.0.0.1".parse().unwrap(),
                temp_dir: std::env::temp_dir().into(),
                log_level: rocket::config::LogLevel::Normal,
                ..Config::default()
            };

            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async {
                let rocket = rocket::custom(config)
                    .manage(state)
                    .attach(CORS)
                    .mount("/", routes![index_root, serve_file, options_handler]);
                
                println!("[Rocket] Launching on http://127.0.0.1:{}", port);
                if let Err(e) = rocket.launch().await {
                    eprintln!("[Rocket] FATAL: {}", e);
                }
            });
        });

        Self { port }
    }
}
