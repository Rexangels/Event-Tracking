
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IntelligenceEvent } from '../types';
import { startDeepDiveChat, sendDeepDiveMessage, DeepDiveResponse } from '../services/geminiService';
import AnalyticGraph from './AnalyticGraph';
import { Explainability } from '../services/ai/application/explainability';
import { GuardrailAssessment } from '../services/ai/application/guardrails';

interface Message {
    role: 'user' | 'agent';
    content: string;
    explainability?: Explainability;
    graphData?: DeepDiveResponse['graphData'];
    guardrails?: GuardrailAssessment;
}

interface DeepDiveChatProps {
    events: IntelligenceEvent[];
    onExport?: (file: { name: string; type: string; data: string }) => void;
}

const STORAGE_KEY = 'deepdive_chat_history';

const DeepDiveChat: React.FC<DeepDiveChatProps> = ({ events, onExport }) => {
    // Load initial messages from sessionStorage
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load chat history from sessionStorage:', e);
        }
        return [];
    });
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const isInitialized = useRef(false);

    // Save messages to sessionStorage whenever they change
    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        } catch (e) {
            console.warn('Failed to save chat history to sessionStorage:', e);
        }
    }, [messages]);

    const initChat = async (isReset = false) => {
        // If already initialized and not a reset, don't clear messages
        if (isInitialized.current && !isReset) return;

        setIsLoading(true);
        await startDeepDiveChat(events);
        isInitialized.current = true;

        const welcomeMsg: Message = {
            role: 'agent',
            content: isReset
                ? "Intelligence session reset. All event vectors re-correlated. How can I assist with a fresh analysis?"
                : "Deep Dive Analytic Agent initialized. I've correlated the active event vectors. How can I assist with your strategic analysis?"
        };

        // Only set welcome message if messages are empty or it's a reset
        setMessages(prev => prev.length === 0 || isReset ? [welcomeMsg] : prev);
        setIsLoading(false);
    };

    useEffect(() => {
        // Trigger init on mount or when events change, but logic inside initChat handles persistence
        initChat();
    }, [events]);

    const handleNewSession = () => {
        if (confirm("Are you sure you want to start a new analysis session? This will clear current chat history.")) {
            // Force reset and clear storage
            isInitialized.current = false;
            sessionStorage.removeItem(STORAGE_KEY);
            initChat(true);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await sendDeepDiveMessage(input);
            const agentMsg: Message = {
                role: 'agent',
                content: response.text,
                explainability: response.explainability,
                graphData: response.graphData,
                guardrails: response.guardrails
            };

            // Extract exports
            const exportMatch = response.text.match(/\[EXPORT_DATA\]([\s\S]*?)\[\/EXPORT_DATA\]/);
            if (exportMatch && onExport) {
                try {
                    const exportInfo = JSON.parse(exportMatch[1]);
                    // If exportInfo is an array, handle it, otherwise handle single object
                    const exports = Array.isArray(exportInfo) ? exportInfo : [exportInfo];
                    exports.forEach(exp => onExport(exp));
                } catch (e) {
                    console.error("Failed to parse export data:", e);
                }
            }

            setMessages(prev => [...prev, agentMsg]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'agent', content: "Error: Failed to process intelligence vector." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0012 18.75c-1.03 0-1.9-.4-2.593-.88l-.547-.547z" />
                            </svg>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950"></div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">Deep_Dive_Analytic_Agent</h3>
                        <p className="text-[10px] text-slate-500 font-mono uppercase">Status: Live_Neural_Stream</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleNewSession}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-mono transition-all border border-slate-700"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        NEW_SESSION
                    </button>
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-6 h-6 rounded-full border border-slate-800 bg-slate-900 text-[8px] flex items-center justify-center text-slate-400">
                                P{i}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3' : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl rounded-tl-none px-5 py-4 shadow-lg'}`}>
                            {m.role === 'agent' ? (
                                <div className="markdown-content text-sm leading-relaxed font-light">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {m.content.replace(/\[EXPORT_DATA\][\s\S]*?\[\/EXPORT_DATA\]/, '').trim() || "_Report generated successfully. Check the export pipeline._"}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="text-sm leading-relaxed whitespace-pre-wrap font-light">
                                    {m.content}
                                </div>
                            )}
                            {m.graphData && (
                                <AnalyticGraph
                                    data={m.graphData.data}
                                    type={m.graphData.type}
                                    title={m.graphData.title}
                                />
                            )}
                            {m.role === 'agent' && m.guardrails && m.guardrails.warnings.length > 0 && (
                                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-200">
                                    <p className="font-semibold uppercase tracking-wider text-[10px] mb-1">AI Guardrails</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        {m.guardrails.warnings.map((warning, idx) => <li key={idx}>{warning}</li>)}
                                    </ul>
                                </div>
                            )}
                            {m.role === 'agent' && m.explainability && (
                                <details className="mt-3 rounded-lg border border-slate-700/80 bg-slate-950/60 p-3 text-xs text-slate-300">
                                    <summary className="cursor-pointer font-semibold text-slate-200 flex items-center gap-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${m.explainability.confidenceLabel === 'high' ? 'bg-emerald-500/20 text-emerald-300' : m.explainability.confidenceLabel === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                            Confidence: {m.explainability.confidenceLabel.toUpperCase()}
                                        </span>
                                        Why this answer?
                                    </summary>

                                    <div className="mt-3 grid md:grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Key factors</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {m.explainability.keyFactors.length ? m.explainability.keyFactors.map((factor, idx) => <li key={idx}>{factor}</li>) : <li>No factors supplied</li>}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Assumptions</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {m.explainability.assumptions.length ? m.explainability.assumptions.map((assumption, idx) => <li key={idx}>{assumption}</li>) : <li>No assumptions supplied</li>}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Counter indicators</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {m.explainability.counterIndicators.length ? m.explainability.counterIndicators.map((counter, idx) => <li key={idx}>{counter}</li>) : <li>No counter indicators supplied</li>}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Source refs</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {m.explainability.sourceRefs.length ? m.explainability.sourceRefs.map((source, idx) => <li key={idx}>{source}</li>) : <li>No source refs supplied</li>}
                                            </ul>
                                        </div>
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-5 py-3 flex gap-2 items-center">
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Synthesizing_Intelligence...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                <div className="relative flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1 group focus-within:border-blue-500/50 transition-all">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Query strategic correlation matrix..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-300 px-4 py-3 placeholder:text-slate-600"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg transition-all shadow-lg active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
                <div className="flex justify-between mt-2 px-1">
                    <div className="text-[9px] text-slate-500 font-mono uppercase">Prompt: Natural_Language_Inference</div>
                    <div className="text-[9px] text-slate-500 font-mono uppercase">Tokens: Optimized</div>
                </div>
            </div>
        </div>
    );
};

export default DeepDiveChat;
