import { renderToString } from "react-dom/server";
import { ServerRouter } from "react-router-dom/server";
import { Root } from "./root";

export function render(url: string) {
  return renderToString(
    <ServerRouter location={url}>
      <Root />
    </ServerRouter>,
  );
}
