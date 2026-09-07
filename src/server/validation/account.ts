export const MIN_NEW_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 1024;
export const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return null;
  }
  if (!EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}

export function validateNewPassword(password: string): string | null {
  if (
    password.length < MIN_NEW_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return `Le mot de passe doit contenir entre ${MIN_NEW_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}
