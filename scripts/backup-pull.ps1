# Pulls a fresh, checked copy of the server database to this PC. Keeps the newest 30.
# Run by hand or from a daily Windows scheduled task. Needs the SSH key from the setup.
$srv = "ubuntu@15.235.63.24"
$key = "$HOME\.ssh\vps_key"
$dest = "$HOME\Documents\ToolTrackerBackups" # point this into a OneDrive-synced folder if you want it synced
New-Item -ItemType Directory -Force $dest | Out-Null

# Snapshot on the server, then refuse to pull one that fails SQLite's own check.
$check = ssh -i $key $srv "rm -f /tmp/tracker-now.db; sqlite3 ~/app/data/tracker.db '.backup /tmp/tracker-now.db' && sqlite3 /tmp/tracker-now.db 'PRAGMA integrity_check'"
if ($check -ne "ok") { throw "Server backup failed its check: $check" }

$file = Join-Path $dest ("tracker-" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".db")
scp -i $key "${srv}:/tmp/tracker-now.db" $file
ssh -i $key $srv "rm -f /tmp/tracker-now.db"
if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1000) { throw "Backup file missing or empty: $file" }

Get-ChildItem $dest -Filter "tracker-*.db" | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item
"Saved $file"
