import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import RegistrationPage from "./components/RegistrationPage";
import LoginPage from "./components/LoginPage";
import ConfirmationPage from "./components/ConfirmationPage";
import EncryptionPage from "./components/EncryptionPage";
import BucketTest from "./components/BucketTest";
import ProtectedRoute from "./components/ProtectedRoute";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/confirm" element={<ConfirmationPage />} />
        
        {/* Protected Routes */}
        <Route
          path="/encryption"
          element={
            <ProtectedRoute>
              <EncryptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bucket"
          element={
            <ProtectedRoute>
              <BucketTest />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Router>
  );
};

export default App;
