import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

// When built with VITE_BASE_PATH=/admin/ (see vite.config.ts), Vite exposes
// that as import.meta.env.BASE_URL and React Router needs the matching
// `basename` so links/routes resolve under /admin instead of /. Normal
// deployment (BASE_URL === "/") needs no basename at all.
const basename = import.meta.env.BASE_URL !== "/" ? import.meta.env.BASE_URL.replace(/\/$/, "") : undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
