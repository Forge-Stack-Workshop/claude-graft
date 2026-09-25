---
name: powershell-patterns
description: PowerShell 5.1/7+ idioms, verb-noun cmdlet design, strict-mode error handling, machine-agnostic paths, and Pester-testable seams for robust, maintainable automation scripts.
origin: chrysa
---

# PowerShell Development Patterns

Idiomatic PowerShell for automation and provisioning code that must run
unattended, elevated, and on a machine that is not the author's. Written for
cross-edition scripts (Windows PowerShell 5.1 **and** PowerShell 7+).

## When to Activate

- Writing or reviewing `.ps1` / `.psm1` code
- Building install/bootstrap/maintenance scripts or class-based libraries
- Adding tests to PowerShell that had none
- Refactoring a script that hardcodes paths, swallows errors, or resists testing

## Not for

- Bash/`.sh` provisioning (use the shell conventions instead)
- One-liners typed interactively — these are conventions for committed code

## Core Principles

### 1. Approved verb-noun naming

Every function is `Verb-Noun`, the verb drawn from `Get-Verb` (Install, Set,
New, Get, Test, Remove, Invoke…). A non-approved verb makes a module warn on
import and hides the command from discovery.

```powershell
# Good
function Install-Software { ... }
function Test-AdminContext { ... }

# Bad — unapproved verb, plural noun
function Setup-Softwares { ... }
```

### 2. One class per file, prefixed

Business logic lives in classes, one per file. In chrysa repos they are `Lib`-prefixed
(`LibConfiguration`, `LibSystem`). A class file is dot-sourceable and has **no
side effect at load** — construction does the work, loading does not.

```powershell
class LibSoftware {
    [LibConfiguration] $Config
    LibSoftware([LibConfiguration] $config) { $this.Config = $config }
    [void] Install([string] $id) { ... }
}
```

### 3. Fail loud, fail early

Opt into strict mode and stop-on-error at the top of every entry script. A
native command failure is invisible unless you check `$LASTEXITCODE` — the
`$?`/`throw` machinery only covers cmdlets.

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

winget install --id $id --silent
if ($LASTEXITCODE -ne 0) {
    throw "winget failed for '$id' (exit $LASTEXITCODE)"
}
```

Catch typed, not blanket:

```powershell
try {
    $content = Get-Content -Path $path -Raw -ErrorAction Stop
} catch [System.IO.FileNotFoundException] {
    Write-Warning "missing $path, using default"
    $content = $default
}
```

### 4. Machine-agnostic paths — never hardcode a home

A script that bakes in `C:\Users\anthony\repos` runs on exactly one machine.
Resolve every path from the environment, with a documented default.

```powershell
# Good — env with a fallback
$repoRoot = if ($env:WIN_REPO_FOLDER) { $env:WIN_REPO_FOLDER }
            else { Join-Path $env:USERPROFILE 'repos' }

# Bad
$repoRoot = 'C:\Users\anthony\repos'
```

Build paths with `Join-Path`, never string concatenation with `\`.

### 5. Output streams have meanings — don't abuse `Write-Host`

`Write-Output` (or a bare expression) emits *data* onto the pipeline.
`Write-Host` writes to the host UI and is **not** capturable as a return value —
reserve it for human-facing menus and progress. Use `Write-Verbose` /
`Write-Warning` / `Write-Error` for their streams. A function that returns a
value must not `Write-Host` it.

### 6. Advanced functions: CmdletBinding + validated params

```powershell
function Set-Permission {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string] $Path,
        [ValidateSet('Read', 'Write', 'FullControl')][string] $Right = 'Read'
    )
    if ($PSCmdlet.ShouldProcess($Path, "grant $Right")) { ... }
}
```

`-WhatIf` support and parameter validation move whole classes of error to call
time. Give every public function comment-based help (`.SYNOPSIS`, `.PARAMETER`,
`.EXAMPLE`).

## Testability — pure-logic seams + Pester

PowerShell resists testing because construction loads real config and functions
call cmdlets that hit the machine. Two moves make it testable without a live host:

### Separate pure logic from side effects

Extract the decision (a pure function of its inputs) from the action (the cmdlet
call). The pure part gets exhaustive tests; the thin action part is mocked at
its boundary.

```powershell
# Pure — no cmdlet, dot-sourceable, trivially testable
function Get-PadIndex([int] $current, [int] $total) {
    $width = "$total".Length
    return "[{0}/{1}]" -f "$($current + 1)".PadLeft($width), $total
}
```

### Pester v5 + capture the right stream

`Write-Host` output is capturable via the information stream (`6>&1`); mock
cmdlets at the boundary so no real install/registry write happens.

```powershell
Describe 'Get-PadIndex' {
    It 'pads to the width of the total and is 1-based' {
        Get-PadIndex 9 10 | Should -Be '[10/10]'
    }
}

Describe 'Install-Software' {
    It 'throws when winget fails' {
        Mock winget { $global:LASTEXITCODE = 1 }
        { Install-Software -Id 'X' } | Should -Throw
    }
}
```

Run with a pinned Pester (`>=5`), code coverage on the modules under test, and a
non-zero exit on any failure so CI gates on it.

## Security — the boundary is hostile

- **No secrets in source, logs, or committed fixtures.** No plaintext password,
  token, or key path baked into a `.ps1`.
- **Elevation is checked, not assumed.** A script that needs admin verifies it
  (`#requires -RunAsAdministrator` or an explicit `Test-AdminContext`) instead of
  failing halfway with a partial change.
- **Any external value is untrusted input.** The sharpest PowerShell bug class:
  a scanned value (an extension name, a git config value) interpolated into a
  *generated* script. A newline ends the line it lands on — a `#` comment stops
  being a comment, a quoted literal stops being quoted — and `"$(...)"` in a
  double-quoted string is **executed**. Contain at the single point of emission:
  single-quote and escape, or emit through a serializer, never string-concatenate
  a scanned value into code. Validate on write, not at each future sink.

## Anti-patterns

- `Write-Host` used to return data (breaks composition and testing)
- Hardcoded machine paths / user names
- Bare `catch {}` that swallows every error, or ignoring `$LASTEXITCODE`
- Aliases in scripts (`ls`, `%`, `?`, `gci`) — write `Get-ChildItem`, `ForEach-Object`, `Where-Object`
- Side effects at module load (work belongs in a constructor/function)
- `+=` in a loop to grow an array (O(n²) reallocation) — collect then assign, or use a `List`
- Unapproved verbs and plural nouns
