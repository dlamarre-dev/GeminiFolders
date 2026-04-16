# 🤝 Contributing to Gemini Folders

First off, **thank you** for your interest in this project! Gemini Folders is an open-source project developed with passion, and any help to improve it is greatly appreciated.

Whether you want to fix a bug, add a translation, or propose a new feature, this guide is here to help you do it easily.

## 💡 How to contribute?

### 1. Report a bug or propose an idea
You don't need to know how to code to contribute! If you find a bug or have a great idea:
* Go to the **[Issues]** tab of the repository.
* Check if someone hasn't already reported the same issue.
* Create a new "Issue" clearly describing the problem you encountered or the idea you are proposing (with screenshots if possible).

### 2. Contribute to the code (Pull Requests)
To keep this project lightweight and easy to maintain, please follow this process:

**🚨 The Golden Rule:** For minor fixes (typos, small bugs), you can submit a *Pull Request* (PR) directly. But **for major new features, please always open an "Issue" first** to discuss it. This prevents anyone from wasting time working in different directions!

**The Workflow:**
1. **Fork** the project to your own GitHub account.
2. Create a branch for your feature (`git checkout -b feature/my-new-feature`).
3. Make your changes.
4. Test the extension locally (via `chrome://extensions/` > Developer mode > Load unpacked).
5. Commit your changes (`git commit -m "Add feature X"`).
6. Push to your branch (`git push origin feature/my-new-feature`).
7. Open a **Pull Request** on this repository!

## 🛠️ Development Guidelines

To keep the code clean and performant, please respect these few principles:
* **Vanilla First:** The project uses HTML5, CSS3, and pure Vanilla JavaScript. Please do not introduce heavy external libraries (no React, Vue, jQuery, etc.) or complex build tools. The extension must remain ultra-lightweight.
* **Translations (`messages.json`):** The extension is multilingual. **Never** hardcode text in the HTML or JavaScript files. Always use the `chrome.i18n.getMessage("messageKey")` system and add your localized strings in the `_locales/XX/messages.json` files.
* **Design:** Try to respect the existing UI guidelines ("Material Design" style, rounded corners, full Dark Mode support).

## 🌍 Adding a Language
The extension currently supports over 15 languages worldwide. If you want to translate Gemini Folders into a new language:
1. Create a new folder with the language code in the `_locales/` directory (e.g., `ar/` for Arabic).
2. Copy the `messages.json` file from another folder (like `en/` or `fr/`).
3. Translate ONLY the `"message": "..."` values. Keep the variables like `{count}` intact.
4. Submit your Pull Request!

Thanks again for your time and support! 🚀