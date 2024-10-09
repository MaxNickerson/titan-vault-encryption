import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";

// Initialize the AWS KMS client
const kmsClient = new KMSClient({ region: "us-east-1" }); // Change to your region

// The ARN or key ID of your Customer Master Key (CMK)
const keyId = "arn:aws:kms:us-east-1:123456789012:key/your-cmk-id"; // Replace with your CMK ARN

// Function to generate a data encryption key (DEK)
async function generateDataEncryptionKey() {
    const command = new GenerateDataKeyCommand({
        KeyId: keyId,
        KeySpec: "AES_256", // AES 256-bit key
    });

    try {
        const data = await kmsClient.send(command);
        return data; // Returns both Plaintext (DEK) and CiphertextBlob (encrypted DEK)
    } catch (error) {
        console.error("Error generating DEK:", error);
        throw error;
    }
}

// Function to encrypt data using AES-GCM
async function encryptData(data) {
    const { Plaintext, CiphertextBlob } = await generateDataEncryptionKey();

    // Generate a random initialization vector (IV) for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes is recommended for GCM

    // Encrypt the data using the DEK and AES-GCM
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);

    const encryptedData = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        await crypto.subtle.importKey(
            "raw",
            Plaintext,
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        ),
        encodedData
    );

    return {
        encryptedData: new Uint8Array(encryptedData),
        encryptedDEK: CiphertextBlob, // Store the encrypted DEK for future decryption
        iv: iv, // Store the IV with the encrypted data
    };
}

// Function to decrypt data using AES-GCM
async function decryptData(encryptedData, encryptedDEK, iv) {
    // Decrypt the DEK using AWS KMS
    const command = new DecryptCommand({
        CiphertextBlob: encryptedDEK,
    });

    try {
        const data = await kmsClient.send(command);
        const plaintextDEK = data.Plaintext;

        // Decrypt the data using the decrypted DEK and AES-GCM
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            await crypto.subtle.importKey(
                "raw",
                plaintextDEK,
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            ),
            encryptedData
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedData);
    } catch (error) {
        console.error("Error decrypting data:", error);
        throw error;
    }
}

// Example Usage
(async () => {
    const password = "HelloThere";

    // Encrypt the password
    const { encryptedData, encryptedDEK, iv } = await encryptData(password);
    console.log("Encrypted Data:", encryptedData);

    // Decrypt the password
    const decryptedData = await decryptData(encryptedData, encryptedDEK, iv);
    console.log("Decrypted Data:", decryptedData);
})();