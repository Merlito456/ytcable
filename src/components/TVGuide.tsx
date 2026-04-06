import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Channel, Video } from '../types';
import { Search, Tv, Clock, X, Play, Info, ArrowRight } from 'lucide-react';

interface TVGuideProps {
  currentChannel: Channel;
  allChannels: Channel[];
  videos: Video[];
  onChannelSelect: (channel: Channel) => void;
  onClose: () => void;
}

interface ProgramWithTime {
  id: string;
  title: string;
  description: string;
  duration: number;
  durationFormatted: string;
  startTime: Date;
  endTime: Date;
  isLive: boolean;
  isNext: boolean;
  hd: boolean;
  channelId: string;
  order: number;
  youtubeId: string;
  progress?: number;
}

export function TVGuide({ currentChannel, allChannels, onChannelSelect, onClose }: TVGuideProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [channelVideosMap, setChannelVideosMap] = useState<Map<string, Video[]>>(new Map());
  const [loadingChannels, setLoadingChannels] = useState<Set<string>>(new Set());
  const [channelProgramsMap, setChannelProgramsMap] = useState<Map<string, ProgramWithTime[]>>(new Map());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format duration
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

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate programs for a channel using the same logic as Player
  const calculateChannelPrograms = (channelVideos: Video[], channelStartTime: number): ProgramWithTime[] => {
    if (!channelVideos.length) return [];
    
    const programs: ProgramWithTime[] = [];
    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    
    // Calculate total duration of all videos
    const totalDuration = channelVideos.reduce((acc, v) => acc + (v.duration || 0), 0);
    
    // Calculate current cycle elapsed time (same as Player)
    const elapsedMs = Date.now() - channelStartTime;
    const elapsedSeconds = elapsedMs / 1000;
    const currentCycleElapsed = elapsedSeconds % totalDuration;
    
    // Find which video is currently playing and build schedule
    let accumulatedTime = 0;
    let scheduleStartTime = new Date(now);
    
    // Find the current video offset to align schedule
    let currentVideoIndex = -1;
    let videoOffset = 0;
    
    for (let i = 0; i < channelVideos.length; i++) {
      const duration = channelVideos[i].duration || 0;
      if (currentCycleElapsed < accumulatedTime + duration) {
        currentVideoIndex = i;
        videoOffset = currentCycleElapsed - accumulatedTime;
        break;
      }
      accumulatedTime += duration;
    }
    
    // Build schedule starting from current time
    let currentStartTime = new Date(now);
    currentStartTime.setSeconds(currentStartTime.getSeconds() - videoOffset);
    
    // Generate programs for the next 3 hours
    let programIndex = currentVideoIndex;
    let timeCursor = new Date(currentStartTime);
    
    for (let i = 0; i < channelVideos.length * 3 && programs.length < 20; i++) {
      const video = channelVideos[programIndex % channelVideos.length];
      const startTime = new Date(timeCursor);
      const endTime = new Date(startTime);
      endTime.setSeconds(endTime.getSeconds() + video.duration);
      
      const isLive = now >= startTime && now <= endTime;
      const isInWindow = endTime >= now && startTime <= threeHoursLater;
      
      if (isLive || isInWindow) {
        let progress = 0;
        if (isLive) {
          const elapsed = (now.getTime() - startTime.getTime()) / 1000;
          progress = Math.min(100, (elapsed / video.duration) * 100);
        }
        
        programs.push({
          id: video.id,
          title: video.title,
          description: video.title,
          duration: video.duration,
          durationFormatted: formatDuration(video.duration),
          startTime,
          endTime,
          isLive,
          isNext: !isLive && startTime > now,
          hd: true,
          channelId: channelVideos[0]?.id || '',
          order: programIndex,
          youtubeId: video.youtubeId,
          progress
        });
      }
      
      timeCursor = new Date(endTime);
      programIndex++;
    }
    
    return programs;
  };

  // Fetch videos for a specific channel
  const fetchChannelSchedule = async (channel: Channel) => {
    if (channelVideosMap.has(channel.id)) return;
    
    setLoadingChannels(prev => new Set(prev).add(channel.id));
    
    try {
      const videosRef = collection(db, `channels/${channel.id}/videos`);
      const q = query(videosRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      
      const channelVideos: Video[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      
      setChannelVideosMap(prev => new Map(prev).set(channel.id, channelVideos));
      
      // Calculate programs using the channel's startTime
      const programs = calculateChannelPrograms(channelVideos, channel.startTime);
      setChannelProgramsMap(prev => new Map(prev).set(channel.id, programs));
    } catch (error) {
      console.error(`Failed to fetch schedule for channel ${channel.name}:`, error);
    } finally {
      setLoadingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channel.id);
        return newSet;
      });
    }
  };

  // Load schedules for all channels
  useEffect(() => {
    allChannels.forEach(channel => {
      fetchChannelSchedule(channel);
    });
  }, [allChannels]);

  // Filter channels based on search
  const filteredChannels = allChannels.filter(channel => 
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get current program for a channel
  const getCurrentProgram = (channelId: string) => {
    const programs = channelProgramsMap.get(channelId);
    if (!programs) return null;
    const now = new Date();
    return programs.find(p => now >= p.startTime && now <= p.endTime);
  };

  // Get next program for a channel
  const getNextProgram = (channelId: string) => {
    const programs = channelProgramsMap.get(channelId);
    if (!programs) return null;
    const now = new Date();
    return programs.find(p => p.startTime > now);
  };

  const handleChannelClick = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowInfo(true);
  };

  const handleWatchNow = () => {
    if (selectedChannel) {
      onChannelSelect(selectedChannel);
      onClose();
    }
  };

  const getUpcomingCount = (channelId: string) => {
    const programs = channelProgramsMap.get(channelId);
    if (!programs) return 0;
    const now = new Date();
    return programs.filter(p => p.startTime > now).length;
  };

  return (
    <div className="fixed inset-0 bg-black z-[200] overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent z-10">
        <div className="flex items-center justify-between p-4 md:p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <Tv className="w-6 h-6 text-orange-500" />
              <h1 className="text-white font-bold text-xl">TV Guide</h1>
              <span className="text-white/40 text-xs ml-2">Next 3 Hours</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-white text-sm font-mono">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="px-4 md:px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Guide Content */}
      <div className="pt-24 pb-6 h-full overflow-y-auto">
        <div className="px-4 md:px-6">
          {/* Time Range Indicator */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-white/60 text-xs">Live Now</span>
              <div className="w-2 h-2 bg-orange-500/50 rounded-full ml-2" />
              <span className="text-white/40 text-xs">Upcoming (3 hrs)</span>
            </div>
            <div className="text-white/30 text-xs">
              {formatTime(new Date())} - {formatTime(new Date(Date.now() + 3 * 60 * 60 * 1000))}
            </div>
          </div>

          {/* Channel List */}
          <div className="divide-y divide-white/5">
            {filteredChannels.map((channel) => {
              const programs = channelProgramsMap.get(channel.id) || [];
              const currentProgram = getCurrentProgram(channel.id);
              const nextProgram = getNextProgram(channel.id);
              const isCurrent = currentChannel.id === channel.id;
              const isLoading = loadingChannels.has(channel.id);
              const upcomingCount = getUpcomingCount(channel.id);
              
              return (
                <div
                  key={channel.id}
                  className={`py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                    isCurrent ? 'bg-orange-500/10' : ''
                  }`}
                  onClick={() => handleChannelClick(channel)}
                >
                  <div className="flex items-start gap-4">
                    {/* Channel Info */}
                    <div className="w-48 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isCurrent ? 'bg-orange-500' : 'bg-white/10'
                        }`}>
                          <Tv className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-white/60'}`} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{channel.name}</div>
                          <div className="text-[10px] text-white/40">
                            {isLoading ? 'Loading...' : `${upcomingCount} upcoming`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Programs - Now and Next */}
                    <div className="flex-1">
                      {isLoading ? (
                        <div className="flex items-center justify-center h-20">
                          <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                        </div>
                      ) : programs.length === 0 ? (
                        <div className="text-white/30 text-sm py-4">No upcoming programs</div>
                      ) : (
                        <div className="space-y-3">
                          {/* Current Program */}
                          {currentProgram && (
                            <div className="bg-gradient-to-r from-orange-500/20 to-transparent rounded-lg p-3 border-l-4 border-orange-500">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                                <span className="text-orange-500 text-[10px] font-bold uppercase tracking-wider">LIVE NOW</span>
                                <span className="text-white/40 text-[10px]">
                                  {formatTime(currentProgram.startTime)} - {formatTime(currentProgram.endTime)}
                                </span>
                              </div>
                              <div className="font-medium text-white text-sm line-clamp-1">
                                {currentProgram.title}
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-white/40 text-[10px]">{currentProgram.durationFormatted} • HD</span>
                                {currentProgram.progress !== undefined && currentProgram.progress > 0 && (
                                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                                      style={{ width: `${currentProgram.progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Next Program */}
                          {nextProgram && !currentProgram && (
                            <div className="bg-white/5 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <ArrowRight className="w-3 h-3 text-white/40" />
                                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">UP NEXT</span>
                                <span className="text-white/40 text-[10px]">
                                  {formatTime(nextProgram.startTime)} - {formatTime(nextProgram.endTime)}
                                </span>
                              </div>
                              <div className="font-medium text-white text-sm line-clamp-1">
                                {nextProgram.title}
                              </div>
                              <div className="text-white/40 text-[10px] mt-1">
                                {nextProgram.durationFormatted} • HD
                              </div>
                            </div>
                          )}

                          {/* Additional Upcoming Programs */}
                          {programs.filter(p => !p.isLive && p.startTime > (currentProgram?.endTime || new Date())).slice(1, 3).map(program => (
                            <div key={program.id} className="bg-white/5 rounded-lg p-2 opacity-70">
                              <div className="flex items-center gap-2">
                                <Clock className="w-2.5 h-2.5 text-white/30" />
                                <span className="text-white/30 text-[9px]">
                                  {formatTime(program.startTime)} - {formatTime(program.endTime)}
                                </span>
                              </div>
                              <div className="text-white/60 text-xs line-clamp-1 mt-0.5">
                                {program.title}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Now Playing Section */}
          <div className="mt-6 p-4 bg-gradient-to-r from-orange-500/10 to-transparent rounded-lg border border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-orange-500 text-xs font-bold uppercase tracking-wider">NOW PLAYING</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-white font-bold text-lg">{currentChannel.name}</h3>
                {(() => {
                  const currentProgram = getCurrentProgram(currentChannel.id);
                  if (currentProgram) {
                    return (
                      <div>
                        <p className="text-white/80 text-sm">{currentProgram.title}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {formatTime(currentProgram.startTime)} - {formatTime(currentProgram.endTime)} • {currentProgram.durationFormatted}
                        </p>
                      </div>
                    );
                  }
                  const nextProgram = getNextProgram(currentChannel.id);
                  if (nextProgram) {
                    return (
                      <div>
                        <p className="text-white/60 text-sm">Next: {nextProgram.title}</p>
                        <p className="text-white/40 text-xs mt-1">
                          Starts at {formatTime(nextProgram.startTime)} • {nextProgram.durationFormatted}
                        </p>
                      </div>
                    );
                  }
                  return <p className="text-white/60 text-sm">No upcoming programs scheduled</p>;
                })()}
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all text-sm font-medium"
              >
                Back to Watching
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Info Modal */}
      {showInfo && selectedChannel && (
        <>
          <div className="fixed inset-0 bg-black/80 z-50" onClick={() => setShowInfo(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-white/10 p-6 z-50 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <Tv className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">{selectedChannel.name}</h3>
                  <p className="text-white/40 text-xs">
                    {getUpcomingCount(selectedChannel.id)} upcoming programs
                  </p>
                </div>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-white/70 text-sm mb-4 leading-relaxed">
              {selectedChannel.description || `${selectedChannel.name} - 24/7 streaming of curated content.`}
            </p>
            
            {/* Upcoming Programs Preview */}
            {(() => {
              const programs = channelProgramsMap.get(selectedChannel.id) || [];
              const upcoming = programs.filter(p => p.startTime > new Date());
              if (upcoming.length > 0) {
                return (
                  <div className="mb-4">
                    <h4 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Up Next</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {upcoming.slice(0, 3).map(program => (
                        <div key={program.id} className="bg-white/5 rounded-lg p-2">
                          <div className="text-white text-xs font-medium">{program.title}</div>
                          <div className="text-white/40 text-[10px] mt-1">
                            {formatTime(program.startTime)} - {formatTime(program.endTime)} • {program.durationFormatted}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
            <div className="flex items-center gap-4 text-white/40 text-xs border-t border-white/10 pt-4 mb-4">
              <div className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                <span>24/7 Live</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Synchronized Stream</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleWatchNow}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Watch Now
              </button>
              <button
                onClick={() => setShowInfo(false)}
                className="flex-1 bg-white/10 text-white py-2 rounded-lg hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}