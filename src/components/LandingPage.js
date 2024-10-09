import React from 'react';

const LandingPage = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-r from-blue-200 to-gray-300">
      <div className="text-center bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold text-orange-500 mb-8">Titan Vault</h1>
        <div className="space-y-4">
          <button className="w-full py-3 px-6 bg-blue-500 text-white rounded-full text-lg hover:bg-blue-600 transition">
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
