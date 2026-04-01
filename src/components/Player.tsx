import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { 
  Volume2, VolumeX, X, Tv, Clock, Play, 
  SkipForward, AlertCircle, Menu, Maximize2, 
  Minimize2, Film, Heart, Share2, Info, 
  ChevronRight, ChevronLeft, ThumbsUp, 
  ThumbsDown, Bookmark, MoreHorizontal, RefreshCw
} from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
  onShowGuide?: () => void;
}

export function Player({ channel, videos, onShowGuide }: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [skippingVideo, setSkippingVideo] = useState<Video | null>(null);
  const [skipCountdown, setSkipCountdown] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [manualRetry, setManualRetry] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const skipTimeoutRef = useRef<NodeJS.Timeout>();
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

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
    if (skipCountdown > 0 && skippingVideo) {
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
    setError(null);
    setErrorDetails('');
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

  // Handle retry
  const handleRetry = () => {
    if (playerRef.current && playback?.currentVideo) {
      setManualRetry(true);
      setError(null);
      setErrorDetails('');
      setRetryCount(retryCount + 1);
      
      try {
        playerRef.current.loadVideoById({
          videoId: playback.currentVideo.youtubeId,
          startSeconds: playback.offset
        });
      } catch (err) {
        console.error('Error retrying video:', err);
      }
      
      setTimeout(() => setManualRetry(false), 1000);
    }
  };

  // Handle video errors with detailed messages
  const onError: YouTubeProps['onError'] = (event) => {
    const errorCode = event.data;
    let errorMessage = '';
    let userMessage = '';
    
    // YouTube player error codes
    switch (errorCode) {
      case 2:
        errorMessage = 'Invalid video ID';
        userMessage = 'The video may have been removed or is invalid.';
        break;
      case 5:
        errorMessage = 'HTML5 player error';
        userMessage = 'This video cannot be played in your browser.';
        break;
      case 100:
        errorMessage = 'Video not found';
        userMessage = 'The video has been removed or is unavailable.';
        break;
      case 101:
      case 150:
        errorMessage = 'Embedding disabled';
        userMessage = 'This video cannot be embedded or is private.';
        break;
      default:
        errorMessage = `Unknown error (${errorCode})`;
        userMessage = 'An unexpected error occurred.';
    }
    
    console.error(`YouTube Error: ${errorMessage}`, event);
    
    if (playback?.currentVideo && !skippingVideo) {
      setSkippingVideo(playback.currentVideo);
      setSkipCountdown(5);
      setErrorDetails(userMessage);
      setError(`"${playback.currentVideo.title}" is unavailable. Skipping in 5 seconds...`);
      
      // Clear error after 6 seconds (allowing time for skip)
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => {
        if (!skippingVideo) {
          setError(null);
          setErrorDetails('');
        }
      }, 6000);
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
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Tv className="w-8 h-8 text-orange-500 animate-pulse" />
            </div>
          </div>
          <p className="text-white/60 font-medium tracking-wide">
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

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20 pointer-events-none" />

      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl tracking-tight">{channel.name}</h1>
                <p className="text-white/50 text-xs">24/7 Live Streaming</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onShowGuide && (
              <button
                onClick={() => onShowGuide()}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
                title="TV Guide"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center Info (Now Playing) */}
      <div className={`absolute bottom-32 left-12 right-12 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-6 bg-gradient-to-t from-orange-500 to-red-500 rounded-full" />
            <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">Now Playing</p>
          </div>
          <h2 className="text-white text-3xl md:text-4xl font-bold mb-2 line-clamp-2">
            {playback.currentVideo.title}
          </h2>
          {playback.nextVideo && (
            <p className="text-white/50 text-sm flex items-center gap-2">
              <span>Up Next:</span>
              <span className="text-white/70">{playback.nextVideo.title}</span>
            </p>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Progress Bar */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className="relative group">
            <div className="h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-1000 relative"
                style={{ width: `${getCurrentProgress()}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              </div>
            </div>
            <div className="flex justify-between text-white/40 text-xs mt-2">
              <span>{formatDuration(playback.offset)}</span>
              <span>{formatDuration(playback.currentVideo.duration)}</span>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={manualSkip}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>
            <div className="h-6 w-px bg-white/20 mx-2" />
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2 rounded-full transition-all backdrop-blur-sm border border-white/10 ${isLiked ? 'bg-orange-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
            >
              <ThumbsDown className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`p-2 rounded-full transition-all backdrop-blur-sm border border-white/10 ${isBookmarked ? 'bg-orange-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
            >
              <Info className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all backdrop-blur-sm border border-white/10"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Error Toast with Retry and Countdown */}
      {error && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-gradient-to-r from-red-500/95 to-orange-500/95 backdrop-blur-md text-white px-6 py-4 rounded-xl shadow-2xl border border-white/20 max-w-md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Playback Error</p>
                <p className="text-xs text-white/80">{error}</p>
                {errorDetails && (
                  <p className="text-[10px] text-white/60 mt-1">{errorDetails}</p>
                )}
                {skipCountdown > 0 && !manualRetry && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white rounded-full transition-all duration-1000"
                          style={{ width: `${(skipCountdown / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/60">Skipping in {skipCountdown}s</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleRetry}
                    disabled={manualRetry}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${manualRetry ? 'animate-spin' : ''}`} />
                    {manualRetry ? 'Retrying...' : 'Retry'}
                  </button>
                  <button
                    onClick={manualSkip}
                    className="px-3 py-1 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-medium transition-all"
                  >
                    Skip Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50" onClick={() => setShowInfoModal(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-white/10 p-6 z-50 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <Tv className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">{channel.name}</h3>
                  <p className="text-white/40 text-xs">24/7 Live Channel</p>
                </div>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/70 text-sm mb-4 leading-relaxed">
              {channel.description || 'No description available'}
            </p>
            <div className="flex items-center gap-4 text-white/40 text-xs border-t border-white/10 pt-4">
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
        </>
      )}
    </div>
  );
}

export default Player;