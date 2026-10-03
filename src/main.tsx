import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

declare global {
  interface Window {
    __EJAZ_BOOT__?: { hide: () => void; fail: (detail: unknown) => void };
  }
}

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

const container = document.getElementById("root");

if (!container) {
  window.__EJAZ_BOOT__?.fail("Mount point #root was not found in the document.");
} else {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary onError={(error) => window.__EJAZ_BOOT__?.fail(error)}>
        <AppBoot />
      </ErrorBoundary>
    </StrictMode>
  );
}
