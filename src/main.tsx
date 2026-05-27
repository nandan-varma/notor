import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyCachedTheme, refreshThemeCacheFromBackend } from "@/lib/bootstrap";

// Apply the cached theme synchronously so the first paint doesn't flash.
applyCachedTheme();
// Refresh the cache from the canonical Rust-side state for the *next* launch.
void refreshThemeCacheFromBackend();

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
