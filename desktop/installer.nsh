; ─── Hess Solutions Shop ERP — Custom NSIS Installer Script ───────────────────
;
; This file extends the electron-builder NSIS template.
; It is included via the "include" key in electron-builder.yml.
;
; What it does:
;   1. Prompts for the data directory (where the database and uploads live)
;   2. Writes the chosen data path to a config file the server reads at startup
;   3. Offers to create a firewall rule so LAN users can reach the server
;

!macro customInstall
  ; ── Ask for data directory ───────────────────────────────────────────────
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 24u "Where should Shop ERP store your database and files?"
  Pop $0

  ${NSD_CreateDirRequest} 0 28u 85% 14u "$PROFILE\HessERP\data"
  Pop $1

  ${NSD_CreateBrowseButton} 88% 28u 12% 14u "Browse..."
  Pop $2

  GetFunctionAddress $3 OnBrowse
  nsDialogs::OnClick $2 $3

  nsDialogs::Show

  ; ── Write data path to config ────────────────────────────────────────────
  ${NSD_GetText} $1 $R0
  WriteRegStr HKCU "Software\HessSolutions\ShopERP" "DataPath" "$R0"
  CreateDirectory "$R0"
  CreateDirectory "$R0\uploads"
  CreateDirectory "$R0\backups"

  ; ── Optional: Windows Firewall rule for LAN access ───────────────────────
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Allow other computers on your network to access Shop ERP?$\n$\nThis creates a Windows Firewall rule for port 3001.$\nClick Yes for multi-user shop access, No for this PC only." \
    IDNO skipFirewall
  ExecWait 'netsh advfirewall firewall add rule name="Hess Shop ERP" dir=in action=allow protocol=TCP localport=3001 profile=private'
  skipFirewall:
!macroend

!macro customUnInstall
  ; ── Remove firewall rule on uninstall ────────────────────────────────────
  ExecWait 'netsh advfirewall firewall delete rule name="Hess Shop ERP"'

  ; ── Optionally remove data directory ─────────────────────────────────────
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove all Shop ERP data (database, uploads, backups)?$\n$\nWARNING: This cannot be undone." \
    IDNO skipDataRemoval
  ReadRegStr $R0 HKCU "Software\HessSolutions\ShopERP" "DataPath"
  RMDir /r "$R0"
  skipDataRemoval:
  DeleteRegKey HKCU "Software\HessSolutions\ShopERP"
!macroend

Function OnBrowse
  nsDialogs::SelectFolderDialog "Select data folder" "$PROFILE\HessERP\data"
  Pop $R0
  ${If} $R0 != "error"
    ${NSD_SetText} $1 "$R0"
  ${EndIf}
FunctionEnd
