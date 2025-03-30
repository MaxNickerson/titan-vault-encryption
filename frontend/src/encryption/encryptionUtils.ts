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
  public async encryptMasterKey(
    masterPassword: string
  ): Promise<{
    encryptedKey: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const salt = this.getSalt();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const masterKeyRaw = this.getPasswordKey(masterPassword);

    const wrapperKey = await this.deriveKey(masterKeyRaw, salt);

    const encryptedKey = await this.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrapperKey,
      masterKeyRaw
    );

    return { encryptedKey, salt, iv };
  }

  public async decryptMasterKey(
    encryptedKey: ArrayBuffer,
    masterPassword: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    const masterKeyRaw = this.getPasswordKey(masterPassword);
    const wrapperKey = await this.deriveKey(masterKeyRaw, salt);

    const decrypted = await this.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrapperKey,
      encryptedKey
    );

    return decrypted;
  }

  public async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  

  public async encryptFileWithIvPrepended(fileData: ArrayBuffer, password: string): Promise<Uint8Array> {
    const { encryptedData, iv } = await this.encryptData(fileData, password);
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);
    return combined;
  }
  
  public async decryptFileWithIvPrepended(buffer: ArrayBuffer, password: string): Promise<ArrayBuffer> {
    const iv = new Uint8Array(buffer.slice(0, 12));
    const encryptedData = buffer.slice(12);
    const dummySalt = new Uint8Array(16); // not used, but required by decryptData
    return await this.decryptData(encryptedData, password, dummySalt, iv);
  }
  


}

