# Heart Health Tracker — Progressive Web App (PWA)

> **For awareness only. Not a doctor.**  
> A lightweight, zero-dependency, offline-ready Progressive Web App designed as a college Community Project for students, faculty, and elders to promote cardiovascular awareness and healthy lifestyle habits.

---

## 📌 Project Overview

- **Core Technologies:** Plain HTML5, CSS3, and modern Vanilla JavaScript (ES6+).
- **Backend / Libraries:** None. Zero external dependencies, no frameworks, no third-party charting libraries (charts are drawn with pure SVG).
- **Data Privacy & Storage:** All data stays 100% private on the user's device using browser `localStorage`. No accounts, no servers, no trackers.
- **Offline & Installable:** Fully functional offline after initial load via Service Worker (`sw.js`) and installable to Android home screen via `manifest.json`.
- **Target Audience:** College students, campus staff, and visiting elders. Clean interface, 44px+ tap targets, high-contrast light/dark themes, and zero sideways scrolling even on 360 px wide devices.

---

## ⚠️ Important Medical & Technical Disclaimers

### 1. Strictly Non-Diagnostic
This application **NEVER** diagnoses disease, predicts outcomes, or prescribes medications or doses. It is strictly an educational and awareness tool. Every screen prominently displays:  
`"For awareness only. Not a doctor."`

### 2. Blood Pressure Guidelines Source
All blood pressure categories follow the official **2017 American Heart Association / American College of Cardiology (AHA/ACC) Guideline for High Blood Pressure in Adults**:
- **Normal:** Systolic < 120 **and** Diastolic < 80 mmHg
- **Elevated:** Systolic 120–129 **and** Diastolic < 80 mmHg
- **High (Stage 1):** Systolic 130–139 **or** Diastolic 80–89 mmHg
- **High (Stage 2):** Systolic ≥ 140 **or** Diastolic ≥ 90 mmHg
- **Hypertensive Crisis:** Systolic > 180 **or** Diastolic > 120 mmHg

### 3. Emergency Dialing Reality
> **Crucial Safety Note:** A web application in a browser **cannot silently or automatically place a phone call**.  
> The `tel:` links (`tel:108`, `tel:112`, or `tel:[contact]`) launch the device's native phone dialer with the number pre-filled. The user must press the green call button to connect. The app makes this completely clear so no user is under a false impression during an emergency.

### 4. Background Notification Limits
Modern mobile operating systems (Android, iOS) aggressively put browser background tasks and tabs to sleep when the screen is turned off to save battery. While the Service Worker and Web Notifications API provide alerts while the app or browser is active, **browsers cannot guarantee scheduled wake-ups when the phone is locked**. Users are explicitly advised in the app to also set a standard phone alarm for vital medicines.

---

## 📱 App Features & Screens

### 1. Today Screen
- **Personalized Greeting:** Uses nickname (never real full names) and time-of-day greeting.
- **Circular Step Ring:** Pure SVG circular progress meter displaying current steps, daily step goal, percentage, and active minutes.
- **Latest Blood Pressure Card:** Color-coded status badge according to 2017 AHA guidelines with timestamp and pulse.
- **Lifestyle Risk Meter:** Dynamic risk level (Low, Moderate, High) calculated from recent habits and BP stage.
- **Today's Medicines & Check-ups:** One-tap "Mark taken" and "Done today" action cards.
- **Automatic Tracking Card:** Live step counting with `DeviceMotion` and Web Bluetooth synchronization.

### 2. Add Reading Screen
- Input top number (Systolic), bottom number (Diastolic), and resting Pulse.
- Activity inputs: Steps, Exercise minutes, Sleep hours.
- Visual 1–5 Stress level selector (Calm, Mild, Normal, High, Severe).
- Lifestyle habit checkboxes: Oily/fried food, Extra salt, Tobacco.
- Red flag warning symptoms checklist (Chest pain, Breathlessness at rest, Fainting, Stroke FAST signs).
- Strict validation: Top number must be larger than bottom number, with realistic bounds checking. Automatically triggers Emergency SOS if acute symptoms are reported.

