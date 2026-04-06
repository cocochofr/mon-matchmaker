const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('Nouveau socket connecté:', socket.id);

    // 1. L'utilisateur s'enregistre
    socket.on('join', (peerId, gender) => {
        // Nettoyage pour éviter les doublons sur le même socket
        users = users.filter(u => u.socketId !== socket.id);
        
        const newUser = { 
            id: peerId, 
            gender: gender || 'non spécifié', 
            socketId: socket.id 
        };
        
        users.push(newUser);
        socket.peerId = peerId;
        socket.gender = gender;
        
        console.log(`Utilisateur ${peerId} (${gender}) prêt. Total: ${users.length}`);
    });

    // 2. Logique de Matching
    socket.on('requestNext', () => {
        console.log(`Demande de match de ${socket.peerId}`);
        
        // On cherche quelqu'un d'autre que soi-même
        const partner = users.find(u => u.socketId !== socket.id);

        if (partner) {
            console.log(`Match trouvé: ${socket.peerId} <-> ${partner.id}`);
            
            // On envoie l'info aux DEUX pour que la connexion PeerJS s'établisse
            // On informe le demandeur
            socket.emit('match', { 
                id: partner.id, 
                gender: partner.gender 
            });

            // On informe aussi le partenaire (pour qu'il se prépare à recevoir l'appel)
            io.to(partner.socketId).emit('match', { 
                id: socket.peerId, 
                gender: socket.gender 
            });
        } else {
            console.log("Aucun partenaire disponible pour le moment.");
            socket.emit('error', 'Personne en ligne...');
        }
    });

    // 3. Déconnexion
    socket.on('disconnect', () => {
        users = users.filter(u => u.socketId !== socket.id);
        console.log('Un utilisateur est parti. Restants:', users.length);
    });
});
