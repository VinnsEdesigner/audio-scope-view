import * as React from "react";
import { useHeader } from "@/contexts/header-context";

export function StickyHeader(): React.ReactElement | null {
  const { content } = useHeader();
  
  // Don't render if no title is set
  if (!content.title) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-md border-b border-border-subtle">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        {/* Left side - Title and subtitle */}
        <div className="flex items-center gap-3 min-w-0">
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
