import { GuruInputError } from "../astro/time";

export interface PlaceCandidate {
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  /** IANA time zone of the place (historical offsets come from the tz database). */
  timezone: string;
  population?: number;
}

export interface Geocoder {
  search(query: string, signal?: AbortSignal): Promise<PlaceCandidate[]>;
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

interface OpenMeteoResult {
  name?: string;
  admin1?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  population?: number;
}

/**
 * Place lookup via Open-Meteo's free geocoding API (no key needed). NOTE:
 * its free tier is licensed for non-commercial use, so production needs
 * either their paid plan or another Geocoder implementation (GeoNames,
 * Google Places...). Everything depends on the Geocoder interface only.
 */
export class OpenMeteoGeocoder implements Geocoder {
  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly baseUrl = "https://geocoding-api.open-meteo.com/v1/search",
  ) {}

  async search(query: string, signal?: AbortSignal): Promise<PlaceCandidate[]> {
    const q = query.trim();
    if (q.length < 2) throw new GuruInputError("Please give the name of the birth place.");
    if (q.length > 100) throw new GuruInputError("That place name is too long.");

    const url = `${this.baseUrl}?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
    let response;
    try {
      response = await this.fetchImpl(url, { signal });
    } catch (error) {
      throw new Error(`Place lookup failed: ${(error as Error).message}`);
    }
    if (!response.ok) throw new Error(`Place lookup failed (HTTP ${response.status}).`);

    const body = (await response.json()) as { results?: OpenMeteoResult[] };
    return (body.results ?? [])
      .filter(
        (r): r is OpenMeteoResult & { name: string; latitude: number; longitude: number; timezone: string } =>
          typeof r.name === "string" &&
          typeof r.latitude === "number" &&
          typeof r.longitude === "number" &&
          typeof r.timezone === "string",
      )
      .map((r) => ({
        name: r.name,
        region: r.admin1,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
        population: r.population,
      }));
  }
}
