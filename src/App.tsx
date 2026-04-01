import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { Channel, Video } from './types';
import { Player } from './components/Player';
import { ChannelList } from './components/ChannelList';
import { AdminPanel } from './components/AdminPanel';
import { Tv, LogIn, LogOut, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import { cn } from './lib/utils';
import { TVGuide } from './components/TVGuide';

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
  const [showGuide, setShowGuide] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);

  // Load channels for the guide
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

  // Show loading state if no channel selected
  if (!selectedChannel) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Tv className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">YouTube Cable</h1>
          <p className="text-white/60 mb-8">Select a channel to start watching</p>
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
      {/* Player - Fullscreen */}
      <Player 
        channel={selectedChannel} 
        videos={videos}
        onShowGuide={() => setShowGuide(true)}
      />

      {/* Channel List Overlay (Only for channel selection) */}
      {!selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
          <div className="w-full max-w-4xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Select a Channel</h2>
            <ChannelList
              selectedChannelId={null}
              onSelectChannel={setSelectedChannel}
            />
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      
      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black uppercase tracking-widest mb-6 text-center">Admin Access</h2>
              <input
                type="password"
                autoFocus
                placeholder="Enter Password"
                className="w-full bg-black border border-white/10 rounded-xl px-6 py-4 text-xl font-bold focus:outline-none focus:border-orange-500 transition-colors mb-6 text-center"
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
                  className="flex-1 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
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
    </div>
  );
}