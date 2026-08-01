import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

interface RouteKeyProperties {
  children: React.ReactNode;
}

/**
 * Wrapper component that forces children to remount when route changes.
 * This ensures that data fetching hooks are re-executed on each navigation.
 */
export function RouteKey({ children }: RouteKeyProperties): React.ReactElement {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    // Update key on every location change to force remount
    setKey(location.pathname);
  }, [location.pathname]);

  return <div key={key}>{children}</div>;
}
