// ========== CONFIGURATION ==========
const API_URL = ''; // Laisser vide car on est à la racine
const DB = new Dexie('VickyfyCache');

// Mettre à jour la version de la base de données
DB.version(3).stores({
    favorites: 'id, title, artist, filename, blob, lyrics, syncedLyrics',
    lyrics: 'id, lyrics, timestamp, synced'
});

let currentView = 'home';
let favoritesSet = new Set();
let currentSongId = null;
let lyricsLines = [];
let currentLineIndex = -1;
let syncInterval = null;
let isAutoScroll = true;
let songDuration = 0;

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎵 Vickyfy chargé');
    await loadFavorites();
    showHome();
    updateStorageInfo();
    registerServiceWorker();
    initAudioEvents();
});

// Initialiser les événements audio
function initAudioEvents() {
    const audio = document.getElementById('audioPlayer');
    
    audio.addEventListener('timeupdate', updateLyricsSync);
    audio.addEventListener('ended', stopLyricsSync);
    audio.addEventListener('pause', () => {
        if (syncInterval) clearInterval(syncInterval);
    });
    audio.addEventListener('play', () => {
        startLyricsSync();
        // Récupérer la durée de la chanson
        if (audio.duration) {
            songDuration = audio.duration;
        }
    });
    audio.addEventListener('loadedmetadata', () => {
        songDuration = audio.duration;
        // Recalculer les timestamps avec la vraie durée
        recalculateTimestamps();
    });
}

// Recalculer les timestamps en fonction de la durée réelle
function recalculateTimestamps() {
    if (!lyricsLines.length || !songDuration) return;
    
    const totalLines = lyricsLines.filter(line => !line.isBreak && line.text.trim()).length;
    let lineIndex = 0;
    
    for (let i = 0; i < lyricsLines.length; i++) {
        const line = lyricsLines[i];
        if (!line.isBreak && line.text.trim()) {
            // Répartir les lignes uniformément sur la durée de la chanson
            const timestamp = (lineIndex / totalLines) * songDuration;
            line.timestamp = timestamp;
            lineIndex++;
        }
    }
    console.log('📊 Timestamps recalculés avec durée:', songDuration, 'secondes');
}

// Synchronisation des paroles basée sur le temps
function updateLyricsSync() {
    const audio = document.getElementById('audioPlayer');
    const currentTime = audio.currentTime;
    
    if (!lyricsLines.length) return;
    
    // Trouver la ligne active basée sur les timestamps
    let activeIndex = -1;
    
    for (let i = 0; i < lyricsLines.length; i++) {
        const line = lyricsLines[i];
        if (line.timestamp !== undefined && currentTime >= line.timestamp) {
            activeIndex = i;
        } else if (line.timestamp !== undefined && currentTime < line.timestamp) {
            break;
        }
    }
    
    // Mettre à jour l'affichage si la ligne a changé
    if (activeIndex !== currentLineIndex && activeIndex >= 0) {
        currentLineIndex = activeIndex;
        highlightCurrentLine(currentLineIndex);
        if (isAutoScroll) {
            autoScrollToLine(currentLineIndex);
        }
    }
}

function startLyricsSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => {
        updateLyricsSync();
    }, 100); // Vérifier toutes les 100ms pour une meilleure précision
}

function stopLyricsSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

function highlightCurrentLine(index) {
    const lines = document.querySelectorAll('.lyrics-line-sync');
    lines.forEach((line, i) => {
        if (i === index) {
            line.classList.add('active-line');
            line.style.background = 'rgba(155, 89, 182, 0.2)';
            line.style.borderLeftColor = '#9b59b6';
            line.style.fontWeight = 'bold';
            line.style.color = '#fff';
            line.style.transform = 'scale(1.02)';
        } else {
            line.classList.remove('active-line');
            line.style.background = '';
            line.style.borderLeftColor = 'transparent';
            line.style.fontWeight = 'normal';
            line.style.color = '#e0e0e0';
            line.style.transform = 'scale(1)';
        }
    });
}

