import { useState, useEffect, useRef } from 'react';
import { CameraScanner } from './components/CameraScanner';
import { type ParsedIDData } from  './types/document';
import { routeAndParseDocument } from './utils/documentRouter';
import { Html5Qrcode } from 'html5-qrcode';

function App() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedIDData | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('');
  
  // New States to control popup visibility and layout type tracker
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);
  const [activeDocType, setActiveDocType] = useState<'Driver License / ID' | 'Passport' | 'Unknown'>('Unknown');
  
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    try {
      const scanner = new Html5Qrcode("hidden-reader-target");
      qrScannerRef.current = scanner;
    } catch (err) {
      console.error("Failed to pre-initialize Html5Qrcode:", err);
    }

    return () => {
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current.clear();
      }
    };
  }, []);

  const processImageEngine = async (imageSrc: string) => {
    setScanStatus('Analyzing image for barcodes...');
    setParsedData(null);

    if (!qrScannerRef.current) {
      setScanStatus('Scanner engine failed to initialize.');
      return;
    }

    try {
      const base64Response = await fetch(imageSrc);
      const blob = await base64Response.blob();
      const fileObject = new File([blob], "snapshot.jpg", { type: "image/jpeg" });

      try {
        // LAYER A: Barcode Scanner
        const barcodeResult = await qrScannerRef.current.scanFile(fileObject);
        const routingResult = routeAndParseDocument(barcodeResult);

        if (routingResult.success && routingResult.data) {
          setParsedData(routingResult.data);
          setActiveDocType(routingResult.documentType);
          setScanStatus(`✓ ${routingResult.documentType} processed successfully via Barcode!`);
          setIsPopupOpen(true); // Open the modal automatically on success!
          return; 
        }
} catch (barcodeErr) {
        // ENGINE LAYER B: Run OCR text fallback loop
        setScanStatus('No barcode detected. Running Optical Character Recognition (OCR)...');
        
        const Tesseract = await import('tesseract.js');
        const ocrResult = await Tesseract.recognize(imageSrc, 'eng');
        const extractedText = ocrResult.data.text;
        
        console.log("--- OCR RAW TEXT DETECTED --- \n", extractedText);

        // Advanced string preprocessing pipeline
        const cleanLines = extractedText
          .split(/[\r\n]+/)
          .map(line => line.trim().toUpperCase())
          // Replace common shape-based reading mistakes to preserve the arrows
          .map(line => line.replace(/[{}]/g, '<').replace(/\(/g, '<').replace(/\)/g, '<'))
          // Remove internal single empty space blocks that throw off positional offsets
          .map(line => line.replace(/\s+/g, ''))
          .filter(line => line.length >= 25); // preserve smaller line configurations if read cleanly

        let passportLine1 = '';
        let passportLine2 = '';

        for (let i = 0; i < cleanLines.length; i++) {
          const currentLine = cleanLines[i];
          // Look for line starting with P followed by character tokens or standard format arrows
          if (currentLine.startsWith('P<') || /^P[A-Z<]{3,5}/.test(currentLine)) {
            passportLine1 = currentLine;
            if (cleanLines[i + 1]) {
              passportLine2 = cleanLines[i + 1];
            }
            break;
          }
        }

        if (passportLine1 && passportLine2) {
          // Send raw lines combined straight to the router
          const reconstructedMRZ = `${passportLine1}\n${passportLine2}`;
          const routingResult = routeAndParseDocument(reconstructedMRZ);

          if (routingResult.success && routingResult.data) {
            setParsedData(routingResult.data);
            setActiveDocType(routingResult.documentType);
            setScanStatus('✓ Passport MRZ scanned successfully via OCR!');
            setIsPopupOpen(true);
            return;
          }
        }
        
        throw new Error('OCR text recognition did not find valid passport format rows.');
      }
    } catch (err: any) {
      setScanStatus('Could not find a valid barcode or passport MRZ text. Ensure document text is straight and clearly lit.');
    }
  };

  const handleCapture = (imageSrc: string) => {
    setCapturedImage(imageSrc);
    processImageEngine(imageSrc);
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      setCapturedImage(base64Str);
      processImageEngine(base64Str);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ 
      padding: '40px 20px', 
      textAlign: 'center', 
      fontFamily: 'system-ui, sans-serif', 
      backgroundColor: '#1a1a1a', 
      color: '#fff',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <h1 style={{ color: '#00ff00', marginBottom: '10px' }}>Edge ID & Passport Scanner</h1>
      <p style={{ color: '#aaa', marginBottom: '30px' }}>Align your ID card or passport within the frame and capture.</p>
      
      <div id="hidden-reader-target" style={{ display: 'none' }}></div>

      <div style={{ marginBottom: '25px', backgroundColor: '#2a2a2a', padding: '12px', borderRadius: '8px', display: 'inline-block' }}>
        <span style={{ marginRight: '10px', fontSize: '14px', color: '#ccc' }}>Sandbox Bypass:</span>
        <input type="file" accept="image/*" onChange={handleManualUpload} style={{ color: '#aaa', fontSize: '14px' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
        <div>
          <CameraScanner onCapture={handleCapture} />
          {scanStatus && (
            <p style={{ 
              marginTop: '15px', 
              color: scanStatus.startsWith('✓') ? '#00ff00' : '#ffea00',
              fontWeight: '500',
              maxWidth: '640px',
              textAlign: 'center'
            }}>{scanStatus}</p>
          )}
        </div>
      </div>

      {/* ==================== POPUP MODAL ARCHITECTURE LAYER ==================== */}
      {isPopupOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            
            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '12px', marginBottom: '20px' }}>
              <h2 style={{ color: '#00ff00', margin: 0, fontSize: '20px' }}>Extracted Fields ({activeDocType})</h2>
              <button onClick={() => setIsPopupOpen(false)} style={closeButtonStyle}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* LAYOUT OPTION A: DRIVER'S LICENSE STRUCTURAL POPUP */}
              {activeDocType === 'Driver License / ID' && (
                <>
                  <div>
                    <label style={labelStyle}>LICENSE / ID NUMBER</label>
                    <input type="text" readOnly value={parsedData?.licenseNumber || ''} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>EXPIRATION DATE</label>
                    <input type="text" readOnly value={parsedData?.expirationDate || ''} style={inputStyle} />
                  </div>

                  <hr style={dividerStyle} />

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>FIRST NAME</label>
                      <input type="text" readOnly value={parsedData?.firstName || ''} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>LAST NAME</label>
                      <input type="text" readOnly value={parsedData?.lastName || ''} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>DATE OF BIRTH</label>
                      <input type="text" readOnly value={parsedData?.dob || ''} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>GENDER</label>
                      <input type="text" readOnly value={parsedData?.gender || ''} style={inputStyle} />
                    </div>
                  </div>

                  <hr style={dividerStyle} />

                  <div>
                    <label style={labelStyle}>STREET ADDRESS</label>
                    <input type="text" readOnly value={parsedData?.addressStreet || ''} style={inputStyle} />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>CITY</label>
                      <input type="text" readOnly value={parsedData?.addressCity || ''} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>STATE</label>
                      <input type="text" readOnly value={parsedData?.addressState || ''} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <label style={labelStyle}>ZIP CODE</label>
                      <input type="text" readOnly value={parsedData?.addressZip || ''} style={inputStyle} />
                    </div>
                  </div>

                  <hr style={dividerStyle} />

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>HEIGHT</label>
                      <input type="text" readOnly value={parsedData?.height || ''} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>EYE COLOR</label>
                      <input type="text" readOnly value={parsedData?.eyeColor || ''} style={inputStyle} />
                    </div>
                  </div>
                </>
              )}

              {/* LAYOUT OPTION B: PASSPORT UNIQUE POPUP */}
              {activeDocType === 'Passport' && (
                <>
                  <div>
                    <label style={labelStyle}>PASSPORT NUMBER</label>
                    <input type="text" readOnly value={parsedData?.licenseNumber || ''} style={passportInputStyle} />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>ISSUING COUNTRY / STATE</label>
                      <input type="text" readOnly value={parsedData?.addressState || ''} style={passportInputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>EXPIRATION DATE</label>
                      <input type="text" readOnly value={parsedData?.expirationDate || ''} style={passportInputStyle} />
                    </div>
                  </div>

                  <hr style={dividerStyle} />

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>SURNAME (LAST NAME)</label>
                      <input type="text" readOnly value={parsedData?.lastName || ''} style={passportInputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>GIVEN NAMES (FIRST NAME)</label>
                      <input type="text" readOnly value={parsedData?.firstName || ''} style={passportInputStyle} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>DATE OF BIRTH</label>
                      <input type="text" readOnly value={parsedData?.dob || ''} style={passportInputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>SEX / GENDER</label>
                      <input type="text" readOnly value={parsedData?.gender || ''} style={passportInputStyle} />
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: '#253525', padding: '10px', borderRadius: '6px', border: '1px solid #3c5c3c', fontSize: '13px', color: '#8cd98c', marginTop: '10px' }}>
                    ℹ International passports do not specify physical metrics (height/eyes) or residential addresses inside machine-readable strings.
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {capturedImage && (
        <div style={{ marginTop: '50px', borderTop: '1px solid #333', paddingTop: '30px' }}>
          <h3 style={{ color: '#aaa' }}>Last Captured Frame Snapshot:</h3>
          <img src={capturedImage} alt="Canvas processing frame stream" style={{ maxWidth: '320px', borderRadius: '8px', border: '2px solid #444' }} />
        </div>
      )}
    </div>
  );
}

// Styling components
const labelStyle = {
  color: '#888',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: '4px'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: '#1a1a1a',
  border: '1px solid #555',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '15px',
  boxSizing: 'border-box' as const
};

// Custom layout palette to separate Passport profiles visually 
const passportInputStyle = {
  ...inputStyle,
  backgroundColor: '#1d222a',
  border: '1px solid #4a5a70'
};

const dividerStyle = {
  border: 'none',
  borderTop: '1px solid #444',
  margin: '10px 0'
};

// Modal Overlay (Blur background behind modal)
const modalOverlayStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
  padding: '20px'
};

// Modal Window wrapper properties
const modalContentStyle = {
  backgroundColor: '#2d2d2d',
  padding: '28px',
  borderRadius: '14px',
  width: '100%',
  maxWidth: '480px',
  textAlign: 'left' as const,
  border: '1px solid #555',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  position: 'relative' as const
};

const closeButtonStyle = {
  backgroundColor: 'transparent',
  border: 'none',
  color: '#aaa',
  fontSize: '20px',
  cursor: 'pointer',
  padding: '4px',
  position: 'absolute' as const,
  top: '24px',
  right: '24px'
};

export default App;