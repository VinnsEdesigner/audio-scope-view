import * as React from "react";

export interface HeaderContent {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
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
