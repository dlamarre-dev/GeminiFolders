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
      chrome.storage.sync.get(['syncBookmarksEnabled', 'foldersDataCompressed', 'pinnedFolders', 'sortPref'], (syncData) => {
        if (syncData.syncBookmarksEnabled && syncData.foldersDataCompressed) {
          const folders = JSON.parse(LZString.decompressFromUTF16(syncData.foldersDataCompressed));
          const pinned = syncData.pinnedFolders || []; // Safety fallback if it's empty
          const sortPref = syncData.sortPref || 'dateAsc'; // Fallback

          syncToBookmarksTree(folders, pinned, sortPref);
        }
      });

      // Increment save counter
      chrome.storage.local.get(['usageStats'], (data) => {
        let stats = data.usageStats || { saves: 0, opens: 0 };
        stats.saves += 1;
        chrome.storage.local.set({ usageStats: stats });
      });

      if (callback) callback();
    });
}

// --- BOOKMARKS SYNCHRONIZATION (MOBILE) ---
// 🔒 Verrou global pour empêcher la "Race Condition"
let isSyncingToBookmarks = false;

async function syncToBookmarksTree(folders, pinnedFolders = [], sortPref = 'dateAsc') {
  // 1. Stop if a sync is ongoing
  if (isSyncingToBookmarks) {
    return;
  }

  isSyncingToBookmarks = true;

  try {
    const MASTER_FOLDER_NAME = chrome.i18n.getMessage("masterFolderName") || "Gemini Folders (Sync)";

    // 2. Look for all folders
    const results = await new Promise(r => chrome.bookmarks.search({ title: MASTER_FOLDER_NAME }, r));

    // 3. Delete all (Purge absolue de tous les doublons existants)
    for (const node of results) {
      // Security check
      if (!node.url && node.title === MASTER_FOLDER_NAME) {
        await new Promise(r => chrome.bookmarks.removeTree(node.id, r));
      }
    }

    // Let a bit of time to avoid racing condition
    await new Promise(r => setTimeout(r, 50));

    // 4. Master folder creation
    const masterNode = await new Promise(r => chrome.bookmarks.create({ title: MASTER_FOLDER_NAME }, r));

    // --- DYNAMIC SORTING ---
    let finalOrder = Object.keys(folders).sort((a, b) => {
      const aPinned = pinnedFolders.includes(a);
      const bPinned = pinnedFolders.includes(b);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (sortPref === 'alphaAsc') {
        return a.localeCompare(b);
      } else {
        const getFolderTime = (folderName) => {
          const chatsList = folders[folderName];
          if (!chatsList || chatsList.length === 0) return 0;
          if (sortPref === 'dateDesc') return Math.max(...chatsList.map(c => c.timestamp || 0));
          return Math.min(...chatsList.map(c => c.timestamp || Date.now()));
        };
        const timeA = getFolderTime(a);
        const timeB = getFolderTime(b);
        if (sortPref === 'dateDesc') return timeB - timeA;
        if (sortPref === 'dateAsc') return timeA - timeB;
      }
      return a.localeCompare(b);
    });

    // 5. Folder and bookmark creation loop
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

      // Sort conversations
      let chats = [...folders[folderName]];
      chats.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        if (sortPref === 'dateDesc') return timeB - timeA;
        if (sortPref === 'dateAsc') return timeA - timeB;
        if (sortPref === 'alphaAsc') return a.title.localeCompare(b.title);
        return 0;
      });

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
  } catch (error) {
    console.error("Critical error during sync :", error);
  } finally {
    isSyncingToBookmarks = false;
  }
}
