import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { Channel, Video } from './types';
import { Player } from './components/Player';
import { ChannelList } from './components/ChannelList';
import { AdminPanel } from './components/AdminPanel';
import { TVGuide } from './components/TVGuide';
import { Tv, LogIn, LogOut, Menu, Search, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from './lib/error-handler';

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
  const [showSidebar, setShowSidebar] = useState(false);
  const [focusedElement, setFocusedElement] = useState<string>('');

  // Smart TV: Handle remote control navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow navigation for TV remote
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          // Navigate up
          break;
        case 'ArrowDown':
          e.preventDefault();
          // Navigate down
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // Navigate left
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Navigate right
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          // Select focused element
          break;
        case 'Escape':
          if (showGuide) setShowGuide(false);
          if (showSidebar) setShowSidebar(false);
          if (showAdmin) setShowAdmin(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide, showSidebar, showAdmin]);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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
    setShowPasswordModal(true);
  };

  const verifyPassword = async (password: string) => {
    if (password === '07141994') {
      setShowPasswordModal(false);
      if (user?.email === "rabanes.johncarlo4@gmail.com") {
        setShowAdmin(true);
      } else {
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          if (result.user.email === "rabanes.johncarlo4@gmail.com") {
            setShowAdmin(true);
          } else {
            alert('This account does not have administrator privileges.');
            await signOut(auth);
          }
        } catch (error) {
          console.error("Admin login failed:", error);
        }
      }
    } else {
      alert('Incorrect password');
    }
  };

  const handleTitleClick = () => {
    const now = Date.now();
    const newTaps = (now - lastClickTime > 2000) ? 1 : titleTaps + 1;
    
    if (newTaps >= 10) {
      handleAdminAccess();
      setTitleTaps(0);
    } else {
      setTitleTaps(newTaps);
    }
    setLastClickTime(now);
  };

  // Channel selection screen
  if (!selectedChannel) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-y-auto">
        {/* Hero Section - TV Style */}
        <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent z-10" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop')] bg-cover bg-center scale-110" />
          
          <div className="relative z-20 h-full flex items-center px-8 md:px-16 lg:px-24">
            <div className="max-w-3xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Tv className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">YouTube Cable</h1>
                  <p className="text-white/60 text-lg md:text-xl mt-2">Smart TV Experience • 24/7 Live Streaming</p>
                </div>
              </div>
              <p className="text-white/80 text-xl mb-8 max-w-2xl leading-relaxed">
                Your favorite channels, streaming continuously in HD. Choose a channel to start watching.
              </p>
              <div className="flex items-center gap-6 text-white/50 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Live Now</span>
                </div>
                <span>•</span>
                <span>24/7 Streaming</span>
                <span>•</span>
                <span>HD Quality</span>
                <span>•</span>
                <span>Smart TV Ready</span>
              </div>
            </div>
          </div>
          
          {/* Scroll Indicator for TV */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce z-20">
            <div className="w-8 h-12 border-2 border-white/30 rounded-full flex justify-center">
              <div className="w-1.5 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
            </div>
          </div>
        </div>
        
        {/* Channel Selection Section */}
        <div className="px-8 md:px-16 lg:px-24 py-12">
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Live Channels</h2>
            <p className="text-white/40 text-lg mt-2">Browse and select from {channels.length} available channels</p>
          </div>
          
          <ChannelList
            selectedChannelId={null}
            onSelectChannel={setSelectedChannel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Player - Fullscreen with Smart TV optimizations */}
      <Player 
        channel={selectedChannel} 
        videos={videos}
        onShowGuide={() => setShowGuide(true)}
      />

      {/* Smart TV Sidebar - Large, TV-friendly buttons */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <div 
              className="fixed inset-0 bg-black/70 z-40"
              onClick={() => setShowSidebar(false)}
            />
            <motion.div
              initial={{ x: -400 }}
              animate={{ x: 0 }}
              exit={{ x: -400 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-96 bg-black/95 backdrop-blur-xl border-r border-white/10 z-50 shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Tv className="w-8 h-8 text-orange-500" />
                    <h2 className="text-2xl font-bold text-white">Menu</h2>
                  </div>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setShowGuide(true);
                      setShowSidebar(false);
                    }}
                    className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-left flex items-center gap-4"
                  >
                    <Search className="w-6 h-6 text-orange-500" />
                    <div>
                      <div className="text-white font-bold text-lg">TV Guide</div>
                      <div className="text-white/40 text-sm">Browse channel schedule</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (user) {
                        handleSignOut();
                      } else {
                        handleSignIn();
                      }
                      setShowSidebar(false);
                    }}
                    className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-left flex items-center gap-4"
                  >
                    {user ? <LogOut className="w-6 h-6 text-orange-500" /> : <LogIn className="w-6 h-6 text-orange-500" />}
                    <div>
                      <div className="text-white font-bold text-lg">{user ? 'Sign Out' : 'Sign In'}</div>
                      <div className="text-white/40 text-sm">
                        {user ? user.email : 'Sign in for admin access'}
                      </div>
                    </div>
                  </button>
                  
                  {user?.email === "rabanes.johncarlo4@gmail.com" && (
                    <button
                      onClick={() => {
                        setShowAdmin(true);
                        setShowSidebar(false);
                      }}
                      className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-left flex items-center gap-4"
                    >
                      <Settings className="w-6 h-6 text-orange-500" />
                      <div>
                        <div className="text-white font-bold text-lg">Admin Panel</div>
                        <div className="text-white/40 text-sm">Manage channels and content</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* TV Guide */}
      {showGuide && (
        <TVGuide
          currentChannel={selectedChannel}
          allChannels={channels}
          videos={videos}
          onChannelSelect={(channel) => {
            setSelectedChannel(channel);
            setShowGuide(false);
          }}
          onClose={() => setShowGuide(false)}
        />
      )}

      {/* Admin Panel */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      
      {/* Password Modal - TV Optimized */}
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
                <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white">Admin Access</h2>
                <p className="text-white/40 mt-2">Enter password to continue</p>
              </div>
              <input
                type="password"
                autoFocus
                placeholder="Enter Password"
                className="w-full bg-black/50 border border-white/20 rounded-xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-orange-500 transition-colors mb-6 text-center"
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
                  className="flex-1 px-6 py-3 bg-orange-600 rounded-xl font-bold uppercase tracking-widest hover:bg-orange-500 transition-colors"
                >
                  Verify
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart TV Remote Control Hint */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 text-white/40 text-xs">
          Use arrow keys to navigate • Enter to select • ESC to go back
        </div>
      </div>
    </div>
  );
}