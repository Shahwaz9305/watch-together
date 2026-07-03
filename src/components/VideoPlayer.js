import React, { useRef, useEffect, useState } from 'react';
import { ref, onValue, update, push, remove } from "firebase/database";
import { db } from '../firebaseConfig'; 
import YouTube from 'react-youtube'; 
import Swal from 'sweetalert2';

const VideoPlayer = ({ roomId, username, isCreator, onLeave }) => {
  const videoRef = useRef(null);
  const ignoreNextEvent = useRef(false);
  const chatScrollRef = useRef(null); // New ref to auto-scroll chat
  
  const [videoSrc, setVideoSrc] = useState("https://www.w3schools.com/html/mov_bbb.mp4"); 
  const [inputUrl, setInputUrl] = useState("");
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  // const [myUserId] = useState(() => "User-" + Math.floor(Math.random() * 1000));
  
  const [ytPlayer, setYtPlayer] = useState(null);

  const isYouTube = (url) => {
    if (!url) return false;
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    const videoStateRef = ref(db, `rooms/${roomId}/videoState`);
    
    const unsubscribeVideo = onValue(videoStateRef, (snapshot) => {
      const data = snapshot.val();

// --- 3. UPDATE THE KICK-OUT ALERT ---
      if (data && data.isDeleted) {
        Swal.fire({
          title: 'Room Closed',
          text: 'The creator has ended this room.',
          icon: 'info',
          background: '#1e293b',
          color: '#f8fafc',
          confirmButtonColor: '#38bdf8',
          customClass: { popup: 'rounded-4' },
          allowOutsideClick: false // Forces them to click OK before leaving
        }).then(() => {
          onLeave();
        });
        return;
      }

      if (!data) return;

      if (data.url && data.url !== videoSrc) {
        setVideoSrc(data.url);
      }

      ignoreNextEvent.current = true;

      if (isYouTube(data.url) && ytPlayer) {
        try {
          if (ytPlayer.getIframe && ytPlayer.getIframe()) {
            const currentState = ytPlayer.getPlayerState(); 
            
            if (data.isPlaying && currentState !== 1) {
              ytPlayer.playVideo();
            } else if (!data.isPlaying && currentState !== 2) {
              ytPlayer.pauseVideo();
            }

            if (data.seekTime !== undefined && Math.abs(ytPlayer.getCurrentTime() - data.seekTime) > 1.2) {
              ytPlayer.seekTo(data.seekTime, true);
            }
          }
        } catch (error) {
          console.warn("YouTube player mounting...");
        }
      } 
      else if (!isYouTube(data.url)) {
        const video = videoRef.current;
        if (video) {
          if (data.isPlaying && video.paused) {
            video.play().catch(e => console.log("Autoplay blocked"));
          } else if (!data.isPlaying && !video.paused) {
            video.pause();
          }

          if (data.seekTime !== undefined && Math.abs(video.currentTime - data.seekTime) > 1.2) {
            video.currentTime = data.seekTime;
          }
        }
      }

      setTimeout(() => { ignoreNextEvent.current = false; }, 200);
    });

    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const chatData = snapshot.val();
      if (chatData) {
        const chatArray = Object.values(chatData).sort((a, b) => a.timestamp - b.timestamp);
        setChat(chatArray);
      }
    });

    return () => {
      unsubscribeVideo();
      unsubscribeChat();
    };
  }, [roomId, videoSrc, ytPlayer]);

  // --- JOIN & LEAVE NOTIFICATIONS ---
  useEffect(() => {
    // 1. Send "Join" message when the user enters
    push(ref(db, `rooms/${roomId}/chat`), {
      sender: "System",
      message: `${username} joined the room 👋`,
      timestamp: Date.now()
    });

    // 2. Setup the "Leave" function
    const handleUnload = () => {
      push(ref(db, `rooms/${roomId}/chat`), {
        sender: "System",
        message: `${username} left the room 🚪`,
        timestamp: Date.now()
      });
    };

    // Trigger leave message if they close the browser tab
    window.addEventListener("beforeunload", handleUnload);

    // Trigger leave message if they click the "Leave Room" button
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [roomId, username]);
  // ----------------------------------

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chat]);

  const updateFirebase = (updates) => {
    if (ignoreNextEvent.current) return;
    update(ref(db, `rooms/${roomId}/videoState`), updates);
  };

  const handlePlay = () => updateFirebase({ isPlaying: true });
  const handlePause = () => updateFirebase({ isPlaying: false });
  const handleSeeked = (e) => updateFirebase({ seekTime: e.target.currentTime });

  const handleYtPlay = (e) => {
    if (ignoreNextEvent.current) return;
    updateFirebase({ isPlaying: true, seekTime: e.target.getCurrentTime() });
  };
  
  const handleYtPause = (e) => {
    if (ignoreNextEvent.current) return;
    updateFirebase({ isPlaying: false, seekTime: e.target.getCurrentTime() });
  };

  const handleLoadUrl = (e) => {
    e.preventDefault();
    const cleanUrl = inputUrl.trim();
    if (cleanUrl) {
      updateFirebase({ url: cleanUrl, isPlaying: false, seekTime: 0 });
      setInputUrl("");
    }
  };

