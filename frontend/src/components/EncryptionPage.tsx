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

  const handleEncryptFile = async () => {
    if(fileData) {
      try {
        const password = "myTestPassword123"
        // call the utility class
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
        setEncryptedPackage(packageData);
        console.log("Encrypted package:", packageData);
      } catch (error) {
        console.error("Encryption error:", error);
      }
    }
  };

  // Decrypt the file using the EncryptionUtils class
  const handleDecryptFile = async () => {
    if (encryptedPackage) {
      try {
        const password = "myTestPassword123";
        // Convert the stored Base64 values back to ArrayBuffers/Uint8Arrays
        const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
        const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
        const encryptedData = base64ToArrayBuffer(encryptedPackage.encryptedData);

        // Decrypt using the encryption utility
        const decryptedBuffer = await encryptionUtils.decryptData(
          encryptedData,
          password,
          salt,
          iv
        );
        setDecryptedData(decryptedBuffer);
        console.log("Decrypted file data:", new Uint8Array(decryptedBuffer));

        // Create a Blob from the decrypted data and generate a URL for display/download
        const blob = new Blob([decryptedBuffer], { type: encryptedPackage.fileType });
        const url = URL.createObjectURL(blob);
        setDecryptedFileUrl(url);
      } catch (error) {
        console.error("Decryption error:", error);
      }
    }
  };


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
      <div className="flex items-center justify-center flex-grow">
        <div className="w-1/2 flex flex-col justify-center items-center p-8 bg-white rounded-lg">
          <h1 className="text-3xl font-bold mb-6">Upload & Encrypt File</h1>
          <input
            type="file"
            onChange={handleFileUpload}
            className="mb-4 border border-gray-300 rounded-lg p-2 w-full"
          />
          <div className="flex space-x-4">
            <button
              onClick={handleEncryptFile}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Encrypt File
            </button>
            <button
              onClick={handleDecryptFile}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Decrypt File
            </button>
          </div>

          {decryptedFileUrl && (
            <div className="mt-6">
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
    </div>
  );
};

export default EncryptionPage;
