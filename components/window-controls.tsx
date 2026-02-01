"use client";

import { useElectron } from "@/lib/electron-context";

interface WindowControlsProps {
  className?: string;
}

export function WindowControls({ className = "" }: WindowControlsProps) {
  const { isElectron, platform, minimize, maximize, close } = useElectron();

  // Only show on macOS in Electron
  if (!isElectron || platform !== "darwin") {
    return null;
  }

  return (
    <div className={`group/controls relative z-[9999] flex items-center gap-2 ${className}`}>
      <button
        onClick={close}
        className="size-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 transition-colors flex items-center justify-center"
        aria-label="Close"
      >
        <svg className="size-2 opacity-0 group-hover/controls:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M9 3L3 9" stroke="#820005" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={minimize}
        className="size-3 rounded-full bg-[#febc2e] hover:bg-[#febc2e]/80 transition-colors flex items-center justify-center"
        aria-label="Minimize"
      >
        <svg className="size-2 opacity-0 group-hover/controls:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6H9.5" stroke="#9a6b00" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={maximize}
        className="size-3 rounded-full bg-[#28c840] hover:bg-[#28c840]/80 transition-colors flex items-center justify-center"
        aria-label="Maximize"
      >
        <svg className="size-2 opacity-0 group-hover/controls:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M3 9L9 3" stroke="#006500" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// Invisible spacer to reserve space for window controls
export function WindowControlsSpacer({ className = "" }: { className?: string }) {
  const { isElectron, platform } = useElectron();

  // Only reserve space on macOS in Electron
  if (!isElectron || platform !== "darwin") {
    return null;
  }

  // 3 buttons * 12px + 2 gaps * 8px = 52px, plus some padding
  return <div className={`w-[68px] shrink-0 ${className}`} />;
}
