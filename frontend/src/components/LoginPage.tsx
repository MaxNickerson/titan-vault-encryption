import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  // ------------------------------
  // NEW: For handling MFA pop-up
  // ------------------------------
  const [showMfaPopup, setShowMfaPopup] = useState(false);
  const [mfaSession, setMfaSession] = useState(""); 
  const [mfaCode, setMfaCode] = useState("");
  // ------------------------------

  // OPTIONAL: Auto-redirect if tokens exist (adjust as needed)
  useEffect(() => {
    const savedIdToken = localStorage.getItem("idToken");
    const savedAccessToken = localStorage.getItem("accessToken");
    const savedRefreshToken = localStorage.getItem("refreshToken");
    if (savedIdToken && savedAccessToken && savedRefreshToken) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
  
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
      });
  
      if (!response.ok) {
        let errorText = await response.text();
  
        try {
          const json = JSON.parse(errorText);
          if (json?.error) {
            errorText = json.error;
            console.error("⚠️ Login API returned error JSON:", json);
          }
        } catch {
          console.warn("⚠️ Login API returned plain text error:", errorText);
        }
  
        if (errorText.includes("UserNotConfirmedException")) {
          localStorage.setItem("email", email);
          navigate("/confirm", { state: { email } });
        } else {
          setErrorMessage(errorText || "Login failed");
        }
        return;
      }
  
      const data = await response.json();
  
      if (data.error) {
        console.error("❌ Login error received:", data.error);
        setErrorMessage(data.error);
        return;
      }
  
      console.log("✅ Login response:", data);
  
      if (data.ChallengeName && data.Session) {
        setMfaSession(data.Session);
        setShowMfaPopup(true);
        return;
      }
  
      if (data.IdToken && data.AccessToken && data.RefreshToken) {
        localStorage.setItem("idToken", data.IdToken);
        localStorage.setItem("accessToken", data.AccessToken);
        localStorage.setItem("refreshToken", data.RefreshToken);
        localStorage.setItem("email", email);
  
        navigate("/dashboard");
      } else {
        setErrorMessage("Login response invalid");
        console.warn("⚠️ Unexpected login response structure:", data);
      }
    } catch (error) {
      console.error("🔥 Login network or parsing error:", error);
      setErrorMessage("An error occurred during login");
    }
  };
  

  // -------------------------------------------------
  // NEW: Handler to respond to the MFA challenge
  // -------------------------------------------------
  const handleMfaSubmit = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/respondMFA`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session: mfaSession,
          mfaCode,
          email,
        }),
      });
  
      if (!response.ok) {
        const errorText = await response.text(); // 🧠 fallback for plain string
        setErrorMessage(errorText || "Failed to confirm MFA code");
        return;
      }
  
      let data;
      try {
        data = await response.clone().json(); // ✅ allows fallback
      } catch {
        const fallback = await response.text();
        throw new Error(`❌ Invalid JSON response: ${fallback}`);
      }
  
      console.log("✅ MFA tokens:", data);
  
      localStorage.setItem("idToken", data.IdToken);
      localStorage.setItem("accessToken", data.AccessToken);
      localStorage.setItem("refreshToken", data.RefreshToken);
      localStorage.setItem("email", email);
  
      setShowMfaPopup(false);
      navigate("/dashboard");
    } catch (error) {
      console.error("MFA submission error:", error);
    
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unknown error occurred during MFA submission.");
      }
    }
  };
  

  // OPTIONAL: Resend code approach for MFA
  // Typically, for Cognito SMS_MFA, you can just re-initiate /login to get a new code
  const handleMfaResend = async () => {
    // Just re-call login to request a new code (some user pools might not always do it)
    // Alternatively, you could have a custom flow if needed.
    setErrorMessage("");
    setMfaCode("");

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const errorText = await response.text(); // ✅
        setErrorMessage(errorText || "Failed to resend MFA code");
        return;
      }
      
      const data = await response.json(); // ✅ safe
    
      if (data.Session) {
        setMfaSession(data.Session);
      }
      
      // Otherwise, hopefully triggers a new SMS code.
    } catch (err) {
      setErrorMessage("Error trying to resend MFA code.");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with form */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        <h1 className="text-6xl font-bold text-gray-800 mb-12">Titan Vault</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Login to your account
        </h2>
        <p className="text-gray-500 mb-6">
          Enter your credentials to continue.
        </p>
        <form onSubmit={handleLogin} className="w-full">
          <input
            type="email"
            placeholder="Email"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">
            Login
          </button>
        </form>
        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
        <p className="text-gray-500 mt-4">
          Don’t have an account?{" "}
          <a href="/register" className="text-blue-500">
            Register
          </a>
        </p>

        {/* -----------------------------------
          NEW: Simple MFA Popup
        ----------------------------------- */}
        {showMfaPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded shadow-md">
              <h3 className="text-xl font-bold mb-4">Enter MFA Code</h3>
              <input
                type="text"
                className="border p-2 w-full mb-2"
                placeholder="6-digit code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
              <div className="flex justify-end gap-4">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                  onClick={handleMfaSubmit}
                >
                  Submit
                </button>
                <button
                  className="bg-gray-300 px-4 py-2 rounded"
                  onClick={handleMfaResend}
                >
                  Resend Code
                </button>
              </div>
            </div>
          </div>
        )}
        {/* -----------------------------------
           End of MFA popup
        ----------------------------------- */}
      </div>
    </div>
  );
};

export default LoginPage;
