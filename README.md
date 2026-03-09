# 🎓 AJUQNET — Arka Jain University Quick Network System

> **A complete digital campus management system** built with Node.js, Express, MongoDB, EJS, and Socket.io.
> Covers everything from canteen ordering and table booking to encrypted real-time chat, smart attendance, and instant announcements — all under a single secure login.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Feature List](#-feature-list)
3. [Technology Stack](#-technology-stack)
4. [Folder Structure](#-folder-structure)
5. [Prerequisites](#-prerequisites)
6. [Installation — Step by Step](#-installation--step-by-step)
   - [Step 1 — Clone / Download the project](#step-1--clone--download-the-project)
   - [Step 2 — Install Node.js dependencies](#step-2--install-nodejs-dependencies)
   - [Step 3 — Install and start MongoDB](#step-3--install-and-start-mongodb)
   - [Step 4 — Create the environment file](#step-4--create-the-environment-file)
   - [Step 5 — Generate secret keys](#step-5--generate-secret-keys)
   - [Step 6 — Seed the database](#step-6--seed-the-database)
   - [Step 7 — Start the server](#step-7--start-the-server)
   - [Step 8 — Open in browser](#step-8--open-in-browser)
7. [Demo Login Accounts](#-demo-login-accounts)
8. [All Routes Reference](#-all-routes-reference)
9. [Role Permissions Matrix](#-role-permissions-matrix)
10. [Environment Variables Reference](#-environment-variables-reference)
11. [Database Models](#-database-models)
12. [Socket.io Events](#-socketio-events)
13. [Troubleshooting](#-troubleshooting)
14. [Production Deployment](#-production-deployment)

---

## 🏫 Project Overview

AJUQNET is a **multi-role, multi-module web application** designed to digitize the day-to-day operations of a university campus. It replaces paper-based processes with a unified platform where:

- **Students** order food, book canteen tables, track attendance, and read announcements
- **Faculty** mark class attendance, post announcements, and communicate in encrypted chat rooms
- **Canteen staff** manage the kitchen order queue and daily table bookings
- **Admins** control all users, roles, content, and system data from a single audit panel

Everything is secured with session-based authentication, role-based access control, bcrypt password hashing, and AES-256-GCM encryption for all chat messages.

---

## ✨ Feature List

### 🔐 Authentication & Account Security
- Email + password login and self-registration
- Passwords hashed with **bcrypt** at 12 salt rounds
- Account **lockout after 3 failed login attempts** (30-minute lock, configurable)
- Admins can manually unlock accounts from the audit panel
- Sessions stored securely in MongoDB via `connect-mongo`
- Cookies are `httpOnly`, `sameSite: lax`, and `secure` in production
- **Helmet** middleware adds 15+ HTTP security headers automatically
- **Global rate limiter**: max 100 requests per IP per 15 minutes
- Admin accounts cannot be self-registered — admin access is granted only by existing admins

### 👥 Role-Based Access Control
| Role | What They Can Do |
|------|-----------------|
| `admin` | Everything — user management, all content, all stats |
| `faculty` | Mark attendance, post announcements, orders, bookings, chat |
| `student` | Place orders, book tables, view own attendance, read announcements, chat |
| `canteen` | Kitchen order queue, table booking management |

### 🛡️ Admin Audit Panel
- Paginated, searchable user list with role filter
- Activate or deactivate any account
- Promote or demote any user's role
- Delete users permanently
- Unlock brute-force-locked accounts
- View platform-wide stats: orders by status, bookings by status, daily message volume

### 🍽️ Canteen Menu Management
- Menu items grouped by category: Breakfast, Lunch, Dinner, Snacks, Beverages, Desserts, Specials
- Each item has: name, description, price (₹), preparation time, vegetarian flag, allergen tags
- Allergen labels: gluten, dairy, nuts, eggs, soy, shellfish
- Stock tracking — items become unavailable when stock hits zero
- Stock auto-restores if an order containing that item is cancelled
- Admin and faculty can add, edit, and toggle item availability

### 🛒 Food Ordering System
- Place orders from the live menu with item quantity and special instructions per item
- Auto-generated order number with date prefix (`ORD-YYYYMMDD-XXXX`)
- Subtotal + 5% tax calculated at checkout
- Optional delivery location and order notes
- Full order status pipeline with role-based transitions:
  ```
  pending → confirmed → preparing → ready → delivered
         ↘                                           ↗
                      cancelled (any active stage)
  ```
- Students can cancel their own pending orders
- Canteen staff advance orders through the kitchen stages
- Every status change is logged with timestamp and the name of who changed it
- Real-time push update via **Socket.io** — status badge on the order page updates without refresh
- Order owner receives an in-app notification on every status change
- Admin/faculty can view order statistics: revenue by status, top 5 menu items

### 💳 Payment Simulation
- Fintech-style payment page triggered from the order detail page
- **Four payment methods:**
  - **UPI** — animated QR code skeleton, 2-minute countdown timer, copy UPI ID button
  - **Card** — live card preview updates as you type; detects Visa / Mastercard / RuPay / Amex by prefix; front/back flip animation for CVV
  - **Net Banking** — 6 major banks as quick-select + "Other Banks" dropdown
  - **Cash** — simple confirm screen
- Success modal with animated progress bar, then auto-redirect to order detail
- Payment status stored on the order: `unpaid`, `paid`, `refunded`
- Payment method and timestamp recorded
- Real-time notification sent to user confirming payment

### 🪑 Table Booking System
- 12 pre-seeded tables across 5 sections: Indoor, Outdoor, Rooftop, Private, Cafeteria
- Each table has: table number, capacity, section, floor, description, amenities
- Amenities: AC, window view, wheelchair accessible, power outlet, projector, whiteboard
- Book with date, start time, duration, guest count, purpose, and special requests
- **Overlap conflict detection** — algorithm prevents any two bookings from sharing the same table at the same time
- Auto-generated booking reference (`BKG-YYYYMMDD-XXXX`)
- Booking pipeline:
  ```
  pending → confirmed → checked_in → completed
          ↘           ↘
            cancelled   no_show
  ```
- Students can cancel their own pending or confirmed bookings
- Tables can be marked under maintenance, making them temporarily un-bookable
- Canteen staff can browse all bookings filtered by date

### 💬 Real-Time Encrypted Chat
- **Public rooms** (visible to all matching roles), **private rooms** (invite-only), **1-on-1 direct messages**
- All messages encrypted with **AES-256-GCM** (envelope format: `iv:authTag:ciphertext`) before saving to MongoDB — plaintext is never written to disk
- Encryption key set via environment variable, verified at boot with a self-test
- Reply to specific messages with threaded quote previews
- Edit your own messages (encrypted edit history retained for audit trail)
- Soft-delete messages (shows "[deleted]" tombstone; original never recoverable without the key)
- Emoji reactions — add and toggle reactions on any message
- Read receipts
- Typing indicators ("Alice is typing…")
- Online/offline presence tracking per room
- Paginated message history (load older messages on scroll)
- Admin/faculty can create new group rooms with custom role restrictions
- Pre-seeded rooms: General, CS Department, Faculty Lounge, Admin HQ, Canteen Updates

### 🔔 Real-Time Notification System
- Bell icon in the navbar with live unread count badge
- Notifications are pushed instantly via **Socket.io** — no page refresh needed
- Notification types: `order`, `booking`, `chat`, `admin`, `system`
- Clicking a notification deep-links to the relevant resource
- Mark individual notifications read, or mark all read at once
- Triggers: order status changes, payment confirmation, booking updates, new announcements

### ✅ Smart Attendance System
- Faculty selects subject, department, and date on a single page, then marks each student
- Status options per student: **Present**, **Absent**, **Late**
- "All Present" and "All Absent" quick-set buttons for large classes
- Live student search filter (no page reload)
- Form submits all rows in one POST using dynamically built hidden fields
- **Duplicate prevention** — one record per student per subject per date (MongoDB unique index)
- On duplicate, the existing record is upserted (updated, not duplicated)
- **Student view** (`/attendance/view`):
  - Overall attendance % with colour-coded progress bar (green ≥75%, red <75%)
  - Subject-by-subject breakdown with percentage and Good / At Risk / Low badge
  - Warning banner if overall attendance falls below 75%
  - Filter records by subject
  - Last 60 days of individual records in a table
- **Faculty/Admin report** (`/attendance/report`):
  - Select any student from a dropdown; optional subject filter
  - Same summary cards and breakdown table as student view
  - Full record list with who marked it and any notes
- Attendance snapshot widget on the student dashboard

### 📢 Announcement System
- Faculty and admin can publish announcements with title, message, priority, and audience
- **Priority levels:** Info (blue), Warning (yellow), Urgent (red)
- **Audience targeting:** broadcast to all, or limit to a specific department
- Optional expiry date — announcement disappears from the list after the date passes
- Pin announcements to the top of the list
- Live character counter (max 2000 chars) and live preview panel while writing
- On publish, the system sends an in-app notification to every matching student instantly
- Faculty can delete their own announcements; admins can delete anyone's
- Latest 3 announcements shown as a widget on student and faculty dashboards

### 📊 Role-Specific Dashboards
| Dashboard | What It Shows |
|-----------|--------------|
| **Student** | Total orders, active orders, active bookings, attendance overview, latest announcements, recent orders |
| **Faculty** | Student count, quick-action cards (mark attendance, post announcement, order, book, report, chat), latest announcements |
| **Admin** | Total users by role, locked accounts, pending orders, today's messages, recent user registrations |
| **Canteen** | Pending/active/preparing/ready order counts, today's bookings count, live order queue |

---

## 🛠️ Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | ≥ 18.0.0 |
| Web framework | Express.js | ^4.19 |
| Database | MongoDB | ≥ 6.0 |
| ODM | Mongoose | ^8.4 |
| Templating | EJS | ^3.1 |
| Real-time | Socket.io | ^4.7 |
| Session store | express-session + connect-mongo | ^1.18 / ^5.1 |
| Password hashing | bcrypt | ^5.1 |
| Message encryption | Node.js `crypto` (AES-256-GCM) | built-in |
| Security headers | Helmet | ^8.0 |
| Rate limiting | express-rate-limit | ^7.4 |
| Input validation | express-validator | ^7.2 |
| Frontend UI | Bootstrap 5 + Bootstrap Icons | CDN |
| Dev tooling | nodemon, dotenv | ^3.1 / ^16.4 |

---

## 📁 Folder Structure

```
campus-app/
│
├── config/
│   └── database.js              MongoDB connection setup
│
├── middleware/
│   ├── auth.js                  requireAuth, requireRole, attachUserLocals
│   └── validators.js            express-validator rules for login, register, orders
│
├── models/
│   ├── User.js                  Users with roles, bcrypt, account locking
│   ├── MenuItem.js              Canteen menu items with stock
│   ├── Order.js                 Orders with status machine and payment fields
│   ├── Table.js                 Physical canteen tables with amenities
│   ├── Booking.js               Table reservations with conflict detection
│   ├── ChatRoom.js              Chat rooms (public / private / direct)
│   ├── Message.js               AES-256-GCM encrypted messages
│   ├── Notification.js          In-app notifications with Socket.io push
│   ├── Attendance.js            Attendance records with per-subject summary
│   └── Announcement.js         Announcements with expiry and department targeting
│
├── routes/
│   ├── auth.js                  Login, register, logout
│   ├── dashboard.js             Role-specific dashboards + profile
│   ├── menu.js                  Browse and manage menu items
│   ├── orders.js                Place orders, update status, payment
│   ├── tables.js                Browse tables, add/edit (admin)
│   ├── bookings.js              Create and manage table bookings
│   ├── chat.js                  Room list, room entry, DM creation, history API
│   ├── admin.js                 User management audit panel
│   ├── canteen.js               Kitchen order queue, canteen booking view
│   ├── notifications.js         Mark read, list notifications
│   ├── attendance.js            Mark attendance, student view, faculty report
│   └── announcements.js        Create, list, delete announcements
│
├── socket/
│   ├── index.js                 Socket.io server init, session auth gate
│   ├── authMiddleware.js        Session verification for WebSocket connections
│   └── chatHandlers.js         send, edit, delete, react, typing, presence events
│
├── utils/
│   └── encryption.js            AES-256-GCM encrypt/decrypt/selfTest
│
├── views/
│   ├── partials/
│   │   ├── layout_start.ejs     HTML head + sidebar + topbar open tags
│   │   ├── layout_end.ejs       Bootstrap scripts, Socket.io client, close tags
│   │   ├── sidebar.ejs          Role-aware navigation sidebar
│   │   ├── topbar.ejs           Notification bell + user menu
│   │   └── status_badge.ejs     Reusable coloured status badge
│   │
│   ├── auth/                    login.ejs, register.ejs
│   ├── dashboard/               admin.ejs, faculty.ejs, student.ejs, canteen.ejs, profile.ejs
│   ├── menu/                    index.ejs, form.ejs
│   ├── orders/                  index.ejs, new.ejs, detail.ejs, stats.ejs, payment.ejs
│   ├── tables/                  index.ejs, form.ejs, detail.ejs
│   ├── bookings/                index.ejs, new.ejs, detail.ejs
│   ├── chat/                    index.ejs, room.ejs
│   ├── admin/                   panel.ejs
│   ├── attendance/              mark.ejs, view.ejs, report.ejs
│   ├── announcements/           index.ejs, new.ejs
│   ├── canteen/                 orders.ejs, bookings.ejs
│   └── error.ejs
│
├── public/
│   ├── css/style.css            Custom styles + dark mode variables
│   └── js/main.js               Client-side JS for chat, notifications, order UI
│
├── server.js                    App entry point — middleware, routes, Socket.io
├── seed.js                      Database seeder (users, menu, tables, chat rooms)
├── package.json
└── .env.example
```

---

## ✅ Prerequisites

Before you begin, make sure you have the following installed:

| Requirement | Minimum Version | Check Command | Download |
|------------|----------------|---------------|----------|
| Node.js | 18.0.0 | `node --version` | https://nodejs.org |
| npm | 9.0.0 | `npm --version` | (comes with Node.js) |
| MongoDB | 6.0 | `mongod --version` | https://www.mongodb.com/try/download/community |
| Git | any | `git --version` | https://git-scm.com (optional) |

---

## 🚀 Installation — Step by Step

### Step 1 — Clone / Download the project

**Option A — Using Git:**
```bash
git clone https://github.com/your-username/campus-app.git
cd campus-app
```

**Option B — Download ZIP:**
1. Download the project ZIP file
2. Extract it to a folder
3. Open a terminal and `cd` into the extracted folder:
```bash
cd campus-app
```

---

### Step 2 — Install Node.js dependencies

```bash
npm install
```

This installs all packages listed in `package.json` into a local `node_modules/` folder.
It should finish without errors. Expected output ends with something like:
```
added 243 packages in 12s
```

---

### Step 3 — Install and start MongoDB

#### On Windows:
1. Download the MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Run the installer (MSI), follow defaults, and tick "Install MongoDB as a Service"
3. MongoDB will start automatically on boot. To start manually:
```cmd
net start MongoDB
```
Or from the installation folder:
```cmd
mongod --dbpath C:\data\db
```
> Make sure `C:\data\db` exists: `mkdir C:\data\db`

#### On macOS (using Homebrew):
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### On Ubuntu / Debian Linux:
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongod
sudo systemctl enable mongod   # start on boot
```

#### Verify MongoDB is running:
```bash
mongosh
# Should show: "Connecting to: mongodb://127.0.0.1:27017"
# Type exit to quit
```

---

### Step 4 — Create the environment file

Copy the example environment file:
```bash
cp .env.example .env
```

> On Windows (Command Prompt):
> ```cmd
> copy .env.example .env
> ```

Now open `.env` in any text editor (Notepad, VS Code, etc.) and fill in the values:

```dotenv
# ── Server ───────────────────────────────────────
PORT=3000

# ── Database ─────────────────────────────────────
MONGODB_URI=mongodb://127.0.0.1:27017/campus_db

# ── Sessions ─────────────────────────────────────
# Paste the output of the SESSION_SECRET command below
SESSION_SECRET=PASTE_YOUR_64_BYTE_HEX_SECRET_HERE
SESSION_MAX_AGE=3600000

# ── Chat encryption ───────────────────────────────
# Paste the output of the CHAT_ENCRYPTION_KEY command below
CHAT_ENCRYPTION_KEY=PASTE_YOUR_32_BYTE_HEX_KEY_HERE

# ── Security ──────────────────────────────────────
MAX_LOGIN_ATTEMPTS=3
LOCK_TIME_MINUTES=30

# ── Environment ───────────────────────────────────
NODE_ENV=development
```

---

### Step 5 — Generate secret keys

You need two secrets. Run each command in your terminal and paste the output into `.env`:

**Generate SESSION_SECRET** (needs to be long and random):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output (128-character hex string) and paste it as the value for `SESSION_SECRET`.

**Generate CHAT_ENCRYPTION_KEY** (must be exactly 64 hex characters = 32 bytes):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output (64-character hex string) and paste it as the value for `CHAT_ENCRYPTION_KEY`.

> ⚠️ **Important:** Keep these values secret. Never commit them to version control.
> If you change `CHAT_ENCRYPTION_KEY` after seeding, all existing chat messages become unreadable.

Your completed `.env` should look like this:
```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/campus_db
SESSION_SECRET=a3f8c2d91e7b4056aa12...    (128 chars)
SESSION_MAX_AGE=3600000
CHAT_ENCRYPTION_KEY=7f4e2a1b9c3d8e5f...   (64 chars)
MAX_LOGIN_ATTEMPTS=3
LOCK_TIME_MINUTES=30
NODE_ENV=development
```

---

### Step 6 — Seed the database

This command creates sample users, menu items, tables, and chat rooms so the app is ready to use immediately:

```bash
npm run seed
```

Expected output:
```
🌱  Campus System — Seed Script
════════════════════════════
✅  MongoDB connected
🗑   Cleared existing data
👤  Created 7 users
🍽   Created 19 menu items
🪑  Created 12 tables
💬  Created 5 chat rooms
════════════════════════════
✅  Seed complete!

Admin Login:
  ashwini@aju.edu / Ashwini@123

Faculty Login:
  dr.irfan@aju.edu / Irfan@123
  prof.megha@aju.edu / Megha@123

Student Login:
  zaid.khan@aju.edu / Zaid@123
  noor.alam@aju.edu / Noor@123
  aayush.jha@aju.edu / Aayush@123
  himadri.sekhar@aju.edu / Himadri@123
```

> ⚠️ Re-running `npm run seed` will **wipe and recreate** all data. Do not run it on a live database with real data.

---

### Step 7 — Start the server

**Development mode** (auto-restarts when you edit files):
```bash
npm run dev
```

**Production mode** (no auto-restart):
```bash
npm start
```

You should see:
```
✅ AES-256-GCM self-test passed

🚀  http://localhost:3000
🎓  Campus Management System v6.0 — AJUQNET
🔐  Session + bcrypt + AES-256-GCM encryption
💬  Real-time chat via Socket.io
```

If you see `AES-256-GCM self-test FAILED`, your `CHAT_ENCRYPTION_KEY` in `.env` is missing or malformed. Re-generate it using the command in Step 5.

---

### Step 8 — Open in browser

Navigate to:
```
http://localhost:3000
```

You will be redirected to the login page. Use any of the demo credentials below to log in.

---

## 🔑 Demo Login Accounts

| Role | Name | Email | Password |
|------|------|-------|----------|
| Admin | Ashwini Kumar | ashwini@aju.edu | Ashwini@123 |
| Faculty | Dr. Irfan Khan | dr.irfan@aju.edu | Irfan@123 |
| Faculty | Prof. Megha Sinha | prof.megha@aju.edu | Megha@123 |
| Student | Zaid Khan | zaid.khan@aju.edu | Zaid@123 |
| Student | Noor Alam | noor.alam@aju.edu | Noor@123 |
| Student | Aayush Jha | aayush.jha@aju.edu | Aayush@123 |
| Student | Himadri Sekhar | himadri.sekhar@aju.edu | Himadri@123 |

> There is no pre-seeded canteen staff account. To create one: register a new account, then log in as Admin, go to the Admin Panel, and change that user's role to `canteen`.

---

## 🗺️ All Routes Reference

### Authentication
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/auth/login` | Login page | Public |
| POST | `/auth/login` | Submit login | Public |
| GET | `/auth/register` | Registration page | Public |
| POST | `/auth/register` | Submit registration | Public |
| POST | `/auth/logout` | Logout and destroy session | Any logged-in |

### Dashboard
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/dashboard` | Redirect to role dashboard | Any logged-in |
| GET | `/dashboard/admin` | Admin dashboard | Admin |
| GET | `/dashboard/faculty` | Faculty dashboard | Faculty, Admin |
| GET | `/dashboard/student` | Student dashboard | Student, Faculty, Admin |
| GET | `/dashboard/canteen` | Canteen staff dashboard | Canteen, Admin |
| GET | `/dashboard/profile` | My profile page | Any logged-in |

### Menu
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/menu` | Browse all menu items | Any logged-in |
| GET | `/menu/new` | Add item form | Admin, Faculty |
| POST | `/menu` | Create menu item | Admin, Faculty |
| GET | `/menu/:id/edit` | Edit item form | Admin, Faculty |
| POST | `/menu/:id` | Update item | Admin, Faculty |
| POST | `/menu/:id/toggle` | Toggle availability | Admin, Faculty |

### Orders
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/orders` | My orders list | Any logged-in |
| GET | `/orders/new` | Place order (menu + cart) | Any logged-in |
| POST | `/orders` | Submit order | Any logged-in |
| GET | `/orders/stats` | Order revenue stats | Admin, Faculty |
| GET | `/orders/:id` | Order detail | Any logged-in (own orders only for students) |
| POST | `/orders/:id/status` | Update order status | Role-restricted transitions |
| GET | `/orders/:id/pay` | Payment page | Order owner only |
| POST | `/orders/:id/pay` | Process payment | Order owner only |

### Tables
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/tables` | Browse tables | Any logged-in |
| GET | `/tables/new` | Add table form | Admin |
| POST | `/tables` | Create table | Admin |
| GET | `/tables/:id` | Table detail | Any logged-in |
| GET | `/tables/:id/edit` | Edit table form | Admin |
| POST | `/tables/:id` | Update table | Admin |

### Bookings
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/bookings` | My bookings | Any logged-in |
| GET | `/bookings/new` | New booking form | Any logged-in |
| POST | `/bookings` | Submit booking | Any logged-in |
| GET | `/bookings/:id` | Booking detail | Any logged-in (own for students) |
| POST | `/bookings/:id/status` | Update booking status | Role-restricted |

### Chat
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/chat` | Room list | Any logged-in |
| GET | `/chat/room/:id` | Enter a chat room | Room members/public |
| POST | `/chat/rooms` | Create new group room | Admin, Faculty |
| POST | `/chat/direct` | Open/find DM with user | Any logged-in |
| GET | `/chat/api/rooms/:id/messages` | Paginated message history (JSON) | Room members |
| GET | `/chat/api/users/search` | Search users for DM | Any logged-in |

### Attendance
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/attendance` | Redirect based on role | Any logged-in |
| GET | `/attendance/mark` | Mark attendance form | Faculty, Admin |
| POST | `/attendance/mark` | Save attendance records | Faculty, Admin |
| GET | `/attendance/view` | Student's own attendance | Student |
| GET | `/attendance/report` | View any student's report | Faculty, Admin |

### Announcements
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/announcements` | View all active announcements | Any logged-in |
| GET | `/announcements/new` | New announcement form | Faculty, Admin |
| POST | `/announcements` | Publish announcement | Faculty, Admin |
| POST | `/announcements/:id/delete` | Delete announcement | Faculty (own), Admin (any) |

### Notifications
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/notifications` | List recent notifications | Any logged-in |
| POST | `/notifications/:id/read` | Mark one as read | Any logged-in |
| POST | `/notifications/read-all` | Mark all as read | Any logged-in |

### Admin
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/admin` | Audit panel (user list + stats) | Admin only |
| POST | `/admin/users/:id/unlock` | Unlock locked account | Admin only |
| POST | `/admin/users/:id/deactivate` | Toggle account active status | Admin only |
| POST | `/admin/users/:id/role` | Change user role | Admin only |
| POST | `/admin/users/:id/delete` | Delete user | Admin only |

### Canteen Staff
| Method | Path | Description | Access |
|--------|------|-------------|--------|
| GET | `/canteen/orders` | Live kitchen order queue | Canteen, Admin |
| POST | `/canteen/orders/:id/status` | Advance order status | Canteen, Admin |
| GET | `/canteen/bookings` | Today's table bookings | Canteen, Admin |

---

## 🔒 Role Permissions Matrix

| Feature | Admin | Faculty | Student | Canteen |
|---------|:-----:|:-------:|:-------:|:-------:|
| View menu | ✅ | ✅ | ✅ | ✅ |
| Add/edit menu items | ✅ | ✅ | ❌ | ❌ |
| Place food order | ✅ | ✅ | ✅ | ❌ |
| Cancel own order | ✅ | ✅ | ✅ (pending only) | ❌ |
| Advance order status | ✅ | ✅ | ❌ | ✅ (kitchen stages) |
| Pay for order | ✅ | ✅ | ✅ | ❌ |
| View order stats | ✅ | ✅ | ❌ | ❌ |
| Book a table | ✅ | ✅ | ✅ | ❌ |
| Confirm/check-in bookings | ✅ | ✅ | ❌ | ❌ |
| Manage tables (add/edit) | ✅ | ❌ | ❌ | ❌ |
| View canteen order queue | ✅ | ❌ | ❌ | ✅ |
| View canteen bookings | ✅ | ❌ | ❌ | ✅ |
| Chat (public rooms) | ✅ | ✅ | ✅ | ❌ |
| Chat (faculty-only rooms) | ✅ | ✅ | ❌ | ❌ |
| Create chat rooms | ✅ | ✅ | ❌ | ❌ |
| Mark attendance | ✅ | ✅ | ❌ | ❌ |
| View own attendance | ✅ | ✅ | ✅ | ❌ |
| View any student's attendance | ✅ | ✅ | ❌ | ❌ |
| Post announcements | ✅ | ✅ | ❌ | ❌ |
| Delete any announcement | ✅ | ❌ | ❌ | ❌ |
| Admin audit panel | ✅ | ❌ | ❌ | ❌ |
| Manage users (lock/unlock/role/delete) | ✅ | ❌ | ❌ | ❌ |

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Port the HTTP server listens on |
| `MONGODB_URI` | Yes | — | Full MongoDB connection string |
| `SESSION_SECRET` | Yes | — | Secret for signing session cookies. Min 64 random bytes |
| `SESSION_MAX_AGE` | No | `3600000` | Session lifetime in milliseconds (default = 1 hour) |
| `CHAT_ENCRYPTION_KEY` | Yes | — | 64-char hex string (32 bytes) used for AES-256-GCM chat encryption |
| `MAX_LOGIN_ATTEMPTS` | No | `3` | Failed login attempts before account lock |
| `LOCK_TIME_MINUTES` | No | `30` | How long accounts stay locked in minutes |
| `NODE_ENV` | No | `development` | Set to `production` to enable HTTPS-only cookies and HSTS |
| `CLIENT_ORIGIN` | No | `http://localhost:3000` | Used by Socket.io CORS config in production |

---

## 🗃️ Database Models

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `User` | `users` | name, email, password (hashed), role, department, studentId, isActive, loginAttempts, lockUntil |
| `MenuItem` | `menuitems` | name, category, price, isAvailable, isVegetarian, allergens, stock, preparationTime |
| `Order` | `orders` | orderNumber, placedBy, items[], status, statusHistory[], subtotal, tax, total, paymentStatus, paymentMethod, paidAt |
| `Table` | `tables` | tableNumber, section, capacity, amenities[], isActive, isUnderMaintenance, floor |
| `Booking` | `bookings` | bookingReference, bookedBy, table, date, startTime, endTime, guestCount, purpose, status, statusHistory[] |
| `ChatRoom` | `chatrooms` | name, slug, type (public/private/direct), allowedRoles[], members[], directKey |
| `Message` | `messages` | room, sender, senderName, encryptedContent, messageType, replyTo, isEdited, editHistory[], isDeleted, reactions[], readBy[] |
| `Notification` | `notifications` | recipient, title, body, type, link, read |
| `Attendance` | `attendances` | student, markedBy, subject, department, date, status (present/absent/late), note |
| `Announcement` | `announcements` | title, message, department, priority, expiresAt, pinned, createdBy |

---

## 📡 Socket.io Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `chat:join` | `{ roomId }` | Join a chat room |
| `chat:leave` | `{ roomId }` | Leave a chat room |
| `chat:send` | `{ roomId, content, replyToId? }` | Send a message |
| `chat:edit` | `{ messageId, newContent }` | Edit your message |
| `chat:delete` | `{ messageId }` | Soft-delete a message |
| `chat:react` | `{ messageId, emoji }` | Toggle an emoji reaction |
| `chat:typing` | `{ roomId, isTyping }` | Start/stop typing indicator |
| `chat:read` | `{ roomId, messageId }` | Mark messages as read |

### Server → Client
| Event | Description |
|-------|-------------|
| `chat:message` | New message broadcast to room |
| `chat:message_edited` | Edited message broadcast |
| `chat:message_deleted` | Deletion tombstone broadcast |
| `chat:reaction` | Reaction update broadcast |
| `chat:typing` | Typing indicator |
| `chat:read` | Read receipt update |
| `chat:history` | Paginated message history |
| `chat:members` | Online member list on join |
| `chat:online` | A user came online in the room |
| `chat:offline` | A user left the room |
| `chat:error` | Error feedback to sender only |
| `notification:new` | New notification pushed to `user:<id>` room |
| `order:statusUpdate` | Order status changed, pushed to order owner |

---

## 🛠️ Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `CHAT_ENCRYPTION_KEY env var is required` | `.env` file missing or key not set | Follow Step 4 and Step 5 again |
| `AES-256-GCM self-test FAILED` | Key is not valid hex or wrong length | Re-generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `connect ECONNREFUSED 127.0.0.1:27017` | MongoDB is not running | Start MongoDB (see Step 3) |
| `npm run seed` crashes immediately | MongoDB not running, or wrong `MONGODB_URI` | Start MongoDB; check `.env` |
| Port 3000 already in use | Another process using the port | Set `PORT=3001` in `.env` |
| Login says "Account deactivated" | Admin deactivated the account | Log in as admin and reactivate from the audit panel |
| Login says "Account locked" | Too many wrong password attempts | Wait 30 minutes, or log in as admin and unlock |
| Chat messages show `[unavailable]` | `CHAT_ENCRYPTION_KEY` changed after messages were stored | Restore the original key; messages encrypted with a different key cannot be decrypted |
| Notifications not showing in real time | Browser blocked WebSocket or Socket.io not connecting | Check browser console for WebSocket errors; ensure `CLIENT_ORIGIN` in `.env` matches your URL |
| `npm install` fails | Node.js version too old | Upgrade to Node.js 18 or later |
| White screen after login | EJS render error | Check terminal for the error message; likely a view template issue |
| `Cannot find module '...'` | `npm install` was not run | Run `npm install` in the project root |

---

## 🚢 Production Deployment

When deploying to a live server, make the following changes:

### 1. Set NODE_ENV
```dotenv
NODE_ENV=production
```
This enables HTTPS-only secure cookies and HTTP Strict Transport Security (HSTS).

### 2. Use a strong MongoDB URI
```dotenv
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/campus_db
```
Use MongoDB Atlas (free tier available at https://www.mongodb.com/atlas) or a self-hosted replica set.

### 3. Set CLIENT_ORIGIN to your domain
```dotenv
CLIENT_ORIGIN=https://yourdomain.com
```

### 4. Use a process manager
```bash
npm install -g pm2
pm2 start server.js --name ajuqnet
pm2 save
pm2 startup
```

### 5. Put a reverse proxy in front (Nginx example)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
> The `Upgrade` and `Connection` headers are required for Socket.io WebSocket connections to work through the proxy.

### 6. Get a free SSL certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 👨‍💻 Development Tips

**Watch file changes and auto-restart:**
```bash
npm run dev
```

**View live MongoDB data:**
```bash
mongosh campus_db
db.users.find().pretty()
db.orders.find().pretty()
db.attendances.find().pretty()
```

**Reset everything and re-seed:**
```bash
npm run seed
```

**Check which port is in use:**
```bash
# Linux / Mac
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**Generate a new encryption key at any time:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

*Built for Arka Jain University — AJUQNET v6.0*