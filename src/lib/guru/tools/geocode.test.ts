import { describe, expect, it, vi } from "vitest";
import { GuruInputError } from "../astro/time";
import { OpenMeteoGeocoder } from "./geocode";

const ok = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });

describe("OpenMeteoGeocoder", () => {
  it("maps results to place candidates", async () => {
    const g = new OpenMeteoGeocoder(
      ok({ results: [{ name: "Madurai", admin1: "Tamil Nadu", country: "India", latitude: 9.919, longitude: 78.11953, timezone: "Asia/Kolkata", population: 1465625 }] }),
    );
    expect(await g.search("Madurai")).toEqual([
      { name: "Madurai", region: "Tamil Nadu", country: "India", latitude: 9.919, longitude: 78.11953, timezone: "Asia/Kolkata", population: 1465625 },
    ]);
  });

  it("drops malformed results and returns [] when nothing matches", async () => {
    const g = new OpenMeteoGeocoder(
      ok({ results: [{ name: "No coords", timezone: "Asia/Kolkata" }, { name: "No zone", latitude: 1, longitude: 2 }] }),
    );
    expect(await g.search("Somewhere")).toEqual([]);
    expect(await new OpenMeteoGeocoder(ok({})).search("Nowhere")).toEqual([]);
  });

  it("URL-encodes the query and caps the number of results", async () => {
    const fetchSpy = vi.fn(ok({ results: [] }));
    await new OpenMeteoGeocoder(fetchSpy).search("Sri Lanka & more");
    const url = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url[0]).toContain("name=Sri%20Lanka%20%26%20more");
    expect(url[0]).toContain("count=5");
  });

  it("rejects empty or oversized queries without calling the network", async () => {
    const fetchSpy = vi.fn(ok({ results: [] }));
    const g = new OpenMeteoGeocoder(fetchSpy);
    await expect(g.search(" ")).rejects.toBeInstanceOf(GuruInputError);
    await expect(g.search("x".repeat(101))).rejects.toBeInstanceOf(GuruInputError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("raises a plain error on HTTP or network failure", async () => {
    await expect(new OpenMeteoGeocoder(async () => ({ ok: false, status: 500, json: async () => ({}) })).search("Madurai")).rejects.toThrow(/HTTP 500/);
    await expect(new OpenMeteoGeocoder(async () => { throw new Error("offline"); }).search("Madurai")).rejects.toThrow(/offline/);
  });
});
