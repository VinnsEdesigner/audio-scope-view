import { useNavigation } from "react-router-dom";
import { useEffect, useState } from "react";

export function NavigationLoader(): React.ReactElement {
  const navigation = useNavigation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (navigation.state === "loading") {
      setIsVisible(true);
    } else {
      const timeout = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(timeout);
    }
  }, [navigation.state]);

  if (!isVisible) {
    return <></>;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent pointer-events-none">
      <div className="h-full bg-accent animate-[loading-bar_1s_ease-in-out_infinite]" />
      <style>{`
 @keyframes loading-bar {
 0% {
 width: 0%;
 opacity: 1;
 }
 50% {
 width: 70%;
 opacity: 1;
 }
 100% {
 width: 100%;
 opacity: 0;
 }
 }
 `}</style>
    </div>
  );
}