function autoScrollToLine(index) {
    const container = document.querySelector('.lyrics-content');
    if (!container) return;
    
    const activeLine = document.querySelector('.lyrics-line-sync.active-line');
    if (activeLine) {
        activeLine.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

// ========== CHARGEMENT FAVORIS ==========
async function loadFavorites() {
    const favs = await DB.favorites.toArray();
    favoritesSet.clear();
    favs.forEach(f => favoritesSet.add(f.id));
    console.log('⭐ Favoris chargés:', favoritesSet.size);
}

// ========== AFFICHAGE ACCUEIL ==========
async function showHome() {
    currentView = 'home';
    document.getElementById('homeSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('favoritesSection').style.display = 'none';
    
    try {
        const response = await fetch('api/suggestions.php');
        const songs = await response.json();
        console.log('Suggestions:', songs);
        displaySongs(songs, 'suggestionsList');
    } catch (error) {
        console.error('Erreur chargement suggestions:', error);
        document.getElementById('suggestionsList').innerHTML = '<p>❌ Erreur de chargement</p>';
    }
}

// ========== RECHERCHE ==========
async function searchSongs(query) {
    if (query.length < 2) {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('homeSection').style.display = 'block';
        return;
    }
    
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('favoritesSection').style.display = 'none';
    
    try {
        const response = await fetch(`api/search.php?q=${encodeURIComponent(query)}`);
        const songs = await response.json();
        console.log('Résultats recherche:', songs);
        displaySongs(songs, 'resultsList');
    } catch (error) {
        console.error('Erreur recherche:', error);
        document.getElementById('resultsList').innerHTML = '<p>❌ Erreur de recherche</p>';
    }
}

// ========== AFFICHAGE FAVORIS ==========
async function showFavorites() {
    currentView = 'favorites';
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('favoritesSection').style.display = 'block';
    
    const favorites = await DB.favorites.toArray();
    displayFavorites(favorites);
}

function displayFavorites(favorites) {
    const container = document.getElementById('favoritesList');
    if (favorites.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px;">⭐ Aucun favori pour l\'instant. Ajoute des chansons !</p>';
        return;
    }
    
    container.innerHTML = favorites.map(song => `
        <div class="song-card">
            <h3>${escapeHtml(song.title)}</h3>
            <p>${escapeHtml(song.artist)}</p>
            <div class="card-buttons">
                <button class="play-card-btn" onclick="playFavorite('${song.id}')">▶ Jouer</button>
                <button class="lyrics-card-btn" onclick="showLyricsFromCache('${song.id}', '${escapeHtml(song.title)}', '${escapeHtml(song.artist)}')">📝 Paroles</button>
                <button class="fav-card-btn active" onclick="removeFavorite('${song.id}')">⭐ Supprimer</button>
            </div>
        </div>
    `).join('');
}

function displaySongs(songs, containerId) {
    const container = document.getElementById(containerId);
    
    if (!songs || songs.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px;">😢 Aucun résultat</p>';
        return;
    }
    
    container.innerHTML = songs.map(song => `
        <div class="song-card">
            <h3>${escapeHtml(song.title)}</h3>
            <p>${escapeHtml(song.artist)}</p>
            <div class="card-buttons">
                <button class="play-card-btn" onclick="streamSong(${song.id}, '${escapeHtml(song.title)}', '${escapeHtml(song.artist)}', '${escapeHtml(song.filename)}')">▶ Jouer</button>
                <button class="fav-card-btn ${favoritesSet.has(song.id) ? 'active' : ''}" 
                        onclick="toggleFavorite(${song.id}, '${escapeHtml(song.title)}', '${escapeHtml(song.artist)}', '${escapeHtml(song.filename)}')">
                    ${favoritesSet.has(song.id) ? '⭐ Favori' : '☆ Ajouter'}
                </button>
            </div>
        </div>
    `).join('');
}

// ========== LECTURE MUSIQUE ==========
async function streamSong(id, title, artist, filename) {
    console.log('🎵 Lecture de:', title, 'ID:', id);
    currentSongId = id;
    
    document.getElementById('currentTitle').textContent = title;
    document.getElementById('currentArtist').textContent = artist;
    
    const audio = document.getElementById('audioPlayer');
    const songUrl = `api/get_song.php?id=${id}`;
    
    console.log('URL de lecture:', songUrl);
    
    try {
        const testResponse = await fetch(songUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
            console.error('Fichier non trouvé:', testResponse.status);
            showToast('❌ Fichier non trouvé sur le serveur');
            return;
        }
        
        audio.src = songUrl;
        audio.play().catch(e => {
            console.error('Erreur lecture:', e);
            showToast('❌ Impossible de lire la musique');
        });
        
        // Afficher les paroles automatiquement
        await fetchAndShowLyrics(id, title, artist);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion');
    }
}

async function playFavorite(id) {
    const song = await DB.favorites.get(parseInt(id));
    if (song && song.blob) {
        currentSongId = id;
        document.getElementById('currentTitle').textContent = song.title;
        document.getElementById('currentArtist').textContent = song.artist;
        
        const audio = document.getElementById('audioPlayer');
        const url = URL.createObjectURL(song.blob);
        audio.src = url;
        audio.play();
        
        // Afficher les paroles depuis le cache
        await showLyricsFromCache(id, song.title, song.artist);
    } else {
        showToast('❌ Fichier hors ligne non disponible');
    }
}

// ========== SYSTÈME DE PAROLES SYNCHRONISÉES ==========
function parseLyricsWithTimestamps(lyrics) {
    const lines = lyrics.split('\n');
    const parsedLines = [];
    let lineIndex = 0;
    const totalTextLines = lines.filter(l => l.trim() && !l.startsWith('[')).length;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine === '') {
            parsedLines.push({ text: '', isBreak: true });
        } else if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
            // Section title (Couplet, Refrain, etc.)
            parsedLines.push({ 
                text: trimmedLine, 
                isSection: true,
                timestamp: (lineIndex / totalTextLines) * (songDuration || 180)
            });
        } else {
            // Ligne de paroles normale
            const estimatedTime = (lineIndex / totalTextLines) * (songDuration || 180);
            parsedLines.push({ 
                text: trimmedLine, 
                timestamp: estimatedTime,
                lineNumber: lineIndex
            });
            lineIndex++;
        }
    }
    
    console.log('📝 Paroles analysées:', parsedLines.length, 'lignes');
    return parsedLines;
}

