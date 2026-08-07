/**
 * STICKY HEADER VARIANTS - IMPLEMENTATION MOCKUP
 * 
 * This file demonstrates how to extend the current header system
 * to support multiple header variants across different page types.
 * 
 * Current: Each page imperatively calls setContent() with a flat object
 * Proposed: Add variants with composable sub-components
 */

// ============================================================================
// 1. UPDATED HEADER CONTEXT
// ============================================================================

export type HeaderVariant = 'app' | 'minimal' | 'tabbed';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly isActive?: boolean;
}

export interface HeaderContent {
  /** Header layout variant - determines which sub-header to render */
  variant?: HeaderVariant;
  
  /** Page title - shown in all variants */
  title: React.ReactNode;
  
  /** Optional subtitle - shown below title */
  subtitle?: React.ReactNode;
  
  /** Optional badge - shown next to title (e.g., "New", "Beta") */
  badge?: React.ReactNode;
  
  /** Optional action buttons - right side of header */
  actions?: React.ReactNode;
  
  /** Tabs - only used when variant='tabbed' */
  tabs?: TabItem[];
  
  /** Back button URL - only used when variant='minimal' or 'tabbed' */
  backUrl?: string;
  
  /** Override the auto back behavior (hamburger on home, back elsewhere) */
  forceBackButton?: boolean;
}

// ============================================================================
// 2. CURRENT STICKY HEADER (for reference)
// ============================================================================

/*
CURRENT sticky-header.tsx is ~130 lines with a single layout.
The proposed solution keeps the same structure but adds variant rendering.
*/

// ============================================================================
// 3. PROPOSED STICKY HEADER WITH VARIANTS
// ============================================================================

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ArrowLeft, MoreVertical } from "lucide-react";
import { useHeader, type HeaderContent, type HeaderVariant, type TabItem } from "@/contexts/header-context";
import { cn } from "@/lib/utilities";

