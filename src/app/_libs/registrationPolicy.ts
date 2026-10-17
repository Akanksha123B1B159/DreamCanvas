export const MIN_PASSWORD_LENGTH = 12;
export const MIN_FULL_NAME_LENGTH = 1;
export const MAX_FULL_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;

export type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'empty';

  const length = Array.from(password).length;
  if (length < MIN_PASSWORD_LENGTH) return 'weak';
  if (length < 16) return 'medium';

  const characterClasses = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  return characterClasses >= 3 ? 'strong' : 'medium';
}

export function isValidRegistrationEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidRegistrationName(fullName: string): boolean {
  const trimmedName = fullName.trim();
  return (
    trimmedName.length >= MIN_FULL_NAME_LENGTH &&
    trimmedName.length <= MAX_FULL_NAME_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(trimmedName)
  );
}

export function isValidRegistrationPassword(password: string): boolean {
  return Array.from(password).length >= MIN_PASSWORD_LENGTH;
}
