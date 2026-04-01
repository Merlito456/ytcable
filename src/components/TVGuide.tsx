import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Channel, Video } from '../types';
import { Search, Tv, Clock, X, Play, Info, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface TVGuideProps {
  currentChannel: Channel;
  allChannels: Channel[];
  videos: Video[];
  onChannelSelect: (channel: Channel) => void;
  onClose: () => void;
}

export function TVGuide({ currentChannel, allChannels, videos, onChannelSelect, onClose }: TVGuideProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [channelVideosMap, setChannelVideosMap] = useState<Map<string, Video[]>>(new Map());
  const [loadingChannels, setLoadingChannels] = useState<Set<string>>(new Set());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch videos for a specific channel
  const fetchChannelVideos = async (channelId: string) => {
    if (channelVideosMap.has(channelId)) return;
    
    setLoadingChannels(prev => new Set(prev).add(channelId));
    
    try {
      const videosRef = collection(db, `channels/${channelId}/videos`);
      const q = query(videosRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      
      const channelVideos: Video[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      
      setChannelVideosMap(prev => new Map(prev).set(channelId, channelVideos));
    } catch (error) {
      console.error(`Failed to fetch videos for channel ${channelId}:`, error);
    } finally {
      setLoadingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  // Load videos for all channels
  useEffect(() => {
    allChannels.forEach(channel => {
      fetchChannelVideos(channel.id);
    });
  }, [allChannels]);

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

  // Get time slot based on video index
  const getTimeSlot = (index: number, totalVideos: number) => {
    const startHour = 12; // Start at 12 PM
    const totalSlots = 12; // 12 time slots (12pm to 11pm)
    const slotIndex = Math.floor((index / totalVideos) * totalSlots);
    const hour = (startHour + slotIndex) % 24;
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${ampm}`;
  };

  // Generate program data from actual videos
  const getChannelPrograms = (channel: Channel) => {
    const channelVideos = channelVideosMap.get(channel.id) || [];
    
    if (channelVideos.length === 0) {
      // Return placeholder if still loading or no videos
      const isLoading = loadingChannels.has(channel.id);
      return [{
        title: isLoading ? 'Loading videos...' : `${channel.name} - Coming Soon`,
        description: isLoading ? 'Fetching video data...' : 'Content will be available shortly',
        duration: '0:00',
        time: '12:00 pm',
        isLive: false,
        hd: true,
        channelId: channel.id,
        order: 0,
        youtubeId: ''
      }];
    }

    // Generate programs based on actual videos
    return channelVideos.map((video, idx) => {
      const timeSlot = getTimeSlot(idx, channelVideos.length);
      const isLive = idx === 0 && channel.id === currentChannel.id;
      
      return {
        id: video.id,
        title: video.title,
        description: video.title,
        duration: formatDuration(video.duration),
        durationSeconds: video.duration,
        time: timeSlot,
        isLive: isLive,
        hd: true,
        channelId: channel.id,
        order: idx,
        youtubeId: video.youtubeId
      };
    });
  };

  // Time slots for the guide header
  const timeSlots = [
    '12:00 pm', '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm', '5:00 pm', 
    '6:00 pm', '7:00 pm', '8:00 pm', '9:00 pm', '10:00 pm', '11:00 pm'
  ];

  // Days of the week
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(new Date().getDate() + i);
    return date;
  });

  const formatDate = (date: Date) => {
    return `${days[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Filter channels based on search
  const filteredChannels = allChannels.filter(channel => 
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        {/* Date Navigation */}
        <div className="px-4 md:px-6 pb-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {nextDays.map((date, idx) => {
              const isSelected = date.toDateString() === selectedDate.toDateString();
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                    isSelected 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <div className="text-xs font-medium">{days[date.getDay()]}</div>
                  <div className="text-sm font-bold">{date.getDate()}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Guide Content */}
      <div className="pt-32 pb-6 h-full overflow-y-auto">
        <div className="px-4 md:px-6">
          {/* Time Header */}
          <div className="flex border-b border-white/10 sticky top-0 bg-black z-10">
            <div className="w-32 md:w-48 flex-shrink-0" />
            <div className="flex-1 flex">
              {timeSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex-1 text-center py-2 text-xs font-medium text-white/60"
                >
                  {slot}
                </div>
              ))}
            </div>
          </div>

          {/* Channel List */}
          <div className="divide-y divide-white/5">
            {filteredChannels.map((channel) => {
              const programs = getChannelPrograms(channel);
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
                  <div className="w-32 md:w-48 flex-shrink-0 py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isCurrent ? 'bg-orange-500' : 'bg-white/10'
                      }`}>
                        <Tv className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-white/60'}`} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{channel.name}</div>
                        <div className="text-[10px] text-white/40">
                          {isLoading ? 'Loading...' : `${programs.length} videos`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Programs */}
                  <div className="flex-1 flex overflow-x-auto">
                    {programs.map((program, idx) => (
                      <div
                        key={idx}
                        className={`min-w-[100px] flex-1 p-2 border-l border-white/5 transition-all hover:bg-white/10 ${
                          program.isLive ? 'bg-orange-500/5' : ''
                        }`}
                      >
                        <div className="text-xs font-medium text-white line-clamp-2">
                          {program.title}
                        </div>
                        <div className="text-[10px] text-white/40 mt-1">
                          {program.duration} • {program.hd && 'HD'}
                        </div>
                        {program.isLive && (
                          <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-red-500 rounded text-[8px] font-bold text-white">
                            <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                            LIVE
                          </div>
                        )}
                      </div>
                    ))}
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
                {videos.length > 0 && (
                  <p className="text-white/60 text-sm mt-1">
                    {videos[0]?.title || 'Loading...'} • {formatDuration(videos[0]?.duration || 0)}
                  </p>
                )}
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
                    {channelVideosMap.get(selectedChannel.id)?.length || 0} videos
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