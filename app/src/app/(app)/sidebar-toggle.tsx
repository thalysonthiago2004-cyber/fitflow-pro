"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const KEY = "fitflow-sidebar";

/** Runs before first paint (inline in the layout) so the collapsed width never flashes. */
export const SIDEBAR_BOOT = `try{if(localStorage.getItem("${KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

// The <html data-sidebar> attribute is the source of truth (it drives the CSS).
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar"] });
  return () => observer.disconnect();
}
const isCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

export function SidebarToggle() {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);

  function toggle() {
    const next = !collapsed;
    if (next) document.documentElement.dataset.sidebar = "collapsed";
    else delete document.documentElement.dataset.sidebar;
    try {
      localStorage.setItem(KEY, next ? "collapsed" : "expanded");
    } catch {}
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-expanded={!collapsed} aria-controls="app-sidebar" title={collapsed ? "Expandir menu" : "Recolher menu"}>
      {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
      <span className="sr-only">{collapsed ? "Expandir menu" : "Recolher menu"}</span>
    </Button>
  );
}
