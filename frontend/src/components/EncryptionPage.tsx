import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {EncryptionUtils} from "../encryption/encryptionUtils"

const EncryptionPage = () => {
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [encryptedPackage, setEncryptedPackage] = useState<{
    iv: string;
    salt: string;
    encryptedData: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [decryptedData, setDecryptedData] = useState<ArrayBuffer | null>(null);
  const [decryptedFileUrl, setDecryptedFileUrl] = useState<string | null>(null);
  const [isFileSelected, setIsFileSelected] = useState(false);

  const navigate = useNavigate();
  const encryptionUtils = new EncryptionUtils();
  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
    navigate("/login");
  };

  // Utility functions for encoding/decoding
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return window.btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Handle file upload
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

  // const handleEncryptFile = async () => {
  //   if(fileData) {
  //     try {
  //       const password = "myTestPassword123"
  //       // call the utility class
  //       const { salt, iv, encryptedData } = await encryptionUtils.encryptData(
  //         fileData,
  //         password
  //       );

  //       const packageData = {
  //         iv: arrayBufferToBase64(iv),
  //         salt: arrayBufferToBase64(salt),
  //         encryptedData: arrayBufferToBase64(encryptedData),
  //         fileName,
  //         fileType,
  //       };
  //       setEncryptedPackage(packageData);
  //       console.log("Encrypted package:", packageData);
  //     } catch (error) {
  //       console.error("Encryption error:", error);
  //     }
  //   }
  // };

  const handleEncryptAndUpload = async () => {
    if (!fileData) {
      console.error("No file data to encrypt.");
      return;
    }
    
    try {
      // 1) Encrypt
      const password = "myTestPassword123";
      const { salt, iv, encryptedData } = await encryptionUtils.encryptData(
        fileData,
        password
      );
  
      // 2) Convert buffers to base64 for sending over JSON
      const packageData = {
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt),
        encryptedData: arrayBufferToBase64(encryptedData),  
        fileName,
        fileType,
      };
  
      // Update state if you still want to store it locally
      setEncryptedPackage(packageData);
  
      // 3) Get ID token from localStorage
      const idToken = localStorage.getItem("idToken");
      if (!idToken) {
        console.error("No ID token found in localStorage.");
        return;
      }
      
      // 4) Send encrypted data + ID token to your backend
      const response = await fetch("http://localhost:8080/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Put the token in the Authorization header
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(packageData),
      });
      
      if (!response.ok) {
        
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        return;
      }
      
      const data = await response.json();
      console.log("Upload successful:", data);
      // data might contain your "sub" or any server response
    } catch (error) {
      console.error("Encryption/Upload error:", error);
    }
  };

  // decrypt the file from R2 using the EncryptionUtils class
  const handleDecryptFile = async () => {
    // get variables needed to access object from R2 bucket
    const idToken = localStorage.getItem("idToken");
    if (!idToken) {
      console.error("No ID Token found in local storage.");
      return
    }
    const fileName = "04d8f4b8-1041-70e4-4a2a-fcb5edf1969b/HGIH WUALITY PFP.jpg"
    const packageData = {
      fileName
    };
  
    // Convert the stored Base64 values back to ArrayBuffers/Uint8Arrays
    try {
      const response = await fetch("http://localhost:8080/downloadPackage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Put the token in the Authorization header
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(packageData),
      });
    

      if (!response.ok) {
      
        const errorText = await response.text();
        console.error("Download of encrypted package failed:", errorText);
        return;
      }
      
      // Parse the response data
      const encryptedPackage = await response.json();
      console.log("Received package:", encryptedPackage);

      if (!encryptedPackage.iv || !encryptedPackage.salt || !encryptedPackage.encryptedData) {
      console.error("Incomplete encrypted package received:", encryptedPackage);
      return;
      }
      
      // Convert the base64 strings back to Uint8Arrays for iv and salt and ArrayBuffer for encryptedData
      const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
      const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
      const encryptedData = base64ToArrayBuffer(encryptedPackage.encryptedData);
      
      const password = "myTestPassword123";

       // Decrypt using the encryption utility
      const decryptedBuffer = await encryptionUtils.decryptData(
        encryptedData,
        password,
        salt,
        iv
      );
      
      setDecryptedData(decryptedBuffer);
      console.log("Decrypted file data:", new Uint8Array(decryptedBuffer).slice(0, 20)); // Just show a preview
      
      // Create a Blob from the decrypted data and generate a URL for display/download
      const blob = new Blob([decryptedBuffer], { type: encryptedPackage.fileType });
      const url = URL.createObjectURL(blob);
      setDecryptedFileUrl(url);

      } catch (error) {
        console.error("Decryption error:", error);
      }
  }
  


  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-100 to-gray-100">
      {/* Logout Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow gap-6">
        {/* File Upload Section */}
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Upload File</h2>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Select a file to encrypt:</label>
            <input
              type="file"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          {isFileSelected && (
            <p className="text-green-600 mb-4">
              File selected: {fileName}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={handleEncryptAndUpload}
            disabled={!fileData}
            className={`px-6 py-2 ${
              !fileData ? "bg-gray-300" : "bg-blue-500 hover:bg-blue-600"
            } text-white rounded-lg transition`}
          >
            Encrypt & Upload File
          </button>
          <button
            onClick={handleDecryptFile}
            disabled={!encryptedPackage}
            className={`px-6 py-2 ${
              !encryptedPackage ? "bg-gray-300" : "bg-gray-500 hover:bg-gray-600"
            } text-white rounded-lg transition`}
          >
            Decrypt File
          </button>
        </div>

        {/* Display decrypted file if available */}
        {decryptedFileUrl && (
          <div className="mt-6 bg-white p-6 rounded-lg shadow-md w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Decrypted File:</h2>
            {fileType.startsWith("image/") ? (
              <img
                src={decryptedFileUrl}
                alt="Decrypted"
                className="max-w-full h-auto"
              />
            ) : (
              <a
                href={decryptedFileUrl}
                download={fileName}
                className="text-blue-500 underline"
              >
                Download {fileName}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EncryptionPage;
