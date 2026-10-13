const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BIN_DIR = path.join(__dirname, "..", "bin");
const BIN_PATH = path.join(BIN_DIR, "yt-dlp");

if (fs.existsSync(BIN_PATH) && fs.statSync(BIN_PATH).size > 1000000) {
  console.log("yt-dlp binary already exists, skipping download");
  process.exit(0);
}

fs.mkdirSync(BIN_DIR, { recursive: true });

try {
  console.log("Downloading yt-dlp via curl...");
  execSync(
    `curl -sL --max-time 120 -o "${BIN_PATH}" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"`,
    { stdio: "inherit" }
  );
  fs.chmodSync(BIN_PATH, 0o755);
  const size = fs.statSync(BIN_PATH).size;
  console.log(`yt-dlp binary ready (${size} bytes)`);
  if (size < 1000000) throw new Error("Binary too small, download failed");
} catch (e) {
  console.error("curl download failed:", e.message);
  process.exit(1);
}
