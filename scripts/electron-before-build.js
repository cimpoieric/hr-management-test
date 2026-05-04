/**
 * Tell electron-builder not to merge production node_modules into app.asar.
 * Next.js and server deps live under extraResources (hr-next); the shell only needs package.json + electron/.
 */
module.exports = async function electronBeforeBuild() {
  return false;
};
