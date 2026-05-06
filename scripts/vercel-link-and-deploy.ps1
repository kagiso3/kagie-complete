$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root '.vercel-link-deploy.log'
$status = Join-Path $root '.vercel-link-deploy-status.txt'

if (Test-Path -LiteralPath $log) {
  Remove-Item -LiteralPath $log -Force
}

'STARTED' | Set-Content -LiteralPath $status -Encoding utf8

Set-Location $root

Write-Host 'Kagie Vercel link + deploy flow starting...' -ForegroundColor Cyan
Write-Host 'If prompted:' -ForegroundColor Yellow
Write-Host '1. Sign in to Vercel if needed.' -ForegroundColor Yellow
Write-Host '2. Choose your scope/account.' -ForegroundColor Yellow
Write-Host '3. Link to an existing Kagie project if you already created one, otherwise create a new one.' -ForegroundColor Yellow
Write-Host '4. Let the script continue through build and production deploy.' -ForegroundColor Yellow

npx.cmd vercel@latest link 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'LINK_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Vercel project link failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'LINK_OK' | Set-Content -LiteralPath $status -Encoding utf8

npm.cmd run build 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'BUILD_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Local release build failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'BUILD_OK' | Set-Content -LiteralPath $status -Encoding utf8

npx.cmd vercel@latest deploy --prebuilt --prod --yes 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  'DEPLOY_FAILED' | Set-Content -LiteralPath $status -Encoding utf8
  Write-Host 'Vercel production deploy failed.' -ForegroundColor Red
  exit $LASTEXITCODE
}

'DEPLOY_OK' | Set-Content -LiteralPath $status -Encoding utf8
Write-Host 'Kagie Vercel production deploy completed.' -ForegroundColor Green
