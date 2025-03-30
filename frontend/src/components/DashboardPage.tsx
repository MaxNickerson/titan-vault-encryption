// src/components/DashboardPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EncryptionUtils } from "../encryption/encryptionUtils";

//
// Utility to convert ArrayBuffer → base64
//
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
};

//
// Utility to convert base64 → ArrayBuffer
//
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

type ManifestEntry = {
  hash: string;
  fileName: string;
  fileType: string;
};


const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const encryptionUtils = new EncryptionUtils();

  // --------------------------------------------------
  // Modal states
  // --------------------------------------------------
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnterModal, setShowEnterModal] = useState(false);

  // --------------------------------------------------
  // Master password states
  // --------------------------------------------------
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  // --------------------------------------------------
  // File encryption states
  // --------------------------------------------------
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");

  // --------------------------------------------------
  // Example items in file list
  // --------------------------------------------------
  type ManifestEntry = {
    hash: string;
    fileName: string;
    fileType: string;
  };

  const [fileList, setFileList] = useState<ManifestEntry[]>([]);

  const loadManifest = async (): Promise<ManifestEntry[]> => {
    try {
      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) return [];

      const resp = await fetch("https://api.titanvaultencrypt.com/api/get-manifest", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!resp.ok) return [];

      const { encryptedData, iv } = await resp.json();

      const rawKey = Uint8Array.from(atob(base64Password), (c) => c.charCodeAt(0));
      const aesKey = await window.crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
        aesKey,
        base64ToArrayBuffer(encryptedData)
      );

      const decoded = new TextDecoder().decode(decrypted);
      const parsed: ManifestEntry[] = JSON.parse(decoded);
      setFileList(parsed);
      return parsed;
    } catch (err) {
      console.error("Manifest load failed:", err);
      return [];
    }
  };




  // Track which item is currently selected
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
    // Remove the derived key from localStorage
    localStorage.removeItem("masterPassword");
    navigate("/login");
  };

  // --------------------------------------------------
  // Toggle modals
  // --------------------------------------------------
  const openEncryptModal = () => {
    setFileData(null);
    setFileName("");
    setFileType("");
    setShowEncryptModal(true);
  };

  const closeEncryptModal = () => {
    setShowEncryptModal(false);
  };

  // --------------------------------------------------
  // Handle file selection
  // --------------------------------------------------
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

  // --------------------------------------------------
  // Encrypt & Upload
  // --------------------------------------------------
  const handleEncryptAndUpload = async () => {
    if (!fileData) {
      console.error("No file data to encrypt.");
      return;
    }

    try {
      const base64Password = localStorage.getItem("masterPassword");
      const idToken = localStorage.getItem("idToken");
      if (!base64Password || !idToken) {
        alert("You're not authenticated or unlocked.");
        return;
      }

      const password = atob(base64Password);
      const encryptedWithIv = await encryptionUtils.encryptFileWithIvPrepended(fileData, password);
      const hash = await encryptionUtils.hashString(fileName); // ✅ define hash here

      // Upload encrypted file (IV + data) to R2
      const uploadResp = await fetch("https://api.titanvaultencrypt.com/api/upload-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Authorization: `Bearer ${idToken}`,
          "x-file-name": hash,
        },
        body: encryptedWithIv,
      });

      if (!uploadResp.ok) {
        const errorText = await uploadResp.text();
        console.error("Upload failed:", errorText);
        return;
      }

      // === Manifest Update ===
      const currentManifest = await loadManifest(); // already defined globally
      const newEntry = { hash, fileName, fileType };
      const updatedManifest = [...currentManifest, newEntry];

      const manifestEncoded = new TextEncoder().encode(JSON.stringify(updatedManifest));
      const manifestIv = crypto.getRandomValues(new Uint8Array(12));

      const rawKey = Uint8Array.from(atob(base64Password), (c) => c.charCodeAt(0));
      const aesKey = await window.crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);

      const encryptedManifest = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: manifestIv },
        aesKey,
        manifestEncoded
      );

      await fetch("https://api.titanvaultencrypt.com/api/upload-manifest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          iv: arrayBufferToBase64(manifestIv),
          encryptedData: arrayBufferToBase64(encryptedManifest),
        }),
      });

      console.log("Upload + manifest updated!");
      closeEncryptModal();
    } catch (error) {
      console.error("Encryption/Upload error:", error);
    }
    await loadManifest();

  };




  // --------------------------------------------------
  // Item click => select for preview
  // --------------------------------------------------
  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName);
  };

  // --------------------------------------------------
  // Close preview
  // --------------------------------------------------
  const handleClosePreview = () => {
    setSelectedItem(null);
  };

  // --------------------------------------------------
  // Download file (future steps)
  // --------------------------------------------------
  const handleDownload = async () => {
    if (!selectedItem) {
      alert("Please select a file to download.");
      return;
    }

    try {
      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) throw new Error("Missing credentials");

      const entry = fileList.find((f) => f.fileName === selectedItem);
      if (!entry) throw new Error("File not found in manifest");

      const { hash, fileName } = entry;

      const response = await fetch(`https://api.titanvaultencrypt.com/api/get-file?hash=${hash}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const encryptedBlob = await response.blob();
      const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();

      const password = atob(base64Password);
      const decrypted = await encryptionUtils.decryptFileWithIvPrepended(encryptedArrayBuffer, password);

      const blob = new Blob([decrypted]);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    } catch (err) {
      console.error("Download/decryption error:", err);
      alert("Failed to decrypt or download file.");
    }
  };



  // --------------------------------------------------
  // On mount => check JWT + masterPassword
  // --------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem("idToken");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const hasMP = payload.hasMasterPassword === "true";
      const storedPass = localStorage.getItem("masterPassword");

      // If user has a master password set...
      if (hasMP) {
        // If we already have masterPassword in localStorage => skip modal
        if (storedPass) {
          setIsUnlocked(true);
        } else {
          // Otherwise, prompt user to enter existing master password
          setShowEnterModal(true);
        }
      } else {
        // No master password => create flow
        setShowCreateModal(true);
      }
    } catch (err) {
      console.error("Token decode error:", err);
      navigate("/login");
    }
  }, [navigate]);

  // --------------------------------------------------
  // Create Master Password
  // --------------------------------------------------
  const handleCreateMasterPassword = async () => {
    setModalError("");
    if (!newPassword || !confirmPassword) {
      setModalError("Both fields required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError("Passwords do not match.");
      return;
    }

    try {
      // 1) Encrypt the newly created master password => encryptedPassword
      const { encryptedKey, salt: passSalt, iv: passIv } =
        await encryptionUtils.encryptMasterKey(newPassword);

      // We'll rename 'encryptedKey' -> 'encryptedPassword' for clarity
      const encryptedPassword = encryptedKey;

      const toBase64 = (buf: ArrayBuffer | Uint8Array) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)));

      // Prepare the data to store in R2
      const masterPasswordPayload = {
        encryptedPassword: toBase64(encryptedPassword),
        salt: toBase64(passSalt),
        iv: toBase64(passIv),
      };

      // 2) Also store a usable local version
      const passwordKey = encryptionUtils.getPasswordKey(newPassword);
      const derivedKey = await encryptionUtils.deriveKey(passwordKey, passSalt);
      const rawKey = await window.crypto.subtle.exportKey("raw", derivedKey);
      const base64Password = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      localStorage.setItem("masterPassword", base64Password);

      // 3) Upload masterPassword.enc to your Worker at /store-masterpassword
      const idToken = localStorage.getItem("idToken");
      if (idToken) {
        const uploadResp = await fetch("https://api.titanvaultencrypt.com/api/store-masterpassword", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(masterPasswordPayload),
        });

        if (!uploadResp.ok) {
          const errorText = await uploadResp.text();
          console.error("Failed to store encrypted masterPassword:", errorText);
        } else {
          console.log("MasterPassword securely stored in R2!");
        }

        // 4) Update Cognito attribute => hasMasterPassword = true
        const updateResp = await fetch("https://api.titanvaultencrypt.com/api/get-masterpassword", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!updateResp.ok) {
          console.error("Failed to update hasMasterPassword in Cognito");
        } else {
          console.log("Cognito user attribute updated to hasMasterPassword = true");
        }
      }

      // Done => close modal, unlock
      setShowCreateModal(false);
      setIsUnlocked(true);
      await loadManifest();
    } catch (err) {
      setModalError("Error creating master password.");
      console.error(err);
    }
  };

  // --------------------------------------------------
  // Enter Master Password => fetch & decrypt masterPassword.enc
  // --------------------------------------------------
  const handleEnterMasterPassword = async () => {
    setModalError("");
    if (!existingPassword) {
      setModalError("Please enter your master password.");
      return;
    }

    try {
      // 1) Get token
      const idToken = localStorage.getItem("idToken");
      if (!idToken) throw new Error("No ID token found.");

      // 2) Fetch stored masterPassword package from R2
      const resp = await fetch("https://api.titanvaultencrypt.com/api/get-masterpassword", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!resp.ok) throw new Error("Failed to retrieve master password from server");

      const data = await resp.json();

      // Convert base64 fields
      const encryptedPasswordBuf = base64ToArrayBuffer(data.encryptedPassword);
      const salt = new Uint8Array(base64ToArrayBuffer(data.salt));
      const iv = new Uint8Array(base64ToArrayBuffer(data.iv));

      // 3) Decrypt masterPassword using user's password
      const decrypted = await encryptionUtils.decryptMasterKey(
        encryptedPasswordBuf,
        existingPassword,
        salt,
        iv
      );

      // 4) Import raw decrypted password => store as base64
      const derivedKey = await window.crypto.subtle.importKey(
        "raw",
        decrypted,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      const rawKey = await window.crypto.subtle.exportKey("raw", derivedKey);
      const base64Password = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      localStorage.setItem("masterPassword", base64Password);

      // Done => close modal, unlock
      setShowEnterModal(false);
      setIsUnlocked(true);
      await loadManifest();
    } catch (err) {
      console.error("MasterPassword decryption failed:", err);
      setModalError("Incorrect master password.");
    }

  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-100 to-gray-100">
      {/* ------------------------------------------------
          Top bar 
      ------------------------------------------------ */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* ------------------------------------------------
          Main content 
      ------------------------------------------------ */}
      <div className="flex flex-col items-center justify-center flex-grow gap-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        {/* Two-box layout: left list, right preview */}
        <div className="flex flex-row space-x-4">
          {/* LEFT BOX: File list */}
          <div className="bg-white p-6 rounded-lg shadow-md w-80">
            <h2 className="text-xl font-semibold mb-4">Your Files</h2>
            <ul className="space-y-2">
              {fileList.map((item) => (
                <li key={item.hash}>
                  <button onClick={() => handleItemClick(item.fileName)}>{item.fileName}</button>
                </li>
              ))}

            </ul>
          </div>

          {/* RIGHT BOX: file preview if selected */}
          {selectedItem && (
            <div className="bg-white p-6 rounded-lg shadow-md w-80 relative">
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

        {/* Buttons row: Encrypt & Upload / Download */}
        <div className="flex space-x-4">
          <button
            onClick={openEncryptModal}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Encrypt & Upload
          </button>
          <button
            onClick={handleDownload}
            disabled={!selectedItem}
            className={`px-6 py-2 ${!selectedItem ? "bg-gray-300" : "bg-green-500 hover:bg-green-600"} text-white rounded-lg transition`}
          >
            Download
          </button>

        </div>
      </div>

      {/* ------------------------------------------------
          Modal: Encrypt & Upload
      ------------------------------------------------ */}
      {showEncryptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-md w-96">
            <h2 className="text-xl font-bold mb-4">Encrypt & Upload</h2>
            <input type="file" onChange={handleFileUpload} className="mb-4" />
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleEncryptAndUpload}
                disabled={!fileData}
                className={`px-4 py-2 ${!fileData ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"
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

      {/* ------------------------------------------------
          Modal: Create Master Password
      ------------------------------------------------ */}
      {showCreateModal && !isUnlocked && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-md w-96">
            <h2 className="text-xl font-bold mb-4">Create Master Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              WARNING: If you lose this password, your data can't be recovered.
            </p>
            <input
              type="password"
              placeholder="Enter new master password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full mb-2 px-3 py-2 border border-gray-300 rounded"
            />
            <input
              type="password"
              placeholder="Confirm master password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-gray-300 rounded"
            />
            {modalError && <p className="text-red-500 mb-2">{modalError}</p>}

            <div className="flex justify-end">
              <button
                onClick={handleCreateMasterPassword}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------
          Modal: Enter Master Password
      ------------------------------------------------ */}
      {showEnterModal && !isUnlocked && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-md w-96">
            <h2 className="text-xl font-bold mb-4">Enter Master Password</h2>
            <p className="text-sm text-gray-500 mb-4">
              Unlock your user files with your existing master password.
            </p>
            <input
              type="password"
              placeholder="Enter master password"
              value={existingPassword}
              onChange={(e) => setExistingPassword(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-gray-300 rounded"
            />
            {modalError && <p className="text-red-500 mb-2">{modalError}</p>}

            <div className="flex justify-end">
              <button
                onClick={handleEnterMasterPassword}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