async function fetchAndShowLyrics(songId, title, artist) {
    // Attendre que la durée soit disponible
    const audio = document.getElementById('audioPlayer');
    const waitForDuration = setInterval(() => {
        if (audio.duration) {
            songDuration = audio.duration;
            clearInterval(waitForDuration);
        }
    }, 100);
    
    // 1. Vérifier si les paroles sont déjà en cache
    let cached = await getLyricsFromCache(songId);
    let syncedLines = null;
    
    if (cached && cached.synced) {
        console.log('📝 Paroles trouvées en cache');
        syncedLines = cached.synced;
        // Recalculer les timestamps avec la durée réelle
        if (songDuration) {
            recalculateLineTimestamps(syncedLines);
        }
        showSyncedLyricsPanel(title, artist, syncedLines);
        return;
    }
    
    // 2. Sinon, les chercher en ligne
    showSyncedLyricsPanel(title, artist, null, true);
    
    let lyrics = await fetchLyricsOnline(title, artist);
    
    if (!lyrics) {
        lyrics = generateAIFallbackLyrics(title, artist);
    }
    
    // Attendre la durée pour les timestamps
    setTimeout(() => {
        if (audio.duration) {
            songDuration = audio.duration;
        } else {
            songDuration = 180; // Durée par défaut
        }
        
        // Analyser et ajouter des timestamps
        syncedLines = parseLyricsWithTimestamps(lyrics);
        
        // Sauvegarder en cache
        saveLyricsToCache(songId, lyrics, syncedLines);
        
        // Si la chanson est en favoris, sauvegarder aussi dans l'objet favori
        if (favoritesSet.has(songId)) {
            DB.favorites.update(songId, { 
                lyrics: lyrics,
                syncedLyrics: syncedLines
            });
        }
        
        showSyncedLyricsPanel(title, artist, syncedLines);
    }, 500);
}

