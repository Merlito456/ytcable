import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { 
  Volume2, VolumeX, X, List, Tv, Clock, Play, 
  SkipForward, AlertCircle, Menu, Maximize2, 
  Minimize2, Film, Heart, Share2, Info 
} from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
}

export function Player({ channel, videos }: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippingVideo, setSkippingVideo] = useState<Video | null>(null);
  const [skipCountdown, setSkipCountdown] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const skipTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-hide controls after 3 seconds of inactivity
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showControls]);

  // Show controls on mouse move
  const handleMouseMove = () => {
    setShowControls(true);
  };

  // Skip countdown timer
  useEffect(() => {
    if (skipCountdown > 0) {
      skipTimeoutRef.current = setTimeout(() => {
        setSkipCountdown(skipCountdown - 1);
      }, 1000);
    } else if (skipCountdown === 0 && skippingVideo) {
      handleSkipVideo();
    }
    return () => {
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
    };
  }, [skipCountdown, skippingVideo]);

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Function to skip the current video and play next
  const handleSkipVideo = () => {
    if (!playback?.nextVideo || !videos.length) return;
    
    const currentVideoIndex = videos.findIndex(v => v.id === playback.currentVideo?.id);
    const nextVideoIndex = (currentVideoIndex + 1) % videos.length;
    const nextVideo = videos[nextVideoIndex];
    
    setPlayback({
      currentVideo: nextVideo,
      offset: 0,
      nextVideo: videos[(nextVideoIndex + 1) % videos.length],
    });
    
    setSkippingVideo(null);
    setSkipCountdown(0);
  };

  // Handle mute/unmute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Handle video errors
  const onError: YouTubeProps['onError'] = (event) => {
    const errorCode = event.data;
    if (playback?.currentVideo && !skippingVideo) {
      setSkippingVideo(playback.currentVideo);
      setSkipCountdown(5);
      setError(`Video unavailable. Skipping in 5 seconds...`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const manualSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (skippingVideo) {
      handleSkipVideo();
    } else if (playback?.nextVideo) {
      setSkippingVideo(playback.currentVideo);
      handleSkipVideo();
    }
  };

  useEffect(() => {
    if (!videos || videos.length === 0) {
      setError('No videos found in this channel');
      return;
    }

    const calculatePlayback = () => {
      if (skippingVideo) return;
      
      try {
        const now = Date.now();
        const elapsedMs = now - channel.startTime;
        const elapsedSeconds = elapsedMs / 1000;

        const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
        
        if (totalDuration === 0) {
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
          setPlayback({ currentVideo, offset, nextVideo });
          setError(null);
        }
      } catch (err) {
        console.error('Error calculating playback:', err);
      }
    };

    calculatePlayback();
    const interval = setInterval(calculatePlayback, 1000);
    return () => clearInterval(interval);
  }, [channel, videos, skippingVideo]);

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    
    if (playback && !skippingVideo) {
      try {
        event.target.seekTo(playback.offset, true);
        event.target.playVideo();
        if (isMuted) event.target.mute();
      } catch (err) {
        console.error('Error in onReady:', err);
      }
    }
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    try {
      if (event.data === YouTube.PlayerState.PLAYING && playback && !skippingVideo) {
        const currentTime = event.target.getCurrentTime();
        const diff = Math.abs(currentTime - playback.offset);
        if (diff > 2) {
          event.target.seekTo(playback.offset, true);
        }
      }
      
      if (event.data === YouTube.PlayerState.PAUSED && !skippingVideo) {
        event.target.playVideo();
      }
    } catch (err) {
      console.error('Error in onStateChange:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentProgress = () => {
    if (!playback?.currentVideo || !videos.length || skippingVideo) return 0;
    
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

  // Loading state
  if (!playback || !playback.currentVideo || skippingVideo) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 font-medium">
            {skippingVideo ? 'Skipping to next video...' : 'Loading your experience...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onMouseMove={handleMouseMove}
    >
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
          onError={onError}
          className="w-full h-full"
        />
      </div>

      {/* Gradient Overlay for better text visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

      {/* Video Controls Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-4">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer group">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000 relative"
              style={{ width: `${getCurrentProgress()}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Channel Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{channel.name}</h3>
                <p className="text-white/50 text-xs">Live 24/7</p>
              </div>
            </div>

            {/* Now Playing */}
            <div className="hidden md:block border-l border-white/20 pl-4 ml-2">
              <p className="text-white/60 text-xs uppercase tracking-wider">NOW PLAYING</p>
              <p className="text-white text-sm font-medium line-clamp-1 max-w-md">
                {playback.currentVideo.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>

            {/* Skip Button */}
            <button
              onClick={manualSkip}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
              title="Skip to next video"
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>

            {/* Menu Button */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      {showSidebar && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-50 transition-opacity"
            onClick={() => setShowSidebar(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 z-[60] shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="sticky top-0 bg-black/95 backdrop-blur-xl border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-orange-500" />
                  <h3 className="text-white font-bold">Channel Info</h3>
                </div>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-white/60 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Channel Header */}
              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-white/10">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Tv className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-white text-xl font-bold text-center mb-2">{channel.name}</h2>
                <p className="text-white/60 text-sm text-center">{channel.description || 'No description available'}</p>
                <div className="flex items-center justify-center gap-4 mt-4 text-white/40 text-xs">
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
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">NOW PLAYING</p>
                </div>
                <p className="text-white font-semibold text-sm mb-3">{playback.currentVideo.title}</p>
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000"
                    style={{ width: `${getCurrentProgress()}%` }}
                  />
                </div>
                <div className="flex justify-between text-white/40 text-xs mt-2">
                  <span>{formatDuration(playback.offset)}</span>
                  <span>{formatDuration(playback.currentVideo.duration)}</span>
                </div>
              </div>

              {/* Up Next */}
              {playback.nextVideo && (
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <SkipForward className="w-3 h-3 text-white/40" />
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider">UP NEXT</p>
                  </div>
                  <p className="text-white text-sm font-medium">{playback.nextVideo.title}</p>
                  <p className="text-white/40 text-xs mt-1">{formatDuration(playback.nextVideo.duration)}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-3">
                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
                  <Heart className="w-4 h-4" />
                  Like
                </button>
                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm">
                  <Info className="w-4 h-4" />
                  Info
                </button>
              </div>

              {/* Playlist Preview */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">PLAYLIST</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {videos.slice(0, 8).map((video, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-white/30 font-mono w-6">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-white/80 line-clamp-1">{video.title}</p>
                        <p className="text-white/30 text-[10px]">{formatDuration(video.duration)}</p>
                      </div>
                    </div>
                  ))}
                  {videos.length > 8 && (
                    <p className="text-white/30 text-[10px] text-center mt-2">
                      +{videos.length - 8} more videos
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}