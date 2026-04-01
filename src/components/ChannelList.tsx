import React, { useState, useEffect } from 'react';
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

// Mock genre mapping for channels (in real app, this would come from Firebase)
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 300;
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
      {/* Genre Navigation */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
          {genres.map((genre) => {
            const Icon = genre.icon;
            const isSelected = selectedGenre === genre.id;
            return (
              <button
                key={genre.id}
                onClick={() => setSelectedGenre(genre.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 whitespace-nowrap ${
                  isSelected 
                    ? `bg-gradient-to-r ${genre.color} text-white shadow-lg scale-105` 
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{genre.name}</span>
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

      {/* Channel Grid */}
      <div className="relative">
        {/* Scroll Buttons */}
        {scrollPosition > 0 && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 backdrop-blur-md p-2 rounded-full hover:bg-black/70 transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredChannels.map((channel) => {
            const genre = getChannelGenre(channel);
            const genreData = genres.find(g => g.id === genre) || genres[0];
            const Icon = genreData.icon;
            const isSelected = selectedChannelId === channel.id;
            const isHovered = hoveredChannel === channel.id;
            
            return (
              <motion.div
                key={channel.id}
                className="relative flex-shrink-0 w-64 md:w-72 cursor-pointer group"
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => setHoveredChannel(channel.id)}
                onMouseLeave={() => setHoveredChannel(null)}
                onClick={() => onSelectChannel(channel)}
              >
                <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
                  isSelected ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-black' : ''
                }`}>
                  {/* Channel Card Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${genreData.color} opacity-20`} />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all" />
                  
                  {/* Content */}
                  <div className="relative p-4 min-h-[160px] flex flex-col justify-between">
                    {/* Genre Badge */}
                    <div className="flex justify-between items-start">
                      <div className={`px-2 py-1 rounded-full bg-gradient-to-r ${genreData.color} text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                        <Icon className="w-3 h-3" />
                        <span>{genreData.name}</span>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    
                    {/* Channel Info */}
                    <div className="mt-4">
                      <h3 className="text-white font-bold text-lg line-clamp-1 mb-1">
                        {channel.name}
                      </h3>
                      <p className="text-white/60 text-xs line-clamp-2 mb-3">
                        {channel.description || '24/7 Live Streaming'}
                      </p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-3 text-white/40 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>24/7 Live</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          <span>{channel.videoCount || '∞'} videos</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover Overlay */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end p-4"
                        >
                          <div className="w-full space-y-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectChannel(channel);
                              }}
                              className="w-full bg-orange-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium hover:bg-orange-600 transition-all"
                            >
                              <Play className="w-4 h-4" />
                              Watch Now
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Show channel info
                              }}
                              className="w-full bg-white/20 text-white py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium hover:bg-white/30 transition-all"
                            >
                              <Info className="w-4 h-4" />
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
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 backdrop-blur-md p-2 rounded-full hover:bg-black/70 transition-all"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
      
      {/* Empty State */}
      {filteredChannels.length === 0 && (
        <div className="text-center py-12">
          <Tv className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No channels found in this category</p>
        </div>
      )}
    </div>
  );
}