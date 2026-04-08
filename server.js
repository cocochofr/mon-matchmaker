const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let onlineUsers = {};
let bannedUsers = {}; // Stockage des bannis : { "Pseudo": timestamp_fin_ban }

io.on('connection', (socket) => {
    console.log('Nouveau visiteur :', socket.id);

    // 1. ENREGISTREMENT
    socket.on('register_user', ({ pseudo, peerId, gender, isPremium }) => {
        if (!pseudo || !peerId) return;

        // VÉRIFICATION DU BAN
        if (bannedUsers[pseudo] && bannedUsers[pseudo] > Date.now()) {
            const minutesRestantes = Math.ceil((bannedUsers[pseudo] - Date.now()) / 60000);
            return socket.emit('error', `Accès refusé. Vous êtes banni pour encore ${minutesRestantes} minutes.`);
        }

        socket.pseudo = pseudo;
        socket.peerId = peerId;
        socket.gender = gender || 'other';
        socket.isPremium = isPremium || false;

        // Initialisation propre de l'utilisateur
        onlineUsers[pseudo] = {
            socketId: socket.id,
            peerId: peerId,
            gender: socket.gender,
            isPremium: socket.isPremium,
            currentPartner: null,
            reports: onlineUsers[pseudo] ? onlineUsers[pseudo].reports : 0 // Garde les reports si reconnexion
        };

        console.log(`✅ ${pseudo} est en ligne. Premium: ${socket.isPremium}`);
    });

    // 2. LOGIQUE DE MATCHING
    socket.on('requestNext', (filter) => {
        if (!socket.pseudo || !onlineUsers[socket.pseudo]) return;

        const myData = onlineUsers[socket.pseudo];
        
        // Libérer le partenaire actuel
        if (myData.currentPartner) {
            const oldPartner = onlineUsers[myData.currentPartner];
            if (oldPartner) {
                io.to(oldPartner.socketId).emit('partner_disconnected');
                oldPartner.currentPartner = null;
            }
            myData.currentPartner = null;
        }

        let candidates = Object.keys(onlineUsers).filter(p => 
            p !== socket.pseudo && onlineUsers[p].currentPartner === null
        );

        if (socket.isPremium && filter && filter !== 'all') {
            candidates = candidates.filter(p => onlineUsers[p].gender === filter);
        }

        if (candidates.length > 0) {
            const partnerPseudo = candidates[Math.floor(Math.random() * candidates.length)];
            const partner = onlineUsers[partnerPseudo];

            onlineUsers[socket.pseudo].currentPartner = partnerPseudo;
            onlineUsers[partnerPseudo].currentPartner = socket.pseudo;

            socket.emit('match', { id: partner.peerId, pseudo: partnerPseudo, gender: partner.gender });
            io.to(partner.socketId).emit('match', { id: socket.peerId, pseudo: socket.pseudo, gender: socket.gender });
        } else {
            socket.emit('error', 'Recherche en cours...');
        }
    });

    // 3. SYSTÈME DE SIGNALEMENT (BAN AUTOMATIQUE)
    socket.on('report_user', ({ targetPseudo }) => {
        const target = onlineUsers[targetPseudo];
        const reporter = onlineUsers[socket.pseudo];

        if (target && reporter) {
            // Un signalement Premium compte pour 3 points, un gratuit pour 1
            const points = reporter.isPremium ? 3 : 1;
            target.reports = (target.reports || 0) + points;
            
            console.log(`⚠️ ${targetPseudo} signalé par ${socket.pseudo} (+${points} pts). Total: ${target.reports}/15`);

            if (target.reports >= 15) {
                const duration = 2 * 60 * 60 * 1000; // 2 heures
                bannedUsers[targetPseudo] = Date.now() + duration;
                
                io.to(target.socketId).emit('error', 'Banni pour 2 heures (limite de signalements atteinte).');
                
                const s = io.sockets.sockets.get(target.socketId);
                if (s) s.disconnect();
                
                delete onlineUsers[targetPseudo];
                console.log(`🚫 BAN : ${targetPseudo} pour 2h.`);
            } else {
                // On sépare les deux immédiatement
                io.to(target.socketId).emit('partner_disconnected');
                socket.emit('status_update', 'Signalement pris en compte.');
            }
        }
    });

    // 4. MESSAGES PRIVÉS
    socket.on('private_message', ({ toPseudo, message }) => {
        const target = onlineUsers[toPseudo];
        if (target && message) {
            io.to(target.socketId).emit('new_private_msg', {
                from: socket.pseudo,
                message: message.trim(),
                time: new Date().toLocaleTimeString()
            });
        }
    });

    // 5. DÉCONNEXION
    socket.on('disconnect', () => {
        if (socket.pseudo) {
            const myData = onlineUsers[socket.pseudo];
            if (myData && myData.currentPartner) {
                const partner = onlineUsers[myData.currentPartner];
                if (partner) io.to(partner.socketId).emit('partner_disconnected');
            }
            delete onlineUsers[socket.pseudo];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur Cococho prêt sur le port ${PORT}`));
