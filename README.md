# Terminal

Terminal de escritorio ligera para Windows, Linux y macOS. Pensada para trabajar con los shells de cada sistema, con Git y con agentes de IA, y para que una persona sin experiencia pueda empezar a usar una terminal.

> «Terminal» es un nombre provisional. El identificador de la app (`com.devkalpha.terminal`) y la carpeta de configuración cambian cuando se elija el definitivo.

## Estado

Fase 1 de 5: terminal mínima.

- Detecta los shells instalados (PowerShell, Windows PowerShell, cmd, Git Bash, WSL, bash, zsh, fish).
- Pestañas, una sesión por pestaña.
- Copiar y pegar.
- Configuración en un archivo TOML que se aplica al guardar.

## Atajos

| Atajo                         | Acción                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `Ctrl+Shift+T`                | Nueva pestaña                                                    |
| `Ctrl+Shift+W`                | Cerrar pestaña                                                   |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Pestaña siguiente / anterior                                     |
| `Ctrl+Shift+C`                | Copiar                                                           |
| `Ctrl+C`                      | Copiar si hay texto seleccionado; si no, interrumpir el programa |
| `Ctrl+V` / `Ctrl+Shift+V`     | Pegar                                                            |

## Configuración

El archivo se crea en el primer arranque, con comentarios que explican cada opción:

| Sistema | Ruta                                                 |
| ------- | ---------------------------------------------------- |
| Windows | `%APPDATA%\terminal\config.toml`                     |
| Linux   | `~/.config/terminal/config.toml`                     |
| macOS   | `~/Library/Application Support/terminal/config.toml` |

Los cambios se aplican al guardar. Si el archivo tiene un error, la terminal lo muestra y mantiene la configuración anterior.

## Desarrollo

Requisitos: [Node.js](https://nodejs.org) 20 o superior, [Rust](https://rustup.rs) estable y los [requisitos de Tauri](https://tauri.app/start/prerequisites/) para tu sistema (en Windows, las Build Tools de Visual Studio con C++).

```
npm install
npm run tauri dev      # abre la app con recarga en caliente
npm run tauri build    # genera el instalador en target/release/bundle
```

Comprobaciones:

```
npm run format:check && npm run lint && npm run typecheck && npm test
npm run build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`npm run build` va antes que los comandos de `cargo`: la app Rust incluye `ui/dist` al compilar.

## Estructura

```
crates/pty      Sesiones de pseudo-terminal (ConPTY en Windows, forkpty en Unix)
crates/shell    Detección de los shells instalados
crates/config   Archivo de configuración, valores por defecto y recarga al guardar
src-tauri/      App de escritorio: ventana, comandos IPC y eventos
ui/             Interfaz: React, TypeScript, Tailwind y xterm.js
```
