$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root '.vercel-deploy.log'
$status = Join-Path $root '.vercel-deploy-status.txt'

if (Test-Path -LiteralPath $log) {
  Remove-Item -LiteralPath $log -Force
}

'VERCEL_DEPLOY_STARTED' | Set-Content -LiteralPath $status -Encoding utf8

Set-Location $root

Write-Host 'Kagie Vercel deployment flow starting...' -ForegroundColor Cyan
Write-Host '1. Complete Vercel login if prompted.' -ForegroundColor Yellow
Write-Host '2. Complete project link prompts if prompted.' -ForegroundColor Yellow
Write-Host '3. Deployment will continue automatically after that.' -ForegroundColor Yellow

npx.cmd vercel@latest login 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'LOGIN_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Vercel login failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'VERCEL_LOGIN_OK' | Set-Content -LiteralPath $status -Encoding utf8

npx.cmd vercel@latest link 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'LINK_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Vercel project link failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'VERCEL_LINK_OK' | Set-Content -LiteralPath $status -Encoding utf8

npm.cmd run build 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'BUILD_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Local release build failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'VERCEL_BUILD_OK' | Set-Content -LiteralPath $status -Encoding utf8

npx.cmd vercel@latest deploy --prebuilt --prod --yes 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'DEPLOY_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Vercel production deploy failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'DEPLOY_OK' | Set-Content -LiteralPath $status -Encoding utf8
Write-Host 'Kagie Vercel production deploy completed.' -ForegroundColor Green
