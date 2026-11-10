import { useEffect } from 'react';
import { TabBar } from './components/TabBar';
import { TerminalPane } from './components/TerminalPane';
import type { ShellProfile } from './ipc';
import { pickDefaultShell, useSettings } from './stores/settings';
import { useTabs } from './stores/tabs';

/** Opens a tab with `shell`, or with the default shell when omitted. */
function openTab(shell?: ShellProfile) {
  const { config, shells } = useSettings.getState();
  const target = shell ?? (config && pickDefaultShell(config, shells));
  if (target) useTabs.getState().open(target);
}

// React runs effects twice in development; the app must still start once.
let started = false;

async function start() {
  if (started) return;
  started = true;
  await useSettings.getState().load();
  openTab();
}

/**
 * App-wide shortcuts. Registered in the capture phase: the terminal has the
 * focus almost always and would send these keys to the shell.
 */
function handleShortcut(event: KeyboardEvent) {
  if (!event.ctrlKey || event.altKey) return;
  const tabs = useTabs.getState();
  const key = event.key.toLowerCase();

  if (event.shiftKey && key === 't') openTab();
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

  useEffect(() => {
    void start();
    window.addEventListener('keydown', handleShortcut, true);
    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, []);

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
