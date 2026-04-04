// utils.js

// Replaces chrome.storage.sync.get
function loadData(defaults, callback) {
  const keysToGet = { ...defaults };
  if ('folders' in defaults) {
    keysToGet.foldersDataCompressed = null; // We request the compressed key
  }

  chrome.storage.sync.get(keysToGet, (data) => {
    if ('folders' in defaults) {
      if (data.foldersDataCompressed) {
        // Case 1: Compressed data found
        data.folders = JSON.parse(LZString.decompressFromUTF16(data.foldersDataCompressed));
      } else if (data.folders && Object.keys(data.folders).length > 0) {
        // Case 2: Silent migration (legacy data)
        saveData({ folders: data.folders });
      } else {
        // Case 3: Empty
        data.folders = defaults.folders;
      }
      delete data.foldersDataCompressed; // Clean up before passing to the rest of the app
    }
    callback(data);
  });
}

// Replaces chrome.storage.sync.set
function saveData(dataToSave, callback) {
  const finalSave = { ...dataToSave };

  if (finalSave.folders) {
    // Compressing only the 'folders' key
    finalSave.foldersDataCompressed = LZString.compressToUTF16(JSON.stringify(finalSave.folders));
    delete finalSave.folders;

    // Cleaning up the old key to free up space
    chrome.storage.sync.remove('folders');
  }

  chrome.storage.sync.set(finalSave, callback);
}