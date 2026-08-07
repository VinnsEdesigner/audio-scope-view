import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ArrowLeft } from "lucide-react";
import { useHeader, type HeaderContent, type HeaderVariant } from "@/contexts/header-context";

const isHomePage = (pathname: string): boolean => {
  if (!pathname || typeof pathname !== "string") {
    return false;
  }
  const normalized = pathname.replace(/\/+$/, "").trim();
  return normalized === "" || normalized === "/";
};

// ASV Logo Component
function ASVLogo(): React.ReactElement {
  return (
    <svg
      width="90"
      height="36"
      viewBox="0 0 300 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <text
        x="10"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="100"
        fontWeight="900"
        fill="#e11d48"
      >
        A
      </text>
      <path d="M 25 55 Q 40 45, 55 55 T 85 55" stroke="#ffffff" strokeWidth="3" fill="none" />
      <text
        x="100"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="100"
        fontWeight="900"
        fill="#ffffff"
      >
        S
      </text>
      <text
        x="185"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="100"
        fontWeight="900"
        fill="#ffffff"
      >
        V
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NAVIGATION BUTTON - Reused across variants
// ---------------------------------------------------------------------------

interface NavButtonProperties {
  forceBackButton?: boolean;
  backUrl?: string;
  onNavigate?: () => void;
}

function NavButton({
  forceBackButton,
  backUrl,
  onNavigate,
}: NavButtonProperties): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = isHomePage(location.pathname);

  const showBackButton = forceBackButton ?? !isHome;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
    } else if (showBackButton && backUrl) {
      navigate(backUrl);
    } else if (showBackButton) {
      navigate(-1);
    } else {
      document.dispatchEvent(new CustomEvent("toggle-menu"));
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-secondary hover:bg-bg-hover border border-border-subtle transition-colors flex-shrink-0"
      aria-label={showBackButton ? "Go back" : "Toggle menu"}
    >
      {showBackButton ? (
        <ArrowLeft size={18} className="text-foreground" />
      ) : (
        <Menu size={18} className="text-foreground" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// HEADER LEFT - Title area with nav button, logo, and title
// ---------------------------------------------------------------------------

interface HeaderLeftProperties {
  navButton: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  showLogo?: boolean;
}

function HeaderLeft({
  navButton,
  title,
  subtitle,
  badge,
  showLogo = true,
}: HeaderLeftProperties): React.ReactElement {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {navButton}
      {showLogo && <ASVLogo />}
      <div className="min-w-0 flex flex-col">
        <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary truncate">{subtitle}</p>}
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP HEADER - For main app pages (scope, session, home)
// ---------------------------------------------------------------------------

interface AppHeaderProperties {
  content: HeaderContent;
  navButton: React.ReactNode;
}

function AppHeader({ content, navButton }: AppHeaderProperties): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-2 md:px-6">
      <HeaderLeft
        navButton={navButton}
        title={content.title}
        subtitle={content.subtitle}
        badge={content.badge}
      />
      {content.actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{content.actions}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MINIMAL HEADER - For simple pages (report issue, contact support)
// ---------------------------------------------------------------------------

interface MinimalHeaderProperties {
  content: HeaderContent;
  navButton: React.ReactNode;
}

function MinimalHeader({ content, navButton }: MinimalHeaderProperties): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-2 md:px-6">
      <HeaderLeft
        navButton={navButton}
        title={content.title}
        subtitle={content.subtitle}
        badge={content.badge}
        showLogo={false}
      />
      {content.actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{content.actions}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABBED HEADER - For pages with navigation tabs (legal, about)
// ---------------------------------------------------------------------------

interface TabbedHeaderProperties {
  content: HeaderContent;
  navButton: React.ReactNode;
}

function TabbedHeader({ content, navButton }: TabbedHeaderProperties): React.ReactElement {
  const location = useLocation();

  return (
    <>
      {/* Main header row */}
      <div className="flex items-center justify-between px-4 py-2 md:px-6">
        <HeaderLeft
          navButton={navButton}
          title={content.title}
          subtitle={content.subtitle}
          badge={content.badge}
          showLogo={false}
        />
        {content.actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{content.actions}</div>
        )}
      </div>

      {/* Tabs row */}
      {content.tabs && content.tabs.length > 0 && (
        <nav className="flex gap-1 px-4 md:px-6 py-2 border-t border-border-subtle bg-bg-primary/50">
          {content.tabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.href}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${
                  (tab.isActive ?? location.pathname + location.search === tab.href)
                    ? "bg-bg-secondary text-foreground"
                    : "text-text-secondary hover:text-foreground hover:bg-bg-hover"
                }
              `}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// MAIN STICKY HEADER COMPONENT
// ---------------------------------------------------------------------------

export function StickyHeader(): React.ReactElement | undefined {
  const { content } = useHeader();

  // Don't render if no title is set
  if (!content.title) {
    return undefined;
  }

  // Determine variant (default to 'app')
  const variant: HeaderVariant = content.variant ?? "app";

  // Create nav button
  const navButton = (
    <NavButton forceBackButton={content.forceBackButton} backUrl={content.backUrl} />
  );

  // Render appropriate header based on variant
  const renderHeader = () => {
    switch (variant) {
      case "minimal": {
        return <MinimalHeader content={content} navButton={navButton} />;
      }
      case "tabbed": {
        return <TabbedHeader content={content} navButton={navButton} />;
      }
      default: {
        return <AppHeader content={content} navButton={navButton} />;
      }
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle">
      {renderHeader()}
    </div>
  );
}
