if (typeof importScripts === 'function') {
  importScripts('lz-string.min.js', 'utils.js');
}
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
        const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u;
        const match = folder.match(emojiRegex);

        let menuTitle = folder;
        if (match) {
          const customIcon = match[1]; // The emoji
          const displayName = folder.replace(emojiRegex, '');
          // One space only between emoji and - name
          menuTitle = `${customIcon} ${displayName}`;
        } else {
          // Default behaviour
          menuTitle = `📁 ${folder}`;
        }

        chrome.contextMenus.create({
          id: `folder_${folder}`,
          parentId: "gemini-folders-parent",
          title: menuTitle,
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


// 4. Listen to keyboard shortcuts (Commands)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "quick-save") {
    try {
      // 1. Get active tab
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 2. Check if we are on Gemini
      if (!tab || !tab.url || !tab.url.includes("gemini.google.com")) {
        return;
      }

      const targetFolder = chrome.i18n.getMessage("quickSaveFolder") || "⚡ Quick Saves";
      const fallbackTitle = chrome.i18n.getMessage("defaultTitle") || "New conversation";
      const toastMsg = chrome.i18n.getMessage("toastSaved") || "✅ Saved!";

      // 3. Extract title
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [fallbackTitle],
        func: (defaultFallback) => {
          const topTitle = document.querySelector('[data-test-id="conversation-title"]');
          if (topTitle && topTitle.textContent) {
            let text = topTitle.textContent.trim();
            if (text.length > 0) return text;
          }

          const currentPath = window.location.pathname;
          if (currentPath && currentPath.includes("/app/")) {
            const links = document.querySelectorAll(`a[href="${currentPath}"]`);
            for (let link of links) {
              let text = link.textContent.trim();
              if (text && text.length > 1) return text.split('\n')[0].trim();
            }
          }

          let docTitle = document.title || "";
          let cleanTitle = docTitle.split(' - ')[0].trim();
          const ignoreList = ["gemini", "google gemini", "discussions", "chats", "nouvelle conversation", "new conversation", "new chat", ""];
          if (!ignoreList.includes(cleanTitle.toLowerCase())) return cleanTitle;

          const firstMsg = document.querySelector('[data-message-author-role="user"], user-query, message-content, .query-text');
          if (firstMsg && firstMsg.textContent) {
            let excerpt = firstMsg.textContent.trim();
            return excerpt.length > 40 ? excerpt.substring(0, 40) + "..." : excerpt;
          }
          return defaultFallback;
        }
      });

      let finalTitle = fallbackTitle;
      if (results && results[0] && results[0].result) {
        finalTitle = results[0].result;
      }

      // 4. Load data
      const data = await new Promise(resolve => loadData({ folders: {} }, resolve));

      let folders = data.folders || {};
      if (!folders[targetFolder]) folders[targetFolder] = [];

      const isDuplicate = folders[targetFolder].some(chat => chat.url === tab.url);

      if (!isDuplicate) {
        folders[targetFolder].push({
          title: finalTitle,
          url: tab.url,
          timestamp: Date.now()
        });

        // 5. Save data
        await new Promise(resolve => saveData({ folders: folders }, resolve));

        // 6. Inject visual feedback on page (Toast)
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [toastMsg],
          func: (msg) => {
            const toast = document.createElement('div');
            toast.textContent = msg;
            toast.style.cssText = "position:fixed; bottom:30px; right:30px; background:#1a73e8; color:white; padding:12px 24px; border-radius:8px; z-index:99999; font-family:sans-serif; font-size:14px; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:opacity 0.5s ease-in-out;";
            document.body.appendChild(toast);

            // Disappear after 2.5 seconds
            setTimeout(() => {
              toast.style.opacity = '0';
              setTimeout(() => toast.remove(), 500);
            }, 2500);
          }
        });
      }
    } catch (error) {
      console.error("Critical error during Quick Save :", error);
    }
  }
});
