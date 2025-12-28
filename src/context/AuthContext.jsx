import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../utils/firebase"; // Ensure path is correct
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      try {
        if (authUser) {
          // 1. Get the user document from Firestore using the UID
          const docRef = doc(db, "users", authUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            // 2. Set the role (admin or staff)
            setRole(docSnap.data().role);
          } else {
            console.error("User role not found in database.");
            setRole(null);
          }
          setUser(authUser);
        } else {
          // Reset states if logged out
          setUser(null);
          setRole(null);
        }
      } catch (error) {
        console.error("Auth context error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {/* Do not render children until initial auth check is done */}
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};