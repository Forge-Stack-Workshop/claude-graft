---
name: powershell-automation
description: PowerShell automation fundamentals — cmdlets, the object pipeline, scripting, modules, Desired State Configuration (DSC), remoting, and error handling. Covers both Windows PowerShell 5.1 and cross-platform PowerShell 7+.
origin: Windows Server 2016 Automation with PowerShell Cookbook (Thomas Lee, 2nd Edition)
---

# PowerShell Automation

Automate administrative and infrastructure tasks at scale using cmdlets, the
object pipeline, modular scripting, and declarative configuration via DSC.
Prefer **PowerShell 7+** (cross-platform, built on .NET) for any new
automation unless a task is tied to a Windows-only surface (e.g., WMI/CIM
providers, GUI-only MMC snap-ins, or legacy `ActiveDirectory`/`GroupPolicy`
modules that still require Windows PowerShell 5.1 via the compatibility
layer).

## Prerequisites (preflight)

Check that PowerShell 7 (`pwsh`) is available:
```bash
command -v pwsh || echo "WARN: install PowerShell 7"
```

If missing, install PowerShell 7+ from https://github.com/PowerShell/PowerShell or your package manager.

## When to use this skill

- Discovering and exploring available cmdlets/modules for a feature (Hyper-V,
  Active Directory, IIS, networking, backup, performance counters).
- Building reusable scripts or modules for provisioning or operational tasks.
- Implementing infrastructure-as-code via DSC — declaring desired server
  state rather than scripting imperative steps.
- Managing one or many remote systems via PowerShell Remoting.
- Writing scripts that must run unattended (scheduled tasks, CI/CD agents,
  pipelines) and therefore need robust, fail-fast error handling.

## PowerShell 5.1 vs 7+ — pick the right runtime

| | Windows PowerShell 5.1 | PowerShell 7+ |
| --- | --- | --- |
| Platform | Windows only | Windows, Linux, macOS |
| Engine | .NET Framework | .NET (Core) |
| Parallelism | none built-in | `ForEach-Object -Parallel` |
| Remoting transport | WinRM only | WinRM + SSH |
| Ternary / null-coalescing | no | `?:`, `??`, `??=` |
| Module compatibility | native | `Import-Module -UseWindowsPowerShell` shim for WinPS-only modules |

Default to `pwsh` for new scripts. Only pin to `powershell.exe` (5.1) when a
dependency (e.g. `ActiveDirectory`, some vendor modules) has no PS7 build —
in that case, load it from PS7 via
`Import-Module ActiveDirectory -UseWindowsPowerShell` rather than rewriting
the whole script in 5.1.

## Cmdlet Discovery & the Object Pipeline

**Discovery:**

- `Get-Command -Verb Get -Noun *Service*` — find cmdlets by verb/noun pattern.
- `Get-Command -Module Hyper-V` — list all cmdlets in a module.
- `Get-Help <cmdlet> -Full` / `-Examples` — read documentation and examples.
- `Show-Command -Name <cmdlet>` — interactive parameter-builder UI.
- After installing Windows features (RSAT) or new modules, start a fresh
  session — cmdlet discovery caches at session start.

**Pipeline (the core paradigm):** cmdlets pass **.NET objects**, not text, so
downstream commands can filter/sort/select on real properties without
parsing strings.

```powershell
Get-Service |
    Where-Object Status -eq 'Running' |
    Sort-Object DisplayName |
    Select-Object Name, DisplayName, StartType
```

- Every stage receives and emits objects — no intermediate variables needed.
- `Tee-Object -Variable debug` mid-pipeline to inspect without breaking the chain.
- `Get-Member` on any pipeline output to discover available properties/methods
  before writing a `Where-Object`/`Select-Object` filter — never guess property names.
- `ForEach-Object -Parallel { ... } -ThrottleLimit 8` (PS7+) to fan out
  independent, side-effect-safe work (e.g. querying N servers) instead of a
  serial loop.

