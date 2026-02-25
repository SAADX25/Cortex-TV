import React, { useRef, useState } from 'react';
import GlobeView from './GlobeView';
import RightSidebar from './RightSidebar';
import DraggablePlayer from './DraggablePlayer';
import COUNTRIES from '../data/countries';
import { Link } from 'react-router-dom';
import { Home as HomeIcon, Tv, User, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Home = () => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const globeRef = useRef(null);
  const { isDarkMode, setIsDarkMode } = useTheme();

  const toggleDarkMode = () => setIsDarkMode(s => !s);

  const handleCountrySelected = (country) => {
    setSelectedCountry(country);
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
  };

  // Reset globe and clear selected country/channel
  const handleResetGlobe = () => {
    setSelectedCountry(null);
    setSelectedChannel(null);
    try {
      if (globeRef.current && typeof globeRef.current.pointOfView === 'function') {
        globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2 }, 1000);
      }
    } catch (err) {
      console.error('Failed to reset globe', err);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black font-sans">
      {/* Top Header Bar */}
      <header className="fixed h-14 bg-[#141414] w-full flex items-center justify-between px-6 z-50 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-4">
          <div className="text-xl font-semibold text-blue-400">Cortex TV</div>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-4 text-sm text-gray-200">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/shows" className="hover:text-white">Shows</Link>
            <Link to="/profile" className="hover:text-white">Profile</Link>
            <Link to="/settings" className="hover:text-white">Settings</Link>
          </nav>

          {/* Action Buttons Wrapper */}
          <div className="flex items-center gap-3 p-3 bg-[#141414] border-b border-white/5">
            <button 
              onClick={handleResetGlobe} 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-sm font-medium text-gray-200 transition-all active:scale-95 border border-white/5 shadow-sm"
            >
              <span>↺</span> Reset Globe
            </button>
            
            <button 
              onClick={toggleDarkMode} 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-sm font-medium text-gray-200 transition-all active:scale-95 border border-white/5 shadow-sm"
            >
              <span>☼</span> Dark Mode
            </button>
          </div>
        </div>
      </header>

      {/* Main content: globe + right sidebar */}
      <main className="pt-14 w-full h-[calc(100vh-56px)] grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 350px' }}>
        <div className="h-full w-full relative">
          {selectedChannel ? (
            <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-black to-black">
              <DraggablePlayer channel={selectedChannel} onClose={() => setSelectedChannel(null)} />
            </div>
          ) : (
            <GlobeView ref={globeRef} countries={COUNTRIES} onCountryClick={handleCountrySelected} />
          )}
        </div>

        <div className="h-full">
          <RightSidebar
            selectedCountry={selectedCountry}
            onCountrySelect={handleCountrySelected}
            onSelectChannel={handleSelectChannel}
          />
        </div>
      </main>

      {/* PlayerModal removed: center area now shows VideoPlayer when a channel is selected */}
    </div>
  );
};

export default Home;
