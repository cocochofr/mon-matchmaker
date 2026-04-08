const http = require('http');
const server = http.createServer();
const io = require('socket.io')(server, {
    cors: {
        origin: "*", // Autorise les connexions depuis Hostinger
        methods: ["GET", "POST"]
    }
});

// Base de données temporaire en mémoire
// Structure : { "Pseudo": { socketId, peerId, gender, isPremium, currentPartner } }
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    // 1. ENREGISTREMENT DE L'UTILISATEUR
    socket.on('register_user', ({ pseudo, peerId, gender, isPremium }) => {
        if (!pseudo || !peerId) return;

        socket.pseudo = pseudo;
        socket.peerId = peerId;
        socket.gender = gender || 'other';
        socket.isPremium = isPremium || false;

        onlineUsers[pseudo] = {
            socketId: socket.id,
            peerId: peerId,
            gender: socket.gender,
            isPremium: socket.isPremium,
            currentPartner: null
        };

        console.log(`✅ ${pseudo} (${socket.gender}) est en ligne. Premium: ${socket.isPremium}`);
        socket.emit('status_update', `Bienvenue ${pseudo}, vous êtes prêt.`);
    });

    // 2. LOGIQUE DE MATCHING (ALÉATOIRE + FILTRE PREMIUM)
    socket.on('requestNext', (filter) => {
        if (!socket.pseudo) return;

        // On cherche des partenaires disponibles (pas soi-même et pas déjà en chat)
        let candidates = Object.keys(onlineUsers).filter(p => 
            p !== socket.pseudo && onlineUsers[p].currentPartner === null
        );

        // Application du filtre si l'utilisateur est Premium
        if (socket.isPremium && filter && filter !== 'all') {
            candidates = candidates.filter(p => onlineUsers[p].gender === filter);
        }

        if (candidates.length > 0) {
            // Sélection aléatoire d'un partenaire parmi les candidats
            const partnerPseudo = candidates[Math.floor(Math.random() * candidates.length)];
            const partner = onlineUsers[partnerPseudo];

            // Mise à jour des statuts pour éviter qu'ils soient matchés ailleurs
            onlineUsers[socket.pseudo].currentPartner = partnerPseudo;
            onlineUsers[partnerPseudo].currentPartner = socket.pseudo;

            // On envoie les infos aux deux utilisateurs
            // Vers l'appelant
            socket.emit('match', {
                id: partner.peerId,
                pseudo: partnerPseudo,
                gender: partner.gender
            });

            // Vers le partenaire trouvé
            io.to(partner.socketId).emit('match', {
                id: socket.peerId,
                pseudo: socket.pseudo,
                gender: socket.gender
            });

            console.log(`🔗 Match: ${socket.pseudo} <-> ${partnerPseudo}`);
        } else {
            socket.emit('error', 'Aucun partenaire disponible pour le moment...');
        }
    });

    // 3. MESSAGES PRIVÉS (CHAT TEXTUEL)
    socket.on('private_message', ({ toPseudo, message }) => {
        if (!message || message.trim() === "") return;
        
        const target = onlineUsers[toPseudo];
        if (target) {
            io.to(target.socketId).emit('new_private_msg', {
                from: socket.pseudo,
                message: message.trim(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } else {
            socket.emit('error', "L'utilisateur est déconnecté.");
        }
    });

    // 4. SIGNAL DE FIN DE CHAT (ZAP)
    socket.on('stopChat', () => {
        const myData = onlineUsers[socket.pseudo];
        if (myData && myData.currentPartner) {
            const partner = onlineUsers[myData.currentPartner];
            if (partner) {
                io.to(partner.socketId).emit('partner_disconnected');
                partner.currentPartner = null;
            }
            myData.currentPartner = null;
        }
    });

    // 5. DÉCONNEXION
    socket.on('disconnect', () => {
        if (socket.pseudo) {
            // Si l'utilisateur était en chat, on prévient son partenaire
            const myData = onlineUsers[socket.pseudo];
            if (myData && myData.currentPartner) {
                const partner = onlineUsers[myData.currentPartner];
                if (partner) {
                    io.to(partner.socketId).emit('partner_disconnected');
                    partner.currentPartner = null;
                }
            }
            delete onlineUsers[socket.pseudo];
            console.log(`❌ ${socket.pseudo} a quitté le site.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur Cococho démarré sur le port ${PORT}`);
});


// En haut du fichier, crée un objet pour stocker les bannis
let bannedUsers = {}; // Structure: { "Pseudo": timestamp_fin_ban }

// ... dans io.on('connection', (socket) => { ...

    socket.on('register_user', ({ pseudo, peerId, gender, isPremium }) => {
        // VÉRIFICATION DU BAN
        if (bannedUsers[pseudo] && bannedUsers[pseudo] > Date.now()) {
            const minutesRestantes = Math.ceil((bannedUsers[pseudo] - Date.now()) / 60000);
            return socket.emit('error', `Vous êtes banni pour encore ${minutesRestantes} minutes.`);
        }
        
        // ... reste de ton code register_user ...
        // Initialise le compteur de reports s'il n'existe pas
        if (!onlineUsers[pseudo]) {
            onlineUsers[pseudo] = { ..., reports: 0 };
        }
    });

    socket.on('report_user', ({ targetPseudo }) => {
        const target = onlineUsers[targetPseudo];
        if (target) {
            target.reports = (target.reports || 0) + 1;
            console.log(`⚠️ ${targetPseudo} a reçu un signalement (${target.reports}/15)`);

            if (target.reports >= 15) {
                // BAN DE 2 HEURES
                const duration = 2 * 60 * 60 * 1000; // 2h en millisecondes
                bannedUsers[targetPseudo] = Date.now() + duration;
                
                io.to(target.socketId).emit('error', 'Vous avez été banni pour 2 heures suite à 15 signalements.');
                io.to(target.socketId).emit('partner_disconnected');
                
                // Déconnexion forcée
                const s = io.sockets.sockets.get(target.socketId);
                if (s) s.disconnect();
                
                delete onlineUsers[targetPseudo];
                console.log(`🚫 ${targetPseudo} est banni pour 2h.`);
            } else {
                // Juste un avertissement et zap
                io.to(target.socketId).emit('partner_disconnected');
                socket.emit('status_update', 'Utilisateur signalé. Recherche d\'un nouveau partenaire...');
            }
        }
    });
