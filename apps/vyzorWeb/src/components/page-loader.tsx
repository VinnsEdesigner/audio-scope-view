import { Spinner } from "./ui/spinner";

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner />
    </div>
  );
}