function recalculateLineTimestamps(lines) {
    const textLines = lines.filter(l => !l.isBreak && !l.isSection && l.text);
    const totalLines = textLines.length;
    
    textLines.forEach((line, idx) => {
        line.timestamp = (idx / totalLines) * songDuration;
    });
}

async function fetchLyricsOnline(title, artist) {
    try {
        const cleanTitle = title.split('(')[0].split('-')[0].split('feat')[0].trim();
        const cleanArtist = artist.split('feat')[0].split(',')[0].trim();
        
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
        const data = await response.json();
        
        if (data.lyrics) {
            console.log('✅ Paroles trouvées en ligne');
            return data.lyrics;
        }
        return null;
    } catch (error) {
        console.log('❌ API lyrics indisponible');
        return null;
    }
}

function generateAIFallbackLyrics(title, artist) {
    console.log('🤖 Génération IA des paroles synchronisées');
    
    return `[Couplet 1]
Dans la lumière de ${title}
Je trouve l'inspiration
Chaque note, chaque mot
Une douce vibration

[Refrain]
${title}, oh ${title}
Tu résonnes dans mon cœur
${artist}, merci pour l'art
Qui nous donne tant de bonheur

[Couplet 2]
La mélodie nous transporte
Vers des rêves infinis
Les paroles sont les portes
D'un univers choisi

[Pont]
Et même sans connexion
La musique vit en nous
Les paroles sont l'émotion
D'un instant si doux

[Refrain]
${title}, oh ${title}
À jamais dans nos pensées
${artist}, ta création
Nous aide à rêver éveillé`;
}

async function getLyricsFromCache(songId) {
    let cached = await DB.lyrics.get(songId);
    if (cached) {
        return cached;
    }
    
    const fav = await DB.favorites.get(songId);
    if (fav && fav.lyrics) {
        return { lyrics: fav.lyrics, synced: fav.syncedLyrics };
    }
    
    return null;
}

async function saveLyricsToCache(songId, lyrics, syncedLines) {
    await DB.lyrics.put({
        id: songId,
        lyrics: lyrics,
        synced: syncedLines,
        timestamp: Date.now()
    });
    console.log('💾 Paroles synchronisées sauvegardées');
}

async function showLyricsFromCache(songId, title, artist) {
    const cached = await getLyricsFromCache(songId);
    if (cached && cached.synced) {
        showSyncedLyricsPanel(title, artist, cached.synced);
    } else if (cached && cached.lyrics) {
        const synced = parseLyricsWithTimestamps(cached.lyrics);
        showSyncedLyricsPanel(title, artist, synced);
    } else {
        await fetchAndShowLyrics(songId, title, artist);
    }
}

