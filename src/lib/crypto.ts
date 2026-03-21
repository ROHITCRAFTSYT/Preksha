// src/lib/crypto.ts

const ITERATIONS = 100000;
const KEY_LENGTH = 256;
const DIGEST = 'SHA-256' as const;

/**
 * Utility to convert Uint8Array to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Utility to convert Base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary_string = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM key from a user password and a salt using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  
  // 1. Import the raw password
  const crypto = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // 2. Derive the AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: ITERATIONS,
      hash: DIGEST,
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a File or Blob byte-for-byte in the browser.
 * Returns the ciphertext Blob, the randomly generated IV, and the salt used for key derivation.
 */
export async function encryptFile(
  file: File | Blob,
  password: string
): Promise<{ ciphertext: Blob; iv: string; salt: string }> {
  // Generate random Initialization Vector and Salt
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  const key = await deriveKey(password, salt);

  // Read the file as an ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Encrypt the buffer using AES-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    arrayBuffer
  );

  // Convert Uint8Arrays back to base64 strings so they can be stored in the DB
  const ivBase64 = bufferToBase64(iv);
  const saltBase64 = bufferToBase64(salt);

  return {
    ciphertext: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    iv: ivBase64,
    salt: saltBase64,
  };
}

/**
 * Decrypts a ciphertext Blob back to its original File or Blob given the password, iv, and salt.
 */
export async function decryptFile(
  ciphertextBlob: Blob,
  password: string,
  ivBase64: string,
  saltBase64: string,
  originalMimeType: string
): Promise<Blob> {
  const iv = base64ToBuffer(ivBase64);
  const salt = base64ToBuffer(saltBase64);

  const key = await deriveKey(password, salt);

  const arrayBuffer = await ciphertextBlob.arrayBuffer();

  // Decrypt the buffer using AES-GCM
  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
      },
      key,
      arrayBuffer
    );
  } catch (error) {
    throw new Error('Decryption Failed: Invalid Vault Password or Corrupted Document.');
  }

  return new Blob([decryptedBuffer], { type: originalMimeType });
}
