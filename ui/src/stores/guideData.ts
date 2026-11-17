/**
 * What the terminal knows about everyday commands, as plain data. The rules
 * that read it are in `guide.ts`.
 *
 * It is a short list on purpose: the commands a person meets in their first
 * months with a terminal, on any of the three systems. Texts are shown to
 * the user, so they are in Spanish like the rest of the interface.
 */

/** The three ways of writing commands a shell can follow. */
export type Family = 'posix' | 'cmd' | 'powershell';

/**
 * Which family the shell `shellId` (an id from the Rust side) belongs to.
 * Everything that is not a shell of Windows itself speaks Linux commands:
 * bash, zsh, fish, Git Bash and WSL.
 */
export function familyOf(shellId: string): Family {
  if (shellId === 'cmd') return 'cmd';
  return shellId === 'pwsh' || shellId === 'powershell' ? 'powershell' : 'posix';
}

/** One everyday task and how each family writes it. */
export interface Task {
  about: string;
  posix?: string;
  cmd?: string;
  powershell?: string;
}

export const TASKS: readonly Task[] = [
  {
    about: 'Lista los archivos de la carpeta',
    posix: 'ls',
    cmd: 'dir',
    powershell: 'Get-ChildItem',
  },
  {
    about: 'Muestra el contenido de un archivo',
    posix: 'cat',
    cmd: 'type',
    powershell: 'Get-Content',
  },
  { about: 'Limpia la pantalla', posix: 'clear', cmd: 'cls', powershell: 'Clear-Host' },
  { about: 'Copia archivos o carpetas', posix: 'cp', cmd: 'copy', powershell: 'Copy-Item' },
  {
    about: 'Mueve archivos o les cambia el nombre',
    posix: 'mv',
    cmd: 'move',
    powershell: 'Move-Item',
  },
  { about: 'Borra archivos', posix: 'rm', cmd: 'del', powershell: 'Remove-Item' },
  { about: 'Muestra en qué carpeta estás', posix: 'pwd', cmd: 'cd', powershell: 'Get-Location' },
  {
    about: 'Busca un texto dentro de archivos',
    posix: 'grep',
    cmd: 'findstr',
    powershell: 'Select-String',
  },
  {
    about: 'Dice dónde está instalado un programa',
    posix: 'which',
    cmd: 'where',
    powershell: 'Get-Command',
  },
  { about: 'Crea un archivo vacío', posix: 'touch', cmd: 'type nul >', powershell: 'New-Item' },
  {
    about: 'Lista los programas en marcha',
    posix: 'ps',
    cmd: 'tasklist',
    powershell: 'Get-Process',
  },
  {
    about: 'Detiene un programa en marcha',
    posix: 'kill',
    cmd: 'taskkill /PID',
    powershell: 'Stop-Process -Id',
  },
  {
    about: 'Muestra las direcciones de red del equipo',
    posix: 'ip addr',
    cmd: 'ipconfig',
    powershell: 'ipconfig',
  },
  {
    about: 'Muestra las direcciones de red del equipo',
    posix: 'ifconfig',
    cmd: 'ipconfig',
    powershell: 'ipconfig',
  },
  { about: 'Muestra la ayuda de un comando', posix: 'man', cmd: 'help', powershell: 'Get-Help' },
  {
    about: 'Muestra los comandos anteriores',
    posix: 'history',
    cmd: 'doskey /history',
    powershell: 'Get-History',
  },
  {
    about: 'Muestra el camino de red hasta otro equipo',
    posix: 'traceroute',
    cmd: 'tracert',
    powershell: 'tracert',
  },
  { about: 'Compara dos archivos', posix: 'diff', cmd: 'fc', powershell: 'Compare-Object' },
  {
    about: 'Muestra las variables de entorno',
    posix: 'env',
    cmd: 'set',
    powershell: 'Get-ChildItem Env:',
  },
  {
    about: 'Muestra un texto largo pantalla a pantalla',
    posix: 'less',
    cmd: 'more',
    powershell: 'more',
  },
];

/** Commands every shell has, with the same name. */
export const EVERYWHERE: Readonly<Record<string, string>> = {
  cd: 'Cambia de carpeta',
  echo: 'Escribe un texto en pantalla',
  mkdir: 'Crea una carpeta',
  rmdir: 'Borra una carpeta vacía',
  exit: 'Cierra esta terminal',
};

