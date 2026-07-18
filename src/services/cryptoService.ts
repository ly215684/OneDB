/**
 * Encryption service using Web Crypto API.
 * - AES-256-GCM for symmetric encryption
 * - PBKDF2 for key derivation and password hashing
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

// ─── Helpers ────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Core Crypto Functions ──────────────────────────────────────────

/** Generate a random salt (base64 encoded) */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return bufferToBase64(salt.buffer);
}

/** Derive an AES-256-GCM CryptoKey from password + salt via PBKDF2 */
export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(base64ToBuffer(salt)),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt plaintext with AES-256-GCM. Returns base64(iv + ciphertext + tag) */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  // Concatenate iv + ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return bufferToBase64(combined.buffer);
}

/** Decrypt base64(iv + ciphertext + tag) with AES-256-GCM */
export async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(base64ToBuffer(encrypted));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

/** Hash a password with PBKDF2 for verification (returns base64 hash) */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(base64ToBuffer(salt)),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bufferToBase64(bits);
}

// ─── Encrypted Value Marker ─────────────────────────────────────────

export interface EncryptedValue {
  __enc: true;
  data: string;
}

export function isEncryptedValue(val: unknown): val is EncryptedValue {
  return typeof val === 'object' && val !== null && '__enc' in val && (val as EncryptedValue).__enc === true;
}

// ─── Connection Config Encryption ───────────────────────────────────

interface SensitiveFields {
  password?: string;
  sshTunnel?: {
    password?: string;
    [key: string]: unknown;
  };
  connectionString?: string;
  [key: string]: unknown;
}

/** Encrypt sensitive fields in a ConnectionConfig object */
export async function encryptConfig(
  config: SensitiveFields,
  key: CryptoKey
): Promise<SensitiveFields> {
  const result = { ...config };

  if (result.password && !isEncryptedValue(result.password)) {
    result.password = await encrypt(result.password, key) as unknown as string;
    // Store as EncryptedValue marker
    (result as Record<string, unknown>).password = { __enc: true, data: result.password } as unknown as string;
  }

  if (result.sshTunnel?.password && !isEncryptedValue(result.sshTunnel.password)) {
    const encPwd = await encrypt(result.sshTunnel.password, key);
    result.sshTunnel = { ...result.sshTunnel, password: { __enc: true, data: encPwd } as unknown as string };
  }

  // Encrypt connectionString if it contains credentials
  if (result.connectionString && !isEncryptedValue(result.connectionString)) {
    const encStr = await encrypt(result.connectionString, key);
    result.connectionString = { __enc: true, data: encStr } as unknown as string;
  }

  return result;
}

/** Decrypt sensitive fields in a ConnectionConfig object */
export async function decryptConfig(
  config: SensitiveFields,
  key: CryptoKey
): Promise<SensitiveFields> {
  const result = { ...config };

  if (isEncryptedValue(result.password as unknown)) {
    try {
      result.password = await decrypt((result.password as unknown as EncryptedValue).data, key);
    } catch {
      result.password = '';
    }
  }

  if (result.sshTunnel && isEncryptedValue(result.sshTunnel.password as unknown)) {
    try {
      result.sshTunnel = {
        ...result.sshTunnel,
        password: await decrypt((result.sshTunnel.password as unknown as EncryptedValue).data, key),
      };
    } catch {
      result.sshTunnel = { ...result.sshTunnel, password: '' };
    }
  }

  if (isEncryptedValue(result.connectionString as unknown)) {
    try {
      result.connectionString = await decrypt((result.connectionString as unknown as EncryptedValue).data, key);
    } catch {
      result.connectionString = '';
    }
  }

  return result;
}

// ─── Encryption Key Manager (Singleton) ─────────────────────────────

type LockListener = (locked: boolean) => void;

class EncryptionKeyManager {
  private static instance: EncryptionKeyManager | null = null;

  private key: CryptoKey | null = null;
  private lockListeners: LockListener[] = [];

  static getInstance(): EncryptionKeyManager {
    if (!EncryptionKeyManager.instance) {
      EncryptionKeyManager.instance = new EncryptionKeyManager();
    }
    return EncryptionKeyManager.instance;
  }

  /** Set the encryption key (after master password verification) */
  async setKey(password: string, salt: string): Promise<void> {
    this.key = await deriveKey(password, salt);
    this.notifyLockListeners(false);
  }

  /** Get the current encryption key (null if locked) */
  getKey(): CryptoKey | null {
    return this.key;
  }

  /** Check if encryption is available (key in memory) */
  isUnlocked(): boolean {
    return this.key !== null;
  }

  /** Clear the key from memory (lock) */
  lock(): void {
    this.key = null;
    this.notifyLockListeners(true);
  }

  /** Subscribe to lock/unlock events */
  onLockChange(listener: LockListener): () => void {
    this.lockListeners.push(listener);
    return () => {
      this.lockListeners = this.lockListeners.filter((l) => l !== listener);
    };
  }

  private notifyLockListeners(locked: boolean): void {
    this.lockListeners.forEach((l) => l(locked));
  }
}

export const encryptionKeyManager = EncryptionKeyManager.getInstance();
