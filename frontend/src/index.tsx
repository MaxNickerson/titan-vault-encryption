// src/index.js
import "./styles/styles.css"; // Import global styles, including Tailwind CSS
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css"; // Import global styles, including Tailwind CSS
import App from "./App"; // Import the main App component

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App /> {/* Render the App component */}
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element.");
}
