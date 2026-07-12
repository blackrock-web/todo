# Desktop Standalone Launcher Guide

This offline-first secure application is fully designed to run locally on your system as if it were a native desktop application. There are two simple, robust ways to set up a desktop icon for quick launching:

---

## Method 1: Double-Clickable Desktop Shortcut (Recommended)

We have provided native launcher scripts in the project directory that will automatically boot up your local secure storage database, launch the application server, and open a distraction-free standalone window.

### For Windows Users:
1. **Copy/Move the Shortcut**:
   - Locate the `launch-desktop-app.bat` file in your project folder.
   - Right-click `launch-desktop-app.bat` and select **Send to** -> **Desktop (create shortcut)**.
2. **Personalize the Icon**:
   - Go to your Desktop, right-click the newly created shortcut, and select **Properties**.
   - Under the **Shortcut** tab, click **Change Icon...**.
   - You can choose a built-in icon or select any `.ico` image file to represent your secure organizer.
3. **Run**:
   - Double-click your new desktop icon anytime to instantly boot and open the application!

### For macOS and Linux Users:
1. **Make Script Executable**:
   - Open your terminal in this directory and make the launcher script executable by running:
     ```bash
     chmod +x launch-desktop-app.sh
     ```
2. **Create Desktop Shortcut**:
   - On **macOS**: You can use the macOS **Automator** app to create a double-clickable Desktop application bundle that runs the `launch-desktop-app.sh` script, or simply link the script to your Desktop.
   - On **Linux**: You can move or copy the script to your desktop, or create a standard desktop launcher entry (e.g., `TodoApp.desktop`).

---

## Method 2: Modern Progressive Web App (PWA) Installation

Because this application includes a W3C Web App Manifest and Service Worker, browsers like Google Chrome, Microsoft Edge, and Safari can install it directly onto your desktop as a native standalone app:

1. **Start the App**:
   - Run the local server using `launch-desktop-app.bat` (Windows) or `bash launch-desktop-app.sh` (macOS/Linux).
2. **Install via Browser**:
   - Open your web browser and navigate to `http://localhost:3000`.
   - In the browser address bar (top-right in Chrome/Edge), you will see an **Install App** icon (represented by an arrow pointing into a computer or a plus icon).
   - Click the **Install** button.
3. **Instant Desktop Access**:
   - The browser will instantly add a beautiful customized icon to your desktop.
   - When opened via this icon, the app will launch in a distraction-free window without the browser header, URL inputs, or surrounding noise, behaving exactly like a native desktop application!
