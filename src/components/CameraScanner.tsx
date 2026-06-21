import React, { useRef, useState, useEffect } from 'react';

interface CameraScannerProps {
  onCapture: (imageSrc: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Camera permission denied or unavailable.");
        console.error(err);
      }
    }

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureFrame = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      onCapture(dataUrl);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
      {error ? (
        <div style={{ color: '#ff4d4d', padding: '20px' }}>{error}</div>
      ) : (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', border: '2px solid #333' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', display: 'block', backgroundColor: '#000' }} 
          />
          
          {/* Document Framing Overlay */}
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '8%',
            right: '8%',
            bottom: '20%',
            border: '3px dashed #00ff00',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none'
          }} />
          
          <button 
            onClick={captureFrame}
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '14px 28px',
              backgroundColor: '#00ff00',
              color: '#000',
              border: 'none',
              borderRadius: '30px',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,255,0,0.3)'
            }}
          >
            CAPTURE DOCUMENT
          </button>
        </div>
      )}
    </div>
  );
};