### 3. Progress Screen
- **Blood Pressure Line Chart (Pure SVG):**
  - Dual line series: Systolic (teal) and Diastolic (blue).
  - Dashed reference line at **130 mmHg** (AHA Stage 1 systolic threshold).
  - Dashed reference line at **80 mmHg** (AHA Stage 1 diastolic threshold).
  - Interactive data point dots with tooltips and date axis labels.
- **Daily Steps Bar Chart (Pure SVG):**
  - Daily step bars with a horizontal dashed line marking the user's custom step goal.
- **Exercise & Sleep Dual Chart (Pure SVG):**
  - Compares daily workout minutes against the 30-minute guideline and sleep duration against the 7-hour target.
- **Historical Readings Table:**
  - Complete list of logs with source tags (`manual` or `auto`) and individual delete buttons.

### 4. Diet Plan Screen (General Indian Guidance)
- User profile: Nickname, age group, diet preference (Vegetarian, Vegetarian with eggs, Non-vegetarian), step goal, health conditions (High BP, Diabetes, Cholesterol, Overweight, Kidney disease, Past heart problem), family history, emergency contact.
- **Dynamic Indian Meal Plan Generator:**
  - **4 Daily Targets:** Salt under 5 g (~1 level tsp), 5 portions of fruits & vegetables, whole grains (traditional millets: Ragi, Jowar, Bajra), and cooking oil under 3–4 tsp/day.
  - **Sample Day Schedule:** Breakfast, mid-morning snack, lunch, evening snack, and light dinner.
  - **Renal Safety Alert:** If Kidney Disease is checked, displays a strict alert advising the user to follow their nephrologist's precise potassium and fluid instructions.
  - **Disclaimers:** Reminds users that guidance is for general awareness, not a medical diet prescription.

### 5. Reminders Screen
- **Push Notification Toggle:** Politely requests browser notification permissions and supports emergency alert testing.
- **Medicine Reminders:** Name, dose instructions, schedule (Morning, Afternoon, Night), one-tap mark taken, and real-time **7-Day Adherence Percentage** meter.
- **Check-up Reminders:** Pre-configured schedules (Weekly BP, Doctor Visit, Blood Sugar, Cholesterol) plus custom appointments with customizable repeat intervals and "Done today" tracking.
- Re-states: "The app only records what your doctor prescribed."

### 6. Emergency Symptom Check Screen
- Interactive checklist covering:
  - Chest pain or pressure
  - Pain radiating to arm, jaw, or back
  - Breathlessness at rest
  - Fainting / sudden collapse
  - Cold sweat with nausea
  - Face drooping, arm weakness, or slurred speech (FAST stroke signs)
  - Sudden severe thunderclap headache
  - Racing heartbeat / palpitations
  - Dizziness or severe lightheadedness
- Clinical Triage Logic:
  - **EMERGENCY:** Any critical symptom OR (Crisis BP >180/120 with ANY symptom). Automatically triggers the full-screen SOS overlay!
  - **URGENT:** Crisis BP alone, racing heartbeat alone, persistent dizziness alone, or pulse > 120 or < 45 bpm ("See a doctor today").
  - **SEE A DOCTOR SOON:** Stage 2 BP (≥140/90) without acute emergency symptoms.
  - **OK:** "No emergency warning signs found. This does not rule out a problem."

### 7. Summary Screen
- Key cumulative totals: Total readings, Average BP, Average steps, Days step goal met, High-risk lifestyle count, Medicine adherence.
- AHA Guideline reference guide.
- **Data Export:** Export all records as a JSON backup file.
- **Load Sample Dataset:** Quickly load community demonstration records.
- **Two-Step Data Deletion:** Dedicated modal confirmation requiring a second deliberate tap to permanently wipe storage (zero native `confirm()` or `alert()`).

---

## 🚨 Emergency SOS System

