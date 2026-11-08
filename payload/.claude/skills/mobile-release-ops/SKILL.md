---
name: mobile-release-ops
description: Building, signing, releasing, and maintaining mobile apps (iOS, Android, Flutter, React Native/Expo) — code signing & provisioning, fastlane / EAS / Gradle Play Publisher pipelines, CI/CD, versioning, phased/staged rollouts, crash monitoring, OTA updates, and SDK/dependency migration. Use whenever setting up or fixing a mobile build/release pipeline, wrestling with certificates/provisioning, automating store submission, planning a rollout, upgrading an SDK/platform version, or keeping a shipped app healthy.
origin: chrysa
---

# Mobile Release & Maintenance Ops

Get a build signed, tested, and into users' hands repeatably — then keep it healthy and
current. Automate everything; manual signing/uploads are where releases rot.

## Signing (the perennial pain)

- **iOS** — certificates + provisioning profiles + bundle IDs + capabilities. Use
  **fastlane match** (or Xcode cloud-managed signing) to store signing assets in an
  encrypted repo so CI and every dev share one source of truth. Never commit `.p12`/
  private keys in the clear. App Store Connect API key for CI auth (not Apple ID + 2FA).
- **Android** — one **upload key** (kept safe, rotatable) + Play **App Signing** (Google
  holds the app-signing key). Store the keystore + passwords in CI secrets, never in the
  repo. Losing the upload key is recoverable via Play; losing an unmanaged signing key is
  not.

## CI/CD pipeline shape

```
PR:      lint + typecheck + unit/integration tests            (fast, blocking)
main:    build (signed) + UI/E2E on device farm + artifact
release: bump version → build → upload to TestFlight/Play internal → phased rollout
```

- **fastlane** lanes (`beta`, `release`) for both platforms; **EAS Build/Submit** for
  Expo/RN; **Gradle Play Publisher** or fastlane `supply` for Play; `pilot`/`deliver` for
  App Store. Flutter: `flutter build ipa/appbundle` inside a fastlane lane.
- Keep secrets in the CI secret store; inject at build time. Build once, promote the same
  artifact through tracks — don't rebuild per environment.

## Versioning & rollout

- Semantic version (user-facing) + monotonic build number (CI-provided). Bump every
  submission.
- **Staged/phased rollout**: Play staged rollout (5→10→50→100%) and App Store phased
  release. Watch crash-free rate before advancing; halt rollout on regression.
- Release notes automated from conventional commits (see `release-ritual` skill).

## Post-release health

- **Crash/error monitoring**: Crashlytics / Sentry (see the `sentry` plugin skills) —
  symbolicate/deobfuscate (upload dSYMs / mapping.txt / Hermes source maps). Alert on
  crash-free-rate drops.
- Track adoption, ANRs (Android vitals), and key funnels. Feed regressions back into
  `mobile-audit`.
- **OTA** (RN/Expo EAS Update, CodePush): JS-only fixes without a store round-trip —
  respect store policy (no changing app purpose/behavior materially via OTA).

## Maintenance & migration

- **Dependency hygiene**: pin via version catalogs / lockfiles; scheduled updates
  (Renovate/Dependabot); CVE scan (see `dependency-audit` skill). Regenerate lockfiles
  deliberately, verify the build.
- **Platform/SDK migrations** (yearly Play target-API bumps, new Xcode/iOS, RN New Arch,
  AGP/Gradle, Kotlin/Swift majors): read the official migration guide, bump in a branch,
  fix deprecations, run the full test + device matrix, staged rollout. Don't skip several
  majors at once — step through.
- Keep a runbook: how to cut a release, roll back, rotate keys, hotfix.

## Cross-references
- Tests that gate the pipeline → `mobile-testing`.
- Pre-release security/perf/store gate → `mobile-audit`.
- Code idioms per stack → the `*-patterns` skills.
- chrysa release conventions (changelog, tags) → `release-ritual`.
