# Express AI — Mobile Data Collection App

A React Native (Expo) mobile application for collecting road survey data. The app uses your phone's **camera, GPS, accelerometer, and gyroscope** to simultaneously record video and sensor data during road surveys.

---

## Features

- 📹 **Video Recording** — Records road survey footage using the rear camera
- 📍 **GPS Logging** — Captures real-time coordinates throughout the survey
- 📱 **Sensor Data** — Records accelerometer & gyroscope data for IRI (road roughness) analysis
- 💾 **Local Storage** — All recordings are saved locally on the device
- 📤 **Export / Share** — Export CSV sensor data and video files for further processing

---

## Prerequisites

Before running the app, make sure you have the following installed on your **development machine (laptop)**:

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9.x | Comes with Node.js |
| Expo CLI | Latest | `npm install -g expo-cli` |

On your **mobile phone**, install:

- **Expo Go** — Available on [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) (Android) or the [App Store](https://apps.apple.com/app/expo-go/id982107779) (iOS)

---

## Installation

```bash
# 1. Navigate to the mobile-app directory
cd mobile-app

# 2. Install dependencies
npm install
```

---

## Running the App

### Step 1 — Start the development server

```bash
npx expo start
```

This will display a **QR code** in the terminal.

### Step 2 — Connect your phone

> ⚠️ Your **laptop and phone must be on the same network** for this to work.

| Platform | Steps |
|---|---|
| **Android** | Open **Expo Go** → Tap **"Scan QR Code"** → Scan the QR code from the terminal |
| **iOS** | Open the **default Camera app** → Point at the QR code → Tap the banner that appears |

The app will load automatically on your phone.

---

## Network Setup Options

### Option A: Shared Wi-Fi (Recommended)
Connect both your laptop and phone to the same Wi-Fi router. Run `npx expo start` and scan the QR code.

### Option B: Phone Hotspot (No Internet Required)
1. Enable **Mobile Hotspot** on your phone
2. Connect your **laptop** to the phone's hotspot
3. Run `npx expo start` on the laptop
4. Scan the QR code using **Expo Go**

Specific:
1. Turn on Hotspot: On your mobile phone, enable the Wi-Fi Hotspot.
2. Connect PC: On your Windows PC, connect to your phone's Wi-Fi network.
3. Get the IP (Windows):
    Open PowerShell on Windows.
    Run ipconfig.
    Find the wireless adapter IP (e.g., 192.168.43.X). This is your phone's assigned IP address for your computer.
4. Run Expo (WSL):
    Go to your WSL terminal.



> ✅ This works fully **offline** — no internet connection is needed in this mode. The phone acts as the local network.

### Option C: Tunnel Mode (Fallback — Requires Internet)
If LAN connection fails (e.g., firewall issues), use:
```bash
npx expo start --tunnel
```
This routes through Expo's servers. Requires an active internet connection.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| QR code doesn't load | Make sure both devices are on the **same network** |
| "Network response timed out" | Switch to `--tunnel` mode |
| Camera/GPS not working | Make sure you **granted permissions** when prompted |
| App crashes on launch | Run `npm install` again, then restart with `npx expo start -c` (clears cache) |
| Port 8081 blocked | Check your laptop firewall settings and allow port 8081 |
| Cannot connect over iOS Hotspot | iPhone Hotspot applies client isolation. Use Windows Hotspot or USB/Spare Device instead |

---

## 📱 Android Factory Reset (Forgot Password)

If you are using an Android phone for testing and forgot the unlock password, you can reset it using **Recovery Mode**. 

> ⚠️ **IMPORTANT: Factory Reset Protection (FRP)**
> After resetting, Google will require the **exact Google Account Email & Password** that was previously logged into the phone. Do not reset if you do not know these credentials.

### How to Reset:
1.  **Turn off** the phone completely.
2.  Hold down the **button combination** until the logo appears:
    *   **Samsung / Pixel / Motorola / Xiaomi:** Hold `Volume Up` + `Power Button`
    *   **LG / Asus:** Hold `Volume Down` + `Power Button`
3.  In the menu, use **Volume Keys** to scroll and **Power Button** to select.
4.  Select **`Wipe data / factory reset`**.
5.  Confirm by selecting **`Factory data reset`**.
6.  Once finished, select **`Reboot system now`**.

---

## Project Structure

```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── Dashboard.tsx       # Home screen with survey overview
│   │   ├── Recorder.tsx        # Main recording screen (camera + sensors)
│   │   ├── Recordings.tsx      # List of past recordings
│   │   └── Settings.tsx        # App configuration
│   ├── services/
│   │   └── storage.ts          # Local file storage utilities
│   ├── theme.ts                # App color theme and styling constants
│   ├── types.ts                # TypeScript type definitions
│   └── utils.ts                # Shared utility functions
├── assets/                     # Icons and splash screen images
├── App.tsx                     # Root component
├── app.json                    # Expo configuration
└── package.json
```

---

## Permissions Required

The following device permissions are requested at runtime:

| Permission | Reason |
|---|---|
| Camera | Record road survey video |
| Microphone | Audio recording during survey |
| Location (GPS) | Log road coordinates |
| Motion / Sensors | Measure road roughness (IRI) |
| Media Library | Save recordings to device storage |

---

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on connected Android device |
| `npm run ios` | Start and open on connected iOS device |
| `npm run web` | Start in browser (limited functionality) |
