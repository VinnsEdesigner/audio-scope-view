import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, ArrowLeft } from "lucide-react";
import { useHeader } from "@/contexts/header-context";

const isHomePage = (pathname: string) => pathname === "/";

export function StickyHeader(): React.ReactElement | null {
  const { content } = useHeader();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = isHomePage(location.pathname);

  // Don't render if no title is set
  if (!content.title) {
    return null;
  }

  const handleNavClick = () => {
    if (isHome) {
      // Dispatch custom event to toggle menu
      document.dispatchEvent(new CustomEvent("toggle-menu"));
    } else {
      navigate("/");
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        {/* Left side - Navigation icon + Title and subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Navigation Icon - Hamburger on home, Back arrow elsewhere */}
          <button
            onClick={handleNavClick}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-secondary hover:bg-bg-hover border border-border-subtle transition-colors flex-shrink-0"
            aria-label={isHome ? "Toggle menu" : "Go back"}
          >
            {isHome ? (
              <Menu size={18} className="text-foreground" />
            ) : (
              <ArrowLeft size={18} className="text-foreground" />
            )}
          </button>

          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
              {content.title}
            </h1>
            {content.subtitle && (
              <p className="text-sm text-text-secondary truncate">
                {content.subtitle}
              </p>
            )}
          </div>
          {content.badge && (
            <div className="flex-shrink-0">
              {content.badge}
            </div>
          )}
        </div>

        {/* Right side - Actions */}
        {content.actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {content.actions}
          </div>
        )}
      </div>
    </div>
  );
}
