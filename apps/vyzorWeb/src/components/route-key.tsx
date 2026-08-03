import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

interface RouteKeyProperties {
  children: React.ReactNode;
}

export function RouteKey({ children }: RouteKeyProperties): React.ReactElement {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  return <div key={key}>{children}</div>;
}
