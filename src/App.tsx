import { useEffect } from "react";
import { Sidebar } from "@components/Sidebar/Sidebar";
import { NoteList } from "@components/NoteList/NoteList";
import { Editor } from "@components/Editor/Editor";
import { TabBar } from "@components/Editor/TabBar";
import { AIPanel } from "@components/AIPanel/AIPanel";
import { QuickOpen } from "@components/QuickOpen/QuickOpen";
import { CommandPalette } from "@components/CommandPalette/CommandPalette";
import { SearchOverlay } from "@components/Search/SearchOverlay";
import { Settings } from "@components/Settings/Settings";
import { Toast } from "@components/shared/Toast";
import { ContextMenu } from "@components/shared/ContextMenu";
import { ResizeHandle } from "@components/shared/ResizeHandle";
import { ErrorBoundary } from "@components/ErrorBoundary";
import { useKeymap } from "@hooks/useKeymap";
import { useVaultWatcher } from "@hooks/useVaultWatcher";
import { useTheme } from "@hooks/useTheme";
import { useWindowTitle } from "@hooks/useWindowTitle";
import { useWindowState } from "@hooks/useWindowState";
import { useUIStore } from "@store/uiStore";
import { useVaultStore } from "@store/vaultStore";
import { useAppStore } from "@store/appStore";
import { useAIStore } from "@store/aiStore";
import "./styles/global.css";

export function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

function AppShell() {
  useKeymap();
  useVaultWatcher();
  useTheme();
  useWindowTitle();
  useWindowState();

  const hydrate = useAppStore((s) => s.hydrate);
  const hydrateKeys = useAIStore((s) => s.hydrateKeys);
  const openVault = useVaultStore((s) => s.openVault);
  const vaultMeta = useVaultStore((s) => s.meta);

  // On first launch, hydrate cross-vault state + AI keys, then auto-open
  // the last vault.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      void hydrateKeys();
      const state = await hydrate();
      if (cancelled || !state?.lastVault || vaultMeta) return;
      await openVault(state.lastVault).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
    // Run once at mount; subsequent vault opens are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidebarVisible = useUIStore((s) => s.sidebarVisible);
  const noteListVisible = useUIStore((s) => s.noteListVisible);
  const aiPanelVisible = useUIStore((s) => s.aiPanelVisible);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const noteListWidth = useUIStore((s) => s.noteListWidth);
  const aiPanelWidth = useUIStore((s) => s.aiPanelWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setNoteListWidth = useUIStore((s) => s.setNoteListWidth);
  const setAIPanelWidth = useUIStore((s) => s.setAIPanelWidth);

  const focusMode = useUIStore((s) => s.focusMode);
  const updateConfig = useVaultStore((s) => s.updateConfig);

  // When a vault is loaded, restore the panel widths it persisted.
  useEffect(() => {
    if (!vaultMeta) return;
    const { sidebarWidth: sw, aiPanelWidth: aw } = vaultMeta.config;
    if (sw) useUIStore.getState().setSidebarWidth(sw);
    if (aw) useUIStore.getState().setAIPanelWidth(aw);
  }, [vaultMeta?.path]);

  return (
    <div className="app-shell">
      <div className="titlebar" />
      <div className="app-body">
        {sidebarVisible && !focusMode && (
          <>
            <div style={{ width: sidebarWidth, height: "100%", display: "flex", flexShrink: 0 }}>
              <Sidebar />
            </div>
            <ResizeHandle
              onResize={setSidebarWidth}
              onResizeEnd={() => updateConfig({ sidebarWidth })}
              getBaseWidth={() => sidebarWidth}
            />
          </>
        )}

        {noteListVisible && (
          <>
            <div style={{ width: noteListWidth, height: "100%", display: "flex", flexShrink: 0 }}>
              <NoteList />
            </div>
            <ResizeHandle
              onResize={setNoteListWidth}
              getBaseWidth={() => noteListWidth}
            />
          </>
        )}

        <div className="editor-column" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <TabBar />
          <Editor />
        </div>

        {aiPanelVisible && !focusMode && (
          <>
            <ResizeHandle
              onResize={(w) => setAIPanelWidth(window.innerWidth - w)}
              onResizeEnd={() => updateConfig({ aiPanelWidth })}
              side="left"
              getBaseWidth={() => window.innerWidth - aiPanelWidth}
            />
            <div style={{ width: aiPanelWidth, height: "100%", display: "flex", flexShrink: 0 }}>
              <AIPanel />
            </div>
          </>
        )}
      </div>

      <QuickOpen />
      <CommandPalette />
      <SearchOverlay />
      <Settings />
      <Toast />
      <ContextMenu />
    </div>
  );
}

export default App;
