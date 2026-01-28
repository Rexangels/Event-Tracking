import React, { useState } from 'react';

interface EscalationFormProps {
    onEscalate: (level: string, reason: string) => void;
    onCancel: () => void;
}

const EscalationForm: React.FC<EscalationFormProps> = ({ onEscalate, onCancel }) => {
    const [level, setLevel] = useState('REGIONAL_HQ');
    const [reason, setReason] = useState('');

    const levels = [
        { id: 'REGIONAL_HQ', name: 'Regional Headquarters', icon: '📍' },
        { id: 'NATIONAL_COMMAND', name: 'National Command Center', icon: '🏛️' },
        { id: 'TACTICAL_RESPONSE', name: 'Tactical Response Unit', icon: '🛡️' },
        { id: 'SPECIAL_AFFAIRS', name: 'Special Affairs Division', icon: '👁️' }
    ];

    return (
        <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-5 animate-in zoom-in-95 duration-200">
            <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Strategic Escalation Protocol
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold mb-2 block">Authority Level</label>
                    <div className="grid grid-cols-1 gap-2">
                        {levels.map(l => (
                            <button
                                key={l.id}
                                onClick={() => setLevel(l.id)}
                                className={`flex items-center gap-3 p-3 rounded border text-left transition-all ${level === l.id
                                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                            >
                                <span className="text-lg">{l.icon}</span>
                                <div className="text-xs font-bold leading-none">{l.name}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold mb-2 block">Justification</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="State reason for escalation..."
                        className="w-full h-20 bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-300 focus:border-amber-500/50 outline-none transition-colors resize-none"
                    />
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        onClick={() => onEscalate(level, reason)}
                        disabled={!reason.trim()}
                        className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest rounded transition-colors"
                    >
                        Confirm Escalation
                    </button>
                    <button
                        onClick={onCancel}
                        className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest rounded transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[8px] text-slate-600 font-mono italic">
                NOTICE: Escalation triggers automated protocol sequence [SOP-7].
            </div>
        </div>
    );
};

export default EscalationForm;
