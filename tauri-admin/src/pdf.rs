// ═══════════════════════════════════════════════════════════════════════════════
//  pdf.rs  — Premium PDF Generator
//  Visual identity sourced from pdf-exporter.html (gold / navy / white palette)
// ═══════════════════════════════════════════════════════════════════════════════

use genpdf::elements::{PageBreak, Paragraph, TableLayout};
use genpdf::fonts::{FontData, FontFamily};
use genpdf::style::{Color, Style};
use genpdf::{Alignment, Document, Element, Margins, SimplePageDecorator, Size};
use serde_json::Value;
use std::path::Path;

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — mirrors html/pdf-exporter.html colour palette exactly
// ═══════════════════════════════════════════════════════════════════════════════

const LETTERS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";

//  Primary                                          HTML ref
const ACCENT:   Color = Color::Rgb(240, 165,   0); // #f0a500 — premium gold
const GOLD_LT:  Color = Color::Rgb(255, 201,  77); // #ffc94d — light gold
//  Semantic
const CORRECT:  Color = Color::Rgb( 46, 160,  67); // #2ea043 — success green
const WRONG:    Color = Color::Rgb(218,  54,  51); // #da3633 — error red (unused here, exported for callers)
//  Neutral scale
const MUTED:    Color = Color::Rgb(139, 148, 158); // #8b949e — muted grey
const DIM:      Color = Color::Rgb(110, 118, 125); // #6e7681 — dim grey
//  Accent tints
const STEEL:    Color = Color::Rgb( 88, 166, 255); // #58a6ff — steel blue (chapter kicker alt)

// Re-export colours that are part of the design system but not used internally,
// so downstream callers (Tauri commands, test helpers, etc.) can reference them
// without importing the raw RGB values.
#[allow(dead_code)]
const _PALETTE_EXPORTS: (Color, Color, Color) = (WRONG, STEEL, GOLD_LT);

// ═══════════════════════════════════════════════════════════════════════════════
// FONT LOADING — Windows + Linux + macOS, DejaVu preferred on Linux
// ═══════════════════════════════════════════════════════════════════════════════

