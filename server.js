const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('--- Nouvel utilisateur connecté ---');

    // 1. Rejoindre la liste
    socket.on('join', (peerId, gender) => {
        // Nettoyage des anciens IDs pour éviter les doublons
        users = users.filter(u => u.id !== peerId && u.socketId !== socket.id);
        
        socket.peerId = peerId;
        socket.gender = gender || 'non spécifié'; 

        users.push({ 
            id: peerId, 
            gender: socket.gender, 
            socketId: socket.id 
        });
        
        console.log(`Utilisateur ajouté: ${peerId} (${socket.gender}). Total: ${users.length}`);
    });

    // 2. Demander un match
    socket.on('requestNext', () => {
        console.log(`Demande de match de: ${socket.peerId}`);
        
        // On cherche TOUT LE MONDE sauf soi-même
        let potentialMatches = users.filter(u => u.socketId !== socket.id);

        if (potentialMatches.length > 0) {
            // On prend quelqu'un au hasard
            const partner = potentialMatches[Math.floor(Math.random() * potentialMatches.length)];
            
            console.log(`Match trouvé : ${socket.peerId} <-> ${partner.id}`);

            // On envoie les infos aux DEUX pour forcer la connexion PeerJS
            // On envoie au demandeur
            socket.emit('match', { id: partner.id, gender: partner.gender });
            
            // On envoie à la cible (le partenaire trouvé)
            io.to(partner.socketId).emit('match', { id: socket.peerId, gender: socket.gender });
        } else {
            console.log('Match impossible : personne d\'autre en ligne.');
            socket.emit('error', 'Personne en ligne...');
        }
    });

    // 3. Déconnexion
    socket.on('disconnect', () => {
        users = users.filter(u => u.socketId !== socket.id);
        console.log(`Déconnexion. Restants: ${users.length}`);
    });
});
