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
    finalSave.foldersDataCompressed = LZString.compressToUTF16(JSON.stringify(finalSave.folders));
    delete finalSave.folders;
    chrome.storage.sync.remove('folders');
  }

  chrome.storage.sync.set(finalSave, () => {
    // We also retrieve pinnedFolders
    chrome.storage.sync.get(['syncBookmarksEnabled', 'foldersDataCompressed', 'pinnedFolders'], (syncData) => {
      if (syncData.syncBookmarksEnabled && syncData.foldersDataCompressed) {
        const folders = JSON.parse(LZString.decompressFromUTF16(syncData.foldersDataCompressed));
        const pinned = syncData.pinnedFolders || []; // Safety fallback if it's empty
        syncToBookmarksTree(folders, pinned); // We pass both arguments
      }
    });
    if (callback) callback();
  });
}

// --- BOOKMARKS SYNCHRONIZATION (MOBILE) ---
// We add pinnedFolders as a parameter (with an empty array by default)
async function syncToBookmarksTree(folders, pinnedFolders = []) {
  const MASTER_FOLDER_NAME = chrome.i18n.getMessage("masterFolderName") || "Gemini Folders (Sync)";

  return new Promise((resolve) => {
    chrome.bookmarks.search({ title: MASTER_FOLDER_NAME }, async (results) => {
      // 1. We search for and delete the old tree if it exists
      const exactMatch = results.find(r => r.title === MASTER_FOLDER_NAME && !r.url);
      if (exactMatch) {
        await new Promise(r => chrome.bookmarks.removeTree(exactMatch.id, r));
      }

      // 2. We recreate the master folder at the root of the bookmarks
      chrome.bookmarks.create({ title: MASTER_FOLDER_NAME }, async (masterNode) => {

        // --- 3-step sorting (Pinned A-Z > Lightning > Rest A-Z) ---
        // allFolders is our absolute reference list, already sorted alphabetically
        let allFolders = Object.keys(folders).sort((a, b) => a.localeCompare(b));
        let finalOrder = [];

        // Step 1: Pinned folders (they will naturally be in alphabetical order!)
        allFolders.forEach(folder => {
          if (pinnedFolders.includes(folder)) finalOrder.push(folder);
        });

        // Step 2: The lightning folder ⚡ (if it wasn't already in the pinned folders)
        const quickSaveFolder = allFolders.find(f => f.includes('⚡'));
        if (quickSaveFolder && !finalOrder.includes(quickSaveFolder)) {
          finalOrder.push(quickSaveFolder);
        }

        // Step 3: Everything else
        allFolders.forEach(folder => {
          if (!finalOrder.includes(folder)) finalOrder.push(folder);
        });
        // -------------------------------------------------------------

        // 3. We loop through the final ordered list
        for (let i = 0; i < finalOrder.length; i++) {
          const folderName = finalOrder[i];
          let displayFolderName = folderName;

          const emojiRegex = /^((?:\p{Emoji_Presentation}|\p{Extended_Pictographic})\uFE0F?)\s*/u;
          const match = folderName.match(emojiRegex);

          if (match) {
            const restOfString = folderName.slice(match[0].length);
            displayFolderName = `${match[1]} ${restOfString}`;
          }

          const folderNode = await new Promise(r => chrome.bookmarks.create({
            parentId: masterNode.id,
            title: displayFolderName,
            index: i
          }, r));

          // 4. We add the conversations
          const chats = folders[folderName];
          for (let j = 0; j < chats.length; j++) {
            const chat = chats[j];
            await new Promise(r => chrome.bookmarks.create({
              parentId: folderNode.id,
              title: chat.title,
              url: chat.url,
              index: j
            }, r));
          }
        }
        resolve();
      });
    });
  });
}