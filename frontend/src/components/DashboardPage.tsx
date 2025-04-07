import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EncryptionUtils } from "../encryption/encryptionUtils";
import { 
  CognitoIdentityProviderClient, 
  UpdateUserAttributesCommand 
} from "@aws-sdk/client-cognito-identity-provider";
import { 
  AuthenticationDetails, 
  CognitoUser, 
  CognitoUserSession 
} from "amazon-cognito-identity-js";
import UserPool from "../cognitoConfig"; // Your Cognito configuration

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlDecode(b64url: string): string {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return atob(padded);
}

// Define the type for objects returned from the backend
type UserObjectType = {
  Key: string;
  Size: number;
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const encryptionUtils = new EncryptionUtils();

  // Modal state
  const [showEncryptModal, setShowEncryptModal] = useState(false);

  // File encryption states
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");

  // File listing states
  const [userFiles, setUserFiles] = useState<UserObjectType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Preview states
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // for passwordcreation and cognito checking
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnterModal, setShowEnterModal] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordProcessing, setIsPasswordProcessing] = useState(false);
    
  // Cache expiration in minutes
  const CACHE_EXPIRATION = 5;

  // Function to refresh user tokens to get updated attributes
  const refreshUserTokens = async () => {
    const email = localStorage.getItem("email");
    if (!email) return false;
    
    return new Promise<boolean>((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: UserPool,
      });
      
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Store the refreshed tokens
        if (session) {
          localStorage.setItem("idToken", session.getIdToken().getJwtToken());
          localStorage.setItem("accessToken", session.getAccessToken().getJwtToken());
          localStorage.setItem("refreshToken", session.getRefreshToken().getToken());
          resolve(true);
        } else {
          reject(new Error("Failed to get session"));
        }
      });
    });
  };

  // Function to check if the master password test file exists
