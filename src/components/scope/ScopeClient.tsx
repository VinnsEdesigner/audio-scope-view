import { lazy, Suspense, useEffect, useState } from "react";

// Load the scope (and its WASM engine) only in the browser after hydration.
const Oscilloscope = lazy(() =>
  import("./Oscilloscope").then((m) => ({ default: m.Oscilloscope })),
);

export function ScopeClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-3xl items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Loading DSP engine…
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading DSP engine…</div>}>
      <Oscilloscope />
    </Suspense>
  );
}