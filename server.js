const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('Nouveau client connecté:', socket.id);

    // L'utilisateur rejoint la file d'attente
    socket.on('join', (peerId, gender) => {
        users = users.filter(u => u.socketId !== socket.id);
        users.push({ 
            id: peerId, 
            gender: gender || 'inconnu', 
            socketId: socket.id 
        });
        socket.peerId = peerId;
        socket.gender = gender;
        console.log(`Utilisateur prêt: ${peerId}. Total en ligne: ${users.length}`);
    });

    // L'utilisateur demande le partenaire suivant
    socket.on('requestNext', () => {
        console.log(`Demande de match de: ${socket.peerId}`);
        const others = users.filter(u => u.socketId !== socket.id);

        if (others.length > 0) {
            const partner = others[Math.floor(Math.random() * others.length)];
            console.log(`Match trouvé: ${socket.peerId} <-> ${partner.id}`);

            // On envoie les infos de connexion aux DEUX
            socket.emit('match', { id: partner.id, gender: partner.gender });
            io.to(partner.socketId).emit('match', { id: socket.peerId, gender: socket.gender });
        } else {
            socket.emit('error', 'En attente d\'un partenaire...');
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
