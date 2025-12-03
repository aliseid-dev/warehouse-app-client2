import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

          {/* Protected Routes */}
          <Route
            path="/warehouse"
            element={
              <ProtectedRoute>
                <WarehousePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/store"
            element={
              <ProtectedRoute>
                <Store />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <SalesPage />
              </ProtectedRoute>
            }
          />

          {/* Protect Sales Report */}
          <Route
            path="/sales-report"
            element={
              <ProtectedRoute>
                <SalesReport />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/warehouse" replace />} />

          {/* Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}

export default App;