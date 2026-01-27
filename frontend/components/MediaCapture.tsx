import React, { useRef, useState, useEffect } from 'react';

interface MediaCaptureProps {
    onCapture: (file: File) => void;
}

const MediaCapture: React.FC<MediaCaptureProps> = ({ onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setIsCameraActive(true);

            // Wait for state update and ref to be available
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.play().catch(e => console.error("Error playing video:", e));
                }
            }, 100);
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Unable to access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCameraActive(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                        onCapture(file);
                        setCapturedImage(URL.createObjectURL(blob));
                        stopCamera();
                    }
                }, 'image/jpeg');
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            onCapture(file);
            setCapturedImage(URL.createObjectURL(file));
        }
    };

    useEffect(() => {
        return () => {
            stopCamera(); // Cleanup on unmount
        };
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                {isCameraActive ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : capturedImage ? (
                    <img
                        src={capturedImage}
                        alt="Captured evidence"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-sm font-mono">No Media Captured</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                {!isCameraActive && !capturedImage && (
                    <button
                        onClick={startCamera}
                        className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm transition-colors uppercase tracking-widest"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Activate Cam
                    </button>
                )}

                {isCameraActive && (
                    <button
                        onClick={capturePhoto}
                        className="col-span-2 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 rounded font-bold text-sm transition-colors uppercase tracking-widest animate-pulse"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        CAPTURE_NOW
                    </button>
                )}

                {capturedImage && (
                    <button
                        onClick={() => {
                            setCapturedImage(null);
                            startCamera();
                        }}
                        className="py-3 bg-slate-800 hover:bg-slate-700 rounded font-bold text-xs transition-colors uppercase tracking-widest"
                    >
                        Retake
                    </button>
                )}

                <label className={`flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 rounded font-bold text-sm transition-colors uppercase tracking-widest cursor-pointer ${isCameraActive ? 'opacity-50 pointer-events-none' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Upload File
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                </label>
            </div>
        </div>
    );
};

export default MediaCapture;
