const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('Nouveau client connecté id:', socket.id);

    socket.on('join', (peerId, gender) => {
        // On nettoie les anciens
        users = users.filter(u => u.socketId !== socket.id);
        
        const newUser = { 
            id: peerId, 
            gender: gender || 'inconnu', 
            socketId: socket.id 
        };
        
        users.push(newUser);
        socket.peerId = peerId;
        socket.gender = gender;
        console.log(`Utilisateur prêt: ${peerId}. Total en ligne: ${users.length}`);
        
        // On confirme au client qu'il est bien enregistré
        socket.emit('status_update', `Enregistré sur le serveur (${users.length} en ligne)`);
    });

    socket.on('requestNext', () => {
        // On cherche n'importe qui sauf soi-même
        const others = users.filter(u => u.socketId !== socket.id);

        if (others.length > 0) {
            const partner = others[Math.floor(Math.random() * others.length)];
            console.log(`MATCH FORCE: ${socket.peerId} <-> ${partner.id}`);

            // On envoie le match aux DEUX pour être sûr que la connexion P2P tente de s'établir
            socket.emit('match', { id: partner.id, gender: partner.gender });
            io.to(partner.socketId).emit('match', { id: socket.peerId, gender: socket.gender });
        } else {
            socket.emit('error', 'Tu es seul pour l\'instant...');
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(u => u.socketId !== socket.id);
        console.log('Déconnexion, reste:', users.length);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur actif sur le port ${PORT}`);
});
