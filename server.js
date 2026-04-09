const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('Nouveau visiteur :', socket.id);

  socket.on('requestNext', (data) => {
    console.log(`Recherche de match pour : ${socket.id} (Genre: ${data.gender})`);

    // 1. Nettoyage : on retire l'utilisateur s'il était déjà dans la file
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);

    // 2. Tentative de matching (on prend le premier disponible qui n'est pas nous)
    const partner = waitingUsers.find(u => u.socketId !== socket.id);

    if (partner) {
      console.log(`💎 MATCH : ${socket.id} <-> ${partner.socketId}`);
      
      // On retire le partenaire de la file
      waitingUsers = waitingUsers.filter(u => u.socketId !== partner.socketId);

      // On informe le demandeur
      io.to(socket.id).emit('matched', {
        remotePeerId: partner.peerId,
        matchedPseudo: partner.userId,
        matchedGender: partner.gender
      });

      // On informe le partenaire
      io.to(partner.socketId).emit('matched', {
        remotePeerId: data.peerId,
        matchedPseudo: data.userId,
        matchedGender: data.gender
      });
    } else {
      // Personne de libre, on s'ajoute à la liste
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

  socket.on('leave', () => {
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
  });

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
    console.log('Visiteur déconnecté :', socket.id);
  });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => console.log(`🚀 Serveur prêt sur le port ${PORT}`));
