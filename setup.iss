; ============================================================
; AJUQNET - Inno Setup Script
; Arka Jain University Quick Network System
; Version 10.0.3
; ============================================================
; HOW TO COMPILE:
;   1. Open this file in Inno Setup Compiler
;   2. Press F9 or click Build > Compile
;   3. Find AJUQNET_Setup.exe in the Output folder
; ============================================================

#define AppName      "AJUQNET"
#define AppVersion   "10.0.3"
#define AppPublisher "Arka Jain University"
#define AppURL       "http://localhost:3000"
#define AppExeName   "launch.bat"
#define ServiceName  "AJUQNET"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}

DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

OutputDir=Output
OutputBaseFilename=AJUQNET_Setup
SetupIconFile=

Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

WizardStyle=modern
WizardSizePercent=120
DisableWelcomePage=no
DisableReadyPage=no

UninstallDisplayName={#AppName} Campus System
CreateUninstallRegKey=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel1=Welcome to AJUQNET Setup
WelcomeLabel2=This will install AJUQNET v10.0.3 on your computer.%n%nAJUQNET is a complete digital campus management system built for Arka Jain University.%n%nDeveloped by:%n  * Aayush Jha%n  * Zaid Khan%n  * Himadri Sekhar%n  * Noor Alam%n%nProject Guide: Prof. Megha Sinha%n%nClick Next to continue.
FinishedLabel=AJUQNET has been successfully installed!%n%nYou can now launch the app using the desktop shortcut.%n%nDefault Login Accounts:%n  Admin:    ashwini@aju.edu   / Ashwini@123%n  Canteen:  canteen@aju.edu  / Canteen@123%n  Faculty:  dr.irfan@aju.edu / Irfan@1234%n  Student:  aayush@aju.edu   / Aayush@1234%n%nClick Finish to exit Setup.

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
Source: "server.js";                         DestDir: "{app}"; Flags: ignoreversion
Source: "seed.js";                           DestDir: "{app}"; Flags: ignoreversion
Source: "package.json";                      DestDir: "{app}"; Flags: ignoreversion

Source: "config\*";                          DestDir: "{app}\config";           Flags: ignoreversion recursesubdirs
Source: "middleware\*";                      DestDir: "{app}\middleware";        Flags: ignoreversion recursesubdirs
Source: "models\*";                          DestDir: "{app}\models";           Flags: ignoreversion recursesubdirs
Source: "routes\*";                          DestDir: "{app}\routes";           Flags: ignoreversion recursesubdirs
Source: "socket\*";                          DestDir: "{app}\socket";           Flags: ignoreversion recursesubdirs
Source: "utils\*";                           DestDir: "{app}\utils";            Flags: ignoreversion recursesubdirs
Source: "views\*";                           DestDir: "{app}\views";            Flags: ignoreversion recursesubdirs
Source: "public\*";                          DestDir: "{app}\public";           Flags: ignoreversion recursesubdirs

Source: "node_modules\*";                    DestDir: "{app}\node_modules";     Flags: ignoreversion recursesubdirs; Components: main

Source: "installer-scripts\*";              DestDir: "{app}\installer-scripts"; Flags: ignoreversion recursesubdirs

Source: "redist\node-v18.20.4-x64.msi";                          DestDir: "{app}\redist"; Flags: ignoreversion
Source: "redist\nssm.exe";                                        DestDir: "{app}\redist"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\AJUQNET Campus System"; Filename: "{app}\installer-scripts\launch.bat"; WorkingDir: "{app}"; Comment: "Launch AJUQNET Campus Management System"; Tasks: desktopicon
Name: "{group}\AJUQNET Campus System";       Filename: "{app}\installer-scripts\launch.bat"; WorkingDir: "{app}"; Comment: "Launch AJUQNET Campus Management System"
Name: "{group}\Uninstall AJUQNET";           Filename: "{uninstallexe}"

[Run]
Filename: "{app}\installer-scripts\install.bat"; Parameters: """{app}"""; WorkingDir: "{app}"; StatusMsg: "Setting up AJUQNET (installing Node.js, MongoDB, seeding database)..."; Flags: runhidden waituntilterminated
Filename: "{app}\installer-scripts\launch.bat";  WorkingDir: "{app}"; Description: "Launch AJUQNET now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\installer-scripts\uninstall.bat"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

[Components]
Name: "main"; Description: "AJUQNET Application Files"; Types: full compact custom; Flags: fixed

[Code]
procedure InitializeWizard();
begin
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;
