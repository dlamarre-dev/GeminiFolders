// 1. Fonction pour reconstruire le menu contextuel
function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // On crée le menu parent principal avec la traduction
    chrome.contextMenus.create({
      id: "gemini-folders-parent",
      title: chrome.i18n.getMessage("ctxMenuSave"),
      contexts: ["page"],
      documentUrlPatterns: ["*://gemini.google.com/*"]
    });

    // On va chercher les dossiers de l'utilisateur
    chrome.storage.sync.get({ folders: {} }, (data) => {
      const folderNames = Object.keys(data.folders);

      if (folderNames.length === 0) {
        chrome.contextMenus.create({
          id: "no-folder",
          parentId: "gemini-folders-parent",
          title: chrome.i18n.getMessage("ctxMenuNoFolder"),
          contexts: ["page"],
          enabled: false
        });
        return;
      }

      // On crée un sous-menu pour chaque dossier
      folderNames.sort().forEach(folder => {
        chrome.contextMenus.create({
          id: `folder_${folder}`,
          parentId: "gemini-folders-parent",
          title: `📁 ${folder}`,
          contexts: ["page"]
        });
      });
    });
  });
}

// 2. Mettre à jour le menu au démarrage et quand les dossiers changent
chrome.runtime.onInstalled.addListener(updateContextMenu);
chrome.runtime.onStartup.addListener(updateContextMenu);
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.folders) {
    updateContextMenu();
  }
});

// 3. Écouter les clics sur le menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.parentMenuItemId === "gemini-folders-parent") {
    const targetFolder = info.menuItemId.replace("folder_", "");

    // On récupère le titre par défaut traduit
    const fallbackTitle = chrome.i18n.getMessage("defaultTitle") || "New conversation";

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [fallbackTitle], // <-- NOUVEAU: On passe la variable au script injecté
      func: (defaultFallback) => { // <-- NOUVEAU: Le script reçoit la variable
        const currentPath = window.location.pathname;
        if (currentPath && currentPath.includes("/app/")) {
          const links = document.querySelectorAll(`a[href="${currentPath}"]`);
          for (let link of links) {
            let text = link.innerText.trim();
            if (text && text.length > 1) return text.split('\n')[0].trim();
          }
        }
        let docTitle = document.title.replace(" - Gemini", "").replace("Google Gemini", "").trim();
        if (docTitle && docTitle !== "Gemini" && docTitle !== "Discussions" && docTitle !== "Chats") return docTitle;

        const firstUserMessage = document.querySelector('[data-message-author-role="user"], message-content');
        if (firstUserMessage && firstUserMessage.innerText) {
          let excerpt = firstUserMessage.innerText.trim();
          return excerpt.length > 40 ? excerpt.substring(0, 40) + "..." : excerpt;
        }
        return defaultFallback; // On utilise la traduction !
      }
    }, (results) => {
      // Pareil ici en cas d'échec total du script
      let finalTitle = chrome.i18n.getMessage("defaultTitle") || "New conversation";
      if (results && results[0] && results[0].result) {
        finalTitle = results[0].result;
      }

      // Sauvegarde dans la base de données
      chrome.storage.sync.get({ folders: {} }, (data) => {
        let folders = data.folders;
        if (!folders[targetFolder]) folders[targetFolder] = [];

        const isDuplicate = folders[targetFolder].some(chat => chat.url === tab.url);
        if (!isDuplicate) {
          folders[targetFolder].push({
            title: finalTitle,
            url: tab.url,
            timestamp: Date.now()
          });
          chrome.storage.sync.set({ folders: folders });
        }
      });
    });
  }
});