"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useElectron } from "@/lib/electron-context";
import { useScroll } from "@/lib/scroll-context";

interface TitleBarProps {
  children?: ReactNode;
  showStickyTitle?: boolean;
  stickyTitle?: string;
}

export function TitleBar({ children, showStickyTitle = false, stickyTitle }: TitleBarProps) {
  const { isScrolled } = useScroll();
  const { state, isMobile } = useSidebar();
  const { isElectron, platform } = useElectron();
  const isMacElectron = isElectron && platform === "darwin";
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  const getLeftPosition = () => {
    if (isMobile) return "0px";
    if (state === "collapsed") return "0px";
    return "var(--sidebar-width)";
  };

  useEffect(() => {
    if (!showStickyTitle) return;

    const handleScroll = () => {
      const scrollable = contentRef.current?.closest(".overflow-y-auto") as HTMLElement;
      if (scrollable) {
        const rect = scrollable.getBoundingClientRect();
        const titleTop = scrollable.querySelector("[data-title]")?.getBoundingClientRect().top ?? Infinity;
        setIsSticky(titleTop < rect.top + 48);
      }
    };

    const scrollable = contentRef.current?.closest(".overflow-y-auto") as HTMLElement;
    if (scrollable) {
      scrollable.addEventListener("scroll", handleScroll, { passive: true });
      return () => scrollable.removeEventListener("scroll", handleScroll);
    }
  }, [showStickyTitle]);

  return (
    <header
      className={`fixed top-0 right-0 z-50 flex h-12 items-center gap-2 px-2 sm:px-4 transition-[border-color,left,background-color,box-shadow] duration-300 ease-out ${
        isScrolled
          ? "border-b-[0.5px] shadow-header-scroll-on bg-background"
          : "border-transparent shadow-none bg-transparent"
      }`}
      style={{
        left: getLeftPosition(),
        WebkitAppRegion: isMacElectron ? "drag" : undefined,
      } as React.CSSProperties}
    >
      <div
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        className="flex items-center gap-2"
      >
        <SidebarTrigger className="-ml-1" />
        {children}
        {showStickyTitle && isSticky && stickyTitle && (
          <span className="text-sm font-medium animate-in fade-in slide-in-from-left-2 duration-200">
            {stickyTitle}
          </span>
        )}
      </div>
      <div className="flex-1" />
    </header>
  );
}
