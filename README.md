# Safe Journey — Women's Safety & Commute Monitoring

**Safe Journey** is a high-fidelity, real-time safety application designed to provide security and peace of mind for women during their daily commutes. By bridging the gap between travellers and their trusted circle, the app ensures that no one travels alone through state-of-the-art tracking, AI-driven safety intelligence, and instant emergency response.

![Safe Journey Preview](https://img.shields.io/badge/Status-High--Fidelity-blue)
![Tech Stack](https://img.shields.io/badge/Tech-JS%20|%20Firebase%20|%20Gemini-orange)
![Design](https://img.shields.io/badge/Design-Glassmorphism-purple)

---

## 🌟 Key Features

### 1. 🌓 Dual-Persona Ecosystem
*   **Traveller Dashboard**: A comprehensive command center for setting up journeys, monitoring live location, and managing safety alerts.
*   **Guardian Interface**: A dedicated, mirror-layout tracking view for trusted contacts, featuring real-time map updates, risk assessments, and quick-action emergency controls.

### 2. 🤖 AI Safety Intelligence (Google Gemini)
*   **Real-time Risk Analysis**: The app leverages Gemini AI to analyze journey parameters every minute, generating natural language safety summaries.
*   **Anomaly Detection**: Automatically detects stationary delays, route deviations, or suspicious movement, notifying guardians instantly.
*   **Safety Timeline**: A chronological log of journey events, status changes, and AI assessments.

### 3. 🛡️ Professional Security Features
*   **SOS Engine**: A high-visibility emergency system that alerts guardians with a single tap, triggering a "Pulse-Red" alert state.
*   **Secure DigiPin**: Location-based unique pins for standardized reporting and verification.
*   **Trusted Circle**: Manage emergency contacts with real-time sync, relationship tagging, and one-tap sharing.

### 4. 💎 High-Fidelity Design
*   **Glassmorphism UI**: A modern, premium aesthetic featuring backdrop blurs, subtle gradients, and elegant typography (Manrope).
*   **Centered Professional Modals**: All interactions like chat and guardian settings use high-fidelity, centered popups with background dimming for a professional feel.
*   **Responsive Dashboard**: A two-column grid layout that balances data intelligence (left) and interactive tracking (right).

---

## 🛠️ Technology Stack

*   **Frontend**: Semantic HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6 Modules)
*   **Maps**: [Leaflet JS](https://leafletjs.com/) with Voyager Tiles
*   **Database**: [Firebase Realtime Database](https://firebase.google.com/) for sub-second synchronization
*   **Authentication**: [Firebase Auth](https://firebase.google.com/products/auth) for secure user sessions
*   **AI Engine**: [Google Gemini 1.5 Flash](https://aistudio.google.com/) for journey analysis
*   **Design**: Material Symbols & Google Fonts

---

## 📁 Project Structure

The project follows a clean, organized modular architecture:

```text
├── index.html          # Main entry point
├── package.json        # Node.js package configuration
├── README.md           # Project documentation
│
├── auth/
│   └── index.html      # Professional Sign In / Sign Up interface
│
├── css/
│   └── style.css       # Core Design System, Glassmorphism, & Layouts
│
├── guardian/
│   └── index.html      # Real-time Guardian Tracking Interface
│
├── js/
│   ├── app.js          # Core logic for the Traveller Dashboard
│   ├── guardian.js     # Real-time monitoring & viewer logic for Guardians
│   ├── auth.js         # Firebase Authentication & Session Management
│   ├── welcome.js      # Role routing & tracking link validation
│   ├── tracking.js     # GPS Engine & Location broadcast logic
│   ├── ai-layer.js     # Gemini AI integration & Anomaly detection
│   ├── map.js          # Traveller map initialization & marker logic
│   ├── firebase-config.js # Firebase initialization & API configuration
│   └── digipin.js      # Location-based DigiPin generation
│
├── traveller/
│   └── index.html      # Main Traveller Dashboard
│
└── welcome/
    └── index.html      # Gateway page for role selection (Traveller vs Guardian)
```

---

## 🚀 Getting Started

### Prerequisites
*   A modern web browser (Chrome, Edge, Safari).
*   A local web server environment (e.g., VS Code Live Server, `http-server`, or Python's `http.server`).
    *   *Note: ES Modules require a server environment to load correctly.*

### Configuration

1.  **Firebase Setup**:
    *   Create a project in the [Firebase Console](https://console.firebase.google.com/).
    *   Enable **Realtime Database** and **Authentication** (Email/Password).
    *   Update `js/firebase-config.js` with your specific credentials.

2.  **AI Integration**:
    *   Obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/).
    *   Update the `GEMINI_API_KEY` in `js/ai-layer.js`.

### Running Locally

1.  Clone or download the project files.
2.  Start a local server in the root directory:
    ```bash
    # Example using Python
    python -m http.server 8000
    ```
3.  Open `http://localhost:8000/auth.html` to begin.
4.  **Important**: Grant location permissions when prompted to enable live tracking features.

---

## 🛡️ Safety Disclaimer
This application is a high-fidelity prototype designed for demonstration and educational purposes. In actual emergency situations, always prioritize contacting official local emergency services (e.g., 112 or 100) immediately.

---
*Created with ❤️ for a Safer Tomorrow.*