function showSyncedLyricsPanel(title, artist, syncedLines, isLoading = false) {
    let panel = document.getElementById('lyricsPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'lyricsPanel';
        panel.className = 'lyrics-panel';
        document.body.appendChild(panel);
    }
    
    if (isLoading) {
        panel.innerHTML = `
            <div class="lyrics-header">
                <div>
                    <h3>🎤 ${escapeHtml(title)}</h3>
                    <small>${escapeHtml(artist)}</small>
                </div>
                <button class="close-lyrics" onclick="closeLyrics()">✖</button>
            </div>
            <div class="lyrics-content">
                <div class="loading-spinner"></div>
                <p style="text-align:center;">Recherche des paroles...</p>
            </div>
        `;
        panel.style.display = 'block';
        return;
    }
    
    if (!syncedLines || syncedLines.length === 0) {
        panel.innerHTML = `
            <div class="lyrics-header">
                <div>
                    <h3>🎤 ${escapeHtml(title)}</h3>
                    <small>${escapeHtml(artist)}</small>
                </div>
                <button class="close-lyrics" onclick="closeLyrics()">✖</button>
            </div>
            <div class="lyrics-content">
                <p style="text-align:center; color:#999;">📝 Paroles non disponibles</p>
            </div>
        `;
        panel.style.display = 'block';
        return;
    }
    
    // Stocker les lignes pour la synchronisation
    lyricsLines = syncedLines;
    currentLineIndex = -1;
    
    const lyricsHtml = syncedLines.map((line, index) => {
        if (line.isBreak) return '<br>';
        if (line.isSection) {
            return `<div class="lyrics-section">${escapeHtml(line.text)}</div>`;
        }
        return `<div class="lyrics-line-sync" data-index="${index}" data-time="${line.timestamp || 0}" onclick="jumpToLine(${index})">
                    ${escapeHtml(line.text)}
                </div>`;
    }).join('');
    
    panel.innerHTML = `
        <div class="lyrics-header">
            <div>
                <h3>🎤 ${escapeHtml(title)}</h3>
                <small>${escapeHtml(artist)}</small>
            </div>
            <div class="lyrics-controls">
                <button class="sync-toggle ${isAutoScroll ? 'active' : ''}" onclick="toggleAutoSync()">
                    ${isAutoScroll ? '🔒 Auto' : '🔓 Manuel'}
                </button>
                <button class="close-lyrics" onclick="closeLyrics()">✖</button>
            </div>
        </div>
        <div class="lyrics-content">
            <div class="lyrics-text">
                ${lyricsHtml}
            </div>
            <div class="lyrics-actions">
                <button onclick="copyLyrics()" class="lyrics-btn">📋 Copier</button>
                <button onclick="resetLyricsSync()" class="lyrics-btn">🔄 Reset</button>
                <span class="offline-badge-panel">🎤 Mode karaoké</span>
            </div>
        </div>
    `;
    panel.style.display = 'block';
    
    // Redémarrer la synchronisation si la musique joue
    const audio = document.getElementById('audioPlayer');
    if (!audio.paused) {
        startLyricsSync();
    }
}

function jumpToLine(index) {
    const audio = document.getElementById('audioPlayer');
    const line = lyricsLines[index];
    if (line && line.timestamp !== undefined) {
        audio.currentTime = line.timestamp;
        currentLineIndex = index - 1;
        updateLyricsSync();
        showToast(`⏩ Saut à la ligne ${index + 1}`);
    } else if (line) {
        showToast(`⏩ Impossible de sauter à cette ligne`);
    }
}

function toggleAutoSync() {
    isAutoScroll = !isAutoScroll;
    const btn = document.querySelector('.sync-toggle');
    if (btn) {
        btn.textContent = isAutoScroll ? '🔒 Auto' : '🔓 Manuel';
        btn.classList.toggle('active', isAutoScroll);
    }
    showToast(isAutoScroll ? '✅ Mode synchro automatique' : '📖 Mode manuel - clique sur les paroles');
    
    if (!isAutoScroll) {
        if (syncInterval) clearInterval(syncInterval);
    } else {
        startLyricsSync();
        updateLyricsSync();
    }
}

function resetLyricsSync() {
    currentLineIndex = -1;
    const audio = document.getElementById('audioPlayer');
    audio.currentTime = 0;
    highlightCurrentLine(-1);
    showToast('🔄 Synchronisation réinitialisée');
}

function closeLyrics() {
    const panel = document.getElementById('lyricsPanel');
    if (panel) panel.style.display = 'none';
    stopLyricsSync();
}

function copyLyrics() {
    const lyricsText = Array.from(document.querySelectorAll('.lyrics-line-sync'))
        .map(line => line.innerText)
        .join('\n');
    if (lyricsText) {
        navigator.clipboard.writeText(lyricsText);
        showToast('📋 Paroles copiées !');
    }
}

