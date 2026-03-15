# Module 07: Database and Persistent Storage

In this module you will learn how to persist data in Tauri desktop applications. We cover every layer of the storage stack, from simple key-value stores to full SQLite databases, with practical patterns for settings, user data, and structured records.

**Prerequisites**: Modules 01-04 (Rust fundamentals, Tauri basics, React integration, commands and state).

**Estimated Time**: 3-4 hours

---

## Table of Contents

1. [Storage Options Overview](#1-storage-options-overview)
2. [Tauri Plugin Store](#2-tauri-plugin-store)
3. [SQLite with tauri-plugin-sql](#3-sqlite-with-tauri-plugin-sql)
4. [SQLite from Rust](#4-sqlite-from-rust)
5. [Database Design Patterns](#5-database-design-patterns)
6. [Data Serialization](#6-data-serialization)
7. [Migration Strategies](#7-migration-strategies)
8. [Backup and Export](#8-backup-and-export)
9. [Coding Challenges](#9-coding-challenges)

---

## 1. Storage Options Overview

Desktop applications need to persist data across sessions. Unlike web apps, you have full access to the local filesystem, so you have more options, but choosing the right one matters.

### Decision Matrix

| Storage Method | Best For | Max Size | Structure | Access From |
|---|---|---|---|---|
| `localStorage` / `sessionStorage` | Tiny UI state (scroll position, collapsed panels) | ~5-10 MB | Key-value strings | Frontend only |
| `tauri-plugin-store` | App settings, user preferences, small config | Tens of MB | Key-value (JSON) | Frontend + Rust |
| SQLite (`tauri-plugin-sql`) | Structured records, queries, relations | Hundreds of GB | Relational tables | Frontend (SQL strings) |
| SQLite (Rust-side, `rusqlite`/`sqlx`) | Same as above, with type safety and complex logic | Hundreds of GB | Relational tables | Rust commands |
| File-based (JSON/TOML/YAML) | Documents, project files, export formats | Filesystem limit | Custom | Rust commands |

### When to Use What

**Use `localStorage`** when the data is purely cosmetic UI state that can be lost without consequence. It lives inside the webview and the Rust backend cannot access it.

**Use `tauri-plugin-store`** when you need a persistent, JSON-backed key-value file that both the frontend and backend can read and write. Think user preferences, recent files lists, window position memory, theme choices.

**Use SQLite** when your data has relationships, you need to query or filter it, or it could grow to thousands of records. Contact lists, notes, inventory, time-tracking entries, chat history.

**Use file-based storage** when each "document" is a discrete unit the user might want to open, save, or share. Think project files, exported reports, or configuration profiles.

> **Rule of thumb**: Start with `tauri-plugin-store` for settings. Move to SQLite the moment you need to query, filter, or join data. Never use `localStorage` for anything the user would be upset to lose.

---

## 2. Tauri Plugin Store

`tauri-plugin-store` provides a reactive, JSON-backed key-value store. Each store is a single JSON file on disk, and changes can be watched from both the frontend and Rust.

### Setup

Add the plugin to your project:

```bash
# Add the Rust dependency
cargo add tauri-plugin-store

# Add the frontend bindings
npm install @tauri-apps/plugin-store
```

Add the plugin capability in `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "store:default"
  ]
}
```

Register the plugin in `src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend Usage (React/TypeScript)

```typescript
// src/stores/settingsStore.ts
import { load } from "@tauri-apps/plugin-store";

// Each store is backed by a JSON file in the app's data directory.
// The file is created automatically on first write.

export interface AppSettings {
  theme: "light" | "dark" | "system";
  fontSize: number;
  recentFiles: string[];
  windowBounds: { x: number; y: number; width: number; height: number } | null;
}

const DEFAULTS: AppSettings = {
  theme: "system",
  fontSize: 14,
  recentFiles: [],
  windowBounds: null,
};

// Load (or create) the store. The filename is relative to the app data dir.
// load() returns a Store instance that reads/writes the JSON file.
export async function getSettingsStore() {
  return await load("settings.json", { autoSave: true });
}

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const store = await getSettingsStore();
  const value = await store.get<AppSettings[K]>(key);
  return value ?? DEFAULTS[key];
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const store = await getSettingsStore();
  await store.set(key, value);
  // With autoSave: true, this writes to disk automatically.
  // Without autoSave, you would call: await store.save();
}
```

Using the store in a React component:

```tsx
// src/components/SettingsPanel.tsx
import { useEffect, useState } from "react";
import { load } from "@tauri-apps/plugin-store";

type Theme = "light" | "dark" | "system";

export function SettingsPanel() {
  const [theme, setTheme] = useState<Theme>("system");
  const [fontSize, setFontSize] = useState(14);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function init() {
      const store = await load("settings.json", { autoSave: true });

      // Read initial values
      setTheme((await store.get<Theme>("theme")) ?? "system");
      setFontSize((await store.get<number>("fontSize")) ?? 14);

      // Watch for changes (e.g., from another window or from Rust)
      unlisten = await store.onChange((key: string, value: unknown) => {
        if (key === "theme") setTheme(value as Theme);
        if (key === "fontSize") setFontSize(value as number);
      });
    }

    init();

    return () => {
      unlisten?.();
    };
  }, []);

  async function handleThemeChange(newTheme: Theme) {
    const store = await load("settings.json", { autoSave: true });
    await store.set("theme", newTheme);
    setTheme(newTheme);
  }

  async function handleFontSizeChange(size: number) {
    const store = await load("settings.json", { autoSave: true });
    await store.set("fontSize", size);
    setFontSize(size);
  }

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      <label>
        Theme:
        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value as Theme)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>

      <label>
        Font Size: {fontSize}px
        <input
          type="range"
          min={10}
          max={24}
          value={fontSize}
          onChange={(e) => handleFontSizeChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
```

### Rust-side Access

You can read and write the same store from Rust commands:

```rust
// src-tauri/src/commands/settings.rs
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde_json::json;

#[tauri::command]
pub async fn get_setting(app: AppHandle, key: String) -> Result<serde_json::Value, String> {
    let store = app
        .store("settings.json")
        .map_err(|e| e.to_string())?;

    Ok(store.get(&key).unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
pub async fn set_setting(
    app: AppHandle,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let store = app
        .store("settings.json")
        .map_err(|e| e.to_string())?;

    store.set(key, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Example: add a file to the recent files list, keeping only the last 10.
#[tauri::command]
pub async fn add_recent_file(app: AppHandle, path: String) -> Result<(), String> {
    let store = app
        .store("settings.json")
        .map_err(|e| e.to_string())?;

    let mut recent: Vec<String> = store
        .get("recentFiles")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // Remove duplicates, then prepend
    recent.retain(|p| p != &path);
    recent.insert(0, path);
    recent.truncate(10);

    store.set("recentFiles", json!(recent));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
```

### Store File Location

The JSON file is stored in the app's data directory, which varies by platform:

| Platform | Path |
|---|---|
| Linux | `~/.local/share/<bundle-id>/settings.json` |
| macOS | `~/Library/Application Support/<bundle-id>/settings.json` |
| Windows | `C:\Users\<User>\AppData\Roaming\<bundle-id>\settings.json` |

---

## 3. SQLite with tauri-plugin-sql

`tauri-plugin-sql` gives your frontend direct access to SQLite (and optionally MySQL/PostgreSQL) through a simple JavaScript API. This is the fastest path to structured data storage.

### Setup

```bash
# Add the Rust dependency with the sqlite feature
cargo add tauri-plugin-sql --features sqlite

# Add the frontend bindings
npm install @tauri-apps/plugin-sql
```

Add to your capabilities in `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select"
  ]
}
```

Register the plugin and set up migrations in `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_contacts_table",
            sql: "CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_contacts_favorite_column",
            sql: "ALTER TABLE contacts ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend CRUD Operations

```typescript
// src/db/database.ts
import Database from "@tauri-apps/plugin-sql";

// Lazy singleton connection
let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    // The "sqlite:" prefix tells the plugin to use SQLite.
    // The file is created in the app data directory.
    db = await Database.load("sqlite:app.db");
  }
  return db;
}

// --- Type definitions ---

export interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  favorite: number; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
}

function rowToContact(row: ContactRow): Contact {
  return {
    ...row,
    favorite: row.favorite === 1,
  };
}

// --- Query functions ---

export async function getAllContacts(): Promise<Contact[]> {
  const db = await getDb();
  const rows = await db.select<ContactRow[]>(
    "SELECT * FROM contacts ORDER BY name ASC"
  );
  return rows.map(rowToContact);
}

export async function getContact(id: number): Promise<Contact | null> {
  const db = await getDb();
  const rows = await db.select<ContactRow[]>(
    "SELECT * FROM contacts WHERE id = $1",
    [id]
  );
  return rows.length > 0 ? rowToContact(rows[0]) : null;
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const db = await getDb();
  const pattern = `%${query}%`;
  const rows = await db.select<ContactRow[]>(
    "SELECT * FROM contacts WHERE name LIKE $1 OR email LIKE $1 OR phone LIKE $1 ORDER BY name ASC",
    [pattern]
  );
  return rows.map(rowToContact);
}

export async function createContact(
  contact: Omit<Contact, "id" | "created_at" | "updated_at">
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO contacts (name, email, phone, notes, favorite)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      contact.name,
      contact.email,
      contact.phone,
      contact.notes,
      contact.favorite ? 1 : 0,
    ]
  );
  return result.lastInsertId;
}

export async function updateContact(
  id: number,
  contact: Partial<Omit<Contact, "id" | "created_at" | "updated_at">>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (contact.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(contact.name);
  }
  if (contact.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(contact.email);
  }
  if (contact.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(contact.phone);
  }
  if (contact.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(contact.notes);
  }
  if (contact.favorite !== undefined) {
    fields.push(`favorite = $${paramIndex++}`);
    values.push(contact.favorite ? 1 : 0);
  }

  fields.push(`updated_at = datetime('now')`);
  values.push(id);

  await db.execute(
    `UPDATE contacts SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
    values
  );
}

export async function deleteContact(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM contacts WHERE id = $1", [id]);
}

export async function toggleFavorite(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE contacts SET favorite = NOT favorite, updated_at = datetime('now') WHERE id = $1",
    [id]
  );
}
```

### React Component Using the Database

```tsx
// src/components/ContactList.tsx
import { useEffect, useState, useCallback } from "react";
import {
  Contact,
  getAllContacts,
  searchContacts,
  createContact,
  deleteContact,
  toggleFavorite,
} from "../db/database";

export function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const results = search
        ? await searchContacts(search)
        : await getAllContacts();
      setContacts(results);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function handleAddContact() {
    const name = prompt("Contact name:");
    if (!name) return;

    await createContact({
      name,
      email: null,
      phone: null,
      notes: null,
      favorite: false,
    });
    await loadContacts();
  }

  async function handleDelete(id: number) {
    if (confirm("Delete this contact?")) {
      await deleteContact(id);
      await loadContacts();
    }
  }

  async function handleToggleFavorite(id: number) {
    await toggleFavorite(id);
    await loadContacts();
  }

  return (
    <div>
      <h2>Contacts</h2>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={handleAddContact}>Add Contact</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : contacts.length === 0 ? (
        <p>No contacts found.</p>
      ) : (
        <ul className="contact-list">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <span
                className="favorite"
                onClick={() => handleToggleFavorite(contact.id)}
              >
                {contact.favorite ? "[*]" : "[ ]"}
              </span>
              <strong>{contact.name}</strong>
              {contact.email && <span> - {contact.email}</span>}
              <button onClick={() => handleDelete(contact.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 4. SQLite from Rust

For complex logic, type safety, and performance, you may prefer to manage the database entirely from Rust and expose operations through Tauri commands. This is the recommended approach for production applications.

### Using rusqlite

`rusqlite` is a synchronous, lightweight SQLite wrapper. It is straightforward and works well for desktop apps where you do not need async database access.

Add to `Cargo.toml`:

```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

#### Connection Management with Tauri State

```rust
// src-tauri/src/database.rs
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

/// Wraps a rusqlite Connection in a Mutex so it can be shared across commands.
/// Tauri commands run on a thread pool, so the Mutex ensures only one
/// command accesses the database at a time.
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // Resolve the app's data directory
        let app_dir = app
            .path()
            .app_data_dir()
            .expect("failed to resolve app data dir");
        std::fs::create_dir_all(&app_dir)?;

        let db_path = app_dir.join("app.db");
        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        // Enable foreign key enforcement (off by default in SQLite)
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}
```

#### Models and Data Access

```rust
// src-tauri/src/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub category: Option<String>,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateNote {
    pub title: String,
    pub content: String,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNote {
    pub title: Option<String>,
    pub content: Option<String>,
    pub category: Option<String>,
    pub pinned: Option<bool>,
}
```

```rust
// src-tauri/src/repository.rs
use crate::database::Database;
use crate::models::{CreateNote, Note, UpdateNote};
use rusqlite::params;

impl Database {
    pub fn run_migrations(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                category TEXT,
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        )?;
        Ok(())
    }

    pub fn list_notes(&self, category: Option<&str>) -> Result<Vec<Note>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        let (sql, param_values): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = match category {
            Some(cat) => (
                "SELECT id, title, content, category, pinned, created_at, updated_at
                 FROM notes WHERE category = ?1 ORDER BY pinned DESC, updated_at DESC",
                vec![Box::new(cat.to_string())],
            ),
            None => (
                "SELECT id, title, content, category, pinned, created_at, updated_at
                 FROM notes ORDER BY pinned DESC, updated_at DESC",
                vec![],
            ),
        };

        let mut stmt = conn.prepare(sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let notes = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    category: row.get(3)?,
                    pinned: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(notes)
    }

    pub fn get_note(&self, id: i64) -> Result<Option<Note>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, content, category, pinned, created_at, updated_at
             FROM notes WHERE id = ?1"
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                pinned: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        Ok(rows.next().transpose()?)
    }

    pub fn create_note(&self, input: &CreateNote) -> Result<Note, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO notes (title, content, category) VALUES (?1, ?2, ?3)",
            params![input.title, input.content, input.category],
        )?;
        let id = conn.last_insert_rowid();
        drop(conn); // Release the lock before calling get_note
        self.get_note(id).map(|opt| opt.unwrap())
    }

    pub fn update_note(&self, id: i64, input: &UpdateNote) -> Result<Option<Note>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut sets = vec![];
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

        if let Some(ref title) = input.title {
            sets.push("title = ?");
            values.push(Box::new(title.clone()));
        }
        if let Some(ref content) = input.content {
            sets.push("content = ?");
            values.push(Box::new(content.clone()));
        }
        if let Some(ref category) = input.category {
            sets.push("category = ?");
            values.push(Box::new(category.clone()));
        }
        if let Some(pinned) = input.pinned {
            sets.push("pinned = ?");
            values.push(Box::new(pinned as i32));
        }

        if sets.is_empty() {
            drop(conn);
            return self.get_note(id);
        }

        sets.push("updated_at = datetime('now')");
        values.push(Box::new(id));

        let sql = format!(
            "UPDATE notes SET {} WHERE id = ?",
            sets.join(", ")
        );

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice())?;
        drop(conn);
        self.get_note(id)
    }

    pub fn delete_note(&self, id: i64) -> Result<bool, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }
}
```

#### Tauri Commands

```rust
// src-tauri/src/commands/notes.rs
use crate::database::Database;
use crate::models::{CreateNote, Note, UpdateNote};
use tauri::State;

#[tauri::command]
pub fn list_notes(
    db: State<'_, Database>,
    category: Option<String>,
) -> Result<Vec<Note>, String> {
    db.list_notes(category.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note(db: State<'_, Database>, id: i64) -> Result<Option<Note>, String> {
    db.get_note(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(db: State<'_, Database>, input: CreateNote) -> Result<Note, String> {
    db.create_note(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(
    db: State<'_, Database>,
    id: i64,
    input: UpdateNote,
) -> Result<Option<Note>, String> {
    db.update_note(id, &input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(db: State<'_, Database>, id: i64) -> Result<bool, String> {
    db.delete_note(id).map_err(|e| e.to_string())
}
```

#### Wiring It All Together

```rust
// src-tauri/src/lib.rs
mod commands;
mod database;
mod models;
mod repository;

use database::Database;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = Database::new(&app.handle())?;
            db.run_migrations().expect("failed to run migrations");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::list_notes,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Using sqlx (Async Alternative)

If you prefer async database access (useful when commands are already `async`), you can use `sqlx`. It provides compile-time checked SQL queries and built-in migration support.

```toml
[dependencies]
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
```

```rust
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

pub struct AppDatabase {
    pub pool: SqlitePool,
}

impl AppDatabase {
    pub async fn new(db_url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(db_url)
            .await?;

        // Run embedded migrations (from a migrations/ directory)
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await?;

        Ok(AppDatabase { pool })
    }
}

// Async command using sqlx
#[tauri::command]
async fn search_notes(
    db: tauri::State<'_, AppDatabase>,
    query: String,
) -> Result<Vec<Note>, String> {
    let pattern = format!("%{}%", query);
    let notes = sqlx::query_as!(
        Note,
        r#"
        SELECT id, title, content, category,
               pinned as "pinned: bool",
               created_at, updated_at
        FROM notes
        WHERE title LIKE ?1 OR content LIKE ?1
        ORDER BY updated_at DESC
        "#,
        pattern
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(notes)
}
```

---

## 5. Database Design Patterns

### The Repository Pattern

Separate your data access logic from your Tauri commands. This makes code testable, reusable, and easier to change when the schema evolves.

```
Commands (thin layer)          Repository (data access)        Database
  |                               |                              |
  |  create_note(input)           |                              |
  |------------------------------>|  INSERT INTO notes ...        |
  |                               |----------------------------->|
  |                               |          Note { id, ... }    |
  |       Result<Note>            |<-----------------------------|
  |<------------------------------|                              |
```

```rust
// src-tauri/src/repositories/note_repo.rs
use rusqlite::{Connection, params};
use crate::models::{Note, CreateNote};

/// A repository that borrows a connection reference.
/// This allows the caller to control transactions.
pub struct NoteRepo<'a> {
    conn: &'a Connection,
}

impl<'a> NoteRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        NoteRepo { conn }
    }

    pub fn find_all(&self) -> rusqlite::Result<Vec<Note>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, content, category, pinned, created_at, updated_at
             FROM notes ORDER BY pinned DESC, updated_at DESC"
        )?;

        let notes = stmt.query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                pinned: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(notes)
    }

    pub fn create(&self, input: &CreateNote) -> rusqlite::Result<i64> {
        self.conn.execute(
            "INSERT INTO notes (title, content, category) VALUES (?1, ?2, ?3)",
            params![input.title, input.content, input.category],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn count_by_category(&self) -> rusqlite::Result<Vec<(String, i64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT COALESCE(category, 'Uncategorized'), COUNT(*)
             FROM notes GROUP BY category ORDER BY COUNT(*) DESC"
        )?;

        let counts = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(counts)
    }
}
```

### Transaction Handling

Transactions are essential when multiple operations must succeed or fail together. For example, moving a note between categories and updating a counter should be atomic.

```rust
// src-tauri/src/commands/bulk_ops.rs
use crate::database::Database;
use tauri::State;

#[tauri::command]
pub fn import_notes(
    db: State<'_, Database>,
    notes_json: String,
) -> Result<usize, String> {
    let notes: Vec<crate::models::CreateNote> =
        serde_json::from_str(&notes_json).map_err(|e| e.to_string())?;

    let conn = db.conn.lock().unwrap();

    // Start a transaction. If any insert fails, all are rolled back.
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut count = 0;
    for note in &notes {
        tx.execute(
            "INSERT INTO notes (title, content, category) VALUES (?1, ?2, ?3)",
            rusqlite::params![note.title, note.content, note.category],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

/// Move all notes from one category to another, atomically.
#[tauri::command]
pub fn merge_categories(
    db: State<'_, Database>,
    from: String,
    to: String,
) -> Result<usize, String> {
    let conn = db.conn.lock().unwrap();
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let affected = tx
        .execute(
            "UPDATE notes SET category = ?1, updated_at = datetime('now') WHERE category = ?2",
            rusqlite::params![to, from],
        )
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(affected)
}
```

### Connection Pooling Considerations

For desktop apps, a single `Mutex<Connection>` is usually sufficient. Your app has one user, not thousands. However, if you find the lock contention is a problem (unlikely), consider:

1. **Read-write splitting**: Use WAL mode (shown above) and open a second read-only connection for queries.
2. **sqlx pool**: `SqlitePoolOptions::new().max_connections(5)` gives you a pool of connections.
3. **Background tasks**: If long-running queries block the UI, run them in a `tokio::spawn` or `tauri::async_runtime::spawn`.

---

## 6. Data Serialization

Rust's `serde` library handles serialization between Rust structs and JSON automatically. Tauri commands use `serde` under the hood: any type that implements `Serialize` can be returned from a command, and any type that implements `Deserialize` can be received as an argument.

### Basic Struct Mapping

```rust
use serde::{Deserialize, Serialize};

/// This struct can be returned from a Tauri command (Serialize)
/// and received as a command argument (Deserialize).
#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub completed: bool,
    pub priority: Priority,
    pub due_date: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}
```

On the frontend, this maps to:

```typescript
interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  tags: string[];
}
```

### Handling Field Name Conventions

Rust uses `snake_case` and TypeScript uses `camelCase`. Use `serde` rename attributes:

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub user_id: i64,         // Serializes as "userId"
    pub display_name: String, // Serializes as "displayName"
    pub email_address: String, // Serializes as "emailAddress"
    pub created_at: String,   // Serializes as "createdAt"
}
```

Now the TypeScript side receives clean camelCase:

```typescript
interface UserProfile {
  userId: number;
  displayName: string;
  emailAddress: string;
  createdAt: string;
}
```

### Handling Dates and Times

SQLite stores dates as text. The cleanest pattern is to store ISO 8601 strings and parse them on the frontend.

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: i64,
    pub title: String,
    // chrono's DateTime<Utc> serializes to ISO 8601 automatically
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    // Duration in seconds (serde does not handle std::time::Duration well)
    pub duration_secs: i64,
}
```

On the frontend:

```typescript
interface Event {
  id: number;
  title: string;
  startTime: string; // ISO 8601, e.g. "2025-03-14T10:00:00Z"
  endTime: string;
  durationSecs: number;
}

// Parse with the Date constructor or a library like date-fns
function formatEventTime(event: Event): string {
  const start = new Date(event.startTime);
  return start.toLocaleString();
}
```

### Handling Binary Data

For images, files, or other binary data, use base64 encoding:

```rust
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: i64,
    pub filename: String,
    pub mime_type: String,
    /// Base64-encoded file content
    pub data: String,
}

impl Attachment {
    pub fn from_bytes(id: i64, filename: String, mime_type: String, bytes: &[u8]) -> Self {
        Attachment {
            id,
            filename,
            mime_type,
            data: STANDARD.encode(bytes),
        }
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>, base64::DecodeError> {
        STANDARD.decode(&self.data)
    }
}
```

### Custom Serialization for Complex Types

When you need special handling, implement custom serializers:

```rust
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// A wrapper that stores a HashMap as a sorted JSON object
/// for deterministic output.
#[derive(Debug)]
pub struct SortedMap(pub std::collections::HashMap<String, String>);

impl Serialize for SortedMap {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut sorted: Vec<_> = self.0.iter().collect();
        sorted.sort_by_key(|(k, _)| k.clone());

        let mut map = serializer.serialize_map(Some(sorted.len()))?;
        for (k, v) in sorted {
            map.serialize_entry(k, v)?;
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for SortedMap {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let map = std::collections::HashMap::deserialize(deserializer)?;
        Ok(SortedMap(map))
    }
}
```

---

## 7. Migration Strategies

As your app evolves, the database schema will change. You need a reliable strategy for upgrading the database when users update their app.

### Manual Version Tracking

The simplest approach: track a version number in a metadata table.

```rust
// src-tauri/src/migrations.rs
use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    // Create a metadata table to track the schema version
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _schema_version (
            version INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO _schema_version (rowid, version) VALUES (1, 0);"
    )?;

    let current_version: i32 = conn.query_row(
        "SELECT version FROM _schema_version WHERE rowid = 1",
        [],
        |row| row.get(0),
    )?;

    // Each migration checks the version and runs if needed.
    // Migrations MUST be additive: never remove a migration once shipped.

    if current_version < 1 {
        conn.execute_batch(
            "CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            UPDATE _schema_version SET version = 1 WHERE rowid = 1;"
        )?;
    }

    if current_version < 2 {
        conn.execute_batch(
            "ALTER TABLE notes ADD COLUMN category TEXT;
             ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
             UPDATE _schema_version SET version = 2 WHERE rowid = 1;"
        )?;
    }

    if current_version < 3 {
        conn.execute_batch(
            "CREATE TABLE tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE note_tags (
                note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (note_id, tag_id)
            );
            CREATE INDEX idx_note_tags_tag ON note_tags(tag_id);
            UPDATE _schema_version SET version = 3 WHERE rowid = 1;"
        )?;
    }

    Ok(())
}
```

### Using tauri-plugin-sql Migrations

As shown in Section 3, `tauri-plugin-sql` has built-in migration support:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_tags_system",
            sql: include_str!("../migrations/002_tags.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
```

Store SQL files alongside your Rust source for easier editing:

```sql
-- src-tauri/migrations/001_initial.sql
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    category TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_updated ON notes(updated_at);
```

### Migration Safety Rules

1. **Never delete a migration** once it has shipped to users. Old databases need to run through every migration in order.
2. **Never modify a shipped migration**. If migration 2 has a bug, fix it in migration 3.
3. **Always wrap migrations in transactions** so a failed migration does not leave the database in a partial state.
4. **Test migrations** by keeping a copy of your oldest production database and running all migrations against it.
5. **Back up before migrating**. Copy the database file before running migrations on app startup.

### Pre-Migration Backup

```rust
use std::path::PathBuf;
use std::fs;

fn backup_database(db_path: &PathBuf) -> Result<PathBuf, std::io::Error> {
    let backup_path = db_path.with_extension(
        format!("db.backup-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"))
    );
    fs::copy(db_path, &backup_path)?;
    Ok(backup_path)
}

pub fn migrate_with_backup(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    let db_path = app_dir.join("app.db");

    if db_path.exists() {
        let backup = backup_database(&db_path)?;
        println!("Database backed up to {:?}", backup);
    }

    let conn = rusqlite::Connection::open(&db_path)?;
    run_migrations(&conn)?;
    Ok(())
}
```

---

## 8. Backup and Export

Users expect to be able to back up and export their data. Here are practical patterns.

### Full Database Backup

The simplest backup is to copy the SQLite file. SQLite in WAL mode supports safe concurrent reads, but you should use the backup API for a consistent snapshot.

```rust
// src-tauri/src/commands/backup.rs
use crate::database::Database;
use rusqlite::backup;
use std::path::PathBuf;
use std::time::Duration;
use tauri::State;

#[tauri::command]
pub fn backup_database(
    db: State<'_, Database>,
    destination: String,
) -> Result<String, String> {
    let conn = db.conn.lock().unwrap();
    let dest_path = PathBuf::from(&destination);

    // Use SQLite's online backup API for a consistent copy
    let mut dest_conn =
        rusqlite::Connection::open(&dest_path).map_err(|e| e.to_string())?;

    let backup = backup::Backup::new(&conn, &mut dest_conn)
        .map_err(|e| e.to_string())?;

    // Copy all pages, sleeping briefly between batches to avoid
    // blocking other operations. For a small desktop DB, this
    // completes almost instantly.
    backup
        .run_to_completion(100, Duration::from_millis(10), None)
        .map_err(|e| e.to_string())?;

    Ok(format!("Backup saved to {}", dest_path.display()))
}
```

### Export to JSON

```rust
// src-tauri/src/commands/export.rs
use crate::database::Database;
use crate::models::Note;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportData {
    version: i32,
    exported_at: String,
    notes: Vec<Note>,
}

#[tauri::command]
pub fn export_as_json(
    db: State<'_, Database>,
    path: String,
) -> Result<usize, String> {
    let notes = db.list_notes(None).map_err(|e| e.to_string())?;
    let count = notes.len();

    let export = ExportData {
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        notes,
    };

    let json = serde_json::to_string_pretty(&export)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(count)
}

#[tauri::command]
pub fn import_from_json(
    db: State<'_, Database>,
    path: String,
) -> Result<usize, String> {
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let export: ExportData = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    let conn = db.conn.lock().unwrap();
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let mut count = 0;
    for note in &export.notes {
        tx.execute(
            "INSERT INTO notes (title, content, category, pinned, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                note.title,
                note.content,
                note.category,
                note.pinned as i32,
                note.created_at,
                note.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}
```

### Export to CSV

```rust
// Add to Cargo.toml: csv = "1"

#[tauri::command]
pub fn export_as_csv(
    db: State<'_, Database>,
    path: String,
) -> Result<usize, String> {
    let notes = db.list_notes(None).map_err(|e| e.to_string())?;
    let count = notes.len();

    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;

    // Write header
    wtr.write_record(["id", "title", "content", "category", "pinned", "created_at", "updated_at"])
        .map_err(|e| e.to_string())?;

    for note in &notes {
        wtr.write_record([
            note.id.to_string(),
            note.title.clone(),
            note.content.clone(),
            note.category.clone().unwrap_or_default(),
            if note.pinned { "true".into() } else { "false".into() },
            note.created_at.clone(),
            note.updated_at.clone(),
        ])
        .map_err(|e| e.to_string())?;
    }

    wtr.flush().map_err(|e| e.to_string())?;
    Ok(count)
}
```

### Frontend: Backup and Export UI

```tsx
// src/components/DataManagement.tsx
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

export function DataManagement() {
  async function handleBackup() {
    const path = await save({
      defaultPath: "backup.db",
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    });
    if (!path) return;

    const result = await invoke<string>("backup_database", {
      destination: path,
    });
    alert(result);
  }

  async function handleExportJson() {
    const path = await save({
      defaultPath: "notes-export.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;

    const count = await invoke<number>("export_as_json", { path });
    alert(`Exported ${count} notes to JSON.`);
  }

  async function handleExportCsv() {
    const path = await save({
      defaultPath: "notes-export.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path) return;

    const count = await invoke<number>("export_as_csv", { path });
    alert(`Exported ${count} notes to CSV.`);
  }

  async function handleImportJson() {
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });
    if (!path) return;

    const count = await invoke<number>("import_from_json", { path });
    alert(`Imported ${count} notes.`);
  }

  return (
    <div className="data-management">
      <h2>Data Management</h2>

      <section>
        <h3>Backup</h3>
        <button onClick={handleBackup}>Backup Database</button>
      </section>

      <section>
        <h3>Export</h3>
        <button onClick={handleExportJson}>Export as JSON</button>
        <button onClick={handleExportCsv}>Export as CSV</button>
      </section>

      <section>
        <h3>Import</h3>
        <button onClick={handleImportJson}>Import from JSON</button>
      </section>
    </div>
  );
}
```

---

## 9. Coding Challenges

### Challenge 1: Settings Manager with Live Preview

**Description**: Build a settings panel that uses `tauri-plugin-store` to persist user preferences and applies them in real time.

**Requirements**:
- Store theme (light/dark/system), accent color, font size, language, and sidebar position
- Changes must be applied immediately without requiring a restart
- If the app has multiple windows, changes must propagate to all windows via `store.onChange()`
- Include a "Reset to Defaults" button that restores all settings to their default values
- Display the on-disk file path of the settings file for debugging

**Hints**:
- Use `load("settings.json", { autoSave: true })` for automatic persistence
- Use `store.onChange()` to listen for changes from other windows or from Rust
- Apply CSS custom properties (CSS variables) for theme/font changes so they take effect without re-rendering

---

### Challenge 2: Full CRUD Notes App with SQLite

**Description**: Build a notes application with categories, search, and sorting using SQLite from Rust commands.

**Requirements**:
- Notes have a title, markdown content, category, pinned status, and timestamps
- Implement full CRUD: create, read, update, delete
- Add a search feature that searches across title and content
- Support filtering by category and showing pinned notes first
- Use the repository pattern to separate database logic from command handlers
- Include a note count and category count in the sidebar

**Hints**:
- Use `Mutex<Connection>` as Tauri managed state
- SQLite's `LIKE` operator with `%pattern%` handles basic search
- Order results with `ORDER BY pinned DESC, updated_at DESC` to show pinned notes first
- Use `COALESCE(category, 'Uncategorized')` with `GROUP BY` for category counts

---

### Challenge 3: Data Import/Export Pipeline

**Description**: Build a complete data import/export system that supports JSON and CSV formats, with validation and progress reporting.

**Requirements**:
- Export all notes as JSON (with metadata: version, export date, note count)
- Export all notes as CSV
- Import from JSON with validation (check required fields, reject malformed data)
- Import from CSV with column mapping (handle missing/extra columns gracefully)
- Show a progress indicator for large imports (use Tauri events to report progress)
- After import, display a summary: how many records were imported, skipped, or failed

**Hints**:
- Use `serde_json` for JSON and the `csv` crate for CSV on the Rust side
- For progress reporting, emit events from Rust with `app.emit("import-progress", payload)` and listen in React with `listen("import-progress", callback)`
- Wrap the entire import in a transaction so partial failures do not corrupt data
- Validate each record before insertion rather than failing on the first error

---

### Challenge 4: Database Migration System

**Description**: Implement a robust migration system that handles schema evolution across app versions.

**Requirements**:
- Track the current schema version in a metadata table
- Define at least 4 migrations that progressively build a schema (create tables, add columns, add indexes, create junction tables)
- Before running migrations, back up the database to a timestamped file
- If a migration fails, roll back the transaction and report which migration failed
- Provide a Tauri command that returns the current schema version and migration history
- Write unit tests for each migration using an in-memory SQLite database

**Hints**:
- Use `Connection::open_in_memory()` for tests so they do not create files
- Wrap each migration in its own transaction
- Store migration history (version, description, applied_at) in a separate table
- Use `include_str!()` to embed SQL files at compile time

---

### Challenge 5: Offline-First Data Sync Prototype

**Description**: Build a prototype that stores data locally in SQLite and tracks which records need to be synced to a remote server.

**Requirements**:
- Each record has a `sync_status` field: `synced`, `pending`, `conflict`
- When the user creates or edits a record offline, mark it as `pending`
- Provide a "Sync Now" button that finds all `pending` records and simulates sending them to a server (use a 500ms delay per record to simulate network latency)
- If syncing a record "fails" (simulate random failures for 20% of records), mark it as `conflict`
- Show sync status indicators next to each record in the UI
- Track the last successful sync time in `tauri-plugin-store`

**Hints**:
- Add `sync_status TEXT NOT NULL DEFAULT 'pending'` and `last_synced_at TEXT` columns
- Use `tokio::time::sleep` in async Rust commands to simulate network delay
- Use `rand::random::<f32>() < 0.2` to simulate random sync failures
- Emit progress events so the UI can show "Syncing 3/10..." in real time
- Store `lastSyncTime` in the plugin store, not in SQLite, since it is app-level metadata

---

## Summary

| Topic | Key Takeaway |
|---|---|
| Storage options | Use plugin-store for settings, SQLite for structured data |
| Plugin Store | JSON-backed, reactive, accessible from both Rust and frontend |
| tauri-plugin-sql | Quick SQLite setup with frontend-driven SQL queries |
| Rust-side SQLite | Type-safe, performant, uses repository pattern |
| Design patterns | Separate data access from commands; use transactions for atomicity |
| Serialization | `serde` handles Rust-to-JSON; use `#[serde(rename_all = "camelCase")]` |
| Migrations | Version-tracked, additive, always back up first |
| Backup/Export | SQLite backup API for DB copies; JSON/CSV for portable export |

**Next module**: [Module 08: IPC and Events](../08-ipc-and-events/README.md) -- deep dive into inter-process communication patterns.
