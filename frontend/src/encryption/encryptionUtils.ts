export class EncryptionUtils {
    private subtle = globalThis.crypto.subtle;


    public async encryptData(
        fileData: ArrayBuffer,
        password: string
    ): Promise <{
        salt: Uint8Array;
        iv: Uint8Array;
        encryptedData: ArrayBuffer
    }> {
        // Password converstion to arrayBuffer
        const passwordKey = this.getPasswordKey(password);

        // Generate a new salt for every encryption
        const salt = this.getSalt();

        // Derive the AES-GCM key using PBKDF2 with the generated salt and unique password
        const aesKey = await this.deriveKey(passwordKey, salt);

        // Generate a unique IV for AES-GCM (typically 12 bytes)
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

        // Encrypt the file data
        const encryptedData = await this.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        aesKey,
        fileData
        );

        return { salt, iv, encryptedData };
    }
        
    // This function decrypts data using the password, salt, and IV
    public async decryptData(
        encryptedData: ArrayBuffer,
        password: string,
        salt: Uint8Array,
        iv: Uint8Array
      ): Promise<ArrayBuffer> {
        // Convert password to an ArrayBuffer key
        const passwordKey = this.getPasswordKey(password);
    
        // Re-derive the AES key using the same salt
        const aesKey = await this.deriveKey(passwordKey, salt);
    
        // Decrypt the data
        return this.subtle.decrypt(
          {
            name: "AES-GCM",
            iv,
          },
          aesKey,
          encryptedData
        );
      }
    

    getSalt(): Uint8Array {
        const salt = new Uint8Array(16); // 16 bytes = 128 bits of salt
        globalThis.crypto.getRandomValues(salt);
        return salt;
    }

    // Converts password to ArrayBuffer
    getPasswordKey(password: string): ArrayBuffer{
        const encoder = new TextEncoder();
        return encoder.encode(password);
    }

    async deriveKey(
        password: ArrayBuffer,
        salt: Uint8Array
    ): Promise<CryptoKey> {
        const keyMaterial = await this.subtle.importKey(
            "raw",
            password,
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return this.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 100000,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256},
            true,
            ["encrypt","decrypt"]
        );
    }
    


}

