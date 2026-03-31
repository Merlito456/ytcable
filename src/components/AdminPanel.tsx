import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { processYoutubeLinks, suggestChannelContent } from '../services/geminiService';
import { Plus, Wand2, ListPlus, Loader2, X } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [videoLinks, setVideoLinks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestTopic, setSuggestTopic] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName) return;

    setIsProcessing(true);
    try {
      const links = videoLinks.split('\n').filter(l => l.trim().length > 0);
      const videoInfos = await processYoutubeLinks(links);

      const channelPath = 'channels';
      const channelRef = await addDoc(collection(db, channelPath), {
        name: channelName,
        description: channelDesc,
        startTime: Date.now(),
        createdAt: Date.now(),
      }).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, channelPath);
        return null;
      });

      if (!channelRef) return;

      const batch = writeBatch(db);
      videoInfos.forEach((v, index) => {
        const videoPath = `channels/${channelRef.id}/videos`;
        const videoRef = doc(collection(db, videoPath));
        batch.set(videoRef, {
          ...v,
          order: index,
        });
      });

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, `channels/${channelRef.id}/videos`));
      
      setChannelName('');
      setChannelDesc('');
      setVideoLinks('');
      onClose();
    } catch (error) {
      console.error("Failed to add channel:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAISuggest = async () => {
    if (!suggestTopic) return;
    setIsProcessing(true);
    try {
      const suggestions = await suggestChannelContent(suggestTopic);
      setChannelName(suggestTopic);
      setChannelDesc(`AI-generated channel about ${suggestTopic}`);
      setVideoLinks(suggestions.map(s => `https://www.youtube.com/watch?v=${s.youtubeId}`).join('\n'));
    } catch (error) {
      console.error("AI suggestion failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Plus className="w-5 h-5 text-orange-500" />
            New Channel
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="AI Topic (e.g. Anime, News)"
              value={suggestTopic}
              onChange={(e) => setSuggestTopic(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleAISuggest}
              disabled={isProcessing}
              className="bg-zinc-800 text-orange-500 p-2 rounded-lg hover:bg-zinc-700 transition-all disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            </button>
          </div>

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
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">YouTube Links (One per line)</label>
              <textarea
                placeholder="https://youtube.com/watch?v=..."
                value={videoLinks}
                onChange={(e) => setVideoLinks(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-sm font-mono focus:outline-none focus:border-orange-500 h-32"
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
                  <span>Processing with AI...</span>
                </>
              ) : (
                <>
                  <ListPlus className="w-5 h-5" />
                  <span>Create & Sync</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
