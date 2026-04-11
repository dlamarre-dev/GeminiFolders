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

  let selectedChats = [];
  const folderList = document.getElementById('folderList');
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const folderNameInput = document.getElementById('folderName');
  const chatTitleInput = document.getElementById('chatTitle');
  const searchInput = document.getElementById('searchInput');
  const statusDiv = document.getElementById('status');
  const noResultsDiv = document.getElementById('noResults');
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

  newFolderBtn.addEventListener('click', () => {
    const name = prompt(chrome.i18n.getMessage("promptNewFolder"));
    if (name && name.trim()) {
      loadData({ folders: {} }, (data) => {
        if (!data.folders[name.trim()]) {
          data.folders[name.trim()] = []; // Create empty folder
          saveData({ folders: data.folders }, () => displayFolders());
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
        loadData({ folders: {}, pinnedFolders: [] }, (data) => {
          if (typeof syncToBookmarksTree === 'function') {
            syncToBookmarksTree(data.folders, data.pinnedFolders);
          }
        });
      } else {
        // Clear bookmarks when user untoggles
        const masterFolderName = chrome.i18n.getMessage("masterFolderName") || "Gemini Folders (Sync)";

        chrome.bookmarks.search({ title: masterFolderName }, (results) => {
          const exactMatch = results.find(r => r.title === masterFolderName && !r.url);
          if (exactMatch) chrome.bookmarks.removeTree(exactMatch.id);
        });
      }
    });
  });

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
        displayFolders(openFolders, searchInput.value.toLowerCase());
      });
    });
  });
  // -------------------------------

  // Smart title pre-filling
  let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (currentTab && currentTab.url.includes("gemini.google.com")) {
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
      // Plan A: Official title at the top of the page (Ultra robust)
        const topTitle = document.querySelector('[data-test-id="conversation-title"]');
        if (topTitle && topTitle.textContent) {
          let text = topTitle.textContent.trim();
          if (text.length > 0) return text;
        }

        // Plan B: Sidebar menu (if Plan A fails or UI changes)
        const currentPath = window.location.pathname;
        if (currentPath && currentPath.includes("/app/")) {
          const links = document.querySelectorAll(`a[href="${currentPath}"]`);
          for (let link of links) {
            let text = link.textContent.trim();
            if (text && text.length > 1) return text.split('\n')[0].trim();
          }
        }

        // Plan C: Tab title
        let docTitle = document.title || "";
        let cleanTitle = docTitle.split(' - ')[0].trim();
        const ignoreList = ["gemini", "google gemini", "discussions", "chats", "nouvelle conversation", "new conversation", "new chat", ""];
        if (!ignoreList.includes(cleanTitle.toLowerCase())) {
            return cleanTitle;
        }

        // Plan D: User's first message
        const firstMsg = document.querySelector('[data-message-author-role="user"], user-query, message-content, .query-text');
        if (firstMsg && firstMsg.textContent) {
          let excerpt = firstMsg.textContent.trim();
          return excerpt.length > 40 ? excerpt.substring(0, 40) + "..." : excerpt;
        }

        return null;
      }
    }, (injectionResults) => {
      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        chatTitleInput.value = injectionResults[0].result;
      } else {
        chatTitleInput.value = chrome.i18n.getMessage("defaultTitle");
      }
    });
  }

  // Initialize display
  displayFolders();

  // Search listener
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    displayFolders(null, searchTerm);
  });

  // 1. Save
  saveBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes("gemini.google.com")) {
      alert(chrome.i18n.getMessage("alertNotGemini"));
      return;
    }

    const folderName = folderNameInput.value.trim() || chrome.i18n.getMessage("defaultFolder");
    const finalChatTitle = chatTitleInput.value.trim() || chrome.i18n.getMessage("defaultTitle");
    const chatUrl = tab.url;

    loadData({ folders: {} }, (data) => {
      let folders = data.folders;
      if (!folders[folderName]) folders[folderName] = [];

      const isDuplicate = folders[folderName].some(chat => chat.url === chatUrl);
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
        displayFolders(folderName);
      });
    });
  });

  // 2. Export (Updated to include pins)
  exportBtn.addEventListener('click', () => {
    // Retrieve both folders and pins
    loadData({ folders: {}, pinnedFolders: [] }, (data) => {
      if (Object.keys(data.folders).length === 0) {
        alert(chrome.i18n.getMessage("alertEmptyExport"));
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
  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (typeof importedData !== 'object' || importedData === null) {
          throw new Error("Invalid Format");
        }

        loadData({ folders: {}, pinnedFolders: [] }, (data) => {
          let currentFolders = data.folders;
          let currentPinned = data.pinnedFolders;

          // --- BACKWARD COMPATIBILITY MANAGEMENT ---
          let foldersToImport = {};
          let pinsToImport = [];

          // If JSON contains a "folders" key, it's the new format (v2.0)
          if (importedData.folders) {
            foldersToImport = importedData.folders;
            if (Array.isArray(importedData.pinnedFolders)) {
              pinsToImport = importedData.pinnedFolders;
            }
          } else {
            // Otherwise, it's the old format (v1.2) where the whole object is the folder list
            foldersToImport = importedData;
          }
          // ----------------------------------------

          // 1. Merge folders and conversations
          for (const [folderName, chats] of Object.entries(foldersToImport)) {
            if (!currentFolders[folderName]) currentFolders[folderName] = [];
            chats.forEach(importedChat => {
              if (importedChat.title && importedChat.url) {
                const isDuplicate = currentFolders[folderName].some(chat => chat.url === importedChat.url);
                if (!isDuplicate) currentFolders[folderName].push(importedChat);
              }
            });
          }

          // 2. Merge pins (without creating duplicates)
          pinsToImport.forEach(pin => {
            // Check that the pin isn't already present AND that the folder exists
            if (!currentPinned.includes(pin) && currentFolders[pin]) {
              currentPinned.push(pin);
            }
          });

          // Final save
          saveData({ folders: currentFolders, pinnedFolders: currentPinned }, () => {
            alert(chrome.i18n.getMessage("alertImportSuccess"));
            importFile.value = "";
            displayFolders();
          });
        });

      } catch (error) {
        alert(chrome.i18n.getMessage("alertImportError"));
        importFile.value = "";
      }
    };
    reader.readAsText(file);
  });

// 4. Display and Filter folders
  function displayFolders(openFoldersArg = [], searchTerm = "") {
    // Add 'openFolders: []' to retrieve the state of saved folders
    let openFolders = [];
    if (typeof openFoldersArg === 'string') openFolders = [openFoldersArg];
    else if (Array.isArray(openFoldersArg)) openFolders = openFoldersArg;
    loadData({ folders: {}, pinnedFolders: [], sortPref: 'dateAsc', openFolders: [] }, (data) => {
      folderList.innerHTML = "";
      const folders = data.folders;
      const pinnedFolders = data.pinnedFolders;
      const sortPref = data.sortPref;
      let savedOpenFolders = data.openFolders; // Memorized state of open folders
      let hasResults = false;

      const sortedFolderNames = Object.keys(folders).sort((a, b) => {
        const aPinned = pinnedFolders.includes(a);
        const bPinned = pinnedFolders.includes(b);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return a.localeCompare(b);
      });

      let hasPinned = false;
      let transitionDone = false;

      sortedFolderNames.forEach((folderName) => {
        let chats = folders[folderName];

        chats.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          if (sortPref === 'dateDesc') return timeB - timeA;
          if (sortPref === 'dateAsc') return timeA - timeB;
          if (sortPref === 'alphaAsc') return a.title.localeCompare(b.title);
          return 0;
        });

        const folderMatches = folderName.toLowerCase().includes(searchTerm);
        const matchingChats = chats.filter(chat => chat.title.toLowerCase().includes(searchTerm));

        if (searchTerm && !folderMatches && matchingChats.length === 0) return;
        hasResults = true;

        const isPinned = pinnedFolders.includes(folderName);

        if (isPinned) hasPinned = true;
        if (!isPinned && hasPinned && !transitionDone && !searchTerm) {
          const divider = document.createElement('hr');
          divider.className = 'pin-divider';
          folderList.appendChild(divider);
          transitionDone = true;
        }

        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';

        folderDiv.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (!folderDiv.classList.contains('is-source-folder')) {
            folderDiv.classList.add('drag-over');
          }
        });

        folderDiv.addEventListener('dragleave', () => {
          folderDiv.classList.remove('drag-over');
        });

        folderDiv.addEventListener('drop', (e) => {
          e.preventDefault();
          folderDiv.classList.remove('drag-over');
          const dragData = e.dataTransfer.getData('text/plain');
          if (!dragData) return;
          const { sourceFolder, chatUrl } = JSON.parse(dragData);
          if (sourceFolder === folderName) return;
          moveChat(sourceFolder, folderName, chatUrl);
        });

        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        folderHeader.style.display = 'flex';
        folderHeader.style.justifyContent = 'space-between';

        const leftPart = document.createElement('div');
        leftPart.style.display = 'flex';

        // --- Different folder icon if empty (📁) or full (🗂️) ---
        const emojiRegex = /^((?:\p{Emoji_Presentation}|\p{Extended_Pictographic})\uFE0F?)\s*/u;
        const match = folderName.match(emojiRegex);

        let customIcon = null;
        let displayName = folderName;

        if (match) {
          customIcon = match[1]; // Emoji found
          displayName = folderName.replace(emojiRegex, ''); // Name without emoji
        }

        const isEmpty = chats.length === 0;
        // If there is a custom emoji we use it, otherwise default.
        const folderIcon = customIcon ? customIcon : (isEmpty ? '📁' : '🗂️');

        leftPart.innerHTML = `<span class="folder-icon">${folderIcon}</span><div class="folder-name">${displayName}</div>`;

        const actionsDiv = document.createElement('div');

        const pinBtn = document.createElement('button');
        pinBtn.className = `action-btn pin-btn ${isPinned ? 'is-pinned' : ''}`;
        pinBtn.innerHTML = isPinned ? '📌' : '📍';
        pinBtn.title = chrome.i18n.getMessage(isPinned ? "btnUnpin" : "btnPin");
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePin(folderName);
        });
        actionsDiv.appendChild(pinBtn);

        if (!isEmpty) {
          const openGroupBtn = document.createElement('button');
          openGroupBtn.className = 'action-btn open-group-btn';
          openGroupBtn.innerHTML = '📑';
          openGroupBtn.title = chrome.i18n.getMessage("btnOpenGroup") || "Open in Tab Group";
          openGroupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFolderInTabGroup(folderName, chats);
          });
          actionsDiv.appendChild(openGroupBtn);
        }

        const editFolderBtn = document.createElement('button');
        editFolderBtn.className = 'action-btn edit-btn';
        editFolderBtn.innerHTML = '✏️';
        editFolderBtn.title = chrome.i18n.getMessage("btnRenameFolder");
        editFolderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          renameFolder(folderName);
        });
        actionsDiv.appendChild(editFolderBtn);

        const delFolderBtn = document.createElement('button');
        delFolderBtn.className = 'action-btn delete-btn';
        delFolderBtn.innerHTML = '🗑️';
        delFolderBtn.title = chrome.i18n.getMessage("btnDeleteFolder");
        delFolderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (chats.length > 0) {
            if (!confirm(chrome.i18n.getMessage("confirmDeleteFolder"))) return;
          }
          loadData({ folders: {}, pinnedFolders: [] }, (data) => {
            delete data.folders[folderName];
            let updatedPinned = data.pinnedFolders.filter(name => name !== folderName);
            saveData({ folders: data.folders, pinnedFolders: updatedPinned }, () => {
              displayFolders(null, searchInput.value.toLowerCase());
            });
          });
        });
        actionsDiv.appendChild(delFolderBtn);

        folderHeader.appendChild(leftPart);
        folderHeader.appendChild(actionsDiv);

        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';

        // --- Smart Open/Closed state management ---
        let isFolderOpen = false;

        if (searchTerm) {
          // If searching, open automatically if it matches
          isFolderOpen = true;
        } else {
          // Otherwise, rely on memorized history (default is closed unless saved)
          isFolderOpen = savedOpenFolders.includes(folderName) || openFolders.includes(folderName);
        }

        // Fix double-click bug by explicitly setting block or none upon creation
        folderContent.style.display = isFolderOpen ? 'block' : 'none';

        folderHeader.addEventListener('click', () => {
          folderNameInput.value = folderName;
          const isCurrentlyOpen = folderContent.style.display === 'block';
          folderContent.style.display = isCurrentlyOpen ? 'none' : 'block';

          // Save new state in Chrome Sync only if not searching
          if (!searchTerm) {
            loadData({ openFolders: [] }, (storageData) => {
              let currentOpen = storageData.openFolders;
              if (isCurrentlyOpen) {
                // Close it: remove from the list
                currentOpen = currentOpen.filter(name => name !== folderName);
              } else {
                // Open it: add to the list
                if (!currentOpen.includes(folderName)) currentOpen.push(folderName);
              }
              saveData({ openFolders: currentOpen });
            });
          }
        });
        // ----------------------------------------------------------------

        let appendedChatsCount = 0;

        chats.forEach((chat, index) => {
          if (searchTerm && !chat.title.toLowerCase().includes(searchTerm) && !folderMatches) return;

          appendedChatsCount++;
          const chatItem = document.createElement('div');
          chatItem.className = 'chat-item';

          //Multiple selection
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'chat-checkbox';
          checkbox.dataset.folder = folderName;
          checkbox.dataset.url = chat.url;
          // Keep checkbox if redraw
          if (selectedChats.some(c => c.url === chat.url)) checkbox.checked = true;

          checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
              selectedChats.push({ folder: folderName, url: chat.url, chatObj: chat });
            } else {
              selectedChats = selectedChats.filter(c => c.url !== chat.url);
            }
            updateBulkActionBar();
          });

          chatItem.appendChild(checkbox);

          // Make the element draggable
          chatItem.setAttribute('draggable', 'true');

          chatItem.addEventListener('dragstart', (e) => {
            if (document.body.classList.contains('bulk-active')) {
              e.preventDefault();
              return;
            }
            chatItem.classList.add('dragging');
            document.body.classList.add('is-dragging');
            folderDiv.classList.add('is-source-folder');
            // Use chat.url instead of index
            const dataToTransfer = JSON.stringify({ sourceFolder: folderName, chatUrl: chat.url });
            e.dataTransfer.setData('text/plain', dataToTransfer);
            e.dataTransfer.effectAllowed = 'move';
          });

          chatItem.addEventListener('dragend', () => {
            chatItem.classList.remove('dragging');
            document.body.classList.remove('is-dragging');
            folderDiv.classList.remove('is-source-folder');
          });

          const link = document.createElement('a');
          link.className = 'chat-link';
          link.href = chat.url;
          link.target = '_blank';
          link.title = chat.title;
          link.textContent = chat.title;

          link.setAttribute('draggable', 'false');

          // Container for conversation buttons
          const chatActionsDiv = document.createElement('div');
          chatActionsDiv.className = 'chat-actions';

          const editBtn = document.createElement('button');
          editBtn.className = 'action-btn edit-btn';
          editBtn.innerHTML = '✏️';
          editBtn.title = chrome.i18n.getMessage("btnRename");
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Pass chat.url
            renameChat(folderName, chat.url, chat.title);
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'action-btn delete-btn';
          delBtn.innerHTML = '🗑️';
          delBtn.title = chrome.i18n.getMessage("btnDelete");
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Pass chat.url
            deleteChat(folderName, chat.url);
          });

          chatActionsDiv.appendChild(editBtn);
          chatActionsDiv.appendChild(delBtn);

          chatItem.appendChild(link);
          chatItem.appendChild(chatActionsDiv);
          folderContent.appendChild(chatItem);
        });

        folderDiv.appendChild(folderHeader);
        if (appendedChatsCount > 0) folderDiv.appendChild(folderContent);
        folderList.appendChild(folderDiv);

      }); // End of forEach

      noResultsDiv.style.display = (searchTerm && !hasResults) ? 'block' : 'none';
    });
  }
  // 5. Rename
  function renameChat(folderName, chatUrl, currentTitle) {
    const newTitle = prompt(chrome.i18n.getMessage("promptRename"), currentTitle);
    if (newTitle !== null && newTitle.trim() !== "") {
      loadData({ folders: {} }, (data) => {
        let folders = data.folders;
        // Find the real index in the database via URL
        const realIndex = folders[folderName].findIndex(c => c.url === chatUrl);
        if (realIndex !== -1) {
          folders[folderName][realIndex].title = newTitle.trim();
          saveData({ folders: folders }, () => {
            displayFolders(folderName, searchInput.value.toLowerCase());
          });
        }
      });
    }
  }

  // 6. Delete
  function deleteChat(folderName, chatUrl) {
    loadData({ folders: {} }, (data) => {
      let folders = data.folders;
      const realIndex = folders[folderName].findIndex(c => c.url === chatUrl);
      if (realIndex !== -1) {
        folders[folderName].splice(realIndex, 1);
        saveData({ folders: folders }, () => {
          displayFolders(folderName, searchInput.value.toLowerCase());
        });
      }
    });
  }

  // 7. Move a conversation (Drag & Drop)
  function moveChat(sourceFolder, targetFolder, chatUrl) {
    loadData({ folders: {}, openFolders: [] }, (data) => {
      let folders = data.folders;

      const realIndex = folders[sourceFolder].findIndex(c => c.url === chatUrl);
      if (realIndex === -1) return; // Security

      // Remove conversation from source folder
      const chatToMove = folders[sourceFolder].splice(realIndex, 1)[0];

      // Ensure target folder exists
      if (!folders[targetFolder]) folders[targetFolder] = [];

      // Prevent duplicates in target folder
      const isDuplicate = folders[targetFolder].some(chat => chat.url === chatToMove.url);
      if (!isDuplicate) {
        folders[targetFolder].push(chatToMove);
      }

      // Memorize all currently open folders
      let openFolders = [];
      document.querySelectorAll('.folder').forEach(folder => {
        const content = folder.querySelector('.folder-content');
        if (content && content.style.display === 'block') {
          openFolders.push(folder.querySelector('.folder-name').textContent);
        }
      });

      // Ensure destination folder will also be open
      if (!openFolders.includes(targetFolder)) {
        openFolders.push(targetFolder);
      }

      // --- Save 'folders' AND the new state of 'openFolders' ---
      saveData({ folders: folders, openFolders: openFolders }, () => {
        displayFolders(openFolders, searchInput.value.toLowerCase());
      });
      // --------------------------------------------------------------------------------
    });
  }
  // 8. Pin / Unpin a folder
  function togglePin(folderName) {
    loadData({ pinnedFolders: [] }, (data) => {
      let pinned = data.pinnedFolders;

      if (pinned.includes(folderName)) {
        // If already pinned, remove from list
        pinned = pinned.filter(name => name !== folderName);
      } else {
        // Otherwise, add it
        pinned.push(folderName);
      }

      saveData({ pinnedFolders: pinned }, () => {
        // Refresh display while keeping search active
        displayFolders(null, searchInput.value.toLowerCase());
      });
    });
  }
  // 9. Rename a folder
  function renameFolder(oldName) {
    const newName = prompt(chrome.i18n.getMessage("promptRenameFolder"), oldName);

    // If user cancels, leaves empty, or doesn't change name
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;

    const trimmedNewName = newName.trim();

    loadData({ folders: {}, pinnedFolders: [] }, (data) => {
      let folders = data.folders;
      let pinned = data.pinnedFolders;

      // Check we are not overwriting another folder
      if (folders[trimmedNewName]) {
        alert(chrome.i18n.getMessage("errorFolderExists") || "This folder already exists");
        return;
      }

      // 1. Transfer all conversations to the new name
      folders[trimmedNewName] = folders[oldName];
      // 2. Delete the old folder
      delete folders[oldName];

      // 3. Update pin list if this folder was in it
      const pinIndex = pinned.indexOf(oldName);
      if (pinIndex !== -1) {
        pinned[pinIndex] = trimmedNewName;
      }

      saveData({ folders: folders, pinnedFolders: pinned }, () => {
        // Refresh display while keeping folder open
        displayFolders(trimmedNewName, searchInput.value.toLowerCase());
      });
    });
  }

  const storageTooltip = document.getElementById('storageTooltip');
  if (storageTooltip) {
    storageTooltip.title = chrome.i18n.getMessage("storageCalc") || "Calcul...";
  }

  function updateStorageBar() {

    chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        console.error("❌ [StorageBar] Erreur de l'API :", chrome.runtime.lastError);
        return;
      }

      const currentBytes = bytesInUse || 0;
      const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400;
      const percentage = (currentBytes / maxBytes) * 100;

      const storageFill = document.getElementById('storageFill');
      const storageTooltip = document.getElementById('storageTooltip');

      if (!storageFill || !storageTooltip) {
        return;
      }

      storageFill.style.width = `${Math.min(percentage, 100)}%`;

      const kbUsed = (currentBytes / 1024).toFixed(1);
      const kbMax = (maxBytes / 1024).toFixed(0);

      let infoTemplate = chrome.i18n.getMessage("storageInfo");

      if (infoTemplate) {
        storageTooltip.title = infoTemplate
          .replace("{used}", kbUsed)
          .replace("{max}", kbMax)
          .replace("{pct}", percentage.toFixed(1));
      } else {
        storageTooltip.title = `${kbUsed} Ko / ${kbMax} Ko (${percentage.toFixed(1)}%)`;
      }

      if (percentage > 90) {
        storageFill.classList.add('warning');
      } else {
        storageFill.classList.remove('warning');
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      setTimeout(updateStorageBar, 100);
    }
  });

  updateStorageBar();

  // 10. Open folder in Chrome Active Tab group
  async function openFolderInTabGroup(folderName, chats) {
    if (chats.length === 0) return;

    if (chats.length > 10) {
      let confirmMsg = chrome.i18n.getMessage("confirmOpenManyTabs");
      if (confirmMsg) {
        confirmMsg = confirmMsg.replace("{count}", chats.length);
      } else {
        confirmMsg = `Open ${chats.length} tabs?`;
      }

      if (!confirm(confirmMsg)) {
        return;
      }
    }

    try {
      const tabIds = [];

      // 1. Create all tabs in background
      for (const chat of chats) {
        const tab = await chrome.tabs.create({ url: chat.url, active: false });
        tabIds.push(tab.id);
      }

      // 2. Group tabs
      if (tabIds.length > 0) {
        const groupId = await chrome.tabs.group({ tabIds: tabIds });

        // 3. Customize group
        await chrome.tabGroups.update(groupId, {
          title: folderName,
          color: "blue", // Options: grey, blue, red, yellow, green, pink, purple, cyan, orange
          collapsed: false
        });

        // 4. Focus on first tab
        await chrome.tabs.update(tabIds[0], { active: true });
      }
    } catch (error) {
      console.error("Tab Group Creation Error:", error);
      const alertMsg = chrome.i18n.getMessage("errorTabGroup") || "Error creating tab group. Check permissions.";
      alert(alertMsg);
    }
  }

  // --- 11. BULK ACTIONS ---
  const bulkActionBar = document.getElementById('bulkActionBar');
  const bulkCount = document.getElementById('bulkCount');
  const bulkMoveSelect = document.getElementById('bulkMoveSelect');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkCancelBtn = document.getElementById('bulkCancelBtn');
  bulkCancelBtn.title = chrome.i18n.getMessage("bulkCancel") || "Cancel";

  function updateBulkActionBar() {
    if (selectedChats.length > 0) {
      bulkActionBar.style.display = 'flex';
      document.body.classList.add('bulk-active');

      // Update text
      let countMsg = chrome.i18n.getMessage("bulkSelected") || "{count} selected";
      bulkCount.textContent = countMsg.replace("{count}", selectedChats.length);

      // Refresh folder list
      loadData({ folders: {} }, (data) => {
        bulkMoveSelect.innerHTML = `<option value="" disabled selected>${chrome.i18n.getMessage("bulkMove") || "Move to..."}</option>`;
        Object.keys(data.folders).sort().forEach(folder => {
          // Détection d'émoji pour ajouter le dossier par défaut si besoin
          const emojiRegex = /^((?:\p{Emoji_Presentation}|\p{Extended_Pictographic})\uFE0F?)\s*/u;
          const hasCustomEmoji = emojiRegex.test(folder);
          const iconPrefix = hasCustomEmoji ? '' : '📁 ';

          const option = document.createElement('option');
          option.value = folder;
          option.textContent = `${iconPrefix}${folder}`;
          bulkMoveSelect.appendChild(option);
        });
      });
    } else {
      bulkActionBar.style.display = 'none';
      document.body.classList.remove('bulk-active');
      bulkMoveSelect.innerHTML = ''; // Cleanup
    }
  }

  // Cancel selection
  bulkCancelBtn.addEventListener('click', () => {
    selectedChats = [];
    displayFolders(null, searchInput.value.toLowerCase()); // Redessine pour décocher
    updateBulkActionBar();
  });

  // Delete selected
  bulkDeleteBtn.addEventListener('click', () => {
    let confirmMsg = chrome.i18n.getMessage("confirmBulkDelete") || "Delete these {count} conversations?";
    if (!confirm(confirmMsg.replace("{count}", selectedChats.length))) return;

    loadData({ folders: {} }, (data) => {
      let folders = data.folders;

      selectedChats.forEach(item => {
        if (folders[item.folder]) {
          folders[item.folder] = folders[item.folder].filter(c => c.url !== item.url);
        }
      });

      saveData({ folders: folders }, () => {
        selectedChats = []; // Vider la sélection
        displayFolders(null, searchInput.value.toLowerCase());
        updateBulkActionBar();
      });
    });
  });

  // Move selected
  bulkMoveSelect.addEventListener('change', (e) => {
    const targetFolder = e.target.value;
    if (!targetFolder) return;

    loadData({ folders: {}, openFolders: [] }, (data) => {
      let folders = data.folders;
      let openFolders = data.openFolders;

      if (!folders[targetFolder]) folders[targetFolder] = [];

      selectedChats.forEach(item => {
        // 1. Remove from source folder
        if (folders[item.folder]) {
          folders[item.folder] = folders[item.folder].filter(c => c.url !== item.url);
        }
        // 2. Add to target folder (no duplicate)
        const isDuplicate = folders[targetFolder].some(c => c.url === item.url);
        if (!isDuplicate) {
          folders[targetFolder].push(item.chatObj);
        }
      });

      // Open target folder
      if (!openFolders.includes(targetFolder)) openFolders.push(targetFolder);

      saveData({ folders: folders, openFolders: openFolders }, () => {
        selectedChats = []; // Empty selection
        displayFolders(openFolders, searchInput.value.toLowerCase());
        updateBulkActionBar();
      });
    });
  });
});