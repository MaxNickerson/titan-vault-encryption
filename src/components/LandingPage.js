import React from 'react';
import { useNavigate } from 'react-router-dom';  // Import useNavigate hook

const LandingPage = () => {
  const navigate = useNavigate();  // Initialize navigate function

  const handleRegisterClick = () => {
    navigate('/register');  // Navigate to the registration page
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
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition"
            onClick={handleRegisterClick}  // Handle button click
          >
            Register
          </button>
          <button className="w-full py-3 px-6 bg-gray-500 text-white rounded-full text-lg hover:bg-gray-600 transition">
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
