import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export const UNKNOWN_EMAIL_DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$amDttKgeOeQM+Pud3dC5Gw$SC+ZQ3vqd85fl/a3GzrBFE6HHBYWgIOFwsD55Ooa5+4';
