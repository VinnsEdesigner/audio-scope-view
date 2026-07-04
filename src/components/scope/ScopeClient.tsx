import { lazy, Suspense, useEffect, useState } from "react";

// Load the scope (and its WASM engine) only in the browser after hydration.
const Oscilloscope = lazy(() =>
  import("./Oscilloscope").then((m) => ({ default: m.Oscilloscope })),
);

function Loading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background text-sm text-muted-foreground">
      Loading DSP engine…
    </div>
  );
}

export function ScopeClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <Oscilloscope />
    </Suspense>
  );
}
