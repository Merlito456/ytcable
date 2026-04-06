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

  // Show loading state
  if (isLoadingChannels && channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Loading channels...</p>
        </div>
      </div>
    );
  }

  // If no channels exist
  if (channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Tv className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">YouTube Cable</h1>
          <p className="text-white/40 text-sm mb-4">No channels available</p>
          {user?.email === "rabanes.johncarlo4@gmail.com" && (
            <button
              onClick={() => setShowAdmin(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-all"
            >
              Open Admin Panel
            </button>
          )}
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

      {/* Right Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-black/95 border-l border-white/10 z-50 shadow-2xl flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <List className="w-5 h-5 text-orange-500" />
                    <h2 className="text-white font-semibold text-base">Channels</h2>
                  </div>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setSidebarTab('channels')}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      sidebarTab === 'channels' 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    All ({channels.length})
                  </button>
                  <button
                    onClick={() => setSidebarTab('favorites')}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      sidebarTab === 'favorites' 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    Favorites ({favorites.length})
                  </button>
                  <button
                    onClick={() => setSidebarTab('recent')}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      sidebarTab === 'recent' 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    Recent
                  </button>
                </div>
              </div>

              {/* Channel List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-white/40 text-xs">No channels found</p>
                  </div>
                ) : (
                  sidebarItems.map((channel, idx) => {
                    const isActive = selectedChannel?.id === channel.id;
                    const isFav = isFavorite(channel.id);
                    
                    return (
                      <div
                        key={channel.id}
                        className={`flex items-center gap-2 p-2 rounded transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-orange-500/20 border-l-2 border-orange-500' 
                            : 'hover:bg-white/5'
                        }`}
                        onClick={() => handleChannelChange(channel)}
                      >
                        <div className="w-6 text-center">
                          <span className={`text-xs ${isActive ? 'text-orange-500' : 'text-white/40'}`}>
                            {idx + 1}
                          </span>
                        </div>
                        
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${
                          isActive ? 'bg-orange-500' : 'bg-white/10'
                        }`}>
                          <Tv className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/60'}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className={`text-sm truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                              {channel.name}
                            </h3>
                            {isFav && <Heart className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />}
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(channel);
                          }}
                          className={`p-1 rounded transition-all ${
                            isFav ? 'text-orange-500' : 'text-white/40 hover:text-white/60'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-orange-500' : ''}`} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 border-t border-white/10">
                <div className="text-white/30 text-[9px] text-center">
                  <p>S: Toggle • 1-3: Tabs • ← →: Channels</p>
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-6 rounded-xl w-full max-w-sm"
            >
              <h2 className="text-xl font-bold text-white mb-4 text-center">Admin Access</h2>
              <input
                type="password"
                autoFocus
                placeholder="Enter Password"
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white text-center focus:outline-none focus:border-orange-500 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyPassword((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                    verifyPassword(input.value);
                  }}
                  className="flex-1 px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600"
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
        className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30 bg-black/50 p-2 rounded-full hover:bg-orange-500 transition-all"
      >
        {showSidebar ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
      </button>
    </div>
  );
}