- **Floating SOS Button:** Large, red, pulsing button anchored at the bottom-right of **every screen**, positioned above the navigation bar and respecting safe-area insets (`env(safe-area-inset-bottom)`).
- **Fullscreen Emergency Modal:**
  1. **Call [Saved Contact]:** Uses `tel:[number]` to pre-fill dialer with emergency contact. (If none saved, gives a friendly prompt to add one in Profile).
  2. **Call 108 (Ambulance):** Instant dialer launch for Indian medical emergency services.
  3. **Call 112 (National Emergency):** Universal emergency services dialer launch.
  4. **Send My Location:** Leverages `navigator.geolocation` to fetch real-time GPS coordinates, generates a Google Maps URL, and formats a one-tap `sms:` message.

---

## 📡 Automatic Sensor Tracking Details

### 1. DeviceMotion Step Counter
- Uses the HTML5 `devicemotion` event. Handles iOS 13+ permission requests via `DeviceMotionEvent.requestPermission()`.
- **Signal Processing:** Computes total acceleration vector magnitude $\sqrt{x^2 + y^2 + z^2}$.
- **Gravity Isolation:** A low-pass filter ($\alpha = 0.85$) separates the static 9.8 m/s² gravity vector from dynamic user motion.
- **Peak Detection:** Uses a threshold of 1.9 m/s² with a minimum refractory period of 300 ms between steps to prevent double-counting.
- **Active Minutes:** Automatically increments when 70 or more steps are detected within a 60-second window.
- **Screen Wake Lock:** Utilizes the Screen Wake Lock API (`navigator.wakeLock.request('screen')`) to prevent the screen from dimming while tracking is active.
- Prominently labeled: *"Steps are approximate."*

### 2. Web Bluetooth Blood Pressure & Heart Rate
- Communicates with standard Bluetooth Low Energy (BLE) medical devices using GATT services:
  - **Blood Pressure Service:** UUID `0x1810`, Characteristic `0x2A35` (`blood_pressure_measurement`).
  - **Heart Rate Service:** UUID `0x180D`, Characteristic `0x2A37` (`heart_rate_measurement`).
- **IEEE-11073 16-bit SFLOAT Decoder:** Decodes 4-bit two's complement exponent and 12-bit two's complement mantissa:
  $$\text{Value} = \text{Mantissa} \times 10^{\text{Exponent}}$$
- Automatically detects kPa vs mmHg flags (converts kPa using factor 7.50062), handles timestamp offsets, and extracts pulse rate.
- Automatically saves new readings tagged as `"auto"`, validates them, and tests against emergency triage rules.

---

## 🧪 College Viva Voce / Exam Q&A Guide

When presenting this project for your college community evaluation or viva voce examination, here are simple English explanations for how each component works:

### Q1: Why is this app called a Progressive Web App (PWA)?
**Answer:** A PWA is a website that looks and behaves like an installed native mobile application. It has three core components:
1. `manifest.json`: Defines app icons, theme color, display mode (`standalone`), and app name so users can tap "Add to Home screen" on their Android phone.
2. `sw.js` (Service Worker): A JavaScript background script that intercepts network requests and serves cached files, allowing the app to run completely offline without an internet connection.
3. Responsive Mobile-First Design: Styled to look and feel like an app with bottom navigation, smooth transitions, and minimum 44px tap targets.

### Q2: How does the pure SVG Blood Pressure chart work without libraries?
**Answer:** In `app.js`, the `ChartRenderer.renderBpChart()` function dynamically creates SVG elements using plain JavaScript string templates:
1. It reads the last 10 blood pressure logs from `localStorage`.
2. It scales systolic and diastolic values into pixel coordinates ($X, Y$) using simple linear mapping formulas:  
   $$Y = \text{Height} - \left(\frac{\text{Value} - \text{Min}}{\text{Max} - \text{Min}}\right) \times \text{ChartHeight}$$
3. It draws `<polyline>` tags for the systolic and diastolic lines, `<line>` tags with `stroke-dasharray="5,4"` for the 130 and 80 mmHg reference lines, and `<circle>` tags for data points.

