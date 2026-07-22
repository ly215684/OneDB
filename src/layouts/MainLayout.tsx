import { useState } from 'react';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Workspace } from './Workspace';
import { AIPanel } from './AIPanel';
import { useAIStore } from '../stores/aiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useShortcuts } from '../hooks/useShortcuts';

export function MainLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const aiVisible = useAIStore((s) => s.isVisible);
  const aiEnabled = useSettingsStore((s) => s.ai.enabled);

  // Register global shortcuts
  useShortcuts();

  const handleSidebarResize = (newWidth: number) => {
    setSidebarWidth(Math.max(180, Math.min(400, newWidth)));
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Top Toolbar */}
      <Toolbar
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        {!sidebarCollapsed && (
          <>
            <Sidebar width={sidebarWidth} />
            {/* Sidebar Resize Handle */}
            <div
              className="w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors flex-shrink-0"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = sidebarWidth;
                const onMouseMove = (ev: MouseEvent) => {
                  handleSidebarResize(startWidth + ev.clientX - startX);
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />
          </>
        )}

        {/* Center Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Workspace />
        </div>

        {/* Right AI Panel */}
        {aiEnabled && aiVisible && (
          <>
            <div className="w-px bg-border flex-shrink-0" />
            <AIPanel />
          </>
        )}
      </div>
    </div>
  );
}
