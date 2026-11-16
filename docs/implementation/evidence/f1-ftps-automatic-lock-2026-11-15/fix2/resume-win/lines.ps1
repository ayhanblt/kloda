$k = 'apps/mobile/modules/my-module/android/src'
$files = @(
  "$k/main/java/com/kloda/sync/AndroidFtpsJob.kt",
  "$k/main/java/com/kloda/sync/AndroidFtpsScheduler.kt",
  "$k/main/java/com/kloda/sync/AndroidFtpsQueue.kt",
  "$k/androidTest/java/com/kloda/sync/AndroidFtpsAutomaticChecks.kt",
  "$k/androidTest/java/com/kloda/sync/AndroidFtpsLifecycleChecks.kt",
  "$k/androidTest/java/com/kloda/sync/AndroidFtpsPolicyChecks.kt"
)
foreach ($f in $files) {
  $inBlock = $false; $code = 0; $total = 0
  foreach ($l in Get-Content $f) {
    $total++
    $t = $l.Trim()
    if ($inBlock) { if ($t.Contains('*/')) { $inBlock = $false }; continue }
    if ($t -eq '' -or $t.StartsWith('//')) { continue }
    if ($t.StartsWith('/*')) { if (-not $t.Contains('*/')) { $inBlock = $true }; continue }
    $code++
  }
  "{0} code={1} total={2}" -f (Split-Path $f -Leaf), $code, $total
}
