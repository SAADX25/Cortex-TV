import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Sidebar = ({ country, channels = [], open, onClose, onSelectChannel, loading, error }) => {
  if (!open) return null;
  const { isDarkMode } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return channels || [];
    return (channels || []).filter(ch => {
      const name = (ch.name || '').toLowerCase();
      const cats = (ch.categories || []).join(' ').toLowerCase();
      return name.includes(q) || cats.includes(q);
    });
  }, [channels, query]);

  const containerClass = isDarkMode
    ? 'fixed right-6 top-6 h-[calc(100%-96px)] w-96 z-50 p-4 backdrop-blur-md bg-[rgba(2,6,20,0.45)] border-l-2 border-[rgba(0,242,254,0.14)] rounded-lg neon-border shadow-xl overflow-hidden'
    : 'fixed right-6 top-6 h-[calc(100%-96px)] w-96 z-50 p-4 backdrop-blur-md bg-[rgba(255,255,255,0.7)] border-l-2 border-[rgba(3,105,161,0.08)] rounded-lg shadow-xl overflow-hidden';

  const titleClass = isDarkMode ? 'text-xl font-semibold text-white drop-shadow' : 'text-xl font-semibold text-slate-900';
  const subtitleClass = isDarkMode ? 'text-xs text-gray-300' : 'text-xs text-slate-700';

  return (
    <aside className={containerClass}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={titleClass}>{country ? country.name : 'Channels'}</h3>
          <p className={subtitleClass}>Live channels • Click to play</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 rounded hover:bg-white/5" onClick={onClose} aria-label="Close sidebar">
            <X size={18} className={isDarkMode ? 'text-white/80' : 'text-slate-700'} />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className={isDarkMode ? 'text-white/60' : 'text-slate-600'} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels or categories..."
            className={`w-full pl-10 pr-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border ${isDarkMode ? 'border-[rgba(255,255,255,0.04)] placeholder-white/60 text-white' : 'border-[rgba(2,6,23,0.04)] placeholder-slate-600 text-slate-900'}`}
          />
        </div>
      </div>

      <div className="h-[calc(100%-72px)] overflow-y-auto pr-2">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="loader" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400">Failed to load channels. Try again.</div>
        )}

        {!loading && !error && country && country.channels && country.channels.length === 0 && (
          <div className="text-sm text-gray-300">No streams found for this country.</div>
        )}

        <div className="space-y-3">
          {!loading && !error && filtered && filtered.map((ch) => (
            <div key={ch.id} className="flex items-center space-x-3 p-3 rounded-lg transition transform hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(0,242,254,0.06)] cursor-pointer" onClick={() => onSelectChannel(ch)}>
              <div className="w-12 h-8 logo-placeholder rounded overflow-hidden flex items-center justify-center bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.02)]">
                {ch.logo ? <img src={ch.logo} alt="logo" className="w-full h-full object-cover" /> : <div className="text-xs text-gray-300">No logo</div>}
              </div>
              <div className="flex-1">
                <div className={isDarkMode ? 'text-sm font-medium text-white' : 'text-sm font-medium text-slate-900'}>{ch.name}</div>
                <div className={isDarkMode ? 'text-xs text-gray-400' : 'text-xs text-slate-600'}>{(ch.categories && ch.categories.join(', ')) || ch.language || 'General'}</div>
              </div>
              <div className={isDarkMode ? 'text-sm text-cyan-300' : 'text-sm text-sky-600'}>Play</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .neon-border { box-shadow: ${isDarkMode ? '0 6px 30px rgba(3,105,161,0.08), 0 0 18px rgba(59,130,246,0.06)' : '0 6px 20px rgba(3,105,161,0.04)'}; }
        .loader { width: 36px; height: 36px; border-radius: 50%; border: 4px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(2,6,23,0.08)'}; border-top-color: ${isDarkMode ? 'rgba(125,211,252,0.9)' : 'rgba(3,105,161,0.9)'}; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  );
};

export default Sidebar;
