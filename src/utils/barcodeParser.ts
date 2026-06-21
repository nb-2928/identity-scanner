import { type ParsedIDData } from '../types/document';
/**
 * Normalizes AAMVA date fields into a clean YYYY-MM-DD format.
 * Dynamically detects if the 4-digit year is at the front or the back.
 */
function normalizeAAMVADate(rawDate: string): string {
  const cleanStr = rawDate.trim();
  if (cleanStr.length !== 8) return cleanStr;

  // Check if first 4 characters represent a valid year block
  if (parseInt(cleanStr.substring(0, 4)) > 1900) {
    return `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}`;
  } 
  // Otherwise, safely assume the year is positioned at the trailing end
  else {
    return `${cleanStr.substring(4, 8)}-${cleanStr.substring(0, 2)}-${cleanStr.substring(2, 4)}`;
  }
}

/**
 * Parses raw AAMVA compliant PDF417 barcode strings.
 */
export function parseAAMVABarcode(rawText: string): ParsedIDData {
  const data: ParsedIDData = {
    firstName: 'Unknown',
    lastName: 'Unknown',
    dob: 'Unknown',
    gender: 'Unknown',
    documentType: 'Driver License / ID',
    licenseNumber: 'Unknown',
    expirationDate: 'Unknown',
    addressStreet: 'Unknown',
    addressCity: 'Unknown',
    addressState: 'Unknown',
    addressZip: 'Unknown',
    height: 'Unknown',
    eyeColor: 'Unknown'
  };

  // 1. Extract Name Fields
  const lastNameMatch = rawText.match(/DCS([^\n\r]+)/) || rawText.match(/DAB([^\n\r]+)/);
  if (lastNameMatch) data.lastName = lastNameMatch[1].trim();

  const firstNameMatch = rawText.match(/DAC([^\n\r]+)/) || rawText.match(/DCT([^\n\r]+)/);
  if (firstNameMatch) data.firstName = firstNameMatch[1].trim();

  if (data.firstName === 'Unknown' && data.lastName === 'Unknown') {
    const combinedNameMatch = rawText.match(/DAA([^\n\r]+)/);
    if (combinedNameMatch) {
      const parts = combinedNameMatch[1].split(',');
      if (parts.length >= 2) {
        data.lastName = parts[0].trim();
        data.firstName = parts[1].trim();
      } else {
        data.firstName = combinedNameMatch[1].trim();
      }
    }
  }

  // 2. Extract Date Fields via the normalization helper
  const dobMatch = rawText.match(/DBB([^\n\r]+)/);
  if (dobMatch) data.dob = normalizeAAMVADate(dobMatch[1]);

  const expMatch = rawText.match(/DBA([^\n\r]+)/);
  if (expMatch) data.expirationDate = normalizeAAMVADate(expMatch[1]);

  // 3. Extract Gender (DBC)
  const genderMatch = rawText.match(/DBC([^\n\r]+)/);
  if (genderMatch) {
    const val = genderMatch[1].trim();
    if (val === '1' || val.toUpperCase() === 'M') data.gender = 'Male';
    else if (val === '2' || val.toUpperCase() === 'F') data.gender = 'Female';
    else data.gender = val;
  }

  // 4. Extract Identity & Physical Fields
  const idMatch = rawText.match(/DAQ([^\n\r]+)/);
  if (idMatch) data.licenseNumber = idMatch[1].trim();

  const heightMatch = rawText.match(/DAU([^\n\r]+)/);
  if (heightMatch) data.height = heightMatch[1].trim();

  const eyeMatch = rawText.match(/DAY([^\n\r]+)/);
  if (eyeMatch) data.eyeColor = eyeMatch[1].trim();

  // 5. Extract Address Segments
  const streetMatch = rawText.match(/DAG([^\n\r]+)/);
  if (streetMatch) data.addressStreet = streetMatch[1].trim();

  const cityMatch = rawText.match(/DAI([^\n\r]+)/);
  if (cityMatch) data.addressCity = cityMatch[1].trim();

  const stateMatch = rawText.match(/DAJ([^\n\r]+)/);
  if (stateMatch) data.addressState = stateMatch[1].trim();

  const zipMatch = rawText.match(/DAK([^\n\r]+)/);
  if (zipMatch) data.addressZip = zipMatch[1].trim();

  return data;
}