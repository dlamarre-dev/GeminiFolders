document.addEventListener('DOMContentLoaded', async () => {
  const folderList = document.getElementById('folderList');
  const saveBtn = document.getElementById('saveBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn'); // Nouveau bouton
  const importFile = document.getElementById('importFile'); // Champ de fichier caché
  const folderNameInput = document.getElementById('folderName');
  const chatTitleInput = document.getElementById('chatTitle');
  const searchInput = document.getElementById('searchInput');
  const statusDiv = document.getElementById('status');
  const noResultsDiv = document.getElementById('noResults');

  // Pré-remplissage du titre
  let [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab && currentTab.url.includes("gemini.google.com")) {
    let cleanTitle = currentTab.title.replace(" - Gemini", "").replace("Google Gemini", "").trim();
    chatTitleInput.value = cleanTitle || "Nouvelle conversation";
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
      alert("Veuillez utiliser cette extension sur une page Gemini.");
      return;
    }

    const folderName = folderNameInput.value.trim() || "Général";
    const finalChatTitle = chatTitleInput.value.trim() || "Conversation sans titre"; 
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
        alert("Vos dossiers sont vides, rien à exporter !");
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

  // 3. Importer (NOUVEAU)
  // Quand on clique sur le bouton, ça déclenche le champ de fichier caché
  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  // Quand un fichier est sélectionné
  importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Vérification basique du format
        if (typeof importedData !== 'object' || importedData === null) {
          throw new Error("Format de fichier invalide");
        }

        chrome.storage.sync.get({ folders: {} }, (data) => {
          let currentFolders = data.folders;

          // Fusion intelligente
          for (const [folderName, chats] of Object.entries(importedData)) {
            if (!currentFolders[folderName]) {
              currentFolders[folderName] = [];
            }
            
            // On ajoute uniquement si le lien n'existe pas déjà dans ce dossier
            chats.forEach(importedChat => {
              if (importedChat.title && importedChat.url) {
                const isDuplicate = currentFolders[folderName].some(chat => chat.url === importedChat.url);
                if (!isDuplicate) {
                  currentFolders[folderName].push(importedChat);
                }
              }
            });
          }

          chrome.storage.sync.set({ folders: currentFolders }, () => {
            alert("Importation réussie ! Tes données ont été fusionnées avec succès.");
            importFile.value = ""; // Réinitialiser le champ pour pouvoir réimporter plus tard
            displayFolders();
          });
        });

      } catch (error) {
        alert("Erreur lors de l'importation. Assure-toi qu'il s'agit bien d'un fichier JSON valide généré par cette extension.");
        importFile.value = "";
      }
    };
    reader.readAsText(file);
  });

  // 4. Afficher et Filtrer les dossiers
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
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        folderHeader.innerHTML = `<span class="folder-icon">📁</span><div class="folder-name">${folderName}</div>`;
        
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
          editBtn.title = 'Renommer';
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameChat(folderName, index, chat.title);
          });

          const delBtn = document.createElement('button');
          delBtn.className = 'action-btn delete-btn';
          delBtn.innerHTML = '❌';
          delBtn.title = 'Supprimer';
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
        if (appendedChatsCount > 0) {
          folderDiv.appendChild(folderContent);
        }
        folderList.appendChild(folderDiv);
      }

      noResultsDiv.style.display = (searchTerm && !hasResults) ? 'block' : 'none';
    });
  }

  // 5. Renommer
  function renameChat(folderName, index, currentTitle) {
    const newTitle = prompt("Nouveau nom de la conversation :", currentTitle);
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
      if (data.folders[folderName].length === 0) {
        delete data.folders[folderName];
      }
      chrome.storage.sync.set({ folders: data.folders }, () => {
        displayFolders(folderName, searchInput.value.toLowerCase()); 
      });
    });
  }
});