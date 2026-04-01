import React, { useEffect, useRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Channel, Video, PlaybackState } from '../types';
import { Volume2, VolumeX, X, List, Tv, Clock, Users, Play, SkipForward, AlertCircle, Menu } from 'lucide-react';

interface PlayerProps {
  channel: Channel;
  videos: Video[];
}

export function Player({ channel, videos }: PlayerProps) {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showChannelList, setShowChannelList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippingVideo, setSkippingVideo] = useState<Video | null>(null);
  const [skipCountdown, setSkipCountdown] = useState<number>(0);
  const playerRef = useRef<any>(null);
  const skipTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Function to skip the current video and play next
  const handleSkipVideo = () => {
    if (!playback?.nextVideo || !videos.length) return;
    
    console.log(`Skipping video: ${playback.currentVideo?.title}`);
    
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
    console.log('Toggle mute clicked, current state:', isMuted);
    
    if (playerRef.current) {
      try {
        if (isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
          console.log('Unmuted successfully');
        } else {
          playerRef.current.mute();
          setIsMuted(true);
          console.log('Muted successfully');
        }
      } catch (err) {
        console.error('Error toggling mute:', err);
      }
    }
  };

  // Handle video errors
  const onError: YouTubeProps['onError'] = (event) => {
    const errorCode = event.data;
    let errorMessage = '';
    
    switch (errorCode) {
      case 2:
        errorMessage = 'Invalid video ID';
        break;
      case 5:
        errorMessage = 'Video not available (HTML5 player error)';
        break;
      case 100:
        errorMessage = 'Video not found or removed';
        break;
      case 101:
      case 150:
        errorMessage = 'Video not available (embedding disabled)';
        break;
      default:
        errorMessage = `Video error (code: ${errorCode})`;
    }
    
    console.error(`YouTube Error: ${errorMessage}`, event);
    
    if (playback?.currentVideo && !skippingVideo) {
      setSkippingVideo(playback.currentVideo);
      setSkipCountdown(5);
      setError(`Video unavailable: "${playback.currentVideo.title}". Skipping in 5 seconds...`);
      
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  // Manual skip button handler
  const manualSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (skippingVideo) {
      handleSkipVideo();
    } else if (playback?.nextVideo) {
      setSkippingVideo(playback.currentVideo);
      handleSkipVideo();
    }
  };

  // Channel list toggle
  const toggleChannelList = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowChannelList(!showChannelList);
  };

  useEffect(() => {
    console.log('Player mounted with videos:', videos.length);
    console.log('Channel:', channel);
    
    if (!videos || videos.length === 0) {
      setError('No videos found in this channel');
      return;
    }

    const invalidVideos = videos.filter(v => !v.duration || v.duration <= 0);
    if (invalidVideos.length > 0) {
      console.warn('Videos with invalid durations:', invalidVideos);
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
        } else {
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
  }, [channel, videos, skippingVideo]);

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    console.log('YouTube player ready');
    
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
          console.log('Syncing video, diff:', diff);
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
      
      if (event.data === YouTube.PlayerState.ENDED && !skippingVideo) {
        console.log('Video ended naturally');
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

  // Show error state with skip option
  if (error && skippingVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white z-50">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <AlertCircle className="w-16 h-16 text-orange-500 animate-pulse" />
          <p className="text-lg font-bold text-white">Video Unavailable</p>
          <p className="text-sm text-white/60">{error}</p>
          <div className="flex items-center gap-2 text-orange-500">
            <SkipForward className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Skipping in {skipCountdown} seconds...</span>
          </div>
          <button
            onClick={manualSkip}
            className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-500 transition-colors flex items-center gap-2"
          >
            <SkipForward className="w-4 h-4" />
            Skip Now
          </button>
        </div>
      </div>
    );
  }

  if (error && !skippingVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white z-50">
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
  if (!playback || !playback.currentVideo || skippingVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-white/40">
            {skippingVideo ? 'Skipping to next video...' : 'Tuning Channel...'}
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
          onError={onError}
          className="w-full h-full"
        />
      </div>

      {/* Menu Button - Opens Channel List */}
      <button
        onClick={toggleChannelList}
        className="fixed top-6 left-6 z-[100] bg-black/70 backdrop-blur-md text-white p-3 rounded-xl hover:bg-orange-600 transition-all border border-white/20 shadow-lg"
        title="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Channel List Sidebar with Controls */}
      {showChannelList && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-50 transition-opacity"
            onClick={toggleChannelList}
          />
          <div className="fixed left-0 top-0 bottom-0 w-80 md:w-96 bg-black/95 backdrop-blur-xl border-r border-white/10 z-[60] shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-black/95 backdrop-blur-xl z-10">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-orange-500" />
                <h3 className="text-white font-bold text-sm">Channel Controls</h3>
              </div>
              <button
                onClick={toggleChannelList}
                className="text-white/60 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Now Playing Progress Bar - Always Visible */}
              <div className="bg-orange-500/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  <p className="text-orange-500 text-xs font-bold uppercase tracking-wider">
                    NOW PLAYING
                  </p>
                </div>
                <p className="text-white font-semibold text-sm line-clamp-2 mb-2">
                  {playback.currentVideo.title}
                </p>
                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                      style={{ width: `${getCurrentProgress()}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-white/40 text-[10px] mt-1">
                    <span>{formatDuration(playback.offset)}</span>
                    <span>{formatDuration(playback.currentVideo.duration)}</span>
                  </div>
                </div>
              </div>

              {/* Control Buttons Section */}
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Audio Controls</h4>
                <div className="flex gap-3">
                  <button
                    onClick={toggleMute}
                    className="flex-1 bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-500 transition-all flex items-center justify-center gap-2"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    <span className="text-sm font-medium">{isMuted ? "Unmute" : "Mute"}</span>
                  </button>
                  
                  <button
                    onClick={manualSkip}
                    className="flex-1 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                    title="Skip to next video"
                  >
                    <SkipForward className="w-5 h-5" />
                    <span className="text-sm font-medium">Skip</span>
                  </button>
                </div>
              </div>

              {/* Channel Details */}
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">Channel Info</h4>
                <h3 className="text-white font-bold text-lg mb-1">{channel.name}</h3>
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

              {/* Up Next Preview */}
              {playback.nextVideo && (
                <div className="bg-white/5 rounded-xl p-4">
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
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">
                  PLAYLIST PREVIEW
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {videos.slice(0, 10).map((video, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="text-white/30 font-mono w-6">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-white/70 line-clamp-1">{video.title}</p>
                        <p className="text-white/30 text-[10px]">{formatDuration(video.duration)}</p>
                      </div>
                    </div>
                  ))}
                  {videos.length > 10 && (
                    <p className="text-white/30 text-[10px] text-center mt-2">
                      +{videos.length - 10} more videos
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