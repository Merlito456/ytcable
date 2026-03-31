import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { Volume2, VolumeX, X, List, Tv, Clock, Users, Play, SkipForward, AlertCircle } from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
}

export function Player({ channel, videos }: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    console.log('Player mounted with videos:', videos.length);
    console.log('Channel:', channel);
    
    if (!videos || videos.length === 0) {
      console.log('No videos available');
      setError('No videos found in this channel');
      return;
    }

    // Check if videos have valid durations
    const invalidVideos = videos.filter(v => !v.duration || v.duration <= 0);
    if (invalidVideos.length > 0) {
      console.warn('Videos with invalid durations:', invalidVideos);
    }

    const calculatePlayback = () => {
      try {
        const now = Date.now();
        const elapsedMs = now - channel.startTime;
        const elapsedSeconds = elapsedMs / 1000;

        const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
        
        if (totalDuration === 0) {
          console.error('Total duration is 0');
          setError('Invalid video durations');
          return;
        }

        const currentCycleElapsed = elapsedSeconds % totalDuration;

        let accumulated = 0;
        let currentVideo: Video | null = null;
        let offset = 0;
        let nextVideo: Video | null = null;

        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          const duration = v.duration || 0;
          
          if (currentCycleElapsed < accumulated + duration) {
            currentVideo = v;
            offset = currentCycleElapsed - accumulated;
            nextVideo = videos[(i + 1) % videos.length];
            break;
          }
          accumulated += duration;
        }

        if (currentVideo) {
          console.log('Current video:', currentVideo.title, 'offset:', offset);
          setPlayback({ currentVideo, offset, nextVideo });
          setError(null);
        } else {
          console.error('No current video found');
          setError('Failed to determine current video');
        }
      } catch (err) {
        console.error('Error calculating playback:', err);
        setError('Playback calculation error');
      }
    };

    calculatePlayback();
    const interval = setInterval(calculatePlayback, 1000);
    return () => clearInterval(interval);
  }, [channel, videos]);

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    if (playback) {
      try {
        event.target.seekTo(playback.offset, true);
        event.target.playVideo();
        
        if (!isMuted) {
          event.target.unMute();
        } else {
          event.target.mute();
        }
      } catch (err) {
        console.error('Error in onReady:', err);
      }
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      try {
        if (isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
        } else {
          playerRef.current.mute();
          setIsMuted(true);
        }
      } catch (err) {
        console.error('Error toggling mute:', err);
      }
    }
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    try {
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
    } catch (err) {
      console.error('Error in onStateChange:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentProgress = () => {
    if (!playback?.currentVideo || !videos.length) return 0;
    
    try {
      const now = Date.now();
      const elapsedMs = now - channel.startTime;
      const elapsedSeconds = elapsedMs / 1000;
      const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
      const currentCycleElapsed = elapsedSeconds % totalDuration;
      
      let accumulated = 0;
      for (const v of videos) {
        const duration = v.duration || 0;
        if (currentCycleElapsed < accumulated + duration) {
          const videoOffset = currentCycleElapsed - accumulated;
          return (videoOffset / duration) * 100;
        }
        accumulated += duration;
      }
    } catch (err) {
      console.error('Error calculating progress:', err);
    }
    return 0;
  };

  // Show error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <AlertCircle className="w-16 h-16 text-orange-500" />
          <p className="text-lg font-bold text-white">Channel Error</p>
          <p className="text-sm text-white/60">{error}</p>
          <p className="text-xs text-white/40 mt-4">
            Videos: {videos.length} • Channel: {channel.name}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-500 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (!playback || !playback.currentVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-white/40">
            Tuning Channel...
          </p>
          <p className="text-xs text-white/20">
            {videos.length} video{videos.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* YouTube Player */}
      <div className="absolute inset-0">
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

      {/* Channel Name Overlay (Top Left) - More Compact */}
      <div className={`absolute top-6 left-6 z-40 transition-all duration-300 ${showInfo ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/60 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-orange-500" />
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
              {channel.name}
            </h1>
          </div>
          {channel.description && (
            <p className="text-white/60 text-xs mt-1 max-w-md line-clamp-1">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      {/* Now Playing Overlay (Bottom Left) - More Compact */}
      <div className={`absolute bottom-6 left-6 right-6 md:right-auto z-40 transition-all duration-300 ${showInfo ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 max-w-md">
          <p className="text-orange-500 text-[10px] font-bold uppercase tracking-wider mb-1">
            NOW PLAYING
          </p>
          <h2 className="text-white text-sm md:text-base font-bold line-clamp-2">
            {playback.currentVideo.title}
          </h2>
          {playback.nextVideo && (
            <p className="text-white/40 text-[10px] mt-1">
              Up Next: {playback.nextVideo.title}
            </p>
          )}
          
          {/* Progress Bar */}
          <div className="mt-2">
            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                style={{ width: `${getCurrentProgress()}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons - More Compact */}
      <div className="absolute top-6 right-6 z-50 flex gap-2">
        <button
          onClick={() => setShowChannelList(!showChannelList)}
          className="bg-black/60 backdrop-blur-md text-white p-2 rounded-lg hover:bg-orange-600 transition-all border border-white/10"
          title="Channel List"
        >
          <List className="w-4 h-4" />
        </button>
        
        <button
          onClick={toggleMute}
          className="bg-black/60 backdrop-blur-md text-white p-2 rounded-lg hover:bg-orange-600 transition-all border border-white/10"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Channel List - Half Screen Width, Bottom Position */}
      {showChannelList && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 z-50 transition-opacity"
            onClick={() => setShowChannelList(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-0 md:top-0 md:w-1/2 bg-black/95 backdrop-blur-xl border-t md:border-l border-white/10 z-50 shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-orange-500" />
                <h3 className="text-white font-bold text-sm">Channel Information</h3>
              </div>
              <button
                onClick={() => setShowChannelList(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-y-auto h-[60vh] md:h-full pb-20">
              <div className="p-4 space-y-4">
                {/* Channel Details */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-bold text-lg mb-1">{channel.name}</h4>
                  <p className="text-white/60 text-sm mb-3">
                    {channel.description || 'No description available'}
                  </p>
                  <div className="flex items-center gap-4 text-white/40 text-xs">
                    <div className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      <span>{videos.length} videos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>24/7 Live</span>
                    </div>
                  </div>
                </div>

                {/* Now Playing Section */}
                <div className="bg-orange-500/10 border-l-2 border-orange-500 rounded-lg">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                      <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                        NOW PLAYING
                      </p>
                    </div>
                    <p className="text-white font-semibold text-sm line-clamp-2">
                      {playback.currentVideo.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-white/40 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(playback.currentVideo.duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Up Next Preview */}
                {playback.nextVideo && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <SkipForward className="w-3 h-3 text-white/40" />
                      <p className="text-white/40 text-xs font-bold uppercase tracking-wider">
                        UP NEXT
                      </p>
                    </div>
                    <p className="text-white text-sm font-medium line-clamp-2">
                      {playback.nextVideo.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-white/40 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(playback.nextVideo.duration)}</span>
                    </div>
                  </div>
                )}

                {/* Playlist Preview */}
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">
                    PLAYLIST PREVIEW
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {videos.slice(0, 5).map((video, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="text-white/30 font-mono w-6">{idx + 1}</span>
                        <div className="flex-1">
                          <p className="text-white/70 line-clamp-1">{video.title}</p>
                          <p className="text-white/30 text-[10px]">{formatDuration(video.duration)}</p>
                        </div>
                      </div>
                    ))}
                    {videos.length > 5 && (
                      <p className="text-white/30 text-[10px] text-center mt-2">
                        +{videos.length - 5} more videos
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Click to show info overlay */}
      <div 
        className="absolute inset-0 cursor-pointer z-30"
        onClick={() => setShowInfo(true)}
      />
    </div>
  );
}