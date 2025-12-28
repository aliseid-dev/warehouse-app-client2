import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext"; 
import ProductsPage from "./pages/ProductsPage"; // CHANGED: Imported ProductsPage
import Store from "./pages/Store";
import SalesPage from "./pages/SalesPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import SalesReport from "./pages/SalesReport";

import SalesHistoryPage from "./pages/SalesHistoryPage"; 
import UnpaidSalesPage from "./pages/UnpaidSalesPage";

import "./styles/App.css";

function App() {
  const location = useLocation();
  const { role, loading } = useAuth();

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
          {/* UPDATED: Path is now /products and uses ProductsPage */}
          <Route
            path="/products"
            element={
              <ProtectedRoute adminOnly={true}>
                <ProductsPage />
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

          <Route
            path="/sales-history"
            element={
              <ProtectedRoute adminOnly={false}>
                <SalesHistoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/unpaid-sales"
            element={
              <ProtectedRoute adminOnly={false}>
                <UnpaidSalesPage />
              </ProtectedRoute>
            }
          />

          {/* Smart Redirect */}
          {/* UPDATED: Admin now redirects to /products instead of /warehouse */}
          <Route 
            path="/" 
            element={
              <Navigate to={role === "admin" ? "/products" : "/sales"} replace />
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}

export default App;