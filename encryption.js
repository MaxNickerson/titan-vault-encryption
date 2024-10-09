const subtle = globalThis.crypto.subtle;

function getPasswordKey(password) {
    const encoder = new TextEncoder();
    return encoder.encode(password);
}

function generateSalt() {
    const salt = new Uint8Array(16); // 16 bytes = 128 bits of salt
    globalThis.crypto.getRandomValues(salt);
    return salt;
}

// const password = "HelloThere";
// const passwordKey = getPasswordKey(password);

// console.log(password);
// console.log(passwordKey); // Should log an Uint8Array (ArrayBuffer) of encoded password


// const salt = generateSalt();
// console.log(salt); // Should log a randomly generated Uint8Array


async function deriveKey(password, salt) {
    // Import the password as key material for PBKDF2
    const keyMaterial = await subtle.importKey(
        'raw', 
        password, // ArrayBuffer from getPasswordKey
        'PBKDF2', 
        false, 
        ['deriveKey']
    );  

    return subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

}

async function encryptData(key, data) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await subtle.encrypt(
        {
            name: 'AES-GCM',
            iv
        },
        key,
        data
    );
    return { iv, encrypted: new Uint8Array(encrypted) };
}

async function decryptData(key, iv, encryptedData) {
    const decrypted = await subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv // Use the same IV that was used for encryption
        },
        key, // The AES key derived from PBKDF2
        encryptedData // The encrypted data (ArrayBuffer)
    );

    return decrypted; // Decrypted data (ArrayBuffer)
}



(async function testDecrypt() {
    const passwordKey = getPasswordKey("mySecurePassword123"); // Convert password
    const salt = generateSalt(); // Generate salt
    const aesKey = await deriveKey(passwordKey, salt); // Derive AES key

    const encoder = new TextEncoder();
    const data = encoder.encode("This is my secret data!"); // Convert string to ArrayBuffer

    // Encrypt the data
    const { iv, encrypted } = await encryptData(aesKey, data);

    // Decrypt the data
    const decryptedData = await decryptData(aesKey, iv, encrypted);
    const decoder = new TextDecoder();
    console.log(decoder.decode(decryptedData)); // Should log: "This is my secret data!"
})();
