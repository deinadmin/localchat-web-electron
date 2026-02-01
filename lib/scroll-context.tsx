"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ScrollContextType {
  isScrolled: boolean;
  setIsScrolled: (value: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType>({
  isScrolled: false,
  setIsScrolled: () => {},
});

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  
  return (
    <ScrollContext.Provider value={{ isScrolled, setIsScrolled }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  return useContext(ScrollContext);
}
