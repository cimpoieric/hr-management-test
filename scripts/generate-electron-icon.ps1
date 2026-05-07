$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$buildDir = Join-Path $root "build"
$icoOut = Join-Path $buildDir "icon.ico"
$electronIco = Join-Path $root "electron\icon.ico"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(30, 64, 175))
$font = [System.Drawing.Font]::new("Segoe UI", 72, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF 0, 0, 256, 256
$g.DrawString("HR", $font, $brush, $rect, $sf)
$g.Dispose()
$font.Dispose()
$brush.Dispose()
$sf.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$fs = [System.IO.File]::Open($icoOut, "Create")
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp.Dispose()
Copy-Item -LiteralPath $icoOut -Destination $electronIco -Force
Write-Host "Wrote $icoOut and $electronIco"
