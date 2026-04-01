import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Channel, Video } from '../types';
import { Search, Tv, Clock, X, Play, Info, Calendar, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

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
  hd: boolean;
  channelId: string;
  order: number;
  youtubeId: string;
  progress?: number;
}

export function TVGuide({ currentChannel, allChannels, videos, onChannelSelect, onClose }: TVGuideProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [channelProgramsMap, setChannelProgramsMap] = useState<Map<string, ProgramWithTime[]>>(new Map());
  const [loadingChannels, setLoadingChannels] = useState<Set<string>>(new Set());
  const [timelineStartHour, setTimelineStartHour] = useState(6); // Start at 6 AM
  const [timelineEndHour, setTimelineEndHour] = useState(24); // End at midnight

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Format duration to readable time
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

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate start time based on video order and total duration
  const calculateVideoTimes = (channelVideos: Video[], channelStartTime: number) => {
    const programs: ProgramWithTime[] = [];
    let currentTime = new Date(channelStartTime);
    
    // Set to today's date at the start time
    const today = new Date();
    today.setHours(6, 0, 0, 0); // Start at 6 AM today
    
    let accumulatedTime = 0;
    
    channelVideos.forEach((video, idx) => {
      const startTime = new Date(today);
      startTime.setSeconds(startTime.getSeconds() + accumulatedTime);
      
      const endTime = new Date(startTime);
      endTime.setSeconds(endTime.getSeconds() + video.duration);
      
      const now = new Date();
      const isLive = now >= startTime && now <= endTime;
      
      let progress = 0;
      if (isLive) {
        const elapsed = (now.getTime() - startTime.getTime()) / 1000;
        progress = (elapsed / video.duration) * 100;
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
        hd: true,
        channelId: channelVideos[0]?.id || '',
        order: idx,
        youtubeId: video.youtubeId,
        progress
      });
      
      accumulatedTime += video.duration;
    });
    
    return programs;
  };

  // Fetch videos for a specific channel and calculate schedule
  const fetchChannelSchedule = async (channel: Channel) => {
    if (channelProgramsMap.has(channel.id)) return;
    
    setLoadingChannels(prev => new Set(prev).add(channel.id));
    
    try {
      const videosRef = collection(db, `channels/${channel.id}/videos`);
      const q = query(videosRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      
      const channelVideos: Video[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      
      // Calculate schedule based on channel start time
      const programs = calculateVideoTimes(channelVideos, channel.startTime);
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

  // Generate timeline hours
  const timelineHours = [];
  for (let hour = timelineStartHour; hour <= timelineEndHour; hour++) {
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? 'pm' : 'am';
    timelineHours.push({ hour, display: `${displayHour}:00 ${ampm}` });
  }

  // Calculate position and width for a program in the timeline
  const getProgramStyle = (program: ProgramWithTime) => {
    const startHour = program.startTime.getHours();
    const startMinute = program.startTime.getMinutes();
    const endHour = program.endTime.getHours();
    const endMinute = program.endTime.getMinutes();
    
    const totalMinutes = (timelineEndHour - timelineStartHour) * 60;
    const startMinutes = ((startHour - timelineStartHour) * 60) + startMinute;
    const durationMinutes = ((endHour - startHour) * 60) + (endMinute - startMinute);
    
    const left = (startMinutes / totalMinutes) * 100;
    const width = (durationMinutes / totalMinutes) * 100;
    
    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, width)}%`,
    };
  };

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
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Current Time */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-white text-sm">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            {/* Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
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
      <div className="pt-24 pb-6 h-full overflow-auto">
        <div className="px-4 md:px-6">
          {/* Timeline Header */}
          <div className="sticky top-0 bg-black z-20 pb-2">
            <div className="flex border-b border-white/10">
              <div className="w-48 flex-shrink-0" />
              <div className="flex-1 flex relative h-12">
                {timelineHours.map((hour, idx) => (
                  <div
                    key={idx}
                    className="absolute text-center text-xs font-medium text-white/60"
                    style={{ left: `${(idx / (timelineHours.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    {hour.display}
                  </div>
                ))}
                {/* Current Time Indicator */}
                {(() => {
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  if (currentHour >= timelineStartHour && currentHour <= timelineEndHour) {
                    const totalMinutes = (timelineEndHour - timelineStartHour) * 60;
                    const currentMinutes = ((currentHour - timelineStartHour) * 60) + currentMinute;
                    const position = (currentMinutes / totalMinutes) * 100;
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30"
                        style={{ left: `${position}%` }}
                      >
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>

          {/* Channel List with Gantt Chart */}
          <div className="divide-y divide-white/5">
            {filteredChannels.map((channel) => {
              const programs = channelProgramsMap.get(channel.id) || [];
              const currentProgram = getCurrentProgram(channel.id);
              const isCurrent = currentChannel.id === channel.id;
              const isLoading = loadingChannels.has(channel.id);
              
              return (
                <div
                  key={channel.id}
                  className={`flex hover:bg-white/5 transition-colors cursor-pointer ${
                    isCurrent ? 'bg-orange-500/10' : ''
                  }`}
                  onClick={() => handleChannelClick(channel)}
                >
                  {/* Channel Info */}
                  <div className="w-48 flex-shrink-0 py-3 pr-4 sticky left-0 bg-black z-10">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isCurrent ? 'bg-orange-500' : 'bg-white/10'
                      }`}>
                        <Tv className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-white/60'}`} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{channel.name}</div>
                        <div className="text-[10px] text-white/40">
                          {isLoading ? 'Loading...' : `${programs.length} programs`}
                        </div>
                        {currentProgram && (
                          <div className="text-[10px] text-orange-400 mt-1 flex items-center gap-1">
                            <Zap className="w-2 h-2" />
                            <span>Live: {currentProgram.title.substring(0, 20)}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gantt Chart Timeline */}
                  <div className="flex-1 relative min-h-[80px] py-2">
                    {programs.map((program) => {
                      const style = getProgramStyle(program);
                      return (
                        <div
                          key={program.id}
                          className={`absolute h-[60px] rounded-lg p-2 overflow-hidden transition-all hover:scale-102 ${
                            program.isLive 
                              ? 'bg-orange-500/30 border-l-4 border-orange-500' 
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                          style={{
                            left: style.left,
                            width: style.width,
                            top: '8px',
                          }}
                          title={`${program.title}\n${formatTime(program.startTime)} - ${formatTime(program.endTime)}`}
                        >
                          <div className="text-xs font-medium text-white truncate">
                            {program.title}
                          </div>
                          <div className="text-[10px] text-white/40">
                            {formatTime(program.startTime)} - {formatTime(program.endTime)}
                          </div>
                          <div className="text-[9px] text-white/30 mt-1">
                            {program.durationFormatted} • {program.hd && 'HD'}
                          </div>
                          {program.isLive && program.progress && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                              <div 
                                className="h-full bg-orange-500 rounded-full"
                                style={{ width: `${program.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {programs.length === 0 && !isLoading && (
                      <div className="h-[60px] flex items-center justify-center text-white/30 text-xs">
                        No schedule available
                      </div>
                    )}
                    {isLoading && (
                      <div className="h-[60px] flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                      </div>
                    )}
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
                  return <p className="text-white/60 text-sm">No program currently playing</p>;
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
                    {channelProgramsMap.get(selectedChannel.id)?.length || 0} programs scheduled
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
            <div className="mb-4">
              <h4 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Up Next</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {channelProgramsMap.get(selectedChannel.id)?.slice(0, 3).map(program => (
                  <div key={program.id} className="bg-white/5 rounded-lg p-2">
                    <div className="text-white text-xs font-medium">{program.title}</div>
                    <div className="text-white/40 text-[10px] mt-1">
                      {formatTime(program.startTime)} - {formatTime(program.endTime)} • {program.durationFormatted}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
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