const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const destDir = path.join(__dirname, '..', 'builds');
const dest = path.join(destDir, 'Hostel In.apk');

function copyApk() {
  console.log(`Checking source APK at: ${src}`);
  if (!fs.existsSync(src)) {
    console.error(`Error: Source APK not found at ${src}. Make sure you built the Android project first.`);
    process.exit(1);
  }

  if (!fs.existsSync(destDir)) {
    console.log(`Creating destination directory: ${destDir}`);
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`Copying APK to: ${dest}`);
  fs.copyFileSync(src, dest);
  console.log('APK copied successfully!');
}

copyApk();
