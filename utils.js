// utils.js

// Remplace chrome.storage.sync.get
function loadData(defaults, callback) {
  const keysToGet = { ...defaults };
  if ('folders' in defaults) {
    keysToGet.foldersDataCompressed = null; // On demande la clé compressée
  }

  chrome.storage.sync.get(keysToGet, (data) => {
    if ('folders' in defaults) {
      if (data.foldersDataCompressed) {
        // Cas 1 : Données compressées trouvées
        data.folders = JSON.parse(LZString.decompressFromUTF16(data.foldersDataCompressed));
      } else if (data.folders && Object.keys(data.folders).length > 0) {
        // Cas 2 : Migration silencieuse (anciennes données)
        saveData({ folders: data.folders });
      } else {
        // Cas 3 : Vide
        data.folders = defaults.folders;
      }
      delete data.foldersDataCompressed; // On nettoie avant d'envoyer au reste de l'app
    }
    callback(data);
  });
}

// Remplace chrome.storage.sync.set
function saveData(dataToSave, callback) {
  const finalSave = { ...dataToSave };

  if (finalSave.folders) {
    // Compression de la clé 'folders' uniquement
    finalSave.foldersDataCompressed = LZString.compressToUTF16(JSON.stringify(finalSave.folders));
    delete finalSave.folders;

    // Nettoyage de l'ancienne clé pour libérer de l'espace
    chrome.storage.sync.remove('folders');
  }

  chrome.storage.sync.set(finalSave, callback);
}