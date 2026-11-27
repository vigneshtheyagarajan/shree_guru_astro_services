import type { VedicChart } from "./chart";
import { GRAHAS } from "./constants";

/** 13.3333 -> 13°20'00" (the format Jagannatha Hora and most software shows). */
export function formatDms(degrees: number): string {
  const totalSeconds = Math.round(degrees * 3600);
  const d = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
}

/** 330 -> "+05:30", -300 -> "-05:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Plain-text chart for side-by-side comparison with other Jyotish software.
 * Positions are sidereal (Lahiri), degree-in-sign.
 */
export function formatChartText(chart: VedicChart): string {
  const lines: string[] = [];
  const i = chart.input;
  lines.push(`Birth:  ${i.date} ${i.time} (${i.timezone}, UTC${formatOffset(chart.utcOffsetMinutes)})  =  ${chart.utc} UTC`);
  lines.push(`Place:  lat ${i.latitude}, lon ${i.longitude}`);
  lines.push(
    `Setup:  ${chart.settings.ayanamsa} ayanamsa (${formatDms(chart.ayanamsa)}), ${chart.settings.houseSystem} houses, ${chart.settings.nodeType} node, dasha year ${chart.settings.dashaYearDays} days`,
  );
  lines.push("");
  lines.push("Body      Sign         Position     Nakshatra (pada)        Navamsa      House  Notes");
  const row = (label: string, p: VedicChart["ascendant"], house: string, notes: string) =>
    `${label.padEnd(9)} ${p.signName.padEnd(12)} ${formatDms(p.degreeInSign).padEnd(12)} ${`${p.nakshatraName} (${p.pada})`.padEnd(23)} ${p.navamsaSignName.padEnd(12)} ${house.padEnd(6)} ${notes}`;
  lines.push(row("Lagna", chart.ascendant, "1", ""));
  for (const g of GRAHAS) {
    const p = chart.planets[g];
    const notes = [p.retrograde && g !== "Rahu" && g !== "Ketu" ? "retrograde" : "", p.dignity && p.dignity !== "neutral" ? p.dignity : ""]
      .filter(Boolean)
      .join(", ");
    lines.push(row(g, p, String(p.house), notes));
  }
  lines.push("");
  lines.push("Vimshottari mahadashas (start dates):");
  lines.push(
    chart.dashas
      .slice(0, 10)
      .map((d) => `  ${d.lord.padEnd(8)} ${ymd(d.start)} -> ${ymd(d.end)}`)
      .join("\n"),
  );
  if (chart.warnings.length) {
    lines.push("");
    lines.push(...chart.warnings.map((w) => `! ${w}`));
  }
  return lines.join("\n");
}
