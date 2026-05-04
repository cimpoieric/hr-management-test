/**
 * electron-builder afterPack:
 * 1) Inject root package.json into app.asar (electron-builder file patterns omit it when deps are external).
 * 2) Copy project .env into resources/hr-next (gitignored; not in extraResources).
 * @param {{ appOutDir: string, packager: { projectDir: string } }} context
 */
const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

async function injectPackageJsonIntoAppAsar(appOutDir, projectDir) {
  const asarPath = path.join(appOutDir, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) {
    return;
  }
  const tmp = path.join(appOutDir, '_repack_app_asar');
  if (fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  fs.mkdirSync(tmp, { recursive: true });
  asar.extractAll(asarPath, tmp);
  fs.copyFileSync(path.join(projectDir, 'package.json'), path.join(tmp, 'package.json'));
  fs.unlinkSync(asarPath);
  await asar.createPackage(tmp, asarPath);
  fs.rmSync(tmp, { recursive: true, force: true });
}

module.exports = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const appOutDir = context.appOutDir;

  await injectPackageJsonIntoAppAsar(appOutDir, projectDir);

  const src = path.join(projectDir, '.env');
  const dest = path.join(appOutDir, 'resources', 'hr-next', '.env');
  if (!fs.existsSync(src)) {
    console.warn('[after-pack-env] No .env in project root; copy .env next to HR Management.exe or use npm run setup.');
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[after-pack-env] Copied .env to', dest);
};
