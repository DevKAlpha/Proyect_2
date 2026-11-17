#!/bin/sh
# Instala Terminal_Duck en Linux desde la línea de comandos.
#
#   curl -fsSL https://raw.githubusercontent.com/DevKAlpha/Proyect_2/main/install/install.sh | sh
#
# Elige el paquete de tu distribución, comprueba que llegó entero (SHA-256)
# y lo instala con el gestor de paquetes, que añade las dependencias:
#
#   Debian, Ubuntu, Mint...   paquete .deb con apt-get
#   Fedora, RHEL, openSUSE... paquete .rpm con dnf, yum o zypper
#   cualquier otra            AppImage en ~/.local/bin, sin permisos de root
#
# Opciones:
#   --from <origen>  dirección https o carpeta local con los paquetes y
#                    SHA256SUMS (para instalar sin conexión)
#   --appimage       usa el AppImage aunque haya gestor de paquetes: no pide
#                    contraseña y no toca el sistema
#
# No instala nada más y no cambia ajustes del sistema.
set -eu

SOURCE="https://github.com/DevKAlpha/Proyect_2/releases/latest/download"
FORCE_APPIMAGE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --from)
      [ $# -ge 2 ] || { echo "Falta el origen después de --from." >&2; exit 2; }
      SOURCE=$2
      shift 2
      ;;
    --appimage)
      FORCE_APPIMAGE=1
      shift
      ;;
    *)
      echo "Opción desconocida: $1" >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "Error: $1" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

[ "$(uname -s)" = "Linux" ] || fail "este instalador es para Linux."
[ "$(uname -m)" = "x86_64" ] || fail "por ahora solo hay paquetes para x86_64."

# Qué paquete y con qué se instala.
if [ "$FORCE_APPIMAGE" -eq 1 ]; then
  KIND=appimage
elif have apt-get && have dpkg; then
  KIND=deb
elif have dnf || have yum || have zypper; then
  KIND=rpm
else
  KIND=appimage
fi

case "$KIND" in
  deb) PACKAGE=terminal-duck-amd64.deb ;;
  rpm) PACKAGE=terminal-duck-x86_64.rpm ;;
  appimage) PACKAGE=terminal-duck-x86_64.AppImage ;;
esac

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

# Trae un archivo del origen a la carpeta de trabajo.
fetch() {
  case "$SOURCE" in
    https://*)
      echo "Descargando $1..."
      if have curl; then
        curl -fsSL "${SOURCE%/}/$1" -o "$WORK/$1"
      elif have wget; then
        wget -q "${SOURCE%/}/$1" -O "$WORK/$1"
      else
        fail "hace falta curl o wget para descargar."
      fi
      ;;
    http://*)
      # Lo descargado se va a instalar: nunca sin cifrar.
      fail "el origen debe ser https, no http."
      ;;
    *)
      [ -f "$SOURCE/$1" ] || fail "no existe $SOURCE/$1"
      cp "$SOURCE/$1" "$WORK/$1"
      ;;
  esac
}

fetch SHA256SUMS
fetch "$PACKAGE"

have sha256sum || fail "hace falta sha256sum para comprobar la descarga."
# Solo la línea de este paquete: "<suma>  <archivo>".
grep -E "^[0-9a-fA-F]{64}[[:space:]]+\*?$PACKAGE\$" "$WORK/SHA256SUMS" >"$WORK/expected" ||
  fail "SHA256SUMS no trae la suma de $PACKAGE."
(cd "$WORK" && sha256sum -c expected >/dev/null 2>&1) ||
  fail "el paquete no coincide con su suma SHA-256. No se instala nada."

# Los gestores de paquetes piden root; el AppImage no.
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif have sudo; then
  SUDO="sudo"
else
  SUDO=""
  [ "$KIND" = appimage ] || fail "hace falta sudo o ser root. Sin permisos, usa: --appimage"
fi

case "$KIND" in
  deb)
    echo "Instalando con apt-get (puede pedir tu contraseña)..."
    # apt lee el archivo como otro usuario: necesita poder entrar.
    chmod 755 "$WORK"
    chmod 644 "$WORK/$PACKAGE"
    $SUDO apt-get install -y "$WORK/$PACKAGE"
    ;;
  rpm)
    echo "Instalando el paquete rpm (puede pedir tu contraseña)..."
    if have dnf; then
      $SUDO dnf install -y "$WORK/$PACKAGE"
    elif have yum; then
      $SUDO yum install -y "$WORK/$PACKAGE"
    else
      # El paquete no va firmado; su integridad ya se comprobó arriba.
      $SUDO zypper --non-interactive install --allow-unsigned-rpm "$WORK/$PACKAGE"
    fi
    ;;
  appimage)
    BIN="$HOME/.local/bin"
    APPS="$HOME/.local/share/applications"
    mkdir -p "$BIN" "$APPS"
    cp "$WORK/$PACKAGE" "$BIN/terminal-duck"
    chmod 755 "$BIN/terminal-duck"
    # Para que aparezca en el menú de aplicaciones.
    cat >"$APPS/terminal-duck.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Terminal_Duck
Comment=Terminal de escritorio para shells, Git y agentes de IA
Exec=$BIN/terminal-duck
Terminal=false
Categories=Utility;TerminalEmulator;
EOF
    echo "Terminal_Duck está instalada en $BIN/terminal-duck (sin permisos de root)."
    echo "Búscala en el menú de aplicaciones."
    exit 0
    ;;
esac

echo "Terminal_Duck está instalada. Búscala en el menú de aplicaciones o ejecuta: terminal-duck"
