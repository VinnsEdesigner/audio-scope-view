import { createFileRoute } from "@tanstack/react-router";
import { ScopeClient } from "@/components/scope/ScopeClient";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <ScopeClient />
    </main>
  );
}
