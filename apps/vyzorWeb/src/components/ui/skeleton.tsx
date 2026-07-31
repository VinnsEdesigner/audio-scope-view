import * as React from "react";

interface SkeletonProperties {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProperties): React.ReactElement {
  return <div className={`animate-pulse bg-gray-700 rounded ${className}`} />;
}
