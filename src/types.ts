/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  height: number; // 182.88 for 6ft
  currentWeight: number; // kg
  startWeight: number; // kg
  targetWeight: number; // kg
  fastingWindow: "12:12" | "14:10";
}

export interface MacroLog {
  id: string;
  timestamp: string; // ISO Date YYYY-MM-DD
  protein: number;
  sugar: number;
  sugarPercentage?: number;
  carbs: number;
  fats: number;
  healthyFats: number;
  caloriesBurned: number;
  caloriesConsumed?: number;
  deficit?: number;
  bmr?: number;
  reps?: number;
  pushups?: number;
  weight?: number;
  fatPercentage?: number;
  label: string;
}

export interface DailyStats {
  protein: number;
  sugar: number;
  carbs: number;
  fats: number;
  healthyFats: number;
  caloriesBurned: number;
  caloriesConsumed: number;
  deficit: number;
  bmr: number;
  reps: number;
  pushups: number;
  guitarFocus: number;
  symptoms: string[];
  avgWeight: number;
}
