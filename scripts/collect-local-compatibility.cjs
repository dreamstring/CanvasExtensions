const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function digest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function collect(home, registryFile) {
  const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  const files = [path.join(home, 'installation.json')];
  const installations = path.join(home, 'installations');
  if (fs.existsSync(installations)) {
    for (const entry of fs.readdirSync(installations, { withFileTypes: true })) {
      if (entry.isDirectory()) files.push(path.join(installations, entry.name, 'installation.json'));
    }
  }

  const added = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    const version = /[\\/]app-(\d+(?:\.\d+)+)[\\/]resources[\\/]app\.asar$/i.exec(record.Target)?.[1];
    if (!version || registry.versions.some(row => row.originalSha256 === record.Original)) continue;
    if (record.Original === record.Installed || !fs.existsSync(record.Target) || !fs.existsSync(record.Backup)) continue;
    if (digest(record.Target) !== record.Installed || digest(record.Backup) !== record.Original) continue;
    registry.versions.push({ version, originalSha256: record.Original, scope: 'injection',
      evidence: 'Installed app.asar and original backup both matched the SHA-256 values in the installation record.' });
    added.push(version);
  }
  if (added.length) {
    const temporary = registryFile + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(temporary, JSON.stringify(registry, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(temporary, registryFile);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
  return added;
}

module.exports = { collect };
if (require.main === module) {
  const added = collect(path.join(process.env.LOCALAPPDATA, 'FigmaGifAssistant'),
    path.resolve(__dirname, '../runtime/compatibility.json'));
  console.log('Local injection records: ' + (added.join(', ') || 'no new verified resources'));
}
