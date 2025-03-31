// src/components/DashboardPage.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EncryptionUtils } from "../encryption/encryptionUtils";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const encryptionUtils = new EncryptionUtils();

  // Modal state
  const [showEncryptModal, setShowEncryptModal] = useState(false);

  // File encryption states???
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");

  // Temporary mock items to display****************************
  const tempItems = ["FileOne.txt", "Photo123.jpg", "SecretDoc.pdf", "Archive.zip"];

  // Track which single item is "selected"????
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // -----------------------------
  // Logout
  // -----------------------------
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
    navigate("/login");
  };

  // -----------------------------
  // Modal toggling
  // -----------------------------
  const openEncryptModal = () => {
    // Reset prior file data???IDK if this is how we are calling everything to the back end
    setFileData(null);
    setFileName("");
    setFileType("");
    setShowEncryptModal(true);
  };

  const closeEncryptModal = () => {
    setShowEncryptModal(false);
  };

  // -----------------------------
  // Handle file selection - - - - IDK - IS THIS HOW THIS WORKS? WILL NEED TO WORK ON
  // -----------------------------
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setFileName(file.name);
      setFileType(file.type);

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setFileData(e.target.result as ArrayBuffer);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // -----------------------------
  // Encrypt & Upload
  // -----------------------------
  const handleEncryptAndUpload = async () => {
    try {
      if (!fileData) {
        console.error("No file data to encrypt.");
        return;
      }

      const password = "myTestPassword123";
      const { salt, iv, encryptedData } = await encryptionUtils.encryptData(
        fileData,
        password
      );

      const packageData = {
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt),
        encryptedData: arrayBufferToBase64(encryptedData),
        fileName,
        fileType,
      };

      const idToken = localStorage.getItem("idToken");
      if (!idToken) {
        console.error("No ID token found. User not logged in.");
        return;
      }

      const response = await fetch("http://localhost:8080/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(packageData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        return;
      }

      console.log("Upload successful:", await response.json());
      closeEncryptModal();
    } catch (error) {
      console.error("Encryption/Upload error:", error);
    }
  };

  // -----------------------------
  // Handle clicking a file
  // -----------------------------
  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName);
  };

  // -----------------------------
  // Close the "preview" box
  // -----------------------------
  const handleClosePreview = () => {
    setSelectedItem(null);
  };

  // -----------------------------
  // Download selected file
  // -----------------------------
  const handleDownload = () => {
    if (!selectedItem) {
      alert("Please select a file to download.");
      return;
    }

    alert(`Downloading ${selectedItem} ...`);
    console.log(`User wants to download: ${selectedItem}`);
    // 1) fetch the encrypted bytes from R2
    // 2) decrypt them with encryptionUtils.decryptData(...)
    // 3) create a Blob and trigger a download
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-100 to-gray-100">
      {/* Top bar */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center justify-center flex-grow gap-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        {/* Two-box layout: left list, right preview */}
        <div className="flex flex-row space-x-4">
          {/* LEFT BOX: List of files */}
          <div className="bg-white p-6 rounded-lg shadow-md w-80">
            <h2 className="text-xl font-semibold mb-4">Your Files</h2>
            <ul className="space-y-2">
              {tempItems.map((item) => (
                <li key={item}>
                  {/* 
                    Instead of a checkbox, let's just make it clickable. 
                    If you'd like checkboxes, you can adapt the approach, 
                    but we want to "open" a preview box on click.
                  */}
                  <button
                    onClick={() => handleItemClick(item)}
                    className="text-blue-600 hover:underline"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT BOX: Only show if an item is selected */}
          {selectedItem && (
            <div className="bg-white p-6 rounded-lg shadow-md w-80 relative">
              {/* Close button */}
              <button
                onClick={handleClosePreview}
                className="absolute top-2 right-2 font-bold text-gray-600 hover:text-black"
              >
                X
              </button>

              <h2 className="text-xl font-semibold mb-4">File Preview</h2>
              <p className="text-gray-700">You selected: {selectedItem}</p>
            </div>
          )}
        </div>

        {/* Buttons row: Encrypt & Download */}
        <div className="flex space-x-4">
          <button
            onClick={openEncryptModal}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Encrypt & Upload
          </button>
          <button
            onClick={handleDownload}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            Download
          </button>
        </div>
      </div>

      {/* Modal for Encryption */}
      {showEncryptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-md w-96">
            <h2 className="text-xl font-bold mb-4">Encrypt & Upload</h2>

            <input type="file" onChange={handleFileUpload} className="mb-4" />

            <div className="flex justify-end space-x-4">
              <button
                onClick={handleEncryptAndUpload}
                disabled={!fileData}
                className={`px-4 py-2 ${
                  !fileData ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"
                } text-white rounded`}
              >
                Upload
              </button>
              <button
                onClick={closeEncryptModal}
                className="px-4 py-2 bg-gray-300 text-black rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
