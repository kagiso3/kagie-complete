$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  (Join-Path $root 'web-release')
)

$folders = @(
  'admin',
  'assistant',
  'css',
  'images',
  'js',
  'master-admin',
  'more-service'
)

$files = @(
  '.gitignore',
  '404.html',
  'about.html',
  'apply.html',
  'android-app.html',
  'career-guidance.html',
  'cart.html',
  'changepassword.html',
  'checkout.html',
  'Dashboard.html',
  'documents.html',
  'forgot-password.html',
  'forms.html',
  'home.html',
  'index.html',
  'institutions.html',
  'language.html',
  'login.html',
  'manifest.webmanifest',
  'notification.html',
  'notifications.html',
  'payment.html',
  'personal-assistance.html',
  'privacy.html',
  'profile.html',
  'prospectus.html',
  'recommendation.html',
  'signup.html',
  'sw.js',
  'terms.html',
  'updates.html',
  'upload.html',
  'Kagie-Android.apk',
  'Kagie-Android-Release.apk'
)

$staleRootFiles = @(
  'package.json',
  'package-lock.json',
  'tsconfig.base.json'
)

foreach ($target in $targets) {
  if (!(Test-Path -LiteralPath $target)) {
    New-Item -ItemType Directory -Path $target | Out-Null
  }

  foreach ($staleFile in $staleRootFiles) {
    $stalePath = Join-Path $target $staleFile
    if (Test-Path -LiteralPath $stalePath) {
      Remove-Item -LiteralPath $stalePath -Force
    }
  }

  foreach ($folder in $folders) {
    $sourcePath = Join-Path $root $folder
    $targetPath = Join-Path $target $folder
    if (!(Test-Path -LiteralPath $sourcePath)) {
      continue
    }
    if (!(Test-Path -LiteralPath $targetPath)) {
      New-Item -ItemType Directory -Path $targetPath | Out-Null
    }
    robocopy $sourcePath $targetPath /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
      throw "Robocopy failed while syncing $folder into $target."
    }
  }

  foreach ($file in $files) {
    $sourcePath = Join-Path $root $file
    $targetPath = Join-Path $target $file
    if (Test-Path -LiteralPath $sourcePath) {
      Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }
  }
}

Write-Output 'release folders sync complete'
