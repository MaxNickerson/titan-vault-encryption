import React from 'react';

const RegistrationPage = () => {
  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with form */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        {/* Logo or Title */}
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Titan Vault</h1>
        
        {/* Form Section */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Create an account</h2>
        <p className="text-gray-500 mb-6">Sign up to continue</p>

        {/* Name Input */}
        <input 
          type="text" 
          placeholder="Name" 
          className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
        />

        {/* Email Input */}
        <input 
          type="email" 
          placeholder="Email" 
          className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
        />

        {/* Checkbox for Terms */}
        <div className="flex items-center mb-4">
          <input type="checkbox" id="terms" className="mr-2" />
          <label htmlFor="terms" className="text-gray-500">
            I agree to the <a href="#" className="text-blue-500">Terms and Conditions</a> and the <a href="#" className="text-blue-500">Privacy Policy</a>
          </label>
        </div>

        {/* Verify Button */}
        <button 
          className="w-full py-3 px-6 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition">
          Verify
        </button>

        {/* Login Link */}
        <p className="text-gray-500 mt-4">
          Already have an account? <a href="#" className="text-blue-500">Login</a>
        </p>
      </div>
    </div>
  );
};

export default RegistrationPage;
