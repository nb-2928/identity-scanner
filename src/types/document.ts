export interface ParsedIDData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  documentType: 'Driver License / ID' | 'Passport' | 'Unknown'; 
  licenseNumber: string;
  expirationDate: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  height?: string;
  eyeColor?: string;
}

export interface DocumentRoutingResult {
  success: boolean;
  documentType: 'Driver License / ID' | 'Passport' | 'Unknown';
  data: ParsedIDData | null;
  error?: string;
}