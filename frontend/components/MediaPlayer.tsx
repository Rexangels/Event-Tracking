import React, { useState } from 'react';
import { MediaAttachment } from '../types';

interface MediaPlayerProps {
    media: MediaAttachment[];
    className?: string;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ media, className = '' }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    if (!media || media.length === 0) {
        return (
            <div className={`flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800 p-8 ${className}`}>
                <div className="text-center text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-mono uppercase tracking-widest">NO MEDIA ATTACHED</span>
                </div>
            </div>
        );
    }

    const currentMedia = media[currentIndex];
    const getMediaUrl = (file: string) => {
        if (!file) return '';
        if (file.startsWith('http')) return file;

        const backendHost = `${window.location.protocol}//${window.location.hostname}:8000`;

        // If the path already includes /media/, just prepend the host
        if (file.startsWith('/media/')) {
            return `${backendHost}${file}`;
        }

        // If it starts with / (but not /media/), prepend /media
        if (file.startsWith('/')) {
            return `${backendHost}/media${file}`;
        }

        // Otherwise it's a relative path, prepend /media/
        return `${backendHost}/media/${file}`;
    };

    const renderMedia = (item: MediaAttachment, isFullscreen = false) => {
        const url = getMediaUrl(item.file);
        const containerClass = isFullscreen
            ? 'max-h-[80vh] max-w-[90vw]'
            : 'w-full h-48 object-cover rounded-lg';

        switch (item.file_type) {
            case 'image':
                return (
                    <img
                        src={url}
                        alt="Event media"
                        className={`${containerClass} cursor-pointer transition-transform hover:scale-[1.02]`}
                        onClick={() => !isFullscreen && setIsLightboxOpen(true)}
                    />
                );
            case 'video':
                return (
                    <video
                        src={url}
                        controls
                        className={containerClass}
                        preload="metadata"
                    >
                        Your browser does not support video playback.
                    </video>
                );
            case 'audio':
                return (
                    <div className="w-full p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs text-slate-400 font-mono">AUDIO FILE</div>
                                <div className="text-[10px] text-slate-600">{item.metadata?.duration || 'Unknown duration'}</div>
                            </div>
                        </div>
                        <audio src={url} controls className="w-full" preload="metadata">
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                );
            default:
                return (
                    <div className="w-full p-4 bg-slate-800/50 rounded-lg text-center text-slate-500">
                        <span className="text-xs font-mono">UNSUPPORTED FORMAT: {item.file_type}</span>
                    </div>
                );
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* Main Media Display */}
            <div className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                {renderMedia(currentMedia)}

                {/* Navigation Arrows */}
                {media.length > 1 && (
                    <>
                        <button
                            onClick={() => setCurrentIndex((i) => (i - 1 + media.length) % media.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setCurrentIndex((i) => (i + 1) % media.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </>
                )}

                {/* Media Type Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-[9px] font-mono text-white uppercase tracking-widest">
                    {currentMedia.file_type}
                </div>
            </div>

            {/* Thumbnails */}
            {media.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                    {media.map((item, idx) => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-12 h-12 rounded overflow-hidden border-2 transition-all shrink-0 ${idx === currentIndex
                                ? 'border-blue-500 ring-2 ring-blue-500/30'
                                : 'border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100'
                                }`}
                        >
                            {item.file_type === 'image' ? (
                                <img src={getMediaUrl(item.file)} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                    <span className="text-[8px] text-slate-400 uppercase">{item.file_type}</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox Modal */}
            {isLightboxOpen && currentMedia.file_type === 'image' && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white"
                        onClick={() => setIsLightboxOpen(false)}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    {renderMedia(currentMedia, true)}
                </div>
            )}
        </div>
    );
};

export default MediaPlayer;
