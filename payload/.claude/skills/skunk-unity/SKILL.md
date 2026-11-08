---
name: skunk-unity
description: Run, build, and test the chrysa/skunk-simulator Unity project on Linux — launch the editor, generate scenes, run EditMode tests headless, handle licensing and the recurring gotchas. Use whenever working on the Skunk Simulator game.
---

# Skunk Simulator — Unity on Linux ops

Project: `~/Documents/perso/projects/chrysa/skunk-simulator` · repo `chrysa/skunk-simulator` (default branch **develop**) · Unity **6000.6.0f1**.

```
UNITY=~/Unity/Hub/Editor/6000.6.0f1/Editor/Unity
PROJ=~/Documents/perso/projects/chrysa/skunk-simulator
```

## Run EditMode tests headless (authoritative check)
```
"$UNITY" -batchmode -nographics -projectPath "$PROJ" -runTests \
  -testPlatform EditMode -testResults /tmp/skunk_results.xml -logFile /tmp/skunk_test.log
```
Read result: `grep -oE 'total="[0-9]+" passed="[0-9]+" failed="[0-9]+"' /tmp/skunk_results.xml`.
Failures: parse `<test-case ... result="Failed">` + `<message>` from the XML.

## Launch the editor (GUI)
```
setsid "$UNITY" -projectPath "$PROJ" >/tmp/unity_run.log 2>&1 &
```
Then in-editor: menu **Skunk ▸ Build All Scenes** builds Main + MainMenu/Settings/Profile/Customization. Open `Assets/Skunk/Scenes/Main` and press Play. Player 1 is human (WASD; Space/F/N spray; E/R/T eat).

## Build scenes / run headless via executeMethod (needs editor CLOSED)
```
"$UNITY" -batchmode -nographics -projectPath "$PROJ" \
  -executeMethod Skunk.EditorTools.SceneBuilder.BuildAll -logFile - -quit
```

## HARD-WON GOTCHAS
- **Never pass `-quit` with `-runTests`** — it quits before running → 0 tests, exit 0 (silent). `-quit` is fine with `-executeMethod`.
- **One instance at a time.** A 2nd Unity on the same project fails: "another Unity instance is running". To run headless tests, the GUI editor must be **closed** (it holds the project lock).
- **License** = Unity Personal via the **Licensing Client**, not a `Unity_lic.ulf` file. Don't gate on a ulf; just run and check the log for `Successfully updated license`. If unlicensed: `unityhub` GUI ▸ sign in, or offline `-createManualActivationFile` → upload .alf at https://license.unity3d.com/manual → `-manualLicenseFile x.ulf`.
- **Unity Hub is nix + Electron.** System GTK theme `Aura-Glass` spams CSS parse warnings / can break the window → launch with `GTK_THEME=Adwaita:dark` (wrapper `~/.local/bin/unityhub-fixed`). The warnings alone are harmless.
- **Test asmdef must be modern form**: references `UnityEngine.TestRunner`+`UnityEditor.TestRunner`, `precompiledReferences: [nunit.framework.dll]`, `defineConstraints: [UNITY_INCLUDE_TESTS]`, `includePlatforms: [Editor]`. The old `optionalUnityReferences: [TestAssemblies]` discovers **0 tests** on Unity 2022.
- **No Physics module by default** → `CreatePrimitive` colliders throw `CS1069 Collider not found`. Fixed by adding `com.unity.modules.physics` to `Packages/manifest.json`.
- **No .NET SDK on this box** → the pure-C# `Skunk.Simulation` can't be `dotnet test`ed; Unity is the only runner.
- **git**: active `gh` account keeps reverting to anthony-greau (pull-only) → run `gh auth switch --user chrysa` before every push; commit author is `chrysa`.
- **CI** (`ci.yml`, `build.yml`) is Actions-billing-blocked on the org for private repos (red = billing, not code).

## Architecture (GDD §8.5)
`Skunk.Simulation` (pure C#, DDD folders Domain/Application/Infrastructure) is server-authoritative; `Skunk.Presentation`/`Skunk.Input` are Unity; net sits behind `INetworkTransport` (Photon at Jalon 3). See repo `ARCHITECTURE.md` and the Notion GDD (page `35d59293e35e815db28ffe7936709b77`). Shortcut epics J1-J4 = #3821-3824.
```
