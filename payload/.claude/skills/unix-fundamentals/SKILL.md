---
name: unix-fundamentals
description: Core Unix/Linux concepts including shell commands, filesystem hierarchy, permissions, processes, pipes, redirections, signals, jobs, and basic system administration applicable across Unix variants (FreeBSD, Linux, macOS).
origin: "À la découverte d'UNIX/FreeBSD by Brice Errandonea"
---

# Unix Fundamentals

Essential Unix/Linux shell operations, system concepts, and portable system
administration. Concepts here apply across Unix variants (Linux distros,
FreeBSD/BSD family, macOS) unless a note flags a variant-specific difference.

## When to use this skill

- Learning or refreshing core Unix command line (shell, navigation, file operations)
- Navigating and understanding the Unix filesystem hierarchy (`/`, `/etc`, `/bin`, `/home`, `/var`, `/tmp`)
- Managing file permissions and ownership (read/write/execute for owner/group/others)
- Working with processes, jobs, and signals
- Using pipes, redirections, and command chaining
- Writing simple shell scripts or automation
- Basic system administration: services/daemons, scheduled tasks, privilege escalation

## Shell Basics

**Shell:** the command-line interpreter that reads and executes your commands
(`bash`, `zsh`, `sh`, `tcsh`, `csh` on BSD by default). Interactive shells load
startup files; non-interactive scripts usually declare their interpreter via
a shebang (`#!/bin/sh`).

Navigation:

- `pwd` — print current working directory
- `cd [path]` — change directory (`~` home, `-` previous, `.` current, `..` parent)
- `ls [-la]` — list files; `-l` detailed format, `-a` includes dotfiles
- `man command` / `man -k keyword` — manual page / keyword search across manuals
- `which command`, `type command` — locate the executable/builtin a name resolves to
- `history` — list previously run commands; `!!` repeats the last one

Paths:

- Absolute: starts with `/` (e.g., `/etc/passwd`), unambiguous regardless of
  current directory.
- Relative: no leading `/` (e.g., `Documents/file.txt`), resolved against the
  current working directory — a common source of scripting bugs when `cd`
  happens implicitly (cron, systemd units) with an unexpected working directory.
- Tab-completion and globbing (`*`, `?`, `[abc]`) are shell features, not
  filesystem features — the shell expands them before the command ever sees them.

## Filesystem Hierarchy

Unix organizes files in a single tree rooted at `/` — there is no per-drive
letter as on Windows; external media, network shares, and other partitions are
*mounted* onto directories within this same tree.

- `/bin`, `/sbin` — essential user/system binaries (may be merged into `/usr` on modern Linux)
- `/etc` — system-wide configuration files
- `/home` — user home directories (`/Users` on macOS)
- `/root` — superuser's home directory (kept outside `/home` so it stays
  reachable even if `/home` is a separate, unmounted partition)
- `/var` — variable data: logs (`/var/log`), spool queues, caches
- `/tmp` — temporary files, often cleared on reboot or by a periodic job
- `/usr` — user-installed programs, libraries, and shared data
- `/dev` — device files (disks, terminals, `/dev/null`) — files are the
  universal interface to devices in Unix
- `/proc` (Linux) or `procfs` mounts (some BSDs) — a virtual filesystem
  exposing live kernel/process state as files

**Pitfall:** filesystem layout varies by variant (`/usr/local` on BSD holds
third-party software separately from the base system; Linux distros differ on
`/bin` vs `/usr/bin` merges). Portable scripts should query paths (`which`,
package-manager variables) rather than hardcode them.

## Permissions

`ls -l` output, read left to right:

- 1st char: file type — `d` directory, `-` regular file, `l` symlink, `c`/`b` device
- Next 3: owner permissions (`r` read, `w` write, `x` execute)
- Next 3: group permissions
- Last 3: other (everyone else) permissions

Numeric (octal) form: `r=4, w=2, x=1`, summed per triad — `rwxr-xr-x` = `755`.

Commands:

- `chmod 755 file` — set permissions (owner=rwx, group=r-x, others=r-x)
- `chmod u+x file` / `chmod go-w file` — symbolic form, relative changes
- `chown user:group file` — change ownership (requires privilege for other users)
- `umask 022` — mask subtracted from default permissions when new files/dirs
  are created (default file mode 666, dir mode 777, minus the mask)

**Execute bit nuance:** on a regular file, `x` allows running it as a program
or script. On a directory, `x` allows *entering/traversing* it (and accessing
known filenames inside) — without it, even `r` (list) access won't let you
`cd` in or stat files by name. This is why directories often need `755` even
when their files are `644`.

**Special bits:** `chmod +s` (setuid/setgid) runs a program with the
permissions of its owner/group rather than the caller's — powerful and
dangerous, audit any setuid binary you don't recognize. `chmod +t` (sticky
bit) on a shared directory like `/tmp` restricts deletion of a file to its
owner even if others have write access to the directory.

## Processes

A process is a running instance of a program, identified by a PID (process ID).

- `ps aux` (BSD-style options) or `ps -ef` (POSIX-style) — list running processes
- `top` / `htop` — live view of process activity, CPU, and memory usage
- `pgrep name`, `pkill name` — find/signal processes by name pattern
- Every process has a parent (PPID); when a parent exits before reaping its
  children, they become orphans and are re-parented to `init`/PID 1

Jobs and background execution (interactive shell job control):

- `command &` — run in the background, shell prints a job number and PID
- `jobs` — list jobs of the current shell session
- `bg %1`, `fg %1` — resume a stopped job in background/foreground
- `Ctrl-Z` — suspend the foreground job (`SIGTSTP`), then `bg`/`fg` it
- `nohup command &` — detach the command from the terminal's hangup signal so
  it survives logout; combine with output redirection since nohup alone
  doesn't detach stdin/stdout

