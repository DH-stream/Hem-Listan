const fs = require("node:fs");
const path = require("node:path");

const version = process.env.VITE_APP_VERSION
  || process.env.VERCEL_GIT_COMMIT_SHA
  || String(Date.now());

const appVersionPath = path.join(__dirname, "..", "public", "app-version.json");
const payload = `${JSON.stringify({ version }, null, 2)}\n`;

fs.writeFileSync(appVersionPath, payload);
console.log(`Wrote public/app-version.json (${version})`);
