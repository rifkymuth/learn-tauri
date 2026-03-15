# Learn Tauri: From Zero to Production

A comprehensive, hands-on learning guide for building desktop applications with **Tauri 2.x** and **React**. Designed for developers who know React but are new to Rust.

## What is Tauri?

Tauri is a framework for building tiny, fast, and secure desktop applications using web technologies (HTML, CSS, JavaScript) for the frontend and Rust for the backend. Think of it as a lightweight alternative to Electron — your app uses the system's native webview instead of bundling Chromium, resulting in **much smaller binaries** (often under 10MB vs 150MB+).

## Prerequisites

- **Node.js** 18+ and npm/pnpm/yarn
- **React** experience (hooks, state, components)
- A code editor (VS Code recommended with rust-analyzer extension)
- Basic terminal/command-line familiarity
- **No Rust experience required** — Module 01 covers everything you need

## Repository Structure

```
learn-tauri/
├── README.md                          # This file
├── modules/
│   ├── 01-rust-fundamentals/          # Rust basics for Tauri developers
│   ├── 02-tauri-basics/               # Setup, architecture, first app
│   ├── 03-react-integration/          # Frontend with React + Vite
│   ├── 04-commands-and-state/         # Tauri commands & state management
│   ├── 05-windows-and-system-tray/    # Multi-window & system tray
│   ├── 06-filesystem-and-os/          # File system, dialogs, OS APIs
│   ├── 07-database-and-storage/       # SQLite, persistent storage
│   ├── 08-ipc-and-events/             # Inter-process communication deep dive
│   ├── 09-plugins-and-ecosystem/      # Official & community plugins
│   ├── 10-security/                   # Security best practices
│   ├── 11-testing-and-debugging/      # Testing strategies & debugging
│   └── 12-production/                 # Building, signing, updates, CI/CD
├── examples/
│   └── tauri-react-starter/           # Complete starter project scaffold
├── TOOLING.md                         # Production tooling reference
└── RESOURCES.md                       # Additional learning resources
```

## Learning Path

| Module | Topic | Difficulty | Estimated Time |
|--------|-------|------------|----------------|
| 01 | Rust Fundamentals | Beginner | 3-4 hours |
| 02 | Tauri Basics | Beginner | 2-3 hours |
| 03 | React Integration | Beginner | 2-3 hours |
| 04 | Commands & State | Intermediate | 3-4 hours |
| 05 | Windows & System Tray | Intermediate | 2-3 hours |
| 06 | File System & OS | Intermediate | 3-4 hours |
| 07 | Database & Storage | Intermediate | 3-4 hours |
| 08 | IPC & Events | Advanced | 3-4 hours |
| 09 | Plugins & Ecosystem | Intermediate | 2-3 hours |
| 10 | Security | Advanced | 2-3 hours |
| 11 | Testing & Debugging | Intermediate | 3-4 hours |
| 12 | Production | Advanced | 4-5 hours |

## How to Use This Guide

1. **Read each module's README** — concepts are explained with real-world analogies
2. **Study the code examples** — each module has complete, runnable code snippets
3. **Complete the challenges** — hands-on exercises at the end of each module
4. **Build the final project** — combine everything into a production-ready app

## Quick Start

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli

# Create a new Tauri + React project
npm create tauri-app@latest my-app -- --template react-ts

# Navigate and run
cd my-app
npm install
cargo tauri dev
```

## Production Tooling at a Glance

See [TOOLING.md](./TOOLING.md) for the full reference. Key tools include:

- **Build**: Vite, Cargo, `cargo tauri build`
- **Bundler**: Tauri's built-in bundler (AppImage, .deb, .dmg, .msi, NSIS)
- **ORM/DB**: `tauri-plugin-sql` (SQLite/MySQL/PostgreSQL)
- **State**: Zustand / Jotai (frontend), Tauri managed state (backend)
- **Auto-Update**: `tauri-plugin-updater`
- **Logging**: `tauri-plugin-log`, `tracing` (Rust), `env_logger`
- **Testing**: Vitest (frontend), `cargo test` (backend), WebDriver (E2E)
- **CI/CD**: GitHub Actions with `tauri-action`
- **Code Signing**: Apple notarization, Windows Authenticode, Linux GPG

---

Happy learning! Start with [Module 01: Rust Fundamentals](./modules/01-rust-fundamentals/README.md) if you're new to Rust.
