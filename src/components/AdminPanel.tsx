import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, writeBatch, onSnapshot, query, orderBy, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Plus, ListPlus, Loader2, X, Trash2, Settings, Info, Video, Link } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Channel, Video } from '../types';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'videos'>('create');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [videoData, setVideoData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);

  useEffect(() => {
    console.log("AdminPanel mounted");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Load channels for manage tab
  useEffect(() => {
    if (activeTab !== 'manage' && activeTab !== 'videos') return;

    const q = query(collection(db, 'channels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Channel));
      setChannels(channelData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'channels');
    });

    return () => unsubscribe();
  }, [activeTab]);

  // Load videos when a channel is selected
  useEffect(() => {
    if (!selectedChannel) {
      setChannelVideos([]);
      return;
    }

    const videosRef = collection(db, `channels/${selectedChannel.id}/videos`);
    const q = query(videosRef, orderBy('order', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      setChannelVideos(videosData);
    }, (error) => {
      console.error("Failed to load videos:", error);
    });

    return () => unsubscribe();
  }, [selectedChannel]);

  const handleDeleteChannel = async (channelId: string) => {
    if (!window.confirm('Are you sure you want to delete this channel and all its videos?')) return;
    
    try {
      await deleteDoc(doc(db, 'channels', channelId));
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(null);
      }
    } catch (error) {
      console.error("Failed to delete channel:", error);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!selectedChannel) return;
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    
    try {
      await deleteDoc(doc(db, `channels/${selectedChannel.id}/videos`, videoId));
    } catch (error) {
      console.error("Failed to delete video:", error);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName || !videoData) return;

    setIsProcessing(true);
    try {
      // Parse video data - supports multiple formats
      const lines = videoData.split('\n').filter(l => l.trim().length > 0);
      const videos = [];
      
      for (const line of lines) {
        // Try to parse different formats
        let youtubeId = '';
        let title = '';
        let duration = 0;
        
        // Format 1: youtubeId|title|duration
        if (line.includes('|')) {
          const parts = line.split('|').map(s => s.trim());
          if (parts.length >= 3) {
            youtubeId = parts[0];
            title = parts[1];
            duration = parseInt(parts[2], 10) || 0;
          }
        } 
        // Format 2: youtubeId,title,duration
        else if (line.includes(',')) {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 3) {
            youtubeId = parts[0];
            title = parts[1];
            duration = parseInt(parts[2], 10) || 0;
          }
        }
        // Format 3: Just youtubeId (we'll need to fetch title/duration)
        else {
          youtubeId = line.trim();
          title = `Video ${youtubeId}`;
          duration = 0;
        }
        
        if (youtubeId) {
          videos.push({
            youtubeId,
            title,
            duration,
          });
        }
      }
      
      if (videos.length === 0) {
        alert('No valid videos found. Please check your format.');
        return;
      }
      
      // Create channel document
      const channelData = {
        name: channelName,
        description: channelDesc,
        startTime: Date.now(),
        createdAt: Date.now(),
        type: 'synchronized',
      };
      
      const channelRef = await addDoc(collection(db, 'channels'), channelData);
      
      // Create videos subcollection
      const batch = writeBatch(db);
      videos.forEach((video, index) => {
        const videoRef = doc(collection(db, `channels/${channelRef.id}/videos`));
        batch.set(videoRef, {
          youtubeId: video.youtubeId,
          title: video.title,
          duration: video.duration,
          order: index,
          createdAt: Date.now(),
        });
      });
      
      await batch.commit();
      
      // Reset form
      setChannelName('');
      setChannelDesc('');
      setVideoData('');
      onClose();
      
    } catch (error) {
      console.error("Failed to add channel:", error);
      alert('Failed to create channel. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddVideosToChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !videoData) return;
    
    setIsProcessing(true);
    try {
      const lines = videoData.split('\n').filter(l => l.trim().length > 0);
      const videos = [];
      
      for (const line of lines) {
        let youtubeId = '';
        let title = '';
        let duration = 0;
        
        if (line.includes('|')) {
          const parts = line.split('|').map(s => s.trim());
          if (parts.length >= 3) {
            youtubeId = parts[0];
            title = parts[1];
            duration = parseInt(parts[2], 10) || 0;
          }
        } else if (line.includes(',')) {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 3) {
            youtubeId = parts[0];
            title = parts[1];
            duration = parseInt(parts[2], 10) || 0;
          }
        } else {
          youtubeId = line.trim();
          title = `Video ${youtubeId}`;
          duration = 0;
        }
        
        if (youtubeId) {
          videos.push({ youtubeId, title, duration });
        }
      }
      
      if (videos.length === 0) {
        alert('No valid videos found. Please check your format.');
        return;
      }
      
      const batch = writeBatch(db);
      const currentOrder = channelVideos.length;
      
      videos.forEach((video, index) => {
        const videoRef = doc(collection(db, `channels/${selectedChannel.id}/videos`));
        batch.set(videoRef, {
          youtubeId: video.youtubeId,
          title: video.title,
          duration: video.duration,
          order: currentOrder + index,
          createdAt: Date.now(),
        });
      });
      
      await batch.commit();
      setVideoData('');
      alert(`Successfully added ${videos.length} videos to ${selectedChannel.name}`);
      
    } catch (error) {
      console.error("Failed to add videos:", error);
      alert('Failed to add videos. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateVideo = async (video: Video) => {
    if (!selectedChannel) return;
    
    try {
      const videoRef = doc(db, `channels/${selectedChannel.id}/videos`, video.id);
      await setDoc(videoRef, {
        youtubeId: video.youtubeId,
        title: video.title,
        duration: video.duration,
        order: video.order,
        updatedAt: Date.now(),
      }, { merge: true });
      
      setEditingVideo(null);
    } catch (error) {
      console.error("Failed to update video:", error);
      alert('Failed to update video. Please try again.');
    }
  };

  const generateVideoLink = (youtubeId: string) => {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Settings className="w-5 h-5 text-orange-500" />
            Admin Dashboard
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex p-1 bg-zinc-800 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'create' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Plus className="w-4 h-4" />
            Create Channel
          </button>
          <button
            onClick={() => {
              setActiveTab('manage');
              setSelectedChannel(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'manage' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Settings className="w-4 h-4" />
            Manage Channels ({channels.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('videos');
              setSelectedChannel(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'videos' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Video className="w-4 h-4" />
            Manage Videos
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="space-y-4">
            <form onSubmit={handleAddChannel} className="space-y-4">
              <input
                type="text"
                placeholder="Channel Name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                required
              />
              <textarea
                placeholder="Description"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-orange-500 h-20"
              />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Video Metadata</label>
                  <div className="group relative">
                    <Info className="w-3 h-3 text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] text-zinc-400 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl">
                      <p className="font-bold mb-1">Supported Formats:</p>
                      <p className="font-mono text-orange-500">youtubeId | title | duration</p>
                      <p className="text-xs mt-1">Example: <span className="text-white">dQw4w9WgXcQ | Rick Astley | 212</span></p>
                      <p className="text-xs mt-2">One video per line. Duration in seconds.</p>
                    </div>
                  </div>
                </div>
                <textarea
                  placeholder="youtubeId | title | durationInSeconds&#10;dQw4w9WgXcQ | Rick Astley - Never Gonna Give You Up | 212&#10;8SbUC-UaAxE | Another Video | 180"
                  value={videoData}
                  onChange={(e) => setVideoData(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm font-mono focus:outline-none focus:border-orange-500 h-48"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Channel...</span>
                  </>
                ) : (
                  <>
                    <ListPlus className="w-5 h-5" />
                    <span>Create Channel with Videos</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {channels.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-sm font-bold uppercase tracking-widest">No channels found</p>
              </div>
            ) : (
              channels.map(channel => (
                <div key={channel.id} className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center group hover:border-zinc-700 transition-all">
                  <div>
                    <h3 className="font-bold text-white uppercase tracking-tight">{channel.name}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">
                      {channel.type} • {channel.description || 'No description'}
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-1">
                      Created: {new Date(channel.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                    title="Delete Channel"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Channel</label>
              <select
                value={selectedChannel?.id || ''}
                onChange={(e) => {
                  const channel = channels.find(c => c.id === e.target.value);
                  setSelectedChannel(channel || null);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Select a channel</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>{channel.name}</option>
                ))}
              </select>
            </div>

            {selectedChannel && (
              <>
                <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4">
                  <h3 className="font-bold text-white mb-2">{selectedChannel.name}</h3>
                  <p className="text-sm text-zinc-400">{selectedChannel.description}</p>
                </div>

                <form onSubmit={handleAddVideosToChannel} className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Add Videos to Channel</label>
                    <textarea
                      placeholder="youtubeId | title | durationInSeconds&#10;dQw4w9WgXcQ | Rick Astley - Never Gonna Give You Up | 212"
                      value={videoData}
                      onChange={(e) => setVideoData(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm font-mono focus:outline-none focus:border-orange-500 h-32"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full bg-orange-600 text-white font-bold py-2 rounded-lg hover:bg-orange-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Adding Videos...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add Videos to Channel</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                    Videos in this channel ({channelVideos.length})
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {channelVideos.map(video => (
                      <div key={video.id} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-3">
                        {editingVideo?.id === video.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingVideo.youtubeId}
                              onChange={(e) => setEditingVideo({...editingVideo, youtubeId: e.target.value})}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                              placeholder="YouTube ID"
                            />
                            <input
                              type="text"
                              value={editingVideo.title}
                              onChange={(e) => setEditingVideo({...editingVideo, title: e.target.value})}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                              placeholder="Title"
                            />
                            <input
                              type="number"
                              value={editingVideo.duration}
                              onChange={(e) => setEditingVideo({...editingVideo, duration: parseInt(e.target.value)})}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white text-sm"
                              placeholder="Duration (seconds)"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateVideo(editingVideo)}
                                className="flex-1 bg-green-600 text-white text-xs py-1 rounded hover:bg-green-500"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingVideo(null)}
                                className="flex-1 bg-zinc-600 text-white text-xs py-1 rounded hover:bg-zinc-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Link className="w-3 h-3 text-orange-500" />
                                <a 
                                  href={generateVideoLink(video.youtubeId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-mono text-orange-500 hover:text-orange-400 hover:underline"
                                >
                                  {video.youtubeId}
                                </a>
                              </div>
                              <p className="text-sm text-white mt-1">{video.title}</p>
                              <p className="text-xs text-zinc-500">
                                Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')} • 
                                Order: {video.order}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingVideo(video)}
                                className="p-1 text-zinc-500 hover:text-orange-500 transition-colors"
                                title="Edit Video"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="p-1 text-zinc-500 hover:text-red-500 transition-colors"
                                title="Delete Video"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {channelVideos.length === 0 && (
                      <div className="text-center py-8 text-zinc-500">
                        <p className="text-sm">No videos in this channel yet.</p>
                        <p className="text-xs mt-1">Use the form above to add videos.</p>
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
  );
}