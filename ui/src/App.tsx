import { useEffect, useMemo, useRef } from 'react';
import { Divider } from './components/Divider';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TerminalPane } from './components/TerminalPane';
import { ToolsBar } from './components/ToolsBar';
import {
  loadWorkspace,
  openAppFolder,
  openConfigFile,
  pickFolder,
  saveWorkspace,
  toggleFullscreen,
  type ShellProfile,
  type ToolStatus,
} from './ipc';
import { useHistory } from './stores/history';
import { sshCommand, useRemote } from './stores/remote';
import { matchShortcut, type ShortcutHit } from './stores/shortcuts';
import { buildNewTabMenu, type MenuItem } from './stores/menu';
import { SIDEBAR_WIDTH, SPLIT_RATIO, pickDefaultShell, useSettings } from './stores/settings';
import { persistWorkspace, tabsOf, useTabs, type TabOptions } from './stores/tabs';
import { missingTools, useTools } from './stores/tools';

/**
 * Opens a terminal in the project on screen, with `shell` or with the
 * default shell when omitted.
 */
function openTab(shell?: ShellProfile, options?: TabOptions) {
  const { config, shells } = useSettings.getState();
  const target = shell ?? (config && pickDefaultShell(config, shells));
  if (target) useTabs.getState().open(target, options);
}

/** Opens a default terminal in the given project. */
function openTabIn(projectId: string | null) {
  useTabs.getState().selectProject(projectId);
  openTab();
}

/** Installs a missing tool in a tab of its own, so the user sees every step. */
function installTool(tool: ToolStatus) {
  if (!tool.install_command) return;
  openTab(undefined, {
    title: `Instalar ${tool.name}`,
    initialCommand: tool.install_command,
    transient: true,
  });
}

/** Creates a project for a folder the user picks, with a first terminal. */
async function addProject() {
  const path = await pickFolder();
  if (!path) return;
  // The folder's own name is the obvious first name; the user can change it.
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  useTabs.getState().addProject(name, path);
  openTab();
}

const pickFromMenu = (item: MenuItem) => openTab(item.shell, item.options);

/**
 * Remote control: a terminal on another machine. It is a tab of the default
 * shell that runs `ssh`, like an agent tab: the user sees the command, and
 * when the connection ends the local shell is still there.
 */
function connectTo(target: string) {
  const command = sshCommand(target);
  if (command) openTab(undefined, { title: target.trim(), initialCommand: command });
}

/** What this machine has can change while the window is in the background. */
const refreshMachine = () => {
  refreshTools();
  void useRemote.getState().refresh();
};

const refreshTools = () => void useTools.getState().refresh();

// React runs effects twice in development; the app must still start once.
let started = false;

async function start() {
  if (started) return;
  started = true;
  await useSettings.getState().load();
  try {
    useTabs.getState().restore(await loadWorkspace());
  } catch {
    // Without saved projects the terminal still opens.
  }
  // From here on, every change of projects or their terminals is saved.
  persistWorkspace((workspace) => void saveWorkspace(workspace));
  void useHistory.getState().load();
  openTab();
  refreshMachine();
}

/**
 * Two terminals side by side, or back to one. With a single terminal there
 * is nothing to put next to it, so a second one is opened: asking for a
 * split and getting nothing would look broken.
 */
function toggleSplit() {
  const tabs = useTabs.getState();
  const alone = tabsOf(tabs.tabs, tabs.activeProjectId).length < 2;
  if (tabs.split || !alone) return tabs.toggleSplit();
  const first = tabs.activeId;
  openTab();
  const second = useTabs.getState().activeId;
  if (first !== null && second !== null) useTabs.getState().setSplit(first, second);
}

/** How far one press of an arrow key moves a divider. */
const SIDEBAR_STEP = 16;
const SPLIT_STEP = 0.02;

/** Gives the keyboard back to the terminal on screen. */
function focusTerminal() {
  const id = useTabs.getState().activeId;
  document.querySelector<HTMLElement>(`#panel-${id} textarea`)?.focus();
}

/**
 * Takes the keyboard to one of the menus of the window and opens it, so
 * that every option can be reached without the mouse. Escape goes back to
 * the terminal.
 */
