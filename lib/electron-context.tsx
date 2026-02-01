"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  getPlatform: () => Promise<string>;
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => void;
  isElectron: boolean;
}

interface ElectronContextType {
  isElectron: boolean;
  platform: string | null;
  isMaximized: boolean;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
}

const ElectronContext = createContext<ElectronContextType>({
  isElectron: false,
  platform: null,
  isMaximized: false,
  minimize: () => {},
  maximize: () => {},
  close: () => {},
});

export function ElectronProvider({ children }: { children: React.ReactNode }) {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    
    if (electronAPI?.isElectron) {
      setIsElectron(true);
      
      // Get platform
      electronAPI.getPlatform().then(setPlatform);
      
      // Get initial maximized state
      electronAPI.isMaximized().then(setIsMaximized);
      
      // Listen for window state changes
      electronAPI.onWindowStateChanged((state) => {
        setIsMaximized(state.isMaximized);
      });
    }
  }, []);

  const minimize = () => {
    const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    electronAPI?.minimize();
  };

  const maximize = () => {
    const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    electronAPI?.maximize();
  };

  const close = () => {
    const electronAPI = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    electronAPI?.close();
  };

  return (
    <ElectronContext.Provider value={{ isElectron, platform, isMaximized, minimize, maximize, close }}>
      {children}
    </ElectronContext.Provider>
  );
}

export function useElectron() {
  return useContext(ElectronContext);
}
