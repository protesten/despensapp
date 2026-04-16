import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const stop = useCallback(() => {
    readerRef.current?.reset();
    readerRef.current = null;
  }, []);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(null, videoRef.current!, (result, err) => {
        if (result) {
          const code = result.getText();
          stop();
          onDetected(code);
        }
        // Ignore NotFoundException — it fires continuously while scanning
      })
      .then(() => setStarting(false))
      .catch((e) => {
        setStarting(false);
        if (e?.name === "NotAllowedError") {
          setError("Permiso de cámara denegado. Actívalo en los ajustes del navegador.");
        } else if (e?.name === "NotFoundError") {
          setError("No se encontró ninguna cámara.");
        } else {
          setError("No se pudo acceder a la cámara.");
        }
      });

    return stop;
  }, [onDetected, stop]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
        />
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-sm text-white animate-pulse">Iniciando cámara…</p>
          </div>
        )}
        {/* Scan guide overlay */}
        {!error && !starting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[70%] h-24 border-2 border-white/70 rounded-lg" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Apunta al código de barras del producto. Se detectará automáticamente.
      </p>

      <Button type="button" variant="outline" className="w-full" onClick={() => { stop(); onClose(); }}>
        Cancelar escaneo
      </Button>
    </div>
  );
}
