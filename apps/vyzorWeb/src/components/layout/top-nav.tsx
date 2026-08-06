import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Settings, Key, Home, Monitor, ArrowLeft } from "lucide-react";
import { useSessionSelection } from "../../contexts/session-selection-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiresSession?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: <Home size={18} /> },
  {
    label: "Oscilloscope",
    href: "/oscilloscope",
    icon: <Monitor size={18} />,
    requiresSession: true,
  },
  { label: "API Keys", href: "/api-keys", icon: <Key size={18} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
];

interface TopNavProperties {
  className?: string;
}

const isHomePage = (pathname: string) => pathname === "/";

export function TopNav({ className = "" }: TopNavProperties): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const { openOscilloscopeSession } = useSessionSelection();
  const isHome = isHomePage(location.pathname);

  React.useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleNavClick = (item: NavItem) => {
    if (item.requiresSession && item.href === "/oscilloscope") {
      setIsOpen(false);
      openOscilloscopeSession();
    } else {
      setIsOpen(false);
    }
  };

  const handleBackClick = () => {
    navigate("/");
  };

  return (
    <>
      {/* Menu Toggle Button - only show hamburger on home page */}
      {isHome ? (
        <button
          onClick={toggleMenu}
          className={`fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-bg-secondary/90 backdrop-blur-md border border-border-subtle shadow-lg flex items-center justify-center hover:bg-bg-hover hover:border-border-default transition-all ${className}`}
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          <Menu size={20} className="text-foreground" />
        </button>
      ) : (
        <button
          onClick={handleBackClick}
          className={`fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-bg-secondary/90 backdrop-blur-md border border-border-subtle shadow-lg flex items-center justify-center hover:bg-bg-hover hover:border-border-default transition-all ${className}`}
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-foreground font-bold" />
        </button>
      )}

      {/* Navigation Menu - only show when home page */}
      {isHome && isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div className="fixed top-20 left-4 z-50 animate-in slide-in-from-top duration-200">
            <nav className="bg-bg-secondary/95 backdrop-blur-md border border-border-subtle rounded-xl shadow-xl overflow-hidden min-w-[200px]">
              {/* Nav Items */}
              <div className="py-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.href === location.pathname;
                  const needsClickHandler = item.requiresSession;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-bg-active text-foreground"
                          : "text-text-secondary hover:bg-bg-hover hover:text-foreground"
                      }`}
                      onClick={(event_) => {
                        if (needsClickHandler) {
                          event_.preventDefault();
                          handleNavClick(item);
                        } else {
                          setIsOpen(false);
                        }
                      }}
                    >
                      <span className="text-text-tertiary">{item.icon}</span>
                      {item.label}
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
