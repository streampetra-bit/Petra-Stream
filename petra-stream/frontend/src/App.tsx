// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import StreamList from "./pages/Stream"; // your Stream.tsx
import StreamDetail from "./pages/StreamDetail";
import Explore from "./pages/Explore";
import ProfilePage from "./pages/Profile";
import DashboardPage from "./pages/Dashboard";
import CreatePage from "./pages/Create"; // NEW: Stream Dashboard / Create page

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

/** Small placeholders for routes we haven't created files for */
function TopPage() {
  return (
    <div className="glass-card p-6">
      <h1 className="text-xl font-semibold">Top Streams</h1>
      <p className="muted mt-2">Placeholder — implement /pages/Top.tsx to replace this.</p>
    </div>
  );
}
function SettingsPage() {
  return (
    <div className="glass-card p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="muted mt-2">Placeholder — account & app preferences.</p>
    </div>
  );
}
function CategoriesPage() {
  return (
    <div className="glass-card p-6">
      <h1 className="text-xl font-semibold">Categories</h1>
      <p className="muted mt-2">Placeholder — browse by category.</p>
    </div>
  );
}
function NotFound() {
  return (
    <div className="glass-card p-6">
      <h1 className="text-xl font-semibold">404 — Page not found</h1>
      <p className="muted mt-2">The page you requested does not exist.</p>
    </div>
  );
}

function Layout() {
  const location = useLocation();
  // hide sidebar on watch / stream detail pages for better focus
  const isStreamPage = location.pathname.startsWith("/stream/") && location.pathname.split("/").length > 2;

  return (
    <div className="min-h-screen bg-bg text-text">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {!isStreamPage && <Sidebar />}

          <main className="flex-1">
            <Routes>
              {/* Core pages */}
              <Route path="/" element={<Home />} />
              <Route path="/streams" element={<StreamList />} />
              <Route path="/stream/:id" element={<StreamDetail />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/profile/:id" element={<ProfilePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/create" element={<CreatePage />} />

              {/* placeholders for UI links that exist in nav/sidebar */}
              <Route path="/top" element={<TopPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />

              {/* aliases */}
              <Route path="/home" element={<Navigate to="/" replace />} />

              {/* catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