/**
 * Programs that are the same on every system, when installed. A name with
 * several words is a subcommand. The order matters: when the user has typed
 * the start of several, the first one is the one suggested.
 */
export const PROGRAMS: Readonly<Record<string, string>> = {
  git: 'Guarda versiones de tu código y las comparte',
  'git status': 'Muestra qué archivos cambiaron',
  'git add': 'Prepara cambios para el próximo commit',
  'git commit': 'Guarda los cambios preparados en el historial',
  'git push': 'Envía tus commits al servidor',
  'git pull': 'Trae los cambios del servidor y los aplica',
  'git clone': 'Descarga un repositorio',
  'git switch': 'Cambia de rama',
  'git checkout': 'Cambia de rama o recupera archivos',
  'git branch': 'Lista las ramas o crea una',
  'git merge': 'Une otra rama con la actual',
  'git log': 'Muestra el historial de commits',
  'git diff': 'Muestra los cambios línea a línea',
  'git stash': 'Aparta los cambios sin guardar para más tarde',
  'git fetch': 'Trae los cambios del servidor sin aplicarlos',
  'git init': 'Convierte la carpeta en un repositorio',
  'git restore': 'Descarta los cambios de un archivo',
  npm: 'Gestor de paquetes de Node.js',
  'npm install': 'Instala las dependencias del proyecto',
  'npm run': 'Ejecuta un script de package.json',
  'npm run dev': 'Arranca el proyecto en modo desarrollo',
  'npm run build': 'Genera la versión final del proyecto',
  'npm test': 'Ejecuta las pruebas del proyecto',
  'npm start': 'Arranca el proyecto',
  npx: 'Ejecuta un paquete de npm sin instalarlo',
  node: 'Ejecuta JavaScript',
  python: 'Ejecuta Python',
  python3: 'Ejecuta Python',
  pip: 'Instala paquetes de Python',
  docker: 'Ejecuta aplicaciones en contenedores',
  'docker ps': 'Lista los contenedores en marcha',
  'docker images': 'Lista las imágenes descargadas',
  'docker run': 'Crea un contenedor y lo arranca',
  'docker build': 'Construye una imagen a partir de un Dockerfile',
  'docker logs': 'Muestra lo que ha escrito un contenedor',
  'docker exec': 'Ejecuta un comando dentro de un contenedor',
  'docker stop': 'Detiene un contenedor',
  'docker compose up': 'Arranca los servicios de docker-compose.yml',
  'docker compose down': 'Detiene esos servicios y los quita',
  cargo: 'Compila y gestiona proyectos de Rust',
  'cargo build': 'Compila el proyecto',
  'cargo run': 'Compila el proyecto y lo ejecuta',
  'cargo test': 'Ejecuta las pruebas del proyecto',
  code: 'Abre Visual Studio Code',
  ssh: 'Abre una terminal en otro equipo',
  curl: 'Descarga o envía datos a una dirección web',
  ping: 'Comprueba si otro equipo responde en la red',
  whoami: 'Muestra tu nombre de usuario',
  hostname: 'Muestra el nombre de este equipo',
  winget: 'Instala programas en Windows',
  'winget install': 'Instala un programa',
  'winget search': 'Busca un programa para instalarlo',
  'winget upgrade': 'Actualiza los programas instalados',
};

/**
 * Names PowerShell on Windows accepts as another way of writing one of its
 * own commands. They run, but with PowerShell's options, not Linux's.
 */
export const POWERSHELL_ALIASES: Readonly<Record<string, string>> = {
  ls: 'Get-ChildItem',
  dir: 'Get-ChildItem',
  cat: 'Get-Content',
  type: 'Get-Content',
  clear: 'Clear-Host',
  cls: 'Clear-Host',
  cp: 'Copy-Item',
  copy: 'Copy-Item',
  mv: 'Move-Item',
  move: 'Move-Item',
  rm: 'Remove-Item',
  del: 'Remove-Item',
  pwd: 'Get-Location',
  ps: 'Get-Process',
  kill: 'Stop-Process',
  man: 'Get-Help',
  help: 'Get-Help',
  history: 'Get-History',
  diff: 'Compare-Object',
  where: 'Where-Object',
  set: 'Set-Variable',
  fc: 'Format-Custom',
};

