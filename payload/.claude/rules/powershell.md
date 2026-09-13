---
description: PowerShell conventions. Use when writing or reviewing PowerShell code.
paths:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"
---

# PowerShell

- Cross-edition unless the project says otherwise: it runs on Windows PowerShell
  5.1 **and** PowerShell 7+. Do not use 7-only syntax without a fallback.
- Functions are `Verb-Noun`, the verb from `Get-Verb` (Install/Set/Get/Test/New/
  Remove/Invoke). Unapproved verbs and plural nouns warn on import and hide the
  command — never ship them.
- Every entry script opens with `Set-StrictMode -Version Latest` and
  `$ErrorActionPreference = 'Stop'`. A native command's failure is invisible
  otherwise — check `$LASTEXITCODE` after every external call and `throw` on it.
- `catch` typed exceptions, never a bare `catch {}` that swallows everything.
- Business logic in classes, one per file. Loading a file has **no side effect** —
  construction does the work. Public functions carry comment-based help.
- Advanced functions use `[CmdletBinding()]`, `param()` with `[Validate*]`
  attributes, and `SupportsShouldProcess` (`-WhatIf`) for anything destructive.
- `Write-Output` (or a bare expression) is data on the pipeline; `Write-Host` is
  host UI and is **not** capturable — never return a value through it. Use
  `Write-Verbose`/`Write-Warning`/`Write-Error` for their streams.

## Machine-agnostic

- Never hardcode a home or user path. Resolve from the environment with a
  documented default (`$env:USERPROFILE`, project-specific vars), and build paths
  with `Join-Path`, never `"$a\$b"`.
- No aliases in committed scripts: `Get-ChildItem`/`ForEach-Object`/`Where-Object`,
  not `ls`/`%`/`?`.

## Testing — Pester

- Tests with Pester `>=5`, code coverage on the modules under test, non-zero
  exit on failure so CI gates on it.
- Separate the pure decision (a function of its inputs, no cmdlet) from the
  side-effecting action; test the pure part exhaustively, mock cmdlets at their
  boundary so no real install/registry write happens. Capture `Write-Host` via
  the information stream (`6>&1`).

## Security

- No secret, token, or key path in source, logs, or committed fixtures.
- A script needing admin verifies it (`#requires -RunAsAdministrator` or an
  explicit check) — it does not fail halfway with a partial change.
- Any external value is untrusted. Interpolating a scanned value into a
  **generated** script is the sharpest bug class here: a newline ends the line it
  lands on, and `"$(...)"` in a double-quoted string executes. Contain at the
  single point of emission — quote/escape or serialize, never concatenate a
  scanned value into code.
