# Terminal_Duck

Versión 0.1A. Los instaladores y los gestores de paquetes solo admiten números, así que en ellos figura como 0.1.0.

Terminal de escritorio ligera para Windows, Linux y macOS. Pensada para trabajar con los shells de cada sistema, con Git y con agentes de IA, y para que una persona sin experiencia pueda empezar a usar una terminal.

> Las carpetas de configuración y de datos se siguen llamando `terminal`, y el identificador de la app sigue siendo `com.devkalpha.terminal`: así nada de lo que ya tenías se pierde con el cambio de nombre.

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
- Vista dividida: dos terminales lado a lado, con el reparto que tú elijas. Por ejemplo, un agente de IA a un lado y tu shell al otro.
- Agentes de IA: detecta Claude Code, Codex, Gemini CLI, OpenCode y GitHub Copilot CLI. Los instalados se abren desde el menú de pestaña nueva; los que faltan se instalan desde ahí. Puedes añadir cualquier otro en la configuración.
- Navegador de pruebas: un navegador aislado que los agentes controlan para probar aplicaciones web.
- Recuerda tus comandos y los sugiere mientras escribes. Sin historial, sugiere comandos habituales.
- Una línea de ayuda explica el comando que escribes, avisa si es de otro sistema o tiene una errata y propone el cambio.
- Comandos de Linux (`grep`, `ls`, `cat`, `touch`...) también en PowerShell y cmd.
- Una barra bajo cada terminal muestra la carpeta en la que estás y su rama de Git, y abre la carpeta en el explorador de archivos.
- Control remoto: abre una terminal en otro equipo por SSH, con tus equipos guardados en un menú.
- Borra parte de un comando seleccionándola con el ratón o con el teclado.
- Aspecto de consola de router por defecto: negro sobre blanco, con color solo donde hace falta distinguir algo.
- Personalizable: temas, colores, fuente, cursor e imagen de fondo.
- Fuente JetBrains Mono incluida, texto nítido en pantallas de alta densidad y zoom con el teclado.
- Avisa si faltan Node.js o Docker y los instala con un clic, en una pestaña donde ves el comando.
- Pega y suelta archivos e imágenes: entran en la terminal como rutas, que es como los agentes de IA reciben una captura o un documento.
- Plantillas de aspecto, sencillas y detalladas, para cambiar el look con un clic y aprender a personalizarlo.
- Enlaces: las direcciones web se abren en el navegador, y las rutas de archivos y carpetas, en el explorador de archivos.
- Atajos de teclado para todo: terminales, proyectos, vista dividida, menús y pantalla completa. `F1` los muestra.
- Archivos ordenados en tres carpetas (programa, configuración y datos), a un clic desde el menú «Carpetas».
- Copiar y pegar. Lo pegado entra sin caracteres de control: un texto copiado de una web no puede ejecutar nada por su cuenta.
- Saludo al abrir, con el logo y el nombre. Se va con el primer comando; `welcome = false` en la configuración lo quita.

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

## Estructura

```
crates/pty      Sesiones de pseudo-terminal (ConPTY en Windows, forkpty en Unix)
crates/shell    Detección de los shells instalados y lo que cada uno anuncia (prompt, carpeta)
crates/context  Lo que rodea a una terminal: la rama de Git de su carpeta
crates/config   Configuración, temas y proyectos guardados
crates/history  Comandos recordados, con filtro de credenciales
crates/paste    Archivos e imágenes del portapapeles, convertidos en rutas
crates/tools    Herramientas, agentes de IA y equipos de SSH: qué hay y cómo instalar lo que falta
crates/browser  Navegador de pruebas aislado para los agentes
src-tauri/      App de escritorio: ventana, comandos IPC y eventos
install/        Instalar por comando (install.ps1, install.sh) y el LEEME.txt que se instala
ui/             Interfaz: React, TypeScript, Tailwind y xterm.js
```
