import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardPage = ({ username }) => {
    const [fileData, setFileData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [fileType, setFileType] = useState('');
    const [encryptedPackage, setEncryptedPackage] = useState(null);
    const [decryptedFileUrl, setDecryptedFileUrl] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const subtle = globalThis.crypto.subtle;

    const navigate = useNavigate();

    // Logout function
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        navigate('/login');
    };

    // Utility functions for encoding/decoding
    const arrayBufferToBase64 = (buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return window.btoa(binary);
    };

    const base64ToArrayBuffer = (base64) => {
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const getPasswordKey = (password) => {
        const encoder = new TextEncoder();
        return encoder.encode(password);
    };

    const generateSalt = () => {
        const salt = new Uint8Array(16);
        globalThis.crypto.getRandomValues(salt);
        return salt;
    };

    const deriveKey = async (password, salt) => {
        const keyMaterial = await subtle.importKey(
            'raw',
            password,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    };

    const encryptData = async (key, data) => {
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await subtle.encrypt(
            {
                name: 'AES-GCM',
                iv,
            },
            key,
            data
        );
        return { iv, encrypted: new Uint8Array(encrypted) };
    };

    const decryptData = async (key, iv, encryptedData) => {
        const decrypted = await subtle.decrypt(
            {
                name: 'AES-GCM',
                iv,
            },
            key,
            encryptedData
        );
        return decrypted;
    };

    // File upload handler
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        setFileName(file.name);
        setFileType(file.type);

        const reader = new FileReader();
        reader.onload = async (e) => {
            setFileData(e.target.result);
        };
        reader.readAsArrayBuffer(file);
    };

    // Encrypt file handler
    const handleEncryptFile = async () => {
        try {
            if (!fileData) {
                setErrorMessage('Please upload a file first.');
                return;
            }
            const passwordKey = getPasswordKey('mySecurePassword123'); // Replace with user-provided password
            const salt = generateSalt();
            const aesKey = await deriveKey(passwordKey, salt);

            const { iv, encrypted } = await encryptData(aesKey, fileData);

            const encryptedPackage = {
                iv: arrayBufferToBase64(iv),
                salt: arrayBufferToBase64(salt),
                encryptedData: arrayBufferToBase64(encrypted.buffer),
                fileName,
                fileType,
            };

            setEncryptedPackage(encryptedPackage);
            setErrorMessage(null);
            console.log('Encrypted package:', encryptedPackage);
        } catch (error) {
            console.error('Error encrypting file:', error);
            setErrorMessage('Error encrypting file.');
        }
    };

    // Decrypt file handler
    const handleDecryptFile = async () => {
        try {
            if (!encryptedPackage) {
                setErrorMessage('No encrypted file to decrypt.');
                return;
            }
            const passwordKey = getPasswordKey('mySecurePassword123'); // Replace with user-provided password
            const salt = base64ToArrayBuffer(encryptedPackage.salt);
            const iv = base64ToArrayBuffer(encryptedPackage.iv);
            const encryptedData = base64ToArrayBuffer(encryptedPackage.encryptedData);

            const aesKey = await deriveKey(passwordKey, salt);
            const decrypted = await decryptData(aesKey, iv, encryptedData);

            const blob = new Blob([decrypted], { type: encryptedPackage.fileType });
            const url = URL.createObjectURL(blob);
            setDecryptedFileUrl(url);
            setErrorMessage(null);
            console.log('Decrypted file URL:', url);
        } catch (error) {
            console.error('Error decrypting file:', error);
            setErrorMessage('Error decrypting file.');
        }
    };

    return (
        <div className="h-screen bg-gradient-to-b from-blue-100 to-gray-100 flex flex-col">
            {/* Header */}
            <header className="bg-blue-500 text-white py-4 px-8 shadow-md flex justify-between items-center">
                <h1 className="text-2xl font-bold">Titan Vault</h1>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 px-4 py-2 rounded-lg text-white hover:bg-red-600 transition"
                >
                    Logout
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center p-8">
                <h2 className="text-3xl font-bold mb-4">Welcome, {username}!</h2>
                <p className="text-gray-700 mb-6">
                    Upload, encrypt, and manage your files securely.
                </p>

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
                        {fileType.startsWith('image/') ? (
                            <img src={decryptedFileUrl} alt="Decrypted" className="max-w-full h-auto" />
                        ) : (
                            <a href={decryptedFileUrl} download={fileName} className="text-blue-500 underline">
                                Download {fileName}
                            </a>
                        )}
                    </div>
                )}

                {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
            </main>
        </div>
    );
};

export default DashboardPage;
