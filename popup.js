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
  const sortSelect = document.getElementById('sortSelect');

  // Remplir les options du menu
  sortSelect.innerHTML = `
    <option value="dateAsc">${chrome.i18n.getMessage("sortOldest")}</option>
    <option value="dateDesc">${chrome.i18n.getMessage("sortNewest")}</option>
    <option value="alphaAsc">${chrome.i18n.getMessage("sortAlpha")}</option>
  `;

  // Charger la préférence de tri de l'utilisateur (ou "dateAsc" par défaut)
  chrome.storage.sync.get({ sortPref: 'dateAsc' }, (data) => {
    sortSelect.value = data.sortPref;
  });

  // Quand l'utilisateur change le tri, on sauvegarde et on rafraîchit
  sortSelect.addEventListener('change', (e) => {
    chrome.storage.sync.set({ sortPref: e.target.value }, () => {

      // On cherche quel dossier est actuellement ouvert à l'écran ---
      let currentOpenFolder = null;
      const folderElements = document.querySelectorAll('.folder');

      folderElements.forEach(folder => {
        const content = folder.querySelector('.folder-content');
        if (content && content.style.display === 'block') {
          currentOpenFolder = folder.querySelector('.folder-name').textContent;
        }
      });
      // -------------------------------------------------------------------------

      // On rafraîchit l'affichage en gardant ce dossier ouvert
      displayFolders(currentOpenFolder, searchInput.value.toLowerCase());
    });
  });

  // Pré-remplissage intelligent du titre
  let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (currentTab && currentTab.url.includes("gemini.google.com")) {
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        // --- CE CODE S'EXÉCUTE DANS LA PAGE WEB ---
        const currentPath = window.location.pathname;
        if (currentPath && currentPath.includes("/app/")) {
          const links = document.querySelectorAll(`a[href="${currentPath}"]`);
          for (let link of links) {
            let text = link.innerText.trim();
            if (text && text.length > 1) {
              return text.split('\n')[0].trim();
            }
          }
        }

        let docTitle = document.title.replace(" - Gemini", "").replace("Google Gemini", "").trim();
        if (docTitle && docTitle !== "Gemini" && docTitle !== "Discussions" && docTitle !== "Chats") {
            return docTitle;
        }

        const firstUserMessage = document.querySelector('[data-message-author-role="user"], message-content');
        if (firstUserMessage && firstUserMessage.innerText) {
          let excerpt = firstUserMessage.innerText.trim();
          return excerpt.length > 40 ? excerpt.substring(0, 40) + "..." : excerpt;
        }

        return null;
        // ------------------------------------------
      }
    }, (injectionResults) => {
      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        chatTitleInput.value = injectionResults[0].result;
      } else {
        chatTitleInput.value = chrome.i18n.getMessage("defaultTitle");
      }
    });
  }

  // Initialisation de l'affichage
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
        folders[folderName].push({
          title: finalChatTitle,
          url: chatUrl,
          timestamp: Date.now()
        });
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

  // 2. Exporter (Mise à jour pour inclure les épingles)
  exportBtn.addEventListener('click', () => {
    // NOUVEAU : On récupère à la fois les dossiers et les épingles
    chrome.storage.sync.get({ folders: {}, pinnedFolders: [] }, (data) => {
      if (Object.keys(data.folders).length === 0) {
        alert(chrome.i18n.getMessage("alertEmptyExport"));
        return;
      }
      // NOUVEAU : On exporte l'objet global "data" qui contient les deux clés
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

  // 3. Importer (Mise à jour pour la rétrocompatibilité)
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

        chrome.storage.sync.get({ folders: {}, pinnedFolders: [] }, (data) => {
          let currentFolders = data.folders;
          let currentPinned = data.pinnedFolders;

          // --- GESTION DE LA RÉTROCOMPATIBILITÉ ---
          let foldersToImport = {};
          let pinsToImport = [];

          // Si le JSON contient une clé "folders", c'est le nouveau format (v2.0)
          if (importedData.folders) {
            foldersToImport = importedData.folders;
            if (Array.isArray(importedData.pinnedFolders)) {
              pinsToImport = importedData.pinnedFolders;
            }
          } else {
            // Sinon, c'est l'ancien format (v1.2) où tout l'objet est la liste des dossiers
            foldersToImport = importedData;
          }
          // ----------------------------------------

          // 1. Fusion des dossiers et conversations
          for (const [folderName, chats] of Object.entries(foldersToImport)) {
            if (!currentFolders[folderName]) currentFolders[folderName] = [];
            chats.forEach(importedChat => {
              if (importedChat.title && importedChat.url) {
                const isDuplicate = currentFolders[folderName].some(chat => chat.url === importedChat.url);
                if (!isDuplicate) currentFolders[folderName].push(importedChat);
              }
            });
          }

          // 2. Fusion des épingles (sans créer de doublons)
          pinsToImport.forEach(pin => {
            // On vérifie que l'épingle n'est pas déjà présente ET que le dossier existe bien
            if (!currentPinned.includes(pin) && currentFolders[pin]) {
              currentPinned.push(pin);
            }
          });

          // Sauvegarde finale
          chrome.storage.sync.set({ folders: currentFolders, pinnedFolders: currentPinned }, () => {
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

// 4. Afficher et Filtrer les dossiers (Mise à jour pour le Tri)
  function displayFolders(openFolderName = null, searchTerm = "") {
    // On récupère aussi sortPref ---
    chrome.storage.sync.get({ folders: {}, pinnedFolders: [], sortPref: 'dateAsc' }, (data) => {
      folderList.innerHTML = "";
      const folders = data.folders;
      const pinnedFolders = data.pinnedFolders;
      const sortPref = data.sortPref; // On stocke la préférence
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
        let chats = folders[folderName]; // On utilise 'let' car on va trier ce tableau

        // La logique de tri JavaScript ---
        chats.sort((a, b) => {
          // Fallback : si c'est une ancienne conversation sans date, on met 0
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;

          if (sortPref === 'dateDesc') return timeB - timeA; // Plus récent
          if (sortPref === 'dateAsc') return timeA - timeB;  // Plus ancien
          if (sortPref === 'alphaAsc') return a.title.localeCompare(b.title); // A à Z
          return 0;
        });
        // ----------------------------------------------

        const folderMatches = folderName.toLowerCase().includes(searchTerm);
        const matchingChats = chats.filter(chat => chat.title.toLowerCase().includes(searchTerm));

        if (searchTerm && !folderMatches && matchingChats.length === 0) return;
        hasResults = true;

        const isPinned = pinnedFolders.includes(folderName);

        // Insérer le diviseur visuel
        if (isPinned) hasPinned = true;
        if (!isPinned && hasPinned && !transitionDone && !searchTerm) {
          const divider = document.createElement('hr');
          divider.className = 'pin-divider';
          folderList.appendChild(divider);
          transitionDone = true;
        }

        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';

        // Écouteurs pour le Drop sur le dossier
        folderDiv.addEventListener('dragover', (e) => {
          e.preventDefault();
          folderDiv.classList.add('drag-over');
        });

        folderDiv.addEventListener('dragleave', () => {
          folderDiv.classList.remove('drag-over');
        });

        folderDiv.addEventListener('drop', (e) => {
          e.preventDefault();
          folderDiv.classList.remove('drag-over');

          const dragData = e.dataTransfer.getData('text/plain');
          if (!dragData) return;

          // NOUVEAU : On extrait chatUrl de la valise
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
        leftPart.innerHTML = `<span class="folder-icon">📁</span><div class="folder-name">${folderName}</div>`;

        // Le conteneur pour les boutons du dossier
        const actionsDiv = document.createElement('div');

        // Bouton Épingler
        const pinBtn = document.createElement('button');
        pinBtn.className = `action-btn pin-btn ${isPinned ? 'is-pinned' : ''}`;
        pinBtn.innerHTML = isPinned ? '📌' : '📍';
        pinBtn.title = chrome.i18n.getMessage(isPinned ? "btnUnpin" : "btnPin");
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePin(folderName);
        });
        actionsDiv.appendChild(pinBtn);

        // Bouton pour supprimer le dossier entier
        const delFolderBtn = document.createElement('button');
        delFolderBtn.className = 'action-btn delete-btn';
        delFolderBtn.innerHTML = '🗑️';
        delFolderBtn.title = chrome.i18n.getMessage("btnDeleteFolder");
        delFolderBtn.addEventListener('click', (e) => {
          e.stopPropagation();

          if (chats.length > 0) {
            if (!confirm(chrome.i18n.getMessage("confirmDeleteFolder"))) return;
          }

          chrome.storage.sync.get({ folders: {}, pinnedFolders: [] }, (data) => {
            delete data.folders[folderName];
            // Nettoyage des épingles si on supprime le dossier
            let updatedPinned = data.pinnedFolders.filter(name => name !== folderName);
            chrome.storage.sync.set({ folders: data.folders, pinnedFolders: updatedPinned }, () => {
              displayFolders(null, searchInput.value.toLowerCase());
            });
          });
        });
        actionsDiv.appendChild(delFolderBtn);

        folderHeader.appendChild(leftPart);
        folderHeader.appendChild(actionsDiv);

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

          // Rendre l'élément draggable
          chatItem.setAttribute('draggable', 'true');

          chatItem.addEventListener('dragstart', (e) => {
            chatItem.classList.add('dragging');
            //On utilise chat.url au lieu de index
            const dataToTransfer = JSON.stringify({ sourceFolder: folderName, chatUrl: chat.url });
            e.dataTransfer.setData('text/plain', dataToTransfer);
            e.dataTransfer.effectAllowed = 'move';
          });

          chatItem.addEventListener('dragend', () => {
            chatItem.classList.remove('dragging');
          });

          const link = document.createElement('a');
          link.className = 'chat-link';
          link.href = chat.url;
          link.target = '_blank';
          link.title = chat.title;
          link.textContent = `↳ ${chat.title}`;

          link.setAttribute('draggable', 'false');

          // Conteneur pour les boutons de la conversation
          const chatActionsDiv = document.createElement('div');
          chatActionsDiv.className = 'chat-actions';

          const editBtn = document.createElement('button');
          editBtn.className = 'action-btn edit-btn';
          editBtn.innerHTML = '✏️';
          editBtn.title = chrome.i18n.getMessage("btnRename");
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            //On passe chat.url
            renameChat(folderName, chat.url, chat.title);
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'action-btn delete-btn';
          delBtn.innerHTML = '❌';
          delBtn.title = chrome.i18n.getMessage("btnDelete");
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            //On passe chat.url
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

      }); // Fin du forEach

      noResultsDiv.style.display = (searchTerm && !hasResults) ? 'block' : 'none';
    });
  }
  // 5. Renommer
  function renameChat(folderName, chatUrl, currentTitle) {
    const newTitle = prompt(chrome.i18n.getMessage("promptRename"), currentTitle);
    if (newTitle !== null && newTitle.trim() !== "") {
      chrome.storage.sync.get({ folders: {} }, (data) => {
        let folders = data.folders;
        // On trouve le vrai index dans la base de données via l'URL
        const realIndex = folders[folderName].findIndex(c => c.url === chatUrl);
        if (realIndex !== -1) {
          folders[folderName][realIndex].title = newTitle.trim();
          chrome.storage.sync.set({ folders: folders }, () => {
            displayFolders(folderName, searchInput.value.toLowerCase());
          });
        }
      });
    }
  }

  // 6. Supprimer
  function deleteChat(folderName, chatUrl) {
    chrome.storage.sync.get({ folders: {} }, (data) => {
      let folders = data.folders;
      const realIndex = folders[folderName].findIndex(c => c.url === chatUrl);
      if (realIndex !== -1) {
        folders[folderName].splice(realIndex, 1);
        chrome.storage.sync.set({ folders: folders }, () => {
          displayFolders(folderName, searchInput.value.toLowerCase());
        });
      }
    });
  }

  // 7. Déplacer une conversation (Drag & Drop)
  function moveChat(sourceFolder, targetFolder, chatUrl) {
    chrome.storage.sync.get({ folders: {} }, (data) => {
      let folders = data.folders;

      const realIndex = folders[sourceFolder].findIndex(c => c.url === chatUrl);
      if (realIndex === -1) return; // Sécurité

      // On retire la conversation du dossier source
      const chatToMove = folders[sourceFolder].splice(realIndex, 1)[0];

      // On s'assure que le dossier cible existe
      if (!folders[targetFolder]) folders[targetFolder] = [];

      // Petite vérification anti-doublon dans le dossier cible
      const isDuplicate = folders[targetFolder].some(chat => chat.url === chatToMove.url);
      if (!isDuplicate) {
        folders[targetFolder].push(chatToMove);
      }

      chrome.storage.sync.set({ folders: folders }, () => {
        displayFolders(targetFolder, searchInput.value.toLowerCase());
      });
    });
  }
  // 8. Épingler / Désépingler un dossier
  function togglePin(folderName) {
    chrome.storage.sync.get({ pinnedFolders: [] }, (data) => {
      let pinned = data.pinnedFolders;

      if (pinned.includes(folderName)) {
        // S'il est déjà épinglé, on l'enlève de la liste
        pinned = pinned.filter(name => name !== folderName);
      } else {
        // Sinon, on l'ajoute
        pinned.push(folderName);
      }

      chrome.storage.sync.set({ pinnedFolders: pinned }, () => {
        // On rafraîchit l'affichage en gardant la recherche active
        displayFolders(null, searchInput.value.toLowerCase());
      });
    });
  }
});