import { useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { TerminalPane } from './components/TerminalPane';
import { ToolsBar } from './components/ToolsBar';
import {
  loadWorkspace,
  openConfigFile,
  pickFolder,
  saveWorkspace,
  type ShellProfile,
  type ToolStatus,
} from './ipc';
import { useHistory } from './stores/history';
import { buildNewTabMenu, type MenuItem } from './stores/menu';
import { pickDefaultShell, useSettings } from './stores/settings';
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
  refreshTools();
}

/**
 * App-wide shortcuts. Registered in the capture phase: the terminal has the
 * focus almost always and would send these keys to the shell.
 */
function handleShortcut(event: KeyboardEvent) {
  if (!event.ctrlKey || event.altKey) return;
  const tabs = useTabs.getState();
  const settings = useSettings.getState();
  const key = event.key.toLowerCase();

  // "+" needs Shift on most layouts, so "=" (the same key) zooms in too.
  if (key === '+' || key === '=') settings.zoomBy(1);
  else if (key === '-' && !event.shiftKey) settings.zoomBy(-1);
  else if (key === '0' && !event.shiftKey) settings.resetZoom();
  else if (event.shiftKey && key === 't') openTab();
  else if (event.shiftKey && key === 'w' && tabs.activeId !== null) tabs.close(tabs.activeId);
  else if (event.shiftKey && key === 'b') settings.toggleSidebar();
  else if (key === 'tab') tabs.cycle(event.shiftKey ? -1 : 1);
  else return;

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
  const toggleSidebar = useSettings((state) => state.toggleSidebar);
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
    window.addEventListener('focus', refreshTools);
    return () => {
      window.removeEventListener('keydown', handleShortcut, true);
      window.removeEventListener('focus', refreshTools);
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
      {sidebarOpen && (
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
        />
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
          className="relative min-h-0 flex-1 bg-cover bg-center"
          style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
        >
          {/* Every started terminal stays mounted, also those of other
              projects: switching project must not stop what runs in them. */}
          {tabs
            .filter((tab) => tab.started)
            .map((tab) => (
              <TerminalPane key={tab.id} tab={tab} active={tab.id === activeId} />
            ))}

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
