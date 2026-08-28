---
description: TypeScript conventions. Use when writing or reviewing TypeScript code.
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript

- `strict: true`, no exception. `any` is a defect; `unknown` plus narrowing is
  the answer. No `@ts-ignore` without an adjacent comment saying why.
- Model impossible states out of existence: discriminated unions over optional
  flags that must not co-occur.
- Types describe the domain, not the wire format. Parse at the boundary (`zod`
  or equivalent), and the inside of the app trusts its types.
- Named exports. Default exports only where a framework demands one.
