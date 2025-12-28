import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth, db } from "../utils/firebase"; // Ensure db is exported from your firebase config
import { setDoc, doc } from "firebase/firestore"; // Added Firestore methods
import { useNavigate, Link } from "react-router-dom";
import "../styles/Auth.css";

export default function SignupPage() {
  const [name, setName] = useState(""); // New state for name
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Add the user details to Firestore
      // We use the Auth UID as the document ID for easy reference later
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        role: "staff",          // Default role
        assignedStoreId: "",    // Default empty (Admin assigns this later)
        createdAt: new Date(),
        status: "active"
      });

      // 3. Send verification email
      await sendEmailVerification(user);
      setVerificationSent(true);
      setCanResend(false);
      setTimer(30);
    } catch (err) {
      setError(err.message);
    }
  };

  // ... (handleResendVerification and useEffect timer stay the same)

 return (
  <div className="auth-container">
    <div className="auth-card">
      {!verificationSent ? (
        <>
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Set up your Flash Stock login</p>
          
          <form onSubmit={handleSignup} className="auth-form">
            <input
              type="text"
              placeholder="Username"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email address"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="auth-btn">
              Sign Up
            </button>
          </form>

          {/* 1. BACK TO LOGIN (Main Form) */}
          <div className="auth-footer">
            <p>Already have an account? <Link to="/login" className="auth-link">Login</Link></p>
          </div>
        </>
      ) : (
        <div className="verify-email-section">
          <div className="verify-card">
            <div className="verify-icon">📧</div>
            <h2 className="verify-title">Check your email, {name}!</h2>
            <p className="verify-text">
              We’ve sent a verification email to <strong>{email}</strong>.<br />
              Please check your inbox to activate your staff account.
            </p>
            
            <div className="verify-actions">
              <button
                onClick={handleResendVerification}
                className="resend-btn"
                disabled={!canResend}
              >
                {canResend ? "Resend Verification" : `Resend in ${timer}s`}
              </button>

              {/* 2. BACK TO LOGIN (Verification View) */}
              <Link to="/login" className="back-to-login-btn">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}