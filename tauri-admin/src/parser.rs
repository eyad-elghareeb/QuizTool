// parser.rs — File metadata extraction and validation
// Ported 1:1 from admin-dashboard.py

use regex::Regex;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub enum FileType { Quiz, Bank, Index, Html, Flashcard }

impl FileType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileType::Quiz => "quiz",
            FileType::Bank => "bank",
            FileType::Index => "index",
            FileType::Html => "html",
            FileType::Flashcard => "flashcard",
        }
    }
}

pub fn extract_assigned_literal(content: &str, const_name: &str, open_char: char, close_char: char) -> Option<String> {
    let pattern = format!(r"(?:const|let|var)\s+{}\s*=\s*{}", regex::escape(const_name), regex::escape(&open_char.to_string()));
    let re = Regex::new(&pattern).ok()?;
    let m = re.find(content)?;
    let start_idx = content[m.start()..].find(open_char)? + m.start();

    let mut depth = 0i32;
    let mut end_idx = None;
    let mut in_string = false;
    let mut string_quote = ' ';
    let mut escape_next = false;
    for (idx, ch) in content[start_idx..].char_indices() {
        if escape_next {
            escape_next = false;
            continue;
        }
        if ch == '\\' && in_string {
            escape_next = true;
            continue;
        }
        if in_string {
            if ch == string_quote {
                in_string = false;
            }
            continue;
        }
        // Not inside a string
        if ch == '"' || ch == '\'' {
            in_string = true;
            string_quote = ch;
        } else if ch == open_char {
            depth += 1;
        } else if ch == close_char {
            depth -= 1;
            if depth == 0 {
                end_idx = Some(start_idx + idx + ch.len_utf8());
                break;
            }
        }
    }

    if let Some(end) = end_idx {
        Some(content[start_idx..end].to_string())
    } else {
        None
    }
}

pub fn sanitize_jsonish(block: &str) -> String {
    // Remove BOM first (common in Windows-saved JSON files)
    let s = block.strip_prefix('\u{FEFF}').unwrap_or(block);
    // Strip single-line comments, avoiding protocol slashes like http://
    let re_lc = Regex::new(r"(?m)(^|[^:])//.*$").unwrap();
    let s = re_lc.replace_all(s, "$1");
    let re_bc = Regex::new(r"(?s)/\*.*?\*/").unwrap();
    let s = re_bc.replace_all(&s, "");
    let re_keys = Regex::new(r#"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:"#).unwrap();
    let s = re_keys.replace_all(&s, r#"$1"$2":"#);
    let re_sq = Regex::new(r#"'([^'\\]*(?:\\.[^'\\]*)*)'"#).unwrap();
    let s = re_sq.replace_all(&s, |caps: &regex::Captures| {
        format!("\"{}\"", caps[1].replace('"', "\\\""))
    });
    let re_trail = Regex::new(r",\s*([\]}])").unwrap();
    re_trail.replace_all(&s, "$1").to_string()
}

pub fn parse_literal(content: &str, const_name: &str, open_char: char, close_char: char) -> Option<Value> {
    let block = extract_assigned_literal(content, const_name, open_char, close_char)?;
    serde_json::from_str::<Value>(&block).ok()
        .or_else(|| serde_json::from_str::<Value>(&sanitize_jsonish(&block)).ok())
}

#[derive(Debug, Clone)]
pub struct FileMeta {
    pub file_type: FileType,
    pub uid: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub hero_title: Option<String>,
    pub question_count: usize,
    pub config: Option<Value>,
    pub questions: Option<Value>,
    pub quizzes: Option<Value>,
}

impl FileMeta {
    pub fn to_json(&self) -> Value {
        let mut map = serde_json::Map::new();
        map.insert("type".into(), Value::String(self.file_type.as_str().to_string()));
        map.insert("uid".into(), self.uid.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null));
        map.insert("title".into(), self.title.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null));
        map.insert("description".into(), self.description.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::String(String::new())));
        map.insert("icon".into(), self.icon.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null));
        map.insert("hero_title".into(), self.hero_title.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::String(String::new())));
        map.insert("question_count".into(), Value::Number(self.question_count.into()));
        if let Some(ref c) = self.config { map.insert("config".into(), c.clone()); }
        if let Some(ref q) = self.questions { map.insert("questions".into(), q.clone()); }
        if let Some(ref qz) = self.quizzes { map.insert("quizzes".into(), qz.clone()); }
        Value::Object(map)
    }
}

