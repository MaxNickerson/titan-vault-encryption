import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';

import LandingPage from './components/LandingPage';
import RegistrationPage from './components/RegistrationPage';
import EncryptionPage from './components/EncryptionPage'; // Correct import name

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/encryption" element={<EncryptionPage />} />
      </Routes>
    </Router>
  );
}

export default App;
