import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { Volume2, VolumeX } from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
}

export function Player({ channel, videos }: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Start muted to allow autoplay
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (videos.length === 0) return;

    const calculatePlayback = () => {
      const now = Date.now();
      const elapsedMs = now - channel.startTime;
      const elapsedSeconds = elapsedMs / 1000;

      const totalDuration = videos.reduce((acc, v) => acc + v.duration, 0);
      const currentCycleElapsed = elapsedSeconds % totalDuration;

      let accumulated = 0;
      let currentVideo: Video | null = null;
      let offset = 0;
      let nextVideo: Video | null = null;

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        if (currentCycleElapsed < accumulated + v.duration) {
          currentVideo = v;
          offset = currentCycleElapsed - accumulated;
          nextVideo = videos[(i + 1) % videos.length];
          break;
        }
        accumulated += v.duration;
      }

      setPlayback({ currentVideo, offset, nextVideo });
    };

    calculatePlayback();
    const interval = setInterval(calculatePlayback, 1000);
    return () => clearInterval(interval);
  }, [channel, videos]);

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    if (playback) {
      event.target.seekTo(playback.offset, true);
      event.target.playVideo();
      
      // Try to unmute. Note: Browsers may block unmuted autoplay until user interaction.
      if (!isMuted) {
        event.target.unMute();
      } else {
        event.target.mute();
      }
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    }
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    // Sync check when video starts playing
    if (event.data === YouTube.PlayerState.PLAYING && playback) {
      const currentTime = event.target.getCurrentTime();
      const diff = Math.abs(currentTime - playback.offset);
      // If more than 2 seconds out of sync, re-seek
      if (diff > 2) {
        event.target.seekTo(playback.offset, true);
      }
    }
    
    // If paused by user or browser, try to resume (Cable TV feel)
    if (event.data === YouTube.PlayerState.PAUSED) {
      event.target.playVideo();
    }
  };

  if (!playback || !playback.currentVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-white/40">Tuning Channel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="absolute inset-0 scale-110">
        <YouTube
          videoId={playback.currentVideo.youtubeId}
          opts={{
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
              mute: 1, // Start muted to allow autoplay
              iv_load_policy: 3,
              autohide: 1
            },
          }}
          onReady={onReady}
          onStateChange={onStateChange}
          className="w-full h-full"
        />
      </div>
      
      {/* Mute Toggle Overlay */}
      <div className="absolute top-24 right-6 md:top-32 md:right-12 z-50">
        <button
          onClick={toggleMute}
          className="bg-white/10 backdrop-blur-xl text-white p-3 md:p-4 rounded-xl md:rounded-2xl hover:bg-orange-600 transition-all border border-white/10 shadow-2xl"
        >
          {isMuted ? <VolumeX className="w-5 h-5 md:w-6 md:h-6" /> : <Volume2 className="w-5 h-5 md:w-6 md:h-6" />}
        </button>
      </div>

      {/* Vignette Overlay for better UI visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
    </div>
  );
}
