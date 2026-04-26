import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoPage } from "./features/demo/DemoPage";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <DemoPage />
  </StrictMode>,
);
