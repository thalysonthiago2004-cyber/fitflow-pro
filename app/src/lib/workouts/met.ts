import type { CardioIntensity } from "@/lib/supabase/database.types";

// Approximate MET values from the Compendium of Physical Activities
// (Ainsworth et al., 2011), chosen by activity and prescribed intensity.
// Calorie figures built on them are estimates and are labeled as such.

const BY_ACTIVITY: Record<string, Record<CardioIntensity, number>> = {
  // Walking ~4.8 km/h · brisk walking ~6.4 km/h · running ~9.7 km/h
  "Esteira": { light: 3.5, moderate: 5.0, vigorous: 9.8 },
  "Caminhada ao ar livre": { light: 3.5, moderate: 4.3, vigorous: 5.0 },
  "Corrida ao ar livre": { light: 7.0, moderate: 8.3, vigorous: 9.8 },
  // Stationary cycling: 30–50 W · 90–100 W · 101–160 W
  "Bicicleta ergométrica": { light: 3.5, moderate: 6.8, vigorous: 8.8 },
  "Bicicleta de spinning": { light: 6.8, moderate: 8.5, vigorous: 8.8 },
  "Air bike": { light: 6.8, moderate: 8.8, vigorous: 11.0 },
  "Elíptico": { light: 5.0, moderate: 5.0, vigorous: 5.0 },
  // Rowing ergometer: 100 W · 150 W · 200 W
  "Remo ergômetro": { light: 7.0, moderate: 8.5, vigorous: 12.0 },
  "Simulador de escada": { light: 9.0, moderate: 9.0, vigorous: 9.0 },
  "Pular corda": { light: 8.8, moderate: 11.8, vigorous: 12.3 },
  "Natação": { light: 5.8, moderate: 6.0, vigorous: 9.8 },
};

/** Generic aerobic exercise by intensity, for activities not listed above. */
const GENERIC: Record<CardioIntensity, number> = { light: 3.5, moderate: 5.0, vigorous: 8.0 };

export function cardioMet(activity: string, intensity: CardioIntensity | null): number {
  return (BY_ACTIVITY[activity] ?? GENERIC)[intensity ?? "moderate"];
}
