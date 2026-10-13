const express = require("express");
const cors = require("cors");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;
const YTDLP = path.join(__dirname, "bin", "yt-dlp");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const CLIENTS = [
  ["--extractor-args", "youtube:player_client=android"],
  ["--extractor-args", "youtube:player_client=ios"],
  ["--extractor-args", "youtube:player_client=tv_embedded"],
  [],
];

function runYtDlp(args, clientArgs = []) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, [...clientArgs, ...args], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function runSmart(args) {
  let lastErr;
  for (const clientArgs of CLIENTS) {
    try {
      return await runYtDlp(args, clientArgs);
    } catch (e) {
      lastErr = e;
      const msg = e.message || "";
      if (/sign in to confirm|not a bot|429|403/i.test(msg)) continue;
      throw e;
    }
  }
  throw lastErr;
}

app.get("/", (req, res) => {
  res.json({ ok: true, service: "yt-dlp-api", version: "1.1.0" });
});

app.post("/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const out = await runSmart(["--dump-json", "--no-playlist", url]);
    res.json(JSON.parse(out));
  } catch (e) {
    res.status(500).json({ error: e.message.slice(0, 300) });
  }
});

app.post("/download", async (req, res) => {
  const { url, format = "best" } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const out = await runSmart(["-g", "-f", format, "--no-playlist", url]);
    res.json({ url: out.trim().split("\n")[0] });
  } catch (e) {
    res.status(500).json({ error: e.message.slice(0, 300) });
  }
});

app.listen(PORT, () => console.log(`yt-dlp-api on :${PORT}`));
