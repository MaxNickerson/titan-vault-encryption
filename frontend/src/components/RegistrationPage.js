// src/components/RegistrationPage.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserPool from '../cognitoConfig';
import { CognitoUserAttribute } from 'amazon-cognito-identity-js';

const RegistrationPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState(''); // New state for user ID
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();

    // Check if passwords match
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    // Add name and userId as user attributes
    const attributeList = [];
    const nameAttribute = new CognitoUserAttribute({
      Name: 'name',
      Value: name,
    });
    const userIdAttribute = new CognitoUserAttribute({
      Name: 'custom:user_id', // Using the custom attribute user_id
      Value: userId,
    });

    attributeList.push(nameAttribute, userIdAttribute);

    // Register the user with Cognito
    UserPool.signUp(email, password, attributeList, null, (err, result) => {
      if (err) {
        setErrorMessage(err.message || JSON.stringify(err));
        return;
      }
      // Navigate to the ConfirmationPage and pass the email and user ID
      navigate('/confirm', { state: { email, userId } });
    });
  };

  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with form */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        {/* Logo or Title */}
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Titan Vault</h1>

        {/* Form Section */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Create an account
        </h2>
        <p className="text-gray-500 mb-6">Sign up to continue</p>

        <form onSubmit={handleRegister} className="w-full">
          {/* Name Input */}
          <input
            type="text"
            placeholder="Name"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Email Input */}
          <input
            type="email"
            placeholder="Email"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* User ID Input */}
          <input
            type="text"
            placeholder="User ID"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />

          {/* Password Input */}
          <input
            type="password"
            placeholder="Password"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Confirm Password Input */}
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {/* Checkbox for Terms */}
          <div className="flex items-center mb-4">
            <input type="checkbox" id="terms" className="mr-2" required />
            <label htmlFor="terms" className="text-gray-500">
              I agree to the{' '}
              <a href="#" className="text-blue-500">
                Terms and Conditions
              </a>{' '}
              and the{' '}
              <a href="#" className="text-blue-500">
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition"
          >
            Register
          </button>
        </form>

        {/* Error Message */}
        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}

        {/* Login Link */}
        <p className="text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-500">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegistrationPage;
