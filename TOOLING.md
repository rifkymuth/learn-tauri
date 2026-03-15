# Production Tooling Reference for Tauri Applications

A comprehensive reference of tools, libraries, and build tools commonly used in production Tauri applications.

---

## Core Build Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **Rust / Cargo** | Backend language and package manager | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Tauri CLI** | Build, dev, and bundle Tauri apps | `cargo install tauri-cli` |
| **Vite** | Frontend build tool and dev server | `npm create vite@latest` |
| **Node.js 18+** | Frontend tooling runtime | [nodejs.org](https://nodejs.org) |
| **pnpm** | Fast, disk-efficient package manager (recommended over npm) | `npm install -g pnpm` |

---

## Frontend Stack

### UI Framework
| Library | Purpose | Why Use It |
|---------|---------|------------|
| **React 18+** | UI component library | Most popular, huge ecosystem |
| **TypeScript** | Type safety for frontend | Catches errors at compile time, better DX with Tauri APIs |

### Styling
| Library | Purpose | When to Use |
|---------|---------|-------------|
| **Tailwind CSS** | Utility-first CSS framework | Most popular choice for Tauri apps, great DX with Vite |
| **shadcn/ui** | Copy-paste component library built on Tailwind + Radix | Beautiful, accessible components without vendor lock-in |
| **Radix UI** | Headless accessible components | When you need unstyled, accessible primitives |
| **CSS Modules** | Scoped CSS | Simple projects, no extra dependencies |

### State Management (Frontend)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| **Zustand** | Lightweight state management | Most recommended for Tauri — simple, minimal boilerplate |
| **Jotai** | Atomic state management | When you prefer atom-based state (like Recoil but simpler) |
| **TanStack Query** | Server/async state management | When caching Tauri command responses, managing loading states |

### Routing
| Library | Purpose | Notes |
|---------|---------|-------|
| **React Router** | Client-side routing | Use `HashRouter` (not `BrowserRouter`) in Tauri |
| **TanStack Router** | Type-safe routing | Better TypeScript support, file-based routes |

### Forms and Validation
| Library | Purpose |
|---------|---------|
| **React Hook Form** | Performant form handling |
| **Zod** | Schema validation (works with React Hook Form) |

---

## Rust Backend Libraries

### Essentials (Almost Every Tauri App)
| Crate | Purpose | Cargo.toml |
|-------|---------|------------|
| **serde** | Serialization/deserialization | `serde = { version = "1", features = ["derive"] }` |
| **serde_json** | JSON handling | `serde_json = "1"` |
| **tokio** | Async runtime (included via Tauri) | Usually not needed separately |
| **thiserror** | Ergonomic error types | `thiserror = "2"` |
| **anyhow** | Flexible error handling | `anyhow = "1"` |

### Database
| Crate | Purpose | When to Use |
|-------|---------|-------------|
| **rusqlite** | SQLite bindings | Direct SQLite access from Rust, full control |
| **sqlx** | Async SQL toolkit | Compile-time checked queries, async, multiple DB backends |
| **sea-orm** | Full ORM for Rust | When you want a full ORM experience (like Prisma/TypeORM) |

### HTTP and Networking
| Crate | Purpose |
|-------|---------|
| **reqwest** | HTTP client (async) |
| **tauri-plugin-http** | Tauri-native HTTP with CSP support |

### File and Data
| Crate | Purpose |
|-------|---------|
| **csv** | CSV reading/writing |
| **zip** | ZIP archive handling |
| **image** | Image processing |
| **chrono** | Date and time handling |
| **uuid** | UUID generation |
| **directories** | Platform-specific directory paths |

### Logging and Diagnostics
| Crate | Purpose |
|-------|---------|
| **tracing** | Structured logging and diagnostics |
| **tracing-subscriber** | Tracing output formatting |
| **log** | Standard logging facade |
| **env_logger** | Environment-configurable logging |

### Security
| Crate | Purpose |
|-------|---------|
| **keyring** | OS keychain access (store secrets) |
| **argon2** | Password hashing |
| **aes-gcm** | AES encryption |
| **ring** | Cryptographic operations |

### Concurrency
| Crate | Purpose |
|-------|---------|
| **parking_lot** | Faster Mutex/RwLock replacements |
| **crossbeam** | Concurrent data structures |
| **rayon** | Parallel iterators |

---

## Official Tauri Plugins (v2)

These are first-party plugins maintained by the Tauri team.

| Plugin | Crate | npm Package | Purpose |
|--------|-------|-------------|---------|
| **Autostart** | `tauri-plugin-autostart` | `@tauri-apps/plugin-autostart` | Launch at system login |
| **Clipboard** | `tauri-plugin-clipboard-manager` | `@tauri-apps/plugin-clipboard-manager` | Read/write clipboard |
| **Deep Link** | `tauri-plugin-deep-link` | `@tauri-apps/plugin-deep-link` | Custom URL protocol handling |
| **Dialog** | `tauri-plugin-dialog` | `@tauri-apps/plugin-dialog` | Native file/message dialogs |
| **File System** | `tauri-plugin-fs` | `@tauri-apps/plugin-fs` | File read/write operations |
| **Global Shortcut** | `tauri-plugin-global-shortcut` | `@tauri-apps/plugin-global-shortcut` | System-wide keyboard shortcuts |
| **HTTP** | `tauri-plugin-http` | `@tauri-apps/plugin-http` | HTTP client requests |
| **Log** | `tauri-plugin-log` | `@tauri-apps/plugin-log` | Structured logging |
| **Notification** | `tauri-plugin-notification` | `@tauri-apps/plugin-notification` | Desktop notifications |
| **Opener** | `tauri-plugin-opener` | `@tauri-apps/plugin-opener` | Open URLs/files with default app |
| **OS** | `tauri-plugin-os` | `@tauri-apps/plugin-os` | OS information |
| **Process** | `tauri-plugin-process` | `@tauri-apps/plugin-process` | Process management (exit, restart) |
| **Shell** | `tauri-plugin-shell` | `@tauri-apps/plugin-shell` | Execute shell commands |
| **SQL** | `tauri-plugin-sql` | `@tauri-apps/plugin-sql` | SQL database (SQLite/MySQL/Postgres) |
| **Store** | `tauri-plugin-store` | `@tauri-apps/plugin-store` | Persistent key-value store |
| **Updater** | `tauri-plugin-updater` | `@tauri-apps/plugin-updater` | Auto-updates |
| **Window State** | `tauri-plugin-window-state` | `@tauri-apps/plugin-window-state` | Remember window size/position |

---

## Development Tools

### IDE and Editor
| Tool | Purpose |
|------|---------|
| **VS Code** | Primary editor for most Tauri developers |
| **rust-analyzer** (VS Code extension) | Rust language server — code completion, errors, go-to-definition |
| **Even Better TOML** (VS Code extension) | TOML syntax highlighting for Cargo.toml |
| **Tauri** (VS Code extension) | Tauri-specific helpers |
| **ES7+ React/Redux/React-Native** | React snippets |
| **Error Lens** | Inline error display |

### Rust Development Tools
| Tool | Purpose | Install |
|------|---------|---------|
| **rustfmt** | Code formatter | `rustup component add rustfmt` |
| **clippy** | Linter | `rustup component add clippy` |
| **cargo-watch** | Auto-rebuild on changes | `cargo install cargo-watch` |
| **cargo-expand** | Expand macros (debug derive macros) | `cargo install cargo-expand` |
| **cargo-audit** | Security vulnerability scanner | `cargo install cargo-audit` |
| **cargo-bloat** | Find what takes space in binaries | `cargo install cargo-bloat` |
| **cargo-outdated** | Check for outdated dependencies | `cargo install cargo-outdated` |

### Frontend Development Tools
| Tool | Purpose |
|------|---------|
| **ESLint** | JavaScript/TypeScript linter |
| **Prettier** | Code formatter |
| **Vitest** | Unit testing framework |
| **React DevTools** | Component inspection (works in Tauri DevTools) |

---

## Testing Tools

| Tool | Purpose | Layer |
|------|---------|-------|
| **cargo test** | Rust unit and integration tests | Backend |
| **Vitest** | Frontend unit tests | Frontend |
| **Testing Library** | React component testing | Frontend |
| **Playwright** | E2E testing (experimental with Tauri) | E2E |
| **WebdriverIO + tauri-driver** | Official Tauri E2E testing | E2E |

---

## CI/CD and Distribution

| Tool | Purpose |
|------|---------|
| **tauri-action** (GitHub Action) | Build and release Tauri apps for all platforms |
| **GitHub Actions** | CI/CD platform (most commonly used with Tauri) |
| **Apple Developer Account** | Required for macOS code signing and notarization |
| **Windows Code Signing Certificate** | Required for Windows Authenticode signing |
| **CrabNebula Cloud** | Distribution platform specifically for Tauri apps |

### GitHub Actions Example

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
      - uses: swatinem/rust-cache@v2
      - run: npm install
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'App v__VERSION__'
          releaseBody: 'See the assets to download this version and install.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

---

## Binary Size Optimization

| Technique | Config | Impact |
|-----------|--------|--------|
| Strip symbols | `strip = true` in `[profile.release]` | ~30% smaller |
| LTO | `lto = true` in `[profile.release]` | ~10-20% smaller |
| Single codegen unit | `codegen-units = 1` in `[profile.release]` | ~5% smaller |
| Optimize for size | `opt-level = "s"` in `[profile.release]` | ~5% smaller |
| Panic = abort | `panic = "abort"` in `[profile.release]` | ~5% smaller |
| UPX compression | Post-build compression | ~50% smaller |

### Cargo.toml Release Profile

```toml
[profile.release]
strip = true
lto = true
codegen-units = 1
opt-level = "s"
panic = "abort"
```

---

## Recommended Production Stack

For a typical production Tauri + React application:

```
Frontend:
  React 18+ with TypeScript
  Vite (build tool)
  Tailwind CSS + shadcn/ui (styling)
  Zustand (state management)
  React Router (routing, HashRouter)
  React Hook Form + Zod (forms)
  Vitest + Testing Library (testing)

Backend (Rust):
  serde + serde_json (serialization)
  thiserror (error handling)
  rusqlite or sqlx (database)
  tracing (logging)
  reqwest (HTTP)
  chrono (dates)
  parking_lot (concurrency)

Tauri Plugins:
  tauri-plugin-store (settings)
  tauri-plugin-log (logging)
  tauri-plugin-dialog (file dialogs)
  tauri-plugin-fs (file access)
  tauri-plugin-updater (auto-updates)
  tauri-plugin-window-state (window memory)
  tauri-plugin-opener (open URLs/files)

DevOps:
  GitHub Actions + tauri-action (CI/CD)
  cargo-audit + npm audit (security)
  rustfmt + clippy + ESLint + Prettier (linting)
```