// ASV Logo Component (existing)
function ASVLogo(): React.ReactElement {
  return (
    <svg width="90" height="36" viewBox="0 0 300 120" fill="none" className="flex-shrink-0">
      <text x="10" y="100" fontFamily="Inter" fontSize="100" fontWeight="900" fill="#e11d48">A</text>
      <path d="M 25 55 Q 40 45, 55 55 T 85 55" stroke="#ffffff" strokeWidth="3" fill="none" />
      <text x="100" y="100" fontFamily="Inter" fontSize="100" fontWeight="900" fill="#ffffff">S</text>
      <text x="185" y="100" fontFamily="Inter" fontSize="100" fontWeight="900" fill="#ffffff">V</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NAVIGATION BUTTON - Reused across variants
// ---------------------------------------------------------------------------

interface NavButtonProps {
  forceBackButton?: boolean;
  backUrl?: string;
  onNavigate?: () => void;
}

function NavButton({ forceBackButton, backUrl, onNavigate }: NavButtonProps): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === "/" || location.pathname === "";
  
  // Determine if we should show back button
  const showBackButton = forceBackButton ?? (!isHomePage);
  
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

interface HeaderLeftProps {
  navButton: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  showLogo?: boolean;
}

function HeaderLeft({ navButton, title, subtitle, badge, showLogo = true }: HeaderLeftProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {navButton}
      {showLogo && <ASVLogo />}
      <div className="min-w-0 flex flex-col">
        <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-text-secondary truncate">{subtitle}</p>
        )}
      </div>
      {badge && <div className="flex-shrink-0">{badge}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP HEADER - For main app pages (scope, session, home)
// ---------------------------------------------------------------------------

interface AppHeaderProps {
  content: HeaderContent;
  navButton: React.ReactNode;
}

function AppHeader({ content, navButton }: AppHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-4 py-2 md:px-6">
      <HeaderLeft
        navButton={navButton}
        title={content.title}
        subtitle={content.subtitle}
        badge={content.badge}
      />
      {content.actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {content.actions}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MINIMAL HEADER - For simple pages (report issue, contact support)
// ---------------------------------------------------------------------------

interface MinimalHeaderProps {
  content: HeaderContent;
  navButton: React.ReactNode;
}

function MinimalHeader({ content, navButton }: MinimalHeaderProps): React.ReactElement {
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {content.actions}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABBED HEADER - For pages with navigation tabs (legal, about)
// ---------------------------------------------------------------------------

interface TabbedHeaderProps {
  content: HeaderContent;
  navButton: React.ReactNode;
}

function TabbedHeader({ content, navButton }: TabbedHeaderProps): React.ReactElement {
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
          <div className="flex items-center gap-2 flex-shrink-0">
            {content.actions}
          </div>
        )}
      </div>
      
      {/* Tabs row */}
      {content.tabs && content.tabs.length > 0 && (
        <nav className="flex items-center gap-1 px-4 md:px-6 py-1 border-t border-border-subtle bg-bg-primary/50">
          {content.tabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                tab.isActive ?? location.pathname === tab.href
                  ? "text-foreground bg-bg-secondary"
                  : "text-text-secondary hover:text-foreground hover:bg-bg-hover"
              )}
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
  const location = useLocation();
  
  // Don't render if no title is set
  if (!content.title) {
    return undefined;
  }
  
  // Determine variant (default to 'app')
  const variant: HeaderVariant = content.variant ?? 'app';
  
  // Create nav button
  const navButton = (
    <NavButton
      forceBackButton={content.forceBackButton}
      backUrl={content.backUrl}
    />
  );
  
  // Render appropriate header based on variant
  const renderHeader = () => {
    switch (variant) {
      case 'minimal':
        return <MinimalHeader content={content} navButton={navButton} />;
      case 'tabbed':
        return <TabbedHeader content={content} navButton={navButton} />;
      case 'app':
      default:
        return <AppHeader content={content} navButton={navButton} />;
    }
  };
  
  return (
    <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle">
      {renderHeader()}
    </div>
  );
}

// ============================================================================
// 4. USAGE EXAMPLES - How pages would use the new system
// ============================================================================

/*
// ---------------------------------------------------------------------------
// settings.tsx - Using 'app' variant (default)
// ---------------------------------------------------------------------------

export function Settings(): React.ReactElement {
  const { setContent } = useHeader();
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  useEffect(() => {
    setContent({
      variant: 'app',  // Optional - this is the default
      title: "Settings",
      actions: (
        <button
          onClick={() => setShowDeviceInfo(!showDeviceInfo)}
          className="w-10 h-10 flex items-center justify-center rounded-lg..."
        >
          <MoreVertical size={18} className="text-text-secondary" />
        </button>
      ),
    });
  }, [setContent, showDeviceInfo]);

  // ... rest of component
}


// ---------------------------------------------------------------------------
// report-issue.tsx - Using 'minimal' variant
// ---------------------------------------------------------------------------

export function ReportIssue(): React.ReactElement {
  const { setContent } = useHeader();

  useEffect(() => {
    setContent({
      variant: 'minimal',
      title: "Report an Issue",
      subtitle: "Found a bug? Let us know.",
      forceBackButton: true,
      backUrl: "/about",
    });
  }, [setContent]);

  // ... rest of component
}


// ---------------------------------------------------------------------------
// legal.tsx - Using 'tabbed' variant with navigation tabs
// ---------------------------------------------------------------------------

export function Legal(): React.ReactElement {
  const { setContent } = useHeader();
  const location = useLocation();

  useEffect(() => {
    setContent({
      variant: 'tabbed',
      title: "Legal",
      forceBackButton: true,
      backUrl: "/about",
      tabs: [
        { id: "privacy", label: "Privacy Policy", href: "/legal#privacy" },
        { id: "terms", label: "Terms of Service", href: "/legal#terms" },
        { id: "licenses", label: "Licenses", href: "/legal#licenses" },
      ],
    });
  }, [setContent]);

  // ... rest of component
}


// ---------------------------------------------------------------------------
// scope-page.tsx - Using 'app' variant with session info
// ---------------------------------------------------------------------------

export function ScopePage(): React.ReactElement {
  const { setContent } = useHeader();

  useEffect(() => {
    setContent({
      variant: 'app',
      title: sessionName,
      subtitle: "Recording",
      badge: <RecordingBadge />,
      actions: (
        <>
          <ActionButton icon={<Download />} />
          <ActionButton icon={<Settings />} />
        </>
      ),
    });
  }, [setContent, sessionName, sessionStatus]);

  // ... rest of component
}


// ---------------------------------------------------------------------------
// about.tsx - Using 'tabbed' variant
// ---------------------------------------------------------------------------

export function About(): React.ReactElement {
  const { setContent } = useHeader();

  useEffect(() => {
    setContent({
      variant: 'tabbed',
      title: "About",
      forceBackButton: true,
      backUrl: "/",
      tabs: [
        { id: "overview", label: "Overview", href: "/about" },
        { id: "features", label: "Features", href: "/about#features" },
        { id: "changelog", label: "What's New", href: "/about#changelog" },
      ],
    });
  }, [setContent]);

  // ... rest of component
}
*/

// ============================================================================
// 5. BENEFITS OF THIS APPROACH
// ============================================================================

/*
1. TYPE-SAFE VARIANTS
   - Compiler catches invalid prop combinations
   - IDE autocomplete for each variant

2. COMPOSABLE SUB-COMPONENTS
   - HeaderLeft, NavButton can be reused
   - Easy to mix and match

3. SINGLE SOURCE OF TRUTH
   - Header rendering logic in one place
   - Pages just declare their variant + data

4. BACKWARD COMPATIBLE
   - 'app' variant is the default
   - Existing pages work without changes

5. EASY TO EXTEND
   - Add new variants like 'modal' or 'fullscreen'
   - Add new sub-components as needed

6. ROUTE-BASED ALTERNATIVE
   - Could also use layout components instead of context
   - Route files could define their header variant
*/

// ============================================================================
// 6. PROPOSED FILE CHANGES
// ============================================================================

/*
CHANGES NEEDED:

1. /src/contexts/header-context.tsx
   - Add HeaderVariant type
   - Add TabItem interface  
   - Extend HeaderContent interface
   - Update createContext default

2. /src/components/layout/sticky-header.tsx
   - Import new types
   - Extract NavButton, HeaderLeft components
   - Add AppHeader, MinimalHeader, TabbedHeader
   - Add switch in main render

3. /src/routes/*.tsx (optional updates)
   - Add variant to setContent() calls
   - Add tabs where needed
*/

// ============================================================================
// 7. OPTIONAL: FURTHER OPTIMIZATION - Route-Based Headers
// ============================================================================

/*
If you want to go even more declarative, you could use React Router's
layout system to define headers per-route:

// router.tsx
export const router = createRouter([
  {
    path: "/",
    element: <AppShell />,  // Uses 'app' header by default
    children: [
      { path: "/scope", element: <ScopePage /> },
      { path: "/session/:id", element: <SessionPage /> },
    ],
  },
  {
    path: "/",
    element: <InfoShell />,  // Uses 'tabbed' header
    children: [
      { path: "/about", element: <AboutPage /> },
      { path: "/legal", element: <LegalPage /> },
    ],
  },
  {
    path: "/",
    element: <MinimalShell />,  // Uses 'minimal' header
    children: [
      { path: "/report-issue", element: <ReportIssue /> },
      { path: "/contact-support", element: <ContactSupport /> },
    ],
  },
]);

This moves header configuration from useEffect calls to route definitions,
making it even more declarative and harder to forget to set.
*/
