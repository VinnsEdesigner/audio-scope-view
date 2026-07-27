/**
 * TopNav - Floating hamburger menu button
 * Minimal floating button that overlays on page content
 */

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  Settings,
  Key,
  LayoutDashboard,
  Radio,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard size={18} /> },
  { label: "Scopes", href: "/scopes", icon: <Radio size={18} /> },
  { label: "API Keys", href: "/api-keys", icon: <Key size={18} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
];

interface TopNavProps {
  className?: string;
}

export function TopNav({ className = "" }: TopNavProps): React.ReactElement {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  // Close menu when route changes
  React.useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close menu on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Hamburger Button */}
      <button
        onClick={toggleMenu}
        className={`fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-bg-secondary/90 backdrop-blur-md border border-border-subtle shadow-lg flex items-center justify-center hover:bg-bg-hover hover:border-border-default transition-all ${className}`}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu Panel - positioned below floating button */}
          <div className="fixed top-20 left-4 z-50 animate-in slide-in-from-top duration-200">
            <nav className="bg-bg-secondary/95 backdrop-blur-md border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]">
              {/* Menu Items */}
              <div className="py-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.href === location.pathname;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-bg-active text-foreground"
                          : "text-text-secondary hover:bg-bg-hover hover:text-foreground"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <span className={isActive ? "text-accent" : "text-text-tertiary"}>
                        {item.icon}
                      </span>
                      {item.label}
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
