// ======================
// src/components/DashboardPage.tsx
// ======================
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EncryptionUtils } from "../encryption/encryptionUtils";
import {
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession
} from "amazon-cognito-identity-js";

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
function base64UrlDecode(b64url: string): string {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return atob(padded);
}

/**
 * Manifest Entry Type
 */
type ManifestEntry = {
  hash: string;
  fileName: string;
  fileType: string;
};

/** Wrap CognitoUser.getSession() in a Promise so we can await it. */
function getSessionPromise(user: CognitoUser): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    user.getSession(
      (error: Error | null, session: CognitoUserSession | null) => {
        if (error || !session) {
          reject(error || new Error("Invalid session"));
        } else {
          resolve(session);
        }
      }
    );
  });
}

/** Wrap changePassword() in a Promise so we can await it. */
function changePasswordPromise(
  user: CognitoUser,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    user.changePassword(oldPassword, newPassword, (errChange?: Error) => {
      if (errChange) {
        reject(errChange);
      } else {
        resolve();
      }
    });
  });
}

/** Wrap deleteUser() in a Promise so we can await it. */
function deleteUserPromise(user: CognitoUser): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    user.deleteUser((errDel?: Error, result?: string) => {
      if (errDel) {
        reject(errDel);
      } else {
        resolve(result);
      }
    });
  });
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const encryptionUtils = new EncryptionUtils();

  // ---------------------- State ----------------------
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnterModal, setShowEnterModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // For creating/entering the Master Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [existingPassword, setExistingPassword] = useState("");
  const [modalError, setModalError] = useState("");

  // File data for encryption/upload
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [fileList, setFileList] = useState<ManifestEntry[]>([]);

  // Selected file + preview
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ------- Account Settings (new) -------
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [oldPassword, setOldPassword] = useState(""); // for Cognito password change
  const [confirmationText, setConfirmationText] = useState(""); // for account deletion

  // ======================================
  // [A] Load Manifest (Decryption)
  // ======================================
  const loadManifest = async (): Promise<ManifestEntry[]> => {
    try {
      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) return [];

      const resp = await fetch("https://api.titanvaultencrypt.com/api/manifest", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) {
        // If there's no manifest yet, just return []
        return [];
      }

      const combined = await resp.arrayBuffer();
      if (combined.byteLength === 0) {
        // Empty => no files
        return [];
      }

      const password = atob(base64Password);
      const decryptedBuffer = await encryptionUtils.decryptDataWithSaltAndIv(
        combined,
        password
      );
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
  // [B] On mount => Check JWT & masterPassword
  // ======================================
  useEffect(() => {
    const token = localStorage.getItem("idToken");
    if (!token) {
      return navigate("/login");
    }
  
    try {
      const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
      const hasMP = payload["custom:hasMasterPassword"] === "true";
      const storedPass = localStorage.getItem("masterPassword");
  
      if (hasMP && storedPass) {
        setIsUnlocked(true);
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
  // [C] Create Master Password (one-time)
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
      const { encryptedKey, salt, iv } =
        await encryptionUtils.encryptMasterKeyWithWrapper(
          randomMasterKey,
          newPassword
        );

      // Convert to Base64 for sending to backend
      const toBase64 = (buf: ArrayBuffer | Uint8Array) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)));

      const masterPasswordPayload = {
        encryptedPassword: toBase64(encryptedKey),
        salt: toBase64(salt),
        iv: toBase64(iv),
      };

      // 3) Store the 256-bit key locally
      const keyObj = await crypto.subtle.importKey(
        "raw",
        randomMasterKey,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );
      const rawKey = await crypto.subtle.exportKey("raw", keyObj);
      const base64MasterKey = toBase64(rawKey);
      localStorage.setItem("masterPassword", base64MasterKey);

      // 4) Send to Worker => store-masterpassword
      const idToken = localStorage.getItem("idToken");
      if (!idToken) throw new Error("Missing ID token");

      const uploadResp = await fetch(
        "https://api.titanvaultencrypt.com/api/store-masterpassword",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(masterPasswordPayload),
        }
      );

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
  // [D] Enter Existing Master Password
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

      const resp = await fetch(
        "https://api.titanvaultencrypt.com/api/get-masterpassword",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

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
      const randomMasterKey =
        await encryptionUtils.decryptMasterKeyWithWrapper(
          encryptedPasswordBuf,
          existingPassword,
          salt,
          iv
        );

      // Store in localStorage as base64
      const keyObj = await crypto.subtle.importKey(
        "raw",
        randomMasterKey,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );
      const rawKey = await crypto.subtle.exportKey("raw", keyObj);
      const base64MasterKey = btoa(
        String.fromCharCode(...new Uint8Array(rawKey))
      );
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
  // [E] File Selection
  // ======================================
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (file.size > MAX_FILE_SIZE) {
        alert("File is too large. Max file size is 15MB.");
        return;
      }

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
  // [F] Encrypt & Upload
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

      // 1) Encrypt the file => [salt + iv + ciphertext]
      const password = atob(base64Password);
      const encryptedFile = await encryptionUtils.encryptDataWithSaltAndIv(
        fileData,
        password
      );

      // 2) Generate a hash for R2 key
      const hash = await encryptionUtils.hashString(fileName);

      // 3) Upload file to R2
      const uploadResp = await fetch(
        "https://api.titanvaultencrypt.com/api/upload-file",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            Authorization: `Bearer ${idToken}`,
            "X-file-name": hash,
          },
          body: encryptedFile,
        }
      );
      if (!uploadResp.ok) {
        const errorText = await uploadResp.text();
        console.error("Upload failed:", errorText);
        return;
      }

      // 4) Update & re-encrypt manifest
      const currentManifest = await loadManifest();
      const newEntry = { hash, fileName, fileType };
      const updatedManifest = [...currentManifest, newEntry];
      const manifestJson = JSON.stringify(updatedManifest);
      const manifestBytes = new TextEncoder().encode(manifestJson);

      const encryptedManifest = await encryptionUtils.encryptDataWithSaltAndIv(
        manifestBytes,
        password
      );

      // 5) Upload new manifest
      const manifestResp = await fetch(
        "https://api.titanvaultencrypt.com/api/upload-manifest",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/octet-stream",
          },
          body: encryptedManifest,
        }
      );
      if (!manifestResp.ok) {
        console.error("Manifest upload failed:", await manifestResp.text());
        return;
      }

      console.log("Upload + manifest updated!");
      closeEncryptModal();
      await loadManifest();
    } catch (error) {
      console.error("Encryption/Upload error:", error);
    }
  };

  // ======================================
  // [G] Download (Decrypt)
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

      // 1) Get the matching entry
      const entry = fileList.find((f) => f.fileName === selectedItem);
      if (!entry) throw new Error("File not found in manifest");
      const { hash, fileName } = entry;

      // 2) Fetch the raw encrypted file
      const response = await fetch(
        `https://api.titanvaultencrypt.com/api/file?hash=${hash}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );
      if (!response.ok) throw new Error("Download failed");

      const encryptedBlob = await response.blob();
      const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();

      // 3) Decrypt => [salt + iv + ciphertext]
      const password = atob(base64Password);
      const decrypted = await encryptionUtils.decryptDataWithSaltAndIv(
        encryptedArrayBuffer,
        password
      );

      // 4) Create a Blob + auto-download
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
  // [H] Delete a Single File
  // ======================================
  const handleDeleteFile = async (fileHash: string) => {
    try {
      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) {
        alert("Not authenticated or unlocked.");
        return;
      }

      // 1) Delete file from R2
      const deleteResp = await fetch(
        "https://api.titanvaultencrypt.com/api/delete-file",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ hash: fileHash }),
        }
      );
      if (!deleteResp.ok) {
        const errText = await deleteResp.text();
        throw new Error("File delete failed: " + errText);
      }

      // 2) Remove file from local manifest, re-encrypt, and re-upload
      const password = atob(base64Password);

      const newManifest = fileList.filter((f) => f.hash !== fileHash);
      setFileList(newManifest);

      const manifestJson = JSON.stringify(newManifest);
      const manifestBytes = new TextEncoder().encode(manifestJson);
      const encryptedManifest =
        await encryptionUtils.encryptDataWithSaltAndIv(manifestBytes, password);

      // 3) Upload updated manifest
      const manifestResp = await fetch(
        "https://api.titanvaultencrypt.com/api/upload-manifest",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/octet-stream",
          },
          body: encryptedManifest,
        }
      );
      if (!manifestResp.ok) {
        const err2 = await manifestResp.text();
        throw new Error("Manifest upload failed: " + err2);
      }

      alert("File deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Could not delete file.");
    }
  };

// ======================================
// [I] Preview / Select File
// ======================================
const handleItemClick = (itemName: string) => setSelectedItem(itemName);
const handleClosePreview = () => setSelectedItem(null);

useEffect(() => {
  console.log("[PreviewEffect] Triggered. selectedItem =", selectedItem);

  // 1) If nothing is selected, clear everything
  if (!selectedItem) {
    console.log("[PreviewEffect] No file selected, resetting states.");
    setPreviewUrl(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
    return;
  }

  // 2) Check if it's an image or video
  const isImage = !!selectedItem.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/);
  const isVideo = !!selectedItem.toLowerCase().match(/\.(mp4|webm|ogg)$/);

  if (!isImage && !isVideo) {
    console.log("[PreviewEffect] Not a previewable type, skipping.");
    setPreviewUrl(null);
    setPreviewError(null);
    return;
  }

  // 3) Asynchronous fetch + decrypt
  (async () => {
    console.log("[PreviewEffect] Starting fetch/decrypt for:", selectedItem);
    try {
      setIsPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);

      const idToken = localStorage.getItem("idToken");
      const base64Password = localStorage.getItem("masterPassword");
      if (!idToken || !base64Password) {
        console.log("[PreviewEffect] Missing token or master password.");
        throw new Error("Not unlocked or missing credentials.");
      }

      // 4) Find the manifest entry
      const entry = fileList.find((f) => f.fileName === selectedItem);
      if (!entry) {
        console.log("[PreviewEffect] Not found in manifest:", selectedItem);
        throw new Error("File not found in manifest.");
      }

      const { hash, fileType } = entry;
      console.log("[PreviewEffect] Found entry, hash =", hash, "type =", fileType);

      // 5) Fetch
      const resp = await fetch(`https://api.titanvaultencrypt.com/api/file?hash=${hash}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!resp.ok) {
        console.log("[PreviewEffect] Fetch error. Status =", resp.status);
        throw new Error("Failed to load file for preview.");
      }

      const encryptedBlob = await resp.blob();
      console.log("[PreviewEffect] Fetched encrypted blob. size =", encryptedBlob.size);

      // 6) Convert to ArrayBuffer + Decrypt
      const encryptedBuffer = await encryptedBlob.arrayBuffer();
      const password = atob(base64Password);
      console.log("[PreviewEffect] Starting decryption...");
      const decrypted = await encryptionUtils.decryptDataWithSaltAndIv(encryptedBuffer, password);
      console.log("[PreviewEffect] Decryption complete. Decrypted bytes length =", decrypted.byteLength);

      // 7) Create object URL
      const previewBlob = new Blob([decrypted], {
        type: fileType || "application/octet-stream",
      });
      const url = URL.createObjectURL(previewBlob);
      console.log("[PreviewEffect] Created object URL:", url);

      // 8) Update state with the new URL
      setPreviewUrl(url);
    } catch (err: any) {
      console.error("[PreviewEffect] Error during preview:", err);
      setPreviewError(err.message || "Preview failed.");
    } finally {
      setIsPreviewLoading(false);
      console.log("[PreviewEffect] Done. isPreviewLoading = false.");
    }
  })();
}, [selectedItem]);

