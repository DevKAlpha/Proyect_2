# Terminal

Terminal de escritorio ligera para Windows, Linux y macOS. Pensada para trabajar con los shells de cada sistema, con Git y con agentes de IA, y para que una persona sin experiencia pueda empezar a usar una terminal.

> «Terminal» es un nombre provisional. El identificador de la app (`com.devkalpha.terminal`) y la carpeta de configuración cambian cuando se elija el definitivo.

## Qué hace

- Detecta los shells instalados (PowerShell, Windows PowerShell, cmd, Git Bash, WSL, bash, zsh, fish).
- Pestañas, una sesión por pestaña. Cada pestaña puede ser un shell o un agente de IA.
- Proyectos: carpetas con sus terminales, ordenadas en una barra lateral. Se guardan entre sesiones.
- Agentes de IA: detecta Claude Code, Codex, Gemini CLI, OpenCode y GitHub Copilot CLI. Los instalados se abren desde el menú de pestaña nueva; los que faltan se instalan desde ahí. Puedes añadir cualquier otro en la configuración.
- Navegador de pruebas: un navegador aislado que los agentes controlan para probar aplicaciones web.
- Personalizable: temas, colores, fuente, cursor e imagen de fondo.
- Fuente JetBrains Mono incluida, texto nítido en pantallas de alta densidad y zoom con el teclado.
- Avisa si faltan Node.js o Docker y los instala con un clic, en una pestaña donde ves el comando.
- Copiar y pegar, enlaces que se abren en el navegador.

## Atajos

| Atajo                          | Acción                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| `Ctrl+Shift+T`                 | Nueva pestaña                                                    |
| `Ctrl+Shift+W`                 | Cerrar pestaña                                                   |
| `Ctrl+Tab` / `Ctrl+Shift+Tab`  | Pestaña siguiente / anterior, dentro del proyecto                |
| `Ctrl+Shift+B`                 | Mostrar u ocultar la barra de proyectos                          |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Texto más grande / más pequeño / tamaño normal                   |
| `Ctrl+Shift+C`                 | Copiar                                                           |
| `Ctrl+C`                       | Copiar si hay texto seleccionado; si no, interrumpir el programa |
| `Ctrl+V` / `Ctrl+Shift+V`      | Pegar                                                            |
| `Shift+Enter`                  | Línea nueva sin enviar, en agentes de IA                         |
| `Ctrl+clic` en un enlace       | Abrir el enlace en el navegador                                  |
| `F2` o doble clic en un nombre | Cambiar el nombre de un proyecto o de una terminal               |

## Proyectos

Un proyecto es una carpeta con sus terminales, como una carpeta de conversaciones. Se crean con el `+` de la barra lateral, que pide la carpeta.

- Las terminales de un proyecto arrancan en su carpeta.
- La barra de pestañas muestra el proyecto que tienes abierto. La barra lateral los muestra todos.
- Cambiar de proyecto no detiene nada: lo que corre en los demás sigue corriendo.
- Al volver a abrir la app, los proyectos y sus terminales siguen en la lista. Cada terminal arranca cuando la abres, no antes: un agente guardado no se pone en marcha solo.
- «General» agrupa las terminales que no son de ningún proyecto. No se guarda.
- Quitar un proyecto cierra sus terminales. La carpeta no se toca.

Se guarda la lista (nombres, carpetas, qué ejecuta cada terminal). El texto y el historial de las terminales no se guardan.

## Agentes de IA

La flecha junto al `+` abre el menú de pestaña nueva, con cuatro grupos: shells, agentes instalados, agentes que se pueden instalar y navegador de pruebas. Un agente se abre en una pestaña normal del shell por defecto: al salir del agente, el shell sigue ahí.

Para añadir un agente o herramienta que la terminal no conoce, edita el archivo de configuración:

```toml
[[agents]]
name = "Aider"
command = "aider"
```

## Navegador de pruebas

Sirve para que un agente abra tu aplicación web, la lea, haga clic y compruebe que funciona.

1. Pulsa «Abrir navegador de pruebas» en la barra lateral. Se abre Chrome, Edge o Chromium.
2. La primera vez, elige «Dar el navegador a Claude Code» en el menú de pestaña nueva. Registra el navegador en el agente con un comando que ves en pantalla.
3. Pide al agente que pruebe tu aplicación.

Para otros agentes, registra a mano un servidor MCP con este comando (en Windows, con `cmd /c` delante):

```
npx -y chrome-devtools-mcp@latest --no-usage-statistics --no-performance-crux --browserUrl http://127.0.0.1:9333
```

Controlar un navegador a distancia es un permiso amplio, así que este navegador está limitado a propósito:

- Es un navegador aparte, con un perfil propio y vacío. Tu navegador de siempre, con tus sesiones y contraseñas, no queda expuesto.
- No inicia sesión con tu cuenta ni sincroniza tus datos.
- Solo acepta conexiones desde tu propio equipo (`127.0.0.1`).
- Solo se abre cuando lo pides y se cierra con la terminal.
- Mientras está abierto, cualquier programa de tu equipo puede controlarlo. No lo uses para entrar en tus cuentas personales.

El puerto se cambia con `[browser] port` en la configuración.

## Personalizar

«Personalizar», en la barra lateral, abre el archivo de configuración. Los cambios se aplican al guardar. Si el archivo tiene un error, la terminal lo muestra y mantiene la configuración anterior.

```toml
[theme]
preset = "light"            # "dark", "light" o "high-contrast"
background = "#fdf6e3"      # cualquier color sustituye al del tema
accent = "#b58900"

[theme.ansi]                # los 16 colores que usan los programas
red = "#dc322f"

[cursor]
style = "bar"               # "block", "bar" o "underline"
blink = false

[background]
image = 'C:\Users\tu\Imágenes\fondo.png'
dim = 0.75                  # 0 = imagen entera, 1 = no se ve

[font]
family = "Cascadia Code, monospace"
size = 15
```

La imagen de fondo se ve en las pestañas abiertas después de ponerla.

El archivo se crea en el primer arranque, con comentarios que explican cada opción:

| Sistema | Ruta                                                 |
| ------- | ---------------------------------------------------- |
| Windows | `%APPDATA%\terminal\config.toml`                     |
| Linux   | `~/.config/terminal/config.toml`                     |
| macOS   | `~/Library/Application Support/terminal/config.toml` |

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
crates/config   Configuración, temas y proyectos guardados
crates/tools    Herramientas y agentes de IA: cuáles faltan y cómo instalarlos
crates/browser  Navegador de pruebas aislado para los agentes
src-tauri/      App de escritorio: ventana, comandos IPC y eventos
ui/             Interfaz: React, TypeScript, Tailwind y xterm.js
```
