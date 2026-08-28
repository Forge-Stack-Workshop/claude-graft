# Changelog

Generated from the commit history with [git-cliff](https://git-cliff.org):

    git cliff -o CHANGELOG.md

Do not edit by hand: an edit is lost at the next generation, which teaches
everyone to stop trusting the file. Write the commit subject instead —
see `payload/.claude/rules/release.md`.

## [0.1.0] - 2026-08-28

### Features

- Initial claude-graft template

### Bug fixes

- Name the repository correctly in the generated doctrine header
- Derive the plugin version from the git tag

### Documentation

- Add changelog generated from the commit history
- Restore the full README after the rebase
- Forbid any tool signature in commits and project files
- State the signature rule without quoting the forbidden markers
