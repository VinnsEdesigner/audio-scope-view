import * as React from "react";

export type HeaderVariant = "app" | "minimal" | "tabbed";

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

export interface HeaderContextValue {
  content: HeaderContent;
  setContent: (content: HeaderContent) => void;
}

export const HeaderContext = React.createContext<HeaderContextValue>({
  content: { title: "" },
  setContent: () => {},
});

export function useHeader() {
  return React.useContext(HeaderContext);
}
