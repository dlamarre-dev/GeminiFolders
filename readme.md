# 📁 Gemini Folders - Chrome Extension

![Gemini Folders Hero Image](Marketing/PromoEn.png) 
*(Note: Create an 'images' folder in your repo and add your screenshot here)*

**Gemini Folders** is a lightweight, bilingual (English/French) Chrome extension that allows you to organize your Google Gemini conversations into custom folders. Stop losing your best prompts in an endless history and build a structured workspace!

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/gemini-folders/jffchdehoapigpmifkmleglfimjiilik)

## ✨ Features

* 📁 **Smart Folders:** Group your chats by projects, themes, or categories. You can now create empty folders in advance or delete them manually.
* 🖱️ **Drag & Drop:** Easily move saved conversations between folders to reorganize your workspace on the fly.
* 📌 **Pin Favorites:** Pin your most important folders to the top of the list for ultra-fast access.
* 🤖 **Smart Title Detection:** No more typing! The extension automatically reads the Gemini interface to extract the exact name of your current conversation.
* 🔍 **Instant Search:** Find any conversation quickly with a real-time search bar.
* ☁️ **Cloud Sync:** Uses native `chrome.storage.sync` to keep your folders synchronized across all devices connected to your Google account.
* 💾 **Import / Export:** Easily backup and restore your folder structure (including pinned folders) via JSON files.
* 🎨 **Adaptive UI:** Automatically matches your system's Dark/Light mode and accent colors.
* 🌍 **Bilingual:** Automatically detects your browser language (supports English and French).

## 🚀 Installation

### Option 1: Chrome Web Store (Recommended)
You can install the official, auto-updating version directly from the Chrome Web Store:
👉 **[Install Gemini Folders](https://chromewebstore.google.com/detail/gemini-folders/jffchdehoapigpmifkmleglfimjiilik)**

### Option 2: Developer Mode (Manual Installation)
If you want to test the code locally or contribute to the project:
1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the extension directory.

## 🛠️ Usage

1. Open a conversation on [gemini.google.com](https://gemini.google.com).
2. Click the **Gemini Folders** extension icon in your toolbar.
3. The conversation title is automatically detected. Select a folder (or create a new one) and hit **Save**.
4. Drag and drop items to reorganize, or use the 📌 icon to pin your favorite folders!

## 🔒 Privacy & Security

This extension is built with privacy in mind. 
* It **only** requests access to the `gemini.google.com` domain.
* It dynamically reads the active tab's content **only** when you explicitly click the extension button to generate a title.
* All data is stored using Chrome's built-in sync storage. **No third-party servers** are used, and your data remains entirely yours.

## 💻 Built With

* HTML5 / CSS3
* Vanilla JavaScript
* Chrome Extension API (Manifest V3)