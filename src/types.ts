export interface Channel {
  id: string;
  name: string;
  startTime: number;
  createdAt: number;
  description?: string;
  type: 'synchronized';
}

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  duration: number; // in seconds
  order: number;
}

export interface PlaybackState {
  currentVideo: Video | null;
  offset: number; // in seconds
  nextVideo: Video | null;
}
