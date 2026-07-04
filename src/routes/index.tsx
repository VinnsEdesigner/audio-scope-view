import { createFileRoute } from "@tanstack/react-router";
import { ScopeClient } from "@/components/scope/ScopeClient";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-background">
      <ScopeClient />
    </main>
  );
}
