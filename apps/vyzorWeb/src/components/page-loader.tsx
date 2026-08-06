import { Spinner } from "./ui/spinner";

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <Spinner />
      <span className="text-sm text-gray-500 font-medium">Loading...</span>
    </div>
  );
}
