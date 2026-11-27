/**
 * Prints a Vedic chart for side-by-side comparison with other software.
 *
 *   npx tsx scripts/guru/print-chart.ts 1990-06-15 04:20 Asia/Kolkata 13.0827 80.2707 [mean|true]
 */
import { buildVedicChart } from "../../src/lib/guru/astro/chart";
import { formatChartText } from "../../src/lib/guru/astro/format";

const [date, time, timezone, lat, lon, nodeType = "mean"] = process.argv.slice(2);
if (!date || !time || !timezone || !lat || !lon) {
  console.error("Usage: tsx scripts/guru/print-chart.ts <YYYY-MM-DD> <HH:mm> <IANA timezone> <latitude> <longitude> [mean|true]");
  process.exit(1);
}

const chart = buildVedicChart(
  { date, time, timezone, latitude: Number(lat), longitude: Number(lon) },
  { nodeType: nodeType === "true" ? "true" : "mean" },
);
console.log(formatChartText(chart));
