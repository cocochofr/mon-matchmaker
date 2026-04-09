const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Autorise toutes les provenances (Hostinger, local, etc.)
    methods: ["GET", "POST"]
  }
});

let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('✨ Nouveau visiteur connecté :', socket.id);

  socket.on('requestNext', (data) => {
    console.log(`🔎 Recherche pour ${socket.id} (PeerID: ${data.peerId})`);

    // 1. On nettoie si l'utilisateur était déjà dans la liste
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);

    // 2. On cherche un partenaire (n'importe qui d'autre que soi-même)
    const partner = waitingUsers.find(u => u.socketId !== socket.id);

    if (partner) {
      console.log(`💎 MATCH TROUVÉ : ${socket.id} <-> ${partner.socketId}`);
      
      // On retire le partenaire de la liste d'attente
      waitingUsers = waitingUsers.filter(u => u.socketId !== partner.socketId);

      // On envoie les infos de connexion aux deux
      io.to(socket.id).emit('matched', {
        remotePeerId: partner.peerId,
        matchedPseudo: partner.userId || 'Anonyme'
      });

      io.to(partner.socketId).emit('matched', {
        remotePeerId: data.peerId,
        matchedPseudo: data.userId || 'Anonyme'
      });
    } else {
      // Personne de libre ? On s'ajoute à la liste
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

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
    console.log('❌ Visiteur déconnecté :', socket.id);
  });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
  console.log(`🚀 Serveur Cococho opérationnel sur le port ${PORT}`);
});
