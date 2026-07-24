import React from 'react';

const WatercolorWaves = ({ className = '' }) => {
  return (
    <div className={`fixed inset-0 overflow-hidden bg-[#0a0a0f] ${className}`}>
      {/* Base gradient — clearly visible dark navy */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,41,59,0.7),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(15,23,42,0.65),transparent_60%),radial-gradient(circle_at_40%_85%,rgba(30,41,59,0.55),transparent_55%),linear-gradient(180deg,rgba(10,10,15,1),rgba(15,23,42,0.95))]" />

      {/* Large slow-moving colored blobs */}
      <div className="absolute -inset-[25%] opacity-90 blur-0">
        <div className="absolute left-[-20%] top-[5%] h-[300px] w-[1000px] rounded-[60%] bg-indigo-700/40 blur-[60px] rotate-[-10deg] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute left-[30%] top-[15%] h-[280px] w-[1100px] rounded-[58%] bg-blue-800/35 blur-[70px] rotate-[8deg] animate-pulse" style={{ animationDuration: '16s' }} />
        <div className="absolute left-[-10%] top-[40%] h-[320px] w-[1200px] rounded-[62%] bg-slate-700/32 blur-[80px] rotate-[-6deg] animate-pulse" style={{ animationDuration: '20s' }} />
        <div className="absolute left-[20%] top-[55%] h-[300px] w-[1050px] rounded-[55%] bg-indigo-800/30 blur-[85px] rotate-[6deg] animate-pulse" style={{ animationDuration: '14s' }} />
        <div className="absolute left-[-25%] top-[75%] h-[320px] w-[1300px] rounded-[62%] bg-blue-900/28 blur-[90px] rotate-[-8deg] animate-pulse" style={{ animationDuration: '22s' }} />
        <div className="absolute left-[60%] top-[5%] h-[280px] w-[900px] rounded-[60%] bg-slate-800/30 blur-[80px] rotate-[10deg] animate-pulse" style={{ animationDuration: '18s' }} />
        <div className="absolute left-[65%] top-[45%] h-[300px] w-[950px] rounded-[62%] bg-indigo-700/25 blur-[95px] rotate-[-8deg] animate-pulse" style={{ animationDuration: '21s' }} />
        <div className="absolute left-[55%] top-[70%] h-[280px] w-[850px] rounded-[60%] bg-blue-900/25 blur-[85px] rotate-[6deg] animate-pulse" style={{ animationDuration: '19s' }} />
      </div>

      {/* Subtle top light accents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.08),transparent_55%),radial-gradient(circle_at_85%_20%,rgba(99,102,241,0.06),transparent_60%),radial-gradient(circle_at_30%_90%,rgba(56,189,248,0.05),transparent_55%)] mix-blend-screen" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
};

export default WatercolorWaves;
