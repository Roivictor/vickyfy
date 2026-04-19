// ========== CONFIGURATION SUPABASE ==========
const SUPABASE_URL = 'https://ocenlsrwqhroiwngxstb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jS_lqFt7korNB75ymk6Qww__3bkImZq';

// Initialiser Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========== BASE DE DONNÉES LOCALE (IndexedDB) ==========
const DB = new Dexie('VickyfyCache');
DB.version(3).stores({
    favorites: 'id, title, artist, filename, blob, lyrics, syncedLyrics',
    lyrics: 'id, lyrics, timestamp, synced'
});

let currentView = 'home';
let favoritesSet = new Set();
let currentSongId = null;
let currentSongTitle = '';
let currentSongArtist = '';
let lyricsLines = [];
let currentLineIndex = -1;
let syncInterval = null;
let isAutoScroll = true;
let songDuration = 0;

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎵 Vickyfy sur Supabase !');
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
        if (audio.duration) {
            songDuration = audio.duration;
        }
    });
    audio.addEventListener('loadedmetadata', () => {
        songDuration = audio.duration;
        recalculateTimestamps();
    });
}

function recalculateTimestamps() {
    if (!lyricsLines.length || !songDuration) return;
    
    const totalLines = lyricsLines.filter(line => !line.isBreak && line.text && line.text.trim()).length;
    let lineIndex = 0;
    
    for (let i = 0; i < lyricsLines.length; i++) {
        const line = lyricsLines[i];
        if (!line.isBreak && line.text && line.text.trim()) {
            const timestamp = (lineIndex / totalLines) * songDuration;
            line.timestamp = timestamp;
            lineIndex++;
        }
    }
}

function updateLyricsSync() {
    const audio = document.getElementById('audioPlayer');
    const currentTime = audio.currentTime;
    
    if (!lyricsLines.length) return;
    
    let activeIndex = -1;
    for (let i = 0; i < lyricsLines.length; i++) {
        const line = lyricsLines[i];
        if (line.timestamp !== undefined && currentTime >= line.timestamp) {
            activeIndex = i;
        } else if (line.timestamp !== undefined && currentTime < line.timestamp) {
            break;
        }
    }
    
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
    }, 100);
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
        } else {
            line.classList.remove('active-line');
        }
    });
}

function autoScrollToLine(index) {
    const container = document.querySelector('.lyrics-content');
    if (!container) return;
    const activeLine = document.querySelector('.lyrics-line-sync.active-line');
    if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ========== CHARGEMENT DES CHANSONS ==========
async function loadSongs() {
    const { data: songs, error } = await supabaseClient
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erreur Supabase:', error);
        return [];
    }
    return songs || [];
}

// ========== AFFICHAGE ==========
async function showHome() {
    currentView = 'home';
    const homeSection = document.getElementById('homeSection');
    const resultsSection = document.getElementById('resultsSection');
    const favoritesSection = document.getElementById('favoritesSection');
    
    if (homeSection) homeSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';
    if (favoritesSection) favoritesSection.style.display = 'none';
    
    const songs = await loadSongs();
    displaySongs(songs, 'suggestionsList');
}

async function searchSongs(query) {
    if (query.length < 2) {
        showHome();
        return;
    }
    
    const homeSection = document.getElementById('homeSection');
    const resultsSection = document.getElementById('resultsSection');
    const favoritesSection = document.getElementById('favoritesSection');
    
    if (homeSection) homeSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    if (favoritesSection) favoritesSection.style.display = 'none';
    
    const { data: songs, error } = await supabaseClient
        .from('songs')
        .select('*')
        .ilike('title', `%${query}%`)
        .or(`artist.ilike.%${query}%`);
    
    if (error) return;
    displaySongs(songs || [], 'resultsList');
}

async function showFavorites() {
    currentView = 'favorites';
    const homeSection = document.getElementById('homeSection');
    const resultsSection = document.getElementById('resultsSection');
    const favoritesSection = document.getElementById('favoritesSection');
    
    if (homeSection) homeSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (favoritesSection) favoritesSection.style.display = 'block';
    
    const favorites = await DB.favorites.toArray();
    displayFavorites(favorites);
}

