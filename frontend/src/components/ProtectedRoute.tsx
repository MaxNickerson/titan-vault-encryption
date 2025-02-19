import React, { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  // Use the ID token for email verification.
  const idToken = localStorage.getItem("idToken");

  useEffect(() => {
    if (!idToken) {
      setIsValid(false);
      return;
    }

    fetch("http://localhost:8080/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })
      .then(async (res) => {
        if (res.ok) {
          setIsValid(true);
        } else if (res.status === 403) {
          // Parse the JSON response to check if it's due to unverified email.
          const data = await res.json().catch(() => ({}));
          if (data.error === "email_not_verified") {
            // Set a flag so we can redirect to the confirmation page.
            localStorage.setItem("emailNotVerified", "true");
          }
          setIsValid(false);
        } else {
          setIsValid(false);
        }
      })
      .catch(() => setIsValid(false));
  }, [idToken]);

  if (isValid === null) {
    return <div>Loading...</div>;
  }

  if (isValid === false) {
    // If the error is due to unverified email, redirect to ConfirmationPage.
    if (localStorage.getItem("emailNotVerified") === "true") {
      localStorage.removeItem("emailNotVerified");
      return <Navigate to="/confirm" replace />;
    }
    // Otherwise, clear tokens and redirect to /login.
    localStorage.removeItem("idToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
