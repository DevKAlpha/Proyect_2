# Terminal_Duck

Versión 0.1A. Los instaladores y los gestores de paquetes solo admiten números, así que en ellos figura como 0.1.0.

Terminal de escritorio ligera para Windows, Linux y macOS. Pensada para trabajar con los shells de cada sistema, con Git y con agentes de IA, y para que una persona sin experiencia pueda empezar a usar una terminal.

> Las carpetas de configuración y de datos se siguen llamando `terminal`, y el identificador de la app sigue siendo `com.devkalpha.terminal`: así nada de lo que ya tenías se pierde con el cambio de nombre.

## Índice

- **Usarla:** [Instalar](#instalar) · [Qué hace](#qué-hace) · [Atajos](#atajos) · [Proyectos](#proyectos) · [Espacio de trabajo](#espacio-de-trabajo) · [Mientras escribes un comando](#mientras-escribes-un-comando) · [Mientras un comando trabaja](#mientras-un-comando-trabaja) · [Dónde estás](#dónde-estás) · [Control remoto](#control-remoto) · [Comandos de Linux](#comandos-de-linux) · [Enlaces y rutas](#enlaces-y-rutas) · [Pegar archivos e imágenes](#pegar-archivos-e-imágenes) · [Agentes de IA](#agentes-de-ia) · [Navegador de pruebas](#navegador-de-pruebas) · [Personalizar](#personalizar) · [Dónde están los archivos](#dónde-están-los-archivos)
- **Por dentro:** [Arquitectura](#arquitectura) · [Seguridad](#seguridad) · [Estructura del repositorio](#estructura-del-repositorio)
- **Contribuir:** [Ramas](#ramas) · [Desarrollo](#desarrollo) · [Pruebas](#pruebas)

## Instalar

Hay dos formas en cada sistema: con un comando o con un instalador. Las dos instalan lo mismo, completo: la aplicación y lo que necesita para funcionar. Los archivos están en la página de [versiones](https://github.com/DevKAlpha/Proyect_2/releases/latest).

### Windows

Con un comando, en PowerShell:

```powershell
irm https://raw.githubusercontent.com/DevKAlpha/Proyect_2/main/install/install.ps1 | iex
```

O con el instalador: descarga `terminal-duck-setup-x64.exe` y ábrelo.

- Se instala en `C:\Program Files (x86)\Terminal_Duck`, para todo el equipo. Windows pide permiso de administrador: en esa carpeta ningún otro programa puede cambiar los archivos de la aplicación. El instalador deja elegir otra carpeta.
- Incluye WebView2, el componente de Windows que dibuja la ventana, por si tu equipo no lo trae. Es lo único que la aplicación necesita.
- Crea el acceso «Terminal_Duck» en el menú Inicio y se desinstala desde «Aplicaciones instaladas».
- El instalador no está firmado todavía. Windows puede mostrar el aviso «Windows protegió su PC»: pulsa «Más información» y «Ejecutar de todas formas».

### Linux

Con un comando:

```sh
curl -fsSL https://raw.githubusercontent.com/DevKAlpha/Proyect_2/main/install/install.sh | sh
```

El comando elige el paquete de tu distribución y lo instala con tu gestor de paquetes, que añade las dependencias (WebKitGTK y GTK):

| Distribución               | Paquete                         | Se instala con            |
| -------------------------- | ------------------------------- | ------------------------- |
| Debian, Ubuntu, Mint       | `terminal-duck-amd64.deb`       | `apt-get`                 |
| Fedora, RHEL, openSUSE     | `terminal-duck-x86_64.rpm`      | `dnf`, `yum` o `zypper`   |
| Cualquier otra, o sin root | `terminal-duck-x86_64.AppImage` | se copia a `~/.local/bin` |

También puedes descargar el paquete e instalarlo tú: `sudo apt install ./terminal-duck-amd64.deb` o `sudo dnf install ./terminal-duck-x86_64.rpm`. El AppImage lleva dentro todo lo que necesita y no se instala: dale permiso de ejecución y ábrelo.

- `sh install.sh --appimage` usa el AppImage aunque haya gestor de paquetes: no pide contraseña y no toca el sistema.
- Por ahora solo hay paquetes para equipos x86_64.

### Qué hacen los comandos de instalación

Ejecutar un comando descargado de internet merece desconfianza, también este. Los dos son cortos y están en la carpeta `install/` de este repositorio (`install.ps1`, `install.sh`): puedes leerlos antes, o descargarlos y ejecutarlos en dos pasos.

- Descargan el instalador de la última versión y el archivo `SHA256SUMS`, solo por https.
- Comprueban que el instalador coincide con su suma SHA-256. Si no coincide, no instalan nada.
- No instalan nada más y no cambian ajustes del sistema.
- Esa suma protege de una descarga rota o alterada por el camino. No protege si alguien cambiara los archivos publicados en el repositorio.
- Para instalar sin conexión, pon el instalador y `SHA256SUMS` en una carpeta y pásala: `.\install.ps1 -Source C:\carpeta` o `sh install.sh --from /carpeta`.

## Qué hace

- Detecta los shells instalados (PowerShell, Windows PowerShell, cmd, Git Bash, WSL, bash, zsh, fish).
- Pestañas, una sesión por pestaña. Cada pestaña puede ser un shell o un agente de IA.
- Proyectos: carpetas con sus terminales, ordenadas en una barra lateral. Se guardan entre sesiones.
- La barra lateral se lee como el menú de una web: iconos propios, la terminal activa resaltada, cuántas terminales tiene cada proyecto y la letra de la plantilla que uses.
- Vista dividida: dos terminales lado a lado, con el reparto que tú elijas. Por ejemplo, un agente de IA a un lado y tu shell al otro.
- Agentes de IA: detecta Claude Code, Codex, Gemini CLI, OpenCode y GitHub Copilot CLI. Los instalados se abren desde el menú de pestaña nueva; los que faltan se instalan desde ahí. Puedes añadir cualquier otro en la configuración.
- Navegador de pruebas: un navegador aislado que los agentes controlan para probar aplicaciones web.
- Recuerda tus comandos y los sugiere mientras escribes. Sin historial, sugiere comandos habituales.
- Mientras un comando largo trabaja, un patito nada en la línea de ayuda con el tiempo transcurrido, como el indicador de Claude Code.
- Una línea de ayuda explica el comando que escribes, avisa si es de otro sistema o tiene una errata y propone el cambio.
- Comandos de Linux (`grep`, `ls`, `cat`, `touch`...) también en PowerShell y cmd.
- Una barra bajo cada terminal muestra la carpeta en la que estás y su rama de Git, y abre la carpeta en el explorador de archivos.
- Control remoto: abre una terminal en otro equipo por SSH, con tus equipos guardados en un menú.
- Borra parte de un comando seleccionándola con el ratón o con el teclado.
- Aspecto de consola de router por defecto: blanco sobre negro, con color solo donde hace falta distinguir algo.
- Personalizable: temas, colores, fuente, cursor e imagen de fondo.
- Letra de píxeles de terminal antigua (VT323) en el aspecto por defecto, y JetBrains Mono en las demás plantillas; las dos incluidas, texto nítido en pantallas de alta densidad y zoom con el teclado.
- Avisa si faltan Node.js o Docker y los instala con un clic, en una pestaña donde ves el comando.
- Pega y suelta archivos e imágenes: entran en la terminal como rutas, que es como los agentes de IA reciben una captura o un documento.
- Plantillas de aspecto, sencillas y detalladas, para cambiar el look con un clic y aprender a personalizarlo.
- Enlaces: las direcciones web se abren en el navegador, y las rutas de archivos y carpetas, en el explorador de archivos.
- Atajos de teclado para todo: terminales, proyectos, vista dividida, menús y pantalla completa. `F1` los muestra.
- Archivos ordenados en tres carpetas (programa, configuración y datos), a un clic desde el menú «Carpetas».
- Copiar y pegar. Lo pegado entra sin caracteres de control: un texto copiado de una web no puede ejecutar nada por su cuenta.
- El rótulo `TERMINAL_DUCK` con su patito, hecho de puntos cuadrados como los bloques de una terminal, siempre a la vista sobre la terminal. Toma los colores de la plantilla que uses.

## Atajos

`F1` muestra esta lista dentro de la terminal. Casi todos son `Ctrl+Shift` más una letra: una terminal no puede enviar esas combinaciones a un shell, así que ningún atajo le quita una tecla a un programa.

| Atajo                           | Acción                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| `Ctrl+Shift+T`                  | Nueva pestaña                                                    |
| `Ctrl+Shift+W`                  | Cerrar pestaña                                                   |
| `Ctrl+Tab` / `Ctrl+Shift+Tab`   | Pestaña siguiente / anterior, dentro del proyecto                |
| `Ctrl+Shift+B`                  | Mostrar u ocultar la barra de proyectos                          |
| `Ctrl+Shift+D`                  | Vista dividida: dos terminales lado a lado, o volver a una       |
| `Ctrl+Shift+E`                  | Pasar el teclado a la otra mitad                                 |
| `Ctrl+Shift+←` / `Ctrl+Shift+→` | Dar más sitio a la mitad derecha / izquierda                     |
| `F11`                           | Pantalla completa                                                |
| `Ctrl+1` … `Ctrl+9`             | Ir a la terminal 1 a 9 del proyecto                              |
| `Ctrl+Shift+↓` / `Ctrl+Shift+↑` | Proyecto siguiente / anterior                                    |
| `Ctrl+Shift+N`                  | Nuevo proyecto                                                   |
| `Ctrl+Shift+M`                  | Menú de terminal nueva: elegir shell o agente de IA              |
| `Ctrl+Shift+P`                  | Menú de plantillas de aspecto                                    |
| `Ctrl+Shift+S`                  | Abrir el archivo de configuración                                |
| `Ctrl+Shift+F`                  | Menú de carpetas de la terminal                                  |
| `Ctrl+Shift+O`                  | Abrir la carpeta actual en el explorador de archivos             |
| `Ctrl+Shift+R`                  | Menú de control remoto (SSH)                                     |
| `F1`                            | Mostrar u ocultar la lista de atajos                             |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0`  | Texto más grande / más pequeño / tamaño normal                   |
| `Ctrl+Shift+C`                  | Copiar                                                           |
| `Ctrl+C`                        | Copiar si hay texto seleccionado; si no, interrumpir el programa |
| `Ctrl+V` / `Ctrl+Shift+V`       | Pegar texto, archivos o una imagen                               |
| `→`                             | Aceptar el comando sugerido en gris                              |
| `Ctrl+.`                        | Aplicar el cambio que propone la línea de ayuda                  |
| `Ctrl+←` / `Ctrl+→`             | Seleccionar el comando carácter a carácter                       |
| `Ctrl+↑` / `Ctrl+↓`             | Seleccionar por filas, si el comando ocupa varias                |
| `Ctrl+Inicio` / `Ctrl+Fin`      | Seleccionar hasta el principio / el final del comando            |
| `Supr` o `Retroceso`            | Borrar lo seleccionado del comando                               |
| `Shift+Enter`                   | Línea nueva sin enviar, en agentes de IA                         |
| `Ctrl+clic` en un enlace        | Abrir una dirección web en el navegador                          |
| `Ctrl+clic` en una ruta         | Mostrar el archivo o la carpeta en el explorador de archivos     |
| `F2` o doble clic en un nombre  | Cambiar el nombre de un proyecto o de una terminal               |

## Proyectos

Un proyecto es una carpeta con sus terminales, como una carpeta de conversaciones. Se crean con el `+` de la barra lateral, que pide la carpeta.

- Las terminales de un proyecto arrancan en su carpeta.
- La barra de pestañas muestra el proyecto que tienes abierto. La barra lateral los muestra todos.
- Cambiar de proyecto no detiene nada: lo que corre en los demás sigue corriendo.
- Al volver a abrir la app, los proyectos y sus terminales siguen en la lista. Cada terminal arranca cuando la abres, no antes: un agente guardado no se pone en marcha solo.
- «General» agrupa las terminales que no son de ningún proyecto. No se guarda.
- Quitar un proyecto cierra sus terminales. La carpeta no se toca.

Se guarda la lista (nombres, carpetas, qué ejecuta cada terminal). El texto y el historial de las terminales no se guardan.

## Espacio de trabajo

La ventana tiene tres partes, y tú decides cuánto ocupa cada una:

- **La barra de proyectos**, a la izquierda. Arrastra su borde derecho para ensancharla o estrecharla. `Ctrl+Shift+B` la oculta para dejar todo el ancho a las terminales.
- **La terminal.**
- **Una segunda terminal**, a su lado, con la vista dividida.

**Vista dividida.** El botón de la derecha de la barra de pestañas, o `Ctrl+Shift+D`, pone dos terminales del proyecto lado a lado. Si solo hay una, abre otra.

- Arrastra la línea que las separa para repartir el espacio. Ninguna mitad baja del 20 %.
- Un clic en una mitad le da el teclado. Una línea de color arriba marca cuál lo tiene.
- Elegir otra pestaña la pone en la mitad que tiene el teclado; la otra mitad se queda como está.
- Cerrar una de las dos deja a la otra con toda la ventana.
- Cada mitad tiene su propia línea de ayuda y su barra de carpeta y rama. Si la mitad es estrecha, los botones de la barra quedan solo con su icono.
- La vista dividida es de cada proyecto y no se guarda al cerrar. Los tamaños que elijas sí se recuerdan.

Los divisores también se mueven con el teclado: lleva el foco a uno con `Tab` y usa las flechas izquierda y derecha.

## Mientras escribes un comando

**Sugerencias.** La terminal recuerda los comandos que ejecutas. Al escribir, muestra en gris el más reciente que empieza igual; la flecha derecha lo completa. Si ninguno empieza así, sugiere un comando habitual (`gi` propone `git`), solo de programas que tienes instalados.

**Línea de ayuda.** Bajo la terminal, una línea habla del comando que escribes:

- Qué hace: `git commit` «Guarda los cambios preparados en el historial».
- Si es de otro sistema y aquí no existe: `cls` en Linux propone `clear`; `ipconfig` propone `ip addr`.
- Si funciona distinto aquí: `ls -la` en PowerShell propone `ls -Force`; `export PORT=3000` propone `$env:PORT = "3000"`.
- Si parece una errata: `gti` propone `git`.
- Si es fácil arrepentirse: `rm -rf`, `git push --force`, `git reset --hard` y parecidos muestran un aviso. El aviso no impide ejecutar el comando.
- Si el programa no está instalado.

Cuando propone un cambio, `Ctrl+.` o el botón «Cambiar» lo aplican, y sigues escribiendo donde estabas. En el primer prompt de cada terminal la línea muestra un consejo de uso.

La ayuda sale de una lista local de comandos habituales y de los programas instalados en el equipo. No usa internet ni IA, y nada de lo que escribes sale de la app. Solo mira el primer comando de la línea.

**Borrar seleccionando.** Selecciona parte del comando y pulsa `Supr` o `Retroceso` para borrarla:

- Con el ratón: arrastra sobre el texto del comando.
- Con el teclado: mantén `Ctrl` y mueve con las flechas. Funciona también en comandos largos que ocupan varias filas.

Todo esto funciona en PowerShell, cmd, Git Bash, bash, zsh, fish y WSL (cuando el shell de la distribución es bash). Solo actúa mientras escribes un comando: dentro de un programa (un editor, un agente de IA) todas las teclas van al programa sin cambios.

- PowerShell y fish ya dibujan su propia sugerencia tras el cursor. Donde la muestran, la terminal no pinta la suya encima.
- En fish, la terminal dibuja esa sugerencia atenuada para distinguirla de lo que escribes.
- En zsh, la terminal lee un archivo de arranque propio, guardado en su carpeta de datos, que carga después los tuyos. Tus archivos de zsh no se tocan.
- En WSL, la ayuda no sabe qué programas hay dentro de Linux: no avisa de erratas ni de programas sin instalar.

Con `Ctrl` como tecla de selección, `Ctrl+←` y `Ctrl+→` dejan de saltar por palabras mientras escribes un comando. Si prefieres conservar ese salto, selecciona con `Shift`:

```toml
[input]
select_with = "shift"
```

**Qué se guarda.** Los comandos se guardan en un archivo de texto que puedes leer, editar o borrar:

| Sistema | Ruta                                                      |
| ------- | --------------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\terminal\data\history.txt`                |
| Linux   | `~/.local/share/terminal/data/history.txt`                |
| macOS   | `~/Library/Application Support/terminal/data/history.txt` |

- No se guardan los comandos que parecen llevar una credencial (contienen `password`, `token`, `secret`, `apikey` y similares).
- No se guarda un comando que empieza por un espacio. Úsalo cuando no quieras dejar rastro.
- No se guarda lo que escribes dentro de un programa, ni las contraseñas que un programa te pide: la terminal lee el comando de la pantalla, y una contraseña no se muestra.
- «Olvidar comandos recordados», en la barra lateral, los borra todos.
- `history_size = 0` en `[input]` desactiva el recuerdo; `suggestions = false` oculta las sugerencias; `hints = false` quita la línea de ayuda.

El filtro de credenciales reduce el riesgo, no lo elimina: un secreto escrito de otra forma sí se guardaría.

## Mientras un comando trabaja

Un comando que tarda deja la pantalla quieta, y una pantalla quieta parece colgada. Si un comando sigue en marcha pasado un segundo, la línea de ayuda muestra un patito con chistera que nada sobre olas, una palabra de lo que hace (`Remando`, `Chapoteando`, `Buceando`…) y el tiempo transcurrido:

```
🦆 Remando… 1 min 05 s · Ctrl+C lo detiene
```

- **Cuándo empieza.** Al pulsar `Enter` en el prompt con un comando escrito. Los comandos que acaban antes de un segundo no lo muestran: solo parpadearía.
- **Cuándo acaba.** Cuando el shell vuelve a mostrar su prompt, que es la señal de que el comando terminó (las marcas de prompt, ver [Arquitectura](#marcas-de-prompt)). También con `Ctrl+C`.
- **Cuándo no sale.** Con programas que hablan contigo en lugar de trabajar solos: editores y paginadores (`vim`, `nano`, `less`, `man`, `top`), agentes de IA (`claude`, `codex`, `gemini`, `opencode`, `copilot`, `aider`), conexiones remotas (`ssh`, `telnet`), consolas abiertas sin argumentos (`python`, `node`, `pwsh`, `psql`…) y contenedores con terminal (`docker run -it`). Tampoco con programas que ocupan la pantalla entera.
- **Si escribes en el programa** (responder a una pregunta, una contraseña), el patito se va hasta el próximo comando: el programa está hablando contigo.
- **Colores.** Los del patito del rótulo, sacados de la plantilla en uso; el agua usa el cian de la plantilla.
- **Movimiento.** Un fotograma cada 140 ms. Si el sistema pide reducir el movimiento, nada a un tercio de esa velocidad: sigue moviéndose porque su trabajo es mostrar que algo pasa.
- Vive en la línea de ayuda: con `hints = false` en `[input]` no aparece.

Un programa que espera tu respuesta sin que hayas escrito nada todavía (una pregunta de `Read-Host`, por ejemplo) se ve igual que uno que trabaja: el patito sigue nadando hasta que escribes.

## Dónde estás

Bajo cada terminal hay una barra. A la izquierda dice dónde estás; a la derecha, lo que puedes hacer desde ahí:

- **La carpeta** en la que está el shell. Tu carpeta personal se escribe `~`. Si la ruta no cabe, se corta por el principio; al pasar el ratón se ve entera.
- **La rama de Git**, cuando la carpeta está dentro de un repositorio. Si no hay rama (estás en un commit suelto), muestra el principio del commit.
- **Explorador de archivos**: abre esa carpeta en el explorador del sistema.
- **Control remoto**: abre una terminal en otro equipo (ver más abajo).

La barra sigue al shell: se actualiza después de cada comando (`cd`, `git switch`...) y al volver a la ventana. Funciona en PowerShell, cmd, Git Bash, bash, zsh y fish. Dentro de un programa (un editor, un agente de IA) muestra la última carpeta que anunció el shell.

- La rama se lee de los archivos del repositorio. No hace falta tener Git instalado y no se ejecuta nada.
- En WSL la barra muestra la carpeta de Linux, sin rama, y el botón del explorador queda desactivado: esa carpeta está dentro de Linux.
- En PowerShell, si entras en el registro (`cd HKLM:`), la barra sigue mostrando la última carpeta de archivos.
- Las carpetas compartidas por otro equipo (`\\servidor\carpeta`) no se muestran. Mirarlas enviaría tus credenciales a ese equipo sin que lo hayas pedido.

## Control remoto

«Control remoto», en la barra bajo la terminal, abre una terminal en otro equipo por SSH: un servidor, otra máquina de tu red, una Raspberry Pi.

- El menú lista los equipos que ya tienes en tu configuración de SSH (`~/.ssh/config`), por su nombre.
- «Otro equipo…» pide el equipo a mano, como `usuario@equipo` o solo `equipo`. `Enter` conecta, `Esc` cancela.
- La conexión se abre en una pestaña nueva de tu shell, que ejecuta `ssh` a la vista. Al cerrar la conexión, el shell sigue ahí.

La conexión siempre sale de tu equipo hacia el otro, con el programa `ssh` del sistema. La terminal no acepta conexiones de fuera y no abre ningún puerto: nadie puede controlar tu equipo a través de ella.

- De tu configuración de SSH solo se leen los nombres de los equipos, nunca las claves. Las líneas `Include` no se siguen.
- El nombre del equipo solo admite letras, números, puntos, guiones y guiones bajos. Así un texto pegado por error no puede colar otro comando ni una opción de `ssh`.
- Para un puerto distinto u otras opciones, guarda el equipo en `~/.ssh/config` o escribe el comando `ssh` tú mismo.
- En la pestaña remota, la barra sigue mostrando la carpeta de tu equipo: el shell del otro lado no anuncia la suya.

## Comandos de Linux

En Linux, la terminal abre primero tu shell de inicio de sesión. La ayuda al escribir funciona en bash, zsh y fish.

En Windows hay tres formas de usar comandos de Linux:

- **En PowerShell y cmd.** Si tienes Git para Windows, sus herramientas Unix (`grep`, `ls`, `cat`, `touch`, `sed`, `awk`, `head`, `tail`, `which` y más) funcionan también ahí. Su carpeta se añade al final del PATH de cada pestaña: no sustituye a ningún programa de Windows y el PATH del sistema no cambia. Se desactiva con `linux_commands = false` en la configuración.
- **En Git Bash.** Un bash completo con esas mismas herramientas.
- **En WSL.** Una distribución Linux real, con `apt`, `sudo` y todo lo demás.

En PowerShell, `ls`, `cat`, `rm`, `cp` y `mv` son nombres de comandos propios de PowerShell y no aceptan las opciones de Linux. La línea de ayuda avisa y propone la forma de PowerShell.

## Enlaces y rutas

Lo que un programa imprime y se puede abrir queda subrayado al pasar el ratón. `Ctrl+clic` lo abre según lo que sea:

- **Una dirección web** (`https://...`) se abre en tu navegador.
- **Una carpeta** se abre en el explorador de archivos.
- **Un archivo** se muestra seleccionado dentro de su carpeta, en el explorador de archivos.

Se reconocen rutas completas (`C:\Users\ana\notas.txt`, `/etc/hosts`), desde tu carpeta personal (`~/web`), relativas a la carpeta en la que estás (`src/app.ts`, `README.md`) y direcciones `file://`. Una ruta con espacios se reconoce si va entre comillas. El número de línea que añaden los compiladores (`src/app.ts:12:5`) se ignora.

- Solo se subraya lo que existe en tu equipo. Una palabra que parece una ruta y no lo es no se convierte en enlace.
- Un archivo nunca se ejecuta ni se abre con su programa: solo se muestra en el explorador. Lo que imprime un programa no es de fiar, y abrir así un ejecutable lo pondría en marcha.
- Las rutas de otro equipo (`\\servidor\carpeta`) no se abren.
- Una ruta que no cabe en una fila y sigue en la siguiente no se reconoce.
- En WSL las rutas son de Linux y no se pueden mostrar desde aquí.

## Pegar archivos e imágenes

Una terminal solo recibe texto, así que un archivo entra como su ruta. Es lo que esperan los programas, y sobre todo los agentes de IA: pega la ruta de una captura en Claude Code y la adjunta.

- **Archivos copiados** en el explorador: `Ctrl+V` escribe sus rutas, separadas por espacios.
- **Una imagen** del portapapeles (una captura de pantalla, una imagen copiada de una web): `Ctrl+V` la guarda como archivo PNG y escribe la ruta de ese archivo.
- **Arrastrar y soltar** archivos sobre la ventana hace lo mismo, en la terminal que tienes abierta.
- **Texto**: se pega como siempre.

Sirve cualquier tipo de archivo (imágenes, PDF, documentos, hojas de cálculo, código, comprimidos), menos los vídeos, que se omiten con un aviso en la barra inferior.

- Cada ruta se escribe como la lee el shell de esa terminal. Si tiene espacios u otros caracteres especiales va entre comillas, así el nombre de un archivo nunca se ejecuta como comando. En WSL, `C:\carpeta` se escribe `/mnt/c/carpeta`.
- Nada se ejecuta al pegar: la ruta queda escrita y tú decides qué hacer con ella.
- Si el portapapeles tiene a la vez texto y una imagen (pasa al copiar celdas de una hoja de cálculo), se pega el texto.
- Las imágenes pegadas se guardan en tu equipo y se borran solas a los 7 días:

| Sistema | Carpeta                                              |
| ------- | ---------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\terminal\data\pasted`                |
| Linux   | `~/.local/share/terminal/data/pasted`                |
| macOS   | `~/Library/Application Support/terminal/data/pasted` |

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
preset = "light"            # "console", "dark", "light" o "high-contrast"
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

### Plantillas

«Plantillas», en la barra lateral, cambia colores, fuente y cursor por un aspecto ya hecho. Sirven para dos cosas: cambiar el look con un clic y ver cómo se escribe una personalización. Después de aplicar una, «Personalizar» abre tu archivo con el texto de la plantilla, comentado, para que lo cambies a tu gusto.

| Plantilla      | Tipo      | Qué enseña                                                               |
| -------------- | --------- | ------------------------------------------------------------------------ |
| Predeterminada | Sencilla  | El aspecto de fábrica (consola de router), con todas las opciones a mano |
| Oscura         | Sencilla  | Una sola línea (`preset`) cambia todos los colores                       |
| Clara          | Sencilla  | Otro tema ya hecho: fondo claro y tinta gris                             |
| Alto contraste | Sencilla  | Un tema ya hecho y una letra más grande                                  |
| Ámbar          | Sencilla  | Retocar tres colores de un tema sin escribirlo entero                    |
| Nórdica        | Detallada | Todos los colores, la fuente y el cursor, en azules                      |
| Drácula        | Detallada | Los 16 colores de los programas, muy vivos                               |
| Papel          | Detallada | Un tema claro escrito color a color                                      |
| Fósforo verde  | Detallada | Un solo color en varios tonos, como un monitor antiguo                   |

- Una plantilla solo sustituye las secciones `[font]`, `[cursor]` y `[theme]` de tu archivo. El shell, los agentes, la imagen de fondo y el resto de tus ajustes quedan como estaban.
- Lo que tuvieras escrito en esas tres secciones se reemplaza. Antes de cambiar nada, tu archivo se copia como `config.backup.toml` en la misma carpeta. Solo se guarda una copia: la del último cambio.

El archivo se crea en el primer arranque, con comentarios que explican cada opción:

| Sistema | Ruta                                                 |
| ------- | ---------------------------------------------------- |
| Windows | `%APPDATA%\terminal\config.toml`                     |
| Linux   | `~/.config/terminal/config.toml`                     |
| macOS   | `~/Library/Application Support/terminal/config.toml` |

## Dónde están los archivos

La terminal usa tres carpetas, cada una con un trabajo. El menú «Carpetas» de la barra lateral (`Ctrl+Shift+F`) abre cualquiera de ellas en el explorador de archivos.

| Carpeta       | Qué hay                                                                | Windows                                | Linux                                               |
| ------------- | ---------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Programa      | La aplicación, el desinstalador y `LEEME.txt`                          | `C:\Program Files (x86)\Terminal_Duck` | `/usr/bin/terminal-duck` y `/usr/lib/Terminal_Duck` |
| Configuración | `config.toml`, su copia y tus proyectos                                | `%APPDATA%\terminal`                   | `~/.config/terminal`                                |
| Datos         | Comandos recordados, imágenes pegadas, perfil del navegador de pruebas | `%LOCALAPPDATA%\terminal\data`         | `~/.local/share/terminal/data`                      |

- `LEEME.txt`, en la carpeta del programa, explica archivo por archivo qué es cada cosa, cómo abrir la terminal desde otra terminal, cómo comprobar un instalador con su suma SHA-256 y cómo desinstalar.
- Borrar la carpeta de datos no rompe nada: solo se pierden los comandos recordados y las imágenes pegadas. Borrar la de configuración devuelve el aspecto de fábrica.
- Desinstalar no toca ni la configuración ni los datos.
- Las versiones anteriores guardaban los datos sueltos junto al programa. Al abrir esta versión se mueven solos a `data`.

## Arquitectura

Terminal_Duck es una aplicación [Tauri 2](https://tauri.app): un proceso nativo escrito en Rust que posee los shells, y una ventana web (WebView2 en Windows, WebKitGTK en Linux, WKWebView en macOS) que dibuja. La ventana nunca toca el sistema por su cuenta: todo pasa por un conjunto cerrado de comandos.

### Capas

```
┌──────────────────────────────── ventana (ui/) ────────────────────────────────┐
│ React + TypeScript + Tailwind                                                │
│ xterm.js (WebGL)  ·  stores Zustand  ·  rótulo, barra lateral, barras        │
└───────────────▲──────────────────────────────────────────────┬───────────────┘
                │ eventos y canales binarios                   │ invoke (IPC)
┌───────────────┴──────────────────────────────────────────────▼───────────────┐
│ src-tauri: comandos IPC, estado compartido, vigilancia de la configuración   │
├───────────────────────────────────────────────────────────────────────────────┤
│ crates/pty    crates/shell    crates/config    crates/history                │
│ crates/tools  crates/browser  crates/context   crates/paste                  │
└───────────────▲──────────────────────────────────────────────┬───────────────┘
                │ bytes de salida                              │ bytes de entrada
        pseudo-terminal del sistema (ConPTY · forkpty)  →  shell  →  programas
```

- **`crates/`** contiene la lógica. Ningún crate conoce la ventana: reciben datos y devuelven datos, así que se prueban sin abrir nada.
- **`src-tauri/`** solo conecta: posee la ventana, expone los crates como comandos y reenvía sus eventos.
- **`ui/`** dibuja y decide qué pedir. La lógica de la interfaz vive en funciones puras con tests (`ui/src/stores`); los componentes solo pintan.

### Qué hace cada crate

| Crate            | Responsabilidad                                                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/pty`     | Una sesión = un proceso unido a un pseudo-terminal (`portable-pty`: ConPTY en Windows, forkpty en Unix). Entrega la salida en bloques de hasta 8192 bytes por una función de retorno. Soltar la sesión mata el proceso.       |
| `crates/shell`   | Detecta los shells instalados, con su ruta absoluta. Genera las marcas de prompt de cada shell (módulo `integration`). Lee la carpeta que el shell anuncia y convierte texto impreso en rutas locales fiables (módulo `cwd`). |
| `crates/config`  | `config.toml`: lectura, valores por defecto, vigilancia en caliente y versión de formato. Temas (`theme`), plantillas (`templates`), proyectos guardados (`workspace`) y carpetas de la app (`folders`).                      |
| `crates/history` | Comandos recordados en un archivo de texto, uno por línea. Decide qué no se guarda: credenciales, comandos que empiezan por espacio, entradas de varias líneas o de más de 2000 caracteres.                                   |
| `crates/tools`   | Informa de qué hay instalado (Node.js, Docker, agentes de IA, `ssh`) y del comando que instala lo que falta. Nunca ejecuta un instalador. Lee los nombres de equipo de `~/.ssh/config` (módulo `ssh`), nunca las claves.      |
| `crates/browser` | Encuentra Chrome, Edge o Chromium y lo arranca aislado, con perfil propio, escuchando solo en `127.0.0.1`.                                                                                                                    |
| `crates/context` | La rama de Git de una carpeta, leída de los archivos de `.git` sin arrancar `git`: se consulta tras cada comando.                                                                                                             |
| `crates/paste`   | Lee el portapapeles: texto, archivos copiados o una imagen, que guarda como PNG para poder pegarla como ruta. Borra las imágenes de más de 7 días.                                                                            |

### Recorrido de una tecla y de la salida

1. xterm.js traduce la tecla a bytes (`onData`). Antes de enviarlos, `promptAssist` lee de la pantalla la línea que se está escribiendo.
2. La ventana llama a `pty_write` con el id de la sesión. El proceso nativo escribe los bytes en el pseudo-terminal.
3. El shell responde. Un hilo por sesión lee el pseudo-terminal y pasa cada bloque por `CwdScanner`, que busca el anuncio de carpeta.
4. El bloque viaja a la ventana por un canal binario, sin pasar por JSON: un bloque puede cortar un carácter UTF-8 o una secuencia de escape por la mitad, y xterm.js los recompone.
5. xterm.js dibuja con WebGL. Si el equipo no tiene WebGL2, o la GPU pierde el contexto, sigue con su dibujo por DOM.
6. Otro hilo espera el fin del proceso y avisa por un segundo canal: la pestaña se cierra sola.

En Windows, ConPTY pregunta la posición del cursor al arrancar (`ESC [ 6 n`) y el shell no empieza hasta recibir respuesta. xterm.js responde; lo que se teclea antes de conocer el id de sesión se guarda y se envía en orden.

Cada sesión arranca con `TERM=xterm-256color` y `COLORTERM=truecolor`.

### Marcas de prompt

Una terminal solo ve caracteres: no distingue el comando que escribes de la salida que lo rodea. Las sugerencias, la línea de ayuda y el borrado por selección necesitan saberlo. Cada shell se arranca de modo que imprima una marca invisible tras su prompt (`OSC 133 ; B`, la que usan otras terminales) y anuncie su carpeta. Nada se escribe en tus archivos de configuración de shell: todo va en argumentos y variables del proceso que se arranca.

| Shell                          | Cómo se añade la marca                                                                                                 | Cómo anuncia la carpeta |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| PowerShell, Windows PowerShell | `-NoExit -Command` con una función que envuelve tu `prompt` y lo llama primero                                         | `OSC 9 ; 9 ; ruta`      |
| cmd                            | Variable `PROMPT`, con `$E` como carácter de escape                                                                    | `OSC 9 ; 9 ; $P`        |
| bash, Git Bash                 | Variable `PROMPT_COMMAND`: añade la marca al final de `PS1` si no está                                                 | `OSC 7 ; file://…`      |
| WSL                            | Lo mismo que bash, cruzando a Linux con `WSLENV` (`PROMPT_COMMAND/u`)                                                  | `OSC 7 ; file://…`      |
| zsh                            | `ZDOTDIR` apunta a un `.zshenv` propio en la carpeta de datos, que devuelve a zsh su carpeta real y carga tus archivos | `OSC 7 ; file://…`      |
| fish                           | `--init-command`: envuelve `fish_prompt` y atenúa la sugerencia propia de fish                                         | `OSC 7 ; file://…`      |

Un shell sin marcas (`sh`, o un prompt que sustituye al nuestro) funciona como terminal normal, sin ayuda al escribir.

### Lo que imprime un programa no es de fiar

Cualquier programa, o un archivo mostrado con `cat`, puede imprimir secuencias de escape. Por eso:

- **Carpeta anunciada** (`local_folder`): solo se acepta una ruta local con letra de unidad (o absoluta en Unix). Nunca una ruta de red (`\\equipo\recurso`). Además debe existir. Dentro de WSL la ruta solo se muestra: no se abre.
- **Rutas impresas** (`local_path`): absolutas, relativas a la carpeta del shell, `~` o `file://`. Se descartan los textos de más de 1024 caracteres o con caracteres de control, y solo se subrayan las rutas que existen. Como mucho se comprueban 32 por línea.
- **Abrir**: una carpeta se abre en el explorador y un archivo se muestra seleccionado en su carpeta. Nunca se abre un archivo con su programa: si fuera un ejecutable, se ejecutaría.
- **Enlaces web**: solo `http` y `https`, y con `Ctrl` pulsado. La restricción está en los permisos de la ventana, no solo en la interfaz.

### Comandos IPC

La ventana solo puede llamar a estos comandos. La regla común: envía identificadores, nunca rutas ni programas.

| Comando                                           | Qué hace                                                  | Qué impide                                                                               |
| ------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `list_shells`, `list_tools`, `list_agents`        | Lo detectado en el equipo                                 |                                                                                          |
| `list_programs(shell_id)`                         | Programas del `PATH` de ese shell, para la línea de ayuda |                                                                                          |
| `pty_spawn(shell_id, project_id, cols, rows)`     | Arranca un shell y devuelve el id de sesión               | Solo shells detectados, y solo en la carpeta de un proyecto registrado o en la de inicio |
| `pty_write`, `pty_resize`, `pty_kill`             | Entrada, tamaño y fin de una sesión                       | Una sesión que ya no existe se ignora                                                    |
| `session_place(id)`                               | Carpeta y rama de Git de la sesión                        |                                                                                          |
| `open_folder(id)`                                 | Abre en el explorador la carpeta de la sesión             | Solo carpetas que existen; nunca un archivo                                              |
| `paths_exist`, `reveal_path`                      | Enlaces de rutas impresas                                 | Las reglas de `local_path`                                                               |
| `get_config`, `open_config_file`                  | La configuración y su archivo                             |                                                                                          |
| `list_templates`, `apply_template(id)`            | Plantillas de aspecto                                     | Copia antes el archivo como `config.backup.toml`                                         |
| `read_background`                                 | Los bytes de la imagen de fondo                           | Solo el archivo de tu configuración: PNG, JPG, WebP o GIF, hasta 25 MB                   |
| `load_workspace`, `save_workspace`, `pick_folder` | Proyectos guardados y diálogo de carpeta del sistema      |                                                                                          |
| `history_list`, `history_add`, `history_clear`    | Comandos recordados                                       | El filtro de `crates/history`                                                            |
| `clipboard_paste`                                 | Texto, archivos o imagen del portapapeles                 |                                                                                          |
| `ssh_status`                                      | Si hay `ssh` y los equipos de `~/.ssh/config`             | Lee nombres, nunca claves; como mucho 1 MB                                               |
| `browser_status`, `browser_open`, `browser_close` | Navegador de pruebas                                      | Solo arranca cuando lo pides; no arranca si el puerto está ocupado                       |
| `open_app_folder(which)`                          | Abre la carpeta de programa, configuración o datos        | Un nombre de tres posibles, nunca una ruta                                               |

Eventos hacia la ventana: `config-changed`, con la configuración nueva tras guardar el archivo, y `config-error`, con el motivo si el archivo tiene un error.

### Configuración

Un archivo TOML legible. Todas las claves son opcionales: la que falta toma su valor por defecto, y una clave desconocida se ignora. Se vigila la carpeta, no el archivo, porque muchos editores sustituyen el archivo al guardar. Un archivo con error no se aplica: se conserva la configuración anterior y la ventana muestra el motivo.

| Clave                        | Por defecto                | Qué controla                                                               |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `version`                    | `1`                        | Formato del archivo. Un archivo de versión mayor se rechaza con un aviso   |
| `default_shell`              | el primero detectado       | `pwsh`, `powershell`, `cmd`, `git-bash`, `wsl`, `bash`, `zsh` o `fish`     |
| `scrollback`                 | `5000`                     | Líneas de historial por pestaña                                            |
| `padding`                    | `8`                        | Margen entre el texto y el borde, en píxeles                               |
| `linux_commands`             | `true`                     | En Windows, añade las herramientas Unix de Git al final del `PATH`         |
| `[font] family`              | `VT323, JetBrains Mono, …` | Lista CSS: gana la primera fuente disponible                               |
| `[font] size`                | `20`                       | Tamaño base. El zoom se suma sin guardarse (de 6 a 48)                     |
| `[font] line_height`         | `1.0`                      | Alto de línea, como múltiplo del tamaño                                    |
| `[cursor] style`, `blink`    | `block`, `true`            | `block`, `bar` o `underline`                                               |
| `[theme] preset`             | `console`                  | `console`, `dark`, `light` o `high-contrast`                               |
| `[theme]` colores            | los del tema               | `background`, `foreground`, `cursor`, `selection`, `accent`                |
| `[theme.ansi]`               | los del tema               | Los 16 colores numerados: `black`…`white` y `bright_black`…`bright_white`  |
| `[background] image`, `dim`  | `""`, `0.75`               | Imagen de fondo y cuánto la tapa el color de fondo                         |
| `[browser] port`             | `9333`                     | Puerto local del navegador de pruebas                                      |
| `[input] suggestions`        | `true`                     | Sugerencia en gris tras el cursor                                          |
| `[input] hints`              | `true`                     | Línea de ayuda bajo la terminal                                            |
| `[input] history_size`       | `1000`                     | Comandos recordados. `0` no recuerda ninguno                               |
| `[input] select_with`        | `ctrl`                     | Tecla que, con las flechas, selecciona texto del comando: `ctrl` o `shift` |
| `[[agents]] name`, `command` | ninguno                    | Entradas propias del menú de pestaña nueva                                 |

Un tema parte de un `preset` y cualquier color escrito lo sustituye. xterm.js sube el contraste del texto hasta 4,5:1 (WCAG AA) cuando un programa imprime gris sobre el fondo.

Si tu archivo conserva, sin tocar, las líneas de tema o de fuente que escribió una versión anterior, se actualizan una vez al abrir. Un valor que hayas cambiado no se toca.

### Qué se guarda en disco

| Archivo                  | Formato | Contenido                                                               |
| ------------------------ | ------- | ----------------------------------------------------------------------- |
| `config.toml`            | TOML    | Tu configuración                                                        |
| `config.backup.toml`     | TOML    | La configuración anterior a la última plantilla aplicada                |
| `workspace.json`         | JSON    | Proyectos: nombre, carpeta y qué ejecuta cada terminal. Nunca su salida |
| `data/history.txt`       | Texto   | Comandos recordados, uno por línea, el más antiguo primero              |
| `data/pasted/`           | PNG     | Imágenes pegadas. Se borran a los 7 días                                |
| `data/shell/zsh/.zshenv` | Texto   | Archivo de arranque para zsh. Se reescribe solo si cambia               |
| `data/browser-profile/`  | —       | Perfil del navegador de pruebas                                         |

Los datos están en la carpeta local del equipo, no en la que se sincroniza con la cuenta: el historial puede contener lo que el filtro no vio. El ancho de la barra lateral, el reparto de la vista dividida y si la barra está oculta se guardan en el almacenamiento de la ventana.

### La interfaz por dentro

| Módulo (`ui/src`)                                                                    | Papel                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ipc.ts`                                                                             | Las únicas llamadas al proceso nativo, con sus tipos                                                                                                             |
| `stores/tabs`                                                                        | Pestañas, proyectos y vista dividida; qué se guarda y qué no                                                                                                     |
| `stores/settings`                                                                    | Configuración cargada, zoom, tamaños de la ventana, plantillas                                                                                                   |
| `stores/inputLine`, `promptAssist`                                                   | Leen de la pantalla la línea que se escribe, a partir de la marca del prompt                                                                                     |
| `stores/guide`, `guideData`                                                          | Línea de ayuda: qué hace un comando, si es de otro sistema, erratas (dos letras cambiadas de sitio, o una letra de diferencia en nombres largos) y su corrección |
| `stores/history`                                                                     | Sugerencia: el comando recordado más reciente que empieza igual                                                                                                  |
| `stores/paste`                                                                       | Qué entra al pegar: limpieza de caracteres de control, confirmación de varias líneas, comillas de cada shell                                                     |
| `stores/pathLinks`, `components/pathLinks`                                           | Rutas impresas convertidas en enlaces                                                                                                                            |
| `stores/remote`                                                                      | El único sitio que construye un comando `ssh`, con el nombre de equipo validado                                                                                  |
| `stores/shortcuts`                                                                   | Una tabla decide qué tecla es un atajo y alimenta el panel de `F1`                                                                                               |
| `stores/working`, `components/DuckWorking`                                           | El patito que nada mientras un comando trabaja: cuándo sale, sus fotogramas y el tiempo                                                                          |
| `stores/banner`, `components/Welcome`                                                | El rótulo: rejillas de puntos convertidas en formas                                                                                                              |
| `components/TerminalPane`                                                            | Una pestaña: una pantalla de xterm.js unida a una sesión                                                                                                         |
| `components/Sidebar`, `SidebarIcon`                                                  | Barra lateral e iconos propios                                                                                                                                   |
| `components/StatusBar`, `HintBar`, `TabBar`, `ToolsBar`, `Divider`, `ShortcutsPanel` | Las demás piezas de la ventana                                                                                                                                   |

Las pestañas inactivas siguen montadas y ocultas: su pantalla y su historial sobreviven al cambio de pestaña, y el shell vive lo mismo que la pestaña. xterm.js usa las tablas de anchura de Unicode 11, para que emojis y caracteres anchos no desplacen el cursor en las pantallas de los agentes.

`Shift+Enter` se envía como `ESC` + `Enter`: es lo que los agentes de IA leen como «línea nueva, no enviar todavía».

### Instaladores

| Sistema | Paquete                         | Cómo está hecho                                                                                                                             |
| ------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | `terminal-duck-setup-x64.exe`   | NSIS, para todo el equipo, con el instalador de WebView2 dentro. La plantilla es la de Tauri con una línea cambiada: la carpeta por defecto |
| Debian  | `terminal-duck-amd64.deb`       | Declara WebKitGTK y GTK como dependencias; `apt` las instala                                                                                |
| Fedora  | `terminal-duck-x86_64.rpm`      | Lo mismo, con `dnf`, `yum` o `zypper`                                                                                                       |
| Otras   | `terminal-duck-x86_64.AppImage` | Lleva dentro todo lo que necesita; no pide permisos de root                                                                                 |

Cada versión se publica con `SHA256SUMS`. Los guiones `install/install.ps1` e `install/install.sh` descargan solo por `https`, comparan la suma antes de ejecutar nada y aceptan una carpeta local como origen para instalar sin conexión.

## Seguridad

Una terminal ejecuta lo que se le pide; lo que debe impedir es que algo se ejecute sin que tú lo pidas.

- **La ventana no carga nada de fuera.** Solo archivos propios, con una política de contenido estricta: sin `object`, sin `base`, sin formularios y sin marcos. Las herramientas de desarrollo del navegador no existen en la versión instalada.
- **Permisos mínimos.** La ventana puede usar el portapapeles, la pantalla completa y abrir direcciones `http` y `https`. Nada más.
- **No se puede depurar desde fuera.** La versión instalada borra de su entorno las variables de WebView2 que abrirían un puerto de depuración o cambiarían el navegador o su perfil.
- **Pegado.** Lo pegado entra sin caracteres de control: un texto con la marca de fin de pegado (`ESC [ 201 ~`) ya no puede cerrar el pegado protegido y ejecutar lo que sigue. Si el shell no protege el pegado (PowerShell y cmd), un texto de varias líneas pide confirmación, con el foco en «Cancelar», y una sola línea nunca se ejecuta sola.
- **Rutas pegadas.** Cada ruta se escribe con las comillas de su shell: el nombre de un archivo no puede colar un comando.
- **Sin puertas de entrada.** La aplicación no escucha en ningún puerto. El control remoto es `ssh` saliendo de tu equipo, y el nombre del equipo solo admite letras, dígitos, puntos, guiones y guiones bajos, nunca un guion inicial.
- **Navegador de pruebas.** Es otro navegador, con perfil propio y vacío, sin inicio de sesión ni sincronización. Escucha solo en `127.0.0.1`, solo mientras lo tienes abierto, y se cierra con la terminal. Nunca es la ventana de la terminal.
- **Historial.** No se recuerda un comando que contenga `password`, `token`, `secret`, `apikey`, `bearer` o similares, ni el que empieza por un espacio.
- **Instalación.** En Windows el programa queda en una carpeta que solo un administrador puede cambiar.
- **Dependencias.** `cargo audit` y `npm audit` no informan de vulnerabilidades en esta versión.

Límites conocidos: el instalador de Windows no está firmado, y `SHA256SUMS` prueba que la descarga llegó entera, no quién la publicó.

## Ramas

Cada parte de la terminal tiene su rama. Un cambio se hace en la rama de su área, se integra en `develop` y, cuando la versión está probada, pasa a `main`.

| Rama            | Área                                                                   | Carpetas                                                                            |
| --------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `main`          | Versiones publicadas. Solo recibe lo ya probado en `develop`           |                                                                                     |
| `develop`       | Integración: aquí se juntan las áreas y se prueba el conjunto          |                                                                                     |
| `area/terminal` | Sesiones, shells y comandos entre la ventana y el sistema              | `crates/pty`, `crates/shell`, `src-tauri/src`                                       |
| `area/config`   | Configuración, temas, plantillas y carpetas de la app                  | `crates/config`                                                                     |
| `area/assist`   | Ayuda al escribir: historial, sugerencias y guía de comandos           | `crates/history`, `ui/src/stores` (`guide`, `inputLine`, `history`), `promptAssist` |
| `area/tools`    | Herramientas y agentes, SSH, navegador de pruebas, rama de Git, pegado | `crates/tools`, `crates/browser`, `crates/context`, `crates/paste`                  |
| `area/ui`       | Interfaz: pestañas, proyectos, barra lateral, rótulo, atajos           | `ui/src`                                                                            |
| `area/install`  | Instaladores, guiones de instalación e iconos                          | `install`, `src-tauri/tauri.conf.json`, `src-tauri/windows`, `src-tauri/icons`      |
| `area/docs`     | Documentación                                                          | `README.md`                                                                         |

Cómo se trabaja:

1. Parte de lo último integrado: `git switch area/<área>` y `git merge develop`.
2. Haz el cambio con sus tests y pasa las comprobaciones de abajo.
3. Un commit por cambio, con [Conventional Commits](https://www.conventionalcommits.org/) y el área entre paréntesis: `feat(ui): ...`, `fix(config): ...`, `docs: ...`.
4. Integra en `develop` con `git merge --no-ff area/<área>`, para que cada área quede a la vista en el historial.
5. `main` solo se mueve al publicar una versión, con su etiqueta (`v0.1.0`).

Un cambio que toca varias áreas va en la rama de la principal y nombra las demás en el commit.

## Desarrollo

Requisitos: [Node.js](https://nodejs.org) 20 o superior, [Rust](https://rustup.rs) estable y los [requisitos de Tauri](https://tauri.app/start/prerequisites/) para tu sistema (en Windows, las Build Tools de Visual Studio con C++).

```
npm install
npm run tauri dev      # abre la app con recarga en caliente
npm run tauri build    # genera los instaladores de este sistema en target/release/bundle
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

## Pruebas

La lógica vive en funciones puras, y cada una tiene sus pruebas: 230 de la interfaz (Vitest) y 156 de Rust.

- **Rust:** cada crate se prueba sin ventana. `crates/pty` arranca shells de verdad y responde a ConPTY como lo haría una terminal. `crates/shell` prueba las reglas de rutas con casos de Windows y de Unix en cualquier sistema. `crates/config` prueba que el archivo por defecto coincide con los valores por defecto, la vigilancia del archivo y las plantillas.
- **Interfaz:** las pruebas cubren los `stores`: la línea que se escribe, la ayuda, el pegado, las comillas de cada shell, los enlaces, los atajos, las pestañas, el rótulo y los fotogramas del patito que nada.
- **Linux sin equipo Linux:** `cargo clippy` y `cargo test` se pasan también en un contenedor de Debian, y los paquetes `.deb` y `.rpm` se instalan en contenedores limpios de Debian y Fedora.
- **Estilo:** Prettier, ESLint y `tsc` en modo estricto para la interfaz; `rustfmt` y `clippy` con los avisos como errores para Rust.

## Estructura del repositorio

```
Cargo.toml                 Espacio de trabajo de Rust: los crates y la app
package.json               Espacio de trabajo de npm: la interfaz y la CLI de Tauri
rust-toolchain.toml        Versión de Rust con la que se compila

crates/
  pty/src/lib.rs           Sesiones de pseudo-terminal (ConPTY en Windows, forkpty en Unix)
  shell/src/
    lib.rs                 Detección de los shells instalados
    integration.rs         Marcas de prompt de cada shell
    cwd.rs                 Carpeta anunciada por el shell y rutas locales fiables
  config/src/
    lib.rs                 Configuración: lectura, valores por defecto, vigilancia
    default.toml           El archivo comentado que se escribe en el primer arranque
    theme.rs               Temas: un preset y los colores que lo sustituyen
    templates.rs           Aplicar una plantilla sin tocar el resto del archivo
    templates/*.toml       Las nueve plantillas de aspecto
    workspace.rs           Proyectos guardados
    folders.rs             Carpetas de la app y traslado de datos antiguos
  history/src/lib.rs       Comandos recordados, con filtro de credenciales
  paste/src/lib.rs         Portapapeles: texto, archivos e imágenes como rutas
  tools/src/
    lib.rs                 Node.js y Docker: qué falta y cómo instalarlo
    agents.rs              Agentes de IA conocidos
    ssh.rs                 Equipos de ~/.ssh/config
    path.rs                El PATH al día y los programas que contiene
  browser/src/lib.rs       Navegador de pruebas aislado
  context/src/lib.rs       Rama de Git de una carpeta

src-tauri/
  src/main.rs              Arranque, complementos y registro de comandos
  src/commands.rs          Los comandos IPC
  src/state.rs             Estado compartido: sesiones, carpetas, configuración
  capabilities/            Permisos de la ventana
  tauri.conf.json          Ventana, política de contenido e instaladores
  windows/installer.nsi    Plantilla del instalador de Windows
  icons/                   Icono de la app (icon.svg es el original)

ui/
  index.html, src/main.tsx Entrada de la interfaz
  src/App.tsx              La ventana: reparto, atajos y arranque
  src/ipc.ts               Llamadas al proceso nativo, con sus tipos
  src/stores/              Estado y lógica pura, con sus pruebas
  src/components/          Piezas de la ventana
  src/index.css            Fuentes incluidas y colores del tema

install/
  install.ps1, install.sh  Instalar por comando
  LEEME.txt                Lo que se instala y dónde, para quien usa la app
```
