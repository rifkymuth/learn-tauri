# Module 10: Security Best Practices in Tauri 2.x

**Difficulty**: Advanced | **Estimated Time**: 2-3 hours

Security is not a feature you bolt on at the end --- it must be woven into every layer of your application from day one. Tauri was designed with security as a first-class concern, but no framework can protect you from yourself. This module teaches you how Tauri's security model works, where the real risks are, and how to ship applications that your users can trust.

---

## Table of Contents

1. [Tauri's Security Model](#1-tauris-security-model)
2. [Capabilities and Permissions](#2-capabilities-and-permissions)
3. [Content Security Policy (CSP)](#3-content-security-policy-csp)
4. [IPC Security](#4-ipc-security)
5. [Dangerous APIs](#5-dangerous-apis)
6. [Secure Storage](#6-secure-storage)
7. [Network Security](#7-network-security)
8. [Supply Chain Security](#8-supply-chain-security)
9. [Code Signing](#9-code-signing)
10. [Common Vulnerabilities](#10-common-vulnerabilities)
11. [Security Checklist](#11-security-checklist)
12. [Coding Challenges](#12-coding-challenges)

---

## 1. Tauri's Security Model

### Why Tauri Is More Secure Than Electron by Default

Electron bundles Chromium and Node.js together, giving your frontend JavaScript full access to the operating system through Node.js APIs. Any XSS vulnerability in an Electron app can become a full remote code execution (RCE) exploit, because the attacker's injected script runs with the same privileges as Node.js.

Tauri takes a fundamentally different approach:

| Aspect | Electron | Tauri |
|--------|----------|-------|
| Renderer runtime | Node.js + Chromium | System webview (no Node.js) |
| Frontend OS access | Direct via Node.js `require()` | None --- must go through IPC |
| Default permissions | Everything allowed | Nothing allowed (deny by default) |
| Binary size | 150MB+ (bundles Chromium) | 2-10MB (uses system webview) |
| Attack surface | Node.js + Chromium + npm packages | Rust backend + system webview |

**Key insight**: In Tauri, the frontend is sandboxed. It cannot access the file system, spawn processes, or interact with the OS in any way unless the Rust backend explicitly exposes that functionality through commands. Every bridge between the frontend and the OS is an explicit, auditable Rust function.

### The Isolation Architecture

```
┌─────────────────────────────────────────────────┐
│                    Your App                      │
│                                                  │
│  ┌──────────────────┐    ┌────────────────────┐  │
│  │   Frontend        │    │   Rust Backend     │  │
│  │   (Webview)       │    │                    │  │
│  │                   │    │  ┌──────────────┐  │  │
│  │  - HTML/CSS/JS    │    │  │  Commands    │  │  │
│  │  - React app      │◄──►│  │  (allowlist) │  │  │
│  │  - No Node.js     │IPC │  └──────────────┘  │  │
│  │  - No OS access   │    │  ┌──────────────┐  │  │
│  │  - Sandboxed      │    │  │  Full OS     │  │  │
│  │                   │    │  │  Access      │  │  │
│  └──────────────────┘    │  └──────────────┘  │  │
│                          └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

The IPC bridge is the only crossing point, and Tauri 2.x requires you to explicitly grant permissions for every capability the frontend can invoke.

### Isolation Pattern

Tauri 2.x supports an **isolation pattern** that adds a cryptographic layer between the frontend and the IPC bridge. When enabled, all IPC messages are routed through an isolated iframe that can validate, sanitize, and encrypt messages before they reach the Rust backend.

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "pattern": {
        "use": "isolation",
        "options": {
          "dir": "../isolation-app"
        }
      }
    }
  }
}
```

The isolation script can inspect and filter every IPC call:

```javascript
// isolation-app/index.html
<script>
  window.__TAURI_ISOLATION_HOOK__ = (payload) => {
    // Inspect the command being invoked
    console.log('IPC call intercepted:', payload);

    // You can reject suspicious calls
    if (payload.cmd === 'dangerous_command') {
      throw new Error('This command is not allowed from the frontend');
    }

    // Return the (possibly modified) payload
    return payload;
  };
</script>
```

---

## 2. Capabilities and Permissions

Tauri 2.x introduced a **capability-based permission system** that replaces the simpler allowlist from Tauri 1.x. This system follows the **principle of least privilege** --- your app should request only the permissions it actually needs, and nothing more.

### How Capabilities Work

A **capability** is a named set of permissions that can be granted to specific windows or webviews. Think of it like Android's permission model: your app must declare what it needs, and each permission is scoped as narrowly as possible.

Capabilities are defined in JSON files inside `src-tauri/capabilities/`:

```
src-tauri/
├── capabilities/
│   ├── main-window.json
│   ├── settings-window.json
│   └── plugin-webview.json
├── src/
│   └── main.rs
└── tauri.conf.json
```

### Defining a Capability

```json
// src-tauri/capabilities/main-window.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-window-capability",
  "description": "Permissions for the main application window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

### Permission Scoping

Permissions can be scoped to restrict exactly what resources the command can access. This is critical for file system, shell, and HTTP operations.

```json
// INSECURE: allows reading ANY file on the system
{
  "identifier": "main-window-capability",
  "windows": ["main"],
  "permissions": [
    "fs:allow-read-text-file"
  ]
}
```

```json
// SECURE: restricts file reading to a specific directory
{
  "identifier": "main-window-capability",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$APPDATA/user-data/**" }
      ],
      "deny": [
        { "path": "$APPDATA/user-data/secrets/**" }
      ]
    }
  ]
}
```

### Per-Window Permissions

Different windows should have different permission sets. A settings window does not need shell access. A plugin webview should have almost no permissions.

```json
// src-tauri/capabilities/settings-window.json
{
  "identifier": "settings-capability",
  "description": "Minimal permissions for the settings panel",
  "windows": ["settings"],
  "permissions": [
    "core:default"
  ]
}
```

```json
// src-tauri/capabilities/plugin-webview.json
{
  "identifier": "plugin-webview-capability",
  "description": "Untrusted plugin content - extremely restricted",
  "webviews": ["plugin-*"],
  "permissions": []
}
```

### Custom Permissions for Your Commands

You can define permissions for your own Tauri commands:

```toml
# src-tauri/Cargo.toml - enable the build script for permission generation
[build-dependencies]
tauri-build = { version = "2", features = [] }
```

Define permissions in a TOML file:

```toml
# src-tauri/permissions/user-data/default.toml
[[permission]]
identifier = "allow-read-user-profile"
description = "Allows reading the user profile"
commands.allow = ["get_user_profile"]

[[permission]]
identifier = "allow-update-user-profile"
description = "Allows updating the user profile"
commands.allow = ["update_user_profile"]

[[permission]]
identifier = "allow-delete-account"
description = "Allows permanent account deletion"
commands.allow = ["delete_account"]
```

Then reference them in your capability:

```json
{
  "identifier": "main-window-capability",
  "windows": ["main"],
  "permissions": [
    "user-data:allow-read-user-profile",
    "user-data:allow-update-user-profile"
    // Note: delete-account is NOT included --- principle of least privilege
  ]
}
```

---

## 3. Content Security Policy (CSP)

A Content Security Policy tells the webview which resources are allowed to load. Without a CSP, an attacker who achieves XSS can load external scripts, exfiltrate data, or inject malicious content.

### Setting CSP in tauri.conf.json

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https://avatars.example.com; connect-src 'self' https://api.example.com; font-src 'self' data:; object-src 'none'; base-uri 'self'"
    }
  }
}
```

### CSP Directive Breakdown

| Directive | Recommended Value | Why |
|-----------|-------------------|-----|
| `default-src` | `'self'` | Block everything not explicitly allowed |
| `script-src` | `'self'` | Only run scripts bundled with your app |
| `style-src` | `'self' 'unsafe-inline'` | Allow bundled styles; inline may be needed for CSS-in-JS |
| `img-src` | `'self' asset:` | Allow bundled images and Tauri asset protocol |
| `connect-src` | `'self' https://your-api.com` | Only allow connections to your own API |
| `font-src` | `'self' data:` | Bundled fonts and data URIs for inline fonts |
| `object-src` | `'none'` | Block Flash, Java applets, and other plugins |
| `base-uri` | `'self'` | Prevent base tag injection |

### What to Avoid

```json
// INSECURE: allows loading scripts from anywhere
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;"
    }
  }
}
```

The problems:
- **`'unsafe-inline'` in `script-src`** --- allows `<script>` tags injected via XSS to execute.
- **`'unsafe-eval'`** --- allows `eval()`, `Function()`, and `setTimeout("string")`, all of which are XSS vectors.
- **`https:`** --- allows loading scripts from any HTTPS origin, enabling supply-chain attacks.

```json
// SECURE: tight CSP
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:; connect-src 'self' https://api.yourapp.com; font-src 'self' data:; object-src 'none'; base-uri 'self'"
    }
  }
}
```

> **Note on Tauri's automatic CSP nonces**: When you set a CSP, Tauri automatically adds nonce attributes to inline scripts it injects for IPC. This means Tauri's own scripts continue to work even with a strict `script-src` policy. You do not need to add `'unsafe-inline'` to `script-src` for Tauri to function.

### Handling Third-Party Libraries

If a library requires `'unsafe-eval'` (some template engines, for example), consider:

1. Finding an alternative library that does not need it.
2. If unavoidable, use `'wasm-unsafe-eval'` instead (narrower scope, allows WASM but not `eval()`).
3. Never add `'unsafe-eval'` just because a development tool asks for it --- production builds often do not need it.

---

## 4. IPC Security

Every Tauri command is an IPC call from untrusted frontend code to the privileged Rust backend. Treat every command like a public API endpoint --- validate inputs, enforce authorization, and never trust the frontend.

### Validating Command Inputs

```rust
// INSECURE: no validation
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
```

This command allows the frontend to read **any file** on the system. An XSS attack could read `/etc/passwd`, SSH keys, or browser cookies.

```rust
// SECURE: validate and scope the path
use std::path::{Path, PathBuf};

#[tauri::command]
fn read_file(
    app_handle: tauri::AppHandle,
    filename: String,
) -> Result<String, String> {
    // Reject path traversal attempts
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".to_string());
    }

    // Construct the path within the app's data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let safe_path = app_data_dir.join("documents").join(&filename);

    // Double-check the resolved path is within the allowed directory
    let canonical = safe_path.canonicalize().map_err(|e| e.to_string())?;
    let allowed_dir = app_data_dir.join("documents")
        .canonicalize()
        .map_err(|e| e.to_string())?;

    if !canonical.starts_with(&allowed_dir) {
        return Err("Access denied: path is outside allowed directory".to_string());
    }

    std::fs::read_to_string(&canonical).map_err(|e| e.to_string())
}
```

### Sanitizing Data

Data flowing in both directions must be treated carefully. Input from the frontend could contain malicious content. Data sent to the frontend will be rendered in a webview.

```rust
// INSECURE: returning unsanitized HTML to the frontend
#[tauri::command]
fn get_user_note(note_id: i32) -> Result<String, String> {
    // Imagine this loads from a database
    let note_content = db_load_note(note_id)?;
    // If note_content contains <script>alert('xss')</script>,
    // the frontend might render it directly into the DOM
    Ok(note_content)
}
```

```rust
// SECURE: sanitize before returning, or return structured data
use serde::Serialize;

#[derive(Serialize)]
struct Note {
    id: i32,
    title: String,
    content: String,  // Plain text, not HTML
    created_at: String,
}

#[tauri::command]
fn get_user_note(note_id: i32) -> Result<Note, String> {
    let note = db_load_note(note_id)?;
    // Return structured data; let the frontend handle rendering safely
    Ok(Note {
        id: note.id,
        title: note.title,
        content: note.content,  // Frontend uses textContent, not innerHTML
        created_at: note.created_at.to_string(),
    })
}
```

On the frontend side:

```tsx
// INSECURE: rendering raw HTML from backend
function NoteDisplay({ noteId }: { noteId: number }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    invoke('get_user_note', { noteId }).then((note: any) => {
      setHtml(note.content);
    });
  }, [noteId]);

  // dangerouslySetInnerHTML is almost always wrong
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

```tsx
// SECURE: render as text content through React's safe defaults
interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

function NoteDisplay({ noteId }: { noteId: number }) {
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    invoke<Note>('get_user_note', { noteId }).then(setNote);
  }, [noteId]);

  if (!note) return <p>Loading...</p>;

  // React escapes text content by default --- safe from XSS
  return (
    <div>
      <h2>{note.title}</h2>
      <p>{note.content}</p>
      <time>{note.created_at}</time>
    </div>
  );
}
```

### Type-Safe Commands with Validation

Use Rust's type system to enforce constraints at the deserialization layer:

```rust
use serde::Deserialize;

#[derive(Deserialize)]
struct CreateUserRequest {
    username: String,
    email: String,
}

impl CreateUserRequest {
    fn validate(&self) -> Result<(), String> {
        if self.username.is_empty() || self.username.len() > 50 {
            return Err("Username must be between 1 and 50 characters".into());
        }
        if !self.username.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err("Username must contain only alphanumeric characters and underscores".into());
        }
        if !self.email.contains('@') || self.email.len() > 254 {
            return Err("Invalid email address".into());
        }
        Ok(())
    }
}

#[tauri::command]
fn create_user(request: CreateUserRequest) -> Result<String, String> {
    request.validate()?;
    // Now safe to proceed with validated data
    Ok(format!("User {} created", request.username))
}
```

---

## 5. Dangerous APIs

Some Tauri capabilities grant access to powerful OS primitives. These require extra care.

### Shell Command Risks

```rust
// INSECURE: shell injection via string interpolation
#[tauri::command]
fn search_files(query: String) -> Result<String, String> {
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(format!("grep -r '{}' /home/user/documents", query))
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
// If query = "'; rm -rf / #", the command becomes:
// grep -r ''; rm -rf / #' /home/user/documents
```

```rust
// SECURE: use argument arrays, never shell interpolation
#[tauri::command]
fn search_files(query: String) -> Result<String, String> {
    // Validate the query first
    if query.is_empty() || query.len() > 200 {
        return Err("Query must be between 1 and 200 characters".into());
    }

    // Pass arguments as separate items --- no shell involved
    let output = std::process::Command::new("grep")
        .arg("-r")
        .arg("--")          // End of flags, prevents -r being treated as flag
        .arg(&query)        // Passed as a single argument, not interpolated
        .arg("/home/user/documents")
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

Even better: avoid shelling out entirely. Use Rust crates for the same functionality:

```rust
// BEST: use a Rust library instead of a shell command
use walkdir::WalkDir;

#[tauri::command]
fn search_files(query: String) -> Result<Vec<String>, String> {
    if query.is_empty() || query.len() > 200 {
        return Err("Query must be between 1 and 200 characters".into());
    }

    let mut matches = Vec::new();
    let search_dir = "/home/user/documents";

    for entry in WalkDir::new(search_dir)
        .max_depth(5)                   // Limit traversal depth
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if let Ok(content) = std::fs::read_to_string(entry.path()) {
            if content.contains(&query) {
                matches.push(entry.path().display().to_string());
            }
        }
    }

    Ok(matches)
}
```

### File System Access Risks

If your app must use the `fs` plugin, scope it tightly:

```json
// INSECURE: broad file system access
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-remove"
  ]
}
```

```json
// SECURE: scoped file system access
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$APPDATA/myapp/projects/**" },
        { "path": "$RESOURCE/**" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$APPDATA/myapp/projects/**" }
      ],
      "deny": [
        { "path": "**/*.exe" },
        { "path": "**/*.sh" },
        { "path": "**/*.bat" }
      ]
    }
  ]
}
```

### Shell Plugin Scoping

If you must allow the frontend to launch programs, use the shell plugin's scoped commands:

```json
// src-tauri/capabilities/main-window.json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "open-url",
          "cmd": "xdg-open",
          "args": [
            {
              "validator": "^https://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$"
            }
          ]
        }
      ]
    }
  ]
}
```

The `args` validator uses a regex to ensure only valid HTTPS URLs can be passed --- preventing injection of arbitrary arguments.

---

## 6. Secure Storage

### Never Store Secrets in the Frontend

The frontend webview's localStorage, sessionStorage, and IndexedDB are **not secure storage**. They are accessible to any script running in the webview context, and they are stored in plain text on disk.

```typescript
// INSECURE: storing sensitive data in localStorage
localStorage.setItem('api_key', 'sk-1234567890abcdef');
localStorage.setItem('user_token', 'eyJhbGciOiJIUzI1NiIs...');
```

```typescript
// SECURE: store secrets in the Rust backend using the OS keychain
import { invoke } from '@tauri-apps/api/core';

// Store a secret
await invoke('store_secret', { key: 'api_key', value: apiKey });

// Retrieve a secret
const apiKey = await invoke<string>('get_secret', { key: 'api_key' });
```

### Using the OS Keychain

The operating system provides a secure credential store (Keychain on macOS, Credential Manager on Windows, Secret Service/libsecret on Linux). Use the `keyring` crate to access it:

```toml
# src-tauri/Cargo.toml
[dependencies]
keyring = "3"
```

```rust
use keyring::Entry;

#[tauri::command]
fn store_secret(key: String, value: String) -> Result<(), String> {
    // Validate the key name
    if key.is_empty() || key.len() > 100 {
        return Err("Invalid key name".into());
    }
    if !key.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err("Key name must be alphanumeric with underscores or hyphens".into());
    }

    let entry = Entry::new("com.myapp.credentials", &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry.set_password(&value)
        .map_err(|e| format!("Failed to store secret: {}", e))?;

    Ok(())
}

#[tauri::command]
fn get_secret(key: String) -> Result<String, String> {
    let entry = Entry::new("com.myapp.credentials", &key)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    entry.get_password()
        .map_err(|e| format!("Secret not found: {}", e))
}

#[tauri::command]
fn delete_secret(key: String) -> Result<(), String> {
    let entry = Entry::new("com.myapp.credentials", &key)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    entry.delete_credential()
        .map_err(|e| format!("Failed to delete secret: {}", e))
}
```

### Encrypting Sensitive Data at Rest

For data that must be stored in files (too large for the keychain, or structured data like databases), encrypt it:

```rust
// Using the `aes-gcm` crate for authenticated encryption
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::aead::rand_core::RngCore;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

fn encrypt_data(plaintext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Prepend the nonce to the ciphertext for storage
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

fn decrypt_data(encrypted: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if encrypted.len() < 12 {
        return Err("Invalid encrypted data".into());
    }

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(&encrypted[..12]);
    let ciphertext = &encrypted[12..];

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))
}
```

Store the encryption key in the OS keychain. Never hardcode keys or store them alongside the encrypted data.

---

## 7. Network Security

### HTTPS Enforcement

All network requests from your application should use HTTPS. Tauri does not automatically enforce this, so you must do it yourself.

```rust
// INSECURE: allowing HTTP connections
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;
    response.text().await.map_err(|e| e.to_string())
}
```

```rust
// SECURE: enforce HTTPS and validate the domain
const ALLOWED_DOMAINS: &[&str] = &[
    "api.myapp.com",
    "cdn.myapp.com",
];

#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Parse and validate the URL
    let parsed = url::Url::parse(&url)
        .map_err(|_| "Invalid URL".to_string())?;

    // Enforce HTTPS
    if parsed.scheme() != "https" {
        return Err("Only HTTPS connections are allowed".into());
    }

    // Validate the domain against the allowlist
    let host = parsed.host_str().ok_or("No host in URL")?;
    if !ALLOWED_DOMAINS.iter().any(|&d| host == d) {
        return Err(format!("Domain '{}' is not in the allowlist", host));
    }

    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;
    response.text().await.map_err(|e| e.to_string())
}
```

### Certificate Pinning Concepts

Certificate pinning adds an extra layer of security by verifying that the server's TLS certificate matches a known, trusted certificate. This protects against compromised Certificate Authorities (CAs).

```rust
use reqwest::tls::Certificate;

fn create_pinned_client() -> Result<reqwest::Client, String> {
    // Load your pinned certificate
    let cert_pem = include_bytes!("../certs/api-server.pem");
    let cert = Certificate::from_pem(cert_pem)
        .map_err(|e| format!("Failed to load certificate: {}", e))?;

    reqwest::Client::builder()
        .add_root_certificate(cert)
        .https_only(true)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}
```

> **Warning**: Certificate pinning can cause your app to break when certificates are rotated. Plan for certificate rotation by including backup pins or implementing an out-of-band update mechanism for your pinned certificates.

### CORS in the Tauri Context

In Tauri, your frontend is served from a custom protocol (`tauri://` or `https://tauri.localhost`), not `http://localhost:3000`. This means CORS policies on external APIs will block requests unless the server explicitly allows your origin.

Solutions:

1. **Proxy through Rust backend** (recommended): Make HTTP requests from the Rust side, which is not subject to CORS.

```rust
#[tauri::command]
async fn api_request(endpoint: String, body: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("https://api.myapp.com/{}", endpoint))
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    response.text().await.map_err(|e| e.to_string())
}
```

2. **Configure your API server** to allow the Tauri origin:

```
Access-Control-Allow-Origin: https://tauri.localhost
```

---

## 8. Supply Chain Security

Your application's security is only as strong as its weakest dependency. A malicious or compromised crate or npm package can undermine all of your security measures.

### Auditing Rust Dependencies

```bash
# Install cargo-audit
cargo install cargo-audit

# Run an audit against the RustSec Advisory Database
cd src-tauri
cargo audit

# Example output:
#   Crate:     chrono
#   Version:   0.4.19
#   Warning:   unsound
#   ID:        RUSTSEC-2020-0159
#   URL:       https://rustsec.org/advisories/RUSTSEC-2020-0159
#   ...
```

Fix any advisories by updating the affected crates:

```bash
cargo update -p chrono
cargo audit
```

### Auditing JavaScript Dependencies

```bash
# Run npm's built-in audit
npm audit

# For automatic fixes (review changes before accepting)
npm audit fix

# For a more thorough audit
npx auditjs ossi
```

### Lock Files

Lock files (`Cargo.lock` for Rust, `package-lock.json` / `pnpm-lock.yaml` for JavaScript) pin exact dependency versions. **Always commit lock files to version control** for applications.

```bash
# Verify that your lock file is up to date
cargo check
npm ci  # Uses the lock file exactly, fails if it's out of sync
```

### Using Trusted Crates

Before adding a dependency, evaluate it:

1. **Check download counts** on [crates.io](https://crates.io) --- widely used crates have more eyes on them.
2. **Review the source code**, especially `build.rs` files which run at compile time.
3. **Check the maintainer's profile** --- are they known in the Rust community?
4. **Look at the crate's dependencies** --- a crate with 50 transitive dependencies has a larger attack surface.
5. **Prefer crates that are `#![forbid(unsafe_code)]`** when possible.

```bash
# View the full dependency tree
cargo tree

# Check for duplicate dependencies (potential version conflicts)
cargo tree --duplicates

# View dependencies of a specific crate
cargo tree -p serde
```

### Automated Auditing in CI

Add security auditing to your CI pipeline:

```yaml
# .github/workflows/security-audit.yml
name: Security Audit
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  push:
    paths:
      - '**/Cargo.lock'
      - '**/package-lock.json'

jobs:
  rust-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rustsec/audit-check@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm audit --audit-level=high
```

---

## 9. Code Signing

Code signing proves that your application was built by you and has not been tampered with since it was signed. Without code signing:

- **Windows**: Users see a SmartScreen warning saying the app is from an "unknown publisher." Many users will not proceed past this warning.
- **macOS**: Unsigned apps are blocked by Gatekeeper entirely. Users must manually bypass security settings.
- **Linux**: Package managers can verify GPG signatures, but unsigned packages are still common.

### Why It Matters

1. **User trust**: Signed apps display your company name instead of "Unknown Publisher."
2. **Tamper detection**: If someone modifies your binary after signing, the signature becomes invalid.
3. **Auto-updates**: Tauri's updater verifies signatures before applying updates, preventing malicious update injection.
4. **Distribution**: App stores (Microsoft Store, Mac App Store) require signing.

### Platform-Specific Signing Overview

#### Windows (Authenticode)

```bash
# Set environment variables for Tauri's build process
# Option 1: PFX file
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-pfx-password"

# Option 2: Use signtool.exe directly (for EV certificates with USB tokens)
# Tauri can invoke signtool automatically if configured
```

```json
// tauri.conf.json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

#### macOS (Apple Notarization)

```bash
# Set environment variables
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@apple.id"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

```json
// tauri.conf.json
{
  "bundle": {
    "macOS": {
      "signingIdentity": null,
      "entitlements": null
    }
  }
}
```

#### Tauri Updater Signing

Tauri's updater uses its own key pair (separate from platform code signing) to verify update integrity:

```bash
# Generate a key pair for update signing
cargo tauri signer generate -w ~/.tauri/myapp.key

# This produces:
#   Private key: ~/.tauri/myapp.key (keep this SECRET)
#   Public key:  ~/.tauri/myapp.key.pub (embed in your app)
```

```json
// tauri.conf.json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

```bash
# Build with signing (set the key as an environment variable)
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/myapp.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-key-password"
cargo tauri build
```

---

## 10. Common Vulnerabilities

### XSS in the Tauri Context

Cross-site scripting (XSS) in a Tauri app is less catastrophic than in Electron (no Node.js access), but still dangerous. An attacker with XSS can:

- Call any Tauri command that the window has permission for.
- Read data from the app's state.
- Modify the UI to phish the user.
- Exfiltrate data through allowed `connect-src` origins.

**Prevention**:

```tsx
// INSECURE: using dangerouslySetInnerHTML with user content
function Comment({ body }: { body: string }) {
  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}
```

```tsx
// SECURE: let React's default escaping handle it
function Comment({ body }: { body: string }) {
  return <div>{body}</div>;
}

// If you MUST render rich text, use a sanitizer
import DOMPurify from 'dompurify';

function RichComment({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### Path Traversal

Path traversal attacks trick your app into accessing files outside the intended directory by using `..` sequences or absolute paths.

```rust
// INSECURE: directly joining user input to a base path
#[tauri::command]
fn load_template(name: String) -> Result<String, String> {
    let path = format!("./templates/{}", name);
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
// Attacker sends name = "../../etc/passwd"
// Path becomes "./templates/../../etc/passwd" = "/etc/passwd"
```

```rust
// SECURE: validate the resolved path stays within bounds
use std::path::Path;

#[tauri::command]
fn load_template(
    app_handle: tauri::AppHandle,
    name: String,
) -> Result<String, String> {
    // Reject obviously malicious input
    if name.contains("..") {
        return Err("Invalid template name".into());
    }

    // Only allow alphanumeric names with a .html extension
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err("Invalid characters in template name".into());
    }

    if !name.ends_with(".html") {
        return Err("Only .html templates are allowed".into());
    }

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    let templates_dir = resource_dir.join("templates");
    let full_path = templates_dir.join(&name);

    // Canonicalize and verify the path is within templates_dir
    let canonical = full_path.canonicalize().map_err(|_| "Template not found")?;
    let canonical_base = templates_dir.canonicalize().map_err(|e| e.to_string())?;

    if !canonical.starts_with(&canonical_base) {
        return Err("Access denied".into());
    }

    std::fs::read_to_string(&canonical).map_err(|e| e.to_string())
}
```

### Command Injection

Command injection occurs when user input is incorporated into a shell command without proper escaping.

```rust
// INSECURE: string interpolation into shell command
#[tauri::command]
fn convert_image(input_path: String, format: String) -> Result<String, String> {
    let output_path = input_path.replace(".png", &format!(".{}", format));
    let cmd = format!("convert {} {}", input_path, output_path);

    std::process::Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(output_path)
}
// Attacker: input_path = "image.png; rm -rf /"
```

```rust
// SECURE: avoid shell entirely; pass arguments directly to the program
#[tauri::command]
fn convert_image(input_path: String, format: String) -> Result<String, String> {
    // Validate format is one of the allowed values
    let allowed_formats = ["jpg", "png", "webp", "gif"];
    if !allowed_formats.contains(&format.as_str()) {
        return Err("Invalid format. Allowed: jpg, png, webp, gif".into());
    }

    // Validate input_path exists and is a file (not a directory or symlink to /etc/)
    let input = std::path::Path::new(&input_path);
    if !input.is_file() {
        return Err("Input file does not exist".into());
    }

    let output_path = input_path.replace(".png", &format!(".{}", format));

    // Pass arguments as an array --- no shell, no injection
    let status = std::process::Command::new("convert")
        .arg("--")
        .arg(&input_path)
        .arg(&output_path)
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("Image conversion failed".into());
    }

    Ok(output_path)
}
```

### Summary of Vulnerabilities and Mitigations

| Vulnerability | Risk in Tauri | Mitigation |
|---------------|--------------|------------|
| XSS | Medium (no Node.js, but can invoke commands) | CSP, React's default escaping, DOMPurify for rich text |
| Path traversal | High (if fs commands are exposed) | Canonicalize paths, check `starts_with`, validate filenames |
| Command injection | Critical (if shell commands are used) | Never use `sh -c`; pass args as arrays; use Rust crates instead |
| SQL injection | High (if using raw queries) | Use parameterized queries (`sqlx`, `rusqlite` bind params) |
| Prototype pollution | Low (frontend only) | Keep dependencies updated, use `Object.create(null)` for maps |
| Insecure deserialization | Low (serde is safe by default) | Avoid deserializing untrusted data into types with side effects |

---

## 11. Security Checklist

Review this checklist before releasing your application:

### Permissions and Capabilities
- [ ] Every window/webview has its own capability file with minimal permissions.
- [ ] File system permissions are scoped to specific directories using `$APPDATA`, `$RESOURCE`, etc.
- [ ] Shell permissions (if any) use scoped commands with argument validators.
- [ ] No window has permissions it does not need.
- [ ] The `core:default` capability is reviewed and understood.

### Content Security Policy
- [ ] A strict CSP is set in `tauri.conf.json`.
- [ ] `script-src` does not include `'unsafe-inline'` or `'unsafe-eval'`.
- [ ] `connect-src` is limited to your own API domains.
- [ ] `object-src` is set to `'none'`.

### IPC and Commands
- [ ] Every Tauri command validates its inputs.
- [ ] File paths are canonicalized and checked against an allowed base directory.
- [ ] Commands that accept filenames reject `..`, `/`, and `\` sequences.
- [ ] Structured data (structs) is used instead of raw strings where possible.
- [ ] Error messages do not leak sensitive information (file paths, stack traces).

### Data Security
- [ ] Secrets (API keys, tokens, passwords) are stored in the OS keychain, not in localStorage or files.
- [ ] Sensitive files are encrypted at rest using authenticated encryption (AES-GCM or similar).
- [ ] Encryption keys are stored in the OS keychain, not hardcoded or in config files.
- [ ] No secrets are hardcoded in the source code (check with `cargo deny` or `trufflehog`).

### Network
- [ ] All HTTP requests from the Rust backend enforce HTTPS.
- [ ] The frontend's `connect-src` CSP directive limits allowed origins.
- [ ] API requests are proxied through the Rust backend to avoid CORS issues and to validate requests.
- [ ] API keys are never sent from the frontend directly.

### Dependencies
- [ ] `cargo audit` reports no known vulnerabilities.
- [ ] `npm audit` reports no high or critical vulnerabilities.
- [ ] `Cargo.lock` and `package-lock.json` are committed to version control.
- [ ] Dependencies are reviewed before adding (especially crates with `unsafe` or `build.rs`).

### Build and Distribution
- [ ] The application is code-signed for all target platforms.
- [ ] The Tauri updater uses a signing key pair, and the private key is stored securely.
- [ ] Update endpoints use HTTPS.
- [ ] Debug symbols and development features are stripped from production builds.
- [ ] The `tauri.conf.json` `devUrl` is not present or reachable in production builds.

### Frontend
- [ ] `dangerouslySetInnerHTML` is not used, or all input is sanitized with DOMPurify.
- [ ] User-generated content is rendered as text, not HTML.
- [ ] The frontend does not store sensitive data in localStorage, sessionStorage, or IndexedDB.
- [ ] No `eval()`, `new Function()`, or `setTimeout/setInterval` with string arguments.

---

## 12. Coding Challenges

### Challenge 1: Secure File Browser Command

**Description**: You have inherited a Tauri command that allows the frontend to browse and read files. It has multiple security vulnerabilities. Identify and fix all of them.

**Starting Code (Insecure)**:

```rust
#[tauri::command]
fn browse_and_read(directory: String, filename: String) -> Result<String, String> {
    let path = format!("{}/{}", directory, filename);
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}
```

**Requirements**:
- Restrict browsing to the application's data directory only.
- Prevent path traversal via both the `directory` and `filename` parameters.
- Validate that the resolved path is within the allowed base directory using canonicalization.
- Limit readable file extensions to `.txt`, `.json`, and `.md`.
- Return user-friendly error messages that do not reveal internal file system structure.

**Hints**:
- Use `app_handle.path().app_data_dir()` to get the base directory.
- Canonicalize both the base directory and the target path, then check `starts_with`.
- Check for `..`, absolute paths, and null bytes in user input before doing anything else.

---

### Challenge 2: Build a Secure Secret Manager

**Description**: Create a Tauri command set that securely manages application secrets using the OS keychain. The frontend should be able to store, retrieve, list, and delete secrets --- but only for predefined secret names.

**Requirements**:
- Implement four commands: `store_secret`, `get_secret`, `delete_secret`, and `list_secret_keys`.
- Define an allowlist of valid secret names (e.g., `"api_key"`, `"auth_token"`, `"encryption_key"`). Reject any secret name not on the list.
- Use the `keyring` crate to interact with the OS credential store.
- Add rate limiting: no more than 10 secret operations per minute (store this state in a `Mutex<HashMap>`).
- Write a capability file that grants these commands only to the `main` window.

**Hints**:
- Use `tauri::State<Mutex<RateLimiter>>` to share the rate limiter across commands.
- The `keyring::Entry::new(service, user)` function takes a service name and a key name.
- For the rate limiter, track timestamps of recent operations and reject if too many occur within the window.

---

### Challenge 3: CSP Hardening Exercise

**Description**: You are given a Tauri application with an intentionally weak CSP and a frontend that loads resources in insecure ways. Tighten the CSP and fix the frontend code so the app functions correctly under the strict policy.

**Starting CSP (Insecure)**:

```json
{
  "app": {
    "security": {
      "csp": "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    }
  }
}
```

**Starting Frontend Code (Insecure)**:

```tsx
function App() {
  const [data, setData] = useState('');

  useEffect(() => {
    // Loading a script from a CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.example.com/analytics.js';
    document.head.appendChild(script);

    // Using eval to parse config
    const config = eval('(' + localStorage.getItem('config') + ')');

    // Inline event handler
    document.getElementById('btn')?.setAttribute('onclick', 'alert("clicked")');
  }, []);

  return (
    <div>
      <button id="btn">Click me</button>
      <div dangerouslySetInnerHTML={{ __html: data }} />
    </div>
  );
}
```

**Requirements**:
- Write a strict CSP that blocks all of the insecure patterns above.
- Rewrite the frontend code to work without `eval`, inline event handlers, or external CDN scripts.
- Replace `dangerouslySetInnerHTML` with safe React rendering.
- Bundle any necessary third-party code locally instead of loading from a CDN.
- Document each CSP directive you chose and why.

**Hints**:
- Replace `eval` with `JSON.parse` (and add error handling).
- Replace inline `onclick` with React's `onClick` prop.
- Move analytics logic to the Rust backend or remove it entirely.
- Start with `default-src 'self'` and only add what is truly needed.

---

### Challenge 4: Input Validation Library

**Description**: Build a reusable Rust validation module that can be used across all of your Tauri commands. This module should provide validators for common input types, making it easy to write secure commands.

**Requirements**:
- Create a `validation` module with functions for:
  - `validate_filename(name: &str) -> Result<(), ValidationError>` --- alphanumeric, hyphens, underscores, single dot for extension, max 255 chars.
  - `validate_path_within(path: &Path, base: &Path) -> Result<PathBuf, ValidationError>` --- canonicalizes and checks containment.
  - `validate_url(url: &str, allowed_domains: &[&str]) -> Result<Url, ValidationError>` --- parses, enforces HTTPS, checks domain allowlist.
  - `sanitize_text(input: &str, max_length: usize) -> String` --- trims, removes control characters, truncates.
- Define a custom `ValidationError` enum with descriptive variants.
- Write unit tests for each validator, including adversarial inputs: `../etc/passwd`, null bytes (`\0`), Unicode tricks (right-to-left override characters), and extremely long strings.
- Demonstrate using the module in at least two Tauri commands.

**Hints**:
- Use `std::path::Path::canonicalize()` for path validation.
- The `url` crate provides safe URL parsing.
- Test with inputs like `"file\0.txt"` (null byte injection), `"file\u{202E}txt.exe"` (RTL override), and `"a".repeat(100_000)`.
- Consider implementing the `std::fmt::Display` trait for your `ValidationError` for clean error messages.

---

### Challenge 5: Security Audit Report

**Description**: Perform a security audit on the following Tauri command module. Find all vulnerabilities, classify their severity, and write fixed versions of each command. Write your findings as code comments and tests.

**Code to Audit**:

```rust
use std::process::Command;

#[tauri::command]
fn execute_query(query: String) -> Result<String, String> {
    let db = rusqlite::Connection::open("app.db").map_err(|e| e.to_string())?;
    let sql = format!("SELECT * FROM users WHERE name = '{}'", query);
    // ... execute sql
    Ok("results".into())
}

#[tauri::command]
fn download_file(url: String, save_path: String) -> Result<(), String> {
    Command::new("curl")
        .arg("-o")
        .arg(&save_path)
        .arg(&url)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_env_var(name: String) -> Result<String, String> {
    std::env::var(&name).map_err(|e| e.to_string())
}

#[tauri::command]
fn log_action(user_input: String) -> Result<(), String> {
    let log_entry = format!("[LOG] {}", user_input);
    std::fs::write("/var/log/myapp.log", log_entry).map_err(|e| e.to_string())?;
    Ok(())
}
```

**Requirements**:
- Identify at least six distinct vulnerabilities across the four commands.
- Classify each as Critical, High, Medium, or Low severity.
- Write a corrected version of each command with comments explaining each fix.
- Write at least one unit test per command that demonstrates the vulnerability is mitigated.
- Add a capability file that appropriately restricts access to these commands.

**Hints**:
- Look for: SQL injection, command injection, path traversal, information disclosure, log injection, arbitrary file write, and missing input validation.
- The `get_env_var` command can leak secrets like `DATABASE_URL`, `AWS_SECRET_ACCESS_KEY`, etc.
- The `log_action` command has multiple issues --- think about both the content and the destination.
- Consider what happens if `download_file` is called with `save_path = "/etc/cron.d/malicious"`.

---

## Next Steps

After completing this module, you should have a solid understanding of how to build secure Tauri applications. Continue to:

- [Module 11: Testing and Debugging](../11-testing-and-debugging/README.md) --- learn how to write security-focused tests.
- [Module 12: Production](../12-production/README.md) --- apply security practices to your build, signing, and distribution pipeline.

Security is an ongoing practice, not a one-time task. Run `cargo audit` and `npm audit` regularly, keep your dependencies updated, and review your capability files whenever you add new features.
