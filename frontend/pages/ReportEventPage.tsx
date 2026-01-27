import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MediaCapture from '../components/MediaCapture';
import { createEvent } from '../services/eventService';
import { EventSeverity } from '../types';

const ReportEventPage: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number; acc: number } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState<EventSeverity>(EventSeverity.LOW);
    const [category, setCategory] = useState('HUMAN_REPORT');

    useEffect(() => {
        // Auto-capture location on mount
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        acc: position.coords.accuracy
                    });
                },
                (err) => console.error("Location error:", err),
                { enableHighAccuracy: true }
            );
        }
    }, []);

    const handleCapture = (capturedFile: File) => {
        setFile(capturedFile);
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('severity', severity);
        formData.append('category', category);

        if (location) {
            formData.append('latitude', location.lat.toString());
            formData.append('longitude', location.lng.toString());
            formData.append('accuracy', location.acc.toString());
        }

        if (file) {
            formData.append('files', file);
        }

        const result = await createEvent(formData);

        if (result) {
            // Success animation or redirect
            navigate('/admin'); // Redirect to dashboard to see report
        } else {
            alert("Failed to submit report. Please try again.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex flex-col">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Report Incident</h1>
                    <p className="text-sm text-slate-400">Secure Field Reporting Channel</p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-500">ID: ANON-USER</div>
                    <div className="flex items-center justify-end gap-2 text-[10px] uppercase font-bold text-emerald-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Secure Link Active
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-md mx-auto w-full">
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Step 1: Capture Evidence</h2>
                        <MediaCapture onCapture={handleCapture} />
                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setStep(2)}
                                className="text-sm text-slate-500 underline hover:text-slate-300"
                            >
                                Skip media capture
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Step 2: Incident Details</h2>

                        {/* Location Status */}
                        <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${location ? 'bg-blue-600' : 'bg-slate-800'}`}>
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-300">
                                    {location ? 'Location Locked' : 'Acquiring Satellites...'}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">
                                    {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Triangulating position via GPS/GLONASS'}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Title / Code</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded p-3 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                                    placeholder="e.g. Unusual Activity Sector 7"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded p-3 text-sm focus:border-blue-500 focus:outline-none transition-colors min-h-[100px]"
                                    placeholder="Describe current situation..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Severity</label>
                                    <select
                                        value={severity}
                                        onChange={e => setSeverity(e.target.value as EventSeverity)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded p-3 text-sm focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Type</label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded p-3 text-sm focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="HUMAN_REPORT">Human Intel</option>
                                        <option value="SENSORY">Sensory Data</option>
                                        <option value="ENVIRONMENTAL">Environmental</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded font-bold text-sm transition-colors uppercase tracking-widest"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`flex-[2] py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm transition-colors uppercase tracking-widest flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Transmitting...
                                    </>
                                ) : (
                                    'Submit Report'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </main>
        </div>
    );
};

export default ReportEventPage;
