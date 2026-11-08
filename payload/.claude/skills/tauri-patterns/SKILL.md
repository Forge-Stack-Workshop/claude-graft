---
name: tauri-patterns
description: >-
  Desktop app architecture with Tauri v2 (Rust core + web front) — a lightweight
  alternative to Electron. Covers the Rust/JS IPC boundary, capability-based
  security, window/tray management, sidecar & local process supervision,
  auto-update, and per-OS packaging. TRIGGER whenever the work targets a desktop
  app / thick client — "desktop app", Tauri, "native window around a web UI",
  supervising local agents or processes (start/stop/logs), system tray, or
  cross-platform desktop packaging.
---

# Tauri Patterns

Build desktop apps as a **Rust core + web front over a native webview** — small
binaries, low RAM, real OS access. A strong alternative to Electron when
performance and bundle size matter. Direct fit for a thick client that installs
and supervises **local processes/agents** with start/stop/logs.

The web front reuses your existing React/web patterns; this skill owns the
**Tauri-specific** boundary, security, and OS integration.

## When to Use

- Any desktop / thick-client target
- Supervising local processes/agents from a GUI
- Native window/tray/menu, filesystem, background, or remote-access desktop
- Cross-platform desktop packaging & updates

## Do NOT Use For

- Mobile targets → a mobile skill
- Web-only UIs → a web/React skill
- Pure information-architecture / user-journey work → a UX-flow skill

## Architecture — the two halves

- **Front (webview)**: your web stack (e.g. React + Vite + TS + a component
  library). It renders and calls into Rust; it holds **no privileged capability**
  itself.
- **Core (Rust)**: exposes `#[tauri::command]` functions as the *only* privileged
  surface. Keep business/OS logic in Rust, typed at the boundary. Emit **events**
  (`app.emit`) for streaming state (process logs, progress) rather than polling.
- **IPC contract**: treat the command set as an API — narrow, typed, versioned.
  Validate every argument in Rust; never trust the webview.

## Security (Tauri v2 capabilities)

- **Capability-based allowlist**: grant only the permissions each window needs,
  in `capabilities/*.json`. Default-deny; no blanket `fs`/`shell` access.
- **Sidecars & shell**: bundle external binaries as sidecars with an explicit
  arg allowlist; never pass user input straight to a shell. Keep an
  injection-safe posture — pass the command as a fixed argument, validate inputs.
- **CSP** on the webview; no remote code; assets bundled.
- **Secrets**: OS keychain via a Rust plugin, never in the webview or localStorage.

## Local process/agent runtime

- Spawn/supervise processes as **child processes or sidecars** from Rust; stream
  stdout/stderr to the front via events; expose start/stop/health/logs commands.
- Persist state so the app recovers supervision after restart.
- **Tray-first**: run in the system tray, window optional; lifecycle independent
  of the visible window (close-to-tray, not quit).
- Optional headless/remote access (bind on LAN / VPN) — always behind auth,
  never open.

## Windows, updates, packaging

- **Windowing**: multi-window/pane state, remember size/position, single-instance
  guard, deep-link handling.
- **Auto-update**: Tauri updater with signed artifacts; a broken updater is worse
  than none — test the rollback path.
- **Packaging**: per-OS bundles (`.dmg`/`.app`, `.msi`/NSIS, `.deb`/AppImage);
  code-sign where feasible; CI matrix per target.

## Output / workflow

1. Define the command/event contract (the IPC API) first.
2. Set capabilities default-deny.
3. Build front + core.
4. Wire process supervision via events.
5. Package + signed updater; test update & rollback.

## Notes

- The IPC boundary is your security boundary — design it before features.
- Tauri reference precedent: `coollabsio/jean` (Tauri v2 + React + Rust) —
  inspiration for process supervision + Cmd+K, not a dependency.
