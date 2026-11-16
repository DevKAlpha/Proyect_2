<#
.SYNOPSIS
  Instala Terminal en Windows desde la línea de comandos.

.DESCRIPTION
  Descarga el instalador de la última versión publicada, comprueba que el
  archivo llegó entero (SHA-256) y lo ejecuta en silencio. Instala solo para
  tu usuario: no pide permisos de administrador. El instalador incluye lo
  que la aplicación necesita (WebView2, si tu Windows no lo trae).

  No instala nada más y no cambia ajustes del sistema.

.PARAMETER Source
  De dónde sale el instalador: una dirección https o una carpeta de tu
  equipo que ya contenga `terminal-setup-x64.exe` y `SHA256SUMS` (para
  instalar sin conexión).

.EXAMPLE
  irm https://raw.githubusercontent.com/DevKAlpha/Proyect_2/main/install/install.ps1 | iex

.EXAMPLE
  .\install.ps1 -Source C:\Descargas\terminal
#>
param(
    [string]$Source = 'https://github.com/DevKAlpha/Proyect_2/releases/latest/download'
)

# Los textos que se muestran no llevan tildes a propósito: Windows PowerShell
# 5.1 lee este archivo con otra codificación y las estropearía.
$ErrorActionPreference = 'Stop'
$installer = 'terminal-setup-x64.exe'
$sums = 'SHA256SUMS'

if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'Terminal necesita un Windows de 64 bits.'
}

$fromWeb = $Source -match '^https://'
if (-not $fromWeb -and -not (Test-Path -LiteralPath $Source -PathType Container)) {
    # Nunca http sin cifrar: lo descargado se va a ejecutar.
    throw "El origen debe ser una URL https o una carpeta que exista: $Source"
}

# Windows PowerShell 5.1 no usa TLS 1.2 por su cuenta en equipos antiguos.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$folder = Join-Path ([IO.Path]::GetTempPath()) ("terminal-install-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $folder | Out-Null

try {
    foreach ($file in $sums, $installer) {
        $target = Join-Path $folder $file
        if ($fromWeb) {
            Write-Host "Descargando $file..."
            Invoke-WebRequest -Uri "$($Source.TrimEnd('/'))/$file" -OutFile $target -UseBasicParsing
        }
        else {
            Copy-Item -LiteralPath (Join-Path $Source $file) -Destination $target
        }
    }

    # Cada línea de SHA256SUMS es "<suma>  <archivo>".
    $line = Get-Content -LiteralPath (Join-Path $folder $sums) |
        Where-Object { $_ -match "^[0-9a-fA-F]{64}\s+\*?$([regex]::Escape($installer))\s*$" } |
        Select-Object -First 1
    if (-not $line) {
        throw "SHA256SUMS no trae la suma de $installer."
    }
    $expected = ($line -split '\s+')[0]
    $actual = (Get-FileHash -LiteralPath (Join-Path $folder $installer) -Algorithm SHA256).Hash
    if ($actual -ne $expected) {
        throw "El instalador no coincide con su suma SHA-256. No se instala nada. Vuelve a intentarlo; si se repite, no lo ejecutes."
    }

    Write-Host 'Instalando Terminal para tu usuario...'
    # /S: instalación silenciosa del instalador NSIS.
    $process = Start-Process -FilePath (Join-Path $folder $installer) -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Error del instalador, valor de salida: $($process.ExitCode)."
    }
    Write-Host 'Listo. Busca Terminal en Inicio.'
}
finally {
    Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
}
