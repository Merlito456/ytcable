import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { 
  Volume2, VolumeX, X, Tv, Clock, Play, 
  SkipForward, SkipBack, AlertCircle, Menu, Maximize2, 
  Minimize2, Film, Heart, Share2, Info, 
  ChevronRight, ChevronLeft, ThumbsUp, 
  ThumbsDown, Bookmark, MoreHorizontal, RefreshCw,
  Home, Search, PlayCircle, Plus, ChevronDown
} from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
  allChannels?: Channel[];
  onChannelChange?: (channel: Channel) => void;
  onShowGuide?: () => void;
}

export function Player({ channel, videos, allChannels = [], onChannelChange, onShowGuide }: PlayerProps) {
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
  const [showGenreMenu, setShowGenreMenu] = useState(false);
  const [showChannelMenu, setShowChannelMenu] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const skipTimeoutRef = useRef<NodeJS.Timeout>();
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

  // Genres for Netflix-style menu
  const genres = ['All', 'Action', 'Comedy', 'Drama', 'Documentary', 'Horror', 'Romance', 'Sci-Fi'];

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
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
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
            <div className="w-16 h-16 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto mb-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-red-600 font-bold text-2xl">N</div>
            </div>
          </div>
          <p className="text-white/60 font-medium tracking-wide">
            {skippingVideo ? 'Skipping to next...' : `Loading ${channel.name}...`}
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

      {/* Netflix-style Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30 pointer-events-none" />

      {/* Netflix-style Top Navigation */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent px-8 py-4 transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Netflix Logo */}
            <div className="text-red-600 font-black text-2xl tracking-tighter">NETFLIX</div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <button className="text-white text-sm font-medium hover:text-gray-300 transition">Home</button>
              <button className="text-white text-sm font-medium hover:text-gray-300 transition">TV Shows</button>
              <button className="text-white text-sm font-medium hover:text-gray-300 transition">Movies</button>
              <button className="text-white text-sm font-medium hover:text-gray-300 transition">My List</button>
              <button onClick={onShowGuide} className="text-white text-sm font-medium hover:text-gray-300 transition">Browse by Genre</button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-white/10 transition">
              <Search className="w-5 h-5 text-white" />
            </button>
            <button className="p-2 rounded-full hover:bg-white/10 transition">
              <Bell className="w-5 h-5 text-white" />
            </button>
            <button className="flex items-center gap-2 p-2 rounded-full hover:bg-white/10 transition">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">U</span>
              </div>
              <ChevronDown className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Netflix-style Hero Content */}
      <div className={`absolute bottom-40 left-0 right-0 px-8 md:px-16 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="max-w-3xl">
          {/* Channel Badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className="px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded">
              LIVE
            </div>
            <div className="text-white/60 text-sm flex items-center gap-2">
              <span>{channel.name}</span>
              <span>•</span>
              <span>24/7 Streaming</span>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-white text-4xl md:text-6xl font-bold mb-4 line-clamp-2">
            {playback.currentVideo.title}
          </h1>
          
          {/* Description */}
          <p className="text-white/80 text-base md:text-lg mb-6 line-clamp-3 max-w-2xl">
            {channel.description || 'Experience synchronized real-time broadcasting. Watch your favorite content continuously with our 24/7 streaming channels.'}
          </p>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button className="px-6 py-2 bg-white text-black rounded-md font-semibold flex items-center gap-2 hover:bg-white/90 transition">
              <Play className="w-5 h-5 fill-black" />
              Play
            </button>
            <button 
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`px-6 py-2 rounded-md font-semibold flex items-center gap-2 transition ${
                isBookmarked ? 'bg-red-600 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Plus className="w-5 h-5" />
              {isBookmarked ? 'Added' : 'My List'}
            </button>
            <button 
              onClick={() => setShowInfoModal(true)}
              className="px-6 py-2 bg-white/20 text-white rounded-md font-semibold flex items-center gap-2 hover:bg-white/30 transition"
            >
              <Info className="w-5 h-5" />
              Info
            </button>
          </div>
          
          {/* Up Next */}
          {playback.nextVideo && (
            <div className="mt-6 flex items-center gap-3 text-white/60 text-sm">
              <span>UP NEXT:</span>
              <span className="text-white">{playback.nextVideo.title}</span>
              <span>•</span>
              <span>{formatDuration(playback.nextVideo.duration)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Netflix-style Bottom Progress Bar */}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-1 bg-white/20">
          <div 
            className="h-full bg-red-600 transition-all duration-1000"
            style={{ width: `${getCurrentProgress()}%` }}
          />
        </div>
        
        {/* Control Bar */}
        <div className="bg-gradient-to-t from-black/90 to-transparent px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Previous Channel */}
              <button
                onClick={handlePreviousChannel}
                disabled={!hasPrevious}
                className={`p-2 rounded-md transition ${hasPrevious ? 'hover:bg-white/20 text-white' : 'text-white/30 cursor-not-allowed'}`}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              {/* Next Channel */}
              <button
                onClick={handleNextChannel}
                disabled={!hasNext}
                className={`p-2 rounded-md transition ${hasNext ? 'hover:bg-white/20 text-white' : 'text-white/30 cursor-not-allowed'}`}
              >
                <SkipForward className="w-5 h-5" />
              </button>
              
              <div className="w-px h-6 bg-white/20 mx-2" />
              
              {/* Mute */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-md hover:bg-white/20 transition text-white"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              {/* Skip Video */}
              <button
                onClick={manualSkip}
                className="p-2 rounded-md hover:bg-white/20 transition text-white flex items-center gap-1"
              >
                <SkipForward className="w-5 h-5" />
                <span className="text-xs">Skip</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-md hover:bg-white/20 transition text-white"
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
        <div className={`absolute left-1/2 transform -translate-x-1/2 bottom-28 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 text-white/40 text-xs flex items-center gap-3">
            <SkipBack className="w-3 h-3" />
            <span>{currentChannelIndex + 1} / {allChannels.length}</span>
            <SkipForward className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Netflix-style Channel Row (Bottom) */}
      <div className={`absolute bottom-20 left-0 right-0 px-8 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Popular on {channel.name}</h3>
          <button className="text-white/60 text-xs hover:text-white transition flex items-center gap-1">
            Browse All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {videos.slice(0, 10).map((video, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-32 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-md overflow-hidden cursor-pointer hover:scale-105 transition-transform relative group"
            >
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition" />
              <div className="absolute bottom-1 left-1 right-1">
                <p className="text-white text-[10px] line-clamp-2">{video.title}</p>
                <p className="text-white/40 text-[8px] mt-0.5">{formatDuration(video.duration)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-red-600/95 backdrop-blur-md text-white px-6 py-3 rounded-lg shadow-2xl max-w-md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{error}</p>
                {skipCountdown > 0 && (
                  <p className="text-xs text-white/80 mt-1">Skipping in {skipCountdown}s...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50" onClick={() => setShowInfoModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-gray-900 to-black rounded-t-2xl border-t border-white/10 p-6 animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-white font-bold text-2xl">{channel.name}</h3>
                <p className="text-white/60 text-sm mt-1">24/7 Live Channel</p>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="text-white/60 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              {channel.description || `${channel.name} - 24/7 streaming of curated content including movies, documentaries, and entertainment.`}
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

// Missing Bell component
const Bell = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

export default Player;