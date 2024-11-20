// src/components/ConfirmationPage.js
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import UserPool from '../cognitoConfig';
import { CognitoUser } from 'amazon-cognito-identity-js';

const ConfirmationPage = () => {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const userId = location.state?.userId || '';

  const handleConfirm = (e) => {
    e.preventDefault();

    const userData = {
      Username: email,
      Pool: UserPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
      if (err) {
        setErrorMessage(err.message || JSON.stringify(err));
        return;
      }
      setSuccessMessage('Account confirmed successfully!');
      // Navigate to login page or dashboard
      navigate('/login');
    });
  };

  const handleResendCode = () => {
    const userData = {
      Username: email,
      Pool: UserPool,
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.resendConfirmationCode((err, result) => {
      if (err) {
        setErrorMessage(err.message || JSON.stringify(err));
        return;
      }
      setSuccessMessage('Confirmation code resent successfully!');
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
          Confirm Your Account
        </h2>
        <p className="text-gray-500 mb-2">
          We've sent a confirmation code to your email: <strong>{email}</strong>
        </p>
        <p className="text-gray-500 mb-6">
          Your User ID is: <strong>{userId}</strong>
        </p>

        <form onSubmit={handleConfirm} className="w-full">
          {/* Confirmation Code Input */}
          <input
            type="text"
            placeholder="Confirmation Code"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            required
          />

          {/* Confirm Button */}
          <button
            type="submit"
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full text-lg hover:bg-blue-700 transition"
          >
            Confirm Account
          </button>
        </form>

        {/* Resend Code Link */}
        <p className="text-gray-500 mt-4">
          Didn't receive a code?{' '}
          <button onClick={handleResendCode} className="text-blue-500">
            Resend Code
          </button>
        </p>

        {/* Success Message */}
        {successMessage && <p className="text-green-500 mt-4">{successMessage}</p>}

        {/* Error Message */}
        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}

        {/* Back to Login Link */}
        <p className="text-gray-500 mt-4">
          Back to{' '}
          <Link to="/login" className="text-blue-500">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ConfirmationPage;
