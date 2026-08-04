export const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractDomain(email: string): string {
  const normalized = normalizeEmail(email);
  const parts = normalized.split('@');
  return parts.length >= 2 ? parts[parts.length - 1] : '';
}

export function isPublicEmailDomain(email: string): boolean {
  const domain = extractDomain(email);
  return (PUBLIC_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized);
}

export type EmployeeCountValidation = {
  valid: boolean;
  error?: string;
};

export function validateEmployeeCount(value: string | number | null | undefined): EmployeeCountValidation {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'Employee count is required.' };
  }

  const str = String(value).trim();

  if (str === '') {
    return { valid: false, error: 'Employee count is required.' };
  }

  if (!/^\d+$/.test(str)) {
    return { valid: false, error: 'Employee count must be a whole number (no decimals, text, or symbols).' };
  }

  const num = parseInt(str, 10);

  if (num <= 0) {
    return { valid: false, error: 'Employee count must be at least 1.' };
  }

  if (num > 10000000) {
    return { valid: false, error: 'Employee count seems unreasonably large. Please verify.' };
  }

  return { valid: true };
}

export function deriveEmployeeSizeTier(count: number | null): string | null {
  if (count === null) return null;
  if (count < 50) return '1-49';
  if (count < 200) return '50-199';
  if (count < 500) return '200-499';
  if (count < 1000) return '500-999';
  return '1000+';
}
