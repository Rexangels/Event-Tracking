
import React from 'react';

const StatSummary: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4 bg-slate-950 border-b border-slate-800">
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Reports</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">1,284</span>
          <span className="text-[10px] text-emerald-500 font-mono">+12.4%</span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Critical Sectors</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-red-500">03</span>
          <span className="text-[10px] text-slate-600 font-mono">/ 24 TOTAL</span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sensor Integrity</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">99.9%</span>
          <span className="text-[10px] text-blue-400 font-mono">NOMINAL</span>
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Heat Index</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-orange-500">7.2</span>
          <span className="text-[10px] text-slate-600 font-mono">MODERATE RISK</span>
        </div>
      </div>
    </div>
  );
};

export default StatSummary;
