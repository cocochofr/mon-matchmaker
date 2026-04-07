const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server, { cors: { origin: "*" } });

// On stocke les utilisateurs connectés : { pseudo: socketId, peerId: peerId }
let onlineUsers = {}; 

io.on('connection', (socket) => {
    console.log('Connexion:', socket.id);

    // 1. S'enregistrer avec un Pseudo
    socket.on('register_user', (pseudo, peerId) => {
        socket.pseudo = pseudo;
        socket.peerId = peerId;
        onlineUsers[pseudo] = { socketId: socket.id, peerId: peerId };
        console.log(`${pseudo} est en ligne.`);
        socket.emit('status_update', `Connecté en tant que ${pseudo}`);
    });

    // 2. Chat Aléatoire (existant)
    socket.on('requestNext', () => {
        const others = Object.keys(onlineUsers).filter(p => p !== socket.pseudo);
        if (others.length > 0) {
            const partnerPseudo = others[Math.floor(Math.random() * others.length)];
            const partner = onlineUsers[partnerPseudo];
            socket.emit('match', { id: partner.peerId, pseudo: partnerPseudo });
        } else {
            socket.emit('error', 'Personne de disponible...');
        }
    });

    // 3. Message Privé / Ajouter Ami
    socket.on('private_message', ({ toPseudo, message }) => {
        const target = onlineUsers[toPseudo];
        if (target) {
            io.to(target.socketId).emit('new_private_msg', {
                from: socket.pseudo,
                message: message,
                peerId: socket.peerId // Pour pouvoir lancer un appel vidéo direct
            });
        } else {
            socket.emit('error', 'Utilisateur hors ligne');
        }
    });

    socket.on('disconnect', () => {
        if (socket.pseudo) {
            delete onlineUsers[socket.pseudo];
            console.log(`${socket.pseudo} est parti.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur Social sur port ${PORT}`));
