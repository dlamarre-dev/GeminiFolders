// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('appTitle').textContent = chrome.i18n.getMessage("appTitle");
  document.getElementById('searchInput').placeholder = chrome.i18n.getMessage("searchPlaceholder");
  document.getElementById('folderName').placeholder = chrome.i18n.getMessage("folderPlaceholder");
  document.getElementById('chatTitle').placeholder = chrome.i18n.getMessage("chatPlaceholder");
  document.getElementById('saveBtn').textContent = chrome.i18n.getMessage("saveBtn");
  document.getElementById('status').textContent = chrome.i18n.getMessage("statusSaved");
  document.getElementById('noResults').textContent = chrome.i18n.getMessage("noResults");
  document.getElementById('exportBtn').textContent = chrome.i18n.getMessage("exportBtn");
  document.getElementById('importBtn').textContent = chrome.i18n.getMessage("importBtn");
  document.getElementById('toggleAddPanelBtn').textContent = "➕ " + chrome.i18n.getMessage("btnToggleAdd");
  document.getElementById('sortNewest').textContent = chrome.i18n.getMessage("sortNewest");
  document.getElementById('sortOldest').textContent = chrome.i18n.getMessage("sortOldest");
  document.getElementById('sortAlpha').textContent = chrome.i18n.getMessage("sortAlpha");

  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const folderNameInput = document.getElementById('folderName');
  const chatTitleInput = document.getElementById('chatTitle');
  const searchInput = document.getElementById('searchInput');
  const statusDiv = document.getElementById('status');
  const newFolderBtn = document.getElementById('newFolderBtn');
  newFolderBtn.title = chrome.i18n.getMessage("btnNewFolder");
  const toggleAddPanelBtn = document.getElementById('toggleAddPanelBtn');
  const addConversationPanel = document.getElementById('addConversationPanel');

  toggleAddPanelBtn.addEventListener('click', () => {
    const isHidden = addConversationPanel.style.display === 'none';
    addConversationPanel.style.display = isHidden ? 'block' : 'none';

    // Change text and icon based on panel state
    toggleAddPanelBtn.textContent = isHidden
      ? "➖ " + chrome.i18n.getMessage("btnCancel")
      : "➕ " + chrome.i18n.getMessage("btnToggleAdd");
  });

  newFolderBtn.addEventListener('click', async () => {
    const name = await window.showCustomModal({
        title: chrome.i18n.getMessage("promptNewFolder") || "New folder:",
        type: 'prompt',
        placeholder: chrome.i18n.getMessage("emojiTipPlaceholder") || "Tip: Start with an emoji! (Win+. or Cmd+Ctrl+Space)"
    });
    if (name && name.trim()) {
      loadData({ folders: {} }, (data) => {
        if (!data.folders[name.trim()]) {
          data.folders[name.trim()] = []; // Create empty folder
          saveData({ folders: data.folders }, () => {
            if (window.displayFolders) window.displayFolders();
          });
        }
      });
    }
  });

  const sortToggleBtn = document.getElementById('sortToggleBtn');
  const sortMenu = document.getElementById('sortMenu');
  const sortItems = document.querySelectorAll('.dropdown-item');

  // --- MOBILE SYNC (BOOKMARKS) ---
  const syncBookmarksToggle = document.getElementById('syncBookmarksToggle');
  const syncBookmarksLabel = document.getElementById('syncBookmarksLabel');

  syncBookmarksLabel.title = chrome.i18n.getMessage("syncBookmarksTooltip") || "Creates a synced folder in your Chrome bookmarks to access your conversations on your phone.";

  // Load toggle state
  chrome.storage.sync.get(['syncBookmarksEnabled'], (data) => {
    syncBookmarksToggle.checked = !!data.syncBookmarksEnabled;
  });

  // When user clicks on toggle
  syncBookmarksToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ syncBookmarksEnabled: isEnabled }, () => {
      if (isEnabled) {
        // Immediate sync
        loadData({ folders: {}, pinnedFolders: [], sortPref: 'dateAsc' }, (fullData) => {
          if (typeof syncToBookmarksTree === 'function') {
            syncToBookmarksTree(fullData.folders, fullData.pinnedFolders, fullData.sortPref);
          }
        });
      } else {
        // Clear bookmarks when user untoggles
        const masterFolderName = chrome.i18n.getMessage("masterFolderName") || "Gemini Folders (Sync)";

        chrome.bookmarks.search({ title: masterFolderName }, async (results) => {
          for (const node of results) {
            if (!node.url && node.title === masterFolderName) {
              await new Promise(r => chrome.bookmarks.removeTree(node.id, r));
            }
          }
        });
      }
    });
  });

  const githubLink = document.getElementById('githubLink');
  const manifestData = chrome.runtime.getManifest();
  githubLink.title = `GitHub - v${manifestData.version}`;

  // 1. Open/Close menu on click
  sortToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent click from propagating and closing the menu immediately
    sortMenu.classList.toggle('show');
  });

  // 2. Close menu if clicking anywhere else on the page
  document.addEventListener('click', () => {
    sortMenu.classList.remove('show');
  });

  // 3. Load saved preference and highlight active option
  loadData({ sortPref: 'dateAsc' }, (data) => {
    const activeItem = document.querySelector(`.dropdown-item[data-value="${data.sortPref}"]`);
    if (activeItem) activeItem.classList.add('active');
  });

  // 4. Handle click on a sort option
  sortItems.forEach(item => {
    item.addEventListener('click', () => {
      const selectedSort = item.getAttribute('data-value');

      // Visually update the active option
      sortItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Save and refresh while keeping folders open
      saveData({ sortPref: selectedSort }, () => {
        let openFolders = [];
        document.querySelectorAll('.folder').forEach(folder => {
          const content = folder.querySelector('.folder-content');
          if (content && content.style.display === 'block') {
            openFolders.push(folder.querySelector('.folder-name').textContent);
          }
        });
        if (window.displayFolders) window.displayFolders(openFolders, searchInput.value.toLowerCase());
      });
    });
    
    // --- Start mobile sync if activated ---
    chrome.storage.sync.get(['syncBookmarksEnabled'], (syncData) => {
      if (syncData.syncBookmarksEnabled) {
        loadData({ folders: {}, pinnedFolders: [], sortPref: 'dateAsc' }, (fullData) => {
          if (typeof syncToBookmarksTree === 'function') {
            syncToBookmarksTree(fullData.folders, fullData.pinnedFolders, fullData.sortPref);
          }
        });
      }
    });
  });

  // Smart title pre-filling
  let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (currentTab && currentTab.url && currentTab.url.includes("gemini.google.com")) {
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      args: [null],
      func: extractGeminiTitleLogic
    }, (injectionResults) => {
      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        chatTitleInput.value = injectionResults[0].result;
      } else {
        chatTitleInput.value = chrome.i18n.getMessage("defaultTitle") || "New conversation";
      }
    });
  }

  // Initialize display
  if (window.displayFolders) window.displayFolders();

  // Search listener
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (window.displayFolders) window.displayFolders(null, searchTerm);
  });

  // 1. Save
  saveBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes("gemini.google.com")) {
      await window.showCustomModal({
        title: chrome.i18n.getMessage("alertNotGemini") || "Please use this extension on a Gemini page.",
        type: 'alert'
      });
      return;
    }

    const folderName = folderNameInput.value.trim() || chrome.i18n.getMessage("defaultFolder");
    const finalChatTitle = chatTitleInput.value.trim() || chrome.i18n.getMessage("defaultTitle");
    const chatUrl = tab.url;

    loadData({ folders: {} }, (data) => {
      let folders = data.folders;
      if (!folders[folderName]) folders[folderName] = [];

      const cleanTargetUrl = normalizeUrl(chatUrl);
      const isDuplicate = folders[folderName].some(chat => normalizeUrl(chat.url) === cleanTargetUrl);
      if (!isDuplicate) {
        folders[folderName].push({
          title: finalChatTitle,
          url: chatUrl,
          timestamp: Date.now()
        });
      }

      saveData({ folders: folders }, () => {
        folderNameInput.value = "";
        addConversationPanel.style.display = 'none';
        toggleAddPanelBtn.textContent = "➕ " + chrome.i18n.getMessage("btnToggleAdd");
        searchInput.value = "";
        statusDiv.style.display = "block";
        setTimeout(() => { statusDiv.style.display = "none"; }, 2000);
        if (window.displayFolders) window.displayFolders(folderName);
      });
    });
  });

  // 2. Export (Updated to include pins)
  exportBtn.addEventListener('click', async () => {
      loadData({ folders: {}, pinnedFolders: [] }, async (data) => {
        if (Object.keys(data.folders).length === 0) {
          await window.showCustomModal({
            title: chrome.i18n.getMessage("alertEmptyExport") || "Your folders are empty, nothing to export!",
            type: 'alert'
          });
          return;
        }
      // Export the global "data" object containing both keys
      const dataString = JSON.stringify(data, null, 2);
      const blob = new Blob([dataString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "gemini_folders_backup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  // 3. Import (Updated for backward compatibility)
  importBtn.addEventListener('click', (e) => {
    if (navigator.userAgent.includes("Firefox")) {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL("import.html") });
    } else {
        importFile.click();
    }
  });

  importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        await mergeImportData(importedData);

        await window.showCustomModal({
          title: chrome.i18n.getMessage("alertImportSuccess") || "Import successful! Your data has been merged successfully.",
          type: 'alert'
        });
        importFile.value = "";
        if (window.displayFolders) window.displayFolders();

      } catch (error) {
        console.error("Erreur d'importation :", error);
        await window.showCustomModal({
          title: chrome.i18n.getMessage("alertImportError") || "Import error. Make sure it's a valid JSON file generated by this extension.",
          type: 'alert'
        });
        importFile.value = "";
      }
    };
    reader.readAsText(file);
  });
});