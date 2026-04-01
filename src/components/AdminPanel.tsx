import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, writeBatch, onSnapshot, query, orderBy, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser, sendEmailVerification, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { 
  Plus, 
  ListPlus, 
  Loader2, 
  X, 
  Trash2, 
  Settings, 
  Info, 
  Video as VideoIcon,
  Link,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Youtube,
  Mail,
  LogOut,
  Shuffle
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Channel, Video } from '../types';

interface AdminPanelProps {
  onClose: () => void;
}

// Use the YouTube API key from environment variables
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'videos'>('create');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [videoData, setVideoData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [fetchingDurations, setFetchingDurations] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean>(true);
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Sign out function
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setSuccess('Signed out successfully');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
    }
  };

  // Check YouTube API key on mount
  useEffect(() => {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
      console.warn('YouTube API key not configured');
      setApiKeyValid(false);
      setError('YouTube API key not configured. Please add VITE_YOUTUBE_API_KEY to your environment variables.');
    } else {
      console.log('YouTube API key configured');
      setApiKeyValid(true);
    }
  }, []);

  // Check admin status
  useEffect(() => {
    console.log("AdminPanel mounted");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        console.log("User authenticated:", user.email);
        console.log("Email verified:", user.emailVerified);
        
        // Check if the user is admin based on email ONLY
        const adminEmail = "rabanes.johncarlo4@gmail.com";
        const isUserAdmin = user.email === adminEmail;
        setIsAdmin(isUserAdmin);
        
        if (!isUserAdmin) {
          setError(`You don't have admin permissions. Only ${adminEmail} can manage channels.`);
        } else {
          console.log("Admin access granted");
          setError(null);
        }
      } else {
        console.log("No user authenticated");
        setIsAdmin(false);
        setError("Please sign in to access admin features.");
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Load channels for manage tab
  useEffect(() => {
    if (activeTab !== 'manage' && activeTab !== 'videos') return;
    
    if (!isAdmin) {
      console.log("Not admin, skipping channel load");
      return;
    }

    console.log("Loading channels...");
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Channel));
      setChannels(channelData);
      console.log("Channels loaded:", channelData.length);
    }, (error) => {
      console.error("Error loading channels:", error);
      handleFirestoreError(error, OperationType.LIST, 'channels');
      setError(`Failed to load channels: ${error.message}`);
    });

    return () => unsubscribe();
  }, [activeTab, isAdmin]);

  // Load videos when a channel is selected
  useEffect(() => {
    if (!selectedChannel || !isAdmin) {
      setChannelVideos([]);
      return;
    }

    console.log("Loading videos for channel:", selectedChannel.id);
    const videosRef = collection(db, `channels/${selectedChannel.id}/videos`);
    const q = query(videosRef, orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videosData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          youtubeId: data.youtubeId,
          title: data.title,
          duration: typeof data.duration === 'number' ? data.duration : parseInt(data.duration, 10) || 0,
          order: typeof data.order === 'number' ? data.order : parseInt(data.order, 10) || 0,
        } as Video;
      });
      setChannelVideos(videosData);
      console.log("Videos loaded:", videosData.length);
    }, (error) => {
      console.error("Failed to load videos:", error);
      setError(`Failed to load videos: ${error.message}`);
    });

    return () => unsubscribe();
  }, [selectedChannel, isAdmin]);

  // Send verification email function
  const sendVerificationEmail = async () => {
    if (user && !user.emailVerified) {
      try {
        await sendEmailVerification(user);
        setSuccess('Verification email sent! Please check your inbox and click the link.');
        setTimeout(() => setSuccess(null), 5000);
      } catch (error: any) {
        console.error("Failed to send verification:", error);
        setError(`Failed to send verification: ${error.message}`);
      }
    }
  };

  // Shuffle videos in channel - RANDOMIZE ORDER
  const shuffleVideos = async (channelId: string) => {
    if (!isAdmin) {
      setError("You don't have permission to shuffle videos");
      return;
    }
    
    if (!window.confirm('This will randomize the order of all videos in this channel. Continue?')) return;
    
    setIsProcessing(true);
    setError(null);
    setProgressMessage('Shuffling videos...');
    
    try {
      const videosRef = collection(db, `channels/${channelId}/videos`);
      const snapshot = await getDocs(videosRef);
      
      if (snapshot.empty) {
        setError('No videos found in this channel');
        setIsProcessing(false);
        setProgressMessage('');
        return;
      }
      
      // Get all videos
      const videos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Shuffle the array using Fisher-Yates algorithm
      const shuffled = [...videos];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Update order numbers in batches
      const BATCH_SIZE = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, shuffled.length);
        const batchVideos = shuffled.slice(i, batchEnd);
        
        const batch = writeBatch(db);
        
        batchVideos.forEach((video, idx) => {
          const videoRef = doc(db, `channels/${channelId}/videos`, video.id);
          batch.update(videoRef, { order: i + idx });
        });
        
        await batch.commit();
        updatedCount += batchVideos.length;
        setProgressMessage(`Shuffled ${updatedCount} of ${shuffled.length} videos...`);
      }
      
      setSuccess(`✅ Successfully shuffled ${shuffled.length} videos to random order!`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh the video list
      const updatedSnapshot = await getDocs(videosRef);
      const updatedVideos = updatedSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          youtubeId: data.youtubeId,
          title: data.title,
          duration: typeof data.duration === 'number' ? data.duration : parseInt(data.duration, 10) || 0,
          order: typeof data.order === 'number' ? data.order : parseInt(data.order, 10) || 0,
        } as Video;
      }).sort((a, b) => a.order - b.order);
      setChannelVideos(updatedVideos);
      
      setProgressMessage('');
    } catch (error: any) {
      console.error("Failed to shuffle videos:", error);
      setError(`Failed to shuffle videos: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse ISO 8601 duration to seconds
  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match?.[1] || '0');
    const minutes = parseInt(match?.[2] || '0');
    const seconds = parseInt(match?.[3] || '0');
    return (hours * 3600) + (minutes * 60) + seconds;
  };

  // Fetch video duration from YouTube API
  const fetchYouTubeDuration = async (youtubeId: string): Promise<number> => {
    if (!apiKeyValid) return 0;
    
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${youtubeId}&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const duration = data.items[0].contentDetails.duration;
        const totalSeconds = parseDuration(duration);
        return totalSeconds;
      }
      return 0;
    } catch (error) {
      console.error(`Failed to fetch duration for ${youtubeId}:`, error);
      return 0;
    }
  };

  // Test YouTube API connection
  const testYouTubeAPI = async () => {
    if (!apiKeyValid) {
      setError('YouTube API key not configured');
      return;
    }
    
    setSuccess('Testing YouTube API connection...');
    try {
      const testVideoId = 'dQw4w9WgXcQ';
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${testVideoId}&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.error) {
        setError(`YouTube API Error: ${data.error.message}`);
        console.error('YouTube API Error:', data.error);
      } else if (data.items && data.items.length > 0) {
        const duration = data.items[0].contentDetails.duration;
        const seconds = parseDuration(duration);
        setSuccess(`YouTube API Working! Test video duration: ${seconds}s (${formatDuration(seconds)})`);
      } else {
        setError('YouTube API returned no results');
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(`Failed to connect to YouTube API: ${error}`);
      console.error(error);
    }
  };

  // Fix video durations using YouTube API
  const fixVideoDurations = async (channelId: string) => {
    if (!apiKeyValid) {
      setError('Cannot fix durations: YouTube API key not configured');
      return;
    }
    
    if (!window.confirm('This will fetch real durations from YouTube API for all videos in this channel. Continue?')) return;
    
    setFetchingDurations(true);
    setError(null);
    setProgressMessage('Starting...');
    
    try {
      const videosRef = collection(db, `channels/${channelId}/videos`);
      const snapshot = await getDocs(videosRef);
      
      if (snapshot.empty) {
        setError('No videos found in this channel');
        setFetchingDurations(false);
        return;
      }
      
      console.log(`Found ${snapshot.docs.length} videos`);
      
      // Collect all videos
      const allVideos: { id: string; youtubeId: string; title: string; oldDuration: any }[] = [];
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        allVideos.push({
          id: doc.id,
          youtubeId: data.youtubeId,
          title: data.title,
          oldDuration: data.duration,
        });
      });
      
      setProgressMessage(`Processing ${allVideos.length} videos...`);
      
      // Process videos in batches
      let updatedCount = 0;
      let failedCount = 0;
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < allVideos.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, allVideos.length);
        const batchVideos = allVideos.slice(i, batchEnd);
        
        setProgressMessage(`Processing videos ${i + 1} to ${batchEnd} of ${allVideos.length}...`);
        
        const batch = writeBatch(db);
        let batchUpdatedCount = 0;
        
        for (const video of batchVideos) {
          try {
            const realDuration = await fetchYouTubeDuration(video.youtubeId);
            
            if (realDuration > 0) {
              const videoRef = doc(db, `channels/${channelId}/videos`, video.id);
              batch.update(videoRef, { duration: Number(realDuration) });
              batchUpdatedCount++;
              console.log(`✓ "${video.title.substring(0, 50)}": ${video.oldDuration} → ${realDuration}s`);
            } else {
              failedCount++;
              console.warn(`✗ Failed for "${video.title.substring(0, 50)}" (${video.youtubeId})`);
            }
          } catch (error) {
            failedCount++;
            console.error(`Error for ${video.title}:`, error);
          }
        }
        
        if (batchUpdatedCount > 0) {
          await batch.commit();
          updatedCount += batchUpdatedCount;
          setProgressMessage(`Updated ${updatedCount} videos so far...`);
        }
      }
      
      if (updatedCount > 0) {
        setSuccess(`✅ Successfully updated ${updatedCount} videos! ${failedCount > 0 ? `⚠️ ${failedCount} failed` : ''}`);
        
        const updatedSnapshot = await getDocs(videosRef);
        const updatedVideos = updatedSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            youtubeId: data.youtubeId,
            title: data.title,
            duration: typeof data.duration === 'number' ? data.duration : parseInt(data.duration, 10) || 0,
            order: typeof data.order === 'number' ? data.order : parseInt(data.order, 10) || 0,
          } as Video;
        }).sort((a, b) => a.order - b.order);
        setChannelVideos(updatedVideos);
      } else {
        setError('Failed to fetch any durations. Check your YouTube API key and video IDs.');
      }
      
      setProgressMessage('');
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('Failed to fix videos:', error);
      setError(`Failed to fix videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFetchingDurations(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!isAdmin) {
      setError("You don't have permission to delete channels");
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this channel and all its videos?')) return;
    
    try {
      await deleteDoc(doc(db, 'channels', channelId));
      setSuccess('Channel deleted successfully!');
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(null);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Failed to delete channel:", error);
      setError(`Failed to delete channel: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!isAdmin) {
      setError("You don't have permission to delete videos");
      return;
    }
    
    if (!selectedChannel) return;
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    
    try {
      await deleteDoc(doc(db, `channels/${selectedChannel.id}/videos`, videoId));
      setSuccess('Video deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Failed to delete video:", error);
      setError(`Failed to delete video: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const parseVideoLine = async (line: string, fetchFromApi: boolean = false): Promise<{ youtubeId: string; title: string; duration: number } | null> => {
    let youtubeId = '';
    let title = '';
    let duration = 0;
    
    if (line.includes('|')) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 3) {
        youtubeId = parts[0];
        title = parts[1];
        duration = parseInt(parts[2], 10);
        if ((isNaN(duration) || duration <= 0) && fetchFromApi) {
          duration = await fetchYouTubeDuration(youtubeId);
        }
      }
    } 
    else if (line.includes(',')) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        youtubeId = parts[0];
        title = parts[1];
        duration = parseInt(parts[2], 10);
        if ((isNaN(duration) || duration <= 0) && fetchFromApi) {
          duration = await fetchYouTubeDuration(youtubeId);
        }
      }
    }
    else {
      youtubeId = line.trim();
      title = `Video ${youtubeId}`;
      if (fetchFromApi) {
        duration = await fetchYouTubeDuration(youtubeId);
      }
    }
    
    if (youtubeId) {
      if (duration <= 0) {
        duration = 300;
      }
      return { youtubeId, title, duration };
    }
    return null;
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName || !videoData) return;
    
    if (!isAdmin) {
      setError('You must be logged in as admin to create channels');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const lines = videoData.split('\n').filter(l => l.trim().length > 0);
      const videos: { youtubeId: string; title: string; duration: number }[] = [];
      
      setSuccess('Fetching video durations from YouTube...');
      
      for (const line of lines) {
        const parsed = await parseVideoLine(line, true);
        if (parsed) {
          videos.push(parsed);
        }
      }
      
      if (videos.length === 0) {
        setError('No valid videos found. Please check your format.');
        setIsProcessing(false);
        return;
      }
      
      const channelData = {
        name: channelName,
        description: channelDesc || "",
        startTime: Date.now(),
        createdAt: Date.now(),
        type: 'synchronized',
      };
      
      const channelRef = await addDoc(collection(db, 'channels'), channelData);
      
      const batch = writeBatch(db);
      videos.forEach((video, index) => {
        const videoRef = doc(collection(db, `channels/${channelRef.id}/videos`));
        batch.set(videoRef, {
          youtubeId: video.youtubeId,
          title: video.title,
          duration: Number(video.duration),
          order: Number(index),
        });
      });
      
      await batch.commit();
      
      setChannelName('');
      setChannelDesc('');
      setVideoData('');
      setSuccess(`Channel "${channelName}" created successfully with ${videos.length} videos!`);
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error("Failed to add channel:", error);
      if (error.code === 'permission-denied') {
        setError('Permission denied. Please make sure you are logged in as admin.');
      } else {
        setError(`Failed to create channel: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddVideosToChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !videoData) return;
    
    if (!isAdmin) {
      setError('You must be logged in as admin to add videos');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const lines = videoData.split('\n').filter(l => l.trim().length > 0);
      const videos: { youtubeId: string; title: string; duration: number }[] = [];
      
      setSuccess('Fetching video durations from YouTube...');
      
      for (const line of lines) {
        const parsed = await parseVideoLine(line, true);
        if (parsed) {
          videos.push(parsed);
        }
      }
      
      if (videos.length === 0) {
        setError('No valid videos found. Please check your format.');
        setIsProcessing(false);
        return;
      }
      
      const batch = writeBatch(db);
      
      videos.forEach((video, idx) => {
        const videoRef = doc(collection(db, `channels/${selectedChannel.id}/videos`));
        batch.set(videoRef, {
          youtubeId: video.youtubeId,
          title: video.title,
          duration: Number(video.duration),
          order: Number(channelVideos.length + idx),
        });
      });
      
      await batch.commit();
      setVideoData('');
      setSuccess(`Successfully added ${videos.length} videos to ${selectedChannel.name}!`);
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error: any) {
      console.error("Failed to add videos:", error);
      if (error.code === 'permission-denied') {
        setError('Permission denied. Please make sure you are logged in as admin.');
      } else {
        setError(`Failed to add videos: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateVideo = async (video: Video) => {
    if (!isAdmin) {
      setError("You don't have permission to update videos");
      return;
    }
    
    if (!selectedChannel) return;
    
    try {
      const videoRef = doc(db, `channels/${selectedChannel.id}/videos`, video.id);
      await setDoc(videoRef, {
        youtubeId: video.youtubeId,
        title: video.title,
        duration: Number(video.duration),
        order: Number(video.order),
      });
      
      setEditingVideo(null);
      setSuccess('Video updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Failed to update video:", error);
      setError(`Failed to update video: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const generateVideoLink = (youtubeId: string) => {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If not admin, show restricted view
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Access Denied
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-white font-bold mb-2">Admin Access Required</h3>
            <p className="text-zinc-400 text-sm">
              {error || "You don't have permission to access the admin panel."}
            </p>
            {user && (
              <div className="mt-4">
                <p className="text-zinc-500 text-xs mb-2">
                  Logged in as: <span className="text-white">{user.email}</span>
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={sendVerificationEmail}
                    className="bg-orange-600 text-white text-xs px-3 py-1 rounded hover:bg-orange-500 flex items-center gap-2"
                  >
                    <Mail className="w-3 h-3" />
                    Send Verification
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="bg-red-600 text-white text-xs px-3 py-1 rounded hover:bg-red-500 flex items-center gap-2"
                  >
                    <LogOut className="w-3 h-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
            {!user && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-orange-600 text-white text-xs px-3 py-1 rounded hover:bg-orange-500"
              >
                Sign In
              </button>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="w-full bg-orange-600 text-white font-bold py-2 rounded-lg hover:bg-orange-500 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Admin view
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-orange-500" />
            Admin Dashboard
          </h2>
          <div className="flex gap-1">
            <button
              onClick={handleSignOut}
              className="text-zinc-500 hover:text-red-500 p-1.5 transition-colors rounded-lg hover:bg-zinc-800"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 transition-colors rounded-lg hover:bg-zinc-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* API Key Status */}
          {!apiKeyValid && (
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-500 text-xs">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              YouTube API key not configured. Video durations will default to 5 minutes.
            </div>
          )}

          {/* Error and Success Messages */}
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-xs">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-2 bg-green-500/10 border border-green-500/50 rounded-lg text-green-500 text-xs">
              <CheckCircle className="w-3 h-3 inline mr-1" />
              {success}
            </div>
          )}
          {progressMessage && (fetchingDurations || isProcessing) && (
            <div className="p-2 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400 text-xs">
              <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
              {progressMessage}
            </div>
          )}

          {/* Admin Info */}
          {user && (
            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-400 flex items-center justify-between">
              <span>Logged in as: {user.email}</span>
              <span className="px-2 py-0.5 bg-orange-500/20 rounded text-[10px]">Admin ✓</span>
            </div>
          )}

          {/* Tab buttons */}
          <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'create' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Plus className="w-3 h-3" />
              Create
            </button>
            <button
              onClick={() => {
                setActiveTab('manage');
                setSelectedChannel(null);
              }}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'manage' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Settings className="w-3 h-3" />
              Channels ({channels.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('videos');
                setSelectedChannel(null);
              }}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                activeTab === 'videos' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <VideoIcon className="w-3 h-3" />
              Videos
            </button>
          </div>

          {/* Create Channel Tab */}
          {activeTab === 'create' && (
            <form onSubmit={handleAddChannel} className="space-y-3">
              <input
                type="text"
                placeholder="Channel Name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500 h-16"
              />
              <textarea
                placeholder="youtubeId | title | duration (optional)&#10;dQw4w9WgXcQ | Rick Astley | 212"
                value={videoData}
                onChange={(e) => setVideoData(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-orange-500 h-32"
                required
              />
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-orange-600 text-white font-bold py-1.5 rounded-lg hover:bg-orange-500 transition-all flex items-center justify-center gap-1 text-xs disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Youtube className="w-3 h-3" />
                    Create Channel
                  </>
                )}
              </button>
            </form>
          )}

          {/* Manage Channels Tab */}
          {activeTab === 'manage' && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {channels.length === 0 ? (
                <div className="text-center py-6 text-zinc-600">
                  <p className="text-xs font-bold">No channels found</p>
                </div>
              ) : (
                channels.map(channel => (
                  <div key={channel.id} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-2 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-white text-xs uppercase">{channel.name}</h3>
                      <p className="text-[9px] text-zinc-500">{channel.type} • {channel.description?.substring(0, 30) || 'No description'}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="p-1 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Manage Videos Tab */}
          {activeTab === 'videos' && (
            <div className="space-y-3">
              <select
                value={selectedChannel?.id || ''}
                onChange={(e) => {
                  const channel = channels.find(c => c.id === e.target.value);
                  setSelectedChannel(channel || null);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="">Select a channel</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>{channel.name}</option>
                ))}
              </select>

              {selectedChannel && (
                <>
                  <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-2">
                    <h3 className="font-bold text-white text-xs">{selectedChannel.name}</h3>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">{selectedChannel.description || 'No description'}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={testYouTubeAPI}
                      disabled={!apiKeyValid}
                      className="flex-1 bg-purple-600 text-white font-bold py-1.5 rounded-lg hover:bg-purple-500 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Youtube className="w-3 h-3" />
                      Test API
                    </button>
                    <button
                      onClick={() => fixVideoDurations(selectedChannel.id)}
                      disabled={fetchingDurations || !apiKeyValid}
                      className="flex-1 bg-blue-600 text-white font-bold py-1.5 rounded-lg hover:bg-blue-500 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {fetchingDurations ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Fix Durations
                    </button>
                  </div>

                  {/* Shuffle Videos Button */}
                  <button
                    onClick={() => shuffleVideos(selectedChannel.id)}
                    disabled={isProcessing || channelVideos.length === 0}
                    className="w-full bg-green-600 text-white font-bold py-1.5 rounded-lg hover:bg-green-500 transition-all flex items-center justify-center gap-1 text-xs disabled:opacity-50"
                  >
                    <Shuffle className="w-3 h-3" />
                    Shuffle Videos (Random Order)
                  </button>

                  <form onSubmit={handleAddVideosToChannel} className="space-y-2">
                    <textarea
                      placeholder="youtubeId | title | duration"
                      value={videoData}
                      onChange={(e) => setVideoData(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-orange-500 h-24"
                    />
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-orange-600 text-white font-bold py-1.5 rounded-lg hover:bg-orange-500 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add Videos
                    </button>
                  </form>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase">Videos ({channelVideos.length})</h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {channelVideos.map(video => (
                        <div key={video.id} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-2">
                          {editingVideo?.id === video.id ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={editingVideo.youtubeId}
                                onChange={(e) => setEditingVideo({...editingVideo, youtubeId: e.target.value})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-xs"
                              />
                              <input
                                type="text"
                                value={editingVideo.title}
                                onChange={(e) => setEditingVideo({...editingVideo, title: e.target.value})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-xs"
                              />
                              <input
                                type="number"
                                value={editingVideo.duration}
                                onChange={(e) => setEditingVideo({...editingVideo, duration: parseInt(e.target.value) || 0})}
                                className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-xs"
                              />
                              <div className="flex gap-1">
                                <button onClick={() => handleUpdateVideo(editingVideo)} className="flex-1 bg-green-600 text-white text-[10px] py-1 rounded">Save</button>
                                <button onClick={() => setEditingVideo(null)} className="flex-1 bg-zinc-600 text-white text-[10px] py-1 rounded">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-1">
                                  <Link className="w-2.5 h-2.5 text-orange-500" />
                                  <a href={generateVideoLink(video.youtubeId)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-orange-500 hover:underline">
                                    {video.youtubeId}
                                  </a>
                                </div>
                                <p className="text-xs text-white mt-0.5 line-clamp-1">{video.title}</p>
                                <p className="text-[9px] text-zinc-500">Duration: {formatDuration(video.duration)} • Order: {video.order}</p>
                              </div>
                              <div className="flex gap-0.5">
                                <button onClick={() => setEditingVideo(video)} className="p-1 text-zinc-500 hover:text-orange-500"><Settings className="w-3 h-3" /></button>
                                <button onClick={() => handleDeleteVideo(video.id)} className="p-1 text-zinc-500 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {channelVideos.length === 0 && (
                        <div className="text-center py-4 text-zinc-500">
                          <p className="text-xs">No videos yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}