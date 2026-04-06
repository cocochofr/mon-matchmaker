import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Phone, ArrowRight, Flag, ChevronRight, MessageSquare } from 'lucide-react';

const VideoChatPage = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const currentCallRef = useRef(null);

  const [status, setStatus] = useState("Initialisation...");
  const [myGender, setMyGender] = useState(null); 
  const [remoteGender, setRemoteGender] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const RENDER_URL = "https://cam-match-66.onrender.com";

  useEffect(() => {
    if (!myGender) return;

    // 1. Initialisation Socket
    socketRef.current = window.io(RENDER_URL);

    // 2. Initialisation PeerJS avec serveurs STUN de Google (Crucial pour la stabilité)
    peerRef.current = new window.Peer({
      config: {
        'iceServers': [
          { url: 'stun:stun.l.google.com:19302' },
          { url: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        peerRef.current.on('open', (id) => {
          setStatus("Connecté au réseau");
          socketRef.current.emit('join', id, myGender);
        });

        peerRef.current.on('call', (call) => {
          console.log("Appel entrant reçu");
          call.answer(stream);
          setupCall(call);
        });
      })
      .catch(() => setStatus("Erreur Caméra"));

    // 3. Réception du Match
    socketRef.current.on('match', (data) => {
      if (data && data.id) {
        setRemoteGender(data.gender);
        setStatus("Partenaire trouvé !");
        
        const localStream = localVideoRef.current?.srcObject;
        if (localStream) {
          // On attend un court délai pour laisser le partenaire se préparer
          setTimeout(() => {
            const call = peerRef.current.call(data.id, localStream);
            setupCall(call);
          }, 500);
        }
      }
    });

    socketRef.current.on('error', (m) => setStatus(m));

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [myGender]);

  const setupCall = (call) => {
    call.on('stream', (s) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = s;
    });
    currentCallRef.current = call;
  };

  const handleNext = () => {
    if (currentCallRef.current) currentCallRef.current.close();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteGender(null);
    setStatus("Recherche...");
    socketRef.current.emit('requestNext');
  };

  return (
    <>
      <Helmet><title>Cococho - Live</title></Helmet>
      
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95">
          <div className="bg-[#111] p-10 rounded-[30px] border border-white/10 text-center max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-3xl font-black text-purple-500 mb-8 italic italic">COCOCHO</h2>
            <div className="flex flex-col gap-4">
              <button onClick={() => { setMyGender('homme'); setShowModal(false); }} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold uppercase tracking-widest active:scale-95 transition-all">Homme</button>
              <button onClick={() => { setMyGender('femme'); setShowModal(false); }} className="w-full bg-pink-600 text-white py-5 rounded-2xl font-bold uppercase tracking-widest active:scale-95 transition-all">Femme</button>
            </div>
          </div>
        </div>
      )}

      <main className="relative w-full h-[100dvh] bg-black overflow-hidden">
        {remoteGender && (
          <div className={`absolute top-8 left-8 z-40 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl ${remoteGender === 'femme' ? 'bg-pink-600 text-white' : 'bg-blue-600 text-white'}`}>
            {remoteGender}
          </div>
        )}

        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-white text-[10px] font-bold uppercase tracking-widest border border-white/5">
          {status}
        </div>

        <div className="absolute inset-0 w-full h-full bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        </div>

        <div className="absolute bottom-32 right-8 z-20 w-36 md:w-60 aspect-video rounded-3xl border border-white/10 shadow-2xl overflow-hidden bg-[#111]">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 w-full justify-center px-6">
          <button onClick={() => window.location.reload()} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl"><Phone className="rotate-[135deg]" /></button>
          <button onClick={handleNext} className="flex-1 max-w-[300px] bg-white text-black font-black py-5 rounded-full shadow-2xl text-lg uppercase">Suivant</button>
          <button onClick={() => { alert("Signalé"); handleNext(); }} className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-white shadow-2xl"><Flag /></button>
        </div>
      </main>
    </>
  );
};

export default VideoChatPage;