function openMenu(name: 'new-tab' | 'templates' | 'folders' | 'remote') {
  const settings = useSettings.getState();
  const inSidebar = name === 'templates' || name === 'folders';
  if (inSidebar && !settings.sidebarOpen) settings.toggleSidebar();
  // The sidebar may have to be drawn first.
  requestAnimationFrame(() => {
    // Each terminal has its own remote control menu: the one on screen.
    const scope =
      name === 'remote'
        ? document.getElementById(`panel-${useTabs.getState().activeId}`)
        : document;
    const menu = scope?.querySelector<HTMLSelectElement>(`select[data-menu="${name}"]`);
    if (!menu) return;
    menu.focus();
    const back = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      menu.removeEventListener('keydown', back);
      menu.removeEventListener('change', back);
      // Remote control may now be asking for a machine: the keyboard is its own.
      if (name !== 'remote' || event instanceof KeyboardEvent) focusTerminal();
    };
    menu.addEventListener('keydown', back);
    menu.addEventListener('change', back);
    try {
      menu.showPicker();
    } catch {
      // Not every web view can open a menu by itself. It has the focus:
      // the arrow keys and Enter work on it.
    }
  });
}

/** Shows the project after (`1`) or before (`-1`) the one on screen, general group included. */
function stepProject(step: 1 | -1) {
  const tabs = useTabs.getState();
  const order: (string | null)[] = [null, ...tabs.projects.map((project) => project.id)];
  const index = order.indexOf(tabs.activeProjectId);
  tabs.selectProject(order[(index + step + order.length) % order.length] ?? null);
}

/** Does what a shortcut asks. Returns `false` when there was nothing to do. */
function runShortcut({ id, index }: ShortcutHit): boolean {
  const tabs = useTabs.getState();
  const settings = useSettings.getState();
  switch (id) {
    case 'new-tab':
      openTab();
      break;
    case 'close-tab':
      if (tabs.activeId === null) return false;
      tabs.close(tabs.activeId);
      break;
    case 'next-tab':
      tabs.cycle(1);
      break;
    case 'previous-tab':
      tabs.cycle(-1);
      break;
    case 'go-to-tab': {
      const target = tabsOf(tabs.tabs, tabs.activeProjectId)[index ?? 0];
      // No such terminal: the key goes to the shell, as if it were not ours.
      if (!target) return false;
      tabs.activate(target.id);
      break;
    }
    case 'new-tab-menu':
      openMenu('new-tab');
      break;
    case 'next-project':
      stepProject(1);
      break;
    case 'previous-project':
      stepProject(-1);
      break;
    case 'new-project':
      void addProject();
      break;
    case 'toggle-sidebar':
      settings.toggleSidebar();
      break;
    case 'toggle-split':
      toggleSplit();
      break;
    case 'other-half': {
      if (!tabs.split) return false;
      tabs.activate(tabs.activeId === tabs.split.left ? tabs.split.right : tabs.split.left);
      break;
    }
    case 'grow-left':
    case 'grow-right':
      if (!tabs.split) return false;
      settings.setSplitRatio(settings.splitRatio + (id === 'grow-left' ? SPLIT_STEP : -SPLIT_STEP));
      break;
    case 'fullscreen':
      void toggleFullscreen();
      break;
    case 'zoom-in':
      settings.zoomBy(1);
      break;
    case 'zoom-out':
      settings.zoomBy(-1);
      break;
    case 'zoom-reset':
      settings.resetZoom();
      break;
    case 'templates-menu':
      openMenu('templates');
      break;
    case 'open-config':
      void openConfigFile();
      break;
    case 'folders-menu':
      openMenu('folders');
      break;
    case 'open-folder':
      // The button of the terminal on screen knows whether it can open it.
      document
        .getElementById(`panel-${tabs.activeId}`)
        ?.querySelector<HTMLButtonElement>('button[data-action="open-folder"]')
        ?.click();
      break;
    case 'remote-menu':
      openMenu('remote');
      break;
    case 'help':
      settings.toggleHelp();
      // Closing it gives the keyboard back to the terminal.
      if (settings.helpOpen) focusTerminal();
      break;
  }
  return true;
}

