import { parseAAMVABarcode } from './barcodeParser';
import { parsePassportMRZ } from './passportParser'; // Import the new module
import { type ParsedIDData } from '../types/document';

export interface UnifiedScanResult {
  success: boolean;
  documentType: 'Driver License / ID' | 'Passport' | 'Unknown';
  data: ParsedIDData | null;
  error?: string;
}

export function routeAndParseDocument(rawText: string): UnifiedScanResult {
  const cleanText = rawText.trim();

  if (!cleanText) {
    return { success: false, documentType: 'Unknown', data: null, error: 'Empty payload.' };
  }

  // 1. ROUTE TO AAMVA BARCODE PARSER
  if (cleanText.startsWith('@') && cleanText.includes('ANSI')) {
    try {
      const parsedData = parseAAMVABarcode(cleanText);
      return { success: true, documentType: 'Driver License / ID', data: parsedData };
    } catch (err) {
      return { success: false, documentType: 'Driver License / ID', data: null, error: 'Malformed barcode footprint.' };
    }
  }

  // 2. ROUTE TO GLOBAL PASSPORT MRZ PARSER
  // Cleans strings to check if line starts with 'P<' or has a clear passport string footprint
  const lines = cleanText.split(/[\r\n]+/).map(l => l.trim());
  const firstLine = lines[0] || '';
  
  if (firstLine.startsWith('P<') || (cleanText.length === 88 && cleanText.startsWith('P'))) {
    try {
      const parsedPassport = parsePassportMRZ(cleanText);
      return {
        success: true,
        documentType: 'Passport',
        data: parsedPassport
      };
    } catch (err: any) {
      return {
        success: false,
        documentType: 'Passport',
        data: null,
        error: err.message || 'Failed processing passport line constraints.'
      };
    }
  }

  return { success: false, documentType: 'Unknown', data: null, error: 'Unrecognized data pattern.' };
}