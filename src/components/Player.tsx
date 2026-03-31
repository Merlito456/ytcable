import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { Volume2, VolumeX, X, List, Tv, Clock, Users, ChevronRight, ChevronLeft } from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
}

export function Player({ channel, videos }: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const playerRef = useRef<any>(null);
  const infoTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-hide info overlay after 3 seconds
  useEffect(() => {
    if (showInfo) {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
      infoTimeoutRef.current = setTimeout(() => {
        setShowInfo(false);
      }, 3000);
    }
    return () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    };
  }, [showInfo]);

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
    if (event.data === YouTube.PlayerState.PLAYING && playback) {
      const currentTime = event.target.getCurrentTime();
      const diff = Math.abs(currentTime - playback.offset);
      if (diff > 2) {
        event.target.seekTo(playback.offset, true);
      }
    }
    
    if (event.data === YouTube.PlayerState.PAUSED) {
      event.target.playVideo();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentProgress = () => {
    if (!playback?.currentVideo) return 0;
    const now = Date.now();
    const elapsedMs = now - channel.startTime;
    const elapsedSeconds = elapsedMs / 1000;
    const totalDuration = videos.reduce((acc, v) => acc + v.duration, 0);
    const currentCycleElapsed = elapsedSeconds % totalDuration;
    
    let accumulated = 0;
    for (const v of videos) {
      if (currentCycleElapsed < accumulated + v.duration) {
        const videoOffset = currentCycleElapsed - accumulated;
        return (videoOffset / v.duration) * 100;
      }
      accumulated += v.duration;
    }
    return 0;
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
      {/* YouTube Player */}
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
              mute: 1,
              iv_load_policy: 3,
              autohide: 1
            },
          }}
          onReady={onReady}
          onStateChange={onStateChange}
          className="w-full h-full"
        />
      </div>

      {/* Channel Info Overlay (Auto-hides) */}
      {showInfo && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent pt-16 pb-8 z-40 animate-in fade-in slide-in-from-top duration-500">
          <div className="px-6 md:px-12">
            <div className="flex items-center gap-3 mb-2">
              <Tv className="w-6 h-6 text-orange-500" />
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tight">
                {channel.name}
              </h1>
            </div>
            {channel.description && (
              <p className="text-white/70 text-sm md:text-base max-w-2xl line-clamp-2">
                {channel.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-white/50 text-xs md:text-sm">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Live 24/7</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{videos.length} videos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Now Playing Overlay (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-6 z-40">
        <div className="px-6 md:px-12">
          <div className="max-w-3xl">
            <p className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-1">
              NOW PLAYING
            </p>
            <h2 className="text-white text-lg md:text-2xl font-bold mb-2 line-clamp-2">
              {playback.currentVideo.title}
            </h2>
            {playback.nextVideo && (
              <p className="text-white/40 text-xs md:text-sm">
                Up Next: {playback.nextVideo.title}
              </p>
            )}
            
            {/* Progress Bar */}
            <div className="mt-3 w-full max-w-md">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                  style={{ width: `${getCurrentProgress()}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute top-24 right-6 md:top-32 md:right-12 z-50 flex flex-col gap-3">
        <button
          onClick={() => setShowChannelList(!showChannelList)}
          className="bg-black/50 backdrop-blur-xl text-white p-3 md:p-4 rounded-xl hover:bg-orange-600 transition-all border border-white/10 shadow-2xl group"
          title="Channel List"
        >
          <List className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
        </button>
        
        <button
          onClick={toggleMute}
          className="bg-black/50 backdrop-blur-xl text-white p-3 md:p-4 rounded-xl hover:bg-orange-600 transition-all border border-white/10 shadow-2xl group"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
          ) : (
            <Volume2 className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
          )}
        </button>

        <button
          onClick={() => setShowInfo(true)}
          className="bg-black/50 backdrop-blur-xl text-white p-3 md:p-4 rounded-xl hover:bg-orange-600 transition-all border border-white/10 shadow-2xl group"
          title="Show Info"
        >
          <Tv className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Channel List Sidebar - Compact and Sleek */}
      {showChannelList && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setShowChannelList(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 z-50 shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-orange-500" />
                <h3 className="text-white font-bold">Channels</h3>
              </div>
              <button
                onClick={() => setShowChannelList(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto h-full pb-20">
              {/* This is where you'd map through available channels */}
              <div className="p-2">
                <div className="px-3 py-2 text-white/40 text-xs uppercase tracking-wider">
                  Currently Playing
                </div>
                <div className="bg-orange-500/10 border-l-2 border-orange-500 mx-2 rounded-r-lg">
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
                      <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                        NOW PLAYING
                      </p>
                    </div>
                    <p className="text-white font-bold text-sm mt-1 line-clamp-2">
                      {playback.currentVideo.title}
                    </p>
                    <p className="text-white/40 text-xs mt-1">
                      {formatDuration(playback.currentVideo.duration)}
                    </p>
                  </div>
                </div>
                
                <div className="px-3 py-2 mt-4 text-white/40 text-xs uppercase tracking-wider">
                  Channel Info
                </div>
                <div className="mx-2 bg-white/5 rounded-lg p-3">
                  <h4 className="text-white font-bold text-sm">{channel.name}</h4>
                  <p className="text-white/60 text-xs mt-1 line-clamp-3">
                    {channel.description || 'No description available'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-white/40 text-xs">
                    <span>{videos.length} videos</span>
                    <span>•</span>
                    <span>24/7 Live</span>
                  </div>
                </div>

                {/* Up Next Preview */}
                {playback.nextVideo && (
                  <>
                    <div className="px-3 py-2 mt-4 text-white/40 text-xs uppercase tracking-wider">
                      Up Next
                    </div>
                    <div className="mx-2 bg-white/5 rounded-lg p-3">
                      <p className="text-white text-sm font-medium line-clamp-2">
                        {playback.nextVideo.title}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        {formatDuration(playback.nextVideo.duration)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Vignette Overlay for better UI visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20 pointer-events-none" />
      
      {/* Click to show info overlay */}
      <div 
        className="absolute inset-0 cursor-pointer z-30"
        onClick={() => setShowInfo(true)}
      />
    </div>
  );
}