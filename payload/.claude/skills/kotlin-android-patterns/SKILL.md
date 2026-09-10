---
name: kotlin-android-patterns
description: Native Android development with Kotlin and Jetpack Compose — the official Android app architecture (UI/Domain/Data layers, unidirectional data flow), coroutines/Flow, Hilt DI, Material 3, and Kotlin coding conventions. Use whenever building, reviewing, or refactoring a native Android app, writing Compose UI, wiring ViewModels/StateFlow, structuring modules, or aligning code with Android/Kotlin conventions — even if the user only says "the Android app" or names a .kt/Gradle file.
origin: chrysa
---

# Kotlin & Jetpack Compose Development Patterns

Native Android, Kotlin-first, Jetpack Compose UI, following Google's official
**Guide to app architecture**.

## Non-negotiable standards

- **Kotlin coding conventions** — expression bodies, immutability (`val` over `var`),
  data classes for state, sealed classes/interfaces for closed hierarchies, null-safety
  (no `!!` outside tests; model absence with `?` or sealed states).
- **Unidirectional data flow (UDF)** — state flows down (ViewModel → UI), events flow up
  (UI → ViewModel). UI is a function of a single immutable `UiState`.
- **Structured concurrency** — coroutines + `Flow`; scope work to `viewModelScope` /
  `lifecycleScope`; never `GlobalScope`. Expose `StateFlow`, collect with
  `collectAsStateWithLifecycle()`.
- **Layered architecture** — UI → Domain (optional, pure Kotlin use-cases) → Data
  (repositories owning a single source of truth). Data layer exposes suspend funcs/Flows;
  no Android framework types leak upward.
- **Material 3** — theme from `MaterialTheme`, dynamic color where appropriate, respect
  system dark theme and font scale.

## The canonical stack

```kotlin
// State: one immutable class describing the whole screen
data class ProfileUiState(
    val user: User? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repo: UserRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ProfileUiState(isLoading = true))
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    init { load() }

    private fun load() = viewModelScope.launch {
        _state.update { it.copy(isLoading = true, error = null) }
        runCatching { repo.currentUser() }
            .onSuccess { u -> _state.update { it.copy(user = u, isLoading = false) } }
            .onFailure { e -> _state.update { it.copy(error = e.message, isLoading = false) } }
    }
}

@Composable
fun ProfileScreen(vm: ProfileViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    when {
        state.isLoading -> CircularProgressIndicator()
        state.user != null -> Text(state.user!!.name)
        else -> Text(state.error ?: "Unknown")
    }
}
```

## Compose rules that keep UI fast and correct

- Composables are pure and side-effect-free; launch work from `LaunchedEffect`,
  `rememberCoroutineScope`, or ViewModel events — never inline in composition.
- Hoist state: stateless composables take `state` + `onEvent` lambdas; makes them
  previewable and testable. Keep `@Preview` for every screen.
- Stable, keyed `LazyColumn` items (`key = { it.id }`); use `@Immutable`/`@Stable` on
  state classes to help skipping and avoid needless recomposition.
- Read Compose performance signals: avoid unstable lambdas/params in hot lists.

## Build & modularization

- Gradle **Kotlin DSL** + version catalog (`libs.versions.toml`); pin versions.
- Multi-module by feature: `:feature:*` → `:core:domain` → `:core:data`. Enforce
  boundaries; domain is pure Kotlin (no Android SDK).
- DI with **Hilt**. Persistence with **Room** (SQLite) + `DataStore` for prefs.
  Networking with **Retrofit/Ktor** + kotlinx.serialization. Secrets in the Keystore /
  encrypted storage — never in code or `SharedPreferences`.

## When to reach for other skills

- Tests → `mobile-testing` (JUnit, Turbine, Compose UI test, Espresso).
- Security (Keystore, MASVS), perf (baseline profiles, jank), a11y (TalkBack), Play
  policy → `mobile-audit`.
- Signing, fastlane/Gradle Play Publisher, staged rollout → `mobile-release-ops`.
- Cross-platform layering → `mobile-architecture`.
