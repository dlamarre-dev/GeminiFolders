importScripts('lz-string.min.js', 'utils.js');
// 1. Function to rebuild the context menu
function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Create the main parent menu with translation
    chrome.contextMenus.create({
      id: "gemini-folders-parent",
      title: chrome.i18n.getMessage("ctxMenuSave"),
      contexts: ["page"],
      documentUrlPatterns: ["*://gemini.google.com/*"]
    });

    // Fetch the user's folders
    loadData({ folders: {} }, (data) => {
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

      // Create a submenu for each folder
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

// 2. Update the menu on startup and when folders change
chrome.runtime.onInstalled.addListener(updateContextMenu);
chrome.runtime.onStartup.addListener(updateContextMenu);
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.folders || changes.foldersDataCompressed)) {
    updateContextMenu();
  }
});

// 3. Listen for menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.parentMenuItemId === "gemini-folders-parent") {
    const targetFolder = info.menuItemId.replace("folder_", "");

    // Get the translated default title
    const fallbackTitle = chrome.i18n.getMessage("defaultTitle") || "New conversation";

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [fallbackTitle], // <-- NEW: Pass the variable to the injected script
      func: (defaultFallback) => {
        // Plan A
        const topTitle = document.querySelector('[data-test-id="conversation-title"]');
        if (topTitle && topTitle.textContent) {
          let text = topTitle.textContent.trim();
          if (text.length > 0) return text;
        }

        // Plan B
        const currentPath = window.location.pathname;
        if (currentPath && currentPath.includes("/app/")) {
          const links = document.querySelectorAll(`a[href="${currentPath}"]`);
          for (let link of links) {
            let text = link.textContent.trim();
            if (text && text.length > 1) return text.split('\n')[0].trim();
          }
        }

        // Plan C
        let docTitle = document.title || "";
        let cleanTitle = docTitle.split(' - ')[0].trim();
        const ignoreList = ["gemini", "google gemini", "discussions", "chats", "nouvelle conversation", "new conversation", "new chat", ""];
        if (!ignoreList.includes(cleanTitle.toLowerCase())) {
            return cleanTitle;
        }

        // Plan D
        const firstMsg = document.querySelector('[data-message-author-role="user"], user-query, message-content, .query-text');
        if (firstMsg && firstMsg.textContent) {
          let excerpt = firstMsg.textContent.trim();
          return excerpt.length > 40 ? excerpt.substring(0, 40) + "..." : excerpt;
        }

        return defaultFallback;
      }
    }, (results) => {
      // Same here in case of total script failure
      let finalTitle = chrome.i18n.getMessage("defaultTitle") || "New conversation";
      if (results && results[0] && results[0].result) {
        finalTitle = results[0].result;
      }

      // Save to the database
      loadData({ folders: {} }, (data) => {
        let folders = data.folders;
        if (!folders[targetFolder]) folders[targetFolder] = [];

        const isDuplicate = folders[targetFolder].some(chat => chat.url === tab.url);
        if (!isDuplicate) {
          folders[targetFolder].push({
            title: finalTitle,
            url: tab.url,
            timestamp: Date.now()
          });
          saveData({ folders: folders });
        }
      });
    });
  }
});