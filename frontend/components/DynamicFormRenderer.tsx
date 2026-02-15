/**
 * DynamicFormRenderer
 * Renders a form dynamically based on a JSON schema.
 * Used for both Public Reports and Officer Inspections.
 */

import React, { useState, useEffect } from 'react';
import { FormField } from '../services/inehssService';
import LocationPicker from './LocationPicker';

interface DynamicFormRendererProps {
    schema: FormField[];
    onSubmit: (data: Record<string, any>) => void;
    initialData?: Record<string, any>;
    isSubmitting?: boolean;
    submitLabel?: string;
    showGpsField?: boolean;
    onLocationChange?: (location: { latitude: number; longitude: number }) => void;
    onSaveDraft?: (data: Record<string, any>) => void;
}

const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
    schema,
    onSubmit,
    initialData = {},
    isSubmitting = false,
    submitLabel = 'Submit Report',
    showGpsField = true,
    onLocationChange,
    onSaveDraft
}) => {
    const [formData, setFormData] = useState<Record<string, any>>(initialData);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Sync formData with initialData when it changes (e.g., from a draft)
    useEffect(() => {
        if (initialData && Object.keys(initialData).length > 0) {
            setFormData(initialData);
        }
    }, [initialData]);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);

    // Auto-detect GPS on mount
    useEffect(() => {
        if (showGpsField && navigator.geolocation) {
            setGettingLocation(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    setLocation(loc);
                    onLocationChange?.(loc);
                    setGettingLocation(false);
                },
                () => setGettingLocation(false),
                { enableHighAccuracy: true }
            );
        }
    }, [showGpsField, onLocationChange]);

    const handleChange = (fieldName: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
        if (errors[fieldName]) {
            setErrors(prev => ({ ...prev, [fieldName]: '' }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        schema.forEach(field => {
            if (field.required && !formData[field.name]) {
                newErrors[field.name] = `${field.label} is required`;
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(formData);
        }
    };

    const renderField = (field: FormField) => {
        const baseInputClass = "w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all";
        const errorClass = errors[field.name] ? "border-red-500" : "";

        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
                return (
                    <input
                        type={field.type}
                        className={`${baseInputClass} ${errorClass}`}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                    />
                );

            case 'textarea':
                return (
                    <textarea
                        className={`${baseInputClass} ${errorClass} min-h-[100px]`}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                    />
                );

            case 'select':
                return (
                    <select
                        className={`${baseInputClass} ${errorClass}`}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                    >
                        <option value="">Select {field.label}</option>
                        {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                );

            case 'multiselect':
                return (
                    <div className="space-y-2">
                        {field.options?.map(opt => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-green-500"
                                    checked={(formData[field.name] || []).includes(opt.value)}
                                    onChange={(e) => {
                                        const current = formData[field.name] || [];
                                        if (e.target.checked) {
                                            handleChange(field.name, [...current, opt.value]);
                                        } else {
                                            handleChange(field.name, current.filter((v: string) => v !== opt.value));
                                        }
                                    }}
                                />
                                <span className="text-slate-300">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'radio':
                return (
                    <div className="space-y-2">
                        {field.options?.map(opt => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name={field.name}
                                    className="w-4 h-4 accent-green-500"
                                    checked={formData[field.name] === opt.value}
                                    onChange={() => handleChange(field.name, opt.value)}
                                />
                                <span className="text-slate-300">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'checkbox':
                return (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="w-5 h-5 accent-green-500"
                            checked={formData[field.name] || false}
                            onChange={(e) => handleChange(field.name, e.target.checked)}
                        />
                        <span className="text-slate-300">{field.label}</span>
                    </label>
                );

            case 'file':
                const selectedFile = formData[field.name] as File | undefined;
                const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
                const isImage = !!selectedFile && selectedFile.type.startsWith('image/');
                const isVideo = !!selectedFile && selectedFile.type.startsWith('video/');

                return (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <label className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border rounded-lg cursor-pointer transition-all ${formData[field.name]
                                ? 'bg-green-600/20 border-green-500 text-green-400'
                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                }`}>
                                <input
                                    type="file"
                                    accept="image/*,video/*,application/pdf"
                                    className="hidden"
                                    onChange={(e) => handleChange(field.name, e.target.files?.[0])}
                                />
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                {formData[field.name] ? 'File Selected' : 'Upload File'}
                            </label>
                            <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700 text-slate-400 transition-all">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleChange(field.name, e.target.files?.[0])}
                                />
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Take Photo
                            </label>
                        </div>
                        {selectedFile && (
                            <div className="space-y-2">
                                <div className="text-xs text-green-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    {selectedFile.name}
                                </div>

                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                                    <p className="text-[11px] text-slate-400 mb-2">Preview</p>
                                    {isImage && previewUrl && (
                                        <img src={previewUrl} alt="Evidence preview" className="max-h-48 rounded border border-slate-700" />
                                    )}
                                    {isVideo && previewUrl && (
                                        <video src={previewUrl} controls className="max-h-56 rounded border border-slate-700" />
                                    )}
                                    {!isImage && !isVideo && (
                                        <p className="text-xs text-slate-400">Document selected. Preview not available.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return (
                    <input
                        type="text"
                        className={`${baseInputClass} ${errorClass}`}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                    />
                );
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* GPS Location Display */}
            {/* GPS / Location Picker */}
            {showGpsField && (
                <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Incident Location <span className="text-red-400">*</span>
                    </label>
                    <LocationPicker
                        initialLocation={location}
                        onLocationSelect={(loc) => {
                            setLocation(loc);
                            onLocationChange?.(loc);
                        }}
                    />
                </div>
            )}

            {/* Dynamic Fields */}
            {schema.map(field => (
                <div key={field.name} className="space-y-2">
                    {field.type !== 'checkbox' && (
                        <label className="block text-sm font-medium text-slate-300">
                            {field.label}
                            {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                    )}
                    {renderField(field)}
                    {field.helpText && (
                        <p className="text-xs text-slate-500">{field.helpText}</p>
                    )}
                    {errors[field.name] && (
                        <p className="text-xs text-red-400">{errors[field.name]}</p>
                    )}
                </div>
            ))}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                    </span>
                ) : (
                    submitLabel
                )}
            </button>

            {onSaveDraft && (
                <button
                    type="button"
                    onClick={() => onSaveDraft(formData)}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                >
                    Save as Draft
                </button>
            )}
        </form>
    );
};

export default DynamicFormRenderer;
