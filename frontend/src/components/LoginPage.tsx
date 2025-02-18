import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedIdToken = localStorage.getItem("idToken");
    const savedAccessToken = localStorage.getItem("accessToken");
    const savedRefreshToken = localStorage.getItem("refreshToken");
    if (savedIdToken && savedAccessToken && savedRefreshToken) {
      navigate("/encryption");
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:8080/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // if you want cookies to be included
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // Parse the JSON for tokens
        const data = await response.json();
        console.log("Tokens received:", data);

        // data looks like:
        // {
        //   "IdToken": "xxx.yyy.zzz",
        //   "AccessToken": "...",
        //   "RefreshToken": "...",
        //   "TokenType": "Bearer"
        // }

        // Store tokens in localStorage (or cookies, if preferred)
        localStorage.setItem("idToken", data.IdToken);
        localStorage.setItem("accessToken", data.AccessToken); // we pass this to the backend
        localStorage.setItem("refreshToken", data.RefreshToken);
        // a refresh token is used to get a new access token when the current one expires, not a JWT usually

        // Navigate to your protected page
        navigate("/encryption");
      } else {
        // If not ok, show the error message
        const errorText = await response.text();
        setErrorMessage(errorText);
      }
    } catch (error) {
      setErrorMessage("An error occurred during login");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with form */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        {/* Title */}
        <h1 className="text-6xl font-bold text-gray-800 mb-12">Titan Vault</h1>

        {/* Form Section */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Login to your account
        </h2>
        <p className="text-gray-500 mb-6">Enter your credentials to continue</p>

        <form onSubmit={handleLogin} className="w-full">
          {/* Email Input */}
          <input
            type="email"
            placeholder="Email"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Password Input */}
          <input
            type="password"
            placeholder="Password"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Submit Button */}
          <button type="submit" className="btn btn-primary">
            Login
          </button>
        </form>

        {/* Error and Success Messages */}
        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}

        {/* Register Link */}
        <p className="text-gray-500 mt-4">
          Don’t have an account?{" "}
          <a href="/register" className="text-blue-500">
            Register
          </a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
