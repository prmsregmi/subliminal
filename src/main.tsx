import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { convex } from "@/lib/convex";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import EmployeePage from "@/pages/EmployeePage";
import ActionPage from "@/pages/ActionPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/post-by-employees" element={<EmployeePage />} />
          <Route path="/action/:token" element={<ActionPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="light" position="top-right" richColors closeButton />
    </ConvexProvider>
  </StrictMode>,
);
