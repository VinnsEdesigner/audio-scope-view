import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Settings, Key, Home, Radio } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: <Home size={18} /> },
  { label: "Scopes", href: "/scopes", icon: <Radio size={18} /> },
  { label: "API Keys", href: "/api-keys", icon: <Key size={18} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
];

interface TopNavProperties {
  className?: string;
}

export function TopNav({ className = "" }: TopNavProperties): React.ReactElement {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

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
      {}
      <button
        onClick={toggleMenu}
        className={`fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-bg-secondary/90 backdrop-blur-md border border-border-subtle shadow-lg flex items-center justify-center hover:bg-bg-hover hover:border-border-default transition-all ${className}`}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {}
      {isOpen && (
        <>
          {}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {}
          <div className="fixed top-20 left-4 z-50 animate-in slide-in-from-top duration-200">
            <nav className="bg-bg-secondary/95 backdrop-blur-md border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]">
              {}
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
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
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
