import React from 'react';

const LandingPage = () => {
  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with content */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        {/* Title without shadow */}
        <h1 className="text-6xl font-bold text-gray-800 mb-12">
          Titan Vault
        </h1>

        {/* Buttons */}
        <div className="space-y-6">
          <button className="w-full py-3 px-6 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition">
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
