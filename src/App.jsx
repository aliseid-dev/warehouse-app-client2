import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext"; // Import your auth hook
import WarehousePage from "./pages/WarehousePage";
import Store from "./pages/Store";
import SalesPage from "./pages/SalesPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import SalesReport from "./pages/SalesReport";

import "./styles/App.css";

function App() {
  const location = useLocation();
  const { role, loading } = useAuth(); // Get role and loading state

  // 1. Important: Wait for auth to load before deciding on redirects
  if (loading) {
    return <div className="loading-screen">Loading System...</div>;
  }

  const hideBottomNav = ["/login", "/signup", "/forgot-password"].includes(
    location.pathname
  );

  return (
    <div className="app-container">
      <div className="page-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* --- ADMIN ONLY ROUTES --- */}
          {/* We pass adminOnly={true} to your ProtectedRoute component */}
          <Route
            path="/warehouse"
            element={
              <ProtectedRoute adminOnly={true}>
                <WarehousePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/store"
            element={
              <ProtectedRoute adminOnly={true}>
                <Store />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sales-report"
            element={
              <ProtectedRoute adminOnly={true}>
                <SalesReport />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute adminOnly={true}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* --- STAFF & ADMIN ACCESSIBLE --- */}
          <Route
            path="/sales"
            element={
              <ProtectedRoute adminOnly={false}>
                <SalesPage />
              </ProtectedRoute>
            }
          />

          {/* Smart Redirect: If staff, go to sales. If admin, go to warehouse */}
          <Route 
            path="/" 
            element={
              <Navigate to={role === "admin" ? "/warehouse" : "/sales"} replace />
            } 
          />

          {/* Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}

export default App;