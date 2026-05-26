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
import { useKeymap } from "@hooks/useKeymap";
import { useVaultWatcher } from "@hooks/useVaultWatcher";
import { useTheme } from "@hooks/useTheme";
import { useUIStore } from "@store/uiStore";
import { useVaultStore } from "@store/vaultStore";
import "./styles/global.css";

export function App() {
  useKeymap();
  useVaultWatcher();
  useTheme();

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

  // Persist resized widths to vault config (debounced via onResizeEnd)
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${sidebarWidth}px`);
  }, [sidebarWidth]);

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
