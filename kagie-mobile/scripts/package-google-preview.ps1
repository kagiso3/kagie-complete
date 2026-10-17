# Preview-only packaging: audited existing native runtime + source-generated JS.
# This preserves the original APK and does not replace distributed releases.
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$mobile = Join-Path $workspace 'kagie-mobile'
$stage = Join-Path $mobile '.gradle-home/native-preview-audit'
$base = Join-Path $mobile 'android/app/build/outputs/apk/release/app-release.apk'
$bundle = Join-Path $stage 'preview-index.android.bundle'
$manifest = Join-Path $stage 'preview-AndroidManifest.xml'
$unsigned = Join-Path $stage 'preview-v9-unsigned.apk'
$aligned = Join-Path $stage 'preview-v9-aligned.apk'
$output = Join-Path $mobile 'release/Kagie-Google-Login-Preview.apk'
$tools = 'C:/Users/LENOVO/AppData/Local/Android/Sdk/build-tools/36.0.0'
$java = 'C:/Program Files/Android/Android Studio/jbr/bin/java.exe'
$expectedBaseHash = 'dc20c33ff08465ee9cc49892e78172a5fcc24b00903248c12772ca5a9644728f'
$expectedCertificate = '089bddf361f062298cdb81a360250a8a29398cd12db91a1322fd223ed7f8ac25'
foreach ($target in @($stage, $base, $bundle, $manifest, $unsigned, $aligned, $output)) {
  if (-not ([IO.Path]::GetFullPath($target).StartsWith($workspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase))) {
    throw 'Preview packaging path escaped the workspace.'
  }
}
if ((Get-FileHash -LiteralPath $base -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedBaseHash) {
  throw 'Native base APK changed; repeat the compatibility audit before packaging.'
}
if (Test-Path -LiteralPath $output) { throw 'Preview APK already exists; review it before creating another.' }
$bundleBytes = [IO.File]::ReadAllBytes($bundle)
$manifestBytes = [IO.File]::ReadAllBytes($manifest)
if ([BitConverter]::ToUInt32($bundleBytes, 8) -ne 96) { throw 'Unexpected Hermes bytecode version.' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$baseArchive = [IO.Compression.ZipFile]::OpenRead($base)
$outputStream = [IO.File]::Open($unsigned, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
$previewArchive = New-Object IO.Compression.ZipArchive($outputStream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($entry in $baseArchive.Entries) {
    if ($entry.FullName -match '^META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC))$') { continue }
    $level = if ($entry.FullName -match '\.so$' -or $entry.FullName -eq 'resources.arsc' -or $entry.CompressedLength -eq $entry.Length) {
      [IO.Compression.CompressionLevel]::NoCompression
    } else { [IO.Compression.CompressionLevel]::Optimal }
    $created = $previewArchive.CreateEntry($entry.FullName, $level)
    $created.LastWriteTime = $entry.LastWriteTime
    $destination = $created.Open()
    try {
      if ($entry.FullName -eq 'assets/index.android.bundle') {
        $destination.Write($bundleBytes, 0, $bundleBytes.Length)
      } elseif ($entry.FullName -eq 'AndroidManifest.xml') {
        $destination.Write($manifestBytes, 0, $manifestBytes.Length)
      } else {
        $source = $entry.Open()
        try { $source.CopyTo($destination) } finally { $source.Dispose() }
      }
    } finally { $destination.Dispose() }
  }
} finally { $previewArchive.Dispose(); $baseArchive.Dispose() }

& (Join-Path $tools 'zipalign.exe') -P 16 -f 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
$keyValues = @{}
Get-Content -LiteralPath (Join-Path $mobile 'android/keystore.properties') | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $keyValues[$matches[1].Trim()] = $matches[2].Trim() }
}
$env:KAGIE_PREVIEW_STORE_PASSWORD = $keyValues['MYAPP_UPLOAD_STORE_PASSWORD']
$env:KAGIE_PREVIEW_KEY_PASSWORD = $keyValues['MYAPP_UPLOAD_KEY_PASSWORD']
try {
  & $java -jar (Join-Path $tools 'lib/apksigner.jar') sign --ks (Join-Path $mobile 'android/app/kagie-upload-key.jks') --ks-key-alias $keyValues['MYAPP_UPLOAD_KEY_ALIAS'] --ks-pass env:KAGIE_PREVIEW_STORE_PASSWORD --key-pass env:KAGIE_PREVIEW_KEY_PASSWORD --out $output $aligned
  if ($LASTEXITCODE -ne 0) { throw 'Preview APK signing failed.' }
} finally {
  Remove-Item Env:KAGIE_PREVIEW_STORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:KAGIE_PREVIEW_KEY_PASSWORD -ErrorAction SilentlyContinue
  $keyValues.Clear()
}
$verification = & $java -jar (Join-Path $tools 'lib/apksigner.jar') verify --verbose --print-certs $output
if ($LASTEXITCODE -ne 0 -or -not ($verification -match $expectedCertificate)) { throw 'Preview signing certificate or integrity verification failed.' }
& (Join-Path $tools 'zipalign.exe') -c -P 16 4 $output
if ($LASTEXITCODE -ne 0) { throw 'Signed preview APK lost native-library alignment.' }

function Get-EntryHash($entry) {
  $stream = $entry.Open()
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $hasher.Dispose() }
}
$before = [IO.Compression.ZipFile]::OpenRead($base)
$after = [IO.Compression.ZipFile]::OpenRead($output)
$changed = @()
$preserved = 0
try {
  $duplicates = $after.Entries | Group-Object -Property FullName -CaseSensitive | Where-Object { $_.Count -ne 1 }
  if ($duplicates) { throw 'Preview APK contains duplicate ZIP entries.' }
  foreach ($entry in $before.Entries) {
    if ($entry.FullName -match '^META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC))$') { continue }
    $replacement = $after.GetEntry($entry.FullName)
    if (-not $replacement) { throw ('Preview lost native payload entry: ' + $entry.FullName) }
    if ((Get-EntryHash $entry) -ne (Get-EntryHash $replacement)) { $changed += $entry.FullName } else { $preserved++ }
  }
} finally { $before.Dispose(); $after.Dispose() }
if ($changed.Count -ne 2 -or 'assets/index.android.bundle' -notin $changed -or 'AndroidManifest.xml' -notin $changed) { throw 'Preview changed content beyond the JS bundle and approved version attributes.' }
if ((Get-FileHash -LiteralPath $base -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedBaseHash) { throw 'Original APK was modified.' }
$badging = & (Join-Path $tools 'aapt2.exe') dump badging $output
if ($LASTEXITCODE -ne 0 -or -not ($badging -match "package: name='com.kagie.app' versionCode='9' versionName='1.2.2'")) {
  throw 'Android tooling did not confirm the preview package version.'
}
$result = [ordered]@{
  generatedAt = [DateTime]::UtcNow.ToString('o')
  artifact = $output
  sha256 = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
  bytes = (Get-Item -LiteralPath $output).Length
  packaging = 'Preview only: source-generated Expo/Hermes JavaScript inside audited existing native APK'
  fullGradleBuild = $false
  originalApkPreserved = $true
  baseSha256 = $expectedBaseHash
  baseNativeVersionName = '1.2.0'
  baseNativeVersionCode = 7
  previewNativeVersionName = '1.2.2'
  previewNativeVersionCode = 9
  versionMetadataPatch = 'Proper compiled XML parser changed only root Android versionCode/versionName; two bytes changed'
  expoSdk = '55.0.0'
  reactNative = '0.83.4'
  hermesBytecodeVersion = 96
  abi = 'arm64-v8a'
  minSdk = 24
  targetSdk = 36
  customScheme = 'kagie'
  activityLaunchMode = 'singleTask'
  secureStoreApiPresent = @('getValueWithKeyAsync', 'setValueWithKeyAsync', 'deleteValueWithKeyAsync')
  signingCertificateSha256 = $expectedCertificate
  signatureVerified = $true
  nativeAlignment16KVerified = $true
  duplicateZipEntries = 0
  changedPayloadEntries = $changed
  preservedPayloadEntryCount = $preserved
  assetAdapter = 'Preview-only RN asset-source transformer embeds unchanged loader JPG/PNG bytes as data URIs'
  deviceGoogleSignInTested = $false
  appSourceSha256 = (Get-FileHash -LiteralPath (Join-Path $mobile 'App.tsx') -Algorithm SHA256).Hash.ToLowerInvariant()
  oauthSourceSha256 = (Get-FileHash -LiteralPath (Join-Path $mobile 'src/lib/native-oauth.ts') -Algorithm SHA256).Hash.ToLowerInvariant()
  bytecodeSha256 = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash.ToLowerInvariant()
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspace 'reports/auth-google/android-preview-manifest.json')
$verification | Write-Output
$result | ConvertTo-Json -Depth 5