**Pipeline pitfall:** `Format-Table`/`Format-List` output is display-only
text — never pipe it into another cmdlet or parse it. Keep object-typed
output all the way to the final display step.

## Modules, PowerShellGet, and Remoting

**Modules:**

- `Get-Module -ListAvailable` — see all installed modules; without
  `-ListAvailable`, only currently loaded ones.
- `Import-Module <name>` — explicit load when auto-import doesn't trigger
  (e.g. module not on `$env:PSModulePath`).
- `Install-Module -Name <module> -Scope CurrentUser` — install from the
  PowerShell Gallery; prefer `-Scope CurrentUser` over machine-wide installs
  unless the module must be available to all users/services.
- `Install-PSResource` (PSResourceGet, PS7.4+) is the modern replacement for
  `Install-Module`/`Install-Script` — faster, better dependency resolution.
- Auto-load domain-specific modules from `$PROFILE`, not by hardcoding
  `Import-Module` in every script that happens to need them.

**Remoting:**

```powershell
# One-off command across a batch of computers — single round trip per host,
# not a loop of individual connections
Invoke-Command -ComputerName $servers -ScriptBlock { Get-Service W32Time }

# Persistent session — reuse for multiple commands, avoids reconnect overhead
$session = New-PSSession -ComputerName Server01
Invoke-Command -Session $session -ScriptBlock { Get-Process }
Remove-PSSession $session

# PS7+: SSH-based remoting to Linux or Windows targets, no WinRM required
Invoke-Command -HostName linux-host -UserName deploy -ScriptBlock { uname -a }
```

- Always pass an **array** to `-ComputerName`/`-Session` for fan-out work —
  never `Invoke-Command` inside a `foreach` loop (see pitfalls below).
- `Enter-PSSession` for interactive troubleshooting only; scripts should use
  `Invoke-Command`/`New-PSSession` for repeatable, non-interactive execution.

## Scripting Essentials

- `[CmdletBinding()]` + `param()` block with typed parameters on every script
  and function — enables `-Verbose`, `-WhatIf`/`-Confirm`, and pipeline binding.
- `-ErrorAction Stop` on critical cmdlets so failures raise a catchable
  terminating error instead of silently continuing.
- Wrap risky operations in `try/catch` against **specific** exception types —
  never a bare `catch`.

```powershell
function Backup-ConfigFile {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Destination = "$Path.bak"
    )
    try {
        if ($PSCmdlet.ShouldProcess($Path, 'Backup')) {
            Copy-Item -Path $Path -Destination $Destination -ErrorAction Stop
        }
    } catch [System.IO.FileNotFoundException] {
        Write-Error "Source file not found: $Path"
    } catch [System.UnauthorizedAccessException] {
        Write-Error "Permission denied writing to: $Destination"
    }
}
```

- `Write-Verbose`, `Write-Warning`, `Write-Error`, `Write-Information` for
  severity-based output — reserve `Write-Host` for genuinely
  console-only, human-facing text (banners, prompts); it cannot be captured,
  redirected, or tested against.
- `SupportsShouldProcess` + `$PSCmdlet.ShouldProcess()` on anything
  destructive, so callers get `-WhatIf`/`-Confirm` for free.
- Pester for unit/integration tests (`Describe`/`It`/`Should`); mock external
  calls (`Mock Get-Service { ... }`) so tests don't depend on live
  infrastructure.

## Desired State Configuration (DSC)

DSC declares the **desired end state** of a system; the Local Configuration
Manager (LCM) reconciles actual state to it, repeatedly and idempotently —
prefer it over ad hoc provisioning scripts for anything you'll apply more
than once.

```powershell
Configuration WebServerConfig {
    Import-DscResource -ModuleName PSDesiredStateConfiguration

    Node 'WebServer01' {
        WindowsFeature IIS {
            Name   = 'Web-Server'
            Ensure = 'Present'
        }
        File IndexPage {
            DestinationPath = 'C:\inetpub\wwwroot\index.html'
            Contents        = '<html>OK</html>'
            Ensure          = 'Present'
            DependsOn       = '[WindowsFeature]IIS'
        }
    }
}

WebServerConfig -OutputPath .\MOF
Start-DscConfiguration -Path .\MOF -Wait -Verbose
```