function displayFavorites(favorites) {
    const container = document.getElementById('favoritesList');
    if (!container) return;
    
    if (favorites.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px;">⭐ Aucun favori</p>';
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
    if (!container) return;
    
    if (!songs || songs.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px;">😢 Aucune chanson</p>';
        return;
    }
    
    container.innerHTML = songs.map(song => `
        <div class="song-card">
            <h3>${escapeHtml(song.title)}</h3>
            <p>${escapeHtml(song.artist)}</p>
            <div class="card-buttons">
                <button class="play-card-btn" onclick="playSong('${song.file_url}', '${escapeHtml(song.title)}', '${escapeHtml(song.artist)}', ${song.id})">▶ Jouer</button>
                <button class="fav-card-btn ${favoritesSet.has(song.id) ? 'active' : ''}" 
                        onclick="toggleFavorite(${song.id}, '${escapeHtml(song.title)}', '${escapeHtml(song.artist)}', '${song.file_url}')">
                    ${favoritesSet.has(song.id) ? '⭐ Favori' : '☆ Ajouter'}
                </button>
            </div>
        </div>
    `).join('');
}

// ========== LECTURE ==========
function playSong(url, title, artist, id) {
    console.log('🎵 Lecture:', title);
    currentSongId = id;
    currentSongTitle = title;
    currentSongArtist = artist;
    
    const currentTitle = document.getElementById('currentTitle');
    const currentArtist = document.getElementById('currentArtist');
    if (currentTitle) currentTitle.textContent = title;
    if (currentArtist) currentArtist.textContent = artist;
    
    const audio = document.getElementById('audioPlayer');
    if (audio) {
        audio.src = url;
        audio.play();
    }
    
    fetchAndShowLyrics(id, title, artist);
}

async function playFavorite(id) {
    const song = await DB.favorites.get(parseInt(id));
    if (song && song.blob) {
        currentSongId = id;
        const currentTitle = document.getElementById('currentTitle');
        const currentArtist = document.getElementById('currentArtist');
        if (currentTitle) currentTitle.textContent = song.title;
        if (currentArtist) currentArtist.textContent = song.artist;
        
        const audio = document.getElementById('audioPlayer');
        const url = URL.createObjectURL(song.blob);
        audio.src = url;
        audio.play();
        
        await showLyricsFromCache(id, song.title, song.artist);
    } else {
        showToast('❌ Fichier hors ligne non disponible');
    }
}

// ========== FAVORIS ==========
async function toggleFavorite(id, title, artist, url) {
    id = parseInt(id);
    
    if (favoritesSet.has(id)) {
        await DB.favorites.delete(id);
        favoritesSet.delete(id);
        showToast(`❌ ${title} retiré`);
    } else {
        showToast(`📥 Téléchargement de ${title}...`);
        
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            
            await DB.favorites.put({
                id, title, artist, filename: `${id}.mp3`, blob
            });
            
            favoritesSet.add(id);
            showToast(`✅ ${title} disponible hors ligne !`);
            await updateStorageInfo();
        } catch (error) {
            showToast(`❌ Erreur de téléchargement`);
        }
    }
    
    if (currentView === 'home') showHome();
    else if (currentView === 'favorites') showFavorites();
}

async function removeFavorite(id) {
    await DB.favorites.delete(parseInt(id));
    favoritesSet.delete(parseInt(id));
    showFavorites();
    updateStorageInfo();
}

async function loadFavorites() {
    const favs = await DB.favorites.toArray();
    favoritesSet.clear();
    favs.forEach(f => favoritesSet.add(f.id));
}

// ========== PAROLES ==========
async function fetchAndShowLyrics(songId, title, artist) {
    showSyncedLyricsPanel(title, artist, null, true);
    
    let lyrics = await fetchLyricsOnline(title, artist);
    if (!lyrics) {
        lyrics = generateFallbackLyrics(title, artist);
    }
    
    const syncedLines = parseLyricsWithTimestamps(lyrics);
    
    await DB.lyrics.put({
        id: songId,
        lyrics: lyrics,
        synced: syncedLines,
        timestamp: Date.now()
    });
    
    showSyncedLyricsPanel(title, artist, syncedLines);
}

async function fetchLyricsOnline(title, artist) {
    try {
        const cleanTitle = title.split('(')[0].split('-')[0].split('feat')[0].trim();
        const cleanArtist = artist.split('feat')[0].split(',')[0].trim();
        
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
        const data = await response.json();
        
        if (data.lyrics) return data.lyrics;
        return null;
    } catch (error) {
        return null;
    }
}

function generateFallbackLyrics(title, artist) {
    return `[Couplet]\n${title} par ${artist}\nMusique extraordinaire\n\n[Refrain]\nProfitez de ce moment musical\nLaissez-vous emporter\n\n[Outro]\nMerci d'écouter ${title}`;
}

