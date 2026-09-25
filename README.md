# ✨ Glow Care – Smart Beauty & Skin Care
> **A complete, modern, responsive Beauty-Tech Web Application featuring a Live AI Face Skin Scanner, personalized skincare routines, product recommendations, and clinic appointment booking.**

Built with **HTML5, CSS3 (Custom Design System with Glassmorphism), and Vanilla JavaScript**. Designed for college projects, hackathons, and real-world deployment.

---

## 🌟 Key Highlights & Hackathon Features

### 1. 📷 Live AI Face Skin Scanner (Main Feature)
- **Real-Time Front Camera Streaming:** Requests camera permissions safely via `navigator.mediaDevices.getUserMedia` (`facingMode: "user"`).
- **Dual-Engine Face Vision Pipeline:**
  1. *Primary Engine:* **TensorFlow.js BlazeFace** for facial landmark estimation and bounding box alignment.
  2. *Fail-Safe Engine:* Built-in **Chromatic Skin-Tone & Pixel Variance Tracker** to ensure 100% real-time face detection even without internet access or GPU limitations.
- **Dynamic Real-Time User Coaching:**
  - *"Face detected"*
  - *"Keep your face centered"*
  - *"Move closer"*
  - *"Move back"*
  - *"Hold still, scanning in progress..."*
- **Engaging Visual & Auditory Feedback:** High-tech laser sweep animation, multi-phase calibration indicators (Landmark Alignment → Sebum Spectrometry → Texture & Pores → Pigmentation Mapping), and luxury audio chimes via Web Audio API.
- **Computer Vision Pixel Diagnostics:**
  - Evaluates real pixel RGB/HSV values across 6 facial zones (Forehead, T-zone, Left Cheek, Right Cheek, Infraorbital Under-Eye, Chin).
  - Detects visible characteristics:
    - Pimples / Acne (localized redness & inflammation clusters)
    - Blackheads & Visible Pores (luminance texture variance)
    - Oily Skin (T-zone specular highlight reflectance)
    - Redness & Capillary Tone (RGB differential index)
    - Under-Eye Darkness (infraorbital contrast relative to cheek baseline)
    - Dark Spots / Pigmentation (melanin distribution variance)
    - Dryness (low reflectance & hydration scoring)
- **Interactive Results Dashboard:**
  - Health Score Circular Ring Gauge (e.g. 84/100).
  - Primary Skin Type (Combination, Oily, Dry, Sensitive, Normal).
  - Face snapshot with interactive clickable pin hotspots showing where concerns were mapped.
  - Personalized AM/PM skincare routine blueprint.
  - Automatically matched product catalog and clinical treatment recommendations.
- **Transparent Medical Disclaimer:**
  > *“Glow Care provides general skincare guidance only. Results are not a medical diagnosis.”*
- **Offline / Camera-Free Testing Mode:** Includes a **"Load Demo Selfie"** button and an **"Upload Photo"** option for testing in lab environments without active webcams.

---

### 2. 🧴 Personalized Product Recommendations & Catalog
- 8 Categories: Cleansers, Moisturizers, Sunscreens, Serums, Acne Care, Hydration, Brightening, Skin Repair.
- Dynamic Search, Category Pills, Concern Filter dropdown, and Price/Rating Sorting.
- "Matched to your last scan" filter that auto-links from the scanner results.
- Product cards include: Image, Name, Category, Price, Suitable Concern, "Why Recommended" badge, "View Details" modal with full ingredients & directions, "Add to Favorites", and "Add to Cart".

---

### 3. 💆‍♀️ Beauty Services Catalog
- 10 Signature Treatments:
  1. *Hydra-Glow Deep Pore Facial*
  2. *Advanced Acne Care Therapy*
  3. *Deep Barrier Skin Care & Cryo Infusion*
  4. *Botanical Scalp & Hair Detox*
  5. *Royal Bridal Glow Makeup & Consultation*
  6. *Couture Hair Styling & Updos*
  7. *Luxury Organic Gel Manicure*
  8. *Herbal Dead Sea Pedicure Treatment*
  9. *Deep Aromatherapy Relaxation Spa*
  10. *Red Carpet Evening Glam Makeup*
- Each card contains duration, price, suitability, benefits checklist, and direct booking linkage.

---

### 4. 📅 Complete Appointment Booking & Management
- Interactive 4-step booking wizard: Service selection, Date picker, Time slot chips, Customer details.
- Real-time booking summary card and instant confirmation modal with Reference Code (e.g. `GC-2026-1044`).
- **My Bookings (`my-appointments.html`):** Filter by status (Confirmed, Pending, Completed, Cancelled) and cancel appointments with immediate `localStorage` synchronization.

---

