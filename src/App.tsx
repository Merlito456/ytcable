import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { Channel, Video } from './types';
import { Player } from './components/Player';
import { ChannelList } from './components/ChannelList';
import { AdminPanel } from './components/AdminPanel';
import { TVGuide } from './components/TVGuide';
import { Tv, LogIn, LogOut, Menu, Search, Settings, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);

  // Smart TV: Handle remote control navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Debug logging for admin shortcut
      console.log('Key pressed:', e.key, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey);
      
      // Admin shortcut: Ctrl + Shift + Z
      if (e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
        console.log("Admin shortcut triggered!");
        e.preventDefault();
        handleAdminAccess();
        return;
      }
      
      // Other navigation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          break;
        case 'ArrowDown':
          e.preventDefault();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          break;
        case 'ArrowRight':
          e.preventDefault();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          break;
        case 'Escape':
          if (showGuide) setShowGuide(false);
          if (showSidebar) setShowSidebar(false);
          if (showAdmin) setShowAdmin(false);
          if (showPasswordModal) setShowPasswordModal(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide, showSidebar, showAdmin, showPasswordModal]);

  // Load channels and auto-select the first one
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
        
        // Auto-select the first channel if available and no channel is selected
        if (channelData.length > 0 && !selectedChannel) {
          console.log('Auto-selecting first channel:', channelData[0].name);
          setSelectedChannel(channelData[0]);
        }
      } catch (error) {
        console.error("Error loading channels:", error);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    loadChannels();
    
    // Also set up real-time listener for updates
    const unsubscribe = onSnapshot(query(collection(db, 'channels'), orderBy('createdAt', 'desc')), (snapshot) => {
      const channelData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Channel));
      setChannels(channelData);
      
      // Auto-select first channel if none selected and channels exist
      if (channelData.length > 0 && !selectedChannel) {
        console.log('Auto-selecting first channel from real-time update:', channelData[0].name);
        setSelectedChannel(channelData[0]);
      }
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

  // Show loading state while channels are being loaded
  if (isLoadingChannels && channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Tv className="w-8 h-8 text-orange-500 animate-pulse" />
            </div>
          </div>
          <p className="text-white/60 text-lg font-medium">Loading your channels...</p>
          <p className="text-white/40 text-sm mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  // If no channels exist, show empty state
  if (channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Tv className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">YouTube Cable</h1>
          <p className="text-white/60 mb-6">No channels available. Please add channels in the admin panel.</p>
          {user?.email === "rabanes.johncarlo4@gmail.com" && (
            <button
              onClick={() => setShowAdmin(true)}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-all"
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

  // Player is now always visible since we auto-select a channel
  return (
    <div className="fixed inset-0 bg-black">
      {/* Player - Fullscreen with Smart TV optimizations */}
      {selectedChannel && (
        <Player 
          channel={selectedChannel} 
          videos={videos}
          onShowGuide={() => setShowGuide(true)}
        />
      )}

      {/* Smart TV Sidebar */}
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
                      className="w-full p-4 bg-orange-500/20 hover:bg-orange-500/30 rounded-xl transition-all text-left flex items-center gap-4 border border-orange-500/30"
                    >
                      <Settings className="w-6 h-6 text-orange-500" />
                      <div>
                        <div className="text-white font-bold text-lg">Admin Panel</div>
                        <div className="text-orange-400/60 text-sm">Manage channels and content</div>
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
          currentChannel={selectedChannel!}
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
          Press Menu for options • ESC to go back • Ctrl+Shift+Z for Admin
        </div>
      </div>

      {/* Admin Shortcut Hint - For TV Users */}
      <div className="fixed bottom-20 right-4 z-30 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-black/50 backdrop-blur-md rounded-lg px-3 py-1.5 text-white/30 text-[10px]">
          Ctrl + Shift + Z for Admin
        </div>
      </div>
    </div>
  );
}