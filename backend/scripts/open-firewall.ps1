# Allow inbound TCP 5000 for Aarambh API (phones on same Wi‑Fi / hotspot)
$ruleName = 'Aarambh API 5000'
$existing = netsh advfirewall firewall show rule name="$ruleName" 2>$null
if ($LASTEXITCODE -ne 0) {
  netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=5000
  Write-Host "Added firewall rule: $ruleName"
} else {
  Write-Host "Firewall rule already exists: $ruleName"
}