### Q3: How does the Bluetooth parser extract 120/80 and pulse 72 from byte array `[0x04, 0x78, 0x00, 0x50, 0x00, 0x5D, 0x00, 0x48, 0x00]`?
**Answer:**
1. **Byte 0 (`0x04`):** Flags byte. Bit 0 is 0 (units in mmHg), Bit 1 is 0 (no timestamp), Bit 2 is 1 (pulse rate is present).
2. **Bytes 1–2 (`0x78, 0x00`):** Little-endian IEEE-11073 SFLOAT for Systolic. In hex, `0x0078` = 120. Mantissa = 120, Exponent = 0. Value = $120 \times 10^0 = 120\text{ mmHg}$.
3. **Bytes 3–4 (`0x50, 0x00`):** Diastolic. `0x0050` = 80. Mantissa = 80, Exponent = 0. Value = $80\text{ mmHg}$.
4. **Bytes 5–6 (`0x5D, 0x00`):** Mean Arterial Pressure (MAP) = 93 mmHg.
5. **Bytes 7–8 (`0x48, 0x00`):** Pulse Rate. `0x0048` = 72. Mantissa = 72, Exponent = 0. Value = $72\text{ bpm}$.  
*Result:* Exactly **120/80 mmHg with Pulse 72 bpm**! (You can click the 🧪 icon in the header to run this automated test live).

### Q4: How does the step detector work on a phone?
**Answer:** The `StepDetector` class listens to the `devicemotion` event, which reports 3-axis accelerometer readings ($x, y, z$). It calculates the total acceleration vector magnitude $\sqrt{x^2 + y^2 + z^2}$. To remove Earth's constant 9.8 m/s² gravity, it applies a low-pass filter. When the remaining user acceleration crosses a threshold of 1.9 m/s² and at least 300 milliseconds have passed since the previous step, a step is counted.

### Q5: Why doesn't the SOS button directly make a call?
**Answer:** Web browsers intentionally do not permit websites or web apps to initiate phone calls silently or automatically for security and user consent reasons. Instead, the web standard `tel:` protocol opens the device's native dialer app with the emergency number already typed in. The user confirms by pressing the dial button.

---

## 🌐 How to Host on GitHub Pages (Step-by-Step)

Follow these simple steps to host this app for free on GitHub Pages:

### Step 1: Create a GitHub Repository
1. Log in to [GitHub](https://github.com).
2. Click **New Repository**.
3. Name the repository (e.g., `heart-health-tracker`).
4. Set visibility to **Public**.
5. Do not initialize with README (we already have one). Click **Create repository**.

### Step 2: Push the Files
In your terminal or PowerShell inside the project directory:
```bash
git init
git add .
git commit -m "Initial release of Heart Health Tracker PWA"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/heart-health-tracker.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. On GitHub, navigate to your repository's **Settings** tab.
2. In the left sidebar, click **Pages** (under the "Code and automation" section).
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: Select `main`
   - Folder: Select `/ (root)`
4. Click **Save**.
5. After 1 to 2 minutes, GitHub will display your live URL:  
   `https://<YOUR-USERNAME>.github.io/heart-health-tracker/`

---

## 📲 How to Install on Android ("Add to Home Screen")

1. Open **Google Chrome** on your Android smartphone.
2. Visit your GitHub Pages URL (e.g., `https://<YOUR-USERNAME>.github.io/heart-health-tracker/`).
3. An installation banner may appear automatically: tap **Install** or **Add to Home screen**.
4. Alternatively, tap the Chrome menu (three dots in top right) and select **"Install app"** or **"Add to Home screen"**.
5. The Heart Health Tracker icon will appear on your phone's home screen and app drawer. It will launch in full-screen standalone mode without any browser URL bar, and functions completely offline!

---

## 📁 File Structure

```
heart-health-tracker/
├── index.html        # Single-page HTML shell, all 7 screens, SOS modal, test runner
├── style.css         # Mobile-first styles, CSS variables, dark/light theme, responsive layout
├── app.js            # Core application logic, storage, AHA 2017 rules, SVG charts, sensors
├── sw.js             # Service Worker for offline asset caching and SOS notification routing
├── manifest.json     # PWA manifest metadata, theme color, icons, and shortcuts
├── icon-192.png      # 192x192 PWA app icon
├── icon-512.png      # 512x512 high-resolution PWA app icon
└── README.md         # Comprehensive documentation, viva guide, and hosting tutorial
```

---

*Developed for College Community Project. For awareness only. Not a doctor.*
