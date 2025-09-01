import crypto from 'crypto';
import {PHASE_PRODUCTION_BUILD} from "next/constants";

// Encryption algorithm configuration
const algorithm = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
    // Retrieve the Base64-encoded encryption key from the environment variable
    const keyBase64 = process.env.ENCRYPTION_KEY;
    if (!keyBase64) {
        throw new Error('The ENCRYPTION_KEY environment variable is not set.');
    }

    // Decode the key (must be 32 bytes for 256-bit encryption)
    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a Base64-encoded 32-byte key.');
    }

    return key;
}

/**
 * Encrypts a plaintext string by generating a new IV,
 * concatenating it with the ciphertext, and returning a Base64-encoded string.
 * @param text - The plaintext string to encrypt.
 * @returns A Base64-encoded string containing the IV and ciphertext.
 */
export function encrypt(text: string): string {
    // Generate a new IV for each encryption (16 bytes)
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);

    // Perform encryption
    const encryptedBuffer = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
    ]);

    // Concatenate IV and ciphertext
    const combinedBuffer = Buffer.concat([iv, encryptedBuffer]);

    // Return the concatenated data as a Base64-encoded string
    return combinedBuffer.toString('base64');
}

/**
 * Decrypts a Base64-encoded string that contains the IV and ciphertext.
 * @param base64Data - The Base64-encoded string (IV + ciphertext) to decrypt.
 * @returns The decrypted plaintext string.
 */
export function decrypt(base64Data: string): string {
    if (!base64Data || typeof base64Data !== 'string') {
        throw new Error('Invalid base64Data: must be a non-empty string');
    }

    let combinedBuffer: Buffer;
    try {
        // Decode the Base64 string into a buffer
        combinedBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
        throw new Error(`Failed to decode base64 data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Ensure the buffer is at least 17 bytes (16 for IV + 1 for data)
    if (combinedBuffer.length < 17) {
        throw new Error(`Invalid encrypted data: expected at least 17 bytes, got ${combinedBuffer.length}`);
    }

    // Extract the IV (first 16 bytes) and ciphertext (remaining bytes)
    const iv = combinedBuffer.subarray(0, 16);
    const encryptedText = combinedBuffer.subarray(16);

    // Validate IV length
    if (iv.length !== 16) {
        throw new Error(`Invalid IV length: expected 16 bytes, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(algorithm, getEncryptionKey(), iv);
    const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedText),
        decipher.final()
    ]);

    // Return the decrypted plaintext as a UTF-8 string
    return decryptedBuffer.toString('utf8');
}

// Check if the encryption key is available not in production build
if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) getEncryptionKey();