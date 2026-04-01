// In your main app component
import { TVGuide } from './components/TVGuide';

// State for showing guide
const [showGuide, setShowGuide] = useState(false);

// When user clicks "TV Guide" button
<TVGuide 
  currentChannel={currentChannel}
  allChannels={channels}
  videos={videos}
  onChannelSelect={(channel) => {
    setCurrentChannel(channel);
    // Update player with new channel
  }}
  onClose={() => setShowGuide(false)}
/>