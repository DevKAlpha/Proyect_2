import { useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { TerminalPane } from './components/TerminalPane';
import { ToolsBar } from './components/ToolsBar';
import type { ShellProfile, ToolStatus } from './ipc';
import { pickDefaultShell, useSettings } from './stores/settings';
import { useTabs, type TabOptions } from './stores/tabs';
import { missingTools, useTools } from './stores/tools';

/** Opens a tab with `shell`, or with the default shell when omitted. */
function openTab(shell?: ShellProfile, options?: TabOptions) {
  const { config, shells } = useSettings.getState();
  const target = shell ?? (config && pickDefaultShell(config, shells));
  if (target) useTabs.getState().open(target, options);
}

/** Installs a missing tool in a tab of its own, so the user sees every step. */
function installTool(tool: ToolStatus) {
  if (!tool.install_command) return;
  openTab(undefined, { title: `Instalar ${tool.name}`, initialCommand: tool.install_command });
}

const refreshTools = () => void useTools.getState().refresh();

// React runs effects twice in development; the app must still start once.
let started = false;

async function start() {
  if (started) return;
  started = true;
  await useSettings.getState().load();
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
  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const activate = useTabs((state) => state.activate);
  const close = useTabs((state) => state.close);
  const tools = useTools((state) => state.tools);
  const toolsHidden = useTools((state) => state.hidden);
  const hideTools = useTools((state) => state.hide);

  useEffect(() => {
    void start();
    window.addEventListener('keydown', handleShortcut, true);
    // Installers take the focus (administrator prompt, setup window). When it
    // comes back, the tool may be there.
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
    <div className="flex h-full flex-col bg-bg text-fg">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        shells={shells}
        onSelect={activate}
        onClose={close}
        onNew={openTab}
      />

      {!toolsHidden && (
        <ToolsBar missing={missingTools(tools)} onInstall={installTool} onHide={hideTools} />
      )}

      {configError && (
        <div role="alert" className="flex items-start gap-3 bg-fg/10 px-3 py-2 text-sm select-text">
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

      <main className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <TerminalPane key={tab.id} tab={tab} active={tab.id === activeId} />
        ))}

        {config && tabs.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-fg/60">
            {shells.length > 0 ? (
              <button
                type="button"
                onClick={() => openTab()}
                className="rounded border border-fg/20 px-4 py-2 outline-none hover:bg-fg/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
              >
                Nueva pestaña
              </button>
            ) : (
              <p>No se encontró ningún shell instalado en este equipo.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
