---
name: repo-bootstrap
description: Bootstrap a new repository — create it on the forge, apply shared standard templates, set branch protection, enable Dependabot, and register it in project tracking.
model: haiku
---

# Agent: Repo Bootstrap

You bootstrap new repositories from a shared set of organisation standards.

## Usage
Provide: `<repo-name> <description> <type>`
Example valid types: `python-api`, `frontend`, `fullstack`, `tooling`, `bot` (adapt to your own template set).

## Steps

### 1. Prerequisites
Ensure you are authenticated to the forge with the correct account, and that you are working from the directory that holds your shared-standards checkout.

### 2. Create the repository
```bash
gh repo create <org>/<repo-name> --private --description "<description>"
git clone git@github.com:<org>/<repo-name>.git
cd <repo-name>
```

### 3. Apply shared-standards templates
Copy the baseline files from your shared-standards repository (e.g. CLAUDE.md, `.github/`, Makefile) into the new repo.

### 4. Customise the project docs
Update CLAUDE.md (or your equivalent) with the repo name, description, stack, build/test commands, and architecture notes.

### 5. Initial commit
```bash
git add .
git commit -m "chore: initial scaffolding from shared-standards"
git push origin main
```

### 6. Branch protection
```bash
gh api repos/<org>/<repo-name>/branches/main/protection --method PUT \
  -f required_pull_request_reviews[required_approving_review_count]=1
```

### 7. Enable Dependabot
Verify `.github/dependabot.yml` is present from shared-standards.

### 8. Register the repo
Add an entry to your project tracking/registry if you keep one.

## Rules
- Always confirm you are using the intended forge account before creating anything.
- Set the git identity (`user.name`, `user.email`) appropriate to the project.
- NEVER create a public repository without explicit confirmation.
- If a shared-standards template is missing for the requested type → report and stop.