// Cleanup old object URLs
useEffect(() => {
  return () => {
    if (previewUrl) {
      console.log("[PreviewEffect-Cleanup] Revoking old preview URL:", previewUrl);
      URL.revokeObjectURL(previewUrl);
    }
  };
}, [previewUrl]);



  // ======================================
  // [J] Logout
  // ======================================
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
    localStorage.removeItem("masterPassword");
    navigate("/login");
  };

// ======================================
// [K] Cognito Change Password (async)
const handleChangePassword = async () => {
  console.log("[handleChangePassword] Called.");

  // Basic form validations
  if (!newPassword || !confirmPassword) {
    console.log("[handleChangePassword] Missing new or confirm password.");
    alert("Please fill out new password fields.");
    return;
  }
  if (newPassword !== confirmPassword) {
    console.log("[handleChangePassword] Passwords do not match.");
    alert("New passwords do not match.");
    return;
  }
  if (!oldPassword) {
    console.log("[handleChangePassword] Missing old (current) password.");
    alert("Please enter your current password.");
    return;
  }

  // Debug logs for environment variables:
  console.log("[handleChangePassword] REACT_APP_COGNITO_USER_POOL_ID =", process.env.REACT_APP_COGNITO_USER_POOL_ID);
  console.log("[handleChangePassword] REACT_APP_COGNITO_APP_CLIENT_ID =", process.env.REACT_APP_COGNITO_APP_CLIENT_ID);
  console.log("[handleChangePassword] REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE);

  const poolData = {
    UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || "",
    ClientId: process.env.REACT_APP_COGNITO_APP_CLIENT_ID || "",
  };
  console.log("[handleChangePassword] poolData =", poolData);

  const username = localStorage.getItem("email") || "";
  console.log("[handleChangePassword] username =", username);

  const userPool = new CognitoUserPool(poolData);
  const user = new CognitoUser({ Username: username, Pool: userPool });

  try {
    console.log("[handleChangePassword] Attempting getSessionPromise...");
    await getSessionPromise(user);

    console.log("[handleChangePassword] Attempting changePasswordPromise...");
    await changePasswordPromise(user, oldPassword, newPassword);

    console.log("[handleChangePassword] Password change success!");
    alert("Password changed successfully!");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  } catch (error: any) {
    console.error("[handleChangePassword] Password change failed:", error);
    alert("Password change failed: " + error.message);
  }
};

// ======================================
// [L] Cognito Delete Entire Account & R2 data (async)
const handleDeleteAccount = async () => {
  console.log("[handleDeleteAccount] Called.");

  // Debug logs for environment variables:
  console.log("[handleDeleteAccount] REACT_APP_COGNITO_USER_POOL_ID =", process.env.REACT_APP_COGNITO_USER_POOL_ID);
  console.log("[handleDeleteAccount] REACT_APP_COGNITO_APP_CLIENT_ID =", process.env.REACT_APP_COGNITO_APP_CLIENT_ID);
  console.log("[handleDeleteAccount] REACT_APP_API_BASE =", process.env.REACT_APP_API_BASE);

  const poolData = {
    UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || "",
    ClientId: process.env.REACT_APP_COGNITO_APP_CLIENT_ID || "",
  };
  console.log("[handleDeleteAccount] poolData =", poolData);

  const username = localStorage.getItem("email") || "";
  console.log("[handleDeleteAccount] username =", username);

  const user = new CognitoUser({
    Username: username,
    Pool: new CognitoUserPool(poolData),
  });

  try {
    console.log("[handleDeleteAccount] Attempting getSessionPromise...");
    const session = await getSessionPromise(user);

    console.log("[handleDeleteAccount] Attempting deleteUserPromise...");
    await deleteUserPromise(user);

    // 3) Optional: remove user data from R2
    console.log("[handleDeleteAccount] Attempting to DELETE /api/delete-userdata...");
    await fetch("https://api.titanvaultencrypt.com/api/delete-userdata", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.getIdToken().getJwtToken()}`,
      },
    });

    console.log("[handleDeleteAccount] R2 user data deleted. Clearing localStorage...");
    localStorage.clear();
    navigate("/");
  } catch (errDel: any) {
    console.error("[handleDeleteAccount] Account deletion failed:", errDel);
    alert("Account deletion failed: " + errDel.message);
  }
};


  // --------------------------------------
  // Helpers for modals
  // --------------------------------------
  const closeEncryptModal = () => setShowEncryptModal(false);

  // ======================================
  // Render
  // ======================================
  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-100 to-gray-100">
      {/* ~~~ Top Bar ~~~ */}
      <div className="flex justify-end p-4 space-x-2">
        {/* Account Settings Button */}
        <button
          onClick={() => setShowAccountSettings(true)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Account Settings
        </button>
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
            <ul className="space-y-3">
              {fileList.map((item) => (
                <li key={item.hash} className="flex justify-between items-center">
                  <button
                    onClick={() => handleItemClick(item.fileName)}
                    className="text-blue-600 underline"
                  >
                    {item.fileName}
                  </button>
                  {/* Delete file button */}
                  <button
                    onClick={() => handleDeleteFile(item.hash)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
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
              <div className="my-4 border rounded-lg p-2 min-h-[200px] flex items-center justify-center">
                {isPreviewLoading ? (
                  <p className="text-gray-500">Loading preview...</p>
                ) : previewError ? (
                  <p className="text-red-500 text-sm">{previewError}</p>
                ) : previewUrl ? (
                  selectedItem.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/) ? (
                    <img
                      src={previewUrl}
                      alt="File preview"
                      className="max-w-full max-h-[300px] object-contain"
                    />
                  ) : selectedItem.toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
                    <video controls className="max-w-full max-h-[300px]">
                      <source src={previewUrl} />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-600 mb-2">Preview not available</p>
                      <p className="text-xs text-gray-500">This file type cannot be previewed</p>
                    </div>
                  )
                ) : (
                  <p className="text-gray-500">No preview available</p>
                )}
              </div>
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
            <p className="text-sm text-gray-500 mb-4">Maximum file size: 15MB</p>
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

      {/* ~~~ Modal: Create Master Password (one-time) ~~~ */}
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

      {/* ~~~ Modal: Enter Existing Master Password ~~~ */}
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

      {/* ~~~ Modal: Account Settings ~~~ */}
      {showAccountSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Account Settings</h2>

            {/* Show Email */}
            <p className="mb-4 text-sm text-gray-600">
              Email: {localStorage.getItem("email")}
            </p>

            {/* Change Cognito Password */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Change Password</h3>
              <input
                type="password"
                placeholder="Current Password"
                className="w-full mb-2 px-3 py-2 border rounded"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="New Password"
                className="w-full mb-2 px-3 py-2 border rounded"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                className="w-full mb-2 px-3 py-2 border rounded"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Update Password
              </button>
            </div>

            {/* Danger Zone */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-red-600 font-semibold mb-2">Danger Zone</h3>
              <p className="text-sm mb-2 text-gray-600">
                This will permanently delete your account and all associated files.
              </p>
              <input
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder='Type "Delete Account"'
                className="w-full px-3 py-2 border mb-3 rounded"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={confirmationText !== "Delete Account"}
                className={`px-4 py-2 text-white rounded ${
                  confirmationText === "Delete Account"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                Delete Account
              </button>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAccountSettings(false)}
                className="text-gray-600 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
