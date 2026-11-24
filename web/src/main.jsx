import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./styles.css";

// Students open ?live=<code> for a read-only view of a teacher's board
const LiveView = lazy(() => import("./LiveView.jsx"));
const liveCode = new URLSearchParams(window.location.search).get("live");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {liveCode ? (
      <Suspense fallback={null}>
        <LiveView code={liveCode} />
      </Suspense>
    ) : (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )}
  </StrictMode>
);