/**
 * Names Linux shells understand by themselves, which another family also
 * uses for something else. They are not programs on PATH, so without this
 * list they would look like a Windows command typed by mistake.
 */
export const POSIX_BUILTINS: ReadonlySet<string> = new Set(['type', 'help', 'set', 'fc', 'where']);

/** Linux commands with no Windows twin, and what to do on Windows instead. */
export const LINUX_ONLY: Readonly<Record<string, { about: string; onWindows: string }>> = {
  sudo: {
    about: 'Ejecuta un comando como administrador',
    onWindows: 'En Windows, abre la terminal como administrador.',
  },
  apt: {
    about: 'Instala programas en Debian y Ubuntu',
    onWindows: 'En Windows se usa winget.',
  },
  'apt-get': {
    about: 'Instala programas en Debian y Ubuntu',
    onWindows: 'En Windows se usa winget.',
  },
  dnf: { about: 'Instala programas en Fedora', onWindows: 'En Windows se usa winget.' },
  pacman: { about: 'Instala programas en Arch Linux', onWindows: 'En Windows se usa winget.' },
  chmod: {
    about: 'Cambia quién puede leer, cambiar o ejecutar un archivo',
    onWindows: 'Funciona en una pestaña de WSL o de Git Bash.',
  },
  chown: {
    about: 'Cambia el dueño de un archivo',
    onWindows: 'Funciona en una pestaña de WSL.',
  },
  systemctl: {
    about: 'Arranca, detiene y consulta servicios del sistema',
    onWindows: 'En PowerShell se usa Get-Service.',
  },
};

/** How a family is named when one of its commands shows up somewhere else. */
export const ORIGIN: Readonly<Record<Family, string>> = {
  posix: 'Linux',
  cmd: 'cmd de Windows',
  powershell: 'PowerShell',
};

