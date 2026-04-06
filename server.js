const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket');

    // 1. L'utilisateur rejoint avec son ID Peer et son sexe
    socket.on('join', (peerId, gender) => {
        // Sécurité : on évite les doublons
        users = users.filter(u => u.id !== peerId);
        
        socket.peerId = peerId;
        socket.gender = gender || 'non spécifié'; 

        users.push({ 
            id: peerId, 
            gender: socket.gender, 
            socketId: socket.id 
        });
        
        console.log(`Utilisateur ${peerId} est un ${socket.gender}. (Total: ${users.length})`);
    });

    // 2. L'utilisateur demande un nouveau partenaire
    socket.on('requestNext', () => {
        // Filtre pour ne pas tomber sur soi-même
        let potentialMatches = users.filter(u => u.socketId !== socket.id);

        if (potentialMatches.length > 0) {
            // Choix aléatoire
            const randomUser = potentialMatches[Math.floor(Math.random() * potentialMatches.length)];
            
            // ON ENVOIE L'OBJET AVEC ID ET GENDER AU PARTENAIRE
            console.log(`Matching ${socket.peerId} avec ${randomUser.id} (${randomUser.gender})`);
            socket.emit('match', { 
                id: randomUser.id, 
                gender: randomUser.gender 
            });
        } else {
            socket.emit('error', 'Personne en ligne...');
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(u => u.socketId !== socket.id);
        console.log(`Déconnexion. (Restants: ${users.length})`);
    });
});
