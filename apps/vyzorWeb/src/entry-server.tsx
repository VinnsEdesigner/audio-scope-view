import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { tamaguiConfig } from "@audio-scope-view/tamagui";
import { TamaguiProvider } from "tamagui";
import { Root } from "./root";

export interface RenderOptions {
  url: string;
  mode?: "string";
}

export async function render(options: RenderOptions): Promise<{ html: string; status: number }> {
  const { url } = options;

  try {
    const html = renderToString(
      <TamaguiProvider config={tamaguiConfig}>
        <StaticRouter location={url}>
          <Root />
        </StaticRouter>
      </TamaguiProvider>,
    );
    return { html, status: 200 };
  } catch (error) {
    console.error("SSR render error:", error);
    return { html: "<h1>500 Internal Server Error</h1>", status: 500 };
  }
}

export async function legacyRender(url: string): Promise<string> {
  const { html } = await render({ url });
  return html;
}
