import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, writeBatch, onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Plus, ListPlus, Loader2, X, Trash2, Settings, Info } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { Channel } from '../types';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [videoData, setVideoData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    console.log("AdminPanel mounted");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab !== 'manage') return;

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

  const handleDeleteChannel = async (channelId: string) => {
    if (!window.confirm('Are you sure you want to delete this channel?')) return;
    
    try {
      await deleteDoc(doc(db, 'channels', channelId));
    } catch (error) {
      console.error("Failed to delete channel:", error);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName || !videoData) return;

    setIsProcessing(true);
    try {
      const channelPath = 'channels';
      const channelData: any = {
        name: channelName,
        description: channelDesc,
        startTime: Date.now(),
        createdAt: Date.now(),
        type: 'synchronized',
      };

      const channelRef = await addDoc(collection(db, channelPath), channelData).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, channelPath);
        return null;
      });

      if (!channelRef) return;

      const lines = videoData.split('\n').filter(l => l.trim().length > 0);
      const batch = writeBatch(db);
      
      lines.forEach((line, index) => {
        const [youtubeId, title, duration] = line.split('|').map(s => s.trim());
        if (youtubeId && title && duration) {
          const videoPath = `channels/${channelRef.id}/videos`;
          const videoRef = doc(collection(db, videoPath));
          batch.set(videoRef, {
            youtubeId,
            title,
            duration: parseInt(duration, 10) || 0,
            order: index,
          });
        }
      });

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, `channels/${channelRef.id}/videos`));
      
      setChannelName('');
      setChannelDesc('');
      setVideoData('');
      onClose();
    } catch (error) {
      console.error("Failed to add channel:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
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
            Create
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'manage' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Settings className="w-4 h-4" />
            Manage ({channels.length})
          </button>
        </div>

        {activeTab === 'create' ? (
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
                      Format: <span className="text-orange-500 font-mono">youtubeId | title | durationInSeconds</span>
                      <br />Example: <span className="text-white font-mono">dQw4w9WgXcQ | Rick Astley | 212</span>
                    </div>
                  </div>
                </div>
                <textarea
                  placeholder="youtubeId | title | durationInSeconds"
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
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <ListPlus className="w-5 h-5" />
                    <span>Create Channel</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {channels.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-sm font-bold uppercase tracking-widest">No channels found</p>
              </div>
            ) : (
              channels.map(channel => (
                <div key={channel.id} className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center group hover:border-zinc-700 transition-all">
                  <div>
                    <h3 className="font-bold text-white uppercase tracking-tight">{channel.name}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">{channel.type}</p>
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
      </div>
    </div>
  );
}
