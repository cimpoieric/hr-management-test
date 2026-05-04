# Creates or updates a Desktop shortcut to the latest win-unpacked Electron build.
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $projectRoot "release-electron\win-unpacked\HR Management.exe"
if (-not (Test-Path $exe)) {
  Write-Warning "Executable not found: $exe - run npm run electron:dist first."
  exit 1
}
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "HR Management.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = Split-Path $exe -Parent
$shortcut.WindowStyle = 1
$shortcut.Description = "HR Management (local build, win-unpacked)"
$shortcut.Save()
Write-Host ('Updated desktop shortcut: ' + $lnkPath + ' -> ' + $exe)
