const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('✨ Nouveau visiteur connecté :', socket.id);

  socket.on('requestNext', (data) => {
    console.log(`🔎 Recherche pour ${socket.id} (PeerID: ${data.peerId})`);

    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
    const partner = waitingUsers.find(u => u.socketId !== socket.id);

    if (partner) {
      console.log(`💎 MATCH TROUVÉ : ${socket.id} <-> ${partner.socketId}`);
      
      waitingUsers = waitingUsers.filter(u => u.socketId !== partner.socketId);

      // IMPORTANT : On envoie aussi le remoteSocketId pour que le chat sache où envoyer les messages
      io.to(socket.id).emit('matched', {
        remotePeerId: partner.peerId,
        remoteSocketId: partner.socketId,
        matchedPseudo: partner.userId || 'Anonyme'
      });

      io.to(partner.socketId).emit('matched', {
        remotePeerId: data.peerId,
        remoteSocketId: socket.id,
        matchedPseudo: data.userId || 'Anonyme'
      });
    } else {
      console.log(`⏳ ${socket.id} mis en attente...`);
      waitingUsers.push({
        socketId: socket.id,
        peerId: data.peerId,
        userId: data.userId,
        gender: data.gender,
        filter: data.filter
      });
    }
  });

  // --- SECTION CHAT TEXTUEL (AJOUTÉE) ---
  socket.on('send_message', (data) => {
    // data doit contenir : { text, recipientSocketId }
    if (data.recipientSocketId) {
      console.log(`✉️ Message de ${socket.id} vers ${data.recipientSocketId}`);
      io.to(data.recipientSocketId).emit('receive_message', {
        text: data.text,
        sender: 'partner',
        id: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
    console.log('❌ Visiteur déconnecté :', socket.id);
  });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
  console.log(`🚀 Serveur Cococho opérationnel avec Chat sur le port ${PORT}`);
});
