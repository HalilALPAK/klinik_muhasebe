@echo off
rem Alpotech Muhasebe kurulumu: cift tiklayin. Masaustune iki simge koyar:
rem   "Alpotech Muhasebe"            - yalnizca muhasebe
rem   "Alpotech Klinik ve Muhasebe"  - klinik paneli ve muhasebe yan yana
rem Bu dosyanin alt kismi PowerShell kodudur; tek dosya olarak kopyalanabilir.
set "KURULUM_DOSYASI=%~f0"
set "KURULUM_ADRES=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$k = [IO.File]::ReadAllText($env:KURULUM_DOSYASI, [Text.Encoding]::UTF8); iex (($k -split '\r?\n:POWERSHELL\r?\n', 2)[1])"
exit /b
:POWERSHELL
$ErrorActionPreference = "Stop"
$VarsayilanAdres = "192.168.1.41:8091"   # sunucunun şimdiki adresi; klinikte sabit IP verilince değişecek

function Dur([string]$mesaj) {
    Write-Host ""
    Write-Host $mesaj -ForegroundColor Red
    Read-Host "Kapatmak için Enter'a basın" | Out-Null
    exit 1
}

# Klinik paneli kurulumuyla aynı klasör ve aynı adres dosyası (kurulum/Alpotech_Klinik_Kurulum.bat)
$klasor = Join-Path $env:LOCALAPPDATA "AlpotechKlinik"
New-Item -ItemType Directory -Force $klasor | Out-Null
$kayitliAdres = Join-Path $klasor "adres.txt"
if (Test-Path $kayitliAdres) { $VarsayilanAdres = (Get-Content $kayitliAdres -Raw).Trim() }

Write-Host "=== Alpotech Muhasebe kurulumu ===" -ForegroundColor Cyan
$Adres = $env:KURULUM_ADRES
if (-not $Adres) {
    Write-Host "Sunucu adresi: $VarsayilanAdres"
    $Adres = Read-Host "Doğruysa Enter'a basın, değiştiyse yeni adresi yazın"
    if (-not $Adres) { $Adres = $VarsayilanAdres }
}
$Adres = $Adres.Trim().TrimEnd("/")
if ($Adres -notmatch "^https?://") { $Adres = "http://$Adres" }
if ($Adres -notmatch "^https?://[^/\s]+$") { Dur "Adres anlaşılamadı: $Adres" }
$PanelAdresi = "$Adres/"
$MuhasebeAdresi = "$Adres/muhasebe/"

# Sunucu cevap veriyor mu, muhasebe yayında mı? Logoyu da simge yapmak için buradan alıyoruz.
Write-Host "Sunucuya bağlanılıyor: $MuhasebeAdresi"
$logo = Join-Path $klasor "logo.png"
try {
    Invoke-WebRequest -Uri "$Adres/logo.png" -OutFile $logo -UseBasicParsing -TimeoutSec 10
} catch {
    Dur ("Sunucuya ulaşılamadı: $PanelAdresi`n" +
         "- Bilgisayar kliniğin modemine (Wi-Fi ya da kablo) bağlı mı?`n" +
         "- Sunucu açık mı?`n" +
         "- Adres değiştiyse bu dosyayı yeniden çalıştırıp yeni adresi yazın.")
}
try {
    $sayfa = Invoke-WebRequest -Uri $MuhasebeAdresi -UseBasicParsing -TimeoutSec 10
    if ($sayfa.Content -notmatch "Alpotech Muhasebe") { throw "muhasebe sayfası değil" }
} catch {
    Dur ("Sunucu açık ama muhasebe yayında değil: $MuhasebeAdresi`n" +
         "Sunucuda muhasebe kurulumu (7. betik) çalıştırılmalı.")
}
Set-Content -Path $kayitliAdres -Value ($Adres -replace "^https?://", "") -Encoding ASCII

