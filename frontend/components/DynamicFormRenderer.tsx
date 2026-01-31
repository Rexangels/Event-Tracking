/**
 * DynamicFormRenderer
 * Renders a form dynamically based on a JSON schema.
 * Used for both Public Reports and Officer Inspections.
 */

import React, { useState, useEffect } from 'react';
import { FormField } from '../services/inehssService';

interface DynamicFormRendererProps {
    schema: FormField[];
    onSubmit: (data: Record<string, any>) => void;
    initialData?: Record<string, any>;
    isSubmitting?: boolean;
    submitLabel?: string;
    showGpsField?: boolean;
    onLocationChange?: (location: { latitude: number; longitude: number }) => void;
}

const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
    schema,
    onSubmit,
    initialData = {},
    isSubmitting = false,
    submitLabel = 'Submit Report',
    showGpsField = true,
    onLocationChange
}) => {
    const [formData, setFormData] = useState<Record<string, any>>(initialData);
    const [errors, setErrors] = useState<Record<string, string>>({});
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
                return (
                    <input
                        type="file"
                        className={`${baseInputClass} ${errorClass} file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-600 file:text-white hover:file:bg-green-700`}
                        onChange={(e) => handleChange(field.name, e.target.files?.[0])}
                    />
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
            {showGpsField && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-300">Location</span>
                    </div>
                    {gettingLocation ? (
                        <p className="text-slate-400 text-sm">Detecting your location...</p>
                    ) : location ? (
                        <p className="text-green-400 text-sm font-mono">
                            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </p>
                    ) : (
                        <p className="text-yellow-400 text-sm">Location not available. Please enable GPS.</p>
                    )}
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
        </form>
    );
};

export default DynamicFormRenderer;
