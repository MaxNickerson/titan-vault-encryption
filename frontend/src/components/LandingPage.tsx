import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  // Check for token on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setShowPopup(true); // Show popup if token exists
    }
  }, []);

  const handleRegisterClick = () => {
    navigate("/register");
  };

  const handleLoginClick = () => {
    navigate("/login");
  };

  const handleUseCurrentLogin = () => {
    setShowPopup(false); // Close the popup
    navigate("/encryption"); // Redirect to the protected page
  };

  const handleLogout = () => {
    // Remove tokens from localStorage
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
  
    // Optional: Clear other sensitive user-related data
    localStorage.removeItem("userInfo");
  
    console.log("All tokens deleted");
    navigate("/login"); // Redirect to login
  };

  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with content */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        {/* Title */}
        <h1 className="text-6xl font-bold text-gray-800 mb-12">Titan Vault</h1>

        {/* Buttons */}
        <div className="space-y-6">
          <button
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full text-lg transition-transform transform hover:scale-105"
            onClick={handleRegisterClick}
          >
            Register
          </button>
          <button
            className="w-full py-3 px-6 bg-gray-500 text-white rounded-full text-lg transition-transform transform hover:scale-105"
            onClick={handleLoginClick}
          >
            Login
          </button>
        </div>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">
              You're already logged in.
            </h2>
            <p className="mb-6">Would you like to continue as this user or log out?</p>
            <div className="flex space-x-4">
              <button
                onClick={handleUseCurrentLogin}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Continue
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
