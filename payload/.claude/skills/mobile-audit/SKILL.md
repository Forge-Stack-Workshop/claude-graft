---
name: mobile-audit
description: Auditing a mobile app (iOS, Android, KMP, Flutter, React Native) for security, performance, accessibility, privacy, and app-store compliance before release. Covers OWASP MASVS/MASTG, secure storage & transport, startup/jank/memory budgets, VoiceOver/TalkBack a11y, privacy manifests & tracking disclosure, and App Store Review / Play policy gates. Use whenever asked to audit, review, harden, or "check before shipping" a mobile app, chase a rejection, or assess security/perf/accessibility of mobile code — output a prioritized findings list, most-severe first.
origin: chrysa
---

# Mobile App Audit

Systematic pre-release review across five axes. Run the axes that apply, then report
**findings, most-severe first**, each with: what, where (`file:line`), why it matters, and
the concrete fix. Don't bury a P0 secret leak under style nits.

## Output format

```
# Mobile Audit — <app> (<stack>)
## Security   (P0/P1/P2 findings)
## Performance
## Accessibility
## Privacy & Compliance
## Store readiness
## Summary — blockers vs. nice-to-have
```

## 1. Security — OWASP MASVS

Check against the Mobile Application Security Verification Standard. Highest-value checks:

- **Secrets** — no API keys/tokens/credentials in source, bundle, or `Info.plist`/
  manifest. JS/Dart bundles and APK/IPA are trivially extractable. Move to server/secure
  backend. (This is the first thing to grep for — see `references/security.md`.)
- **Storage** — tokens in Keychain (iOS) / Keystore-backed EncryptedSharedPreferences /
  `expo-secure-store`, never `UserDefaults`/`SharedPreferences`/`AsyncStorage`/plain files.
- **Transport** — TLS only, ATS enabled (iOS), `cleartextTrafficPermitted=false`
  (Android); consider certificate pinning for high-value APIs.
- **Auth/session** — no long-lived tokens on device without refresh + revocation;
  biometric gating via LocalAuthentication/BiometricPrompt done right (not a bypassable
  boolean).
- **Platform** — no unnecessary exported components/deep links (Android),
  `allowBackup=false` for sensitive apps; no WebView `javascriptEnabled` on untrusted
  content; validate deep-link/universal-link inputs.
- **Tamper/reverse** — obfuscation (R8/ProGuard) where warranted, no debug logging of PII,
  no `NSAllowsArbitraryLoads`. Full checklist and tools in `references/security.md`.

## 2. Performance

- **Startup** — cold start budget; defer heavy init off the critical path. Android:
  ship **Baseline Profiles**. iOS: audit pre-`main`/launch work with Instruments.
- **Jank** — hold the 16ms/frame (60fps) budget; find dropped frames (Android Profiler /
  Perfetto, Instruments Core Animation, Flutter DevTools timeline, Hermes/Flipper).
- **Memory** — leaks (retain cycles / undisposed listeners/subscriptions), image
  downsampling, list virtualization.
- **Network/battery** — batch/coalesce requests, cache, avoid wakelocks/polling.
- **Size** — app bundle/IPA size, on-demand resources, tree-shaking. Details in
  `references/performance.md`.

## 3. Accessibility

- Labels for every actionable element (VoiceOver/TalkBack read something meaningful).
- **Dynamic Type / font scaling** honored; no clipped or fixed-px text.
- Contrast >= WCAG AA (4.5:1 text); don't encode meaning in color alone.
- Touch targets >= 44pt (iOS) / 48dp (Android); focus order logical; motion-reduction
  respected. Test with the actual screen reader, not just a linter.

## 4. Privacy & compliance

- **iOS**: `PrivacyInfo.xcprivacy` privacy manifest + required-reason APIs declared;
  App Tracking Transparency prompt if tracking; accurate App Privacy "nutrition label".
- **Android**: Play **Data safety** form matches reality; scoped storage; runtime
  permissions requested in-context and minimal; `AD_ID` declared if used.
- **GDPR** (chrysa bar — see `rgpd-compliance` skill): consent for tracking, data
  minimization, deletion path, no PII in logs/analytics without basis.

## 5. Store readiness

- **App Store Review Guidelines** and **Play Developer Program Policies** — common
  rejection causes (private APIs, misleading metadata, incomplete IAP, permissions without
  justification, crashy first launch). See `references/store-compliance.md`.
- Versioning, required screenshots, age rating, account-deletion requirement.

## Finish

Separate **blockers** (won't ship / will get rejected / leaks data) from
**nice-to-have**. For fixes touching code, point to the relevant patterns skill and
`mobile-testing` for the regression test.
