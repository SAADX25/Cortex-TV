import React from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ channel, onBack }) => {
  if (!channel) return null;

  const isElectron = typeof window !== 'undefined' && (
    (window.process && window.process.versions && Boolean(window.process.versions.electron)) ||
    (navigator && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0)
  );

  const streamUrl = channel.stream || '';
  const proxiedUrl = isElectron ? streamUrl : ('https://corsproxy.io/?' + encodeURIComponent(streamUrl));

  return (
    <div className="flex-1 flex flex-col bg-black h-full overflow-hidden relative">

      <div className="p-4 z-10 w-full flex-shrink-0">
        <button onClick={onBack} className="bg-white/6 hover:bg-white/10 text-white rounded px-3 py-1">← Back to Globe</button>
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 pb-8">
        <div className="w-full h-full max-h-full aspect-video relative rounded-xl overflow-hidden shadow-2xl">
          <ReactPlayer
            url={proxiedUrl}
            width="100%"
            height="100%"
            className="absolute top-0 left-0"
            playing
            controls
            config={{ file: { forceHLS: true } }}
          />
        </div>
      </div>

    </div>
  );
};

export default VideoPlayer;
