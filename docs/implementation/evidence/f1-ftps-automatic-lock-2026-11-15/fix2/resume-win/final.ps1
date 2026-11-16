$ev = 'docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/resume-win'
$s = 'docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/start'
$k = 'apps/mobile/modules/my-module/android/src'
$files = @(
  "$k/main/java/com/kloda/sync/AndroidFtpsJob.kt",
  "$k/main/java/com/kloda/sync/AndroidFtpsScheduler.kt",
  "$k/main/java/com/kloda/sync/AndroidFtpsQueue.kt",
  "$k/androidTest/java/com/kloda/sync/AndroidFtpsAutomaticChecks.kt",
  "$k/androidTest/java/com/kloda/sync/AndroidFtpsLifecycleChecks.kt",
  "$k/androidTest/java/com/kloda/sync/AndroidFtpsPolicyChecks.kt"
)
$sha = [Security.Cryptography.SHA256]::Create()
$hashes = foreach ($f in $files) {
  $t = [IO.File]::ReadAllText((Resolve-Path $f)).Replace("`r`n", "`n")
  $h = ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($t)) | ForEach-Object { $_.ToString('x2') }) -join ''
  "$h  $f"
}
$hashes | Out-File -Encoding ascii "$ev/source-final-lf.sha256"
# Whole fix2 diff: start copies -> working tree (CR ignored), and the Windows-session delta: HEAD (Mac partial) -> working tree.
Remove-Item "$ev/fix2-start-to-final.patch" -ErrorAction SilentlyContinue
foreach ($f in $files) {
  $name = Split-Path $f -Leaf
  git diff --no-index --ignore-cr-at-eol "$s/$name.start" $f | Out-File -Append -Encoding utf8 "$ev/fix2-start-to-final.patch"
}
git diff --ignore-cr-at-eol HEAD -- $files | Out-File -Encoding utf8 "$ev/windows-session.patch"
git diff --check HEAD -- $files | Out-File -Encoding utf8 "$ev/diff-check.txt"
"diff-check exit=$LASTEXITCODE"
& powershell -NoProfile -ExecutionPolicy Bypass -File "$ev/lines.ps1" | Out-File -Encoding ascii "$ev/lines-final.txt"
Get-Content "$ev/lines-final.txt"
git status --short | Out-File -Encoding ascii "$ev/status-final.txt"
git diff --stat HEAD
