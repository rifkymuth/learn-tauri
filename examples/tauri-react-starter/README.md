# Tauri + React Starter

A complete starter project demonstrating Tauri 2.x with React, TypeScript, Tailwind CSS, Zustand, and React Router.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Rust, Tauri 2.x
- **State**: Zustand (frontend), Tauri managed state (backend)
- **Routing**: React Router (HashRouter)
- **Plugins**: opener, store, dialog, fs

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # Shared components
│   ├── hooks/              # Custom hooks (useInvoke)
│   ├── lib/                # Utilities, stores
│   ├── pages/              # Page components
│   ├── styles/             # Global styles
│   ├── App.tsx             # App with routing
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Commands and app setup
│   │   └── main.rs         # Entry point
│   ├── capabilities/       # Permission definitions
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Features Demonstrated

- Calling Rust commands from React (`invoke()`)
- Custom `useInvoke` hook with loading/error states
- Zustand state management
- React Router with HashRouter
- Tailwind CSS styling
- Tauri managed state with Mutex
- Plugin configuration and capabilities
- Production-optimized Cargo profile
