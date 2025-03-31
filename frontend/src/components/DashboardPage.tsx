// ======================
// src/components/DashboardPage.tsx
// ======================
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EncryptionUtils } from "../encryption/encryptionUtils";

/**
 * Convert ArrayBuffer → base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}

/**
 * Convert base64 → ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Manifest Entry Type
 */
type ManifestEntry = {
  hash: string;
  fileName: string;
  fileType: string;
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const encryptionUtils = new EncryptionUtils();

  // ---------------------- State ----------------------
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnterModal, setShowEnterModal] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [fileList, setFileList] = useState<ManifestEntry[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // ======================================
  // 1) Load Manifest (Decryption)
  // ======================================
  const loadManifest = async (): Promise<ManifestEntry[]> => {
    try {
      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) return [];

      // Fetch the encrypted manifest from your API
      const resp = await fetch("https://api.titanvaultencrypt.com/api/manifest", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) {
        // If there's no manifest, handle gracefully or return []
        return [];
      }

      const combined = await resp.arrayBuffer();
      if (combined.byteLength === 0) {
        // Empty response => treat as empty manifest
        return [];
      }

      // PBKDF2 Decryption ([salt(16) + iv(12) + ciphertext])
      const password = atob(base64Password);
      const decryptedBuffer = await encryptionUtils.decryptDataWithSaltAndIv(combined, password);

      const decoded = new TextDecoder().decode(decryptedBuffer);
      const parsed: ManifestEntry[] = JSON.parse(decoded);
      setFileList(parsed);
      return parsed;
    } catch (err) {
      console.error("Manifest load failed:", err);
      return [];
    }
  };

  // ======================================
  // 2) On mount => Check JWT & masterPassword
  // ======================================
  useEffect(() => {
    const token = localStorage.getItem("idToken");
    if (!token) return navigate("/login");

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const hasMP = payload["custom:hasMasterPassword"] === "true";
      const storedPass = localStorage.getItem("masterPassword");

      if (hasMP && storedPass) {
        setIsUnlocked(true);
        // Optionally load the manifest right away
        loadManifest();
      } else if (hasMP) {
        setShowEnterModal(true);
      } else {
        setShowCreateModal(true);
      }
    } catch (err) {
      console.error("Token decode error:", err);
      navigate("/login");
    }
  }, [navigate]);

  // ======================================
  // 3) Create Master Password
  // ======================================
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
      // 1) Generate random 256-bit key
      const randomMasterKey = encryptionUtils.generateRandomMasterKey();

      // 2) Encrypt that key using user’s typed password => wrapper approach
      const { encryptedKey, salt, iv } = await encryptionUtils.encryptMasterKeyWithWrapper(
        randomMasterKey,
        newPassword
      );

      // Convert to Base64 for sending
      const toBase64 = (buf: ArrayBuffer | Uint8Array) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)));

      const masterPasswordPayload = {
        encryptedPassword: toBase64(encryptedKey),
        salt: toBase64(salt),
        iv: toBase64(iv),
      };

      // 3) Also store the 256-bit key in localStorage (base64)
      const keyObj = await crypto.subtle.importKey("raw", randomMasterKey, { name: "AES-GCM" }, true, [
        "encrypt",
        "decrypt",
      ]);
      const rawKey = await crypto.subtle.exportKey("raw", keyObj);
      const base64MasterKey = toBase64(rawKey);
      localStorage.setItem("masterPassword", base64MasterKey);

      // 4) Send to Worker => store-masterpassword
      const idToken = localStorage.getItem("idToken");
      if (!idToken) throw new Error("Missing ID token");

      const uploadResp = await fetch("https://api.titanvaultencrypt.com/api/store-masterpassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(masterPasswordPayload),
      });

      if (!uploadResp.ok) {
        const text = await uploadResp.text();
        throw new Error(`❌ Store failed: ${text}`);
      }

      // success
      setShowCreateModal(false);
      setIsUnlocked(true);
      await loadManifest();
    } catch (err) {
      setModalError("Error creating master password.");
      console.error("❌ Master password creation error:", err);
    }
  };

  // ======================================
  // 4) Enter Existing Master Password
  // ======================================
  const handleEnterMasterPassword = async () => {
    setModalError("");
    if (!existingPassword) {
      setModalError("Please enter your master password.");
      return;
    }

    try {
      const idToken = localStorage.getItem("idToken");
      if (!idToken) throw new Error("Missing ID token");

      const resp = await fetch("https://api.titanvaultencrypt.com/api/get-masterpassword", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!resp.ok) throw new Error("Failed to retrieve encrypted key from R2");
      const data = await resp.json();

      // Convert base64 => ArrayBuffer
      const base64ToBuf = (b64: string) => {
        const bin = window.atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const encryptedPasswordBuf = base64ToBuf(data.encryptedPassword);
      const salt = new Uint8Array(base64ToBuf(data.salt));
      const iv = new Uint8Array(base64ToBuf(data.iv));

      // Decrypt 256-bit master key
      const randomMasterKey = await encryptionUtils.decryptMasterKeyWithWrapper(
        encryptedPasswordBuf,
        existingPassword,
        salt,
        iv
      );

      // Store in localStorage as base64
      const keyObj = await crypto.subtle.importKey("raw", randomMasterKey, { name: "AES-GCM" }, true, [
        "encrypt",
        "decrypt",
      ]);
      const rawKey = await crypto.subtle.exportKey("raw", keyObj);
      const base64MasterKey = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      localStorage.setItem("masterPassword", base64MasterKey);

      setShowEnterModal(false);
      setIsUnlocked(true);
      await loadManifest();
    } catch (err) {
      console.error("MasterPassword decryption failed:", err);
      setModalError("Incorrect master password.");
    }
  };

  // ======================================
  // 5) Handle File Selection
  // ======================================
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

  // ======================================
  // 6) Encrypt & Upload File (PBKDF2 w/ salt + IV)
  // ======================================
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

      // ------------------------------------------------
      // [A] ENCRYPT THE FILE
      // ------------------------------------------------
      const password = atob(base64Password); // your PBKDF2 password
      // 1) Encrypt data => [salt(16) + iv(12) + ciphertext]
      const encryptedFile = await encryptionUtils.encryptDataWithSaltAndIv(fileData, password);

      // 2) Generate a hash for the R2 key
      const hash = await encryptionUtils.hashString(fileName);

      // 3) Upload that file to R2
      const uploadResp = await fetch("https://api.titanvaultencrypt.com/api/upload-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Authorization: `Bearer ${idToken}`,
          "X-file-name": hash,
        },
        body: encryptedFile, // raw binary [salt + iv + ciphertext]
      });
      if (!uploadResp.ok) {
        const errorText = await uploadResp.text();
        console.error("Upload failed:", errorText);
        return;
      }

      // ------------------------------------------------
      // [B] UPDATE & RE-ENCRYPT THE MANIFEST
      // ------------------------------------------------
      const currentManifest = await loadManifest();
      const newEntry = { hash, fileName, fileType };
      const updatedManifest = [...currentManifest, newEntry];
      const manifestJson = JSON.stringify(updatedManifest);
      const manifestBytes = new TextEncoder().encode(manifestJson);

      // Encrypt manifest => [salt + iv + ciphertext]
      const encryptedManifest = await encryptionUtils.encryptDataWithSaltAndIv(manifestBytes, password);

      // 4) Upload the new manifest
      const manifestResp = await fetch("https://api.titanvaultencrypt.com/api/upload-manifest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: encryptedManifest,
      });
      if (!manifestResp.ok) {
        console.error("Manifest upload failed:", await manifestResp.text());
        return;
      }

      console.log("Upload + manifest updated!");
      closeEncryptModal();

      // 5) Reload the updated manifest
      await loadManifest();
    } catch (error) {
      console.error("Encryption/Upload error:", error);
    }
  };

  // ======================================
  // 7) Download File (Decryption)
  // ======================================
  const handleDownload = async () => {
    if (!selectedItem) {
      alert("Please select a file to download.");
      return;
    }

    try {
      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) throw new Error("Missing credentials");

      // Find the matching manifest entry
      const entry = fileList.find((f) => f.fileName === selectedItem);
      if (!entry) throw new Error("File not found in manifest");
      const { hash, fileName } = entry;

      // Fetch the raw encrypted file from R2
      const response = await fetch(`https://api.titanvaultencrypt.com/api/file?hash=${hash}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error("Download failed");

      // Convert to ArrayBuffer
      const encryptedBlob = await response.blob();
      const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();

      // Decrypt => [salt + iv + ciphertext]
      const password = atob(base64Password);
      const decrypted = await encryptionUtils.decryptDataWithSaltAndIv(encryptedArrayBuffer, password);

      // Create a Blob + auto-download
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

  // ======================================
  // 8) Preview / Select File
  // ======================================
  const handleItemClick = (itemName: string) => setSelectedItem(itemName);
  const handleClosePreview = () => setSelectedItem(null);

  // ======================================
  // 9) Logout
  // ======================================
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
    localStorage.removeItem("masterPassword");
    navigate("/login");
  };
  const closeEncryptModal = () => {
    setShowEncryptModal(false);
  };

  // ======================================
  // Render
  // ======================================
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-100 to-gray-100">
      {/* ~~~ Top Bar ~~~ */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* ~~~ Main Content ~~~ */}
      <div className="flex flex-col items-center justify-center flex-grow gap-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        {/* Two-box layout: left list, right preview */}
        <div className="flex flex-row space-x-4">
          {/* Left box: file list */}
          <div className="bg-white p-6 rounded-lg shadow-md w-80">
            <h2 className="text-xl font-semibold mb-4">Your Files</h2>
            <ul className="space-y-2">
              {fileList.map((item) => (
                <li key={item.hash}>
                  <button onClick={() => handleItemClick(item.fileName)}>
                    {item.fileName}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Right box: file preview if selected */}
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

        {/* Buttons row: Encrypt & Upload, Download */}
        <div className="flex space-x-4">
          <button
            onClick={() => setShowEncryptModal(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Encrypt & Upload
          </button>
          <button
            onClick={handleDownload}
            disabled={!selectedItem}
            className={`px-6 py-2 ${
              !selectedItem ? "bg-gray-300" : "bg-green-500 hover:bg-green-600"
            } text-white rounded-lg transition`}
          >
            Download
          </button>
        </div>
      </div>

      {/* ~~~ Modal: Encrypt & Upload ~~~ */}
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

      {/* ~~~ Modal: Create Master Password ~~~ */}
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

      {/* ~~~ Modal: Enter Master Password ~~~ */}
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