/** Takes the quotes around a value off, if it has them. */
const unquote = (value: string) => value.replace(/^(["'])(.*)\1$/, '$2');

/**
 * A command that runs, or looks right, but does not do here what the user
 * means. `match` is tried on the line; `to` is what the matched part should
 * be instead.
 */
export interface Rewrite {
  /** Where the rule applies: a family, or one shell id for a quirk of its own. */
  family?: Family;
  shell?: string;
  match: RegExp;
  text: string;
  to: string | ((match: RegExpExecArray) => string);
}

export const REWRITES: readonly Rewrite[] = [
  {
    family: 'powershell',
    match: /^ls\s+-[alh1]+(?=\s|$)/,
    text: 'En PowerShell, ls no entiende esas opciones. Con -Force muestra también los archivos ocultos.',
    to: 'ls -Force',
  },
  {
    family: 'powershell',
    match: /^rm\s+-(?:rf|fr)(?=\s|$)/,
    text: 'En PowerShell, borrar una carpeta con todo su contenido se escribe con -Recurse -Force.',
    to: 'rm -Recurse -Force',
  },
  {
    family: 'powershell',
    match: /^rm\s+-f(?=\s|$)/,
    text: 'En PowerShell, la opción para borrar sin preguntar es -Force.',
    to: 'rm -Force',
  },
  {
    family: 'powershell',
    match: /^where(?=\s+[\w.])/,
    text: 'En PowerShell, where filtra listas. Para saber dónde está un programa se usa Get-Command.',
    to: 'Get-Command',
  },
  {
    family: 'powershell',
    match: /^(?:export|set)\s+(\w+)=(.*)$/,
    text: 'En PowerShell, una variable de entorno se escribe con $env: delante del nombre.',
    to: (match) => `$env:${match[1]} = "${unquote(match[2] ?? '')}"`,
  },
  {
    shell: 'powershell',
    match: /\s+&&\s+/,
    text: 'Windows PowerShell no entiende &&. Los comandos se encadenan con ; (el segundo se ejecuta aunque falle el primero).',
    to: '; ',
  },
  {
    family: 'cmd',
    match: /^export\s+(\w+)=(.*)$/,
    text: 'En cmd, una variable de entorno se crea con set.',
    to: (match) => `set ${match[1]}=${unquote(match[2] ?? '')}`,
  },
  {
    family: 'posix',
    match: /^set\s+(\w+)=(?=\S)/,
    text: 'Aquí set no crea variables de entorno. Se usa export.',
    to: (match) => `export ${match[1]}=`,
  },
  {
    family: 'posix',
    match: /^cd\.\.(?=[\s/]|$)/,
    text: 'Falta un espacio entre cd y los dos puntos.',
    to: 'cd ..',
  },
];

const DELETES_WITHOUT_ASKING =
  'Borra carpetas enteras sin preguntar y sin pasar por la papelera. Revisa la ruta antes de pulsar Enter.';
const RUNS_A_DOWNLOAD =
  'Ejecuta un programa recién descargado de internet, sin que lo hayas visto. Hazlo solo si confías en el sitio.';

/** Commands that are easy to regret. The warning never stops the command. */
export const DANGERS: readonly { match: RegExp; text: string }[] = [
  // rm with both the "folders too" and the "do not ask" letters in one option.
  {
    match: /\brm\s+(?:\S+\s+)*?-(?=[a-z]*r)(?=[a-z]*f)[a-z]+(?=\s|$)/i,
    text: DELETES_WITHOUT_ASKING,
  },
  {
    match: /\b(?:Remove-Item|rm|del|rmdir|rd|ri)\b.*\s-Recurse\b.*\s-Force\b/i,
    text: DELETES_WITHOUT_ASKING,
  },
  {
    match: /\b(?:Remove-Item|rm|del|rmdir|rd|ri)\b.*\s-Force\b.*\s-Recurse\b/i,
    text: DELETES_WITHOUT_ASKING,
  },
  { match: /\b(?:rd|rmdir|del)\s+(?:\S+\s+)*?\/s(?=\s|$)/i, text: DELETES_WITHOUT_ASKING },
  {
    match: /\bgit\s+push\b.*\s(?:--force|-f)(?=\s|$)/,
    text: 'Sobrescribe el historial del servidor y puede borrar el trabajo de otras personas. --force-with-lease es más seguro.',
  },
  {
    match: /\bgit\s+reset\b.*\s--hard\b/,
    text: 'Descarta los cambios que no hayas guardado en un commit. No se pueden recuperar.',
  },
  {
    match: /\bgit\s+clean\b.*\s-[a-z]*f/i,
    text: 'Borra los archivos que Git no sigue. No pasan por la papelera.',
  },
  {
    match: /\bchmod\s+(?:-R\s+)?777\b/,
    text: 'Da permiso total sobre esos archivos a cualquier usuario del equipo.',
  },
  { match: /\b(?:curl|wget)\b.*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/, text: RUNS_A_DOWNLOAD },
  {
    match: /\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b.*\|\s*(?:iex|Invoke-Expression)\b/i,
    text: RUNS_A_DOWNLOAD,
  },
  {
    match: /\bdd\b.*\sof=\/dev\//,
    text: 'Escribe directamente en un disco y borra lo que contenga.',
  },
  { match: /\bmkfs\b/, text: 'Da formato a un disco y borra lo que contenga.' },
  { match: /^format\s+[a-z]:/i, text: 'Da formato a esa unidad y borra todo su contenido.' },
];

/**
 * One of these greets the user at the first prompt of each terminal: a way
 * to find out what the terminal can do without reading a manual.
 */
export const TIPS: readonly string[] = [
  'Escribe un comando y pulsa Enter. Mientras escribes, esta línea te dice qué hace.',
  'La flecha → completa el comando sugerido en gris.',
  'La tecla Tab completa nombres de archivos y carpetas.',
  'La flecha ↑ recupera el comando anterior.',
  'Ctrl+C detiene el programa en marcha.',
  'Si esta línea propone un cambio, Ctrl+. lo aplica.',
  'Ctrl+Shift+T abre otra terminal. Ctrl+Tab cambia de una a otra.',
  'Ctrl++ y Ctrl+- cambian el tamaño del texto.',
  'Selecciona parte del comando con el ratón y pulsa Supr para borrarla.',
  'Un comando que empieza por un espacio no se guarda entre los recordados.',
];