- Built-in resources: `File`, `Registry`, `Service`, `WindowsFeature`, `User`,
  `Group`, `Script`; extend with community/third-party resource modules
  (`Find-DscResource`).
- `Test-DscConfiguration` before `Start-DscConfiguration` to check for drift
  without applying changes.
- Push mode (`Start-DscConfiguration`) for one-off/small fleets; pull mode
  (pull server or Azure Automation DSC) for fleets that must self-correct
  drift on a schedule without a human triggering each run.
- On PS7+, native DSC authoring is limited — MOF-based `Configuration`
  blocks still require Windows PowerShell 5.1, or use the newer
  cross-platform **DSC v3** (`dsc` CLI) for non-Windows targets.
- Version-control configuration `.ps1` sources, not just the compiled `.mof`
  files — the MOF is a build artifact, not the source of truth.

## Error Handling & Troubleshooting

- `$ErrorActionPreference = 'Stop'` at script top for consistent fail-fast
  behavior, then use targeted `-ErrorAction Continue` only where a
  non-fatal failure is genuinely expected.
- `$Error[0] | Select-Object *` / `$Error[0].ScriptStackTrace` to inspect the
  most recent exception's full type and origin.
- `Get-Error` (PS7+) gives a structured, more readable view of the last error
  record than `$Error[0]`.
- Structured logging: emit objects (`[PSCustomObject]`) to a transcript or
  `Export-Csv`/`ConvertTo-Json`, not free-text `Write-Host` lines — makes
  post-hoc analysis scriptable.
- `Start-Transcript`/`Stop-Transcript` to capture a full session for audit or
  incident review, especially for unattended scheduled tasks.

## Common Pitfalls

- **N+1 remoting:** calling `Invoke-Command` inside a `foreach ($server in $servers)`
  loop instead of passing the whole array via `-ComputerName`/`-Session` —
  each iteration pays a full connection round trip.
- **Bare `catch`:** swallows every exception type, including ones the script
  can't actually recover from. Catch specific types; let unexpected ones
  propagate.
- **Parsing formatted text:** piping `Format-Table` output, or worse,
  `.txt`/CLI-tool output, into `Where-Object`/regex instead of using
  cmdlets/CIM that return real objects.
- **`Write-Host` for data:** makes output unusable by callers/tests — reserve
  it for interactive-only messages.
- **Missing `-WhatIf` support:** destructive functions without
  `SupportsShouldProcess` give operators no dry-run option before a
  fleet-wide change.
- **Hardcoded credentials:** never embed passwords in scripts; use
  `Get-Credential`, a secret store (`Microsoft.PowerShell.SecretManagement`),
  or the platform's managed-identity/vault mechanism.
- **Ignoring PS7 availability:** defaulting to Windows PowerShell 5.1 syntax
  and modules on a new project that has no genuine Windows-only dependency.

## Pre-flight Checklist

- [ ] `pwsh` (PS7+) targeted unless a specific dependency forces Windows PowerShell 5.1.
- [ ] Script uses `[CmdletBinding()]` with typed, validated parameters.
- [ ] Error handling explicit (`try/catch` with specific types, or `-ErrorAction Stop`).
- [ ] Destructive actions gated behind `SupportsShouldProcess`/`-WhatIf`.
- [ ] Remoting batches targets via `-ComputerName`/`-Session` arrays, not loops.
- [ ] Output uses `Write-Verbose`/`Write-Warning`/`Write-Error`, not `Write-Host`, for anything non-interactive.
- [ ] No hardcoded secrets; credentials sourced from a vault or `Get-Credential`.
- [ ] DSC configurations version-controlled; drift checked with `Test-DscConfiguration` before applying.
- [ ] Pester tests cover the script's logic with external calls mocked.
