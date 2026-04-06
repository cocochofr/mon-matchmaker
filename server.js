const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('Nouveau socket connecté:', socket.id);

    // Quand l'utilisateur rejoint
    socket.on('join', (peerId, gender) => {
        // Nettoyage pour éviter les doublons
        users = users.filter(u => u.socketId !== socket.id);
        
        users.push({ 
            id: peerId, 
            gender: gender || 'non spécifié', 
            socketId: socket.id 
        });
        socket.peerId = peerId;
        socket.gender = gender;
        console.log(`Utilisateur prêt: ${peerId}. Total: ${users.length}`);
    });

    // Quand l'utilisateur clique sur "Suivant"
    socket.on('requestNext', () => {
        const others = users.filter(u => u.socketId !== socket.id);
        if (others.length > 0) {
            const partner = others[Math.floor(Math.random() * others.length)];
            
            // On envoie le match aux deux
            socket.emit('match', { id: partner.id, gender: partner.gender });
            io.to(partner.socketId).emit('match', { id: socket.peerId, gender: socket.gender });
        } else {
            socket.emit('error', 'Personne en ligne...');
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(u => u.socketId !== socket.id);
        console.log('Déconnexion, reste:', users.length);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
