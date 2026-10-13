const https = require("https");
const fs = require("fs");
const path = require("path");

const BIN_DIR = path.join(__dirname, "..", "bin");
const BIN_PATH = path.join(BIN_DIR, "yt-dlp");
const URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

if (fs.existsSync(BIN_PATH)) {
  console.log("yt-dlp binary already exists");
  process.exit(0);
}

fs.mkdirSync(BIN_DIR, { recursive: true });
console.log("Downloading yt-dlp binary...");

https.get(URL, (res) => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    https.get(res.headers.location, (r2) => pipeToFile(r2));
    return;
  }
  pipeToFile(res);
});

function pipeToFile(res) {
  const file = fs.createWriteStream(BIN_PATH, { mode: 0o755 });
  res.pipe(file);
  file.on("finish", () => {
    file.close();
    fs.chmodSync(BIN_PATH, 0o755);
    console.log("yt-dlp binary ready");
  });
}
