
function getPasswordKey(password) {
    const encoder = new TextEncoder();
    return encoder.encode(password);
}

function generateSalt() {
    const salt = new Uint8Array(16); // 16 bytes = 128 bits of salt
    globalThis.crypto.getRandomValues(salt);
    return salt;
}

const password = "HelloThere";
const passwordKey = getPasswordKey(password);

console.log(password);
console.log(passwordKey); // Should log an Uint8Array (ArrayBuffer) of encoded password


const salt = generateSalt();
console.log(salt); // Should log a randomly generated Uint8Array


async function deriveKey(password, salt) {
    // Import the password as key material for PBKDF2
    const keyMaterial = await subtle.importKey(
        'raw', 
        password, // ArrayBuffer from getPasswordKey
        'PBKDF2', 
        false, 
        ['deriveKey']
    );
}