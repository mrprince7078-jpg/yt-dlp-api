const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const YTDLP_BIN = path.join(__dirname, "bin", "yt-dlp");

app.use(cors());
app.use(express.json());

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP_BIN, args, { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "ytdlp-api", version: "1.0.0" });
});

app.post("/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const out = await runYtDlp(["--dump-single-json", "--no-check-certificates", "--no-warnings", "--prefer-free-formats", url]);
    const info = JSON.parse(out);
    res.json({
      title: info.title,
      duration: info.duration,
      uploader: info.uploader,
      thumbnail: info.thumbnail,
      formats: (info.formats || []).filter(f => f.url).map(f => ({
        format_id: f.format_id, ext: f.ext, resolution: f.resolution,
        filesize: f.filesize, url: f.url,
      })).slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/download", async (req, res) => {
  const { url, format = "best" } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const out = await runYtDlp(["--get-url", "-f", format, "--no-check-certificates", "--no-warnings", url]);
    res.json({ url: out.trim().split("\n")[0], format });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`yt-dlp API on ${PORT}`));
