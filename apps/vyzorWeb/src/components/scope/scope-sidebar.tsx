import * as React from "react";
import {
  Target,
  Maximize2,
  Download,
  Info,
  MoreVertical,
  Pencil,
  Trash2,
  Ruler,
} from "lucide-react";
import { useUIStore } from "@/store";

const DisplayIcon = ({ size = 18 }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number }>;
  action: () => void;
}

interface ScopeSidebarProperties {
  onOpenDisplaySettings?: () => void;
  onOpenTriggerSettings?: () => void;
  onOpenMeasurements?: () => void;
  onOpenCalibration?: () => void;
  onOpenExport?: () => void;
  onOpenRecordingInfo?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

export function ScopeSidebar({
  onOpenDisplaySettings,
  onOpenTriggerSettings,
  onOpenMeasurements,
  onOpenCalibration,
  onOpenExport,
  onOpenRecordingInfo,
  onRename,
  onDelete,
}: ScopeSidebarProperties) {
  const { sessionMode } = useUIStore();
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  const isPlayback = sessionMode === "playback";

  const defaultLiveViewId = "display";
  const defaultPlaybackViewId = "display";

  const liveNavItems: NavItem[] = [
    { id: "display", label: "Display", icon: DisplayIcon, action: () => onOpenDisplaySettings?.() },
    { id: "trigger", label: "Trigger", icon: Target, action: () => onOpenTriggerSettings?.() },
    { id: "measure", label: "Measure", icon: Ruler, action: () => onOpenMeasurements?.() },
    { id: "cal", label: "Cal", icon: Maximize2, action: () => onOpenCalibration?.() },
    { id: "export", label: "Export", icon: Download, action: () => onOpenExport?.() },
  ];

  const playbackNavItems: NavItem[] = [
    { id: "display", label: "Display", icon: DisplayIcon, action: () => onOpenDisplaySettings?.() },
    { id: "measure", label: "Measure", icon: Ruler, action: () => onOpenMeasurements?.() },
    { id: "info", label: "Info", icon: Info, action: () => onOpenRecordingInfo?.() },
    { id: "export", label: "Export", icon: Download, action: () => onOpenExport?.() },
  ];

  const navItems = isPlayback ? playbackNavItems : liveNavItems;
  const defaultActiveView = navItems[0]?.id ?? "display";
  const [activeView, setActiveView] = React.useState<string>(defaultActiveView);

  React.useEffect(() => {
    const newDefault = isPlayback ? defaultPlaybackViewId : defaultLiveViewId;
    setActiveView(newDefault);
    setShowMoreMenu(false);
  }, [isPlayback]);

  const handleViewChange = (item: NavItem) => {
    setActiveView(item.id);
    setShowMoreMenu(false);
    item.action();
  };

  return (
    <div className="w-[72px] bg-bg-secondary border-r border-border-subtle flex flex-col pt-16 pb-3 px-2 gap-1 relative">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => handleViewChange(item)}
            className={`flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-md transition-all ${
              activeView === item.id
                ? "bg-bg-elevated text-foreground"
                : "bg-transparent text-foreground/70 hover:bg-bg-elevated hover:text-foreground"
            }`}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}

      {}
      {isPlayback && (
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`w-full flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-md transition-all ${
              showMoreMenu
                ? "bg-bg-elevated text-foreground"
                : "bg-transparent text-foreground/70 hover:bg-bg-elevated hover:text-foreground"
            }`}
          >
            <MoreVertical size={18} />
            <span className="text-[10px] font-medium">More</span>
          </button>

          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute left-full top-0 ml-2 z-20 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onRename?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:bg-bg-hover hover:text-foreground transition-colors"
                >
                  <Pencil size={14} />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onDelete?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-bg-hover hover:text-red-300 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex-1" />
    </div>
  );
}
