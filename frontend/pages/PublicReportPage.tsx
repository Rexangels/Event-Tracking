/**
 * PublicReportPage
 * Public-facing page for citizens to submit hazard reports.
 * Uses DynamicFormRenderer to display forms based on the selected template.
 */

import React, { useState, useEffect } from 'react';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import { getPublicForms, getFormSchema, submitPublicReport, trackReport, FormTemplate } from '../services/inehssService';

const PublicReportPage: React.FC = () => {
    const [forms, setForms] = useState<FormTemplate[]>([]);
    const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionResult, setSubmissionResult] = useState<{ tracking_id: string; message: string } | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Track report state
    const [trackingId, setTrackingId] = useState('');
    const [trackResult, setTrackResult] = useState<{ status: string; created_at: string } | null>(null);
    const [showTracker, setShowTracker] = useState(false);

    useEffect(() => {
        loadForms();
    }, []);

    const loadForms = async () => {
        setIsLoading(true);
        try {
            const data = await getPublicForms();
            setForms(data);
        } catch (err) {
            setError('Failed to load forms. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectForm = async (formId: string) => {
        setIsLoading(true);
        try {
            const schema = await getFormSchema(formId);
            setSelectedForm(schema);
            setSubmissionResult(null);
        } catch (err) {
            setError('Failed to load form. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (data: Record<string, any>) => {
        if (!selectedForm) return;

        setIsSubmitting(true);
        setError(null);
        try {
            const result = await submitPublicReport(
                selectedForm.id,
                data,
                location ? { latitude: location.latitude, longitude: location.longitude } : undefined
            );
            setSubmissionResult(result);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Submission failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTrack = async () => {
        if (!trackingId.trim()) return;
        try {
            const result = await trackReport(trackingId.trim());
            setTrackResult(result);
        } catch {
            setTrackResult(null);
            setError('Report not found. Please check your tracking ID.');
        }
    };

    // Success Screen
    if (submissionResult) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 text-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Report Submitted!</h2>
                    <p className="text-slate-400 mb-6">{submissionResult.message}</p>
                    <div className="bg-slate-900 rounded-lg p-4 mb-6">
                        <p className="text-sm text-slate-500 mb-1">Your Tracking ID</p>
                        <p className="text-2xl font-mono font-bold text-green-400">{submissionResult.tracking_id}</p>
                    </div>
                    <p className="text-xs text-slate-500 mb-6">Save this ID to check the status of your report later.</p>
                    <button
                        onClick={() => {
                            setSubmissionResult(null);
                            setSelectedForm(null);
                        }}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                    >
                        Submit Another Report
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">INEHSS</h1>
                            <p className="text-xs text-slate-400">Environmental Hazard Surveillance</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowTracker(!showTracker)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-all"
                    >
                        {showTracker ? 'Submit Report' : 'Track Report'}
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Error Display */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
                    </div>
                )}

                {/* Track Report Section */}
                {showTracker ? (
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Track Your Report</h2>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Enter Tracking ID (e.g., INH-20260130-1234)"
                                value={trackingId}
                                onChange={(e) => setTrackingId(e.target.value)}
                                className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                                onClick={handleTrack}
                                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-all"
                            >
                                Track
                            </button>
                        </div>
                        {trackResult && (
                            <div className="mt-6 bg-slate-900 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-400">Status</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${trackResult.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                            trackResult.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {trackResult.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Submitted</span>
                                    <span className="text-slate-300">{new Date(trackResult.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full" />
                    </div>
                ) : selectedForm ? (
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                        <button
                            onClick={() => setSelectedForm(null)}
                            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors sticky top-0 z-10"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Forms
                        </button>
                        <h2 className="text-xl font-bold text-white mb-2">{selectedForm.name}</h2>
                        <p className="text-slate-400 mb-6">{selectedForm.description}</p>
                        <DynamicFormRenderer
                            schema={selectedForm.schema}
                            onSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                            onLocationChange={setLocation}
                        />
                    </div>
                ) : (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-6">Report an Environmental Hazard</h2>
                        <p className="text-slate-400 mb-8">Select the type of hazard you want to report:</p>
                        <div className="grid gap-4">
                            {forms.map(form => (
                                <button
                                    key={form.id}
                                    onClick={() => handleSelectForm(form.id)}
                                    className="w-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-green-500/50 rounded-xl p-6 text-left transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-green-500/20 group-hover:bg-green-500/30 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white group-hover:text-green-400 transition-colors">{form.name}</h3>
                                            <p className="text-sm text-slate-400 mt-1">{form.description}</p>
                                        </div>
                                        <svg className="w-5 h-5 text-slate-500 group-hover:text-green-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
                            {forms.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <p>No report forms available at this time.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-auto py-6 border-t border-slate-800">
                <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
                    <p>Powered by NESREA • Integrated National Environmental Health Surveillance System</p>
                </div>
            </footer>
        </div>
    );
};

export default PublicReportPage;