fn load_font_family() -> Result<FontFamily<FontData>, String> {
    // ── Windows ──────────────────────────────────────────────────────────────
    let win = Path::new(r"C:\Windows\Fonts");
    if win.exists() {
        let families: [(&str, [&str; 4]); 5] = [
            ("Arial",    ["arial.ttf",   "arialbd.ttf",  "ariali.ttf",   "arialbi.ttf"]),
            ("Calibri",  ["calibri.ttf", "calibrib.ttf", "calibrii.ttf", "calibriz.ttf"]),
            ("Segoe UI", ["segoeui.ttf", "segoeuib.ttf", "segoeuii.ttf", "segoeuiz.ttf"]),
            ("Corbel",   ["corbel.ttf",  "corbelb.ttf",  "corbeli.ttf",  "corbelz.ttf"]),
            ("Georgia",  ["georgia.ttf", "georgiab.ttf", "georgiai.ttf", "georgiaz.ttf"]),
        ];
        for (_name, files) in &families {
            let rp = win.join(files[0]);
            if !rp.exists() { continue; }
            let Ok(regular) = FontData::load(&rp, None) else { continue };
            let regular_clone = regular.clone();
            let load = move |f: &str| FontData::load(&win.join(f), None).unwrap_or_else(|_| regular_clone.clone());
            return Ok(FontFamily {
                regular, bold: load(files[1]), italic: load(files[2]), bold_italic: load(files[3]),
            });
        }
    }

    // ── Linux / macOS ─────────────────────────────────────────────────────────
    // (dir, name, ext, regular-suffix, bold-suffix, italic-suffix, bold-italic-suffix)
    let nix_sets: &[(&str, &str, &str, &str, &str, &str, &str)] = &[
        ("/usr/share/fonts/truetype/dejavu",     "DejaVuSans",     ".ttf", "-Regular",  "-Bold",     "-Italic",     "-BoldItalic"),
        ("/usr/share/fonts/truetype/liberation", "LiberationSans", ".ttf", "-Regular",  "-Bold",     "-Italic",     "-BoldItalic"),
        ("/usr/share/fonts/truetype/noto",        "NotoSans",       ".ttf", "-Regular",  "-Bold",     "-Italic",     "-BoldItalic"),
        ("/usr/share/fonts/truetype/ubuntu",      "Ubuntu",         ".ttf", "-Regular",  "-Bold",     "-Italic",     "-BoldItalic"),
        ("/Library/Fonts",                         "Arial",          ".ttf", "",          " Bold",     " Italic",     " Bold Italic"),
    ];
    for &(dir, name, ext, rs, bs, is, bis) in nix_sets {
        let d = Path::new(dir);
        if !d.exists() { continue; }
        let rp = d.join(format!("{}{}{}", name, rs, ext));
        if !rp.exists() { continue; }
        let Ok(regular) = FontData::load(&rp, None) else { continue };
        let regular_clone = regular.clone();
        let load_opt = move |suf: &str| {
            let p = d.join(format!("{}{}{}", name, suf, ext));
            if p.exists() { FontData::load(&p, None).unwrap_or_else(|_| regular_clone.clone()) }
            else { regular_clone.clone() }
        };
        return Ok(FontFamily {
            regular, bold: load_opt(bs), italic: load_opt(is), bold_italic: load_opt(bis),
        });
    }

    Err("No suitable TrueType font found on this system. \
         Install DejaVu or Liberation fonts (e.g. fonts-dejavu-core on Debian/Ubuntu).".into())
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE SIZE  (points)
// ═══════════════════════════════════════════════════════════════════════════════

fn page_size_pts(name: &str) -> Option<(f64, f64)> {
    match name {
        "a3"      => Some((841.89, 1190.55)),
        "a4"      => Some((595.28,  841.89)),
        "a5"      => Some((419.53,  595.28)),
        "letter"  => Some((612.00,  792.00)),
        "legal"   => Some((612.00, 1008.00)),
        "tabloid" => Some((792.00, 1224.00)),
        _         => None,
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHIC SCALE — three tiers: standard / compact / detailed
//   Mirrors the HTML's font-size cascade across layout modes
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Copy)]
struct Scale {
    cover_title:   u8, // Hero title on cover
    cover_sub:     u8, // Cover subtitle / kicker
    cover_meta:    u8, // Author · date · stats
    ch_label:      u8, // "CHAPTER N" eyebrow
    heading:       u8, // Chapter / quiz title
    subhead:       u8, // Chapter description
    body:          u8, // Question text
    option:        u8, // Option text
    expl:          u8, // Explanation
    answer_label:  u8, // "Answer:" label
    toc_entry:     u8, // TOC rows
    rule:          u8, // Decorative rule size
}

impl Scale {
    fn standard() -> Self {
        Self { cover_title: 44, cover_sub: 16, cover_meta: 12, ch_label: 11,
               heading: 22, subhead: 13, body: 16, option: 14, expl: 12,
               answer_label: 13, toc_entry: 13, rule: 7 }
    }
    fn compact() -> Self {
        Self { cover_title: 36, cover_sub: 13, cover_meta: 10, ch_label:  9,
               heading: 16, subhead: 11, body: 12, option: 11, expl: 10,
               answer_label: 10, toc_entry: 11, rule: 6 }
    }
    fn detailed() -> Self {
        Self { cover_title: 50, cover_sub: 18, cover_meta: 13, ch_label: 12,
               heading: 26, subhead: 15, body: 18, option: 16, expl: 14,
               answer_label: 14, toc_entry: 14, rule: 8 }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE DECORATORS
// ═══════════════════════════════════════════════════════════════════════════════

#[inline] fn sp(doc: &mut Document, n: usize) {
    for _ in 0..n { doc.push(Paragraph::new(" ")); }
}

/// ━━━━━━━━━━  thick gold rule — primary section separator
fn gold_rule(doc: &mut Document, sz: u8, short: bool) {
    let s = "━".repeat(if short { 42 } else { 56 });
    doc.push(Paragraph::new(s).aligned(Alignment::Center)
        .styled(Style::new().with_font_size(sz).with_color(ACCENT)));
}

/// ═══════════════════════  double rule — cover frame / section break
fn double_rule(doc: &mut Document, sz: u8) {
    doc.push(Paragraph::new("═".repeat(54)).aligned(Alignment::Center)
        .styled(Style::new().with_font_size(sz).with_color(ACCENT)));
}

/// ───────────────────  thin hairline rule — subtle divider
fn thin_rule(doc: &mut Document, sz: u8, color: Color) {
    doc.push(Paragraph::new("─".repeat(52)).aligned(Alignment::Center)
        .styled(Style::new().with_font_size(sz).with_color(color)));
}

/// ◆  ◆  ◆  — diamond accent mark (premium touch between major sections)
fn diamond_sep(doc: &mut Document) {
    doc.push(Paragraph::new("◆   ◆   ◆").aligned(Alignment::Center)
        .styled(Style::new().with_font_size(9).with_color(ACCENT)));
}

/// Single option row  ▶  B.  Option text  (or indented plain for wrong)
fn push_option(doc: &mut Document, letter: char, text: &str, correct: bool, sz: u8) {
    let (bullet, st) = if correct {
        ("  ▶  ", Style::new().with_font_size(sz).bold().with_color(CORRECT))
    } else {
        ("     ", Style::new().with_font_size(sz).with_color(Color::Rgb(30, 30, 30)))
    };
    doc.push(Paragraph::new(format!("{}{}.  {}", bullet, letter, text)).styled(st));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC DATA STRUCTURES  (same API as original — fully backward compatible)
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Clone)]
pub struct QuestionData {
    pub number:      usize,
    pub text:        String,
    pub options:     Vec<String>,
    pub correct:     usize,
    pub explanation: String,
}

#[derive(Clone)]
pub struct QuizData {
    pub title:       String,
    pub description: String,
    pub icon:        String,
    pub questions:   Vec<QuestionData>,
}

pub struct ExportConfig {
    pub quizzes:           Vec<QuizData>,
    // Cover
    pub title:             String,
    pub subtitle:          String,
    pub author:            String,
    pub date:              String,
    pub description:       String,
    pub icon:              String,
    pub include_cover:     bool,
    pub include_toc:       bool,
    // Style
    pub style_mode:        String, // standard | styled | compact | detailed | mcqnotes
    pub layout_mode:       String, // single | twocol
    pub page_size:         String,
    pub orientation:       String,
    pub numbering:         String, // global | perchapter
    pub answers:           String, // inline | endchapter | endbook | none
    pub show_explanations: bool,
}

impl ExportConfig {
    pub fn from_json(v: &Value) -> Result<Self, String> {
        let quizzes = v["quizzes"].as_array()
            .map(|arr| arr.iter().map(|q| {
                let questions = q["questions"].as_array()
                    .map(|qa| qa.iter().enumerate().map(|(i, qd)| QuestionData {
                        number:      i + 1,
                        text:        qd["question"].as_str().unwrap_or("").to_string(),
                        options:     qd["options"].as_array()
                            .map(|o| o.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                            .unwrap_or_default(),
                        correct:     qd["correct"].as_u64().unwrap_or(0) as usize,
                        explanation: qd["explanation"].as_str().unwrap_or("").to_string(),
                    }).collect())
                    .unwrap_or_default();
                QuizData {
                    title:       q["title"].as_str().unwrap_or("Untitled").to_string(),
                    description: q["description"].as_str().unwrap_or("").to_string(),
                    icon:        q["icon"].as_str().unwrap_or("").to_string(),
                    questions,
                }
            }).collect())
            .unwrap_or_default();

        let style = &v["style"];
        let cover = &v["cover"];
        Ok(ExportConfig {
            quizzes,
            title:             cover["title"].as_str().unwrap_or("Quiz Compilation").to_string(),
            subtitle:          cover["subtitle"].as_str().unwrap_or("").to_string(),
            author:            cover["author"].as_str().unwrap_or("").to_string(),
            date:              cover["date"].as_str().unwrap_or("").to_string(),
            description:       cover["description"].as_str().unwrap_or("").to_string(),
            icon:              cover["icon"].as_str().unwrap_or("").to_string(),
            include_cover:     cover["include"].as_bool().unwrap_or(true),
            include_toc:       v["toc"]["include"].as_bool().unwrap_or(true),
            style_mode:        style["mode"].as_str().unwrap_or("standard").to_string(),
            layout_mode:       style["layout"].as_str().unwrap_or("single").to_string(),
            page_size:         style["pageSize"].as_str().unwrap_or("a4").to_string(),
            orientation:       style["orientation"].as_str().unwrap_or("portrait").to_string(),
            numbering:         style["numbering"].as_str().unwrap_or("global").to_string(),
            answers:           style["answers"].as_str().unwrap_or("inline").to_string(),
            show_explanations: style["showExplanations"].as_bool().unwrap_or(true),
        })
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

pub fn generate_pdf(config: &ExportConfig) -> Result<Vec<u8>, String> {
    let font_family = load_font_family()?;
    let mut doc = Document::new(font_family);

    // Paper size + orientation
    let (pw, ph) = page_size_pts(&config.page_size).unwrap_or((595.28, 841.89));
    let is_landscape = config.orientation == "landscape";
    doc.set_paper_size(if is_landscape { Size::new(ph, pw) } else { Size::new(pw, ph) });
    doc.set_title(&config.title);

    // Scale
    let sc = match config.style_mode.as_str() {
        "compact"  => Scale::compact(),
        "detailed" => Scale::detailed(),
        _          => Scale::standard(),
    };

    // ── Page decorator — mirrors @page { @top-left, @top-right, @bottom-center }
    let mut decorator = SimplePageDecorator::new();
    decorator.set_margins(Margins::trbl(28.0, 20.0, 30.0, 20.0));
    let hdr_title = config.title.clone();
    decorator.set_header(move |page_num| {
        // "TITLE  ✦  N"   — matches HTML's gold @top-left + ✦ @top-right
        Paragraph::new(format!("{}  ✦  {}", hdr_title.to_uppercase(), page_num))
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(8).bold().with_color(ACCENT))
    });
    doc.set_page_decorator(decorator);

    let total_q: usize = config.quizzes.iter().map(|q| q.questions.len()).sum();
    let multi    = config.quizzes.len() > 1;
    let is_twocol   = config.layout_mode == "twocol";
    let is_mcqnotes = config.style_mode  == "mcqnotes";

    // ── Cover ────────────────────────────────────────────────────────────────
    if config.include_cover {
        render_cover(&mut doc, config, total_q, &sc)?;
    }

    // ── TOC ──────────────────────────────────────────────────────────────────
    if config.include_toc && multi {
        doc.push(PageBreak::new());
        render_toc(&mut doc, config, &sc)?;
    }

    // ── Chapters ─────────────────────────────────────────────────────────────
    let mut global_qnum: usize = 0;
    // Accumulates (qnum, "B. Answer text", "Explanation…") across chapters
    let mut all_answers: Vec<(usize, String, String)> = Vec::new();

    for (ci, quiz) in config.quizzes.iter().enumerate() {
        // Page break before every chapter (except the very first when there's no cover/toc)
        if ci > 0
            || config.include_cover
            || (config.include_toc && multi)
        {
            doc.push(PageBreak::new());
        }

        // Header
        if multi {
            render_chapter_header(&mut doc, ci + 1, quiz, &sc)?;
        } else {
            render_single_header(&mut doc, quiz, &sc)?;
        }

        // Questions
        let chapter_answers = if is_mcqnotes {
            render_questions_mcqnotes(&mut doc, config, quiz, &mut global_qnum, &sc)?
        } else if is_twocol {
            render_questions_twocol(&mut doc, config, quiz, &mut global_qnum, &sc)?
        } else {
            render_questions_single(&mut doc, config, quiz, &mut global_qnum, &sc)?
        };

        // End-of-chapter answer key
        if config.answers == "endchapter" && !chapter_answers.is_empty() {
            render_answer_key_chapter(&mut doc, &chapter_answers, ci + 1,
                                      config.show_explanations, &sc)?;
        }

        all_answers.extend(chapter_answers);
    }

    // ── End-of-book answer key ───────────────────────────────────────────────
    if config.answers == "endbook" && !all_answers.is_empty() {
        doc.push(PageBreak::new());
        render_answer_key_endbook(&mut doc, &all_answers, config.show_explanations, &sc)?;
    }

    // ── Render ───────────────────────────────────────────────────────────────
    let mut out: Vec<u8> = Vec::new();
    doc.render(&mut out).map_err(|e| format!("PDF render failed: {e}"))?;
    Ok(out)
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER PAGE
//   Visual hierarchy: double-rule frame → kicker → icon → title → subtitle
//   → gold divider → description → meta → stats → double-rule frame
//   Mirrors html: cover-accent-bar, cover-kicker, cover-title, cover-stats
// ═══════════════════════════════════════════════════════════════════════════════

fn render_cover(doc: &mut Document, cfg: &ExportConfig, total_q: usize, sc: &Scale)
    -> Result<(), String>
{
    // Vertical centering via leading whitespace
    sp(doc, 8);

    // ╔══════════════════════════════════════════════════════╗
    double_rule(doc, sc.rule + 3);
    sp(doc, 1);

    // Kicker badge  ◆  QUIZ COMPILATION  ◆
    // mirrors html .cover-kicker: uppercase, letter-spacing, gold border pill
    doc.push(
        Paragraph::new(
            if cfg.quizzes.len() > 1 { "◆   QUIZ COMPILATION   ◆" }
            else                      { "◆   ASSESSMENT   ◆"      }
        )
        .aligned(Alignment::Center)
        .styled(Style::new().with_font_size(sc.ch_label).bold().with_color(ACCENT)),
    );
    sp(doc, 1);

    // Icon (emoji / text symbol)
    if !cfg.icon.is_empty() && cfg.icon != "?" {
        doc.push(
            Paragraph::new(&cfg.icon)
                .aligned(Alignment::Center)
                .styled(Style::new().with_font_size(52)),
        );
        sp(doc, 1);
    }

    // Hero title — matches html .cover-title (DM Serif, large)
    doc.push(
        Paragraph::new(&cfg.title)
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(sc.cover_title).bold()),
    );

    // Subtitle — matches html .cover-subtitle (uppercase, muted)
    if !cfg.subtitle.is_empty() {
        sp(doc, 1);
        doc.push(
            Paragraph::new(cfg.subtitle.to_uppercase())
                .aligned(Alignment::Center)
                .styled(Style::new().with_font_size(sc.cover_sub).italic().with_color(MUTED)),
        );
    }

    // Gold divider line — mirrors html .cover-divider
    sp(doc, 2);
    gold_rule(doc, sc.rule, false);
    sp(doc, 1);

    // Description
    if !cfg.description.is_empty() {
        doc.push(
            Paragraph::new(&cfg.description)
                .aligned(Alignment::Center)
                .styled(Style::new().with_font_size(sc.cover_meta + 1).italic().with_color(MUTED)),
        );
        sp(doc, 1);
    }

    // Author · Date — mirrors html .cover-meta
    {
        let mut parts: Vec<String> = Vec::new();
        if !cfg.author.is_empty() { parts.push(cfg.author.clone()); }
        if !cfg.date.is_empty()   { parts.push(cfg.date.clone()); }
        if !parts.is_empty() {
            doc.push(
                Paragraph::new(parts.join("  ·  "))
                    .aligned(Alignment::Center)
                    .styled(Style::new().with_font_size(sc.cover_meta).with_color(MUTED)),
            );
        }
    }

    sp(doc, 1);
    thin_rule(doc, sc.rule, DIM);
    diamond_sep(doc);

    // Stats strip — mirrors html .cover-stats
    let qc_word = if cfg.quizzes.len() == 1 { "quiz" } else { "quizzes" };
    let q_word  = if total_q == 1 { "question" } else { "questions" };
    doc.push(
        Paragraph::new(
            format!("{}  {}   ◆   {}  {}", cfg.quizzes.len(), qc_word, total_q, q_word)
        )
        .aligned(Alignment::Center)
        .styled(Style::new().with_font_size(sc.cover_meta + 2).bold().with_color(ACCENT)),
    );

    // Bottom frame
    sp(doc, 5);
    double_rule(doc, sc.rule + 3);

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
//   mirrors html .toc-page, .toc-item, .toc-leader (dot leaders)
// ═══════════════════════════════════════════════════════════════════════════════

fn render_toc(doc: &mut Document, cfg: &ExportConfig, sc: &Scale) -> Result<(), String> {
    // Header — mirrors html toc-page h2
    doc.push(
        Paragraph::new("CONTENTS")
            .styled(Style::new().with_font_size(sc.heading + 4).bold()),
    );
    gold_rule(doc, sc.rule, true);
    sp(doc, 2);

    for (i, quiz) in cfg.quizzes.iter().enumerate() {
        let num    = i + 1;
        let icon   = if quiz.icon.is_empty() { String::new() } else { format!("{}  ", &quiz.icon) };
        let title  = if quiz.title.is_empty() { "Untitled" } else { quiz.title.as_str() };
        let qc     = quiz.questions.len();
        let q_word = if qc == 1 { "Q" } else { "Qs" };

        // Left portion (number + title)
        let left  = format!("{}.   {}{}", num, icon, title);
        // Right portion (question count)
        let right = format!("{}  {}", qc, q_word);

        // Dot leader: fill with "·" to roughly align right portion
        // (genpdf has no tab-stop; we approximate with middle dots)
        let dots_len = 54usize.saturating_sub(left.chars().count() + right.chars().count() + 4);
        let dots = "·".repeat(dots_len.max(4));

        // Num in gold — chapter number
        doc.push(
            Paragraph::new(format!("{}  {}  {}", left, dots, right))
                .styled(Style::new().with_font_size(sc.toc_entry)),
        );

        // Optional sub-description
        if !quiz.description.is_empty() {
            doc.push(
                Paragraph::new(format!("       {}", &quiz.description))
                    .styled(Style::new().with_font_size(sc.toc_entry - 1).italic().with_color(MUTED)),
            );
        }
        sp(doc, 1);
    }

    sp(doc, 1);
    thin_rule(doc, sc.rule, DIM);
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAPTER HEADER  (multi-quiz mode)
//   mirrors html .chapter-page: dark bg, gold top stripe, eyebrow + title
// ═══════════════════════════════════════════════════════════════════════════════

fn render_chapter_header(doc: &mut Document, num: usize, quiz: &QuizData, sc: &Scale)
    -> Result<(), String>
{
    // Full-width gold rule as "top stripe" (mirrors ::before gradient)
    gold_rule(doc, sc.rule + 1, false);
    sp(doc, 1);

    // Eyebrow — "CHAPTER  N" (mirrors .chapter-number)
    doc.push(
        Paragraph::new(format!("CHAPTER   {}", num))
            .styled(Style::new().with_font_size(sc.ch_label).bold().with_color(ACCENT)),
    );

    // Title line — optionally prefixed with icon
    let title_line = if quiz.icon.is_empty() {
        quiz.title.clone()
    } else {
        format!("{}   {}", quiz.icon, quiz.title)
    };
    doc.push(
        Paragraph::new(title_line)
            .styled(Style::new().with_font_size(sc.heading).bold()),
    );

    // Description — mirrors .chapter-desc
    if !quiz.description.is_empty() {
        doc.push(
            Paragraph::new(&quiz.description)
                .styled(Style::new().with_font_size(sc.subhead).italic().with_color(MUTED)),
        );
    }

    sp(doc, 1);
    thin_rule(doc, sc.rule, DIM);
    sp(doc, 1);
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE QUIZ HEADER  (single-quiz mode)
//   mirrors html .quiz-header: centred, dark bg, gold stripe, icon + h1
// ═══════════════════════════════════════════════════════════════════════════════

fn render_single_header(doc: &mut Document, quiz: &QuizData, sc: &Scale) -> Result<(), String> {
    double_rule(doc, sc.rule + 2);
    sp(doc, 1);

    // Icon
    if !quiz.icon.is_empty() {
        doc.push(
            Paragraph::new(&quiz.icon)
                .aligned(Alignment::Center)
                .styled(Style::new().with_font_size(36)),
        );
        sp(doc, 1);
    }

    // Title
    doc.push(
        Paragraph::new(&quiz.title)
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(sc.heading).bold()),
    );

    // Description
    if !quiz.description.is_empty() {
        sp(doc, 1);
        doc.push(
            Paragraph::new(&quiz.description)
                .aligned(Alignment::Center)
                .styled(Style::new().with_font_size(sc.subhead).italic().with_color(MUTED)),
        );
    }

    sp(doc, 1);
    gold_rule(doc, sc.rule, false);
    sp(doc, 1);
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE-COLUMN QUESTIONS
//   style_mode drives presentation:
//     standard  — clean numbered questions
//     styled    — gold Q-badge header + thin rule per item  (html .styled-output)
//     detailed  — same as styled but larger scale + always shows explanation
//     mcqnotes  — handled separately (see render_questions_mcqnotes)
//     compact   — standard but small scale (Scale::compact handles sizing)
//
//  Returns a Vec of (global_qnum, "B. Answer text", "Explanation…") for answer keys
// ═══════════════════════════════════════════════════════════════════════════════

fn render_questions_single(
    doc:         &mut Document,
    cfg:         &ExportConfig,
    quiz:        &QuizData,
    global_qnum: &mut usize,
    sc:          &Scale,
) -> Result<Vec<(usize, String, String)>, String> {
    let answers   = cfg.answers.as_str();
    let show_expl = cfg.show_explanations;
    // styled and detailed get a more ornate per-question layout
    let is_ornate = matches!(cfg.style_mode.as_str(), "styled" | "detailed");
    let mut chapter_ans: Vec<(usize, String, String)> = Vec::new();

    for q in &quiz.questions {
        *global_qnum += 1;
        // numbering: "global" counts continuously across all chapters;
        // "perchapter" (or any other value) resets to 1 at each chapter
        let qnum = if cfg.numbering == "global" { *global_qnum } else { q.number };

        let ans_letter = if q.correct < LETTERS.len() { LETTERS[q.correct] as char } else { '?' };
        let ans_text   = q.options.get(q.correct).cloned().unwrap_or_default();
        chapter_ans.push((qnum, format!("{}. {}", ans_letter, ans_text), q.explanation.clone()));

        // ── Question header ────────────────────────────────────────────────
        if is_ornate {
            // Gold badge: "Q.14 ──────────────────────────────────────────"
            let dashes = "─".repeat(48usize.saturating_sub(6));
            doc.push(
                Paragraph::new(format!("Q.{:02} {}", qnum, dashes))
                    .styled(Style::new().with_font_size(sc.rule + 1).bold().with_color(ACCENT)),
            );
            doc.push(
                Paragraph::new(format!("   {}", q.text))
                    .styled(Style::new().with_font_size(sc.body).bold()),
            );
        } else {
            // Standard: "14.  Question text"
            doc.push(
                Paragraph::new(format!("{}.   {}", qnum, q.text))
                    .styled(Style::new().with_font_size(sc.body).bold()),
            );
        }

        // ── Options ────────────────────────────────────────────────────────
        if !q.options.is_empty() && answers != "none" {
            for (oi, opt) in q.options.iter().enumerate() {
                let letter = if oi < LETTERS.len() { LETTERS[oi] as char } else { '?' };
                let mark_correct = oi == q.correct && answers == "inline";
                push_option(doc, letter, opt, mark_correct, sc.option);
            }
        }

        // ── Inline answer + explanation ────────────────────────────────────
        if answers == "inline" {
            sp(doc, 1);
            if is_ornate {
                // Premium bordered answer block
                doc.push(
                    Paragraph::new(format!("  ✓   {}. {}", ans_letter, ans_text))
                        .styled(Style::new().with_font_size(sc.answer_label).bold().with_color(CORRECT)),
                );
            } else {
                doc.push(
                    Paragraph::new(format!("Answer:   {}. {}", ans_letter, ans_text))
                        .styled(Style::new().with_font_size(sc.answer_label).bold().with_color(CORRECT)),
                );
            }
            // Explanation
            if !q.explanation.is_empty() && show_expl {
                doc.push(
                    Paragraph::new(format!("   {}", q.explanation))
                        .styled(Style::new().with_font_size(sc.expl).italic().with_color(MUTED)),
                );
            }
        }

        // Ornate mode: thin hairline after each item (mirrors .styled-output border)
        if is_ornate {
            sp(doc, 1);
            thin_rule(doc, sc.rule - 1, DIM);
        }
        sp(doc, 2);
    }

    Ok(chapter_ans)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCQ NOTES MODE — ultra-compact: question + answer bullet only
//   mirrors html .mcq-notes-layout .compact-answer
// ═══════════════════════════════════════════════════════════════════════════════

fn render_questions_mcqnotes(
    doc:         &mut Document,
    cfg:         &ExportConfig,
    quiz:        &QuizData,
    global_qnum: &mut usize,
    sc:          &Scale,
) -> Result<Vec<(usize, String, String)>, String> {
    let mut chapter_ans: Vec<(usize, String, String)> = Vec::new();

    for q in &quiz.questions {
        *global_qnum += 1;
        let qnum = if cfg.numbering == "global" { *global_qnum } else { q.number };
        let ans_letter = if q.correct < LETTERS.len() { LETTERS[q.correct] as char } else { '?' };
        let ans_text   = q.options.get(q.correct).cloned().unwrap_or_default();
        chapter_ans.push((qnum, format!("{}. {}", ans_letter, ans_text), q.explanation.clone()));

        // Question text
        doc.push(
            Paragraph::new(format!("{}.   {}", qnum, q.text))
                .styled(Style::new().with_font_size(sc.body).bold()),
        );
        // Compact answer line — indented, green
        doc.push(
            Paragraph::new(format!("   ▶   {}. {}", ans_letter, ans_text))
                .styled(Style::new().with_font_size(sc.option).with_color(CORRECT)),
        );
        // Tiny explanation if requested
        if !q.explanation.is_empty() && cfg.show_explanations {
            doc.push(
                Paragraph::new(format!("      {}", q.explanation))
                    .styled(Style::new().with_font_size(sc.expl).italic().with_color(MUTED)),
            );
        }
        sp(doc, 1);
    }

    Ok(chapter_ans)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TWO-COLUMN TEXTBOOK LAYOUT
//   mirrors html .textbook-layout { column-count: 2 }
//   Uses genpdf TableLayout with equal columns; cells contain preformatted text
// ═══════════════════════════════════════════════════════════════════════════════

fn render_questions_twocol(
    doc:         &mut Document,
    cfg:         &ExportConfig,
    quiz:        &QuizData,
    global_qnum: &mut usize,
    sc:          &Scale,
) -> Result<Vec<(usize, String, String)>, String> {
    let mut chapter_ans: Vec<(usize, String, String)> = Vec::new();
    let mut table = TableLayout::new(vec![1, 1]);
    let mut i = 0;

    while i < quiz.questions.len() {
        let lq = &quiz.questions[i];

        *global_qnum += 1;
        let qnum_l = if cfg.numbering == "global" { *global_qnum } else { lq.number };
        let (l_text, l_ans, l_expl) = build_col_cell(lq, qnum_l, cfg);
        chapter_ans.push((qnum_l, l_ans, l_expl));

        let (r_text, r_ans, r_expl) = if i + 1 < quiz.questions.len() {
            let rq = &quiz.questions[i + 1];
            *global_qnum += 1;
            let qnum_r = if cfg.numbering == "global" { *global_qnum } else { rq.number };
            let cell = build_col_cell(rq, qnum_r, cfg);
            chapter_ans.push((qnum_r, cell.1.clone(), cell.2.clone()));
            cell
        } else {
            (String::new(), String::new(), String::new())
        };

        let _ = (r_ans, r_expl); // consumed into chapter_ans above

        let mut row = table.row();
        row.push_element(Paragraph::new(l_text).styled(Style::new().with_font_size(sc.body)));
        row.push_element(Paragraph::new(r_text).styled(Style::new().with_font_size(sc.body)));
        row.push().map_err(|e| format!("Table row error: {e}"))?;

        i += 2;
    }

    doc.push(table);
    Ok(chapter_ans)
}

/// Build a single two-column cell: question + options [+ inline answer]
fn build_col_cell(q: &QuestionData, qnum: usize, cfg: &ExportConfig) -> (String, String, String) {
    let mut buf = format!("{}.   {}", qnum, q.text);
    for (oi, opt) in q.options.iter().enumerate() {
        let letter = if oi < LETTERS.len() { LETTERS[oi] as char } else { '?' };
        let marker = if oi == q.correct && cfg.answers == "inline" { " ✓" } else { "" };
        buf.push_str(&format!("\n     {}.  {}{}", letter, opt, marker));
    }
    let ans_letter = if q.correct < LETTERS.len() { LETTERS[q.correct] as char } else { '?' };
    let ans_text   = q.options.get(q.correct).cloned().unwrap_or_default();
    if cfg.answers == "inline" {
        buf.push_str(&format!("\n\n  ✓  {}. {}", ans_letter, ans_text));
        if !q.explanation.is_empty() && cfg.show_explanations {
            buf.push_str(&format!("\n   {}", q.explanation));
        }
    }
    (buf, format!("{}. {}", ans_letter, ans_text), q.explanation.clone())
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANSWER KEY — END OF CHAPTER
//   mirrors html .end-chapter-answers + .answer-entry
// ═══════════════════════════════════════════════════════════════════════════════

fn render_answer_key_chapter(
    doc:          &mut Document,
    answers:      &[(usize, String, String)],
    chapter_num:  usize,
    show_expl:    bool,
    sc:           &Scale,
) -> Result<(), String> {
    doc.push(PageBreak::new());

    // Header
    doc.push(
        Paragraph::new(format!("ANSWER KEY  —  CHAPTER {}", chapter_num))
            .styled(Style::new().with_font_size(sc.heading).bold().with_color(ACCENT)),
    );
    gold_rule(doc, sc.rule, true);
    sp(doc, 2);

    render_answer_rows(doc, answers, show_expl, sc);
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANSWER KEY — END OF BOOK
//   mirrors html .end-book-answers
// ═══════════════════════════════════════════════════════════════════════════════

fn render_answer_key_endbook(
    doc:       &mut Document,
    answers:   &[(usize, String, String)],
    show_expl: bool,
    sc:        &Scale,
) -> Result<(), String> {
    double_rule(doc, sc.rule + 2);
    sp(doc, 1);
    doc.push(
        Paragraph::new("COMPLETE ANSWER KEY")
            .aligned(Alignment::Center)
            .styled(Style::new().with_font_size(sc.heading + 2).bold().with_color(ACCENT)),
    );
    sp(doc, 1);
    gold_rule(doc, sc.rule, false);
    sp(doc, 2);

    // Group into chunks of 3 columns via a table for readability
    // (end-book answers are often 50–200 items; compact table works well)
    let cols = 3usize;
    let mut table = TableLayout::new(vec![1, 1, 1]);
    let mut batch: Vec<String> = Vec::new();

    for (num, ans, expl) in answers {
        let cell = if !expl.is_empty() && show_expl {
            format!("{:>3}.  {}\n     {}", num, ans, expl)
        } else {
            format!("{:>3}.  {}", num, ans)
        };
        batch.push(cell);

        if batch.len() == cols {
            let mut row = table.row();
            for cell in &batch {
                row.push_element(
                    Paragraph::new(cell)
                        .styled(Style::new().with_font_size(sc.expl).with_color(CORRECT)),
                );
            }
            row.push().map_err(|e| format!("Table row error: {e}"))?;
            batch.clear();
        }
    }

    // Flush remainder
    if !batch.is_empty() {
        while batch.len() < cols { batch.push(String::new()); }
        let mut row = table.row();
        for cell in &batch {
            row.push_element(
                Paragraph::new(cell)
                    .styled(Style::new().with_font_size(sc.expl).with_color(CORRECT)),
            );
        }
        row.push().map_err(|e| format!("Table row error: {e}"))?;
    }

    doc.push(table);
    Ok(())
}

/// Shared answer row renderer used by both chapter + book answer keys
fn render_answer_rows(
    doc:       &mut Document,
    answers:   &[(usize, String, String)],
    show_expl: bool,
    sc:        &Scale,
) {
    for (num, ans, expl) in answers {
        // "  14.  B. Myocardial infarction"   — right-pad num so rows line up
        doc.push(
            Paragraph::new(format!("  {:>3}.   {}", num, ans))
                .styled(Style::new().with_font_size(sc.answer_label).bold().with_color(CORRECT)),
        );
        if !expl.is_empty() && show_expl {
            doc.push(
                Paragraph::new(format!("         {}", expl))
                    .styled(Style::new().with_font_size(sc.expl).italic().with_color(MUTED)),
            );
        }
    }
}
