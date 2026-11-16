$ev = 'docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/resume-win'
$sha = [Security.Cryptography.SHA256]::Create()
function LfHash($p) {
  $t = [IO.File]::ReadAllText((Resolve-Path $p)).Replace("`r`n", "`n")
  $b = [Text.Encoding]::UTF8.GetBytes($t)
  ($sha.ComputeHash($b) | ForEach-Object { $_.ToString('x2') }) -join ''
}
$lines = Get-Content 'docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/windows-resume.sha256'
$out = foreach ($l in $lines) {
  $parts = $l -split '\s+', 2
  $p = $parts[1].Trim()
  $name = Split-Path $p -Leaf
  $start = "docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/start/$name.start"
  $h = LfHash $p
  $s = LfHash $start
  "resume={0} eqStart={1} lf={2} {3}" -f ($h -eq $parts[0]), ($h -eq $s), $h, $p
}
$out | Out-File -Encoding ascii "$ev/hash-check-lf.txt"
$out