pub fn parse_file_metadata(content: &str) -> FileMeta {
    if let Some(cfg) = parse_literal(content, "QUIZ_CONFIG", '{', '}') {
        if cfg.is_object() {
            let questions = parse_literal(content, "QUESTIONS", '[', ']');
            let qc = questions.as_ref().and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
            return FileMeta {
                file_type: FileType::Quiz,
                uid: cfg.get("uid").and_then(|v| v.as_str()).map(String::from),
                title: cfg.get("title").and_then(|v| v.as_str()).map(String::from),
                description: cfg.get("description").and_then(|v| v.as_str()).map(String::from),
                icon: None, hero_title: None, question_count: qc,
                config: Some(cfg), questions, quizzes: None,
            };
        }
    }
    if (content.contains("/* [FLASHCARD_BANK_START] */") || content.contains("FLASHCARD_BANK"))
        && content.contains("BANK_CONFIG")
    {
        if let Some(cfg) = parse_literal(content, "BANK_CONFIG", '{', '}') {
            if cfg.is_object() {
                let questions = parse_literal(content, "FLASHCARD_BANK", '[', ']');
                let qc = questions.as_ref().and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
                return FileMeta {
                    file_type: FileType::Flashcard,
                    uid: cfg.get("uid").and_then(|v| v.as_str()).map(String::from),
                    title: cfg.get("title").and_then(|v| v.as_str()).map(String::from),
                    description: cfg.get("description").and_then(|v| v.as_str()).map(String::from),
                    icon: cfg.get("icon").and_then(|v| v.as_str()).map(String::from),
                    hero_title: None, question_count: qc,
                    config: Some(cfg), questions, quizzes: None,
                };
            }
        }
    }
    if let Some(cfg) = parse_literal(content, "BANK_CONFIG", '{', '}') {
        if cfg.is_object() {
            let questions = parse_literal(content, "QUESTION_BANK", '[', ']');
            let qc = questions.as_ref().and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
            return FileMeta {
                file_type: FileType::Bank,
                uid: cfg.get("uid").and_then(|v| v.as_str()).map(String::from),
                title: cfg.get("title").and_then(|v| v.as_str()).map(String::from),
                description: cfg.get("description").and_then(|v| v.as_str()).map(String::from),
                icon: cfg.get("icon").and_then(|v| v.as_str()).map(String::from),
                hero_title: None, question_count: qc,
                config: Some(cfg), questions, quizzes: None,
            };
        }
    }
    if let Some(quizzes) = parse_literal(content, "QUIZZES", '[', ']') {
        if quizzes.is_array() {
            let title = Regex::new(r"(?i)<title>(.*?)</title>").ok()
                .and_then(|re| re.captures(content))
                .and_then(|c| c.get(1)).map(|m| m.as_str().trim().to_string());
            let (hero_title, description) = Regex::new(r#"(?is)<header class="hero">\s*<h1>(.*?)</h1>\s*<p>(.*?)</p>"#).ok()
                .and_then(|re| re.captures(content))
                .map(|c| (
                    c.get(1).map(|m| m.as_str().trim().to_string()),
                    c.get(2).map(|m| m.as_str().trim().to_string()),
                ))
                .unwrap_or((None, None));
            let qc = quizzes.as_array().map(|a| a.len()).unwrap_or(0);
            return FileMeta {
                file_type: FileType::Index,
                uid: None, title, description, icon: None, hero_title,
                question_count: qc, config: None, questions: None, quizzes: Some(quizzes),
            };
        }
    }
    FileMeta {
        file_type: FileType::Html, uid: None, title: None, description: None,
        icon: None, hero_title: None, question_count: 0, config: None, questions: None, quizzes: None,
    }
}

pub fn infer_icon(ft: &FileType, filename: &str) -> &'static str {
    match ft {
        FileType::Index => "🏠",
        FileType::Quiz => "📝",
        FileType::Bank => "🗃️",
        FileType::Flashcard => "🃏",
        FileType::Html => if filename == "index.html" { "🏠" } else { "📄" },
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ValidationIssue {
    pub level: String,
    pub message: String,
    pub field: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<usize>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ValidationResult {
    pub meta: Value,
    pub errors: Vec<ValidationIssue>,
    pub warnings: Vec<ValidationIssue>,
}

fn mk_err(msg: &str, field: &str, code: &str, idx: Option<usize>) -> ValidationIssue {
    ValidationIssue { level: "error".into(), message: msg.to_string(), field: field.to_string(), code: Some(code.to_string()), index: idx }
}
fn mk_warn(msg: &str, field: &str, code: &str, idx: Option<usize>) -> ValidationIssue {
    ValidationIssue { level: "warning".into(), message: msg.to_string(), field: field.to_string(), code: Some(code.to_string()), index: idx }
}

fn validate_question_list(questions: &Value, prefix: &str) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();
    let arr = match questions.as_array() {
        Some(a) => a,
        None => { issues.push(mk_err("Question list could not be parsed.", prefix, "questions_invalid", None)); return issues; }
    };
    if arr.is_empty() {
        issues.push(mk_warn("This file has no questions yet.", prefix, "questions_empty", None));
        return issues;
    }
    for (i, q) in arr.iter().enumerate() {
        let text = q.get("question").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let opts: Vec<String> = q.get("options").and_then(|v| v.as_array())
            .map(|a| a.iter().map(|o| o.as_str().unwrap_or("").trim().to_string()).collect())
            .unwrap_or_default();
        let correct = q.get("correct").and_then(|v| v.as_i64()).unwrap_or(0) as usize;
        if text.is_empty() { issues.push(mk_err(&format!("Question {} is missing its prompt.", i+1), &format!("{}.{}.question", prefix, i), "question_missing_text", Some(i))); }
        if opts.len() < 2 { issues.push(mk_err(&format!("Question {} needs at least 2 options.", i+1), &format!("{}.{}.options", prefix, i), "question_too_few_options", Some(i))); }
        else if opts.iter().any(|o| o.is_empty()) { issues.push(mk_warn(&format!("Question {} has blank option text.", i+1), &format!("{}.{}.options", prefix, i), "question_blank_option", Some(i))); }
        if correct >= opts.len().max(1) { issues.push(mk_err(&format!("Question {} has an invalid correct answer.", i+1), &format!("{}.{}.correct", prefix, i), "question_invalid_correct", Some(i))); }
    }
    issues
}

pub fn validate_dashboard_content(_rel_path: &str, content: &str, original_uid: &str) -> ValidationResult {
    let meta = parse_file_metadata(content);
    let meta_json = meta.to_json();
    let mut issues: Vec<ValidationIssue> = Vec::new();
    match meta.file_type {
        FileType::Quiz => {
            if !content.contains("/* [QUIZ_CONFIG_START] */") { issues.push(mk_err("Quiz config markers are missing.", "config", "quiz_config_markers", None)); }
            if !content.contains("/* [QUESTIONS_START] */") { issues.push(mk_err("Question markers are missing.", "questions", "quiz_question_markers", None)); }
            let uid = meta.uid.as_deref().unwrap_or("").trim().to_string();
            if uid.is_empty() { issues.push(mk_err("Quiz UID is required.", "uid", "uid_missing", None)); }
            else if !original_uid.is_empty() && original_uid != uid { issues.push(mk_warn("UID changed from the saved file. This can orphan learner progress.", "uid", "uid_changed", None)); }
            if let Some(ref q) = meta.questions { issues.extend(validate_question_list(q, "questions")); }
        }
        FileType::Bank => {
            if !content.contains("/* [BANK_CONFIG_START] */") { issues.push(mk_err("Bank config markers are missing.", "config", "bank_config_markers", None)); }
            if !content.contains("/* [QUESTION_BANK_START] */") { issues.push(mk_err("Question bank markers are missing.", "questions", "bank_question_markers", None)); }
            let uid = meta.uid.as_deref().unwrap_or("").trim().to_string();
            if uid.is_empty() { issues.push(mk_err("Bank UID is required.", "uid", "uid_missing", None)); }
            else if !original_uid.is_empty() && original_uid != uid { issues.push(mk_warn("UID changed from saved file. This can orphan learner progress.", "uid", "uid_changed", None)); }
            if let Some(ref q) = meta.questions { issues.extend(validate_question_list(q, "questions")); }
        }
        FileType::Flashcard => {
            if !content.contains("/* [FLASHCARD_CONFIG_START] */") { issues.push(mk_err("Flashcard config markers are missing.", "config", "flashcard_config_markers", None)); }
            if !content.contains("/* [FLASHCARD_BANK_START] */") { issues.push(mk_err("Flashcard bank markers are missing.", "questions", "flashcard_bank_markers", None)); }
            let uid = meta.uid.as_deref().unwrap_or("").trim().to_string();
            if uid.is_empty() { issues.push(mk_err("Flashcard UID is required.", "uid", "uid_missing", None)); }
            else if !original_uid.is_empty() && original_uid != uid { issues.push(mk_warn("UID changed from the saved file. This can orphan learner progress.", "uid", "uid_changed", None)); }
            if let Some(ref q) = meta.questions { issues.extend(validate_question_list(q, "questions")); }
        }
        FileType::Index => {
            if meta.quizzes.as_ref().and_then(|v| v.as_array()).is_none() {
                issues.push(mk_err("QUIZZES could not be parsed.", "quizzes", "index_cards_invalid", None));
            } else if let Some(arr) = meta.quizzes.as_ref().and_then(|v| v.as_array()) {
                for (i, quiz) in arr.iter().enumerate() {
                    if !quiz.is_object() { issues.push(mk_err(&format!("Card {} is invalid.", i+1), &format!("quizzes.{}", i), "index_card_invalid", Some(i))); continue; }
                    let url = quiz.get("url").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                    if url.is_empty() { issues.push(mk_warn(&format!("Card {} is missing a URL.", i+1), &format!("quizzes.{}.url", i), "index_url_missing", Some(i))); }
                }
            }
        }
        FileType::Html => {}
    }
    let errors: Vec<_> = issues.iter().filter(|i| i.level == "error").cloned().collect();
    let warnings: Vec<_> = issues.iter().filter(|i| i.level == "warning").cloned().collect();
    ValidationResult { meta: meta_json, errors, warnings }
}