const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      push(ref(db, `rooms/${roomId}/chat`), {
        sender: username, // <-- Change this from myUserId to username
        message: message.trim(),
        timestamp: Date.now()
      });
      setMessage("");
    }
  };

 const handleEndRoom = () => {
    Swal.fire({
      title: 'End Room?',
      text: "Are you sure you want to completely delete this room? Everyone will be disconnected.",
      icon: 'warning',
      background: '#1e293b',
      color: '#f8fafc',
      showCancelButton: true,
      confirmButtonColor: '#ef4444', // Bootstrap danger red
      cancelButtonColor: '#64748b',  // Slate grey
      confirmButtonText: 'Yes, end it!',
      customClass: { popup: 'rounded-4' }
    }).then((result) => {
      // This block only runs if they click "Yes, end it!"
      if (result.isConfirmed) {
        update(ref(db, `rooms/${roomId}/videoState`), { isDeleted: true });
        setTimeout(() => {
          remove(ref(db, `rooms/${roomId}`));
          onLeave();
        }, 500);
      }
    });
  };

  // --- ADD THIS COPY FUNCTION ---
  const handleCopyCode = () => {
    // 1. Copy to clipboard
    navigator.clipboard.writeText(roomId);
    
    // 2. Show a sleek, auto-closing Toast notification
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Room code copied to clipboard!',
      showConfirmButton: false,
      timer: 2000,
      background: '#1e293b',
      color: '#f8fafc',
      iconColor: '#38bdf8'
    });
  };

  // --- ADD THIS WHATSAPP SHARE FUNCTION ---
  const handleWhatsAppShare = () => {
    // Create a pre-written message. 
    // Asterisks (*) are used in WhatsApp to make the text bold.
    const message = `Hey! Join my WatchTogether room.\n\nRoom Code: *${roomId}*\n\nEnter this code to sync video and chat with me!`;
    
    // Encode the message so it safely travels through a URL
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in a new browser tab
    window.open(whatsappUrl, '_blank');
  };

