import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import ReactPlayer from 'react-player';

const DraggablePlayer = ({ channel, onClose }) => {
  if (!channel) return null;

  const nodeRef = useRef(null);

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle">
      <div ref={nodeRef} className="w-[800px] aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col z-50">
        <div className="drag-handle bg-black/60 backdrop-blur-md border-b border-white/10 p-3 flex justify-between items-center cursor-move">
          <span className="text-xs text-white">Live Stream</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500 flex items-center justify-center transition-colors text-white text-xs">✕</button>
        </div>

        <div className="flex-1 bg-black relative">
          <ReactPlayer
            url={channel.stream}
            width="100%"
            height="100%"
            playing
            controls
            config={{ file: { forceHLS: true } }}
          />
        </div>
      </div>
    </Draggable>
  );
};

export default DraggablePlayer;
