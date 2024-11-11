// src/components/ConfirmationPage.js
import React, { useState } from 'react';
import { CognitoUser } from 'amazon-cognito-identity-js';
import UserPool from '../cognitoConfig';
import { useNavigate, useLocation } from 'react-router-dom';

const ConfirmationPage = () => {
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  if (!email) {
    // If email is not provided, redirect to registration
    navigate('/register');
  }

  const handleConfirm = (e) => {
    e.preventDefault();

    const user = new CognitoUser({
      Username: email,
      Pool: UserPool,
    });

    user.confirmRegistration(otp, true, (err, result) => {
      if (err) {
        setErrorMessage(err.message || JSON.stringify(err));
        setSuccessMessage('');
        return;
      }
      setSuccessMessage('Your account has been verified!');
      setErrorMessage('');
      // Optionally redirect to login or dashboard
      navigate('/login');
    });
  };

  const handleResendCode = () => {
    const user = new CognitoUser({
      Username: email,
      Pool: UserPool,
    });

    user.resendConfirmationCode((err, result) => {
      if (err) {
        setErrorMessage(err.message || JSON.stringify(err));
        return;
      }
      setSuccessMessage('Verification code resent successfully.');
    });
  };

  return (
    <div className="flex h-screen">
      {/* Left section with gradient */}
      <div className="w-1/2 bg-gradient-to-b from-blue-200 to-gray-300"></div>

      {/* Right section with form */}
      <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8">
        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Titan Vault</h1>

        {/* Form Section */}
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Verify Your Account
        </h2>
        <p className="text-gray-500 mb-6">
          Please enter the verification code sent to your email.
        </p>

        <form onSubmit={handleConfirm} className="w-full">
          {/* OTP Input */}
          <input
            type="text"
            placeholder="Verification Code"
            className="w-full py-3 px-4 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
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

        {/* Resend Code */}
        <button
          onClick={handleResendCode}
          className="mt-4 text-blue-500 hover:underline"
        >
          Resend Verification Code
        </button>

        {/* Error and Success Messages */}
        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
        {successMessage && (
          <p className="text-green-500 mt-4">{successMessage}</p>
        )}
      </div>
    </div>
  );
};

export default ConfirmationPage;
