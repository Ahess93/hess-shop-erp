ICON FILES REQUIRED FOR THE WINDOWS INSTALLER
==============================================

Place the following files in this folder before running "npm run dist":

  icon.ico   — Windows application icon (256x256 recommended, .ico format)
               Used for: the .exe file, installer, desktop shortcut, taskbar

  icon.png   — PNG version of the icon (512x512 recommended)
               Used for: the Electron app title bar and system tray

To create these files:
  1. Start with a high-resolution version of the Hess Solutions logo (PNG, at least 512x512)
  2. Use a free converter like https://convertio.co/png-ico/ to make icon.ico
  3. Save the 512x512 PNG as icon.png

Until you add these files, the installer will build but the app will show
no icon in the taskbar or title bar.

CODE-SIGNING CERTIFICATE
========================
To prevent Windows SmartScreen warnings ("Windows protected your PC"),
the installer needs to be signed with a code-signing certificate.

Options (from cheapest to most trusted):
  1. Self-signed (free, but still shows a SmartScreen warning)
  2. DigiCert / Sectigo OV certificate (~$200–400/year) — eliminates SmartScreen
  3. EV (Extended Validation) certificate (~$500+/year) — immediate trust

For internal shop use on your own machines, a self-signed certificate is fine.
To distribute to other shops, purchase an OV or EV certificate.

Once you have a .pfx certificate file:
  - Set environment variables: CSC_LINK=path/to/cert.pfx and CSC_KEY_PASSWORD=yourpassword
  - Run: npm run dist

More info: https://www.electron.build/code-signing
