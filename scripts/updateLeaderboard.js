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
  s?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });

  // ✅ Esperar a que la tabla REAL esté poblada
  await page.waitForSelector("table tbody tr", { timeout: 20000 });

  const data = await page.evaluate(() => {
    const table = document.querySelector("table");
    const headerCells = Array.from(table.querySelectorAll("thead th"))
      .map(th => th.innerText.trim().toLowerCase());

    const nameIndex = headerCells.findIndex(h =>
      h.includes("player") || h.includes("jugador")
    );

    const toParIndex = headerCells.findIndex(h =>
      h.includes("par")
    );

    if (nameIndex === -1 || toParIndex === -1) {
      return null;
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"));

    return rows.map(tr => {
      const cells = tr.querySelectorAll("td");
      return {
        name: cells[nameIndex]?.innerText.trim(),
        toPar: cells[toParIndex]?.innerText.trim()
      };
    });
  });

  await browser.close();

  // 🛑 Protección crítica
  if (!data || data.length === 0) {
    console.error("❌ No se pudo leer el leaderboard. No se actualiza.");
    process.exit(0);
  }

  const leaderboard = {};
  let found = 0;

  for (const player of PLAYERS) {
    const row = data.find(r => normalize(r.name) === normalize(player));

    if (!row || !row.toPar || row.toPar === "—") {
      leaderboard[player] = null;
    } else if (row.toPar === "E") {
      leaderboard[player] = 0;
      found++;
    } else {
      leaderboard[player] = parseInt(row.toPar.replace("+", ""), 10);
      found++;
    }
  }

  // 🛑 Si no encontró jugadores reales → NO COMMIT
  if (found < 3) {
    console.error("❌ Menos de 3 jugadores detectados. Abortando update.");
    process.exit(0);
  }

  const html = fs.readFileSync("index.html", "utf8");

  const updated = html.replace(
    /leaderboard:\s*{[\s\S]*?}/,
    `leaderboard: ${JSON.stringify(leaderboard, null, 2)}`
  );

  if (updated !== html) {
    fs.writeFileSync("index.html", updated);
    console.log("✅ Leaderboard actualizado correctamente");
  } else {
    console.log("ℹ️ Sin cambios");
  }
})();
