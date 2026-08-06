import { Spinner } from "./ui/spinner";

export function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <Spinner size={42} />
    </div>
  );
}
