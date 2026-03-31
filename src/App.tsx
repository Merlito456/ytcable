import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { db, auth } from './firebase';
import { Channel, Video } from './types';
import { Player } from './components/Player';
import { ChannelList } from './components/ChannelList';
import { AdminPanel } from './components/AdminPanel';
import { Tv, Radio, Info, Github, ExternalLink, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import { cn } from './lib/utils';

export default function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleActivity = () => {
      setShowUI(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowUI(false), 5000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearTimeout(timeout);
    };
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
    
    if (selectedChannel.type === 'dynamic') {
      import('./services/geminiService').then(({ fetchRecentVideos }) => {
        fetchRecentVideos(selectedChannel.query || selectedChannel.name)
          .then(videoInfos => {
            const dynamicVideos: Video[] = videoInfos.map((v, index) => ({
              id: `dynamic-${index}`,
              youtubeId: v.youtubeId,
              title: v.title,
              duration: v.duration,
              order: index,
            }));
            setVideos(dynamicVideos);
            setLoadingVideos(false);
          })
          .catch(error => {
            console.error("Failed to fetch dynamic videos:", error);
            setLoadingVideos(false);
          });
      });
      return;
    }

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

  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [titleTaps, setTitleTaps] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleAdminAccess = () => {
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

  useEffect(() => {
    console.log("YouTube Cable TV initialized. Path:", window.location.pathname);
    
    const checkPath = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('admin')) {
        console.log("Admin path detected, opening password modal...");
        setShowPasswordModal(true);
      }
    };

    checkPath();
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        console.log("Admin shortcut triggered");
        handleAdminAccess();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

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

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* Fullscreen Player */}
      <AnimatePresence mode="wait">
        {selectedChannel && videos.length > 0 ? (
          <motion.div
            key={selectedChannel.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-0"
          >
            <Player channel={selectedChannel} videos={videos} />
          </motion.div>
        ) : loadingVideos ? (
          <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center text-zinc-600 z-0">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-2xl font-black uppercase tracking-widest text-white/20">Tuning Channel...</h2>
          </div>
        ) : (
          <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center text-zinc-600 z-0">
            <Tv className="w-24 h-24 mb-6 opacity-10 animate-pulse" />
            <h2 className="text-2xl font-black uppercase tracking-widest text-white/20">Select a Channel</h2>
          </div>
        )}
      </AnimatePresence>

      {/* Smart TV Overlay UI */}
      <motion.div 
        animate={{ opacity: showUI ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "fixed inset-0 z-10 pointer-events-none"
        )}
      >
        {/* Top Navigation Bar */}
        <header className="absolute top-0 left-0 right-0 p-6 md:p-12 flex flex-col md:flex-row justify-between items-center md:items-start gap-6 pointer-events-auto">
          <div className="flex items-center gap-3 md:gap-4 cursor-pointer" onClick={handleTitleClick}>
            <div className="w-10 h-10 md:w-14 md:h-14 bg-orange-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-900/40">
              <Tv className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-black tracking-tighter uppercase leading-none">YouTube Cable</h1>
              <p className="text-[8px] md:text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em] mt-1">Smart TV Experience</p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-center md:justify-end">
            <nav className="hidden sm:flex items-center gap-4 md:gap-8">
              <button className="text-sm md:text-lg font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Search</button>
              <button className="text-sm md:text-lg font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Guide</button>
            </nav>
          </div>
        </header>

        {/* Channel Info Overlay */}
        {selectedChannel && (
          <div className="absolute left-6 md:left-12 bottom-48 md:bottom-64 max-w-[90%] md:max-w-2xl">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
                <div className="px-2 py-0.5 md:px-3 md:py-1 bg-orange-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-md">Live Now</div>
                <div className="flex items-center gap-1.5 md:gap-2 text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse" />
                  {selectedChannel.name}
                </div>
              </div>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter mb-4 md:mb-6 leading-none uppercase line-clamp-2">{selectedChannel.name}</h2>
              <p className="text-sm md:text-xl text-white/60 font-medium leading-relaxed line-clamp-2 mb-6 md:mb-8">
                {selectedChannel.description || 'Experience synchronized real-time broadcasting powered by Google AI.'}
              </p>
            </motion.div>
          </div>
        )}

        {/* Bottom Channel Shelf */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-auto">
          <ChannelList
            selectedChannelId={selectedChannel?.id || null}
            onSelectChannel={setSelectedChannel}
          />
        </div>
      </motion.div>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      
      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
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
    </div>
  );
}
