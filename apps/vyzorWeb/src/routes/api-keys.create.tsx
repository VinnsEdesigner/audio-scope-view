export function CreateApiKey(): React.ReactElement {
  return (
    <div className="w-full min-h-screen">
      <div className="w-full px-4 py-6 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <h1 className="text-2xl font-bold text-foreground">Create New API Key</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This is a nested page - you should see the back arrow (←) in the top nav.
        </p>
        <div className="mt-6 p-6 bg-bg-secondary border border-border-subtle rounded-lg">
          <p className="text-text-secondary">Form would go here...</p>
        </div>
      </div>
    </div>
  );
}
