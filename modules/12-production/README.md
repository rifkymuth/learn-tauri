# Module 12: Building Production-Ready Tauri Applications

This module covers everything you need to ship a polished, signed, and automatically updating Tauri application to real users across all three major desktop platforms.

---

## Table of Contents

1. [Build Configuration](#1-build-configuration)
2. [Building for Each Platform](#2-building-for-each-platform)
3. [Bundle Formats](#3-bundle-formats)
4. [App Icons](#4-app-icons)
5. [Code Signing - macOS](#5-code-signing---macos)
6. [Code Signing - Windows](#6-code-signing---windows)
7. [Auto-Updates](#7-auto-updates)
8. [CI/CD with GitHub Actions](#8-cicd-with-github-actions)
9. [Reducing Binary Size](#9-reducing-binary-size)
10. [Error Reporting and Analytics](#10-error-reporting-and-analytics)
11. [Distribution](#11-distribution)
12. [Versioning and Changelog](#12-versioning-and-changelog)
13. [Coding Challenges](#13-coding-challenges)

---

## 1. Build Configuration

### Optimizing `tauri.conf.json` for Production

The `tauri.conf.json` file is the central configuration point for your Tauri application. A production-ready configuration differs significantly from a development setup.

```jsonc
// src-tauri/tauri.conf.json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "MyApp",
  "version": "1.0.0",
  "identifier": "com.mycompany.myapp",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [
      {
        "title": "MyApp",
        "width": 1024,
        "height": 768,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      "dangerousDisableAssetCspModification": false
    }
  },
  "bundle": {
    "active": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "targets": "all",
    "copyright": "Copyright (c) 2026 My Company",
    "category": "Productivity",
    "shortDescription": "A short description of MyApp",
    "longDescription": "A longer, more detailed description of what MyApp does.",
    "licenseFile": "../LICENSE",
    "resources": [
      "resources/*"
    ],
    "externalBin": [],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "wix": null,
      "nsis": {
        "displayLanguageSelector": true,
        "installerIcon": "icons/icon.ico",
        "installMode": "both"
      }
    },
    "macOS": {
      "entitlements": null,
      "exceptionDomain": "",
      "frameworks": [],
      "minimumSystemVersion": "10.15",
      "signingIdentity": null
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"],
        "section": "utils"
      },
      "appimage": {
        "bundleMediaFramework": true
      }
    }
  }
}
```

Key production settings to review:

| Setting | Purpose |
|---------|---------|
| `identifier` | Reverse-domain identifier, must be unique (used for signing, updates) |
| `security.csp` | Content Security Policy -- lock it down for production |
| `bundle.active` | Must be `true` to produce installers |
| `bundle.targets` | Which bundle formats to generate |
| `bundle.copyright` | Embedded in the binary metadata |
| `bundle.category` | macOS app category |

### Rust Release Profile Optimizations in `Cargo.toml`

Tauri builds use Rust's release profile by default when you run `cargo tauri build`. You can tune this profile extensively.

```toml
# src-tauri/Cargo.toml
[package]
name = "my-app"
version = "1.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }

# --- Production-optimized release profile ---
[profile.release]
# Optimize for size over speed (3 = max speed, "s" = small, "z" = smallest)
opt-level = "z"

# Enable Link-Time Optimization for smaller, faster binaries
# "fat" = slowest compile, best optimization
# true = "thin" LTO, good balance
lto = true

# Use a single codegen unit for maximum optimization
# (slower compile, better output)
codegen-units = 1

# Strip debug symbols from the binary
strip = true

# Abort on panic instead of unwinding (smaller binary)
panic = "abort"

# --- Optional: a custom profile for profiling ---
[profile.release-with-debug]
inherits = "release"
strip = false
debug = true
```

**Profile options explained:**

- **`opt-level = "z"`**: Optimizes aggressively for binary size. Use `3` if runtime performance matters more than download size.
- **`lto = true`**: Link-Time Optimization lets the compiler optimize across crate boundaries. Dramatically reduces binary size but slows compilation.
- **`codegen-units = 1`**: Forces the compiler to process all code in a single unit, enabling more optimization opportunities.
- **`strip = true`**: Removes debug symbols and other metadata. Can reduce binary size by 30-60%.
- **`panic = "abort"`**: Removes the unwinding machinery. Saves binary size but means panics terminate immediately with no cleanup.

---

## 2. Building for Each Platform

### The `cargo tauri build` Command

The primary build command compiles both your frontend and Rust backend into a distributable package.

```bash
# Basic production build
cargo tauri build

# Build with verbose output
cargo tauri build --verbose

# Build with specific features enabled
cargo tauri build --features "feature1,feature2"

# Build only a specific bundle format
cargo tauri build --bundles deb
cargo tauri build --bundles appimage
cargo tauri build --bundles msi
cargo tauri build --bundles nsis
cargo tauri build --bundles dmg
cargo tauri build --bundles app

# Build with a specific target triple
cargo tauri build --target x86_64-unknown-linux-gnu

# Build in debug mode (faster compile, larger binary)
cargo tauri build --debug
```

### Platform-Specific Builds

**Linux:**

```bash
# Prerequisites (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Build all Linux bundles
cargo tauri build

# Output location
# src-tauri/target/release/bundle/deb/my-app_1.0.0_amd64.deb
# src-tauri/target/release/bundle/appimage/my-app_1.0.0_amd64.AppImage
```

**macOS:**

```bash
# Prerequisites: Xcode Command Line Tools
xcode-select --install

# Build for the current architecture
cargo tauri build

# Build a universal binary (Intel + Apple Silicon)
cargo tauri build --target universal-apple-darwin

# Output location
# src-tauri/target/release/bundle/dmg/MyApp_1.0.0_aarch64.dmg
# src-tauri/target/release/bundle/macos/MyApp.app
```

**Windows:**

```powershell
# Prerequisites: Visual Studio Build Tools with C++ workload
# Install via Visual Studio Installer or:
winget install Microsoft.VisualStudio.2022.BuildTools

# Build all Windows bundles
cargo tauri build

# Output location
# src-tauri\target\release\bundle\msi\MyApp_1.0.0_x64_en-US.msi
# src-tauri\target\release\bundle\nsis\MyApp_1.0.0_x64-setup.exe
```

### Cross-Compilation Overview

True cross-compilation of Tauri apps is limited because each platform's WebView implementation is native. The recommended approach is to build on each target platform directly, typically through CI/CD (see [Section 8](#8-cicd-with-github-actions)).

| Host | Can Build For | Notes |
|------|--------------|-------|
| Linux | Linux | Native builds only |
| macOS | macOS (both architectures) | Universal binaries via `universal-apple-darwin` target |
| Windows | Windows | Native builds only |

For macOS, you can build universal (fat) binaries that run on both Intel and Apple Silicon:

```bash
# Install both targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Build universal binary
cargo tauri build --target universal-apple-darwin
```

---

## 3. Bundle Formats

### Linux: AppImage and .deb

**AppImage** -- a portable, single-file executable that runs on most Linux distributions without installation:

```jsonc
// tauri.conf.json (relevant section)
{
  "bundle": {
    "targets": ["appimage"],
    "linux": {
      "appimage": {
        "bundleMediaFramework": true,  // Include GStreamer for audio/video
        "files": {}                     // Additional files to include
      }
    }
  }
}
```

**.deb** -- the Debian/Ubuntu package format:

```jsonc
{
  "bundle": {
    "targets": ["deb"],
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libgtk-3-0"
        ],
        "recommends": [],
        "section": "utils",
        "priority": "optional",
        "files": {
          "/usr/share/applications/my-app.desktop": "resources/my-app.desktop"
        }
      }
    }
  }
}
```

### macOS: .dmg and .app

**.app** -- the standard macOS application bundle:

```jsonc
{
  "bundle": {
    "targets": ["app"],
    "macOS": {
      "minimumSystemVersion": "10.15",
      "frameworks": [],
      "exceptionDomain": "",
      "entitlements": "Entitlements.plist",
      "signingIdentity": "-"  // "-" for ad-hoc, or your identity
    }
  }
}
```

**.dmg** -- a disk image for distribution:

```jsonc
{
  "bundle": {
    "targets": ["dmg"],
    "macOS": {
      "dmg": {
        "appPosition": { "x": 180, "y": 170 },
        "applicationFolderPosition": { "x": 480, "y": 170 },
        "windowSize": { "width": 660, "height": 400 }
      }
    }
  }
}
```

### Windows: .msi and NSIS

**.msi** -- Windows Installer package (built with WiX Toolset):

```jsonc
{
  "bundle": {
    "targets": ["msi"],
    "windows": {
      "wix": {
        "language": ["en-US"],
        "template": null,
        "fragmentPaths": [],
        "componentGroupRefs": [],
        "componentRefs": [],
        "featureGroupRefs": [],
        "featureRefs": [],
        "mergeRefs": [],
        "bannerPath": "resources/wix-banner.bmp",
        "dialogImagePath": "resources/wix-dialog.bmp"
      }
    }
  }
}
```

**NSIS** -- Nullsoft Scriptable Install System (more modern installer UI):

```jsonc
{
  "bundle": {
    "targets": ["nsis"],
    "windows": {
      "nsis": {
        "displayLanguageSelector": true,
        "languages": ["English", "Japanese", "German"],
        "installerIcon": "icons/icon.ico",
        "headerImage": "resources/nsis-header.bmp",
        "sidebarImage": "resources/nsis-sidebar.bmp",
        "installMode": "both",           // "currentUser", "perMachine", or "both"
        "startMenuFolder": "MyApp",
        "template": null                  // Custom NSIS script template
      }
    }
  }
}
```

**MSI vs. NSIS comparison:**

| Feature | MSI (WiX) | NSIS |
|---------|-----------|------|
| Installer UI | Basic Windows Installer | Customizable wizard |
| Per-user install | Limited | Yes (`installMode: "both"`) |
| Silent install | `/quiet` | `/S` |
| Language selector | No | Yes |
| Enterprise deployment | Preferred (Group Policy) | Less common |
| Customization | WiX XML fragments | NSIS scripting |

---

## 4. App Icons

### Using `cargo tauri icon`

Tauri provides a built-in command to generate all required icon sizes from a single source image.

```bash
# Generate icons from a source PNG (must be at least 1024x1024)
cargo tauri icon path/to/app-icon.png

# Specify output directory
cargo tauri icon --output src-tauri/icons path/to/app-icon.png
```

This generates all the icons Tauri needs and places them in `src-tauri/icons/`:

```
src-tauri/icons/
  32x32.png
  128x128.png
  128x128@2x.png
  icon.icns          # macOS
  icon.ico           # Windows
  icon.png           # Fallback
  Square30x30Logo.png
  Square44x44Logo.png
  Square71x71Logo.png
  Square89x89Logo.png
  Square107x107Logo.png
  Square142x142Logo.png
  Square150x150Logo.png
  Square284x284Logo.png
  Square310x310Logo.png
  StoreLogo.png
```

### Icon Requirements per Platform

| Platform | Format | Minimum Size | Notes |
|----------|--------|-------------|-------|
| macOS | `.icns` | 1024x1024 | Contains multiple sizes internally |
| Windows | `.ico` | 256x256 | Multi-resolution ICO file |
| Linux | `.png` | 128x128 | `128x128.png` and `128x128@2x.png` |

### Icon Best Practices

- Start with a **1024x1024 PNG** with transparency.
- Avoid fine detail that disappears at small sizes.
- Test your icon at 16x16, 32x32, and 128x128 to ensure readability.
- Use a distinct silhouette -- many icons appear in monochrome contexts (taskbar, dock).

---

## 5. Code Signing - macOS

Code signing on macOS is essential. Unsigned apps are blocked by Gatekeeper and show alarming warnings to users.

### Prerequisites

1. **Apple Developer Account** ($99/year) at [developer.apple.com](https://developer.apple.com)
2. **Signing certificate**: "Developer ID Application" certificate
3. **Xcode** or **Xcode Command Line Tools**
4. **App-specific password** for notarization (generate at [appleid.apple.com](https://appleid.apple.com))

### Setting Up Certificates

```bash
# List available signing identities
security find-identity -v -p codesigning

# Typical output:
# 1) ABCDEF1234... "Developer ID Application: My Company (TEAMID1234)"
```

### Configuring Tauri for macOS Signing

```jsonc
// tauri.conf.json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: My Company (TEAMID1234)",
      "entitlements": "Entitlements.plist"
    }
  }
}
```

### Entitlements File

Create `src-tauri/Entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Required for notarization -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>

    <!-- Allow JIT (needed for WebView) -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>

    <!-- Network access (if your app needs it) -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- File access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### Notarization Process

Notarization is Apple's automated review process. Users see a warning if your app is not notarized.

Set environment variables for the notarization process:

```bash
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID1234"

# Alternatively, store the credentials in the Keychain
xcrun notarytool store-credentials "MY_PROFILE" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

Tauri handles notarization automatically during `cargo tauri build` when these environment variables are set:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: My Company (TEAMID1234)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID1234"

cargo tauri build
```

### Manual Notarization (if needed)

```bash
# Submit for notarization
xcrun notarytool submit MyApp.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# Check status
xcrun notarytool info <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# Staple the notarization ticket to the app
xcrun stapler staple MyApp.dmg

# Verify stapling
xcrun stapler validate MyApp.dmg
spctl --assess --verbose=4 --type execute MyApp.app
```

---

## 6. Code Signing - Windows

### Authenticode Certificates

Windows code signing uses Authenticode certificates. Options include:

| Provider | Type | SmartScreen Trust | Cost |
|----------|------|-------------------|------|
| DigiCert, Sectigo, etc. | OV (Organization Validation) | Builds over time | ~$200-400/year |
| DigiCert, Sectigo, etc. | EV (Extended Validation) | Immediate | ~$400-700/year |
| SSL.com | OV/EV | Varies | ~$200-600/year |

**EV certificates** provide immediate SmartScreen reputation, but require a hardware token (USB key) for signing, which complicates CI/CD.

### Configuring Tauri for Windows Signing

```jsonc
// tauri.conf.json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "AABBCCDD1122334455...",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### Signing with signtool

If you need to sign manually:

```powershell
# Sign using a PFX certificate file
signtool sign /f "certificate.pfx" /p "password" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "MyApp_1.0.0_x64-setup.exe"

# Sign using a certificate from the Windows Certificate Store
signtool sign /sha1 "THUMBPRINT" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "MyApp_1.0.0_x64-setup.exe"

# Verify the signature
signtool verify /pa "MyApp_1.0.0_x64-setup.exe"
```

### Signing in CI/CD with a PFX

For CI/CD, store your certificate as a Base64-encoded secret:

```bash
# Encode your certificate
base64 -i certificate.pfx -o certificate-base64.txt
```

Then in your CI pipeline:

```powershell
# Decode and import the certificate
$pfxBytes = [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE)
[IO.File]::WriteAllBytes("certificate.pfx", $pfxBytes)

Import-PfxCertificate -FilePath "certificate.pfx" `
  -CertStoreLocation Cert:\CurrentUser\My `
  -Password (ConvertTo-SecureString -String $env:WINDOWS_CERTIFICATE_PASSWORD -AsPlainText -Force)
```

### EV Certificate Considerations

EV certificates require a hardware security module (HSM). For CI/CD, options include:

- **Cloud HSM services** (Azure Key Vault, AWS CloudHSM, Google Cloud HSM)
- **Remote signing services** (SSL.com eSigner, DigiCert KeyLocker)
- **Self-hosted signing server** accessible from CI

---

## 7. Auto-Updates

### Setting Up `tauri-plugin-updater`

The updater plugin enables your app to check for and install updates automatically.

**Install the plugin:**

```bash
cargo add tauri-plugin-updater --manifest-path src-tauri/Cargo.toml
```

**Register the plugin in `src-tauri/src/lib.rs`:**

```rust
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Optionally check for updates on startup
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = update(handle).await {
                    eprintln!("Failed to check for updates: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        let mut downloaded = 0;

        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    println!(
                        "Downloaded {} of {}",
                        downloaded,
                        content_length.unwrap_or(0)
                    );
                },
                || {
                    println!("Download complete");
                },
            )
            .await?;

        println!("Update installed, restarting...");
        app.restart();
    }

    Ok(())
}
```

**Configure the updater endpoint in `tauri.conf.json`:**

```jsonc
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIH...",
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "dialog": true
    }
  }
}
```

### Generating Update Signing Keys

Updates must be signed to prevent tampering. Generate a keypair:

```bash
cargo tauri signer generate -w ~/.tauri/myapp.key
```

This creates:
- `~/.tauri/myapp.key` -- the **private key** (keep secret, use in CI)
- The **public key** is printed to stdout -- put this in `tauri.conf.json` as `pubkey`

Set the environment variable for building:

```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/myapp.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
```

### Update Server Response Format

Your update endpoint must return JSON in this format:

```json
{
  "version": "1.1.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-03-14T12:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IG1...",
      "url": "https://releases.myapp.com/download/v1.1.0/my-app_1.1.0_amd64.AppImage.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IG1...",
      "url": "https://releases.myapp.com/download/v1.1.0/MyApp.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IG1...",
      "url": "https://releases.myapp.com/download/v1.1.0/MyApp.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IG1...",
      "url": "https://releases.myapp.com/download/v1.1.0/MyApp_1.1.0_x64-setup.nsis.zip"
    }
  }
}
```

Alternatively, you can use GitHub Releases as your update endpoint by pointing to the `latest.json` file generated by `tauri-action`:

```jsonc
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/myuser/myapp/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Custom Update UI from the Frontend

You can drive the update flow from JavaScript/TypeScript for a custom UI:

```typescript
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

async function checkForUpdates() {
  const update = await check();

  if (update === null) {
    console.log("No update available");
    return;
  }

  console.log(`Update available: ${update.version}`);
  console.log(`Release notes: ${update.body}`);

  // Show a confirmation dialog to the user here, then:

  let totalBytes = 0;
  let downloadedBytes = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        totalBytes = event.data.contentLength ?? 0;
        console.log(`Download started, total: ${totalBytes} bytes`);
        break;
      case "Progress":
        downloadedBytes += event.data.chunkLength;
        const percent = totalBytes > 0
          ? Math.round((downloadedBytes / totalBytes) * 100)
          : 0;
        console.log(`Download progress: ${percent}%`);
        // Update a progress bar in your UI
        break;
      case "Finished":
        console.log("Download complete");
        break;
    }
  });

  // Restart the app to apply the update
  await relaunch();
}
```

---

## 8. CI/CD with GitHub Actions

### Complete Multi-Platform Build Workflow

The following workflow builds your Tauri app on Linux, macOS, and Windows, then creates a GitHub Release with all artifacts.

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - "v*"

  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  APP_NAME: my-app

jobs:
  create-release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      release_id: ${{ steps.create_release.outputs.id }}
      release_upload_url: ${{ steps.create_release.outputs.upload_url }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Create Release
        id: create_release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: "Release ${{ github.ref_name }}"
          draft: true
          prerelease: false

  build-tauri:
    needs: create-release
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          # Linux
          - platform: ubuntu-22.04
            args: ""
            rust_target: ""
          # macOS - Apple Silicon
          - platform: macos-latest
            args: "--target aarch64-apple-darwin"
            rust_target: "aarch64-apple-darwin"
          # macOS - Intel
          - platform: macos-latest
            args: "--target x86_64-apple-darwin"
            rust_target: "x86_64-apple-darwin"
          # Windows
          - platform: windows-latest
            args: ""
            rust_target: ""

    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            build-essential \
            curl \
            wget \
            file \
            libxdo-dev \
            libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            patchelf

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "lts/*"
          cache: "npm"

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.rust_target }}

      - name: Cache Rust dependencies
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: "src-tauri -> target"

      - name: Install frontend dependencies
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # Windows signing
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
          # Update signing
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Release ${{ github.ref_name }}"
          releaseBody: "See the assets to download the app for your platform."
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}

  publish-release:
    runs-on: ubuntu-latest
    needs: [create-release, build-tauri]
    permissions:
      contents: write
    steps:
      - name: Publish release
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.repos.updateRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              release_id: ${{ needs.create-release.outputs.release_id }},
              draft: false
            });
```

### Simplified Workflow Using `tauri-action`

If you want a simpler setup where `tauri-action` handles everything including release creation:

```yaml
# .github/workflows/release-simple.yml
name: Release (Simple)

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-22.04
            args: ""
          - platform: macos-latest
            args: "--target universal-apple-darwin"
          - platform: windows-latest
            args: ""

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            build-essential \
            curl wget file \
            libxdo-dev libssl-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev patchelf

      - uses: actions/setup-node@v4
        with:
          node-version: "lts/*"
          cache: "npm"

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: "src-tauri -> target"

      - run: npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "${{ github.ref_name }}"
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
          includeUpdaterJson: true
```

### Required GitHub Secrets

Configure these secrets in your repository settings (Settings > Secrets and variables > Actions):

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `APPLE_SIGNING_IDENTITY` | e.g., `Developer ID Application: My Company (TEAMID)` |
| `APPLE_ID` | Apple ID email for notarization |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WINDOWS_CERTIFICATE` | Base64-encoded `.pfx` certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the `.pfx` file |
| `TAURI_SIGNING_PRIVATE_KEY` | Update signing private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |

### Encoding Certificates for GitHub Secrets

```bash
# macOS certificate
base64 -i Certificates.p12 | pbcopy

# Windows certificate
certutil -encode certificate.pfx certificate-base64.txt
# or on Linux/macOS:
base64 -i certificate.pfx
```

---

## 9. Reducing Binary Size

### Strategies Overview

A default Tauri release build is already small compared to Electron, but you can reduce it further.

| Technique | Size Reduction | Trade-off |
|-----------|---------------|-----------|
| `strip = true` | 30-60% | No debug symbols |
| `opt-level = "z"` | 10-20% | Slightly slower runtime |
| `lto = true` | 10-20% | Much slower compile |
| `codegen-units = 1` | 5-10% | Slower compile |
| `panic = "abort"` | 5-10% | No panic unwinding |
| UPX compression | 30-50% | Startup time increase |

### Cargo.toml Profile (Complete)

```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
panic = "abort"
```

### UPX Compression

[UPX](https://upx.github.io/) compresses executables. It works on Linux and Windows binaries (not macOS, as Apple's code signing breaks).

```bash
# Install UPX
# Ubuntu/Debian:
sudo apt-get install upx

# macOS (for compressing Linux/Windows binaries):
brew install upx

# Compress the binary
upx --best --lzma src-tauri/target/release/my-app

# Check the result
upx -l src-tauri/target/release/my-app
```

> **Warning:** Do not use UPX on macOS `.app` bundles. It breaks the code signature. On Windows, some antivirus software flags UPX-compressed binaries as suspicious.

### Analyzing Binary Size with `cargo-bloat`

```bash
# Install cargo-bloat
cargo install cargo-bloat

# Show the largest functions
cargo bloat --release -n 20 --manifest-path src-tauri/Cargo.toml

# Show the largest crates
cargo bloat --release --crates --manifest-path src-tauri/Cargo.toml
```

Example output:

```
File  .text     Size Crate
3.2%  10.5% 154.3Ki std
2.1%   6.8%  99.8Ki tauri
1.5%   5.0%  73.2Ki serde_json
...
```

### Additional Rust Optimizations

```toml
# Cargo.toml -- minimize dependency features
[dependencies]
tauri = { version = "2", default-features = false, features = [
  # Only include the features you actually use
] }
serde = { version = "1", features = ["derive"] }
```

```bash
# Find unused dependencies
cargo install cargo-udeps
cargo +nightly udeps --manifest-path src-tauri/Cargo.toml

# Visualize the dependency tree
cargo tree --manifest-path src-tauri/Cargo.toml
```

---

## 10. Error Reporting and Analytics

### Crash Reporting with `sentry-tauri`

[Sentry](https://sentry.io) provides a dedicated Tauri integration for crash reporting.

**Install dependencies:**

```bash
cargo add sentry sentry-tauri --manifest-path src-tauri/Cargo.toml
```

**Configure in `src-tauri/src/lib.rs`:**

```rust
use sentry_tauri::sentry;

pub fn run() {
    let client = sentry::init((
        "https://your-dsn@sentry.io/project-id",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            auto_session_tracking: true,
            ..Default::default()
        },
    ));

    // Ensure the client is kept alive for the duration of the app
    let _guard = minidump_support(&client);

    tauri::Builder::default()
        .plugin(sentry_tauri::plugin())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn minidump_support(client: &sentry::Client) -> sentry::ClientInitGuard {
    // sentry_tauri handles native crash reporting
    // This guard keeps Sentry alive until the app exits
    unsafe {
        // The guard is already created by sentry::init
        // Just return a reference concept -- in practice, the
        // init() return value IS the guard.
        std::mem::zeroed() // placeholder; real code uses the init return
    }
}
```

A simpler, practical setup:

```rust
use sentry_tauri::sentry;

pub fn run() {
    let _guard = sentry::init((
        "https://your-dsn@sentry.io/project-id",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            ..Default::default()
        },
    ));

    tauri::Builder::default()
        .plugin(sentry_tauri::plugin())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Frontend error reporting:**

```typescript
// src/lib/errorReporting.ts
import * as Sentry from "@sentry/browser";

export function initErrorReporting() {
  Sentry.init({
    dsn: "https://your-frontend-dsn@sentry.io/project-id",
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Use throughout your app
export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}
```

### Logging in Production

Use the `log` crate with a file-based logger for production:

```toml
# Cargo.toml
[dependencies]
log = "0.4"
tauri-plugin-log = "2"
```

```rust
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("app".into()),
                    }),
                ])
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .max_file_size(5_000_000) // 5 MB per log file
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Log files are stored in the platform-specific app log directory:

| Platform | Path |
|----------|------|
| Linux | `~/.local/share/com.mycompany.myapp/logs/` |
| macOS | `~/Library/Logs/com.mycompany.myapp/` |
| Windows | `C:\Users\<User>\AppData\Local\com.mycompany.myapp\logs\` |

### Analytics Considerations

When adding analytics to desktop applications, keep the following in mind:

- **Privacy laws**: GDPR, CCPA, and others require disclosure and often consent.
- **Opt-in/opt-out**: Always provide a clear toggle in settings. Consider making analytics opt-in by default.
- **Data minimization**: Collect only what you need. Avoid personally identifiable information.
- **Offline handling**: Desktop apps are often offline. Queue events and send them when connectivity returns.
- **Transparent communication**: Document what you collect in your privacy policy.

Popular analytics options for desktop apps:
- **PostHog** (self-hostable, open source)
- **Aptabase** (privacy-focused, built for desktop/mobile)
- **Plausible** (self-hostable, lightweight)
- Custom telemetry via your own API

---

## 11. Distribution

### Distributing Outside App Stores

Most Tauri apps are distributed directly to users via websites, GitHub Releases, or custom update servers rather than through app stores.

### Windows SmartScreen

Windows SmartScreen warns users about unrecognized applications. To handle this:

1. **Code sign your application** (see [Section 6](#6-code-signing---windows)). An EV certificate provides immediate SmartScreen trust; an OV certificate builds trust over time as more users install your app.
2. **Submit to Microsoft** for analysis (optional): [https://www.microsoft.com/wdsi/filesubmission](https://www.microsoft.com/wdsi/filesubmission)
3. **Be patient**: SmartScreen reputation builds over time with OV certificates as users install and run your app without issues.

### macOS Gatekeeper

Gatekeeper blocks unsigned or un-notarized applications:

- **Signed + Notarized**: App opens normally with no warnings.
- **Signed only**: Warning dialog, user can right-click > Open to bypass.
- **Unsigned**: Blocked entirely by default. User must go to System Settings > Privacy & Security to allow it.

Always sign and notarize your macOS builds for production. See [Section 5](#5-code-signing---macos).

### Linux Package Managers

For broader Linux distribution:

**Flathub (Flatpak):**

```yaml
# com.mycompany.myapp.yml (Flatpak manifest)
app-id: com.mycompany.myapp
runtime: org.gnome.Platform
runtime-version: "45"
sdk: org.gnome.Sdk
command: my-app
finish-args:
  - --share=ipc
  - --share=network
  - --socket=fallback-x11
  - --socket=wayland
  - --device=dri
modules:
  - name: my-app
    buildsystem: simple
    build-commands:
      - install -Dm755 my-app /app/bin/my-app
    sources:
      - type: file
        path: my-app
```

**Snap Store:**

```yaml
# snapcraft.yaml
name: my-app
version: "1.0.0"
summary: Short description
description: |
  Longer description of my application.
grade: stable
confinement: strict
base: core22

apps:
  my-app:
    command: my-app
    extensions:
      - gnome
    plugs:
      - network
      - home

parts:
  my-app:
    plugin: dump
    source: src-tauri/target/release/bundle/deb/
    source-type: local
```

**AUR (Arch Linux):**

```bash
# PKGBUILD
pkgname=my-app
pkgver=1.0.0
pkgrel=1
pkgdesc="Description of my application"
arch=('x86_64')
url="https://github.com/myuser/myapp"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3')
source=("$pkgname-$pkgver.tar.gz::https://github.com/myuser/myapp/archive/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
    cd "$srcdir/$pkgname-$pkgver"
    npm ci
    cargo tauri build --bundles none
}

package() {
    cd "$srcdir/$pkgname-$pkgver"
    install -Dm755 "src-tauri/target/release/$pkgname" "$pkgdir/usr/bin/$pkgname"
    install -Dm644 "resources/$pkgname.desktop" "$pkgdir/usr/share/applications/$pkgname.desktop"
    install -Dm644 "src-tauri/icons/128x128.png" "$pkgdir/usr/share/pixmaps/$pkgname.png"
}
```

---

## 12. Versioning and Changelog

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/) (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible API changes, major UI overhauls)
- **MINOR**: New features (backwards-compatible additions)
- **PATCH**: Bug fixes (backwards-compatible fixes)

Keep versions synchronized across your project:

```jsonc
// tauri.conf.json
{
  "version": "1.2.3"
}
```

```toml
# src-tauri/Cargo.toml
[package]
version = "1.2.3"
```

```json
// package.json
{
  "version": "1.2.3"
}
```

### Automating Version Bumps

Create a script to keep versions in sync:

```bash
#!/usr/bin/env bash
# scripts/bump-version.sh
set -euo pipefail

NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./scripts/bump-version.sh <version>"
  exit 1
fi

echo "Bumping version to $NEW_VERSION..."

# Update package.json
npm version "$NEW_VERSION" --no-git-tag-version

# Update Cargo.toml
sed -i.bak "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

# Update tauri.conf.json
# Using node for reliable JSON editing
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
conf.version = '$NEW_VERSION';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

# Update Cargo.lock
cargo check --manifest-path src-tauri/Cargo.toml

echo "Version bumped to $NEW_VERSION in all files."
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push && git push --tags"
```

### Automating Changelogs

**Using `git-cliff`** (Rust-based, highly configurable):

```bash
# Install
cargo install git-cliff

# Generate a changelog
git cliff --output CHANGELOG.md

# Generate changelog for the latest tag only
git cliff --latest --output CHANGELOG.md
```

Configuration in `cliff.toml`:

```toml
# cliff.toml
[changelog]
header = """
# Changelog

All notable changes to this project will be documented in this file.
"""
body = """
{% if version %}\
    ## [{{ version }}] - {{ timestamp | date(format="%Y-%m-%d") }}
{% else %}\
    ## [Unreleased]
{% endif %}\
{% for group, commits in commits | group_by(attribute="group") %}
    ### {{ group | upper_first }}
    {% for commit in commits %}
        - {{ commit.message | upper_first }} ([{{ commit.id | truncate(length=7, end="") }}](https://github.com/myuser/myapp/commit/{{ commit.id }}))\
    {% endfor %}
{% endfor %}\n
"""
footer = ""
trim = true

[git]
conventional_commits = true
filter_unconventional = true
commit_parsers = [
    { message = "^feat", group = "Features" },
    { message = "^fix", group = "Bug Fixes" },
    { message = "^perf", group = "Performance" },
    { message = "^refactor", group = "Refactoring" },
    { message = "^doc", group = "Documentation" },
    { message = "^style", group = "Styling" },
    { message = "^test", group = "Testing" },
    { message = "^chore", group = "Miscellaneous" },
]
```

### Complete Release Workflow

A full release workflow from version bump to published release:

```bash
#!/usr/bin/env bash
# scripts/release.sh
set -euo pipefail

NEW_VERSION="$1"
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  exit 1
fi

# 1. Ensure clean working directory
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working directory is not clean."
  exit 1
fi

# 2. Bump version in all files
./scripts/bump-version.sh "$NEW_VERSION"

# 3. Generate changelog
git cliff --tag "v$NEW_VERSION" --output CHANGELOG.md

# 4. Commit and tag
git add -A
git commit -m "chore: release v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 5. Push (triggers CI/CD build)
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "Release v$NEW_VERSION has been tagged and pushed."
echo "CI/CD will build and create the GitHub Release."
```

---

## 13. Coding Challenges

### Challenge 1: Complete CI/CD Pipeline

**Description:** Set up a complete GitHub Actions workflow that builds a Tauri application for all three platforms, runs tests before building, and publishes a GitHub Release with all artifacts.

**Requirements:**
- The workflow must trigger on version tags (`v*`).
- Run `cargo test` and `npm test` before building.
- Build for Linux (x86_64), macOS (universal binary), and Windows (x86_64).
- Upload all bundle artifacts (`.deb`, `.AppImage`, `.dmg`, `.msi`, `.nsis`) to a draft GitHub Release.
- Generate and include `latest.json` for the auto-updater.
- Cache Rust and Node.js dependencies for faster builds.

**Hints:**
- Use `tauri-apps/tauri-action@v0` which handles most of the heavy lifting.
- Add a separate job at the beginning of the workflow for running tests.
- Use `needs:` to make the build jobs depend on successful tests.
- The `Swatinem/rust-cache@v2` action works well for caching Rust builds.
- Set `includeUpdaterJson: true` in the tauri-action inputs to generate the updater manifest.

---

### Challenge 2: Auto-Update System with Custom UI

**Description:** Implement a complete auto-update system with a custom React/TypeScript UI that shows update availability, release notes, a download progress bar, and a restart prompt.

**Requirements:**
- Check for updates automatically 60 seconds after app launch, and then every 6 hours.
- Display a non-intrusive notification banner when an update is available.
- Show the new version number and formatted release notes (Markdown).
- Provide "Update Now" and "Remind Me Later" buttons.
- When updating, show a progress bar with percentage and downloaded/total bytes.
- After the download completes, prompt the user to restart.
- Allow the user to dismiss the prompt and restart later via a menu option.
- Persist a "skip this version" preference so users can ignore a specific release.

**Hints:**
- Use `@tauri-apps/plugin-updater` for the update check and download.
- Use `@tauri-apps/plugin-process` for `relaunch()`.
- Store the "skipped version" in `localStorage` or via `tauri-plugin-store`.
- The `check()` function returns an object with `version` and `body` (release notes).
- The `downloadAndInstall` callback gives you `Started`, `Progress`, and `Finished` events.

---

### Challenge 3: Binary Size Optimization Report

**Description:** Write a script that builds the Tauri app with different optimization profiles, measures the resulting binary sizes, and produces a comparison report.

**Requirements:**
- Define at least four Cargo profiles: `release-default`, `release-size`, `release-speed`, `release-balanced`.
- Each profile should use different combinations of `opt-level`, `lto`, `codegen-units`, `strip`, and `panic`.
- Build the app with each profile and record the binary size and build time.
- Optionally apply UPX compression and record the compressed size.
- Output a formatted table comparing all profiles.
- Identify unused dependencies using `cargo udeps` and report them.

**Hints:**
- Define custom profiles in `Cargo.toml` using `[profile.release-size]` with `inherits = "release"`.
- Use `time` or `date` commands to measure build duration.
- Use `stat` or `wc -c` to measure file sizes.
- `cargo bloat --crates --release` shows which crates contribute most to binary size.
- Format output with `printf` or `column -t` for a clean table.

---

### Challenge 4: Production Error Reporting Pipeline

**Description:** Implement end-to-end error reporting that captures both Rust panics and frontend JavaScript errors, enriches them with app context, and reports them to a central service.

**Requirements:**
- Set up `sentry-tauri` for Rust-side crash and error reporting.
- Set up `@sentry/browser` for frontend error reporting.
- Create a custom Tauri command that collects diagnostic info (app version, OS, memory usage, WebView version).
- Attach this diagnostic context to every error report.
- Implement a global frontend error boundary that catches React errors and reports them.
- Add a "Report a Problem" button that lets users manually submit feedback with a description and automatic log attachment.
- Collect the last 100 lines of log files (from `tauri-plugin-log`) and attach them to reports.

**Hints:**
- Use `sentry::configure_scope` to attach custom context to Rust errors.
- Use `Sentry.setContext()` on the frontend to attach device/app info.
- Use `tauri::api::os` functions (or `std::env::consts`) to get OS information.
- For the error boundary, use React's `componentDidCatch` or the `react-error-boundary` library.
- Read log files via a Tauri command that uses `app.path().app_log_dir()`.

---

### Challenge 5: Multi-Channel Release System

**Description:** Build a release system that supports multiple update channels (stable, beta, nightly) so users can opt into early releases.

**Requirements:**
- Create three update channels: `stable`, `beta`, and `nightly`.
- Each channel has its own update endpoint URL.
- Add a settings page where users can select their preferred update channel.
- Persist the channel selection across app restarts.
- The app should check the correct endpoint based on the selected channel.
- Implement channel-specific logic: nightly checks every hour, beta checks every 12 hours, stable checks every 24 hours.
- Show a visual indicator in the app's title bar or status bar indicating the current channel (e.g., "[BETA]" suffix).
- Ensure that downgrading from a higher channel to a lower one warns the user that they will not receive updates until the stable channel surpasses their current version.

**Hints:**
- Use `tauri-plugin-store` to persist the channel preference.
- Dynamically construct the updater URL at runtime based on the selected channel: e.g., `https://releases.myapp.com/{channel}/{{target}}/{{arch}}/{{current_version}}`.
- Use `tauri_plugin_updater::Builder::new().endpoints(urls)` in Rust to set endpoints programmatically, or override via frontend logic.
- Use `setInterval` on the frontend to schedule periodic update checks at channel-specific intervals.
- Compare version strings using a SemVer library (e.g., `semver` crate in Rust or `semver` npm package) to detect downgrades.
