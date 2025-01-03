import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import RegistrationPage from "./components/RegistrationPage";
import LoginPage from "./components/LoginPage";
import ConfirmationPage from "./components/ConfirmationPage";
import EncryptionPage from "./components/EncryptionPage";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/confirm" element={<ConfirmationPage />} />
        <Route path="/encryption" element={<EncryptionPage />} />
        {/* Add other routes as needed */}
      </Routes>
    </Router>
  );
};

export default App;