**Daemons:** long-running background processes with no controlling terminal,
usually launched at boot by the init system (`systemd`, BSD `rc`, `launchd`)
and named with a trailing `d` by convention (`sshd`, `cron`, `moused`) —
though this is a convention, not a rule.

## Signals

Signals are the kernel's mechanism for asynchronously notifying a process —
of a request to terminate, a terminal event, or an error condition. `kill`
sends a signal; despite the name, it can request graceful shutdown, not only
force-kill.

| Signal | Number | Meaning |
| --- | --- | --- |
| `HUP`  | 1  | Hang up — historically "terminal disconnected"; daemons often reinterpret it as "reload your config" |
| `INT`  | 2  | Interrupt — what `Ctrl-C` sends |
| `KILL` | 9  | Unconditional termination — cannot be caught, blocked, or ignored |
| `TERM` | 15 | Default signal for plain `kill`; requests graceful termination, process can catch it and clean up |
| `TSTP` | 20 | Terminal stop — what `Ctrl-Z` sends, can be caught (unlike `STOP`) |

```bash
kill 1290           # sends TERM: "please shut down"
kill -1 1290         # sends HUP: reload config, for most daemons
kill -9 1290         # sends KILL: no negotiation, immediate termination
kill -s TERM 1290    # signal by name instead of number
```

**Pitfall:** always try `TERM` before `KILL`. `KILL` gives the process no
chance to flush buffers, release locks, or clean up temp files — reach for it
only when `TERM` has failed to stop a hung process.

## Pipes and Redirections

- `>` — redirect stdout to a file, truncating it
- `>>` — redirect stdout, appending
- `<` — redirect a file into stdin
- `2>` — redirect stderr; `2>&1` merges stderr into wherever stdout currently points
- `|` — pipe: connect one command's stdout to the next command's stdin,
  enabling small tools to compose into a pipeline (`grep`, `sort`, `uniq`, `wc`)
- `&&` / `||` — run the next command only if the previous succeeded / failed
- `;` — run commands sequentially regardless of exit status

```bash
grep "ERROR" app.log | sort | uniq -c | sort -rn > report.txt
cmd1 | cmd2 > file        # only cmd2's stdout goes to file; cmd1's stdout is consumed by the pipe
command 2>&1 | less        # merge stderr into stdout BEFORE piping, or errors bypass the pipe
```

**Pitfall — redirection order matters:** `command > file 2>&1` merges stderr
into stdout *after* stdout has been redirected to `file`, so both land there.
`command 2>&1 > file` redirects stderr to the (still-terminal) stdout first,
then redirects stdout to `file` — stderr still goes to the terminal. Order the
redirections deliberately.

## Shell Configuration and Environment

- `.bashrc` / `.zshrc` / `.profile` (or `.cshrc` on BSD's `tcsh`) — personal
  shell configuration, loaded on shell startup or login depending on the file
  and shell.
- Environment variables (`$PATH`, `$HOME`, `$SHELL`) are inherited by child
  processes; `export VAR=value` makes a shell variable part of that
  environment instead of staying local to the shell.
- `$PATH` — colon-separated list of directories searched, in order, for
  executables; a missing or misordered `$PATH` entry is a common "command not
  found" cause.
- Aliases and shell functions live only in interactive shells unless sourced
  explicitly — scripts run via `#!/bin/sh` won't see them.

## Basic System Administration

- `sudo command` — run a single command with elevated privileges (preferred
  over logging in directly as root: keeps an audit trail per user).
- `su [user]` — switch user, prompting for that user's password (root's
  password on systems without `sudo` configured).
- Service management (daemon start/stop/restart) is variant-specific:
  `systemctl start|stop|restart service` (most modern Linux), `service name
  start` (BSD `rc.d` / older Linux), `launchctl` (macOS). Config for what
  starts at boot lives in `/etc/rc.conf` (BSD), unit files under
  `/etc/systemd/system/` (Linux), or `/etc/init.d/` (SysV-style).
- Scheduled tasks: `cron` reads per-user crontabs (`crontab -e`) and
  system-wide entries (`/etc/crontab`, `/etc/cron.d/`) to run jobs at fixed
  times; `at` schedules a one-off job for later.
- Logs: mostly under `/var/log/` as plain text (BSD, older Linux) or queried
  via `journalctl` (systemd's binary journal) on modern Linux — know which
  your system uses before grepping for a log file that doesn't exist.
- Disks and mounts: `df -h` (space per filesystem), `du -sh path` (size of a
  directory), `mount` / `umount`, entries persisted in `/etc/fstab`.

## Common Pitfalls

- **Losing history on abrupt exit:** the shell history file (`.bash_history`,
  `.zsh_history`) is typically written only when the shell exits normally —
  a crash or `kill -9` on the shell itself can lose recent history.
- **Redirection order:** see "Pipes and Redirections" above — `2>&1` placement
  changes behavior entirely.
- **Signal handling in background jobs:** a backgrounded process still tied to
  its terminal session receives `HUP` when that terminal closes and may stop
  unless launched with `nohup`, `disown`, or a proper session manager
  (`tmux`, `screen`, a systemd unit).
- **Directory execute vs read confusion:** removing `x` from a directory
  breaks `cd`/traversal even if `r` (listing) remains — a frequent permission
  debugging trap.
- **Assuming one filesystem layout:** `/usr/local`, `/bin` vs `/usr/bin`, and
  init systems differ across Linux distros, BSD, and macOS — verify before
  hardcoding a path or service-management command in a portable script.
- **`kill -9` as a first resort:** skips cleanup handlers; prefer `TERM`
  (or the signal a daemon documents for graceful reload/shutdown) first.
