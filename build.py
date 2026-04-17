import os
import shutil
import json
import zipfile

# --- CONFIGURATION ---
SRC_DIR = "src"
DIST_DIR = "dist"
MARKETING_DIR = "Marketing"
MANIFEST_PATH = os.path.join(SRC_DIR, "manifest.json")
FIREFOX_GECKO_ID = "geminifolders@dlamarre-dev.github.io"
FIREFOX_ONLY_FILES = ["import.html", "import.js"]


def clean_dist():
    """Removes the dist/ directory if it exists to start fresh."""
    if os.path.exists(DIST_DIR):
        print("🧹 Cleaning up old dist folder...")
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)


def build_chrome(version):
    """Prepares the files for Chrome."""
    print("🚀 Building Chrome version...")
    chrome_dir = os.path.join(DIST_DIR, "chrome")
    shutil.copytree(SRC_DIR, chrome_dir)

    # Remove Firefox-only files from Chrome build
    for file in FIREFOX_ONLY_FILES:
        file_path = os.path.join(chrome_dir, file)
        if os.path.exists(file_path):
            os.remove(file_path)

    # --- Traitement Marketing Chrome ---
    if os.path.exists(MARKETING_DIR):
        print("📸 Copying marketing assets for Chrome...")
        shutil.copytree(MARKETING_DIR, os.path.join(DIST_DIR, "marketing_chrome"))

    # Create ZIP
    zip_filename = os.path.join(DIST_DIR, f"gemini-folders-chrome-v{version}.zip")
    make_zip(chrome_dir, zip_filename)
    print(f"✅ Chrome build complete: {zip_filename}")


def build_firefox(version):
    """Prepares the files for Firefox and adapts the manifest and translations."""
    print("🦊 Building Firefox version...")
    firefox_dir = os.path.join(DIST_DIR, "firefox")
    shutil.copytree(SRC_DIR, firefox_dir)

    # --- 1. Modify manifest.json ---
    manifest_firefox_path = os.path.join(firefox_dir, "manifest.json")
    with open(manifest_firefox_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": FIREFOX_GECKO_ID,
            "strict_min_version": "142.0",
            "data_collection_permissions": {
            "required": ["none"]
            }
        }
    }

    if "background" in manifest and "service_worker" in manifest["background"]:
        sw_file = manifest["background"]["service_worker"]
        manifest["background"].pop("service_worker")
        manifest["background"]["scripts"] = [
            "lz-string.min.js",
            "utils.js",
            sw_file
        ]

    if "commands" in manifest:
        for cmd_name, cmd_info in manifest["commands"].items():
            if "suggested_key" in cmd_info:
                keys = cmd_info["suggested_key"]
                for platform in ["default", "windows", "chromeos", "linux", "mac"]:
                    if platform in keys and "Ctrl+Shift+S" in keys[platform]:
                        keys[platform] = keys[platform].replace("Ctrl+Shift+S", "Alt+Shift+S")

    with open(manifest_firefox_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # --- 2. Dynamically replace words in all translations (messages.json) ---
    locales_dir = os.path.join(firefox_dir, "_locales")
    if os.path.exists(locales_dir):
        for root, dirs, files in os.walk(locales_dir):
            if "messages.json" in files:
                msg_path = os.path.join(root, "messages.json")

                with open(msg_path, "r", encoding="utf-8") as f:
                    messages = json.load(f)

                modified = False
                for key, val in messages.items():
                    if "message" in val:
                        # Remplacement de Chrome par Firefox
                        if "Chrome" in val["message"]:
                            val["message"] = val["message"].replace("Chrome", "Firefox")
                            modified = True
                        # Remplacement du raccourci
                        if "Ctrl+Shift+S" in val["message"]:
                            val["message"] = val["message"].replace("Ctrl+Shift+S", "Alt+Shift+S")
                            modified = True

                if modified:
                    with open(msg_path, "w", encoding="utf-8") as f:
                        json.dump(messages, f, indent=2, ensure_ascii=False)

    # --- 3. Marketing Processing for Firefox ---
    if os.path.exists(MARKETING_DIR):
        print("📸 Processing marketing assets for Firefox...")
        mkt_ff_dir = os.path.join(DIST_DIR, "marketing_firefox")
        shutil.copytree(MARKETING_DIR, mkt_ff_dir)

        for root_dir, dirs, files in os.walk(mkt_ff_dir):
            for file in files:
                if file.endswith(".txt"):
                    file_path = os.path.join(root_dir, file)

                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()

                    modified = False
                    if "Chrome" in content:
                        content = content.replace("Chrome", "Firefox")
                        modified = True
                    if "Ctrl+Shift+S" in content:
                        content = content.replace("Ctrl+Shift+S", "Alt+Shift+S")
                        modified = True

                    if modified:
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(content)

    # --- 4. Create ZIP ---
    zip_filename = os.path.join(DIST_DIR, f"gemini-folders-firefox-v{version}.zip")
    make_zip(firefox_dir, zip_filename)
    print(f"✅ Firefox build complete: {zip_filename}")


def make_zip(source_dir, output_filename):
    """Compresses a directory into a ZIP file."""
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)


def main():
    print("🛠️ Starting Gemini Folders build pipeline...\n")

    if not os.path.exists(SRC_DIR) or not os.path.exists(MANIFEST_PATH):
        print(f"❌ Error: The '{SRC_DIR}' directory or 'manifest.json' file is missing.")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        version = manifest.get("version", "unknown")

    print(f"📦 Detected version: {version}\n")

    clean_dist()
    build_chrome(version)
    build_firefox(version)

    print("\n🎉 Build finished successfully!")


if __name__ == "__main__":
    main()