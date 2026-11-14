// Layer Mixer as a desktop window: the same HTML file, without the browser around it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{webview::DownloadEvent, AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, Window};
use tauri_plugin_dialog::DialogExt;

// Runs before the page. No browser context menu (except in text fields), no reload or print.
// Save as and Load use the Windows dialog, starting in Documents\Layer Mixer\Saves, instead of
// the browser's file picker (which can't be pointed at a folder). The page itself is unchanged:
// it calls showSaveFilePicker / showOpenFilePicker as in Chrome and gets these instead.
const DESKTOP: &str = r#"
document.addEventListener("contextmenu", e => {
  if (!e.target.closest("input, textarea, [contenteditable]")) e.preventDefault();
}, true);
document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (k === "f5" || (mod && (k === "r" || k === "p"))) e.preventDefault();
}, true);
(() => {
  const call = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);
  const aborted = () => new DOMException("No file chosen.", "AbortError");
  const handle = (f, text) => ({
    kind: "file", name: f.name,
    queryPermission: async () => "granted", requestPermission: async () => "granted",
    createWritable: async () => { let buf = "";
      return { write: async t => { buf += typeof t === "string" ? t : await new Blob([t]).text(); },
               close: () => call("write_file", { id: f.id, text: buf }), abort: async () => {} }; },
    getFile: async () => new File([text ?? ""], f.name, { type: "application/json" })
  });
  const def = (k, v) => Object.defineProperty(window, k, { value: v, configurable: true, writable: true });
  def("showSaveFilePicker", async (o = {}) => { const f = await call("pick_save", { name: o.suggestedName || "layer-mixer.json" }); if (!f) throw aborted(); return handle(f); });
  def("showOpenFilePicker", async () => { const f = await call("pick_open", {}); if (!f) throw aborted(); return [handle(f, f.text)]; });
  def("FileSystemFileHandle", class FileSystemFileHandle {});   // a file remembered by the browser picker is not reused
  // PDFs go to Documents\Layer Mixer\PDF (see on_download); the page's own message says "downloads"
  const OLD = "PDF saved to your downloads.", NEW = "PDF saved to Documents \u203a Layer Mixer \u203a PDF.";
  new MutationObserver(ms => { for (const m of ms) { const t = m.target.nodeType === 3 ? m.target.parentNode : m.target;
      if (t && t.textContent === OLD) t.textContent = NEW; } })
    .observe(document, { subtree: true, childList: true, characterData: true });
})();
"#;

const MAX_FILE: u64 = 5_000_000;

// Files the user picked in a dialog. The page only gets a number for each, never a path to write to.
#[derive(Default)]
struct Files(Mutex<(u32, HashMap<u32, PathBuf>)>);

#[derive(Serialize)]
struct Picked { id: u32, name: String, text: Option<String> }

fn keep(files: &Files, path: PathBuf, text: Option<String>) -> Picked {
    let mut g = files.0.lock().unwrap();
    g.0 += 1;
    let id = g.0;
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    g.1.insert(id, path);
    Picked { id, name, text }
}

// Documents\Layer Mixer\Saves, made on first use
fn saves_dir(app: &AppHandle) -> Option<PathBuf> {
    let d = app.path().document_dir().ok()?.join("Layer Mixer").join("Saves");
    std::fs::create_dir_all(&d).ok()?;
    Some(d)
}

// Documents\Layer Mixer\PDF, and a free file name in it: "Name.pdf", "Name (2).pdf" …
fn pdf_path(app: &AppHandle, suggested: &std::path::Path) -> Option<PathBuf> {
    let d = app.path().document_dir().ok()?.join("Layer Mixer").join("PDF");
    std::fs::create_dir_all(&d).ok()?;
    let stem = suggested.file_stem()?.to_string_lossy().into_owned();
    let mut p = d.join(format!("{stem}.pdf"));
    let mut n = 2;
    while p.exists() { p = d.join(format!("{stem} ({n}).pdf")); n += 1; }
    Some(p)
}

#[tauri::command]
async fn pick_save(app: AppHandle, window: Window, files: State<'_, Files>, name: String) -> Result<Option<Picked>, String> {
    let mut d = app.dialog().file().set_parent(&window).set_file_name(&name).add_filter("Layer Mixer file", &["json"]);
    if let Some(dir) = saves_dir(&app) { d = d.set_directory(dir); }
    let Some(fp) = d.blocking_save_file() else { return Ok(None) };
    let mut path = fp.into_path().map_err(|e| e.to_string())?;
    if path.extension().is_none() { path.set_extension("json"); }
    Ok(Some(keep(&files, path, None)))
}

#[tauri::command]
async fn pick_open(app: AppHandle, window: Window, files: State<'_, Files>) -> Result<Option<Picked>, String> {
    let mut d = app.dialog().file().set_parent(&window).add_filter("Layer Mixer file", &["json"]);
    if let Some(dir) = saves_dir(&app) { d = d.set_directory(dir); }
    let Some(fp) = d.blocking_pick_file() else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > MAX_FILE { return Err("file too large".into()); }
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(Some(keep(&files, path, Some(text))))
}

#[tauri::command]
fn write_file(files: State<'_, Files>, id: u32, text: String) -> Result<(), String> {
    let path = files.0.lock().unwrap().1.get(&id).cloned().ok_or("unknown file")?;
    std::fs::write(path, text).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Files::default())
        .invoke_handler(tauri::generate_handler![pick_save, pick_open, write_file])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Layer Mixer")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 680.0)
                .center()
                .disable_drag_drop_handler() // the layer list uses HTML drag and drop
                .initialization_script(DESKTOP)
                .on_download(|webview, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        let pdf = destination.extension().is_some_and(|e| e.eq_ignore_ascii_case("pdf"));
                        if pdf { if let Some(p) = pdf_path(webview.app_handle(), destination) { *destination = p; } }
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Layer Mixer");
}
