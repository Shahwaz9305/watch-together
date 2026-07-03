import React, { useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';

function App() {
  // Pull existing session data from localStorage if they hit refresh
  const [currentRoom, setCurrentRoom] = useState(() => localStorage.getItem("wt_room") || null);
  const [username, setUsername] = useState(() => localStorage.getItem("wt_username") || "");
  const [isCreator, setIsCreator] = useState(() => localStorage.getItem("wt_isCreator") === "true");
  
  const [roomInput, setRoomInput] = useState("");

  // --- 2. CUSTOM ERROR TOAST FUNCTION ---
  const showError = (msg) => {
    Swal.fire({
      icon: 'warning',
      title: 'Hold up!',
      text: msg,
      background: '#1e293b', // Matches your dark theme
      color: '#f8fafc',
      confirmButtonColor: '#38bdf8',
      customClass: { popup: 'rounded-4' } // Rounded corners
    });
  };
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!username.trim()) return showError("Please enter your name first!");
    
    const code = roomInput.trim().toUpperCase();
    if (code.length > 0) {
      // Save data locally so it survives a page refresh
      localStorage.setItem("wt_room", code);
      localStorage.setItem("wt_username", username.trim());
      localStorage.setItem("wt_isCreator", "false"); // They joined, they didn't create
      
      setCurrentRoom(code);
      setIsCreator(false);
    }
  };

  const handleCreateRoom = () => {
    if (!username.trim()) return showError("Please enter your name first!");
    
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Save data locally 
    localStorage.setItem("wt_room", randomCode);
    localStorage.setItem("wt_username", username.trim());
    localStorage.setItem("wt_isCreator", "true"); // Mark as creator
    
    setCurrentRoom(randomCode);
    setIsCreator(true);
  };

  const handleLeave = () => {
    // Clear the memory when they explicitly leave
    localStorage.removeItem("wt_room");
    localStorage.removeItem("wt_isCreator");
    setCurrentRoom(null);
  };

  if (currentRoom && username.trim()) {
    return (
      <VideoPlayer 
        roomId={currentRoom} 
        username={username.trim()} 
        isCreator={isCreator} 
        onLeave={handleLeave} 
      />
    );
  }

  return (
    <div 
      className="container-fluid min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#f8fafc' }}
    >
      <div 
        className="card border-0 shadow-lg p-5 text-center"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)', borderRadius: '1.5rem', maxWidth: '450px', width: '100%' }}
      >
        <h1 className="fw-bolder mb-4 text-white" style={{ letterSpacing: '-1px', fontSize: '2.5rem' }}>
          Watch<span style={{ color: '#38bdf8' }}>Together</span>
        </h1>
        
        <p className="mb-4" style={{ color: '#cbd5e1' }}>
          Enter your name, then create or join a room.
        </p>

        <div className="mb-4">
          <input 
            type="text" 
            className="form-control form-control-lg bg-dark text-light border-secondary text-center shadow-none" 
            placeholder="Enter your name..." 
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              localStorage.setItem("wt_username", e.target.value);
            }}
            style={{ borderRadius: '1rem' }}
          />
        </div>

        <button 
          onClick={handleCreateRoom}
          className="btn btn-lg w-100 fw-bold text-white mb-4 shadow-sm"
          style={{ backgroundColor: username.trim() ? '#38bdf8' : '#64748b', borderRadius: '1rem', transition: '0.3s' }}
          disabled={!username.trim()}
        >
          ✨ Create New Room
        </button>

        <div className="d-flex align-items-center mb-4">
          <hr className="flex-grow-1 border-secondary" />
          <span className="mx-3" style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>OR</span>
          <hr className="flex-grow-1 border-secondary" />
        </div>

        <form onSubmit={handleJoinRoom}>
          <div className="input-group input-group-lg mb-3">
            <input 
              type="text" 
              className="form-control bg-dark text-light border-secondary text-center fw-bold shadow-none" 
              placeholder="ROOM CODE" 
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              style={{ borderRadius: '1rem 0 0 1rem', letterSpacing: '2px', textTransform: 'uppercase' }}
              maxLength={8}
              disabled={!username.trim()}
            />
            <button 
              className="btn px-4 fw-bold text-white" 
              type="submit"
              style={{ backgroundColor: (username.trim() && roomInput.trim()) ? '#10b981' : '#64748b', borderRadius: '0 1rem 1rem 0', transition: '0.3s' }}
              disabled={!username.trim() || !roomInput.trim()}
            >
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;