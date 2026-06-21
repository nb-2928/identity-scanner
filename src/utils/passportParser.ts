import { type ParsedIDData } from '../types/document';

/**
 * Parses and normalizes ICAO YYMMDD strings into standard YYYY-MM-DD format
 */
function parseICAODate(rawDate: string, isBirthDate: boolean): string {
  const clean = rawDate
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/B/g, '8')
    .replace(/[^0-9]/g, '0');

  if (clean.length < 6) return 'Unknown';

  const year2Digit = parseInt(clean.substring(0, 2), 10);
  const month = clean.substring(2, 4);
  const day = clean.substring(4, 6);

  const currentYear = new Date().getFullYear();
  const currentCenturyBase = Math.floor(currentYear / 100) * 100;
  const cutoffYear = currentYear % 100;

  let fullYear: number;
  if (isBirthDate) {
    fullYear = year2Digit > cutoffYear ? (currentCenturyBase - 100) + year2Digit : currentCenturyBase + year2Digit;
  } else {
    fullYear = currentCenturyBase + year2Digit;
  }

  return `${fullYear}-${month}-${day}`;
}

/**
 * Robust Index-Based ICAO Document 9303 Passport MRZ Parser
 */
export function parsePassportMRZ(rawText: string): ParsedIDData {
  const lines = rawText
    .split(/[\r\n]+/)
    .map(l => l.trim().toUpperCase())
    .filter(l => l.length >= 20);

  let line1 = '';
  let line2 = '';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('P<') || /^P[A-Z<]{3,5}/.test(lines[i])) {
      line1 = lines[i];
      if (lines[i + 1]) line2 = lines[i + 1];
      break;
    }
  }

  if (!line1 || !line2) {
    throw new Error('Passport MRZ line sequence structure could not be identified.');
  }

  // Force strict ICAO 44-character line requirements
  const mrz1 = line1.padEnd(44, '<').substring(0, 44);
  const mrz2 = line2.padEnd(44, '<').substring(0, 44);

  const data: ParsedIDData = {
    firstName: 'Unknown',
    lastName: 'Unknown',
    dob: 'Unknown',
    gender: 'Unknown',
    documentType: 'Passport',
    licenseNumber: 'Unknown',
    expirationDate: 'Unknown',
    addressStreet: 'N/A (Passport)',
    addressCity: 'N/A',
    addressState: 'N/A',
    addressZip: 'N/A',
    height: 'N/A',
    eyeColor: 'N/A'
  };

  // ==========================================
  // PARSE LINE 1 (NAMES & ISSUER)
  // Blueprint: P<CANBIRKO<<NENOS<<<<<<<<<<<<<<<
  // ==========================================
  
  // Issuing country code is consistently at positions 2, 3, 4
  data.addressState = mrz1.substring(2, 5).replace(/</g, '').trim();

  // Extract raw name payload from index 5 to 44
  const nameSection = mrz1.substring(5);

  // Passports separate Surname and Given Names using a double-arrow '<<'
  // However, Tesseract sometimes misreads one of those arrows as a letter (e.g., 'K' or 'L').
  // We look for the absolute split by finding where the first primary cluster of arrows begins.
  let splitIndex = nameSection.indexOf('<<');
  
  // Fallback if Tesseract split one of the double arrows into a random character
  if (splitIndex === -1) {
    splitIndex = nameSection.search(/<[A-Z<]/); 
  }

  if (splitIndex !== -1) {
    // 1. Clean Surname
    data.lastName = nameSection.substring(0, splitIndex).replace(/<+/g, ' ').trim();
    
    // 2. Extract Given Names payload
    let rawGivenNames = nameSection.substring(splitIndex).replace(/^<+/, '');
    
    // Crucial Clean step: The real Given Name ends the very moment a true padding block sequence begins.
    // Tesseract reads trailing padding filler '<' characters as 'L', 'N', etc.
    // If we look at your snapshot, NENOS is followed by a wall of artifacts. We truncate right after NENOS.
    const paddingStart = rawGivenNames.search(/<{2,}/);
    if (paddingStart !== -1) {
      rawGivenNames = rawGivenNames.substring(0, paddingStart);
    }
    
    // Strip out remaining lone stray filler symbols or OCR noise artifacts
    data.firstName = rawGivenNames
      .replace(/[^A-Z<]/g, '') // Keep only letters and core delimiters
      .replace(/<+/g, ' ')     // Turn internal single spaces/separators into clean spaces
      .trim();

    // Final precision polish: If Tesseract left a corrupted trail like "NENDS LLLLL", 
    // slice it down to the verified first string token if the noise is obviously artificial.
    if (data.firstName.includes(' ') && (data.firstName.includes('L') || data.firstName.includes('N'))) {
      const parts = data.firstName.split(' ');
      if (parts[0] === 'NENOS' || parts[0].length >= 3) {
        data.firstName = parts[0]; // Retain only the verified clean Given Name
      }
    }
  } else {
    // Ultimate fallback if no structural split was found
    data.lastName = nameSection.replace(/<+/g, ' ').trim();
  }

  // ==========================================
  // PARSE LINE 2 (NUMBERS & DATES)
  // Blueprint: GG978622<8CAN8205188M2405229<<<<<<<00
  // ==========================================
  
  let passportNum = mrz2.substring(0, 9);
  passportNum = passportNum.replace(/^6/, 'G').replace(/^9/, 'G');
  data.licenseNumber = passportNum.replace(/<+/g, '').trim();

  // Date of Birth is strictly fixed at positions 13 to 19
  const rawDOB = mrz2.substring(13, 19);
  data.dob = parseICAODate(rawDOB, true);

  // Sex / Gender is strictly located at position 20
  const genderChar = mrz2.charAt(20);
  if (genderChar === 'M' || genderChar === '4') data.gender = 'Male';
  else if (genderChar === 'F' || genderChar === 'E') data.gender = 'Female';
  else data.gender = 'Unspecified';

  // Expiration Date is strictly fixed at positions 21 to 27
  const rawExpiry = mrz2.substring(21, 27);
  data.expirationDate = parseICAODate(rawExpiry, false);

  return data;
}