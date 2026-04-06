import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { Channel, Video } from './types';
import { Player } from './components/Player';
import { AdminPanel } from './components/AdminPanel';
import { TVGuide } from './components/TVGuide';
import { 
  Tv, LogIn, LogOut, Menu, Search, Settings, X, 
  Heart, Clock, TrendingUp, Star, Film, Plus, Check,
  ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize2, Minimize2,
  List, Home, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from './lib/error-handler';

// Local storage keys
const STORAGE_KEYS = {
  FAVORITES: 'user_favorites',
  LAST_PLAYED: 'last_played_channel',
  RECENT_CHANNELS: 'recent_channels',
};

interface FavoriteChannel {
  id: string;
  name: string;
  addedAt: number;
}

export default function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [titleTaps, setTitleTaps] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);
  const [recentChannels, setRecentChannels] = useState<Channel[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'channels' | 'favorites' | 'recent'>('channels');
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
    
    // Load recent channels
    const savedRecent = localStorage.getItem(STORAGE_KEYS.RECENT_CHANNELS);
    if (savedRecent) {
      setRecentChannels(JSON.parse(savedRecent));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  // Save recent channels to localStorage
  useEffect(() => {
    if (recentChannels.length > 0) {
      localStorage.setItem(STORAGE_KEYS.RECENT_CHANNELS, JSON.stringify(recentChannels.slice(0, 10)));
    }
  }, [recentChannels]);

  // Save last played channel and update recent channels
  const saveLastPlayedChannel = (channel: Channel) => {
    localStorage.setItem(STORAGE_KEYS.LAST_PLAYED, channel.id);
    
    // Update recent channels
    setRecentChannels(prev => {
      const filtered = prev.filter(c => c.id !== channel.id);
      return [channel, ...filtered].slice(0, 10);
    });
  };

  // Check if channel is favorite
  const isFavorite = (channelId: string) => {
    return favorites.some(f => f.id === channelId);
  };

  // Toggle favorite
  const toggleFavorite = (channel: Channel) => {
    if (isFavorite(channel.id)) {
      setFavorites(prev => prev.filter(f => f.id !== channel.id));
    } else {
      setFavorites(prev => [...prev, { id: channel.id, name: channel.name, addedAt: Date.now() }]);
    }
  };

  // Handle channel change
  const handleChannelChange = (channel: Channel) => {
    console.log('Switching to channel:', channel.name);
    setSelectedChannel(channel);
    setVideos([]);
    setShowGuide(false);
    saveLastPlayedChannel(channel);
  };

  // Load last played channel after channels are loaded
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      const lastPlayedId = localStorage.getItem(STORAGE_KEYS.LAST_PLAYED);
      const lastPlayedChannel = channels.find(c => c.id === lastPlayedId);
      if (lastPlayedChannel) {
        console.log('Restoring last played channel:', lastPlayedChannel.name);
        setSelectedChannel(lastPlayedChannel);
        saveLastPlayedChannel(lastPlayedChannel);
      } else {
        // Auto-select first channel if no last played
        console.log('Auto-selecting first channel:', channels[0].name);
        setSelectedChannel(channels[0]);
        saveLastPlayedChannel(channels[0]);
      }
    }
  }, [channels]);

  // Smart TV: Handle remote control navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Admin shortcut: Ctrl + Shift + Z
      if (e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
        console.log("Admin shortcut triggered!");
        e.preventDefault();
        handleAdminAccess();
        return;
      }
      
      // Channel navigation with arrow keys
      if (selectedChannel && channels.length > 0) {
        const currentIndex = channels.findIndex(c => c.id === selectedChannel.id);
        
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            if (currentIndex > 0) {
              handleChannelChange(channels[currentIndex - 1]);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (currentIndex < channels.length - 1) {
              handleChannelChange(channels[currentIndex + 1]);
            }
            break;
        }
      }
      
      // Sidebar toggle with 'S' key
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setShowSidebar(prev => !prev);
      }
      
      // Tab navigation within sidebar
      if (showSidebar) {
        switch (e.key) {
          case '1':
            setSidebarTab('channels');
            break;
          case '2':
            setSidebarTab('favorites');
            break;
          case '3':
            setSidebarTab('recent');
            break;
        }
      }
      
      // Escape to close sidebar
      if (e.key === 'Escape') {
        if (showGuide) setShowGuide(false);
        if (showSidebar) setShowSidebar(false);
        if (showAdmin) setShowAdmin(false);
        if (showPasswordModal) setShowPasswordModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide, showSidebar, showAdmin, showPasswordModal, selectedChannel, channels]);

  // Load channels
  useEffect(() => {
    const loadChannels = async () => {
      setIsLoadingChannels(true);
      try {
        const q = query(collection(db, 'channels'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const channelData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Channel));
        setChannels(channelData);
      } catch (error) {
        console.error("Error loading channels:", error);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    loadChannels();
    
    const unsubscribe = onSnapshot(query(collection(db, 'channels'), orderBy('createdAt', 'desc')), (snapshot) => {
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

  // Load videos when channel changes
  useEffect(() => {
    if (!selectedChannel) return;

    setLoadingVideos(true);
    
    const path = `channels/${selectedChannel.id}/videos`;
    const q = query(collection(db, path), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoData: Video[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Video));
      setVideos(videoData);
      setLoadingVideos(false);
    }, (error) => {
      setLoadingVideos(false);
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [selectedChannel]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowAdmin(false);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleAdminAccess = () => {
    console.log("Opening password modal...");
    setShowPasswordModal(true);
  };

  const verifyPassword = async (password: string) => {
    console.log("Verifying password...");
    if (password === '07141994') {
      console.log("Password correct. Checking user email...");
      setShowPasswordModal(false);
      if (user?.email === "rabanes.johncarlo4@gmail.com") {
        console.log("User email matches admin. Opening panel.");
        setShowAdmin(true);
      } else {
        console.log("User email mismatch or not logged in. Initiating Google Login...");
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          if (result.user.email === "rabanes.johncarlo4@gmail.com") {
            console.log("Google Login successful. Admin verified.");
            setShowAdmin(true);
          } else {
            console.log("Google Login failed: Email not authorized.");
            alert('This account does not have administrator privileges.');
            await signOut(auth);
          }
        } catch (error) {
          console.error("Admin login failed:", error);
        }
      }
    } else {
      console.log("Incorrect password entered.");
      alert('Incorrect password');
    }
  };

  const handleTitleClick = () => {
    const now = Date.now();
    const newTaps = (now - lastClickTime > 2000) ? 1 : titleTaps + 1;
    
    console.log(`Title click detected. Taps: ${newTaps}/10`);
    
    if (newTaps >= 10) {
      handleAdminAccess();
      setTitleTaps(0);
    } else {
      setTitleTaps(newTaps);
    }
    setLastClickTime(now);
  };

  // Get sidebar content based on selected tab
  const getSidebarContent = () => {
    switch (sidebarTab) {
      case 'favorites':
        return favorites.map(fav => channels.find(c => c.id === fav.id)).filter(Boolean) as Channel[];
      case 'recent':
        return recentChannels;
      default:
        return channels;
    }
  };

  const sidebarItems = getSidebarContent();
  const sidebarTitle = sidebarTab === 'favorites' ? 'My Favorites' : sidebarTab === 'recent' ? 'Recently Watched' : 'All Channels';

  // Show loading state
  if (isLoadingChannels && channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto mb-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-red-600 font-black text-2xl">N</div>
            </div>
          </div>
          <p className="text-white/60 text-lg font-medium">Loading your channels...</p>
        </div>
      </div>
    );
  }

  // If no channels exist
  if (channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Tv className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">YouTube Cable</h1>
          <p className="text-white/60 mb-6">No channels available. Please add channels in the admin panel.</p>
          {user?.email === "rabanes.johncarlo4@gmail.com" && (
            <button
              onClick={() => setShowAdmin(true)}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all"
            >
              Open Admin Panel
            </button>
          )}
          <button
            onClick={handleAdminAccess}
            className="mt-4 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
          >
            Admin Access (Ctrl+Shift+Z)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Player */}
      {selectedChannel && (
        <Player 
          channel={selectedChannel} 
          videos={videos}
          allChannels={channels}
          onChannelChange={handleChannelChange}
          onShowGuide={() => setShowGuide(true)}
          onToggleFavorite={() => toggleFavorite(selectedChannel)}
          isFavorite={isFavorite(selectedChannel.id)}
        />
      )}

      {/* Right Sidebar - Channel Listing */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed right-0 top-0 bottom-0 w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 z-50 shadow-2xl flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <List className="w-5 h-5 text-red-500" />
                    <h2 className="text-white font-bold text-lg">Channel Guide</h2>
                  </div>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSidebarTab('channels')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      sidebarTab === 'channels' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    All
                  </button>
                  <button
                    onClick={() => setSidebarTab('favorites')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      sidebarTab === 'favorites' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    Favorites ({favorites.length})
                  </button>
                  <button
                    onClick={() => setSidebarTab('recent')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      sidebarTab === 'recent' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Recent
                  </button>
                </div>
              </div>

              {/* Channel List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarItems.length === 0 ? (
                  <div className="text-center py-12">
                    {sidebarTab === 'favorites' ? (
                      <>
                        <Heart className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">No favorites yet</p>
                        <p className="text-white/20 text-xs mt-1">Click the heart icon to add channels</p>
                      </>
                    ) : sidebarTab === 'recent' ? (
                      <>
                        <Clock className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">No recently watched channels</p>
                      </>
                    ) : (
                      <>
                        <Tv className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">No channels available</p>
                      </>
                    )}
                  </div>
                ) : (
                  sidebarItems.map((channel, idx) => {
                    const isActive = selectedChannel?.id === channel.id;
                    const isFav = isFavorite(channel.id);
                    
                    return (
                      <div
                        key={channel.id}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-red-600/20 border-l-4 border-red-600' 
                            : 'hover:bg-white/10'
                        }`}
                        onClick={() => handleChannelChange(channel)}
                        onMouseEnter={() => setHoveredChannel(channel.id)}
                        onMouseLeave={() => setHoveredChannel(null)}
                      >
                        {/* Channel Number */}
                        <div className="w-8 text-center">
                          <span className={`text-sm font-mono ${isActive ? 'text-red-500' : 'text-white/40'}`}>
                            {idx + 1}
                          </span>
                        </div>
                        
                        {/* Channel Icon */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-red-600' : 'bg-white/10'
                        }`}>
                          <Tv className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                        </div>
                        
                        {/* Channel Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                              {channel.name}
                            </h3>
                            {isFav && <Heart className="w-3 h-3 text-red-500 fill-red-500" />}
                          </div>
                          <p className="text-[10px] text-white/40 truncate">
                            {channel.description?.substring(0, 40) || '24/7 Live Stream'}
                          </p>
                        </div>
                        
                        {/* Favorite Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(channel);
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            isFav ? 'text-red-500' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500' : ''}`} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-white/10">
                <div className="text-white/30 text-[10px] text-center space-y-1">
                  <p>Press 'S' to toggle sidebar • ESC to close</p>
                  <p>1: All Channels • 2: Favorites • 3: Recent</p>
                  <p>← → Change Channel • Ctrl+Shift+Z Admin</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* TV Guide */}
      {showGuide && (
        <TVGuide
          currentChannel={selectedChannel!}
          allChannels={channels}
          videos={videos}
          onChannelSelect={handleChannelChange}
          onClose={() => setShowGuide(false)}
        />
      )}

      {/* Admin Panel */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      
      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/95 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-gray-900 to-black border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white">Admin Access</h2>
                <p className="text-white/40 mt-2">Enter password to continue</p>
              </div>
              <input
                type="password"
                autoFocus
                placeholder="Enter Password"
                className="w-full bg-black/50 border border-white/20 rounded-xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors mb-6 text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyPassword((e.target as HTMLInputElement).value);
                  }
                  if (e.key === 'Escape') {
                    setShowPasswordModal(false);
                  }
                }}
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                    verifyPassword(input.value);
                  }}
                  className="flex-1 px-6 py-3 bg-red-600 rounded-xl font-bold uppercase tracking-widest hover:bg-red-700 transition-colors"
                >
                  Verify
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30 bg-black/50 backdrop-blur-md p-3 rounded-full hover:bg-red-600 transition-all border border-white/10"
      >
        {showSidebar ? <ChevronRight className="w-5 h-5 text-white" /> : <ChevronLeft className="w-5 h-5 text-white" />}
      </button>

      {/* Smart TV Remote Control Hint */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 text-white/40 text-xs flex items-center gap-3">
          <span>← → Change Channel</span>
          <span>•</span>
          <span>S for Sidebar</span>
          <span>•</span>
          <span>ESC to Close</span>
          <span>•</span>
          <span>Ctrl+Shift+Z Admin</span>
        </div>
      </div>
    </div>
  );
}