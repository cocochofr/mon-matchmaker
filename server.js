const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('✨ Connecté :', socket.id);

  socket.on('requestNext', (data) => {
    // Nettoyage : on s'assure qu'il n'est plus dans la file d'attente
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);

    const partner = waitingUsers.find(u => u.socketId !== socket.id);

    if (partner) {
      console.log(`💎 MATCH : ${socket.id} <-> ${partner.socketId}`);
      waitingUsers = waitingUsers.filter(u => u.socketId !== partner.socketId);

      // On crée le lien de binôme sur le serveur pour le Auto-Next
      socket.partnerId = partner.socketId;
      const partnerSocket = io.sockets.sockets.get(partner.socketId);
      if (partnerSocket) partnerSocket.partnerId = socket.id;

      // Envoi des IDs
      io.to(socket.id).emit('matched', {
        remotePeerId: partner.peerId,
        remoteSocketId: partner.socketId,
        matchedPseudo: partner.userId
      });

      io.to(partner.socketId).emit('matched', {
        remotePeerId: data.peerId,
        remoteSocketId: socket.id,
        matchedPseudo: data.userId
      });
    } else {
      waitingUsers.push({
        socketId: socket.id,
        peerId: data.peerId,
        userId: data.userId
      });
    }
  });

  socket.on('send_message', (data) => {
    if (data.recipientSocketId) {
      io.to(data.recipientSocketId).emit('receive_message', {
        text: data.text,
        senderPseudo: data.senderPseudo,
        timestamp: data.timestamp
      });
    }
  });

  // GESTION DU DÉPART (AUTO-NEXT TRIGGER)
  socket.on('disconnect', () => {
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('partner_disconnected');
    }
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
  });

  socket.on('leave', () => {
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('partner_disconnected');
      socket.partnerId = null;
    }
  });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
