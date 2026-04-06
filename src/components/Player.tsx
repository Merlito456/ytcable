import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { 
  Volume2, VolumeX, X, Tv, Clock, Play, 
  SkipForward, SkipBack, AlertCircle, Menu, Maximize2, 
  Minimize2, Film, Heart, Info, 
  ChevronRight, ChevronLeft, ThumbsUp, 
  ThumbsDown, Bookmark, RefreshCw
} from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
  allChannels?: Channel[];
  onChannelChange?: (channel: Channel) => void;
  onShowGuide?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

export function Player({ 
  channel, 
  videos, 
  allChannels = [], 
  onChannelChange, 
  onShowGuide,
  onToggleFavorite,
  isFavorite = false
}: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [skippingVideo, setSkippingVideo] = useState<Video | null>(null);
  const [skipCountdown, setSkipCountdown] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [manualRetry, setManualRetry] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const skipTimeoutRef = useRef<NodeJS.Timeout>();
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

  // Find current channel index
  const currentChannelIndex = allChannels.findIndex(c => c.id === channel.id);
  const hasPrevious = currentChannelIndex > 0;
  const hasNext = currentChannelIndex < allChannels.length - 1;

  // Previous channel
  const handlePreviousChannel = () => {
    if (hasPrevious && onChannelChange) {
      const prevChannel = allChannels[currentChannelIndex - 1];
      setPlayback(null);
      setPlayerReady(false);
      setCurrentVideoId('');
      setError(null);
      setSkippingVideo(null);
      onChannelChange(prevChannel);
    }
  };

  // Next channel
  const handleNextChannel = () => {
    if (hasNext && onChannelChange) {
      const nextChannel = allChannels[currentChannelIndex + 1];
      setPlayback(null);
      setPlayerReady(false);
      setCurrentVideoId('');
      setError(null);
      setSkippingVideo(null);
      onChannelChange(nextChannel);
    }
  };

  // Auto-hide controls after 3 seconds
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

  // Fullscreen handling
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

  // Skip current video
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
    setPlayerReady(false);
  };

  // Handle mute/unmute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    localStorage.setItem('playerMuted', String(newMutedState));
    
    if (playerRef.current && playerReady) {
      try {
        if (newMutedState) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (err) {
        console.error('Error toggling mute:', err);
      }
    }
  };

  // Load saved mute preference
  useEffect(() => {
    const savedMuted = localStorage.getItem('playerMuted');
    if (savedMuted !== null) {
      setIsMuted(savedMuted === 'true');
    }
  }, []);

  // Handle retry
  const handleRetry = () => {
    if (playerRef.current && playback?.currentVideo && playerReady) {
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

  // Handle video errors
  const onError: YouTubeProps['onError'] = (event) => {
    const errorCode = event.data;
    let userMessage = '';
    
    switch (errorCode) {
      case 2:
        userMessage = 'The video may have been removed or is invalid.';
        break;
      case 5:
        userMessage = 'This video cannot be played in your browser.';
        break;
      case 100:
        userMessage = 'The video has been removed or is unavailable.';
        break;
      case 101:
      case 150:
        userMessage = 'This video cannot be embedded or is private.';
        break;
      default:
        userMessage = 'An unexpected error occurred.';
    }
    
    console.error(`YouTube Error:`, event);
    
    if (playback?.currentVideo && !skippingVideo) {
      setSkippingVideo(playback.currentVideo);
      setSkipCountdown(5);
      setErrorDetails(userMessage);
      setError(`"${playback.currentVideo.title}" is unavailable. Skipping in 5 seconds...`);
      
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

  // Calculate playback for current channel
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
          const videoChanged = currentVideoId !== currentVideo.youtubeId;
          setPlayback({ currentVideo, offset, nextVideo });
          setCurrentVideoId(currentVideo.youtubeId);
          setError(null);
          
          if (videoChanged) {
            setPlayerReady(false);
          }
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
    setPlayerReady(true);
    
    if (playback && !skippingVideo) {
      try {
        event.target.seekTo(playback.offset, true);
        event.target.playVideo();
        
        if (isMuted) {
          event.target.mute();
        } else {
          event.target.unMute();
        }
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
        
        if (isMuted !== event.target.isMuted()) {
          if (isMuted) {
            event.target.mute();
          } else {
            event.target.unMute();
          }
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
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">
            {skippingVideo ? 'Skipping to next video...' : `Loading ${channel.name}...`}
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
          key={currentVideoId}
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
              mute: isMuted ? 1 : 0,
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent px-6 py-4 transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base">{channel.name}</h1>
              <p className="text-white/40 text-[10px]">24/7 Live</p>
            </div>
          </div>
          <button
            onClick={onShowGuide}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            title="TV Guide"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Center Info (Now Playing) */}
      <div className={`absolute bottom-32 left-8 right-8 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="max-w-2xl">
          <p className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-2">Now Playing</p>
          <h2 className="text-white text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
            {playback.currentVideo.title}
          </h2>
          {playback.nextVideo && (
            <p className="text-white/40 text-xs">
              Up Next: {playback.nextVideo.title}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Progress Bar */}
        <div className="h-1 bg-white/20">
          <div 
            className="h-full bg-orange-500 transition-all duration-1000"
            style={{ width: `${getCurrentProgress()}%` }}
          />
        </div>
        
        {/* Control Bar */}
        <div className="bg-gradient-to-t from-black/90 to-transparent px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Previous Channel */}
              <button
                onClick={handlePreviousChannel}
                disabled={!hasPrevious}
                className={`p-2 rounded-lg transition ${hasPrevious ? 'hover:bg-white/10 text-white' : 'text-white/30 cursor-not-allowed'}`}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              {/* Next Channel */}
              <button
                onClick={handleNextChannel}
                disabled={!hasNext}
                className={`p-2 rounded-lg transition ${hasNext ? 'hover:bg-white/10 text-white' : 'text-white/30 cursor-not-allowed'}`}
              >
                <SkipForward className="w-5 h-5" />
              </button>
              
              <div className="w-px h-5 bg-white/20 mx-1" />
              
              {/* Mute */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-white/10 transition text-white"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              {/* Skip Video */}
              <button
                onClick={manualSkip}
                className="p-2 rounded-lg hover:bg-white/10 transition text-white"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              
              {/* Favorite Button */}
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`p-2 rounded-lg transition ${
                    isFavorite ? 'text-orange-500' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-orange-500' : ''}`} />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Info */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition text-white"
              >
                <Info className="w-5 h-5" />
              </button>
              
              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-white/10 transition text-white"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {/* Time Display */}
          <div className="flex justify-between text-white/40 text-xs mt-2">
            <span>{formatDuration(playback.offset)}</span>
            <span>{formatDuration(playback.currentVideo.duration)}</span>
          </div>
        </div>
      </div>

      {/* Channel Navigation Indicator */}
      {(hasPrevious || hasNext) && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 bottom-24 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-black/60 rounded-full px-3 py-1 text-white/40 text-xs flex items-center gap-2">
            <SkipBack className="w-3 h-3" />
            <span>{currentChannelIndex + 1} / {allChannels.length}</span>
            <SkipForward className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-red-500/95 text-white px-4 py-2 rounded-lg shadow-lg max-w-md text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
              {skipCountdown > 0 && (
                <span className="text-white/80 text-xs ml-2">({skipCountdown}s)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50" onClick={() => setShowInfoModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-xl border-t border-white/10 p-5 animate-in slide-in-from-bottom duration-300 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">{channel.name}</h3>
                <p className="text-white/40 text-xs mt-1">24/7 Live Channel</p>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-white/70 text-sm mb-4 leading-relaxed">
              {channel.description || `${channel.name} - 24/7 streaming of curated content.`}
            </p>
            
            <div className="flex items-center gap-4 text-white/40 text-xs border-t border-white/10 pt-3">
              <div className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                <span>{videos.length} videos</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3div className="flex items-center gap-1">
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