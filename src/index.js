// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';  // Import global styles, including Tailwind CSS
import App from './App';  // Import the main App component

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />  {/* Render the App component */}
  </React.StrictMode>
);
