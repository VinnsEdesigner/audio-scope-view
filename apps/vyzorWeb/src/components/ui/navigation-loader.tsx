import { useNavigation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUIStore } from "@/hooks";
import { Spinner } from "./spinner";

export function NavigationLoader(): React.ReactElement {
  const navigation = useNavigation();
  const isInitializing = useUIStore((state) => state.isInitializing);
  const [isVisible, setIsVisible] = useState(true);

  // Handle initialization state changes
  useEffect(() => {
    if (isInitializing) {
      setIsVisible(true);
    } else {
      // Keep bar visible briefly after initialization completes
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [isInitializing]);

  // Handle React Router navigation
  useEffect(() => {
    if (navigation.state === "loading") {
      setIsVisible(true);
    }
  }, [navigation.state]);

  if (!isVisible) {
    return <></>;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm pointer-events-none">
      {/* Loading bar at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-bg-primary/50">
        <div className="h-full bg-gray-400 animate-[loading-bar_0.8s_ease-in-out_infinite]" />
      </div>

      {/* Centered spinner */}
      <div className="flex flex-col items-center gap-4">
        <Spinner size={48} className="text-gray-400 sm:text-gray-500" />
        <span className="text-xs sm:text-sm text-gray-500 font-medium">Loading...</span>
      </div>

      <style>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            opacity: 1;
          }
          50% {
            width: 75%;
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
