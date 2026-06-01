use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let out_dir = env::var("OUT_DIR").unwrap();
    
    let project_dir = PathBuf::from(manifest_dir);
    let quiztool_root = project_dir.parent().unwrap();
    let dest_dir = PathBuf::from(out_dir).join("engines");

    fs::create_dir_all(&dest_dir).unwrap();

    let files_to_copy = [
        "quiz-engine.js",
        "bank-engine.js",
        "flashcard-engine.js",
        "index-engine.js",
        "index-engine.css",
        "sync-engine.js",
        "favicon.svg",
        "sw.js",
        "manifest.webmanifest",
        "pdf-exporter.html",
    ];

    for file in &files_to_copy {
        let src = quiztool_root.join(file);
        let dest = dest_dir.join(file);
        if src.exists() {
            fs::copy(&src, &dest).unwrap_or_else(|_| panic!("Failed to copy {}", file));
            println!("cargo:rerun-if-changed={}", src.display());
        }
    }

    tauri_build::build()
}