/**
 * App-wide shortcuts. Registered in the capture phase: the terminal has the
 * focus almost always and would send these keys to the shell. Which keys
 * are shortcuts is decided in `stores/shortcuts`.
 */
function handleShortcut(event: KeyboardEvent) {
  const hit = matchShortcut(event);
  if (!hit || !runShortcut(hit)) return;
  event.preventDefault();
  event.stopPropagation();
}

export function App() {
  const config = useSettings((state) => state.config);
  const shells = useSettings((state) => state.shells);
  const configError = useSettings((state) => state.configError);
  const dismissConfigError = useSettings((state) => state.dismissConfigError);
  const backgroundUrl = useSettings((state) => state.backgroundUrl);
  const sidebarOpen = useSettings((state) => state.sidebarOpen);
  const templates = useSettings((state) => state.templates);
  const appliedTemplate = useSettings((state) => state.appliedTemplate);
  const applyTemplate = useSettings((state) => state.applyTemplate);
  const toggleSidebar = useSettings((state) => state.toggleSidebar);
  const sidebarWidth = useSettings((state) => state.sidebarWidth);
  const setSidebarWidth = useSettings((state) => state.setSidebarWidth);
  const splitRatio = useSettings((state) => state.splitRatio);
  const setSplitRatio = useSettings((state) => state.setSplitRatio);
  const split = useTabs((state) => state.split);
  const helpOpen = useSettings((state) => state.helpOpen);
  const toggleHelp = useSettings((state) => state.toggleHelp);
  // The work area, to turn a pointer position into a share of its width.
  const workRef = useRef<HTMLElement>(null);
  const leftShare = `${splitRatio * 100}%`;
  /** Where a terminal is drawn: all the work area, one half of a split, or nowhere. */
  const frameOf = (id: number) => {
    if (!split) return id === activeId ? { left: '0', width: '100%' } : null;
    if (id === split.left) return { left: '0', width: leftShare };
    if (id === split.right) return { left: leftShare, width: `${(1 - splitRatio) * 100}%` };
    return null;
  };
  const tabs = useTabs((state) => state.tabs);
  const projects = useTabs((state) => state.projects);
  const activeProjectId = useTabs((state) => state.activeProjectId);
  const activeId = useTabs((state) => state.activeId);
  const store = useTabs.getState();
  const tools = useTools((state) => state.tools);
  const agents = useTools((state) => state.agents);
  const browser = useTools((state) => state.browser);
  const browserError = useTools((state) => state.browserError);
  const toggleBrowser = useTools((state) => state.toggleBrowser);
  const toolsHidden = useTools((state) => state.hidden);
  const hideTools = useTools((state) => state.hide);
  const rememberedCommands = useHistory((state) => state.entries.length);
  const clearHistory = useHistory((state) => state.clear);

  const menu = useMemo(
    () => buildNewTabMenu(shells, agents, config?.agents ?? [], browser?.connectors),
    [shells, agents, config, browser],
  );
  // The tab bar shows one project at a time; the sidebar shows all of them.
  const visibleTabs = useMemo(() => tabsOf(tabs, activeProjectId), [tabs, activeProjectId]);
  const activeProject = projects.find((project) => project.id === activeProjectId);

  useEffect(() => {
    void start();
    window.addEventListener('keydown', handleShortcut, true);
    // Installers take the focus (administrator prompt, setup window). When it
    // comes back, the tool may be there. The same goes for the test browser:
    // the user may have closed its window.
    window.addEventListener('focus', refreshMachine);
    return () => {
      window.removeEventListener('keydown', handleShortcut, true);
      window.removeEventListener('focus', refreshMachine);
    };
  }, []);

  // Closing the install tab is the other moment an install has just finished.
  useEffect(() => {
    if (useSettings.getState().config) refreshTools();
  }, [tabs.length]);

  // The window chrome follows the same theme as the terminal.
  useEffect(() => {
    if (!config) return;
    const { style } = document.documentElement;
    style.setProperty('--term-bg', config.theme.background);
    style.setProperty('--term-fg', config.theme.foreground);
    style.setProperty('--term-accent', config.theme.accent);
  }, [config]);

  return (
    <div className="flex h-full bg-bg text-fg">
      {helpOpen && (
        <ShortcutsPanel
          onClose={() => {
            toggleHelp();
            focusTerminal();
          }}
        />
      )}
      {sidebarOpen && (
        <>
          <Sidebar
            projects={projects}
            tabs={tabs}
            activeProjectId={activeProjectId}
            activeId={activeId}
            browser={browser}
            browserError={browserError}
            onSelectProject={store.selectProject}
            onAddProject={() => void addProject()}
            onRenameProject={store.renameProject}
            onRemoveProject={store.removeProject}
            onNewTab={openTabIn}
            onActivateTab={store.activate}
            onRenameTab={store.rename}
            onCloseTab={store.close}
            rememberedCommands={rememberedCommands}
            onClearHistory={() => void clearHistory()}
            onToggleBrowser={() => void toggleBrowser()}
            onOpenConfig={() => void openConfigFile()}
            onOpenAppFolder={(which) => void openAppFolder(which).catch(() => {})}
            onShowShortcuts={toggleHelp}
            width={sidebarWidth}
            templates={templates}
            appliedTemplate={appliedTemplate}
            onApplyTemplate={(id) => void applyTemplate(id)}
          />
          <Divider
            label="Ancho de la barra de proyectos"
            now={sidebarWidth}
            min={SIDEBAR_WIDTH.min}
            max={SIDEBAR_WIDTH.max}
            // The sidebar starts at the left edge of the window, and the
            // pointer holds the divider by its middle, 3px further right.
            onDrag={(clientX) => setSidebarWidth(clientX - 3)}
            onStep={(direction) => setSidebarWidth(sidebarWidth + direction * SIDEBAR_STEP)}
          />
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TabBar
          tabs={visibleTabs}
          activeId={activeId}
          menu={menu}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onSelect={store.activate}
          onClose={store.close}
          onNew={openTab}
          onPick={pickFromMenu}
          split={split}
          onToggleSplit={toggleSplit}
        />

        {!toolsHidden && (
          <ToolsBar missing={missingTools(tools)} onInstall={installTool} onHide={hideTools} />
        )}

        {configError && (
          <div
            role="alert"
            className="flex items-start gap-3 bg-fg/10 px-3 py-2 text-sm select-text"
          >
            <p className="min-w-0 flex-1">
              El archivo de configuración tiene un error y se mantiene la configuración anterior:{' '}
              {configError}
            </p>
            <button
              type="button"
              onClick={dismissConfigError}
              className="shrink-0 underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Cerrar
            </button>
          </div>
        )}

        <main
          ref={workRef}
          className="relative min-h-0 flex-1 bg-cover bg-center"
          style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
        >
          {/* Every started terminal stays mounted, also those of other
              projects: switching project must not stop what runs in them. */}
          {tabs
            .filter((tab) => tab.started)
            .map((tab) => (
              <TerminalPane
                key={tab.id}
                tab={tab}
                active={tab.id === activeId}
                frame={frameOf(tab.id)}
                marked={split !== null && tab.id === activeId}
                onConnect={connectTo}
              />
            ))}

          {split && (
            <Divider
              label="Reparto entre las dos terminales"
              now={splitRatio * 100}
              min={SPLIT_RATIO.min * 100}
              max={SPLIT_RATIO.max * 100}
              onDrag={(clientX) => {
                const area = workRef.current?.getBoundingClientRect();
                if (area) setSplitRatio((clientX - area.left) / area.width);
              }}
              onStep={(direction) => setSplitRatio(splitRatio + direction * SPLIT_STEP)}
              className="absolute inset-y-0 -translate-x-1/2"
              style={{ left: leftShare }}
            />
          )}

          {config && visibleTabs.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-fg/60">
              {shells.length > 0 ? (
                <div className="text-center">
                  {activeProject && <p className="mb-3 select-text">{activeProject.path}</p>}
                  <button
                    type="button"
                    onClick={() => openTab()}
                    className="rounded border border-fg/20 px-4 py-2 outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Nueva terminal
                  </button>
                </div>
              ) : (
                <p>No se encontró ningún shell instalado en este equipo.</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
