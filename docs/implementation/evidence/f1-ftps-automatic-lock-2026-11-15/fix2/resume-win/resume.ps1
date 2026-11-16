$ev = 'docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/resume-win'
git rev-parse HEAD | Out-File -Encoding ascii "$ev/head.txt"
git status --short | Out-File -Encoding ascii "$ev/status.txt"
git diff --cached --name-only | Out-File -Encoding ascii "$ev/staged.txt"
$lines = Get-Content 'docs/implementation/evidence/f1-ftps-automatic-lock-2026-11-15/fix2/windows-resume.sha256'
$out = foreach ($l in $lines) {
  $parts = $l -split '\s+', 2
  $p = $parts[1].Trim()
  $bytes = [IO.File]::ReadAllBytes($p)
  $cr = @($bytes | Where-Object { $_ -eq 13 }).Count
  $a = (Get-FileHash $p -Algorithm SHA256).Hash.ToLower()
  "{0} {1} cr={2} {3}" -f ($a -eq $parts[0]), $a, $cr, $p
}
$out | Out-File -Encoding ascii "$ev/hash-check.txt"
$out
Copy-Item 'docs/implementation/CURRENT.md' "$ev/CURRENT.md.start"
"autocrlf=" + (git config core.autocrlf)
