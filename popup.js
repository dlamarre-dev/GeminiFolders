document.addEventListener('DOMContentLoaded', async () => {
  // --- NOUVEAU : Traduction de l'interface ---
  document.getElementById('appTitle').textContent = chrome.i18n.getMessage("appTitle");
  document.getElementById('searchInput').placeholder = chrome.i18n.getMessage("searchPlaceholder");
  document.getElementById('folderName').placeholder = chrome.i18n.getMessage("folderPlaceholder");
  document.getElementById('chatTitle').placeholder = chrome.i18n.getMessage("chatPlaceholder");
  document.getElementById('saveBtn').textContent = chrome.i18n.getMessage("saveBtn");
  document.getElementById('status').textContent = chrome.i18n.getMessage("statusSaved");
  document.getElementById('noResults').textContent = chrome.i18n.getMessage("noResults");
  document.getElementById('exportBtn').textContent = chrome.i18n.getMessage("exportBtn");
  document.getElementById('importBtn').textContent = chrome.i18n.getMessage("importBtn");
  // -------------------------------------------

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
  newFolderBtn.textContent = chrome.i18n.getMessage("btnNewFolder");

  newFolderBtn.addEventListener('click', () => {
    const name = prompt(chrome.i18n.getMessage("promptNewFolder"));
    if (name && name.trim()) {
      chrome.storage.sync.get({ folders: {} }, (data) => {
        if (!data.folders[name.trim()]) {
          data.folders[name.trim()] = []; // Crée le dossier vide
          chrome.storage.sync.set({ folders: data.folders }, () => displayFolders());
        }
      });
    }
  });

  // Pré-remplissage du titre
  let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab && currentTab.url.includes("gemini.google.com")) {
    let cleanTitle = currentTab.title.replace(" - Gemini", "").replace("Google Gemini", "").trim();
    chatTitleInput.value = cleanTitle || chrome.i18n.getMessage("defaultTitle");
  }

  displayFolders();

  // Écouteur pour la recherche
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    displayFolders(null, searchTerm);
  });

  // 1. Sauvegarder
  saveBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes("gemini.google.com")) {
      alert(chrome.i18n.getMessage("alertNotGemini"));
      return;
    }

    const folderName = folderNameInput.value.trim() || chrome.i18n.getMessage("defaultFolder");
    const finalChatTitle = chatTitleInput.value.trim() || chrome.i18n.getMessage("defaultTitle");
    const chatUrl = tab.url;

    chrome.storage.sync.get({ folders: {} }, (data) => {
      let folders = data.folders;
      if (!folders[folderName]) folders[folderName] = [];

      const isDuplicate = folders[folderName].some(chat => chat.url === chatUrl);
      if (!isDuplicate) {
        folders[folderName].push({ title: finalChatTitle, url: chatUrl });
      }

      chrome.storage.sync.set({ folders: folders }, () => {
        folderNameInput.value = "";
        searchInput.value = "";
        statusDiv.style.display = "block";
        setTimeout(() => { statusDiv.style.display = "none"; }, 2000);
        displayFolders(folderName);
      });
    });
  });

  // 2. Exporter
  exportBtn.addEventListener('click', () => {
    chrome.storage.sync.get({ folders: {} }, (data) => {
      if (Object.keys(data.folders).length === 0) {
        alert(chrome.i18n.getMessage("alertEmptyExport"));
        return;
      }
      const dataString = JSON.stringify(data.folders, null, 2);
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

  // 3. Importer
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

        chrome.storage.sync.get({ folders: {} }, (data) => {
          let currentFolders = data.folders;

          for (const [folderName, chats] of Object.entries(importedData)) {
            if (!currentFolders[folderName]) currentFolders[folderName] = [];
            chats.forEach(importedChat => {
              if (importedChat.title && importedChat.url) {
                const isDuplicate = currentFolders[folderName].some(chat => chat.url === importedChat.url);
                if (!isDuplicate) currentFolders[folderName].push(importedChat);
              }
            });
          }

          chrome.storage.sync.set({ folders: currentFolders }, () => {
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

  // 4. Afficher et Filtrer les dossiers (Mise à jour pour Drag & Drop)
  function displayFolders(openFolderName = null, searchTerm = "") {
    chrome.storage.sync.get({ folders: {} }, (data) => {
      folderList.innerHTML = "";
      const folders = data.folders;
      let hasResults = false;

      for (const [folderName, chats] of Object.entries(folders)) {
        const folderMatches = folderName.toLowerCase().includes(searchTerm);
        const matchingChats = chats.filter(chat => chat.title.toLowerCase().includes(searchTerm));

        if (searchTerm && !folderMatches && matchingChats.length === 0) continue;
        hasResults = true;

        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';

        // --- NOUVEAU : Écouteurs pour le Drop sur le dossier ---
        folderDiv.addEventListener('dragover', (e) => {
          e.preventDefault(); // Nécessaire pour autoriser le drop
          folderDiv.classList.add('drag-over');
        });

        folderDiv.addEventListener('dragleave', () => {
          folderDiv.classList.remove('drag-over');
        });

        folderDiv.addEventListener('drop', (e) => {
          e.preventDefault();
          folderDiv.classList.remove('drag-over');

          // On récupère les données de l'élément glissé
          const dragData = e.dataTransfer.getData('application/json');
          if (!dragData) return;

          const { sourceFolder, chatIndex } = JSON.parse(dragData);

          // Si on le lâche dans le même dossier, on ne fait rien
          if (sourceFolder === folderName) return;

          moveChat(sourceFolder, folderName, chatIndex);
        });
        // -------------------------------------------------------

        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        folderHeader.style.display = 'flex';
        folderHeader.style.justifyContent = 'space-between';

        const leftPart = document.createElement('div');
        leftPart.style.display = 'flex';
        leftPart.innerHTML = `<span class="folder-icon">📁</span><div class="folder-name">${folderName}</div>`;

        // --- NOUVEAU : Bouton pour supprimer le dossier entier ---
        const delFolderBtn = document.createElement('button');
        delFolderBtn.className = 'action-btn delete-btn';
        delFolderBtn.innerHTML = '🗑️'; // Une corbeille pour différencier du X des conversations
        delFolderBtn.title = chrome.i18n.getMessage("btnDeleteFolder");
        delFolderBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Empêche le dossier de s'ouvrir/se fermer quand on clique sur la corbeille

          // Sécurité : demander confirmation si le dossier n'est pas vide
          if (chats.length > 0) {
            if (!confirm(chrome.i18n.getMessage("confirmDeleteFolder"))) return;
          }

          // Supprimer le dossier de la base de données
          chrome.storage.sync.get({ folders: {} }, (data) => {
            delete data.folders[folderName];
            chrome.storage.sync.set({ folders: data.folders }, () => {
              displayFolders(null, searchInput.value.toLowerCase());
            });
          });
        });

        folderHeader.appendChild(leftPart);
        folderHeader.appendChild(delFolderBtn);
        // ---------------------------------------------------------

        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';

        if (searchTerm || folderName === openFolderName) {
          folderContent.style.display = 'block';
        }

        folderHeader.addEventListener('click', () => {
          folderNameInput.value = folderName;
          const isOpen = folderContent.style.display === 'block';
          folderContent.style.display = isOpen ? 'none' : 'block';
        });

        let appendedChatsCount = 0;

        chats.forEach((chat, index) => {
          if (searchTerm && !chat.title.toLowerCase().includes(searchTerm) && !folderMatches) return;

          appendedChatsCount++;
          const chatItem = document.createElement('div');
          chatItem.className = 'chat-item';

          // --- NOUVEAU : Rendre l'élément draggable ---
          chatItem.setAttribute('draggable', 'true');

          chatItem.addEventListener('dragstart', (e) => {
            chatItem.classList.add('dragging');
            // On emballe les infos de l'élément pour le voyage
            const dataToTransfer = JSON.stringify({ sourceFolder: folderName, chatIndex: index });
            e.dataTransfer.setData('application/json', dataToTransfer);
            e.dataTransfer.effectAllowed = 'move';
          });

          chatItem.addEventListener('dragend', () => {
            chatItem.classList.remove('dragging');
          });
          // --------------------------------------------

          const link = document.createElement('a');
          link.className = 'chat-link';
          link.href = chat.url;
          link.target = '_blank';
          link.title = chat.title;
          link.textContent = `↳ ${chat.title}`;

          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'chat-actions';

          const editBtn = document.createElement('button');
          editBtn.className = 'action-btn edit-btn';
          editBtn.innerHTML = '✏️';
          editBtn.title = chrome.i18n.getMessage("btnRename");
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameChat(folderName, index, chat.title);
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'action-btn delete-btn';
          delBtn.innerHTML = '❌';
          delBtn.title = chrome.i18n.getMessage("btnDelete");
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(folderName, index);
          });

          actionsDiv.appendChild(editBtn);
          actionsDiv.appendChild(delBtn);

          chatItem.appendChild(link);
          chatItem.appendChild(actionsDiv);
          folderContent.appendChild(chatItem);
        });

        folderDiv.appendChild(folderHeader);
        if (appendedChatsCount > 0) folderDiv.appendChild(folderContent);
        folderList.appendChild(folderDiv);
      }

      noResultsDiv.style.display = (searchTerm && !hasResults) ? 'block' : 'none';
    });
  }

  // 5. Renommer
  function renameChat(folderName, index, currentTitle) {
    const newTitle = prompt(chrome.i18n.getMessage("promptRename"), currentTitle);
    if (newTitle !== null && newTitle.trim() !== "") {
      chrome.storage.sync.get({ folders: {} }, (data) => {
        data.folders[folderName][index].title = newTitle.trim();
        chrome.storage.sync.set({ folders: data.folders }, () => {
          displayFolders(folderName, searchInput.value.toLowerCase());
        });
      });
    }
  }

  // 6. Supprimer
  function deleteChat(folderName, index) {
    chrome.storage.sync.get({ folders: {} }, (data) => {
      data.folders[folderName].splice(index, 1);
      chrome.storage.sync.set({ folders: data.folders }, () => {
        displayFolders(folderName, searchInput.value.toLowerCase()); 
      });
    });
  }
  // 7. Déplacer une conversation (Drag & Drop)
  function moveChat(sourceFolder, targetFolder, chatIndex) {
    chrome.storage.sync.get({ folders: {} }, (data) => {
      let folders = data.folders;

      // On retire la conversation du dossier source
      const chatToMove = folders[sourceFolder].splice(chatIndex, 1)[0];

      // On s'assure que le dossier cible existe (au cas où)
      if (!folders[targetFolder]) folders[targetFolder] = [];

      // Petite vérification anti-doublon dans le dossier cible
      const isDuplicate = folders[targetFolder].some(chat => chat.url === chatToMove.url);
      if (!isDuplicate) {
        folders[targetFolder].push(chatToMove);
      }

      // On sauvegarde la nouvelle hiérarchie et on rafraîchit l'interface
      chrome.storage.sync.set({ folders: folders }, () => {
        // On garde le dossier cible ouvert pour que l'utilisateur voie son action réussie
        displayFolders(targetFolder, searchInput.value.toLowerCase());
      });
    });
  }
});