return (
    <div 
      className="container-fluid min-vh-100 py-3 d-flex flex-column font-sans-serif" 
      style={{ 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        overflow: 'hidden' // Prevents the whole page from bouncing
      }}
    >
      
      {/* Header Area */}
{/* Header Area */}
      <div className="row mb-3 px-lg-4 align-items-center">
        <div className="col d-flex align-items-center gap-3">
          <h2 className="fw-bolder mb-0 text-white" style={{ letterSpacing: '-0.5px' }}>
            Watch<span style={{ color: '#38bdf8' }}>Together</span>
          </h2>
          
          {/* ROOM BADGE & SHARE BUTTONS */}
          <div className="d-flex align-items-center gap-2">
            <span className="badge rounded-pill bg-success bg-opacity-25 text-success border border-success px-3 py-2" style={{ fontSize: '0.85rem' }}>
              <span className="me-1">●</span> Room: {roomId}
            </span>
            
            <button 
              onClick={handleCopyCode} 
              className="btn btn-sm text-white rounded-pill px-3 shadow-sm"
              style={{ backgroundColor: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8' }}
              title="Copy Room Code"
            >
              📋 Copy
            </button>

            {/* NEW WHATSAPP BUTTON */}
            <button 
              onClick={handleWhatsAppShare} 
              className="btn btn-sm text-white rounded-pill px-3 shadow-sm fw-bold"
              style={{ backgroundColor: '#25D366', border: '1px solid #25D366' }}
              title="Share to WhatsApp"
            >
              💬 WhatsApp
            </button>
          </div>
          
          {/* ROOM CONTROLS (Leave/End) */}
          <div className="ms-auto d-flex gap-2">
            {isCreator && (
              <button 
                onClick={handleEndRoom} 
                className="btn btn-sm btn-danger rounded-pill px-3 fw-bold shadow-sm"
              >
                End Room
              </button>
            )}
            <button 
              onClick={onLeave} 
              className="btn btn-sm btn-outline-secondary text-light rounded-pill px-3 fw-bold"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      <div className="row flex-grow-1 px-lg-4 g-4 mb-3">
        
        {/* Left Column: Controls & Player */}
        <div className="col-lg-8 col-xl-9 d-flex flex-column gap-3">
          
          {/* 1. LOAD URL FORM (Moved to Top so it never gets hidden) */}
          <div 
            className="p-2 rounded-4 shadow-sm" 
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}
          >
            <form onSubmit={handleLoadUrl}>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control bg-transparent text-light border-secondary shadow-none"
                  placeholder="Paste direct MP4 or YouTube link..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  style={{ borderRadius: '0.75rem 0 0 0.75rem' }}
                />
                <button 
                  className="btn text-white px-4 fw-semibold" 
                  type="submit"
                  style={{ backgroundColor: '#38bdf8', borderRadius: '0 0.75rem 0.75rem 0' }}
                >
                  Change Video
                </button>
              </div>
            </form>
          </div>

          {/* 2. THE PLAYER (Constrained height so it doesn't push the page down) */}
          <div 
            className="card bg-black border-0 shadow-lg overflow-hidden flex-grow-1" 
            style={{ borderRadius: '1rem', maxHeight: '75vh' }}
          >
            <div className="ratio ratio-16x9 h-100">
              {isYouTube(videoSrc) ? (
                <YouTube
                  videoId={getYouTubeId(videoSrc)}
                  opts={{ width: '100%', height: '100%', playerVars: { autoplay: 0, controls: 1, modestbranding: 1 } }}
                  onReady={(e) => setYtPlayer(e.target)} 
                  onPlay={handleYtPlay}
                  onPause={handleYtPause}
                />
              ) : (
                <video 
                  ref={videoRef}
                  src={videoSrc}
                  controls 
                  width="100%" 
                  height="100%"
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onSeeked={handleSeeked}
                  style={{ outline: "none", backgroundColor: "#000" }}
                />
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Chat Box */}
        <div className="col-lg-4 col-xl-3 d-flex flex-column">
          <div 
            className="card border-0 shadow-lg d-flex flex-column w-100" 
            style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              backdropFilter: 'blur(12px)',
              borderRadius: '1rem',
              height: 'calc(100vh - 100px)' // Locks chat height to exactly fit the screen
            }}
          >
            {/* Chat Header */}
            <div className="card-header border-bottom border-secondary border-opacity-25 py-3 bg-transparent">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2 text-white">
                👥 Room Chat
              </h6>
            </div>
            
            {/* Chat Messages (This area alone will scroll) */}
            <div 
              className="card-body overflow-auto d-flex flex-column gap-3 p-4 hide-scrollbar" 
              ref={chatScrollRef}
              style={{ flexGrow: 1 }}
            >
              {chat.length === 0 && (
                <div className="text-center text-muted my-auto" style={{ fontSize: '0.9rem' }}>
                  No messages yet. Say hello! 👋
                </div>
              )}
{chat.map((c, i) => {
                // --- NEW: RENDER SYSTEM NOTIFICATIONS ---
                if (c.sender === "System") {
                  return (
                    <div key={i} className="text-center my-1">
                      <span 
                        className="badge rounded-pill px-3 py-2 shadow-sm" 
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'normal' }}
                      >
                        {c.message}
                      </span>
                    </div>
                  );
                }

                // --- EXISTING: RENDER USER MESSAGES ---
                const isMe = c.sender === username;
                return (
                  <div key={i} className={`d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}`}>
                    <small className="mb-1 px-1" style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                      {isMe ? "You" : c.sender}
                    </small>
                    <div 
                      className={`px-3 py-2 text-break shadow-sm ${isMe ? 'text-white' : 'text-light'}`}
                      style={{ 
                        maxWidth: '85%',
                        fontSize: '0.95rem',
                        backgroundColor: isMe ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                        borderRadius: isMe ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0'
                      }}
                    >
                      {c.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chat Input (Locked to bottom) */}
            <div className="card-footer bg-transparent border-top border-secondary border-opacity-25 p-3">
              <form onSubmit={handleSendMessage}>
                <div className="input-group">
                  <input 
                    type="text"
                    className="form-control bg-dark text-light border-0 shadow-none"
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Type a message..." 
                    style={{ borderRadius: '1.5rem 0 0 1.5rem', paddingLeft: '1.25rem' }}
                  />
                  <button 
                    className="btn px-4 fw-bold text-white" 
                    type="submit"
                    style={{ backgroundColor: '#38bdf8', borderRadius: '0 1.5rem 1.5rem 0' }}
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default VideoPlayer;