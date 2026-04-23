import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MACRO_TARGETS = {
  protein: { min: 128, max: 160 },
  sugar: { max: 25 },
  carbs: { min: 150, max: 200 },
  healthyFats: { min: 60, max: 70 },
  deficit: { target: 500 },
  weight: { target: 70 },
  fatPercentage: { target: 10 }
};

export function calculateVisibilityMultiplier(currentWeight: number) {
  // At 77kg, entering "High Visibility Zone"
  if (currentWeight <= 77) return 2.0;
  return 1.0;
}

export function getPushupWeight(variation: string) {
  switch (variation) {
    case "Incline":
    case "Decline":
    case "Pseudo Planche":
      return 1.5;
    case "Knee":
      return 0.5;
    default:
      return 1.0;
  }
}