# logo.png -> muhasebe.ico (256x256, PNG içeren ICO). Klinik simgesinden ayrılsın diye sağ altta "₺" rozeti var.
Add-Type -AssemblyName System.Drawing
$ikon = Join-Path $klasor "muhasebe.ico"
$kaynak = [System.Drawing.Image]::FromFile($logo)
$kare = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($kare)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$oran = [Math]::Min(256 / $kaynak.Width, 256 / $kaynak.Height)
$w = [int]($kaynak.Width * $oran); $h = [int]($kaynak.Height * $oran)
$g.DrawImage($kaynak, [int]((256 - $w) / 2), [int]((256 - $h) / 2), $w, $h)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 86, 96))), 150, 150, 104, 104)
$g.DrawEllipse((New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 6), 150, 150, 104, 104)
$yazi = New-Object System.Drawing.Font "Segoe UI", 54, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$bicim = New-Object System.Drawing.StringFormat
$bicim.Alignment = [System.Drawing.StringAlignment]::Center
$bicim.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString([string][char]0x20BA, $yazi, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 150, 152, 104, 104), $bicim)
$g.Dispose(); $kaynak.Dispose()
$ms = New-Object System.IO.MemoryStream
$kare.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$kare.Dispose()
$png = $ms.ToArray()
$fs = [System.IO.File]::Create($ikon)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
$bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt32]$png.Length); $bw.Write([UInt32]22)
$bw.Write($png)
$bw.Close()

# Tarayıcı: Edge (Windows 10/11'de hazır gelir), yoksa Chrome
$tarayici = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $tarayici) { Dur "Edge ya da Chrome bulunamadı." }
$argumanlar = "--app=$MuhasebeAdresi --start-maximized"

# Yan yana açıcı: ekranı ikiye böler; solda klinik paneli, sağda muhasebe.
# Aynı tarayıcı profili kullanıldığı için oturum ortaktır: birinde giriş yapınca diğeri de girişli olur.
$yanYana = Join-Path $klasor "yan_yana.ps1"
@"
Add-Type -AssemblyName System.Windows.Forms
`$alan = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
`$yarim = [int](`$alan.Width / 2)
Start-Process -FilePath "$tarayici" -ArgumentList "--app=$PanelAdresi --window-position=`$(`$alan.X),`$(`$alan.Y) --window-size=`$yarim,`$(`$alan.Height)"
Start-Sleep -Milliseconds 800
Start-Process -FilePath "$tarayici" -ArgumentList "--app=$MuhasebeAdresi --window-position=`$(`$alan.X + `$yarim),`$(`$alan.Y) --window-size=`$yarim,`$(`$alan.Height)"
"@ | Set-Content -Path $yanYana -Encoding UTF8

$kabuk = New-Object -ComObject WScript.Shell
$masaustu = [Environment]::GetFolderPath("Desktop")
$baslat = [Environment]::GetFolderPath("Programs")

$kisayol = Join-Path $masaustu "Alpotech Muhasebe.lnk"
$lnk = $kabuk.CreateShortcut($kisayol)
$lnk.TargetPath = $tarayici
$lnk.Arguments = $argumanlar
$lnk.IconLocation = "$ikon,0"
$lnk.Description = "Alpotech Muhasebe ($MuhasebeAdresi)"
$lnk.Save()
Copy-Item $kisayol (Join-Path $baslat "Alpotech Muhasebe.lnk") -Force

$kisayol2 = Join-Path $masaustu "Alpotech Klinik ve Muhasebe.lnk"
$lnk = $kabuk.CreateShortcut($kisayol2)
$lnk.TargetPath = (Get-Command powershell.exe).Source
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$yanYana`""
$lnk.IconLocation = "$ikon,0"
$lnk.WindowStyle = 7   # simge durumunda başlasın, PowerShell penceresi görünmesin
$lnk.Description = "Klinik paneli ve muhasebe yan yana ($PanelAdresi)"
$lnk.Save()
Copy-Item $kisayol2 (Join-Path $baslat "Alpotech Klinik ve Muhasebe.lnk") -Force

Write-Host ""
Write-Host "Tamam. Masaüstüne iki simge kondu:" -ForegroundColor Green
Write-Host "  Alpotech Muhasebe            - yalnızca muhasebe"
Write-Host "  Alpotech Klinik ve Muhasebe  - klinik paneli (solda) ve muhasebe (sağda) yan yana"
Write-Host "Şimdi ikisi yan yana açılıyor."
if (-not $env:KURULUM_PANELI_ACMA) { Start-Process -FilePath (Get-Command powershell.exe).Source -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$yanYana`"" }
Start-Sleep -Seconds 4
