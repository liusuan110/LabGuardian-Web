import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoPage } from "./features/demo/DemoPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
// Self-hosted brand fonts (bundled, no runtime CDN dependency).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <DemoPage />
    </ErrorBoundary>
  </StrictMode>,
);