const checkMasterPasswordTestFile = async () => {
  try {
    // Get the stored files from state or fetch them if needed
    let filesToCheck = userFiles;
    
    // If no files in state yet, fetch them directly
    if (!filesToCheck || filesToCheck.length === 0) {
      const idToken = localStorage.getItem("idToken");
      if (!idToken) return false;
      
      const response = await fetch("http://localhost:8080/listObjects", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      filesToCheck = data;
    }
    
    console.log("Files being checked for master password test:", filesToCheck);
    
    // Check if the master password test file exists in the list
    const hasTestFile = filesToCheck.some((file: any) => {
      const result = file.Key && 
                    typeof file.Key === 'string' && 
                    file.Key.includes('master-password-test.txt');
      
      if (result) {
        console.log("Found master password test file:", file.Key);
      }
      
      return result;
    });
    
    console.log("Master password test file exists:", hasTestFile);
    return hasTestFile;
  } catch (error) {
    console.error("Error checking for master password test file:", error);
    return false;
  }
};

  // Fetch user files from the backend API
  const fetchUserFiles = async () => {
    setIsLoading(true);
    setError(null);
    
    const idToken = localStorage.getItem("idToken");
    if (!idToken) {
      setError("Not authenticated");
      setIsLoading(false);
      navigate("/login");
      return;
    }
    
    try {
      const response = await fetch("http://localhost:8080/listObjects", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process the response - assuming it returns an array of objects
      const files = data.map((file: any) => ({
        Key: file.Key,
        Size: file.Size
      }));
      
      // Store in state
      setUserFiles(files);
      
      // Cache the result with timestamp
      const cacheData = {
        files: files,
        timestamp: new Date().getTime()
      };
      sessionStorage.setItem("userFilesCache", JSON.stringify(cacheData));
      
    } catch (err) {
      console.error("Failed to fetch files:", err);
      setError("Failed to load your files");
    } finally {
      setIsLoading(false);
    }
  };

  // Update your useEffect for checking auth
  useEffect(() => {
    const token = localStorage.getItem("idToken");
    if (!token) {
      return navigate("/login");
    }

    const checkAuth = async () => {
      try {
        console.log("Starting auth check...");
        
        // Parse the JWT token to check the attribute (for debugging)
        try {
          const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
          console.log("JWT Payload:", payload);
          console.log("hasMasterPassword attribute:", payload["custom:hasMasterPassword"]);
        } catch (e) {
          console.error("Error parsing JWT:", e);
        }
        
        // First check if the test file exists - most reliable method
        console.log("Checking for master password test file...");
        const hasMP = await checkMasterPasswordTestFile();
        console.log("Master password test file check result:", hasMP);
        
        const storedPass = localStorage.getItem("masterPassword");
        console.log("Master password in localStorage:", !!storedPass);

        if (hasMP && storedPass) {
          // User has master password and it's stored locally
          console.log("Master password found in localStorage, proceeding normally");
        } else if (hasMP) {
          // User has set master password but it's not in localStorage
          console.log("Master password exists but not in localStorage, showing enter modal");
          setShowEnterModal(true);
        } else {
          // No master password set yet
          console.log("No master password set, showing create modal");
          setShowCreateModal(true);
        }
      } catch (err) {
        console.error("Auth check error:", err);
        navigate("/login");
      }
    };
    
    checkAuth();
  }, [navigate]);
  // Check cache and fetch files on component mount
  useEffect(() => {
    const cachedData = sessionStorage.getItem("userFilesCache");
    
    if (cachedData) {
      try {
        const { files, timestamp } = JSON.parse(cachedData);
        const now = new Date().getTime();
        const cacheAge = (now - timestamp) / (1000 * 60); // Convert to minutes
        
        // If cache is still valid, use it
        if (cacheAge < CACHE_EXPIRATION) {
          console.log("Using cached file list");
          setUserFiles(files);
          setIsLoading(false);
          return;
        } else {
          console.log("Cache expired, fetching fresh data");
        }
      } catch (err) {
        console.error("Error parsing cached data:", err);
      }
    }
    
    // If no cache or expired cache, fetch fresh data
    fetchUserFiles();
  }, []);


  // Function to create and store a new master password
  const handleCreateMasterPassword = async () => {
    // Reset error state
    setPasswordError(null);
    
    // Validate passwords
    if (masterPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    
    if (masterPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    
    setIsPasswordProcessing(true);
    
    try {
      // 1. Create a test file encrypted with this password
      const testData = new TextEncoder().encode("This is a test file to verify your master password.");
      const testBuffer = testData.buffer;
      
      // 2. Encrypt it
      const { salt, iv, encryptedData } = await encryptionUtils.encryptData(
        testBuffer,
        masterPassword
      );
      
      // 3. Prepare package
      const packageData = {
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt),
        encryptedData: arrayBufferToBase64(encryptedData),
        fileName: "master-password-test.txt",
        fileType: "text/plain"
      };
      
      // 4. Send to backend to store the test file
      const idToken = localStorage.getItem("idToken");
      const accessToken = localStorage.getItem("accessToken"); // Need this for updating attributes
      
      if (!idToken || !accessToken) {
        throw new Error("Not authenticated");
      }
      
      // Upload the test file
      const response = await fetch("http://localhost:8080/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(packageData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      // 5. Update the Cognito attribute directly from frontend
      const client = new CognitoIdentityProviderClient({
        region: "us-east-1" // Replace with your Cognito region
      });
      
      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: [
          {
            Name: "custom:hasMasterPassword",
            Value: "true"
          }
        ]
      });
      
      await client.send(command);
      
      // 6. Store password in localStorage
      localStorage.setItem("masterPassword", masterPassword);
      
      // 7. Refresh token to get updated attributes
      await refreshUserTokens();
      
      // 8. Close modal
      setShowCreateModal(false);
      
      // 9. Refresh file list
      fetchUserFiles();
      
    } catch (error) {
      console.error("Error setting master password:", error);
      setPasswordError("Failed to set master password: " + 
        (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsPasswordProcessing(false);
    }
  };

  // Function to verify an existing master password
  const handleVerifyMasterPassword = async () => {
    setPasswordError(null);
    setIsPasswordProcessing(true);
    
    try {
      const idToken = localStorage.getItem("idToken");
      
      // 1. Send password to backend for verification
      const response = await fetch("http://localhost:8080/verifyMasterPassword", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ masterPassword })
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No master password set. Please create one.");
        } else {
          const errorText = await response.text();
          throw new Error(errorText);
        }
      }
      
      // 2. Get the encrypted package
      const encryptedPackage = await response.json();
      
      // 3. Verify by actually trying to decrypt it
      try {
        const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
        const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
        const encryptedData = base64ToArrayBuffer(encryptedPackage.encryptedData);
        
        await encryptionUtils.decryptData(
          encryptedData,
          masterPassword,
          salt,
          iv
        );
        
        // If we get here, decryption was successful
        console.log("Master password verified successfully");
        
        // 4. If verified, store in localStorage
        localStorage.setItem("masterPassword", masterPassword);
        
        // 5. Close modal
        setShowEnterModal(false);
      } catch (decryptError) {
        console.error("Decryption failed:", decryptError);
        throw new Error("Incorrect master password. Please try again.");
      }
    } catch (error) {
      console.error("Password verification error:", error);
      setPasswordError("Verification failed: " + 
        (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsPasswordProcessing(false);
    }
  };

  // Function to handle previewing the selected file
  const handlePreview = async () => {
    if (!selectedItem) return;
    
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);
    // Get the master password from localStorage
    const password = localStorage.getItem("masterPassword") || "myTestPassword123";

    const idToken = localStorage.getItem("idToken");
    if (!idToken) {
      setPreviewError("Not logged in. Please log in to view files.");
      setIsPreviewLoading(false);
      return;
    }
    
    try {
      // Fetch the encrypted package
      const response = await fetch("http://localhost:8080/downloadPackage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fileName: selectedItem }),
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      // Parse the response
      const encryptedPackage = await response.json();
      
      // Validate the package
      if (!encryptedPackage.iv || !encryptedPackage.salt || !encryptedPackage.encryptedData) {
        throw new Error("Incomplete encrypted package received");
      }
      
      // Convert Base64 strings to ArrayBuffers
      const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
      const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
      const encryptedData = base64ToArrayBuffer(encryptedPackage.encryptedData);
      
      // Decrypt the data
      const decryptedBuffer = await encryptionUtils.decryptData(
        encryptedData,
        password,
        salt,
        iv
      );
      
      // Create a Blob and URL
      const blob = new Blob([decryptedBuffer], { type: encryptedPackage.fileType });
      const url = URL.createObjectURL(blob);
      
      // Set the preview URL
      setPreviewUrl(url);
    } catch (error) {
      console.error("Preview error:", error);
      setPreviewError("Failed to preview file: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Use this effect to automatically preview when an item is selected
  useEffect(() => {
    if (selectedItem) {
      handlePreview();
    } else {
      // Clean up preview when no item is selected
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [selectedItem]);

  // Make sure to clean up URLs when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // -----------------------------
  // Logout
  // -----------------------------
  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");
    localStorage.removeItem("masterPassword");
    navigate("/login");
  };

  // -----------------------------
  // Modal toggling
  // -----------------------------
  const openEncryptModal = () => {
    // Reset prior file data
    setFileData(null);
    setFileName("");
    setFileType("");
    setShowEncryptModal(true);
  };

  const closeEncryptModal = () => {
    setShowEncryptModal(false);
  };

  // -----------------------------
  // Handle file selection
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

      const password = localStorage.getItem("masterPassword") || "myTestPassword123";
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
      
      // Refresh file list after successful upload
      fetchUserFiles();
    } catch (error) {
      console.error("Encryption/Upload error:", error);
    }
  };

  // -----------------------------
  // Handle clicking a file
  // -----------------------------
  const handleItemClick = (itemKey: string) => {
    setSelectedItem(itemKey);
    console.log(`Selected file: ${itemKey}`);
  };

  // -----------------------------
  // Close the "preview" box
  // -----------------------------
  const handleClosePreview = () => {
    setSelectedItem(null);
  };

  // -----------------------------
  // Download and decrypt selected file
  // -----------------------------
  const handleDownload = async () => {
    if (!selectedItem) {
      alert("Please select a file to download.");
      return;
    }

    console.log(`Downloading ${selectedItem}...`);
    
    // If we already have a preview, use that instead of re-fetching
    if (previewUrl) {
      const a = document.createElement("a");
      a.href = previewUrl;
      a.download = selectedItem.split("/").pop() || "downloaded-file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.log("Download complete using existing preview!");
      return;
    }
    
    // Otherwise proceed with normal download
    const idToken = localStorage.getItem("idToken");
    if (!idToken) {
      console.error("No ID token found. User not logged in.");
      alert("You must be logged in to download files.");
      navigate("/login");
      return;
    }

    try {
      setIsPreviewLoading(true);
      // Step 1: Fetch the encrypted file from backend
      const response = await fetch("http://localhost:8080/downloadPackage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fileName: selectedItem }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Download failed:", errorText);
        alert("Failed to download the file. Please try again.");
        return;
      }

      // Step 2: Parse the response
      const encryptedPackage = await response.json();
      console.log("Received encrypted package:", encryptedPackage);

      // Validate the package
      if (!encryptedPackage.iv || !encryptedPackage.salt || !encryptedPackage.encryptedData) {
        console.error("Incomplete encrypted package received");
        alert("The file data is corrupted or incomplete.");
        return;
      }

      // Step 3: Convert Base64 strings to ArrayBuffers
      const iv = new Uint8Array(base64ToArrayBuffer(encryptedPackage.iv));
      const salt = new Uint8Array(base64ToArrayBuffer(encryptedPackage.salt));
      const encryptedData = base64ToArrayBuffer(encryptedPackage.encryptedData);
      
      // Step 4: Decrypt the data
      // Get the master password from localStorage
      const password = localStorage.getItem("masterPassword") || "myTestPassword123";

      const decryptedBuffer = await encryptionUtils.decryptData(
        encryptedData,
        password,
        salt,
        iv
      );

      // Step 5: Create a Blob and trigger download
      const blob = new Blob([decryptedBuffer], { type: encryptedPackage.fileType });
      const url = URL.createObjectURL(blob);
      
      // Create a link and trigger the download
      const a = document.createElement("a");
      a.href = url;
      a.download = encryptedPackage.fileName.split("/").pop() || "downloaded-file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      console.log("Download and decryption complete!");
    } catch (error) {
      console.error("Download/Decryption error:", error);
      alert("An error occurred during download or decryption");
    } finally {
      setIsPreviewLoading(false);
    }
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
            
            {isLoading ? (
              <p className="text-gray-600">Loading files...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : userFiles.length === 0 ? (
              <p className="text-gray-600">No files found</p>
            ) : (
              <ul className="space-y-2">
                {userFiles.map((item) => (
                  <li key={item.Key}>
                    <button
                      onClick={() => handleItemClick(item.Key)}
                      className={`text-blue-600 hover:underline ${
                        selectedItem === item.Key ? "font-bold" : ""
                      }`}
                    >
                      {item.Key.split('/').pop() || item.Key}
                    </button>
                    <span className="text-xs text-gray-500 ml-2">
                      {(item.Size / 1024).toFixed(1)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
            
            {/* Add a refresh button */}
            <button 
              onClick={fetchUserFiles}
              className="mt-4 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Refresh
            </button>
          </div>

          {/* RIGHT BOX: Only show if an item is selected */}
          {selectedItem && (
            <div className="bg-white p-6 rounded-lg shadow-md w-96 relative">
              {/* Close button */}
              <button
                onClick={handleClosePreview}
                className="absolute top-2 right-2 font-bold text-gray-600 hover:text-black"
              >
                X
              </button>

              <h2 className="text-xl font-semibold mb-4">File Preview</h2>
              <p className="text-gray-700 break-words mb-3">
                Selected: {selectedItem.split('/').pop() || selectedItem}
              </p>
              
              {/* Preview content */}
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
              
              {/* Download button in the preview box */}
              <button
                onClick={handleDownload}
                disabled={isPreviewLoading}
                className={`mt-4 px-4 py-2 ${
                  isPreviewLoading ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"
                } text-white rounded-lg transition w-full flex items-center justify-center`}
              >
                {isPreviewLoading ? (
                  <>
                    <span className="mr-2">Processing...</span>
                  </>
                ) : (
                  "Download & Decrypt"
                )}
              </button>
            </div>
          )}
        </div>

        {/* Button for encryption */}
        <div>
          <button
            onClick={openEncryptModal}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Encrypt & Upload
          </button>
        </div>
      </div>
      {/* Create Password Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-96">
            <h2 className="text-xl font-bold mb-4">Create Master Password</h2>
            <p className="text-gray-600 mb-4">
              This password will be used to encrypt and decrypt all your files.
              Please remember it - it cannot be recovered if lost.
            </p>
            
            {passwordError && (
              <div className="mb-4 text-red-500 text-sm">{passwordError}</div>
            )}
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-1">Master Password</label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter password (min 8 characters)"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Confirm your password"
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleCreateMasterPassword}
                disabled={isPasswordProcessing}
                className={`px-4 py-2
                  ${isPasswordProcessing ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}
                  text-white rounded-md`}
              >
                {isPasswordProcessing ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Password Modal */}
      {showEnterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-96">
            <h2 className="text-xl font-bold mb-4">Enter Master Password</h2>
            <p className="text-gray-600 mb-4">
              Please enter your master password to access your encrypted files.
            </p>
            
            {passwordError && (
              <div className="mb-4 text-red-500 text-sm">{passwordError}</div>
            )}
            
            <div className="mb-6">
              <label className="block text-gray-700 mb-1">Master Password</label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter your master password"
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleVerifyMasterPassword}
                disabled={isPasswordProcessing}
                className={`px-4 py-2
                  ${isPasswordProcessing ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}
                  text-white rounded-md`}
              >
                {isPasswordProcessing ? "Verifying..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
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