const io = require('socket.io')(process.env.PORT || 3000, {
    cors: { origin: "*" }
});

let users = [];

io.on('connection', (socket) => {
    console.log('Un utilisateur arrive');

    // Quand l'utilisateur rejoint avec son ID PeerJS et son genre
    socket.on('join', (peerId, gender) => {
        socket.peerId = peerId;
        socket.gender = gender; 
        users.push({ id: peerId, gender: gender, socketId: socket.id });
        console.log(`Utilisateur ${peerId} (${gender}) ajouté.`);
    });

    // Quand l'utilisateur clique sur "SUIVANT"
    socket.on('requestNext', (targetGender) => {
        // On cherche les autres, sauf nous-même
        let potentialMatches = users.filter(u => u.socketId !== socket.id);

        // Si l'utilisateur est Premium et veut des filles
        if (targetGender === 'female') {
            potentialMatches = potentialMatches.filter(u => u.gender === 'female');
        }

        if (potentialMatches.length > 0) {
            const randomUser = potentialMatches[Math.floor(Math.random() * potentialMatches.length)];
            socket.emit('match', randomUser.id);
        } else {
            socket.emit('error', 'Personne de disponible...');
        }
    });

    // Quand quelqu'un part
    socket.on('disconnect', () => {
        users = users.filter(u => u.socketId !== socket.id);
        console.log('Un utilisateur est parti');
    });
});
