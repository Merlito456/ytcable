import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Channel } from '../types';
import { 
  Tv, Film, Heart, Clock, TrendingUp, 
  Star, Sparkles, Flame, Award, 
  ChevronLeft, ChevronRight, Play, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChannelListProps {
  selectedChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
}

// Genre definitions with icons and colors
const genres = [
  { id: 'all', name: 'All Channels', icon: Tv, color: 'from-gray-500 to-gray-600' },
  { id: 'movies', name: 'Movies', icon: Film, color: 'from-purple-500 to-pink-500' },
  { id: 'entertainment', name: 'Entertainment', icon: Star, color: 'from-yellow-500 to-orange-500' },
  { id: 'documentary', name: 'Documentary', icon: Award, color: 'from-blue-500 to-cyan-500' },
  { id: 'news', name: 'News', icon: TrendingUp, color: 'from-red-500 to-orange-500' },
  { id: 'sports', name: 'Sports', icon: Flame, color: 'from-green-500 to-emerald-500' },
  { id: 'kids', name: 'Kids', icon: Sparkles, color: 'from-pink-500 to-purple-500' },
  { id: 'trending', name: 'Trending', icon: TrendingUp, color: 'from-orange-500 to-red-500' },
];

// Genre mapping for channels
const getChannelGenre = (channel: Channel): string => {
  const name = channel.name.toLowerCase();
  if (name.includes('movie') || name.includes('film') || name.includes('cinema')) return 'movies';
  if (name.includes('news') || name.includes('report')) return 'news';
  if (name.includes('sport') || name.includes('golf') || name.includes('espn')) return 'sports';
  if (name.includes('kid') || name.includes('disney') || name.includes('nick')) return 'kids';
  if (name.includes('document') || name.includes('free')) return 'documentary';
  if (name.includes('entertain') || name.includes('gma') || name.includes('abc')) return 'entertainment';
  if (channel.videoCount > 100) return 'trending';
  return 'all';
};

export function ChannelList({ selectedChannelId, onSelectChannel }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load channels
  useEffect(() => {
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Channel));
      setChannels(channelData);
    }, (error) => {
      console.error("Error loading channels:", error);
    });

    return () => unsubscribe();
  }, []);

  // Filter channels by genre
  const filteredChannels = channels.filter(channel => {
    if (selectedGenre === 'all') return true;
    return getChannelGenre(channel) === selectedGenre;
  });

  // Smart TV: Handle remote control navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredChannels.length) return;
      
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, filteredChannels.length - 1));
          // Auto-scroll to focused item
          if (containerRef.current && focusedIndex + 1 < filteredChannels.length) {
            const focusedElement = containerRef.current.children[focusedIndex + 1] as HTMLElement;
            if (focusedElement) {
              focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, -1));
          // Auto-scroll to focused item
          if (containerRef.current && focusedIndex - 1 >= 0) {
            const focusedElement = containerRef.current.children[focusedIndex - 1] as HTMLElement;
            if (focusedElement) {
              focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }
          break;
        case 'Enter':
          if (focusedIndex >= 0 && filteredChannels[focusedIndex]) {
            onSelectChannel(filteredChannels[focusedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredChannels, focusedIndex, onSelectChannel]);

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 400;
      const newPosition = direction === 'left' 
        ? scrollPosition - scrollAmount 
        : scrollPosition + scrollAmount;
      containerRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const handleScroll = () => {
    if (containerRef.current) {
      setScrollPosition(containerRef.current.scrollLeft);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Genre Navigation - Smart TV Friendly */}
      <div className="relative">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
          {genres.map((genre, idx) => {
            const Icon = genre.icon;
            const isSelected = selectedGenre === genre.id;
            return (
              <button
                key={genre.id}
                onClick={() => {
                  setSelectedGenre(genre.id);
                  setFocusedIndex(-1);
                }}
                className={`relative flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-300 whitespace-nowrap ${
                  isSelected 
                    ? `bg-gradient-to-r ${genre.color} text-white shadow-lg scale-105` 
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-base font-medium">{genre.name}</span>
                {isSelected && (
                  <motion.div
                    layoutId="genre-indicator"
                    className="absolute inset-0 rounded-full bg-gradient-to-r opacity-50 -z-10"
                    style={{ background: `linear-gradient(to right, ${genre.color.split(' ')[1]}, ${genre.color.split(' ')[3]})` }}
                    transition={{ type: "spring", duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel Grid - Smart TV Optimized */}
      <div className="relative">
        {/* Left Scroll Button */}
        {scrollPosition > 0 && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 backdrop-blur-md p-3 rounded-full hover:bg-orange-500 transition-all shadow-lg"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}
        
        <div
          ref={containerRef}
          className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredChannels.map((channel, idx) => {
            const genre = getChannelGenre(channel);
            const genreData = genres.find(g => g.id === genre) || genres[0];
            const Icon = genreData.icon;
            const isSelected = selectedChannelId === channel.id;
            const isFocused = focusedIndex === idx;
            const isHovered = hoveredChannel === channel.id;
            
            return (
              <motion.div
                key={channel.id}
                className={`relative flex-shrink-0 w-80 md:w-96 cursor-pointer transition-all duration-200 ${
                  isFocused ? 'scale-105 z-10' : ''
                }`}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => setHoveredChannel(channel.id)}
                onMouseLeave={() => setHoveredChannel(null)}
                onClick={() => onSelectChannel(channel)}
              >
                <div className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                  isSelected ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-black' : ''
                } ${isFocused ? 'ring-2 ring-white/50' : ''}`}>
                  {/* Channel Card Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${genreData.color} opacity-30`} />
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-all" />
                  
                  {/* Content */}
                  <div className="relative p-6 min-h-[200px] flex flex-col justify-between">
                    {/* Genre Badge */}
                    <div className="flex justify-between items-start">
                      <div className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${genreData.color} text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2`}>
                        <Icon className="w-4 h-4" />
                        <span>{genreData.name}</span>
                      </div>
                      {isSelected && (
                        <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    
                    {/* Channel Info */}
                    <div className="mt-6">
                      <h3 className="text-white font-bold text-xl line-clamp-1 mb-2">
                        {channel.name}
                      </h3>
                      <p className="text-white/60 text-sm line-clamp-2 mb-4">
                        {channel.description || '24/7 Live Streaming'}
                      </p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-white/40 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>24/7 Live</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Film className="w-4 h-4" />
                          <span>{channel.videoCount || '∞'} videos</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover Overlay */}
                    <AnimatePresence>
                      {(isHovered || isFocused) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex items-end p-6"
                        >
                          <div className="w-full space-y-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectChannel(channel);
                              }}
                              className="w-full bg-orange-500 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-base font-medium hover:bg-orange-600 transition-all"
                            >
                              <Play className="w-5 h-5" />
                              Watch Now
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Show channel info
                              }}
                              className="w-full bg-white/20 text-white py-3 rounded-xl flex items-center justify-center gap-2 text-base font-medium hover:bg-white/30 transition-all"
                            >
                              <Info className="w-5 h-5" />
                              Details
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {/* Right Scroll Button */}
        {containerRef.current && scrollPosition < (containerRef.current.scrollWidth - containerRef.current.clientWidth) && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/70 backdrop-blur-md p-3 rounded-full hover:bg-orange-500 transition-all shadow-lg"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}
      </div>
      
      {/* Empty State */}
      {filteredChannels.length === 0 && (
        <div className="text-center py-12">
          <Tv className="w-20 h-20 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-base">No channels found in this category</p>
        </div>
      )}
      
      {/* Smart TV Remote Hint */}
      {filteredChannels.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
          <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-2 text-white/40 text-xs">
            ← → Navigate • Enter to Select
          </div>
        </div>
      )}
    </div>
  );
}