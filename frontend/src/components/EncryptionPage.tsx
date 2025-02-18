import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const EncryptionPage = () => {
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");

  interface EncryptedPackage {
    iv: string;
    salt: string;
    encryptedData: string;
    fileName: string;
    fileType: string;
  }

  const [encryptedPackage, setEncryptedPackage] =
    useState<EncryptedPackage | null>(null);
  const [decryptedData, setDecryptedData] = useState<ArrayBuffer | null>(null);
  const [decryptedFileUrl, setDecryptedFileUrl] = useState<string | null>(null);
  const subtle = globalThis.crypto.subtle;

  const navigate = useNavigate();

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
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

  const getPasswordKey = (password: string) => {
    const encoder = new TextEncoder();
    return encoder.encode(password);
  };

  const generateSalt = () => {
    const salt = new Uint8Array(16); // 16 bytes = 128 bits of salt
    globalThis.crypto.getRandomValues(salt);
    return salt;
  };

  const deriveKey = async (
    password: ArrayBuffer,
    salt: Uint8Array<ArrayBuffer>
  ) => {
    // Import the password as key material for PBKDF2
    const keyMaterial = await subtle.importKey(
      "raw",
      password, // ArrayBuffer from getPasswordKey
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  };

  const encryptData = async (key: CryptoKey, data: BufferSource) => {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      data
    );
    return { iv, encrypted: new Uint8Array(encrypted) };
  };

  const decryptData = async (
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    encryptedData: BufferSource
  ) => {
    const decrypted = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv, // Use the same IV that was used for encryption
      },
      key, // The AES key derived from PBKDF2
      encryptedData // The encrypted data (ArrayBuffer)
    );

    return decrypted; // Decrypted data (ArrayBuffer)
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setFileName(file.name); // Store file name
      setFileType(file.type); // Store MIME type
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target) {
          const arrayBuffer = e.target.result as ArrayBuffer;
          setFileData(arrayBuffer);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleEncryptFile = async () => {
    if (fileData) {
      const passwordKey = getPasswordKey("mySecurePassword123"); // Convert password
      const salt = generateSalt(); // Generate salt
      const aesKey = await deriveKey(passwordKey, salt); // Derive AES key

      // Encrypt the file data
      const { iv, encrypted } = await encryptData(aesKey, fileData);

      // Package encrypted data and metadata
      const encryptedPackage = {
        iv: arrayBufferToBase64(iv), // Encode iv to Base64
        salt: arrayBufferToBase64(salt), // Encode salt to Base64
        encryptedData: arrayBufferToBase64(encrypted.buffer), // Encode encrypted data to Base64
        fileName: fileName, // Include file name
        fileType: fileType, // Include MIME type
      };

      setEncryptedPackage(encryptedPackage);

      console.log("Encrypted package:", encryptedPackage);
      // You can now handle the encryptedPackage (e.g., save it, send it to a server, etc.)
    }
  };

  const handleDecryptFile = async () => {
    if (encryptedPackage) {
      const passwordKey = getPasswordKey("mySecurePassword123"); // Convert password

      // Decode Base64 strings back to ArrayBuffers
      const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
      const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
      const encryptedData = new Uint8Array(
        base64ToArrayBuffer(encryptedPackage.encryptedData)
      );

      const aesKey = await deriveKey(passwordKey, salt); // Derive AES key

      // Decrypt the file data
      const decrypted = await decryptData(aesKey, iv, encryptedData);

      setDecryptedData(decrypted);

      console.log("Decrypted file data:", new Uint8Array(decrypted));

      // Create a Blob from the decrypted data using the original MIME type
      const blob = new Blob([decrypted], { type: encryptedPackage.fileType });
      const url = URL.createObjectURL(blob);
      setDecryptedFileUrl(url);
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
