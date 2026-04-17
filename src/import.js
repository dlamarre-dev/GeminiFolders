document.addEventListener('DOMContentLoaded', () => {
    const titleApp = chrome.i18n.getMessage("appTitle");
    const titleImport = chrome.i18n.getMessage("importBtn");

    document.title = `${titleImport} - ${titleApp}`;

    document.getElementById('app-title').textContent = titleApp;

    const importBtn = document.getElementById('import-action-btn');
    importBtn.textContent = titleImport;

    const fileInput = document.getElementById('file-input');
    const statusMsg = document.getElementById('status-msg');

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);

                chrome.storage.sync.set({ folders: data.folders }, () => {
                    statusMsg.textContent = chrome.i18n.getMessage("alertImportSuccess");
                    statusMsg.style.color = "green";
                });
            } catch (err) {
                statusMsg.textContent = chrome.i18n.getMessage("alertImportError");
                statusMsg.style.color = "red";
            }
        };
        reader.readAsText(file);
    });
});