function parseLyricsWithTimestamps(lyrics) {
    const lines = lyrics.split('\n');
    const parsedLines = [];
    let lineIndex = 0;
    const totalLines = lines.filter(l => l.trim() && !l.startsWith('[')).length;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine === '') {
            parsedLines.push({ text: '', isBreak: true });
        } else if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
            parsedLines.push({ text: trimmedLine, isSection: true });
        } else {
            const estimatedTime = (lineIndex / Math.max(totalLines, 1)) * (songDuration || 180);
            parsedLines.push({ text: trimmedLine, timestamp: estimatedTime });
            lineIndex++;
        }
    }
    return parsedLines;
}

async function showLyricsFromCache(songId, title, artist) {
    const cached = await DB.lyrics.get(songId);
    if (cached && cached.synced) {
        showSyncedLyricsPanel(title, artist, cached.synced);
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
    
    lyricsLines = syncedLines;
    currentLineIndex = -1;
    
    const lyricsHtml = syncedLines.map((line, index) => {
        if (line.isBreak) return '<br>';
        if (line.isSection) {
            return `<div class="lyrics-section">${escapeHtml(line.text)}</div>`;
        }
        return `<div class="lyrics-line-sync" data-index="${index}" onclick="jumpToLine(${index})">
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
            </div>
        </div>
    `;
    panel.style.display = 'block';
}

function jumpToLine(index) {
    const audio = document.getElementById('audioPlayer');
    const line = lyricsLines[index];
    if (line && line.timestamp !== undefined) {
        audio.currentTime = line.timestamp;
        currentLineIndex = index - 1;
        updateLyricsSync();
        showToast(`⏩ Saut à la ligne ${index + 1}`);
    }
}

function toggleAutoSync() {
    isAutoScroll = !isAutoScroll;
    const btn = document.querySelector('.sync-toggle');
    if (btn) {
        btn.textContent = isAutoScroll ? '🔒 Auto' : '🔓 Manuel';
        btn.classList.toggle('active', isAutoScroll);
    }
    showToast(isAutoScroll ? '✅ Mode synchro automatique' : '📖 Mode manuel');
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

// ========== UTILITAIRES ==========
async function updateStorageInfo() {
    if ('storage' in navigator && navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = (estimate.usage / (1024 * 1024)).toFixed(2);
        const storageUsed = document.getElementById('storageUsed');
        const storageProgress = document.getElementById('storageProgress');
        if (storageUsed) storageUsed.textContent = used;
        if (storageProgress) storageProgress.style.width = Math.min((estimate.usage / (estimate.quota || 100000000)) * 100, 100) + '%';
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
        background: #1DB954; color: white; padding: 12px 24px;
        border-radius: 30px; z-index: 9999; animation: fadeOut 2s forwards;
        font-size: 14px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
}

// Styles
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
    .lyrics-section { color: #9b59b6; font-weight: bold; margin: 20px 0 10px; font-size: 14px; text-transform: uppercase; }
    .lyrics-card-btn { background: #9b59b6; color: white; border: none; padding: 8px 12px; border-radius: 20px; cursor: pointer; font-size: 12px; }
    .lyrics-card-btn:hover { background: #8e44ad; transform: scale(1.05); }
    .loading-spinner { border: 3px solid #333; border-top: 3px solid #9b59b6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .lyrics-line-sync { transition: all 0.2s; padding: 8px 12px; margin: 4px 0; border-radius: 8px; cursor: pointer; }
    .lyrics-line-sync:hover { background: rgba(155, 89, 182, 0.1); transform: translateX(5px); }
    .lyrics-line-sync.active-line { background: linear-gradient(90deg, rgba(155, 89, 182, 0.3), transparent); border-left: 3px solid #9b59b6; font-weight: bold; color: white; }
`;
document.head.appendChild(style);

// Fonctions globales
window.showHome = showHome;
window.searchSongs = searchSongs;
window.showFavorites = showFavorites;
window.playSong = playSong;
window.playFavorite = playFavorite;
window.toggleFavorite = toggleFavorite;
window.removeFavorite = removeFavorite;
window.showLyricsFromCache = showLyricsFromCache;
window.closeLyrics = closeLyrics;
window.copyLyrics = copyLyrics;
window.jumpToLine = jumpToLine;
window.toggleAutoSync = toggleAutoSync;
window.resetLyricsSync = resetLyricsSync;

// ========== ADMIN PANEL ==========
let isUploading = false;

async function showAdminPanel() {
    currentView = 'admin';
    const homeSection = document.getElementById('homeSection');
    const resultsSection = document.getElementById('resultsSection');
    const favoritesSection = document.getElementById('favoritesSection');
    
    if (homeSection) homeSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (favoritesSection) favoritesSection.style.display = 'none';
    
    const main = document.querySelector('.main');
    const originalContent = main.innerHTML;
    
    main.innerHTML = `
        <div class="admin-panel">
            <div class="section-header">
                <div class="section-title">
                    <i class="fas fa-cog"></i>
                    <h2>Panel Administrateur</h2>
                </div>
                <button class="close-admin" onclick="showHome()">
                    <i class="fas fa-times"></i> Retour
                </button>
            </div>
            
            <div class="admin-card">
                <h3><i class="fas fa-upload"></i> Ajouter une nouvelle chanson</h3>
                <div class="form-group">
                    <label>Titre de la chanson</label>
                    <input type="text" id="adminTitle" placeholder="Ex: Ransom" required>
                </div>
                <div class="form-group">
                    <label>Nom de l'artiste</label>
                    <input type="text" id="adminArtist" placeholder="Ex: Lil Tecca" required>
                </div>
                <div class="form-group">
                    <label>Fichier MP3</label>
                    <input type="file" id="adminFile" accept="audio/mpeg,audio/mp3" required>
                    <small>Upload direct vers Supabase (stockage permanent)</small>
                </div>
                <div id="progressContainer" style="display:none;" class="upload-progress-container">
                    <div class="upload-progress-header">
                        <span>📤 Upload en cours...</span>
                        <span id="progressPercent">0%</span>
                    </div>
                    <div class="upload-progress-bar">
                        <div class="upload-progress-fill" id="uploadProgressFill" style="width: 0%"></div>
                    </div>
                    <small id="progressStatus">Préparation...</small>
                </div>
                <button class="admin-submit" id="adminUploadBtn" onclick="uploadSongToSupabase()">
                    <i class="fas fa-cloud-upload-alt"></i> Uploader la chanson
                </button>
            </div>
            
            <div class="admin-card">
                <h3><i class="fas fa-list"></i> Chansons existantes</h3>
                <div id="adminSongsList" class="admin-songs-list">
                    <div class="loading-spinner">Chargement...</div>
                </div>
            </div>
        </div>
    `;
    
    main.dataset.originalContent = originalContent;
    addAdminStyles();
    await loadAdminSongsList();
}

function addAdminStyles() {
    if (document.getElementById('adminStyles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'adminStyles';
    styles.textContent = `
        .admin-card { background: var(--dark-card); border-radius: 16px; padding: 25px; margin-bottom: 30px; border: 1px solid var(--glass-border); }
        .admin-card h3 { margin-bottom: 20px; font-size: 18px; color: var(--primary); }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); }
        .form-group input { width: 100%; padding: 12px 16px; background: var(--dark-hover); border: 1px solid var(--glass-border); border-radius: 12px; color: var(--text-primary); }
        .admin-submit { background: var(--gradient-1); color: white; border: none; padding: 14px 24px; border-radius: 30px; cursor: pointer; width: 100%; }
        .admin-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .admin-songs-list { display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; }
        .admin-song-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--dark-hover); border-radius: 12px; flex-wrap: wrap; gap: 10px; }
        .delete-song-btn { background: rgba(244,67,54,0.2); border: none; color: #f44336; padding: 8px 16px; border-radius: 20px; cursor: pointer; }
        .delete-song-btn:hover { background: #f44336; color: white; }
        .upload-progress-container { background: var(--dark-hover); border-radius: 12px; padding: 15px; margin: 15px 0; }
        .upload-progress-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .upload-progress-bar { height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
        .upload-progress-fill { height: 100%; background: var(--gradient-1); width: 0%; transition: width 0.3s; }
        .close-admin { background: rgba(255,255,255,0.1); border: none; padding: 10px 20px; border-radius: 25px; color: white; cursor: pointer; }
        .close-admin:hover { background: var(--primary); }
    `;
    document.head.appendChild(styles);
}

async function loadAdminSongsList() {
    const container = document.getElementById('adminSongsList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">⏳ Chargement...</div>';
    
    const { data: songs, error } = await supabaseClient
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error || !songs || songs.length === 0) {
        container.innerHTML = '<p style="text-align:center;">📭 Aucune chanson</p>';
        return;
    }
    
    container.innerHTML = songs.map(song => `
        <div class="admin-song-item">
            <div class="admin-song-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <button class="delete-song-btn" onclick="deleteSongFromAdmin(${song.id})">
                🗑 Supprimer
            </button>
        </div>
    `).join('');
}

function showProgressBar(percent, status) {
    const container = document.getElementById('progressContainer');
    const fill = document.getElementById('uploadProgressFill');
    const percentSpan = document.getElementById('progressPercent');
    const statusSpan = document.getElementById('progressStatus');
    
    if (container) container.style.display = 'block';
    if (fill) fill.style.width = percent + '%';
    if (percentSpan) percentSpan.textContent = Math.round(percent) + '%';
    if (statusSpan && status) statusSpan.textContent = status;
}

function hideProgressBar() {
    const container = document.getElementById('progressContainer');
    if (container) container.style.display = 'none';
}

// ========== UPLOAD DIRECT VERS SUPABASE STORAGE ==========
async function uploadSongToSupabase() {
    if (isUploading) {
        showToast('⏳ Upload en cours...');
        return;
    }
    
    const title = document.getElementById('adminTitle').value.trim();
    const artist = document.getElementById('adminArtist').value.trim();
    const file = document.getElementById('adminFile').files[0];
    
    if (!title || !artist || !file) {
        showToast('❌ Veuillez remplir tous les champs');
        return;
    }
    
    if (!file.type.includes('mp3') && !file.type.includes('mpeg')) {
        showToast('❌ Veuillez sélectionner un fichier MP3');
        return;
    }
    
    isUploading = true;
    const uploadBtn = document.getElementById('adminUploadBtn');
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload vers Supabase...';
    uploadBtn.disabled = true;
    
    showProgressBar(0, "Préparation...");
    
    // Créer un nom de fichier propre
    const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanArtist = artist.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${cleanTitle}_${cleanArtist}_${Date.now()}.mp3`;
    
    try {
        showProgressBar(20, "Upload vers Supabase Storage...");
        
        // 1. Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('songs')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Upload échoué: ${uploadError.message}`);
        }
        
        showProgressBar(70, "Récupération du lien public...");
        
        // 2. Récupérer l'URL publique
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('songs')
            .getPublicUrl(fileName);
        
        console.log('URL publique:', publicUrl);
        
        showProgressBar(85, "Enregistrement en base de données...");
        
        // 3. Insérer dans la table songs
        const { error: insertError } = await supabaseClient
            .from('songs')
            .insert({
                title: title,
                artist: artist,
                filename: fileName,
                file_url: publicUrl,
                plays: 0
            });
        
        if (insertError) {
            console.error('Insert error:', insertError);
            throw new Error(`Erreur base de données: ${insertError.message}`);
        }
        
        showProgressBar(100, "Terminé !");
        showToast(`✅ "${title}" ajoutée avec succès !`);
        
        // Réinitialiser le formulaire
        document.getElementById('adminTitle').value = '';
        document.getElementById('adminArtist').value = '';
        document.getElementById('adminFile').value = '';
        
        // Recharger les listes
        await loadAdminSongsList();
        await showHome();
        
        setTimeout(() => hideProgressBar(), 2000);
        
    } catch (error) {
        console.error('Erreur complète:', error);
        showToast(`❌ Erreur: ${error.message}`);
        hideProgressBar();
    } finally {
        isUploading = false;
        uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Uploader la chanson';
        uploadBtn.disabled = false;
    }
}

async function deleteSongFromAdmin(songId) {
    if (!confirm('⚠️ Supprimer cette chanson ?')) return;
    
    showToast('🗑 Suppression...');
    
    // Récupérer le nom du fichier pour le supprimer du storage
    const { data: song, error: fetchError } = await supabaseClient
        .from('songs')
        .select('filename')
        .eq('id', songId)
        .single();
    
    if (song && song.filename) {
        await supabaseClient.storage.from('songs').remove([song.filename]);
    }
    
    const { error: deleteError } = await supabaseClient
        .from('songs')
        .delete()
        .eq('id', songId);
    
    if (deleteError) {
        showToast('❌ Erreur');
    } else {
        showToast('✅ Chanson supprimée');
        await loadAdminSongsList();
        showHome();
    }
}

window.showAdminPanel = showAdminPanel;
window.uploadSongToSupabase = uploadSongToSupabase;
window.deleteSongFromAdmin = deleteSongFromAdmin;