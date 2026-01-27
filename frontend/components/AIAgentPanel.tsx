
import React, { useState, useEffect } from 'react';
import { IntelligenceEvent } from '../types';
import { getEventExplanation } from '../services/geminiService';

interface AIAgentPanelProps {
  selectedEvent: IntelligenceEvent | null;
}

const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ selectedEvent }) => {
  const [explanation, setExplanation] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (selectedEvent) {
      setLoading(true);
      setExplanation("");
      getEventExplanation(selectedEvent).then(res => {
        setExplanation(res);
        setLoading(false);
      });
    }
  }, [selectedEvent]);

  if (!selectedEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-950/50 rounded-lg border border-slate-800 border-dashed">
        <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <p className="text-sm text-slate-400 font-medium">Select an event from the stream to initialize Agent Synthesis.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Explainability Agent V3.1</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">ID: AI-GEN-SENTINEL</div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        <div>
          <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Event Context</h4>
          <div className="p-3 bg-slate-900/50 rounded border border-slate-800 text-xs text-slate-300 leading-relaxed italic">
            "{selectedEvent.description}"
          </div>
        </div>

        <div>
          <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Agent Reasoning Output</h4>
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-[90%]"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-[95%]"></div>
              <div className="h-3 bg-slate-800 rounded animate-pulse w-[40%]"></div>
            </div>
          ) : (
            <div className="text-sm text-slate-300 leading-relaxed space-y-3 font-light">
              {explanation.split('\n').map((line, i) => line.trim() ? <p key={i}>{line}</p> : null)}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[9px] text-slate-600 font-mono">MODE: READ_ONLY_ASSISTIVE</span>
        <button className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors">
          EXPORT_ANALYSIS
        </button>
      </div>
    </div>
  );
};

export default AIAgentPanel;
