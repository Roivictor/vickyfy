// ========== ADMIN PANEL ==========
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
                    <small>Sélectionnez un fichier MP3</small>
                </div>
                <button class="admin-submit" onclick="uploadSongToSupabase()">
                    <i class="fas fa-cloud-upload-alt"></i> Uploader la chanson
                </button>
            </div>
            
            <div class="admin-card">
                <h3><i class="fas fa-list"></i> Chansons existantes</h3>
                <div id="adminSongsList" class="admin-songs-list">
                    <div class="loading-spinner"></div>
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
    loadAdminSongsList();
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
            background: var(--glass);
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
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
        
        .admin-songs-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .admin-song-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: var(--dark-hover);
            border-radius: 12px;
        }
        
        .admin-song-info h4 {
            margin-bottom: 5px;
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
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(styles);
}

async function loadAdminSongsList() {
    const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });
    
    const container = document.getElementById('adminSongsList');
    if (error || !songs || songs.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Aucune chanson</p>';
        return;
    }
    
    container.innerHTML = songs.map(song => `
        <div class="admin-song-item">
            <div class="admin-song-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <button class="delete-song-btn" onclick="deleteSongFromAdmin(${song.id})">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        </div>
    `).join('');
}

async function uploadSongToSupabase() {
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
    
    showToast('📤 Upload en cours...');
    
    // Créer un nom de fichier propre
    const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanArtist = artist.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${cleanTitle}_${cleanArtist}_${Date.now()}.mp3`;
    
    try {
        // 1. Upload vers Storage
        const { error: uploadError } = await supabase
            .storage
            .from('songs')
            .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        // 2. Récupérer l'URL publique
        const { data: { publicUrl } } = supabase
            .storage
            .from('songs')
            .getPublicUrl(fileName);
        
        // 3. Ajouter dans la base
        const { error: insertError } = await supabase
            .from('songs')
            .insert({
                title: title,
                artist: artist,
                filename: fileName,
                file_url: publicUrl,
                plays: 0
            });
        
        if (insertError) throw insertError;
        
        showToast(`✅ "${title}" ajoutée avec succès !`);
        
        // Réinitialiser le formulaire
        document.getElementById('adminTitle').value = '';
        document.getElementById('adminArtist').value = '';
        document.getElementById('adminFile').value = '';
        
        // Recharger la liste
        loadAdminSongsList();
        
        // Rafraîchir l'accueil
        showHome();
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast(`❌ Erreur: ${error.message}`);
    }
}

async function deleteSongFromAdmin(songId) {
    if (!confirm('Supprimer cette chanson ? Cette action est irréversible.')) return;
    
    // Récupérer le nom du fichier
    const { data: song, error: fetchError } = await supabase
        .from('songs')
        .select('filename')
        .eq('id', songId)
        .single();
    
    if (fetchError) {
        showToast('❌ Erreur');
        return;
    }
    
    // Supprimer du Storage
    if (song && song.filename) {
        await supabase.storage.from('songs').remove([song.filename]);
    }
    
    // Supprimer de la base
    const { error: deleteError } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);
    
    if (deleteError) {
        showToast('❌ Erreur');
    } else {
        showToast('✅ Chanson supprimée');
        loadAdminSongsList();
        showHome();
    }
}
// Fonctions globales supplémentaires
window.showAdminPanel = showAdminPanel;
window.uploadSongToSupabase = uploadSongToSupabase;
window.deleteSongFromAdmin = deleteSongFromAdmin;