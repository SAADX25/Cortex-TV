import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Send } from 'lucide-react';
import { fetchCountries, fetchChannelsForCountry } from '../api/iptv';

const RightSidebar = ({ selectedCountry: selectedCountryProp = null, onCountrySelect, onSelectChannel }) => {
  const getValidFlagCode = (code) => { if (!code) return 'un'; const c = code.toLowerCase(); return c === 'uk' ? 'gb' : c; };
  const [view, setView] = useState('countries');
  const [countries, setCountries] = useState([]);
  const [query, setQuery] = useState('');
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [activeCountry, setActiveCountry] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsError, setChannelsError] = useState(false);

  const codeMap = {
    'JOR': 'JO', 'USA': 'US', 'GBR': 'UK', 'EGY': 'EG', 'SAU': 'SA', 'ARE': 'AE', 'PSE': 'PS', 'MAR': 'MA', 'DZA': 'DZ', 'IRQ': 'IQ', 'SYR': 'SY'
  };

  useEffect(() => {
    let mounted = true;
    setLoadingCountries(true);
    fetchCountries().then(list => {
      if (!mounted) return;
      setCountries(list || []);
    }).catch(() => {
      if (!mounted) return;
      setCountries([]);
    }).finally(() => mounted && setLoadingCountries(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (selectedCountryProp) {
      handleCountrySelect(selectedCountryProp);
    }
  }, [selectedCountryProp]);

  useEffect(() => {
    if (!selectedCountryProp) {
      setView('countries');
      setActiveCountry(null);
    }
  }, [selectedCountryProp]);

  const handleCountrySelect = async (country) => {
    if (!country) return;
    setActiveCountry(country);
    setView('channels');
    if (onCountrySelect) onCountrySelect(country);
    let candidate = (country.code || country.iso || country.country_code || country.iso_3166_1_alpha2 || country.iso_3166_1_alpha3 || country.ISO_A2 || country.ISO_A3 || country.name || '').toString();

    const resolveAlpha2 = async (val) => {
      if (!val) return '';
      const v = val.toString().trim();
      if (v.length === 2) return v.toUpperCase();
      let list = countries;
      if (!list || list.length === 0) {
        try { list = await fetchCountries(); } catch (e) { list = []; }
      }
      const byAlpha3 = list.find(c => ((c.iso_3166_1_alpha3 || c.iso3 || c.alpha3 || '').toString().toUpperCase() === v.toUpperCase()));
      if (byAlpha3) return (byAlpha3.iso_3166_1_alpha2 || byAlpha3.code || '').toString().toUpperCase();
      const byName = list.find(c => (c.name || '').toString().toLowerCase() === v.toLowerCase());
      if (byName) return (byName.iso_3166_1_alpha2 || byName.code || '').toString().toUpperCase();
      const partial = list.find(c => (c.name || '').toString().toLowerCase().includes(v.toLowerCase()));
      if (partial) return (partial.iso_3166_1_alpha2 || partial.code || '').toString().toUpperCase();
      return v.slice(0,2).toUpperCase();
    };

    const alpha2 = await resolveAlpha2(candidate);
    if (!alpha2) {
      setChannels([]);
      return;
    }

    const finalCode = (codeMap[alpha2.toUpperCase()] || alpha2.substring(0,2).toUpperCase());
    setLoadingChannels(true);
    setChannelsError(false);
    setChannels([]);
    try {
      const merged = await fetchChannelsForCountry(finalCode);
      setChannels(merged || []);
    } catch (err) {
      setChannelsError(true);
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleChannelClick = async (ch) => {
    try {
      const res = await fetch('https://iptv-org.github.io/api/streams.json');
      if (!res.ok) throw new Error('Failed to fetch streams.json');
      const streams = await res.json();
      const matches = (streams || []).filter(s => s.channel === ch.id);
      let pick = null;
      for (const s of matches) {
        const urls = typeof s.url === 'string' ? [s.url] : Array.isArray(s.url) ? s.url : [];
        const hls = urls.find(u => typeof u === 'string' && u.includes('.m3u8'));
        if (hls) { pick = hls; break; }
        const any = urls.find(u => typeof u === 'string');
        if (any && !pick) pick = any;
      }
      const channelWithStream = { ...ch, stream: pick || null };
      if (onSelectChannel) onSelectChannel(channelWithStream);
    } catch (err) {
      const channelWithStream = { ...ch, stream: null };
      if (onSelectChannel) onSelectChannel(channelWithStream);
    }
  };

  const filteredCountries = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return countries;
    return (countries || []).filter(c => (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q));
  }, [countries, query]);

  const displayedSelected = activeCountry || selectedCountryProp;

  return (
    <aside className="w-[380px] flex-shrink-0 h-full flex flex-col bg-[#141414] border-l border-[#2a2a2a] z-10 shadow-2xl font-sans">
      
      {/* Premium Famelack Header & Search */}
      <div className="sticky top-0 z-20 bg-[#141414] border-b border-[#2a2a2a] px-5 py-5">
        {displayedSelected ? (
          <div className="flex items-center gap-3 mb-4">
            <button 
              onClick={() => { setActiveCountry(null); setView('countries'); if (onCountrySelect) onCountrySelect(null); setQuery(''); }} 
              className="w-8 h-8 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] flex items-center justify-center text-gray-300 hover:text-white transition-all shadow-sm"
            >
              ←
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-blue-400">{displayedSelected.name}</h2>
              <span className="text-[11px] text-gray-500 uppercase tracking-widest">Select a channel</span>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <h2 className="text-lg font-bold text-blue-400">Explore Countries</h2>
            <span className="text-[11px] text-gray-500 uppercase tracking-widest">Select a country</span>
          </div>
        )}
        
        <div
          className="flex items-center bg-[#1e1e1e] border border-[#333] rounded-[12px] px-[14px] py-[8px] shadow-inner"
        >
          {/* Search Icon */}
          <Search size={20} className="text-[#888] mr-3" />
          {/* Input Field */}
          <input
            type="text"
            placeholder={displayedSelected ? 'Filter Channels...' : 'Filter Countries...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[#e5e5e5] placeholder-[#e5e5e5] text-sm px-0"
            autoComplete="off"
          />
          {/* Action Icons */}
          <button
            type="button"
            className="ml-2 p-1 rounded-full hover:bg-[#232323] transition-colors group"
            aria-label="Filter"
          >
            <Filter size={18} className="text-[#888] group-hover:text-[#e5e5e5] transition-colors" />
          </button>
          <button
            type="button"
            className="ml-1 p-1 rounded-full hover:bg-[#232323] transition-colors group"
            aria-label="Send"
          >
            <Send size={18} className="text-[#888] group-hover:text-[#e5e5e5] transition-colors" />
          </button>
        </div>
      </div>

      {/* Clean Scrollable List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
        
        {/* Countries List */}
        {!displayedSelected && filteredCountries.map((country, index) => (
          <div
            key={index}
            onClick={() => handleCountrySelect(country)}
            className="group flex items-center gap-4 px-3 py-3 mx-1 rounded-xl hover:bg-[#2a2a2a] cursor-pointer transition-colors duration-200"
          >
            <div className="flex-none w-[30px] h-[20px] rounded-[3px] shadow-sm overflow-hidden bg-[#222]">
              <img src={`https://flagcdn.com/w40/${getValidFlagCode(country.code)}.png`} alt="flag" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="text-[15px] font-medium text-gray-300 group-hover:text-white transition-colors">{country.name}</span>
            <span className="ml-auto text-gray-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-sm">
              ➔
            </span>
          </div>
        ))}

        {/* Loading Spinner */}
        {displayedSelected && loadingChannels && (
          <div className="flex justify-center items-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Channels List */}
        {displayedSelected && !loadingChannels && channels.map((channel, index) => (
          <div 
            key={index} 
            onClick={() => handleChannelClick(channel)} 
            className="group flex items-center justify-between px-3 py-3 mx-1 rounded-xl hover:bg-[#2a2a2a] cursor-pointer transition-colors duration-200"
          >
            <div className="flex items-center gap-4 w-full overflow-hidden">
              <div className="flex-none w-[26px] h-[18px] rounded-[3px] shadow-sm overflow-hidden bg-[#222]">
                <img 
                  src={`https://flagcdn.com/w20/${getValidFlagCode(displayedSelected.code)}.png`} 
                  alt="flag" 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                />
              </div>
              <span className="flex-1 text-[14.5px] font-medium text-gray-300 group-hover:text-white truncate">
                {channel.name}
              </span>
            </div>
            {channel.category && (
              <span className="flex-shrink-0 text-[10px] font-bold tracking-widest text-gray-500 uppercase ml-3">
                {channel.category}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Strict Minimal Famelack Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </aside>
  );
};

export default RightSidebar;