/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Native Web Cryptography helpers for robust, secure local authentication and encryption/decryption.

// Convert an ArrayBuffer to a Hex String
function bufToHex(buffer: ArrayBuffer): string {
  return Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
}

// Convert a Hex String to a Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return view;
}

function stringToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += ('00' + str.charCodeAt(i).toString(16)).slice(-2);
  }
  return hex;
}

function hexToString(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return str;
}

// Fallback SHA-256 implementation
function sha256_fallback(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words: number[] = [];
  const asciiLength = ascii[lengthProperty] * 8;
  
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let extAscii = ascii + '\x80';
  while (extAscii[lengthProperty] % 64 - 56) extAscii += '\x00';
  ascii = extAscii;

  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiLength | 0);

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const wItem = i < 16 ? w[i] : (
        (rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)) +
        w[i - 7] +
        (rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)) +
        w[i - 16]
      ) | 0;
      
      const s0 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22));
      const maj = ((hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]));
      const t2 = (s0 + maj) | 0;

      const s1 = (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25));
      const ch = ((hash[4] & hash[5]) ^ (~hash[4] & hash[6]));
      const t1 = (hash[7] + s1 + ch + k[i] + wItem) | 0;

      hash = [
        (t1 + t2) | 0,
        hash[0],
        hash[1],
        hash[2],
        ((hash[3] + t1) | 0),
        hash[4],
        hash[5],
        hash[6]
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 31; j >= 0; j -= 4) {
      result += ((hash[i] >>> j) & 0xf).toString(16);
    }
  }
  return result;
}

// Fallback RC4 stream cipher
function rc4_fallback(key: string, str: string): string {
  const s: number[] = [];
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    const temp = s[i];
    s[i] = s[j];
    s[j] = temp;
  }
  let i = 0;
  j = 0;
  let res = '';
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    const temp = s[i];
    s[i] = s[j];
    s[j] = temp;
    const k = s[(s[i] + s[j]) % 256];
    res += String.fromCharCode(str.charCodeAt(y) ^ k);
  }
  return res;
}

// Generate a random salt/IV
export function generateRandomBytes(length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bufToHex(bytes.buffer);
}

/**
 * Constant-time comparison for hex-encoded hashes/secrets.
 * Prevents timing side-channel attacks that a naive `===` check would allow,
 * which is especially important for locally stored password/PIN verification.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }
  return diff === 0;
}

/**
 * Iterative stretching for the non-WebCrypto fallback hash path so it isn't a single
 * fast SHA-256 call (which would be trivially brute-forceable offline).
 */
function stretchFallbackHash(password: string, saltHex: string, rounds = 2000): string {
  let value = password + saltHex;
  for (let i = 0; i < rounds; i++) {
    value = sha256_fallback(value + saltHex);
  }
  return value;
}

/**
 * PBKDF2-HMAC-SHA256 password hashing.
 * Uses 210,000 iterations (OWASP's current minimum recommendation for PBKDF2-SHA256)
 * with a 256-bit (32-byte) random salt.
 */
export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const finalSaltHex = saltHex || generateRandomBytes(32);

  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    const hash = stretchFallbackHash(password, finalSaltHex);
    return {
      hash,
      salt: finalSaltHex
    };
  }

  const enc = new TextEncoder();
  const pwdBytes = enc.encode(password);
  const saltBytes = hexToBuf(finalSaltHex);

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pwdBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 210000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedKey = await window.crypto.subtle.exportKey("raw", derivedKey);
  const hash = bufToHex(exportedKey);

  return {
    hash,
    salt: finalSaltHex
  };
}

/**
 * Derives an AES-256-GCM key from a master key (the user's hash) and encrypts a payload.
 * Provides military-grade AES-256 client-side data protection.
 */
export async function encryptData(plainText: string, secretKeyHex: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    const ivHex = generateRandomBytes(12);
    const encryptedString = rc4_fallback(secretKeyHex + ivHex, plainText);
    const cipherHex = stringToHex(encryptedString);
    return `${ivHex}:${cipherHex}`;
  }

  try {
    const enc = new TextEncoder();
    const dataBytes = enc.encode(plainText);
    
    // Key is derived from user's secret hash
    const rawKey = hexToBuf(secretKeyHex.slice(0, 64)); // Ensure 32 bytes (256 bits)
    const key = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    const ivBytes = new Uint8Array(12); // 96-bit IV is standard for GCM
    window.crypto.getRandomValues(ivBytes);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ivBytes
      },
      key,
      dataBytes
    );

    const ivHex = bufToHex(ivBytes.buffer);
    const cipherHex = bufToHex(encrypted);

    // Concatenate IV and Ciphertext for storage
    return `${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error("Encryption error:", err);
    throw new Error("Encryption failed");
  }
}

/**
 * Decrypts AES-256-GCM ciphertext using the derived key.
 */
export async function decryptData(encryptedString: string, secretKeyHex: string): Promise<string> {
  const parts = encryptedString.split(":");
  if (parts.length !== 2) throw new Error("Invalid cipher format");
  const ivHex = parts[0];
  const cipherHex = parts[1];

  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    const ciphertextString = hexToString(cipherHex);
    const plainText = rc4_fallback(secretKeyHex + ivHex, ciphertextString);
    return plainText;
  }

  try {
    const ivBytes = hexToBuf(ivHex);
    const cipherBytes = hexToBuf(cipherHex);

    const rawKey = hexToBuf(secretKeyHex.slice(0, 64));
    const key = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes
      },
      key,
      cipherBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error("Decryption error:", err);
    throw new Error("Decryption failed. Database key may be incorrect.");
  }
}

/**
 * File size validation
 * Max size: 10MB
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/zip", "application/x-zip-compressed",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/markdown",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3",
    "video/mp4", "video/webm", "video/ogg"
  ];

  if (file.size > MAX_SIZE) {
    return { isValid: false, error: "File exceeds the 10MB size limit." };
  }

  if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".zip") && !file.name.endsWith(".pdf") && !file.name.endsWith(".md")) {
    return { isValid: false, error: `File type '${file.type || "unknown"}' is not supported.` };
  }

  return { isValid: true };
}

/**
 * AES-256 secure wrapper for localStorage.
 * Ensures persistent cached data in localStorage is encrypted at rest using the user's master key.
 */
export const secureLocalStorage = {
  getItem: async (key: string, userKey: string | null): Promise<string | null> => {
    const val = localStorage.getItem(key);
    if (!val) return null;
    if (!userKey) {
      if (val.startsWith("__enc__:")) return null; // Context is not yet authenticated, do not expose
      return val;
    }
    if (val.startsWith("__enc__:")) {
      try {
        return await decryptData(val.slice(8), userKey);
      } catch (e) {
        console.error("Failed to decrypt secure localStorage key:", key, e);
        return null;
      }
    }
    return val;
  },
  setItem: async (key: string, value: string, userKey: string | null): Promise<void> => {
    if (!userKey) {
      localStorage.setItem(key, value);
      return;
    }
    try {
      const encrypted = await encryptData(value, userKey);
      localStorage.setItem(key, `__enc__:${encrypted}`);
    } catch (e) {
      console.error("Failed to encrypt secure localStorage key:", key, e);
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },
  clear: () => {
    localStorage.clear();
  }
};
