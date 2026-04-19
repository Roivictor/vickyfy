// ========== ADMIN PANEL AVEC GOFILE.IO (ULTRA RAPIDE) ==========
let isUploading = false;
let progressContainer = null;

async function showAdminPanel() {
    currentView = 'admin';
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('favoritesSection').style.display = 'none';
    
    // Créer le panneau admin
    const adminHTML = `
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
                    <small>Upload ultra-rapide via GoFile.io</small>
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
    
    // Insérer le panneau
    const main = document.querySelector('.main');
    const originalContent = main.innerHTML;
    main.innerHTML = adminHTML;
    main.dataset.originalContent = originalContent;
    
    // Ajouter les styles
    addAdminStyles();
    
    // Charger la liste
    await loadAdminSongsList();
}

function addAdminStyles() {
    if (document.getElementById('adminStyles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'adminStyles';
    styles.textContent = `
        .admin-panel {
            animation: fadeIn 0.3s ease;
        }
        
        .close-admin {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        
        .close-admin:hover {
            background: var(--primary);
        }
        
        .admin-card {
            background: var(--dark-card);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 30px;
            border: 1px solid var(--glass-border);
        }
        
        .admin-card h3 {
            margin-bottom: 20px;
            font-size: 18px;
            color: var(--primary);
        }
        
        .admin-card h3 i {
            margin-right: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--text-secondary);
        }
        
        .form-group input {
            width: 100%;
            padding: 12px 16px;
            background: var(--dark-hover);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            color: var(--text-primary);
            font-size: 14px;
            box-sizing: border-box;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .form-group small {
            display: block;
            margin-top: 5px;
            color: var(--text-secondary);
            font-size: 12px;
        }
        
        .admin-submit {
            background: var(--gradient-1);
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            width: 100%;
            transition: all 0.2s;
        }
        
        .admin-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        
        .admin-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .admin-songs-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .admin-song-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: var(--dark-hover);
            border-radius: 12px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .admin-song-info {
            flex: 1;
        }
        
        .admin-song-info h4 {
            margin-bottom: 5px;
            font-size: 16px;
        }
        
        .admin-song-info p {
            font-size: 13px;
            color: var(--text-secondary);
        }
        
        .delete-song-btn {
            background: rgba(244, 67, 54, 0.2);
            border: none;
            color: #f44336;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .delete-song-btn:hover {
            background: #f44336;
            color: white;
        }
        
        .loading-spinner {
            text-align: center;
            padding: 20px;
            color: var(--text-secondary);
        }
        
        .upload-progress-container {
            background: var(--dark-hover);
            border-radius: 12px;
            padding: 15px;
            margin: 15px 0;
            border: 1px solid var(--glass-border);
        }
        
        .upload-progress-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .upload-progress-bar {
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .upload-progress-fill {
            height: 100%;
            background: var(--gradient-1);
            border-radius: 4px;
            transition: width 0.3s ease;
            width: 0%;
        }
        
        .upload-progress-container small {
            display: block;
            margin-top: 10px;
            font-size: 11px;
            color: var(--text-secondary);
            text-align: center;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(styles);
}

async function loadAdminSongsList() {
    const container = document.getElementById('adminSongsList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">⏳ Chargement...</div>';
    
    const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error || !songs || songs.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">📭 Aucune chanson</p>';
        return;
    }
    
    container.innerHTML = songs.map(song => `
        <div class="admin-song-item">
            <div class="admin-song-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
                <small style="color:#666; font-size:10px;">${song.filename}</small>
            </div>
            <button class="delete-song-btn" onclick="deleteSongFromAdmin(${song.id})">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        </div>
    `).join('');
}

function showProgressBar(percent, status) {
    const container = document.getElementById('progressContainer');
    if (container) {
        container.style.display = 'block';
        updateProgressBar(percent, status);
    }
}

function updateProgressBar(percent, status) {
    const fill = document.getElementById('uploadProgressFill');
    const percentSpan = document.getElementById('progressPercent');
    const statusSpan = document.getElementById('progressStatus');
    if (fill) fill.style.width = percent + '%';
    if (percentSpan) percentSpan.textContent = Math.round(percent) + '%';
    if (statusSpan && status) statusSpan.textContent = status;
}

function hideProgressBar() {
    const container = document.getElementById('progressContainer');
    if (container) {
        container.style.display = 'none';
    }
}

// ========== UPLOAD AVEC GOFILE.IO (ULTRA RAPIDE) ==========
async function uploadSongToSupabase() {
    if (isUploading) {
        showToast('⏳ Upload en cours, veuillez patienter...');
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
    const originalBtnText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Upload vers GoFile...';
    uploadBtn.disabled = true;
    
    showProgressBar(0, "Connexion à GoFile.io...");
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        updateProgressBar(20, "Upload du fichier...");
        
        // Upload vers GoFile.io (très rapide)
        const uploadResponse = await fetch('https://store1.gofile.io/uploadFile', {
            method: 'POST',
            body: formData
        });
        
        const result = await uploadResponse.json();
        
        if (result.status !== 'ok') {
            throw new Error('Upload GoFile échoué');
        }
        
        updateProgressBar(80, "Traitement du lien...");
        
        // Récupérer le lien direct
        const fileId = result.data.fileId;
        const directLink = `https://store1.gofile.io/download/direct/${fileId}`;
        
        updateProgressBar(90, "Enregistrement en base...");
        
        const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.mp3`;
        
        // Sauvegarder dans Supabase
        const { error: insertError } = await supabase
            .from('songs')
            .insert({
                title: title,
                artist: artist,
                filename: fileName,
                file_url: directLink,
                plays: 0
            });
        
        if (insertError) throw insertError;
        
        updateProgressBar(100, "Terminé !");
        
        showToast(`✅ "${title}" ajoutée avec succès ! (${(file.size / (1024 * 1024)).toFixed(1)} Mo)`);
        
        // Réinitialiser le formulaire
        document.getElementById('adminTitle').value = '';
        document.getElementById('adminArtist').value = '';
        document.getElementById('adminFile').value = '';
        
        // Recharger la liste
        await loadAdminSongsList();
        
        // Rafraîchir l'accueil
        showHome();
        
        // Cacher la barre après un délai
        setTimeout(() => hideProgressBar(), 2000);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast(`❌ Erreur: ${error.message}`);
        hideProgressBar();
    } finally {
        isUploading = false;
        uploadBtn.innerHTML = originalBtnText;
        uploadBtn.disabled = false;
    }
}

async function deleteSongFromAdmin(songId) {
    if (!confirm('⚠️ Supprimer cette chanson ? Cette action est irréversible.')) return;
    
    showToast('🗑 Suppression en cours...');
    
    // Récupérer le nom du fichier
    const { data: song, error: fetchError } = await supabase
        .from('songs')
        .select('filename')
        .eq('id', songId)
        .single();
    
    if (fetchError) {
        showToast('❌ Erreur: Chanson non trouvée');
        return;
    }
    
    // Supprimer de la base (GoFile supprime automatiquement après inactivité)
    const { error: deleteError } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);
    
    if (deleteError) {
        showToast('❌ Erreur lors de la suppression');
    } else {
        showToast('✅ Chanson supprimée avec succès');
        await loadAdminSongsList();
        showHome();
    }
}

// Fonctions globales supplémentaires
window.showAdminPanel = showAdminPanel;
window.uploadSongToSupabase = uploadSongToSupabase;
window.deleteSongFromAdmin = deleteSongFromAdmin;