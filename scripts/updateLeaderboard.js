import fs from "fs";
import { chromium } from "playwright";

const URL = "https://www.pgatour.com/es/leaderboard";

const PLAYERS = [
  "Scottie Scheffler",
  "Jon Rahm",
  "Rory McIlroy",
  "Xander Schauffele",
  "Bryson DeChambeau",
  "Ludvig Åberg",
  "Tommy Fleetwood",
  "Cameron Young",
  "Hideki Matsuyama",
  "Nicolás Echavarría",
  "Brooks Koepka",
  "Viktor Hovland",
  "Collin Morikawa",
  "Robert MacIntyre",
  "Matt Fitzpatrick"
];

const normalize = s =>
  s.toLowerCase()
   .normalize("NFD")
   .replace(/[\u0300-\u036f]/g,"")
   .replace(/[^a-z ]/g,"");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });

  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("table tbody tr")).map(tr => {
      const tds = tr.querySelectorAll("td");
      return {
        name: tds[1]?.innerText?.trim(),
        toPar: tds[3]?.innerText?.trim()
      };
    });
  });

  await browser.close();

  const leaderboard = {};

  for (const player of PLAYERS) {
    const row = rows.find(r => normalize(r.name || "") === normalize(player));
    if (!row || !row.toPar) {
      leaderboard[player] = null;
    } else if (row.toPar === "E") {
      leaderboard[player] = 0;
    } else {
      leaderboard[player] = parseInt(row.toPar.replace("+",""), 10);
    }
  }

  const html = fs.readFileSync("index.html", "utf8");
  const updated = html.replace(
    /leaderboard:\s*{[\s\S]*?}/,
    `leaderboard: ${JSON.stringify(leaderboard, null, 2)}`
  );

  if (updated !== html) {
    fs.writeFileSync("index.html", updated);
    console.log("✅ Leaderboard actualizado");
  } else {
    console.log("ℹ️ Sin cambios");
  }
})();
