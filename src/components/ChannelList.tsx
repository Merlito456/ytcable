import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Channel } from '../types';
import { cn } from '../lib/utils';
import { Tv } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { motion } from 'motion/react';

interface ChannelListProps {
  selectedChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
}

export function ChannelList({ selectedChannelId, onSelectChannel }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = 'channels';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelData: Channel[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Channel));
      setChannels(channelData);
      setLoading(false);
      if (channelData.length > 0 && !selectedChannelId) {
        onSelectChannel(channelData[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [selectedChannelId, onSelectChannel]);

  if (loading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="min-w-[240px] h-32 bg-white/5 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 md:gap-4">
      <div className="px-4 md:px-8">
        <h3 className="text-[10px] md:text-xs font-black text-white/40 uppercase tracking-[0.2em]">Live Channels</h3>
      </div>
      <div className="flex gap-3 md:gap-4 px-4 md:px-8 pb-4 md:pb-0 overflow-x-auto scrollbar-hide snap-x">
        {channels.map((channel) => (
          <motion.button
            key={channel.id}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectChannel(channel)}
            className={cn(
              "group relative min-w-[200px] md:min-w-[280px] aspect-video rounded-xl md:rounded-2xl transition-all duration-500 text-left overflow-hidden snap-start",
              selectedChannelId === channel.id
                ? "ring-2 md:ring-4 ring-orange-500 ring-offset-2 md:ring-offset-4 ring-offset-black shadow-2xl shadow-orange-500/20"
                : "bg-white/5 hover:bg-white/10"
            )}
          >
            {/* Channel Card Content */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-end">
              <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <div className={cn(
                  "w-6 h-6 md:w-8 md:h-8 rounded-md md:rounded-lg flex items-center justify-center",
                  selectedChannelId === channel.id ? "bg-orange-500" : "bg-white/10"
                )}>
                  <Tv className="w-3 h-3 md:w-4 md:h-4 text-white" />
                </div>
                <h4 className="font-black text-sm md:text-lg text-white tracking-tight truncate">{channel.name}</h4>
              </div>
              <p className="text-[10px] md:text-xs text-white/60 line-clamp-1">
                {channel.description || 'Synchronized Stream'}
              </p>
            </div>

            {selectedChannelId === channel.id && (
              <div className="absolute top-3 right-3 md:top-4 md:right-4 flex items-center gap-1 md:gap-1.5 bg-orange-500 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
                <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-white rounded-full animate-pulse" />
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white">Live</span>
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