// ========== FAVORIS AVEC PAROLES ==========
async function toggleFavorite(id, title, artist, filename) {
    id = parseInt(id);
    
    if (favoritesSet.has(id)) {
        await DB.favorites.delete(id);
        favoritesSet.delete(id);
        showToast(`❌ ${title} retiré des favoris`);
    } else {
        showToast(`📥 Téléchargement de ${title}...`);
        
        try {
            const response = await fetch(`api/get_song.php?id=${id}&download=1`);
            if (!response.ok) {
                throw new Error('Fichier non trouvé');
            }
            const blob = await response.blob();
            
            // Récupérer les paroles synchronisées
            let cached = await getLyricsFromCache(id);
            let lyrics = null;
            let syncedLines = null;
            
            if (cached && cached.lyrics) {
                lyrics = cached.lyrics;
                syncedLines = cached.synced;
            } else {
                lyrics = await fetchLyricsOnline(title, artist);
                if (!lyrics) {
                    lyrics = generateAIFallbackLyrics(title, artist);
                }
                // Attendre la durée pour les timestamps
                const audio = document.getElementById('audioPlayer');
                const duration = audio.duration || 180;
                syncedLines = parseLyricsWithTimestamps(lyrics);
                await saveLyricsToCache(id, lyrics, syncedLines);
            }
            
            await DB.favorites.put({
                id: id,
                title: title,
                artist: artist,
                filename: filename,
                blob: blob,
                lyrics: lyrics,
                syncedLyrics: syncedLines
            });
            
            favoritesSet.add(id);
            showToast(`✅ ${title} disponible hors ligne avec paroles synchronisées !`);
            await updateStorageInfo();
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            showToast(`❌ Impossible de télécharger ${title}`);
        }
    }
    
    if (currentView === 'home') showHome();
    else if (currentView === 'favorites') showFavorites();
    else searchSongs(document.getElementById('searchInput').value);
}

async function removeFavorite(id) {
    await DB.favorites.delete(parseInt(id));
    favoritesSet.delete(parseInt(id));
    showFavorites();
    updateStorageInfo();
}

// ========== UTILITAIRES ==========
async function updateStorageInfo() {
    if ('storage' in navigator && navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = (estimate.usage / (1024 * 1024)).toFixed(2);
        document.getElementById('storageUsed').textContent = used;
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; 
        bottom: 100px; 
        left: 50%; 
        transform: translateX(-50%);
        background: #1DB954; 
        color: white; 
        padding: 12px 24px;
        border-radius: 30px; 
        z-index: 9999; 
        animation: fadeOut 2s forwards;
        font-size: 14px;
        white-space: nowrap;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
}

// ========== STYLES DYNAMIQUES ==========
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; }
        70% { opacity: 1; }
        100% { opacity: 0; visibility: hidden; }
    }
    
    .lyrics-section {
        color: #9b59b6;
        font-weight: bold;
        margin: 20px 0 10px 0;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .lyrics-card-btn {
        background: #9b59b6;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    }
    
    .lyrics-card-btn:hover {
        background: #8e44ad;
        transform: scale(1.05);
    }
    
    .loading-spinner {
        border: 3px solid #333;
        border-top: 3px solid #9b59b6;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .offline-badge-panel {
        background: #4CAF50;
        color: white;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
    }
`;
document.head.appendChild(style);

// ========== FONCTIONS GLOBALES ==========
window.showHome = showHome;
window.searchSongs = searchSongs;
window.showFavorites = showFavorites;
window.streamSong = streamSong;
window.toggleFavorite = toggleFavorite;
window.playFavorite = playFavorite;
window.removeFavorite = removeFavorite;
window.showLyricsFromCache = showLyricsFromCache;
window.closeLyrics = closeLyrics;
window.copyLyrics = copyLyrics;
window.jumpToLine = jumpToLine;
window.toggleAutoSync = toggleAutoSync;
window.resetLyricsSync = resetLyricsSync;