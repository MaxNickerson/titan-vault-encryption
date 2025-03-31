export class EncryptionUtils {
  private subtle = globalThis.crypto.subtle;
  


  public async encryptData(
    fileData: ArrayBuffer,
    password: string
  ): Promise<{
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
  getPasswordKey(password: string): ArrayBuffer {
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
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Encrypt a masterKey and return { encryptedKey, salt, iv }
  // Generate a random 256-bit key (32 bytes).
  public generateRandomMasterKey(): Uint8Array {
    const masterKey = new Uint8Array(32); // 256 bits
    crypto.getRandomValues(masterKey);
    return masterKey;
  }

  // Encrypt that 256-bit key with a wrapper key derived from the user’s password.
  public async encryptMasterKeyWithWrapper(
    plainMasterKey: Uint8Array,   // 32 bytes
    userPassword: string
  ): Promise<{
    encryptedKey: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const salt = this.getSalt(); // your existing getSalt() is fine
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive the wrapper key from user’s typed password + salt
    const passwordRaw = this.getPasswordKey(userPassword);
    const wrapperKey = await this.deriveKey(passwordRaw, salt);

    // Encrypt the 256-bit key
    const encryptedKey = await this.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrapperKey,
      plainMasterKey // the random 32 bytes
    );

    return { encryptedKey, salt, iv };
  }

  public async decryptMasterKeyWithWrapper(
    encryptedKey: ArrayBuffer,
    userPassword: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    const passwordRaw = this.getPasswordKey(userPassword);
    const wrapperKey = await this.deriveKey(passwordRaw, salt);

    const decrypted = await this.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrapperKey,
      encryptedKey
    );

    // Return 32-byte buffer
    return new Uint8Array(decrypted);
  }

  public async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  

  public async encryptDataWithSaltAndIv(
    fileData: ArrayBuffer,
    password: string
  ): Promise<Uint8Array> {
    // 1) PBKDF2-based encryption
    const { salt, iv, encryptedData } = await this.encryptData(fileData, password);
    // encryptData() already calls getSalt() and deriveKey(...)
  
    // 2) Combine [salt(16 bytes) + iv(12 bytes) + ciphertext]
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
  
    return combined;
  }
  
  public async decryptDataWithSaltAndIv(
    combined: ArrayBuffer,
    password: string
  ): Promise<ArrayBuffer> {
    // 1) Parse out salt + iv
    // First 16 bytes = salt
    const salt = new Uint8Array(combined.slice(0, 16));
    // Next 12 bytes = iv
    const iv = new Uint8Array(combined.slice(16, 16 + 12));
    // Remainder = ciphertext
    const encryptedData = combined.slice(16 + 12);
  
    // 2) Decrypt
    return this.decryptData(encryptedData, password, salt, iv);
  }
  


}

