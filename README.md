# 🐔 الودرني للدواجن — Poultry Ledger Pro

A state-of-the-art, premium poultry farm ledger application built to track daily deliveries, weights, and payments per client. This application features an offline-first bridging database architecture, Supabase synchronization, high-fidelity responsive charts, thermal receipt printing, and a stunning 3D glassmorphic user interface.

---

## ✨ Features & Technology Stack

- **🎨 Modern Visual Design**: Rich dark-gold/amber theme powered by **Tailwind CSS**.
- **🔮 3D Card Parallax**: Interactive hover animations on dashboard metric cards and the login portal utilizing **Atropos 3D**.
- **🎬 Fluid Transitions**: Smooth micro-interactions and stagger page transitions powered by **Framer Motion**.
- **🌐 Multilingual IBM Plex Sans Arabic**: Styled from the ground up for perfect right-to-left (RTL) Arabic typography.
- **⚡ Offline Capability**: Robust IndexedDB integration for continuous workspace synchronization even without active internet connectivity.
- **📈 Advanced Analytics**: High-performance SVG line charts and market-share donut gauges for full commercial insights.
- **🖨️ Thermal Printing**: Direct-to-hardware responsive receipt styling for customer invoicing.

---

## 🚀 Local Quickstart

### Prerequisites
Make sure you have Node.js (version 20+) installed on your machine.

### Installation
Clone the repository and install all dependencies (using the legacy peer dependency flag to bypass package conflict restrictions):
```bash
npm install --legacy-peer-deps
```

### Dev Server Execution
Launch the local development environment:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
To compile the static production bundle into the `dist/` directory:
```bash
npm run build
```

---

## 🛠️ GitHub Actions Deployment

The production website is automatically built and deployed via GitHub Actions to GitHub Pages. The pipeline configuration can be found in [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml). It bypasses standard `npm ci` requirements to ensure a seamless build using:
```yaml
- name: Install Dependencies
  run: npm install --legacy-peer-deps
```
