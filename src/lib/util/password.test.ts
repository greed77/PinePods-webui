import { describe, expect, it } from 'vitest';
import { argon2Verify } from 'hash-wasm';
import { encodePassword, isValidEmail } from './password';

describe('encodePassword', () => {
  it('produces an Argon2id PHC string with the argon2 crate defaults', async () => {
    const hash = await encodePassword('hunter22');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
    expect(await argon2Verify({ password: 'hunter22', hash })).toBe(true);
    expect(await argon2Verify({ password: 'wrong', hash })).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await encodePassword('same')).not.toBe(await encodePassword('same'));
  });
});

describe('isValidEmail', () => {
  it('matches upstream validate_email', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.d')).toBe(false);
  });
});
