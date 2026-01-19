// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Streams from "./pages/Streams";
import StreamDetail from "./pages/StreamDetail";
import Explore from "./pages/Explore";
import ProfilePage from "./pages/Profile";
import DashboardPage from "./pages/Dashboard";
import CreatePage from "./pages/Create";
import Top from "./pages/Top";
import Settings from "./pages/Settings";
import Categories from "./pages/Categories";
import Notifications from "./pages/Notifications";
import Monitor from "./pages/Monitor";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import AuthGate from "./components/AuthGate";

function NotFound() {
  return (
    <div className="glass-card p-6">
      <h1 className="text-xl font-semibold">404 - Page not found</h1>
      <p className="muted mt-2">The page you requested does not exist.</p>
    </div>
  );
}

function Layout() {
  const location = useLocation();
  // hide sidebar on watch / stream detail pages for better focus
  const isStreamPage = location.pathname.startsWith("/stream/") && location.pathname.split("/").length > 2;
  const isDashboardPage = location.pathname.startsWith("/dashboard");
  const showNavbar = !isDashboardPage;
  const showSidebar = !isStreamPage && !isDashboardPage;

  const routes = (
    <Routes>
      {/* Core pages */}
      <Route path="/" element={<Home />} />
      <Route path="/streams" element={<Streams />} />
      <Route path="/stream/:id" element={<StreamDetail />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/create" element={<CreatePage />} />

      {/* UI routes */}
      <Route path="/top" element={<Top />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/monitor" element={<Monitor />} />

      {/* aliases */}
      <Route path="/home" element={<Navigate to="/" replace />} />

      {/* catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  if (isDashboardPage) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <AuthGate />
        <main className="min-h-screen">{routes}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <AuthGate />
      {showNavbar && <Navbar />}

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {showSidebar && <Sidebar />}

          <main className="flex-1">
            {routes}
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
