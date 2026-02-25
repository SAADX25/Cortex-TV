import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const PlayerModal = ({ channel, open, onClose, isDarkMode: propIsDarkMode }) => {
  const [playing, setPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const nodeRef = useRef(null);
  const { isDarkMode: ctxDark } = useTheme();
  const isDarkMode = typeof propIsDarkMode === 'boolean' ? propIsDarkMode : ctxDark;

  useEffect(() => {
    setPlaying(!!open);
  }, [open]);

  if (!open || !channel) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-[9999999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center m-0 p-0">
      <button onClick={() => { setPlaying(false); onClose(); }} className="absolute top-6 right-6 text-white bg-red-600 hover:bg-red-500 rounded-full p-3 z-[10000000] cursor-pointer">
        <X size={20} />
      </button>

      <div className="w-[85vw] h-[80vh] bg-black rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center" style={{ minHeight: 240, aspectRatio: '16/9' }}>
        {channel.stream ? (
          (() => {
            // Robust Electron detection: check process.versions or userAgent fallback
            const isElectron = typeof window !== 'undefined' && (
              (window.process && window.process.versions && Boolean(window.process.versions.electron)) ||
              (navigator && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0)
            );

            const streamUrl = channel.stream;

            // Only use proxy when NOT running inside Electron.
            const proxiedUrl = isElectron ? streamUrl : ('https://corsproxy.io/?' + encodeURIComponent(streamUrl));

            const hlsOptions = {
              // retry and buffer options to tolerate slow segments
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              fragLoadRetry: 4,
              fragLoadRetryDelay: 2000,
              fragLoadMaxRetryTimeout: 60000,
              // enable worker for better performance when available
              enableWorker: true,
              xhrSetup: function (xhr, url) {
                // allow anonymous cross-origin requests when proxied
                try { xhr.withCredentials = false; } catch (e) {}
              }
            };

            return (
              <ReactPlayer
                url={proxiedUrl}
                playing={playing}
                controls
                width="100%"
                height="100%"
                config={{ file: { forceHLS: true, hlsOptions, attributes: { crossOrigin: 'anonymous' } } }}
              />
            );
          })()
        ) : (
          <div className="text-white">No playable stream available for this channel.</div>
        )}
      </div>

    </div>
  );
};

export default PlayerModal;
