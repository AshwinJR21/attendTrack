"use client";

import React, { useState, useEffect } from 'react';
import tokens from './tokens.json';
import { 
  Palette, 
  Type, 
  Layers, 
  Grid, 
  Square, 
  Copy, 
  Check, 
  Eye, 
  Layout, 
  Sparkles,
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react';

type SectionType = 'overview' | 'colors' | 'typography' | 'spacing' | 'radius' | 'elevation' | 'sandbox';

export default function DesignTokensView() {
  const [activeSection, setActiveSection] = useState<SectionType>('overview');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("AttendTrack Design System");
  const [sandboxTheme, setSandboxTheme] = useState<'dark' | 'light'>('light');

  // Load DM Sans dynamically when component mounts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getElevationShadow = (shadowValue: any) => {
    return shadowValue.map((s: any) => {
      return `${s.inset ? 'inset ' : ''}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`;
    }).join(', ');
  };

  return (
    <div className="h-full w-full bg-[#030303] text-zinc-100 font-sans flex flex-col md:flex-row overflow-hidden p-6 gap-6">
      
      {/* Design System Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0 bg-zinc-950/80 border border-white/[0.05] rounded-3xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-2xl">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-coral-500 to-amber-500 flex items-center justify-center shadow-lg" style={{ background: '#FF6B6B' }}>
            <Palette className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-white">Design Tokens</h1>
            <p className="text-[10px] font-bold text-zinc-500">TOKENS.JSON SYSTEM</p>
          </div>
        </div>

        <div className="h-px bg-white/[0.05] my-2"></div>

        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <SidebarBtn 
            active={activeSection === 'overview'} 
            onClick={() => setActiveSection('overview')}
            icon={<Sparkles size={16} />}
            label="System Overview"
          />
          <SidebarBtn 
            active={activeSection === 'colors'} 
            onClick={() => setActiveSection('colors')}
            icon={<Palette size={16} />}
            label="Color Palette"
          />
          <SidebarBtn 
            active={activeSection === 'typography'} 
            onClick={() => setActiveSection('typography')}
            icon={<Type size={16} />}
            label="Typography Scales"
          />
          <SidebarBtn 
            active={activeSection === 'spacing'} 
            onClick={() => setActiveSection('spacing')}
            icon={<Grid size={16} />}
            label="Spacing Values"
          />
          <SidebarBtn 
            active={activeSection === 'radius'} 
            onClick={() => setActiveSection('radius')}
            icon={<Square size={16} />}
            label="Border Radius"
          />
          <SidebarBtn 
            active={activeSection === 'elevation'} 
            onClick={() => setActiveSection('elevation')}
            icon={<Layers size={16} />}
            label="Elevation Shadows"
          />
          <SidebarBtn 
            active={activeSection === 'sandbox'} 
            onClick={() => setActiveSection('sandbox')}
            icon={<Layout size={16} />}
            label="Theme Sandbox"
          />
        </nav>

        <div className="h-px bg-white/[0.05] my-2"></div>
        
        <div className="bg-zinc-900/50 border border-white/[0.02] p-4 rounded-2xl">
          <div className="flex items-start gap-3">
            <Info size={14} className="text-zinc-500 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed text-zinc-500">
              These tokens are compiled directly from <code className="text-zinc-300 font-mono">tokens.json</code> in the repository. They control color spaces, type sizing, spacing increments, and radius systems.
            </p>
          </div>
        </div>
      </div>

      {/* Main Showcase Panel */}
      <div className="flex-1 bg-zinc-950/40 border border-white/[0.05] rounded-[2rem] shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          
          {/* ==================================== OVERVIEW ==================================== */}
          {activeSection === 'overview' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">System Overview</h2>
                <p className="text-zinc-400 text-sm mt-1">A unified design language powering AttendTrack.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Colors" count={Object.keys(tokens.Design.Colors.BrandAndAccent).length + Object.keys(tokens.Design.Colors.Text).length + Object.keys(tokens.Design.Colors.Semantic).length + Object.keys(tokens.Design.Colors.Surface).length} desc="Categorized into Brand, Text, Semantic & Surface systems" />
                <StatCard title="Typography Sizes" count={Object.keys(tokens.Design.Typography.Hierarchy).length} desc="Optimized hierarchy using the premium DM Sans font" />
                <StatCard title="Shadow Levels" count={Object.keys(tokens.Design.Elevation).length} desc="Strict 4-level elevation system" />
              </div>

              <div className="bg-gradient-to-tr from-zinc-900/80 to-zinc-950/80 border border-white/[0.05] p-8 rounded-3xl flex flex-col md:flex-row gap-8 items-center shadow-xl">
                <div className="flex-1 flex flex-col gap-4">
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider self-start">Active Specs</span>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">The Light Mode Transformation</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    This design system transforms the interface from a heavy dark mode layout into a beautiful, crisp, premium light mode workspace. Featuring high-contrast ink-black text elements, soft gray canvas partitions, signature <span className="text-[#FF6B6B] font-bold">Brand Coral</span> accents, and tactical <span className="text-[#00ACC1] font-bold">Brand Cyan</span> highlights.
                  </p>
                  <button 
                    onClick={() => setActiveSection('sandbox')}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors self-start mt-2 group"
                  >
                    Enter Live Sandbox <Eye size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
                <div className="w-full md:w-80 h-44 bg-zinc-950 border border-white/[0.05] rounded-2xl relative overflow-hidden flex items-center justify-center p-6 shadow-inner">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#080808_1px,transparent_1px),linear-gradient(to_bottom,#080808_1px,transparent_1px)] bg-[size:16px_16px] opacity-40"></div>
                  <div className="flex flex-col gap-3 relative z-10 w-full">
                    <div className="h-4 bg-zinc-800 rounded-full w-2/3"></div>
                    <div className="h-3 bg-zinc-800/60 rounded-full w-full"></div>
                    <div className="h-3 bg-zinc-800/60 rounded-full w-4/5"></div>
                    <div className="flex gap-2 mt-2">
                      <div className="w-16 h-6 rounded-full bg-[#FF6B6B] shadow-lg shadow-[#FF6B6B]/20"></div>
                      <div className="w-16 h-6 rounded-full bg-[#00ACC1] shadow-lg shadow-[#00ACC1]/20"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================== COLORS ==================================== */}
          {activeSection === 'colors' && (
            <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">Color Palette</h2>
                <p className="text-zinc-400 text-sm mt-1">Unified custom palettes configured in tokens.json.</p>
              </div>

              {/* Brand and Accent */}
              <ColorGroup title="Brand & Accent Colors" description="Primary and secondary accents driving high-impact visuals and CTA components.">
                {Object.entries(tokens.Design.Colors.BrandAndAccent).map(([key, val]: any) => (
                  <ColorCard 
                    key={key} 
                    name={key} 
                    hex={val.$value} 
                    desc={val.$description} 
                    copiedText={copiedText}
                    onCopy={handleCopy} 
                  />
                ))}
              </ColorGroup>

              {/* Text System */}
              <ColorGroup title="Text Ink System" description="Strict typography contrast grades, utilizing pitch blacks and steel tones.">
                {Object.entries(tokens.Design.Colors.Text).map(([key, val]: any) => (
                  <ColorCard 
                    key={key} 
                    name={key} 
                    hex={val.$value} 
                    desc={val.$description} 
                    copiedText={copiedText}
                    onCopy={handleCopy} 
                  />
                ))}
              </ColorGroup>

              {/* Semantic States */}
              <ColorGroup title="Semantic Status" description="Tones representing interface validation, system alerts, success, and error branches.">
                {Object.entries(tokens.Design.Colors.Semantic).map(([key, val]: any) => (
                  <ColorCard 
                    key={key} 
                    name={key} 
                    hex={val.$value} 
                    desc={val.$description} 
                    copiedText={copiedText}
                    onCopy={handleCopy} 
                  />
                ))}
              </ColorGroup>

              {/* Surface Blocks */}
              <ColorGroup title="Surface & Dividers" description="Background layers, quiet canvas blocks, form panels, and borders.">
                {Object.entries(tokens.Design.Colors.Surface).map(([key, val]: any) => (
                  <ColorCard 
                    key={key} 
                    name={key} 
                    hex={val.$value} 
                    desc={val.$description} 
                    copiedText={copiedText}
                    onCopy={handleCopy} 
                  />
                ))}
              </ColorGroup>
            </div>
          )}

          {/* ==================================== TYPOGRAPHY ==================================== */}
          {activeSection === 'typography' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white uppercase">Typography Scale</h2>
                  <p className="text-zinc-400 text-sm mt-1">Strict type scaling optimized under the modern <span className="font-bold text-white">DM Sans</span> family.</p>
                </div>
                
                {/* Live Preview Controller */}
                <div className="bg-zinc-900 border border-white/5 rounded-2xl px-4 py-2 flex items-center gap-3 w-full md:w-80 shadow-md">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex-shrink-0">Preview:</span>
                  <input 
                    type="text" 
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    className="bg-transparent text-white font-semibold text-xs focus:outline-none w-full placeholder:text-zinc-600"
                    placeholder="Type custom text..."
                  />
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-white/[0.05] rounded-3xl p-6 flex flex-col gap-6 divide-y divide-white/[0.05]">
                {Object.entries(tokens.Design.Typography.Hierarchy).map(([key, val]: any) => (
                  <div key={key} className="pt-6 first:pt-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4 group">
                    <div className="w-56 flex-shrink-0 flex flex-col">
                      <span className="text-xs font-black text-white tracking-tight font-mono">{key}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase mt-1 tracking-wider">
                        {val.$value.fontSizes} • Weight {val.$value.fontWeights} • Line {val.$value.lineHeights}
                      </span>
                    </div>
                    <div className="flex-1 overflow-x-auto select-all" style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: val.$value.fontSizes,
                      fontWeight: val.$value.fontWeights,
                      lineHeight: val.$value.lineHeights,
                      letterSpacing: val.$value.letterSpacing,
                      color: '#E4E4E7'
                    }}>
                      {previewText}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================== SPACING ==================================== */}
          {activeSection === 'spacing' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">Spacing Scale</h2>
                <p className="text-zinc-400 text-sm mt-1">Incremental spacing units utilized in card paddings and layout margins.</p>
              </div>

              <div className="bg-zinc-900/30 border border-white/[0.05] rounded-3xl p-6 flex flex-col gap-4">
                {Object.entries(tokens.Design.Spacing)
                  .sort((a: any, b: any) => parseFloat(a[1].$value) - parseFloat(b[1].$value))
                  .map(([key, val]: any) => (
                    <div key={key} className="flex items-center gap-6 group">
                      <div className="w-36 flex-shrink-0 flex flex-col">
                        <span className="text-xs font-black text-white font-mono">{key}</span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">{val.$value}</span>
                      </div>
                      <div className="flex-1 h-8 bg-zinc-900/50 border border-white/[0.02] rounded-lg flex items-center px-1 overflow-hidden">
                        <div 
                          className="h-6 rounded bg-gradient-to-r from-coral-500 to-amber-500 opacity-80 group-hover:opacity-100 transition-opacity" 
                          style={{ 
                            width: val.$value,
                            background: '#FF6B6B'
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ==================================== RADIUS ==================================== */}
          {activeSection === 'radius' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">Border Radius</h2>
                <p className="text-zinc-400 text-sm mt-1">Defines corner rounding system across components and modals.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.entries(tokens.Design.BorderRadius).map(([key, val]: any) => (
                  <div key={key} className="bg-zinc-900/40 border border-white/[0.05] p-6 rounded-3xl flex flex-col items-center gap-4 text-center group hover:border-white/10 transition-colors">
                    <div 
                      className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 transition-transform duration-300 group-hover:scale-105"
                      style={{ borderRadius: val.$value }}
                    ></div>
                    <div>
                      <h4 className="text-xs font-black text-white font-mono">{key}</h4>
                      <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">{val.$value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================== ELEVATION ==================================== */}
          {activeSection === 'elevation' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">Elevation & Shadows</h2>
                <p className="text-zinc-400 text-sm mt-1">Multi-layered shadows representing dimensional space and stack order.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Object.entries(tokens.Design.Elevation).map(([key, val]: any) => (
                  <div key={key} className="bg-zinc-900/30 border border-white/[0.05] p-8 rounded-3xl flex flex-col gap-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-white font-mono uppercase">{key}</h4>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Shadow Depth</span>
                    </div>
                    
                    {/* Shadow Demo Box - rendered as a light card to accurately show dark drop shadow */}
                    <div className="h-36 bg-zinc-950 rounded-2xl flex items-center justify-center p-6 border border-white/[0.03]">
                      <div 
                        className="bg-white text-zinc-900 font-black text-xs px-6 py-4 rounded-xl shadow-lg border border-zinc-200/50"
                        style={{ boxShadow: getElevationShadow(val.$value) }}
                      >
                        Shadow Surface
                      </div>
                    </div>
                    
                    <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-4">
                      <div className="flex justify-between items-center gap-4">
                        <code className="text-[10px] text-zinc-400 font-mono select-all truncate">
                          box-shadow: {getElevationShadow(val.$value)}
                        </code>
                        <button 
                          onClick={() => handleCopy(`box-shadow: ${getElevationShadow(val.$value)};`)}
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                          title="Copy CSS Shadow Rule"
                        >
                          {copiedText === `box-shadow: ${getElevationShadow(val.$value)};` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================== LIVE SANDBOX ==================================== */}
          {activeSection === 'sandbox' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white uppercase">Theme Sandbox</h2>
                  <p className="text-zinc-400 text-sm mt-1">Toggle between original dark mode and the new light design tokens.</p>
                </div>

                {/* Theme Switcher Toggle */}
                <div className="flex p-1 bg-zinc-900 border border-white/5 rounded-2xl self-start">
                  <button 
                    onClick={() => setSandboxTheme('light')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      sandboxTheme === 'light' 
                        ? 'bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/20' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Light Tokens
                  </button>
                  <button 
                    onClick={() => setSandboxTheme('dark')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      sandboxTheme === 'dark' 
                        ? 'bg-zinc-800 text-white' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Original Dark
                  </button>
                </div>
              </div>

              {/* Dynamic Sandbox Display Frame */}
              <div className="flex-1 bg-zinc-900/30 border border-white/[0.05] rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] relative transition-colors duration-500 overflow-hidden"
                style={{ 
                  background: sandboxTheme === 'light' ? '#FAFAFA' : '#030303',
                }}
              >
                {/* Simulated Web App Section */}
                <div className="w-full max-w-lg rounded-[24px] border transition-all duration-500 overflow-hidden shadow-2xl flex flex-col"
                  style={{
                    background: sandboxTheme === 'light' ? '#FFFFFF' : '#0E0E0E',
                    borderColor: sandboxTheme === 'light' ? '#EEEEEE' : 'rgba(255,255,255,0.05)',
                    color: sandboxTheme === 'light' ? '#111111' : '#E2E8F0',
                    fontFamily: sandboxTheme === 'light' ? "'DM Sans', sans-serif" : "inherit"
                  }}
                >
                  {/* Top header bar */}
                  <div className="px-6 py-4 border-b flex items-center justify-between"
                    style={{
                      borderColor: sandboxTheme === 'light' ? '#EEEEEE' : 'rgba(255,255,255,0.05)',
                      background: sandboxTheme === 'light' ? '#FAFAFA' : '#141414',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base" style={{ color: sandboxTheme === 'light' ? '#FF6B6B' : '#818cf8' }}>⏱</span>
                      <span className="font-black text-xs uppercase tracking-wider">AttendTrack</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
                        style={{
                          background: sandboxTheme === 'light' ? '#E8F5E9' : 'rgba(34, 197, 94, 0.1)',
                          color: sandboxTheme === 'light' ? '#1B5E20' : '#22c55e',
                          border: sandboxTheme === 'light' ? 'none' : '1px solid rgba(34, 197, 94, 0.2)'
                        }}
                      >
                        IN: 14
                      </span>
                    </div>
                  </div>

                  {/* Body: Simulated employee card */}
                  <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar check-in circle */}
                      <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xs relative flex-shrink-0"
                        style={{
                          background: sandboxTheme === 'light' 
                            ? 'radial-gradient(circle at 35% 35%, #5eead4, #00ACC1 60%, #0d9488)' 
                            : 'radial-gradient(circle at 35% 35%, #4ade80, #16a34a 60%, #15803d)',
                          boxShadow: sandboxTheme === 'light'
                            ? '0 6px 16px rgba(0, 172, 193, 0.2), inset 0 2px 4px rgba(255,255,255,0.2)'
                            : '0 6px 16px rgba(34, 197, 94, 0.35), inset 0 2px 4px rgba(255,255,255,0.2)'
                        }}
                      >
                        <span className="text-white">AS</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black truncate">Ashwin JR</h4>
                        <p className="text-[10px] font-bold mt-0.5 uppercase tracking-wide"
                          style={{ color: sandboxTheme === 'light' ? '#555555' : '#8892a4' }}
                        >
                          Engineering Manager • WFH (Home)
                        </p>
                      </div>
                    </div>

                    <div className="h-px w-full" style={{ background: sandboxTheme === 'light' ? '#EEEEEE' : 'rgba(255,255,255,0.05)' }}></div>

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider block"
                          style={{ color: sandboxTheme === 'light' ? '#999999' : '#8892a4' }}
                        >
                          Today's Session
                        </span>
                        <span className="text-xs font-bold">5 hours 45 mins</span>
                      </div>
                      
                      <button className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        style={{
                          background: sandboxTheme === 'light' ? '#FF6B6B' : '#6366f1',
                          color: '#FFFFFF',
                          boxShadow: sandboxTheme === 'light' ? '0 4px 12px rgba(255, 107, 107, 0.25)' : 'none'
                        }}
                      >
                        Check Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

function SidebarBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
        active 
          ? 'bg-zinc-900 text-[#FF6B6B] border border-white/[0.05] shadow-md' 
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatCard({ title, count, desc }: { title: string, count: number, desc: string }) {
  return (
    <div className="bg-zinc-900/30 border border-white/[0.05] p-6 rounded-3xl flex flex-col gap-2 hover:border-white/10 transition-colors">
      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{title}</span>
      <span className="text-4xl font-black text-white">{count}</span>
      <p className="text-[10px] font-bold text-zinc-400 leading-relaxed mt-1">{desc}</p>
    </div>
  );
}

function ColorGroup({ title, description, children }: { title: string, description: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
        <p className="text-[11px] font-bold text-zinc-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {children}
      </div>
    </div>
  );
}

interface ColorCardProps {
  name: string;
  hex: string;
  desc: string;
  copiedText: string | null;
  onCopy: (text: string) => void;
}

function ColorCard({ name, hex, desc, copiedText, onCopy }: ColorCardProps) {
  const isCopied = copiedText === hex;
  
  return (
    <div className="bg-zinc-900/30 border border-white/[0.05] rounded-3xl overflow-hidden hover:border-white/10 transition-colors flex flex-col">
      {/* Color Swatch */}
      <div className="h-28 relative flex items-end p-4 group" style={{ background: hex }}>
        <button 
          onClick={() => onCopy(hex)}
          className="absolute top-3 right-3 p-2 rounded-xl bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 text-white hover:bg-black/60"
          title="Copy HEX Code"
        >
          {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
        
        {/* Contrast Badge */}
        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-black/30 backdrop-blur-sm text-white border border-white/5">
          {hex}
        </span>
      </div>
      
      {/* Info */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-2 bg-zinc-950/20">
        <div>
          <h4 className="text-xs font-black text-white font-mono">{name}</h4>
          <p className="text-[9px] text-zinc-500 font-bold leading-normal mt-1">{desc || "Design system token value"}</p>
        </div>
      </div>
    </div>
  );
}
