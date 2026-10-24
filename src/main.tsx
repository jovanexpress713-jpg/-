import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

declare global {
  interface Window {
    __EJAZ_BOOT__?: { hide: () => void; fail: (detail: unknown) => void };
  }
}

const container = document.getElementById("root");

async function bootstrap() {
  if (!container) {
    window.__EJAZ_BOOT__?.fail("Mount point #root was not found in the document.");
    return;
  }

  // The current application shell still contains a legacy quick-access call.
  // Make that surface inert before App is evaluated so a backend outage can
  // never fall through to a locally fabricated SUPER_ADMIN session.
  const { apiClient } = await import("./services/apiClient");
  apiClient.auth.quickAccess = async () => ({ token: "", user: null });

  const { default: App } = await import("./App");

  /**
   * Removes the boot surface once React has committed its first paint, so a
   * loading state is always visible instead of a blank page.
   */
  function AppBoot() {
    useEffect(() => {
      window.__EJAZ_BOOT__?.hide();
    }, []);

    return <App />;
  }

  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary onError={(error) => window.__EJAZ_BOOT__?.fail(error)}>
        <AppBoot />
      </ErrorBoundary>
    </StrictMode>
  );
}

bootstrap().catch((error) => {
  window.__EJAZ_BOOT__?.fail(error instanceof Error ? error : String(error));
});
