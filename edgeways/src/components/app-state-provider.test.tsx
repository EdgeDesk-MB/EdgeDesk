import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AppStateProvider, useAppStateContext } from "./app-state-provider";
import { PublicDemoProvider } from "./demo/public-demo-provider";

function StateProbe() {
  const { state } = useAppStateContext();
  return <span>{state ? `bets:${state.bets.length}` : "loading"}</span>;
}

describe("AppStateProvider on the server", () => {
  it("does not build the public demo desk during SSR", () => {
    const html = renderToString(
      <PublicDemoProvider initialActive>
        <AppStateProvider>
          <StateProbe />
        </AppStateProvider>
      </PublicDemoProvider>
    );
    expect(html).toContain("loading");
    expect(html).not.toContain("bets:");
  });
});
