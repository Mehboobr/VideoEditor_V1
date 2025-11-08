const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', '@spreen', 'ffmpeg-kit-react-native', 'android', 'build.gradle');

try {
  if (!fs.existsSync(target)) {
    console.log('[patch-ffmpeg] target not found, skipping:', target);
    process.exit(0);
  }

  let content = fs.readFileSync(target, 'utf8');

  // Remove the unconditional GradleException throw if present
  const throwRegex = /throw new GradleException\([\s\S]*?\)\s*/m;
  if (throwRegex.test(content)) {
    content = content.replace(throwRegex, '// patched by postinstall: removed throw for missing android binaries\n');
    fs.writeFileSync(target, content, 'utf8');
    console.log('[patch-ffmpeg] patched', target);
  } else {
    console.log('[patch-ffmpeg] no throw found, nothing to patch');
  }
} catch (err) {
  console.error('[patch-ffmpeg] error while patching:', err);
  process.exit(0);
}
