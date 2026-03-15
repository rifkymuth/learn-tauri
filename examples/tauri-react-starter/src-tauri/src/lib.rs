use std::sync::Mutex;
use tauri::State;

// Application state managed by Tauri
struct AppState {
    counter: Mutex<i32>,
}

// A simple greet command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Tauri + React.", name)
}

// Get the current counter value
#[tauri::command]
fn get_count(state: State<AppState>) -> i32 {
    *state.counter.lock().unwrap()
}

// Increment and return the new counter value
#[tauri::command]
fn increment(state: State<AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter += 1;
    *counter
}

// Decrement and return the new counter value
#[tauri::command]
fn decrement(state: State<AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter -= 1;
    *counter
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            counter: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_count,
            increment,
            decrement,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
