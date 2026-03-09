# AJUQNET — How to Build the Installer EXE

## Before You Start — Download These 3 Files

### 1. Node.js MSI
https://nodejs.org/dist/v18.20.4/node-v18.20.4-x64.msi
→ Save as: redist/node-v18.20.4-x64.msi

### 2. MongoDB MSI
https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.14-signed.msi
→ Save as: redist/mongodb-windows-x86_64-6.0.14-signed.msi

### 3. NSSM (Service Manager) EXE
https://nssm.cc/release/nssm-2.24.zip
→ Extract → find nssm.exe inside win64 folder
→ Save as: redist/nssm.exe

### 4. Inno Setup Compiler (on your PC only)
https://jrsoftware.org/download.php/is.exe
→ Install normally on your PC

---

## Your Folder Should Look Like This

AJUQNET v10.0.3/
├── redist/
│   ├── node-v18.20.4-x64.msi           ✅ you downloaded
│   ├── mongodb-windows-x86_64-6.0.14-signed.msi  ✅ you downloaded
│   └── nssm.exe                         ✅ you downloaded
├── installer-scripts/
│   ├── install.bat                      ✅ already created
│   ├── launch.bat                       ✅ already created
│   ├── uninstall.bat                    ✅ already created
│   └── generate-env.js                  ✅ already created
├── node_modules/                        ✅ already exists (npm install)
├── setup.iss                            ✅ already created
└── ... all your app files

---

## Steps to Build EXE

1. Make sure all files in redist/ are downloaded
2. Right-click setup.iss → Open with Inno Setup Compiler
3. Press F9 (or click Build > Compile)
4. Wait 2-3 minutes (it bundles everything)
5. Find your EXE at: AJUQNET v7/Output/AJUQNET_Setup.exe

---

## What the EXE Does on Any PC

1. Shows welcome screen with team names
2. Silently installs Node.js (if not present)
3. Silently installs MongoDB as Windows Service (if not present)
4. Copies all app files to C:\Program Files\AJUQNET
5. Auto-generates secure .env secrets
6. Seeds the database with demo accounts
7. Registers AJUQNET as a Windows Service (auto-starts on boot)
8. Creates desktop shortcut
9. Opens http://localhost:3000 in browser

---

## Demo Login Accounts (after install)

| Role    | Email                    | Password      |
|---------|--------------------------|---------------|
| Admin   | ashwini@campus.edu       | Ashwini@123   |
| Faculty | prof.megha@aju.edu       | Megha@123     |
| Student | zaid.khan@aju.edu        | Zaid@123      |
| Canteen | alliswell@aju.edu        | alliswell@123 |

---

## Developed By
- Zaid Khan
- Noor Alam  
- Himadri Sekhar
- Aayush Jha

Project Guide: Prof. Megha Sinha
Arka Jain University — CSE Final Year Project — v7.0.0