### 5. ⚙️ Professional Admin Dashboard (`admin.html`)
- KPI Analytics Cards: Total Customers, Total Appointments, Today's Appointments, Total Products, Total Services, Estimated Revenue.
- Tabbed management:
  - **Appointments Manager:** Filter by status, change status via dropdown (Pending → Confirmed → Completed → Cancelled), delete bookings, and **Export to CSV**.
  - **Product Catalog CRUD:** View inventory, delete items, or open the **"Add Product"** modal to register new skincare items.
  - **Services Manager:** Monitor service pricing and durations.
  - **Client Directory:** View registered customers and their skin profiles.

---

### 6. 👤 User Authentication & Profile (`auth.html`)
- Signup, Login, Profile View, and Logout.
- Preset 1-Click Demo Logins:
  - **Demo User:** `demo@glowcare.com` / `password123`
  - **Demo Admin:** `admin@glowcare.com` / `admin123`
- Shows user's name in navbar and provides access to scan history and saved bookings.

---

### 7. 🛍️ Slide-Out Cart & Favorites Drawers
- Accessible from any page via navbar icons with reactive badge counters.
- Adjust quantities, remove items, calculate subtotals, and simulate checkout.

---

### 8. 🌓 Luxury Beauty Design System
- Modern glassmorphic navigation header with backdrop blur.
- Radiant rose gold, warm champagne, and clinical mint color palette.
- Light / Dark theme toggle with persistent state.
- Fully responsive across desktop, tablet, and mobile screens with mobile navigation drawer.

---

## 📁 Project Architecture

```
d:/beauty/
├── index.html              # Home Page (Hero, Scanner Preview, How It Works, Features)
├── scanner.html            # Smart Skin Analysis (Live Camera AI Scanner & Results)
├── products.html           # Skincare Products Catalog & Filters
├── services.html           # 10 Beauty Services & Direct Booking Links
├── book.html               # Appointment Booking Wizard & Summary
├── my-appointments.html    # User Appointments Tracker & Cancellation
├── auth.html               # Login, Signup, Profile & Demo Credentials
├── admin.html              # Admin Dashboard (KPIs, Appointments, CRUD, CSV Export)
├── about.html              # Brand Story, Privacy & Technology Overview
├── contact.html            # Contact Form, Clinic Info & FAQ Accordion
├── vercel.json             # Vercel deployment configuration
├── css/
│   ├── style.css           # Global Design System, Reset, Navbar, Footer, Components
│   ├── scanner.css         # Scanner HUD, Laser Sweep, Camera Feed & Results
│   └── admin.css           # Admin Dashboard layout, KPI cards & tables
└── js/
    ├── store.js            # Central LocalStorage Database (Products, Services, Bookings, Users)
    ├── navbar.js           # Navbar, Cart & Favorites Drawers, Theme Switcher & Audio Chimes
    ├── scanner.js          # Live Camera, BlazeFace / Chromatic Vision, Pixel Analysis
    ├── products.js         # Product Search, Filters, Details Modal & Cart Actions
    ├── services.js         # Beauty Services Grid & Category Filters
    ├── book.js             # Booking Wizard, Time Slot Chips & Confirmation Modal
    ├── my-appointments.js  # User Bookings Listing & Status Cancellation
    ├── auth.js             # Authentication & Demo Logins
    ├── admin.js            # Admin Operations, Status Changer & CSV Export
    └── contact.js          # Contact Validation & FAQ Accordion
```

---

## 🚀 How to Run Locally

Because the project is built with standard web technologies, you can run it using any static HTTP server.

### Option 1: Python HTTP Server
```bash
# In the project directory:
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your web browser (Chrome, Edge, Firefox, or Safari).

### Option 2: VS Code Live Server
1. Open the project folder in VS Code.
2. Right-click `index.html` and click **"Open with Live Server"**.

### Option 3: Node.js `serve` / `npx http-server`
```bash
npx http-server . -p 8080
```

> **Note on Camera Permissions:** Modern web browsers require either `http://localhost` or an `https://` secure connection to grant camera access. Running via localhost or deploying to Vercel/GitHub Pages enables full live camera capabilities.

---

## ☁️ Deployment Guide

### Deploying to Vercel
1. Push this repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and import the repository.
3. Keep default settings (`vercel.json` will automatically configure clean URLs).
4. Click **Deploy**.

### Deploying to GitHub Pages
1. Push this repository to GitHub.
2. Go to **Repository Settings** → **Pages**.
3. Under **Branch**, select `main` (or `master`) and folder `/ (root)`.
4. Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/`.

---

## 👥 Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Demo User** | `demo@glowcare.com` | `password123` |
| **Demo Admin** | `admin@glowcare.com` | `admin123` |

*(You can also use the 1-click quick-fill buttons directly on `auth.html`!)*

---

## 📜 Medical Disclaimer
**Glow Care provides general skincare guidance only. Results are not a medical diagnosis.** Glow Care does not prescribe medications or diagnose diseases. Always consult a licensed medical professional for severe dermatological conditions.
