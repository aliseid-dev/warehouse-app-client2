import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  // If not logged in, go to login
  if (!user) return <Navigate to="/login" replace />;

  // If page requires Admin but user is Staff, kick them to Sales
  if (adminOnly && role === "staff") {
    return <Navigate to="/sales" replace />;
  }

  return children;
}