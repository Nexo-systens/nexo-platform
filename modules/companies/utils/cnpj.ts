const FIRST_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function calculateCheckDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * weights[index],
    0
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function sanitizeCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

/** Validacao completa de CNPJ (14 digitos + digitos verificadores). */
export function isValidCnpj(value: string): boolean {
  const cnpj = sanitizeCnpj(value);

  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digits = cnpj.split("").map(Number);

  const firstCheckDigit = calculateCheckDigit(
    digits.slice(0, 12),
    FIRST_DIGIT_WEIGHTS
  );
  if (firstCheckDigit !== digits[12]) return false;

  const secondCheckDigit = calculateCheckDigit(
    digits.slice(0, 13),
    SECOND_DIGIT_WEIGHTS
  );
  if (secondCheckDigit !== digits[13]) return false;

  return true;
}

export function formatCnpj(value: string): string {
  const cnpj = sanitizeCnpj(value);
  if (cnpj.length !== 14) return value;
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}
