# 📁 Gemini Folders - Chrome Extension

![Gemini Folders Hero Image](_Marketing/PromoEn.png) 


**Gemini Folders** is a lightweight, bilingual (English/French) Chrome extension that allows you to organize your Google Gemini conversations into custom folders. Stop losing your best prompts in an endless history and build a structured workspace!

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/gemini-folders/jffchdehoapigpmifkmleglfimjiilik)

## ✨ Features

* 📁 **Custom Folders:** Group your chats by projects, themes, or categories.
* 🔍 **Instant Search:** Find any conversation quickly with a real-time search bar.
* ✏️ **Quick Edit:** Rename your saved conversations for better clarity.
* ☁️ **Cloud Sync:** Uses native `chrome.storage.sync` to keep your folders synchronized across all devices connected to your Google account.
* 💾 **Import / Export:** Easily backup and restore your folder structure via JSON files.
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
3. Type a folder name (or select an existing one) and hit **Save**.
4. Your conversation is now saved and easily accessible!

## 🔒 Privacy & Security

This extension is built with privacy in mind. 
* It **only** requests access to the `gemini.google.com` domain.
* It reads the active tab's URL and Title **only** when you explicitly click the extension button.
* All data is stored using Chrome's built-in sync storage. **No third-party servers** are used, and your data remains entirely yours.

## 💻 Built With

* HTML5 / CSS3
* Vanilla JavaScript
* Chrome Extension API (Manifest V3)