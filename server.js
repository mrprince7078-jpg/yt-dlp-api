const express = require("express");
const cors = require("cors");
const path = require("path");
const https = require("https");
const http = require("http");
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
  res.json({ ok: true, service: "yt-dlp-api", version: "1.2.0" });
});

app.post("/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const out = await runSmart(["--dump-json", "--no-playlist", url]);
    const info = JSON.parse(out);
    res.json({ title: info.title, uploader: info.uploader, duration: info.duration, thumbnail: info.thumbnail, id: info.id, extractor: info.extractor });
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

app.get("/proxy", async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const mediaUrl = decodeURIComponent(url);
    const name = filename || "video.mp4";
    const client = mediaUrl.startsWith("https") ? https : http;
    const proxyReq = client.get(mediaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
        "Referer": "https://www.tiktok.com/",
      },
    }, (proxyRes) => {
      if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        res.redirect("/proxy?url=" + encodeURIComponent(proxyRes.headers.location) + "&filename=" + encodeURIComponent(name));
        return;
      }
      if (proxyRes.statusCode !== 200) {
        return res.status(502).json({ error: "Upstream error: " + proxyRes.statusCode });
      }
      res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
      if (proxyRes.headers["content-type"]) res.setHeader("Content-Type", proxyRes.headers["content-type"]);
      if (proxyRes.headers["content-length"]) res.setHeader("Content-Length", proxyRes.headers["content-length"]);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (e) => res.status(502).json({ error: e.message.slice(0, 200) }));
    proxyReq.setTimeout(120000, () => { proxyReq.destroy(); res.status(504).json({ error: "Upstream timeout" }); });
  } catch (e) {
    res.status(500).json({ error: e.message.slice(0, 200) });
  }
});

app.listen(PORT, () => console.log(`yt-dlp-api on :${PORT}`));
