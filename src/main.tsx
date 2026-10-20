import React from "react";
import { createRoot } from "react-dom/client";
import AppDb from "./AppDb";
import "./styles.css";
import "./auth.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppDb />
  </React.StrictMode>,
);
