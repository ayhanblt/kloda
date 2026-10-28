from pathlib import Path
import subprocess, os
root = next(p for p in Path(__file__).resolve().parents if (p / "packages/pairing-native/Cargo.toml").is_file())
base = root / "apps/mobile/modules/my-module/android/src/main/java/com/kloda/sync"
cache = Path.home() / ".gradle/caches/modules-2/files-2.1"
jars = []
for group in ("org.jetbrains.kotlin", "org.jetbrains.kotlinx", "org.jetbrains.intellij.deps", "org.jetbrains"):
    jars.extend(str(p) for p in (cache / group).rglob("*.jar") if ("2.1.20" in str(p) or "kotlinx-coroutines-core-jvm" in str(p) or "trove4j" in str(p) or "annotations" in str(p)))
stdlib = next(p for p in jars if p.endswith("/kotlin-stdlib-2.1.20.jar"))
out = root / ".local-evidence/android-schedule-2026-10-25/worker-classes"
out.mkdir(parents=True, exist_ok=True)
android = str(Path.home() / "Library/Android/sdk/platforms/android-36/android.jar")
json_jar = str(next((cache / "org.json/json").rglob("*.jar")))
runtime = os.pathsep.join([stdlib, json_jar, android])
subprocess.run(["java", "-cp", os.pathsep.join(jars), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect", "-classpath", runtime, "-d", str(out), str(base / "AndroidFilesRunWorker.kt"), str(base / "FilesRun.kt"), str(base / "FilesRunContext.kt"), str(Path(__file__).parent / "context-checks.kt"), str(Path(__file__).parent / "worker-checks.kt")], check=True)
result = subprocess.run(["java", "-cp", str(out) + os.pathsep + runtime, "com.kloda.sync.Worker_checksKt"], capture_output=True, text=True)
(out.parent / "worker-checks-output.txt").write_text(result.stdout + result.stderr)
print(result.stdout, result.stderr)
raise SystemExit(result.returncode)
