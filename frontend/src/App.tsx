import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import RegistrationPage from "./components/RegistrationPage";
import LoginPage from "./components/LoginPage";
import ConfirmationPage from "./components/ConfirmationPage";
import EncryptionPage from "./components/EncryptionPage";
import BucketTest from "./components/BucketTest";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardPage from "./components/DashboardPage";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/confirm" element={<ConfirmationPage />} />

        {/*
          HEAD version used <ProtectedRoute> for /encryption. 
          max’s version had it unprotected. 
          We'll keep max’s approach of no ProtectedRoute for encryption:
        */}
        {/* <Route
          path="/encryption"
          element={
            <ProtectedRoute>
              <EncryptionPage />
            </ProtectedRoute>
          }
        /> */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/*
          HEAD used <ProtectedRoute> for /bucket, so let's keep that for now:
        */}
        <Route
          path="/download"
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
