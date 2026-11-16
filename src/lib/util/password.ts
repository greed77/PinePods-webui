// Client-side password hashing, matching upstream gen_funcs::encode_password:
// Argon2id with the argon2 crate's defaults (m=19456 KiB, t=2, p=1, 16-byte salt,
// 32-byte hash), encoded as a PHC string the server stores as-is.
import { argon2id } from 'hash-wasm';

export async function encodePassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: 'encoded'
  });
}

/** Same check upstream uses for emails (gen_funcs::validate_email). */
export const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
