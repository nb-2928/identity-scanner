/**
 * Validates the ICAO MRZ checksum.
 * Checksum is calculated on fields using weighted modulo 10 (weight 731).
 */
export const validateMRZChecksum = (str: string, checkDigit: string): boolean => {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    let val: number;
    const char = str[i];
    if (char === '<') val = 0;
    else if (/[0-9]/.test(char)) val = parseInt(char);
    else val = char.charCodeAt(0) - 55; // A=10, B=11...
    sum += val * weights[i % 3];
  }
  return (sum % 10).toString() === checkDigit;
};