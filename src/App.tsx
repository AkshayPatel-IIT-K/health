/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { 
  Zap, 
  FileUp, 
  Settings, 
  AlertTriangle, 
  Music,
  Dumbbell,
  LayoutDashboard,
  Activity,
  Flame,
  BicepsFlexed,
  Minus,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { cn, MACRO_TARGETS } from "./lib/utils";
import { UserProfile, MacroLog, DailyStats } from "./types";

const INITIAL_PROFILE: UserProfile = {
  height: 182.88,
  currentWeight: 77,
  startWeight: 80,
  targetWeight: 70,
  fastingWindow: "14:10"
};

// Fallback for crypto.randomUUID for environments that might not support it
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// IST Date Helper
const getTodayIST = () => {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(new Date());
};

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [macroLogs, setMacroLogs] = useState<MacroLog[]>([]);
  const [guitarFocus, setGuitarFocus] = useState<number>(3.0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "import" | "profile" | "progress">("dashboard");
  const [viewRange, setViewRange] = useState<"day" | "week" | "month">("day");
  const [progressRange, setProgressRange] = useState<"day" | "week" | "month">("day");
  const [focusDate, setFocusDate] = useState<string>(getTodayIST());
  const [showZapAlert, setShowZapAlert] = useState(false);
  const [bufferingPrompt, setBufferingPrompt] = useState<string | null>(null);

  // Derived stats based on selected time range
  const filteredLogs = React.useMemo(() => {
    if (viewRange === "day") {
      return macroLogs.filter(l => l.timestamp.startsWith(focusDate));
    }
    
    const anchor = new Date(focusDate);
    
    if (viewRange === "month") {
      const year = anchor.getFullYear();
      const month = anchor.getMonth();
      const startTime = new Date(year, month, 1).getTime();
      const endTime = new Date(year, month + 1, 1).getTime();
      return macroLogs.filter(l => {
        const t = new Date(l.timestamp).getTime();
        return t >= startTime && t < endTime;
      });
    }

    if (viewRange === "week") {
      // Find the Sunday of the current focus date to get the consistent 7-day block
      const startOfWeek = new Date(anchor);
      startOfWeek.setDate(anchor.getDate() - anchor.getDay());
      const startTime = startOfWeek.getTime();
      const endTime = startTime + (7 * 24 * 60 * 60 * 1000);
      
      return macroLogs.filter(l => {
        const t = new Date(l.timestamp).getTime();
        return t >= startTime && t < endTime;
      });
    }

    return macroLogs.filter(l => l.timestamp.startsWith(focusDate));
  }, [macroLogs, viewRange, focusDate]);

  const stats: DailyStats = {
    protein: filteredLogs.reduce((acc, log) => acc + log.protein, 0),
    sugar: filteredLogs.reduce((acc, log) => acc + log.sugar, 0),
    carbs: filteredLogs.reduce((acc, log) => acc + log.carbs, 0),
    fats: filteredLogs.reduce((acc, log) => acc + log.fats, 0),
    healthyFats: filteredLogs.reduce((acc, log) => acc + log.healthyFats, 0),
    caloriesBurned: filteredLogs.reduce((acc, log) => acc + log.caloriesBurned, 0),
    caloriesConsumed: filteredLogs.reduce((acc, log) => acc + (log.caloriesConsumed || (log.protein * 4 + log.carbs * 4 + log.fats * 9)), 0),
    deficit: 0, 
    bmr: filteredLogs.reduce((acc, log) => acc + (log.bmr || 0), 0),
    reps: filteredLogs.reduce((acc, log) => acc + (log.reps || 0), 0),
    pushups: filteredLogs.reduce((acc, log) => acc + (log.pushups || 0), 0),
    guitarFocus,
    symptoms: filteredLogs.filter(l => l.label.toLowerCase().includes("zap") || l.label.toLowerCase().includes("shock")).map(l => "zap"),
    avgWeight: filteredLogs.filter(l => l.weight && l.weight > 0).length > 0 
      ? filteredLogs.filter(l => l.weight && l.weight > 0).reduce((s, l) => s + (l.weight || 0), 0) / 
        filteredLogs.filter(l => l.weight && l.weight > 0).length 
      : 0
  };

  const multiplier = React.useMemo(() => {
    if (viewRange === "day") return 1;
    if (viewRange === "week") return 7;
    const anchor = new Date(focusDate);
    return new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  }, [viewRange, focusDate]);
  const rangedTargets = {
    protein: MACRO_TARGETS.protein.min * multiplier,
    sugar: MACRO_TARGETS.sugar.max * multiplier,
    carbs: MACRO_TARGETS.carbs.min * multiplier,
    healthyFats: MACRO_TARGETS.healthyFats.min * multiplier,
    deficit: MACRO_TARGETS.deficit.target * multiplier
  };

  const providedDeficit = filteredLogs.reduce((acc, log) => acc + (log.deficit || 0), 0);
  stats.deficit = providedDeficit || (stats.caloriesBurned - stats.caloriesConsumed);

  const chartData = [
    { subject: 'Protein', A: Math.min(100, (stats.protein / rangedTargets.protein) * 100) },
    { subject: 'Sugar Control', A: Math.max(0, 100 - (stats.sugar / rangedTargets.sugar) * 50) },
    { subject: 'Carbs', A: Math.min(100, (stats.carbs / rangedTargets.carbs) * 100) },
    { subject: 'Healthy Fats', A: Math.min(100, (stats.healthyFats / rangedTargets.healthyFats) * 100) },
    { subject: 'Calorie Deficit', A: Math.min(110, (stats.deficit / rangedTargets.deficit) * 100) },
  ];

  useEffect(() => {
    if (stats.symptoms.length > 0) setShowZapAlert(true);
  }, [stats.symptoms]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        const parsedLogs: MacroLog[] = data.map((row, index) => {
          let dateStr = "";
          try {
            if (row.Date instanceof Date) {
              const d = row.Date;
              if (isNaN(d.getTime())) throw new Error("Invalid Date Object");
              dateStr = d.toISOString().split('T')[0];
            } else if (typeof row.Date === 'string' && row.Date.includes('-')) {
              dateStr = row.Date.split('T')[0];
            } else if (typeof row.Date === 'number') {
              // Handle Excel numeric dates if cellDates failed
              const excelDate = new Date((row.Date - 25569) * 86400 * 1000);
              dateStr = excelDate.toISOString().split('T')[0];
            } else {
              dateStr = getTodayIST();
            }
          } catch (e) {
            console.error(`Row ${index} date error:`, e);
            dateStr = new Date().toISOString().split('T')[0];
          }

          const safeNum = (val: any) => {
            const n = Number(val);
            return isNaN(n) ? 0 : n;
          };

          // Map based on user's new sheet structure: B column is Weight
          // If keys are like "__EMPTY", we map by index
          const rowKeys = Object.keys(row);
          const weightVal = rowKeys[1] ? row[rowKeys[1]] : row.Weight || row.weight;

          const repsRaw = String(row.Reps || row.reps || row[":reps"] || "");
          const pushupsMatch = repsRaw.match(/pushups?\s*:\s*(\d+)/i) || repsRaw.match(/(\d+)\s*pushups?/i);
          const pushupsExtracted = pushupsMatch ? safeNum(pushupsMatch[1]) : 0;

          return {
            id: generateId(),
            timestamp: dateStr,
            protein: safeNum(row["Protein (g)"] || row.Protein || row.protein),
            sugar: safeNum(row["Sugar (g)"] || row.Sugar || row.sugar),
            sugarPercentage: row["Sugar (%)"] ? safeNum(row["Sugar (%)"]) : undefined,
            carbs: safeNum(row["Carbs (g)"] || row.Carbs || row.carbs),
            fats: safeNum(row["Fats (g)"] || row.Fats || row.fats),
            healthyFats: safeNum(row["Healthy Fats"] || row.healthyFats),
            caloriesBurned: safeNum(row["Calories Burned"] || row.caloriesBurned),
            caloriesConsumed: row["Calories Consumed"] ? safeNum(row["Calories Consumed"]) : undefined,
            deficit: row["Daily Deficit"] ? safeNum(row["Daily Deficit"]) : undefined,
            bmr: row["Estimated BMR"] ? safeNum(row["Estimated BMR"]) : undefined,
            reps: safeNum(row.Reps || row.reps || row[":reps"]),
            pushups: pushupsExtracted,
            weight: safeNum(weightVal),
            fatPercentage: row["Fat Percentage"] || row.fatPercentage ? safeNum(row["Fat Percentage"] || row.fatPercentage) : undefined,
            label: String(row.Category || row.Label || row.label || "Manual Entry")
          };
        });

        if (parsedLogs.length > 0) {
          setMacroLogs(parsedLogs);
          window.alert(`Synchronized ${parsedLogs.length} entries successfully.`);
        } else {
          window.alert("No valid protocol data found in file.");
        }
      } catch (err) {
        console.error("Data Synchronizer Error:", err);
        window.alert("Failed to synchronize file. Ensure you are using the correct CSV/XLSX template.");
      }
    };
    reader.onerror = () => {
      window.alert("Critical error reading file.");
    };
    reader.readAsBinaryString(file);
  };

  const addManualLog = (log: Partial<MacroLog>) => {
    const todayStr = getTodayIST();
    const newLog: MacroLog = {
      id: generateId(),
      timestamp: log.timestamp || todayStr,
      protein: log.protein || 0,
      sugar: log.sugar || 0,
      carbs: log.carbs || 0,
      fats: log.fats || 0,
      healthyFats: log.healthyFats || 0,
      caloriesBurned: log.caloriesBurned || 0,
      label: log.label || "Manual Entry"
    };

    if (["Ganna", "Pasta", "Banana", "Aloo"].some(s => newLog.label.toLowerCase().includes(s.toLowerCase()))) {
      if (stats.protein < 20) {
        setBufferingPrompt(`Instruction: High-glycemic intake detected. Pair with 25g protein to protect insulin baseline.`);
      }
    }
    setMacroLogs((prev) => [...prev, newLog]);
  };

  const purgeLogs = () => {
    if (window.confirm("Metabolic Purge: Are you sure you want to delete all historical protocol data?")) {
      setMacroLogs([]);
    }
  };

  const adjustStat = (stat: keyof Omit<MacroLog, 'id' | 'timestamp' | 'label'>, amount: number) => {
    const today = getTodayIST();
    const existingIndex = macroLogs.findIndex(l => l.timestamp.startsWith(today));
    
    if (existingIndex > -1) {
      const newLogs = [...macroLogs];
      newLogs[existingIndex] = {
        ...newLogs[existingIndex],
        [stat]: Math.max(0, ((newLogs[existingIndex][stat] as number) || 0) + amount)
      };
      setMacroLogs(newLogs);
    } else {
      addManualLog({ [stat]: Math.max(0, amount), label: "Manual Adjustment", timestamp: today });
    }
  };

  const getCalendarIntensity = (dateStr: string) => {
    if (!macroLogs || macroLogs.length === 0) return 0;
    const logsForDate = macroLogs.filter(l => l.timestamp && l.timestamp.startsWith(dateStr));
    if (logsForDate.length === 0) return 0;

    const dayProtein = logsForDate.reduce((s, l) => s + (l.protein || 0), 0);
    const consumed = logsForDate.reduce((s, l) => s + (l.caloriesConsumed || ((l.protein || 0) * 4 + (l.carbs || 0) * 4 + (l.fats || 0) * 9)), 0);
    const burned = logsForDate.reduce((s, l) => s + (l.caloriesBurned || 0), 0);
    const dayDeficit = logsForDate.reduce((s, l) => s + (l.deficit || 0), 0) || (burned - consumed);
    
    const pScore = Math.min(1, dayProtein / (MACRO_TARGETS.protein.min || 1));
    const dScore = Math.min(1, dayDeficit / (MACRO_TARGETS.deficit.target || 1));
    const avg = (pScore + dScore) / 2;

    if (isNaN(avg)) return 1;
    if (avg > 0.9) return 4;
    if (avg > 0.7) return 3;
    if (avg > 0.5) return 2;
    return 1;
  };

  const progressData = React.useMemo(() => {
    if (!macroLogs) return [];
    
    const base = macroLogs
      .filter(l => l.weight !== undefined && l.timestamp)
      .map(l => {
        const heightM = (profile.height || 182.88) / 100;
        return {
          date: String(l.timestamp).split('T')[0],
          weight: l.weight,
          fat: l.fatPercentage || 0,
          bmi: l.weight ? (l.weight / (heightM * heightM)) : 0
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (progressRange === "day") return base;

    // Aggregate by week or month
    const groups: Record<string, typeof base> = {};
    base.forEach(item => {
      const d = new Date(item.date);
      let key = "";
      if (progressRange === "week") {
        // Find Sunday of that week
        const sun = new Date(d);
        sun.setDate(d.getDate() - d.getDay());
        key = sun.toISOString().split('T')[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).map(([key, items]) => {
      const count = items.length;
      return {
        date: key,
        weight: items.reduce((s, i) => s + (i.weight || 0), 0) / count,
        fat: items.reduce((s, i) => s + (i.fat || 0), 0) / count,
        bmi: items.reduce((s, i) => s + (i.bmi || 0), 0) / count,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [macroLogs, profile.height, progressRange]);

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E0D7C6] font-sans selection:bg-[#C5A059]/30">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-8 bg-[#161616] border-r border-[#333] z-50">
        <div className="mb-12">
          <div className="w-12 h-12 rounded-sm border border-[#C5A059] flex items-center justify-center font-serif italic text-xl text-[#C5A059]">
            AI
          </div>
        </div>
        
        <div className="flex-1 flex flex-col gap-10">
          <NavItem active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<LayoutDashboard size={22} />} />
          <NavItem active={activeTab === "progress"} onClick={() => setActiveTab("progress")} icon={<Activity size={22} />} />
          <NavItem active={activeTab === "import"} onClick={() => setActiveTab("import")} icon={<FileUp size={22} />} />
          <NavItem active={activeTab === "profile"} onClick={() => setActiveTab("profile")} icon={<Settings size={22} />} />
        </div>
      </nav>

      <main className="pl-20 min-h-screen relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-10 py-10">
          
          {/* Header Section */}
          <header className="flex justify-between items-end border-b border-[#333] pb-6 mb-10">
            <div>
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-5xl font-serif italic tracking-tighter leading-none"
              >
                Alveri <span className="text-[#C5A059] font-normal not-italic">Infiniti</span>
              </motion.h1>
              <p className="text-[10px] uppercase tracking-[0.3em] mt-3 opacity-40 font-bold">The Macro-Architectural Protocol for Akshay</p>
              
          {activeTab === "dashboard" && (
            <div className="flex gap-4 mt-6">
              {(["day", "week", "month"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setViewRange(r)}
                  className={cn(
                    "text-[10px] uppercase tracking-widest font-bold pb-1 border-b-2 transition-all",
                    viewRange === r ? "border-[#C5A059] text-[#C5A059]" : "border-transparent opacity-30 hover:opacity-100"
                  )}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => {
                  setFocusDate(getTodayIST());
                  setViewRange("day");
                }}
                className="ml-auto text-[9px] uppercase tracking-widest font-bold bg-[#C5A059] text-[#0F0F0F] px-3 py-1 hover:brightness-110 transition-all rounded-[2px]"
              >
                Go to Today
              </button>
            </div>
          )}
          {focusDate !== getTodayIST() && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-[#C5A059]/10 border border-[#C5A059]/20 rounded-sm">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#C5A059]">Viewing: {focusDate}</span>
              <button 
                onClick={() => setFocusDate(getTodayIST())}
                className="text-[10px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="text-sm font-serif italic text-[#C5A059] mb-1">
                Phase: <span className="text-white not-italic font-sans text-xs uppercase tracking-widest font-bold ml-1">High Visibility Zone</span>
              </div>
              <div className="flex gap-4 text-[10px] uppercase tracking-[0.2em] font-bold">
                <span className="opacity-40">Start: 80kg</span>
                <span className="text-[#C5A059]">Now: {profile.currentWeight}kg</span>
                <span className="opacity-40">Goal: 70kg</span>
              </div>
            </div>
          </header>

          <section className="mb-12 bg-[#161616] border border-[#333] p-8 pt-12">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Metabolic Consistency Calendar (From April 1st)</h2>
              <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest opacity-40 font-bold">
                <span>Low</span>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 bg-[#161b22] rounded-[1px] border border-white/5" />
                  <div className="w-3 h-3 bg-[#0e4429] rounded-[1px]" />
                  <div className="w-3 h-3 bg-[#006d32] rounded-[1px]" />
                  <div className="w-3 h-3 bg-[#26a641] rounded-[1px]" />
                  <div className="w-3 h-3 bg-[#39d353] rounded-[1px]" />
                </div>
                <span>Best</span>
              </div>
            </div>
            
            <div className="relative flex gap-3">
              {/* Day Labels */}
              <div className="flex flex-col gap-[3px] pt-1 pt-[2px]">
                {['', 'M', '', 'W', '', 'F', ''].map((day, i) => (
                  <div key={i} className="h-3.5 flex items-center text-[8px] font-bold text-white/20 uppercase">
                    {day}
                  </div>
                ))}
              </div>

              <div className="flex gap-[3px] overflow-x-auto pb-4 scrollbar-hide">
                {Array.from({ length: 24 }).map((_, weekIndex) => {
                  const protocolStart = new Date('2026-04-05');
                  const weekStart = new Date(protocolStart);
                  weekStart.setDate(protocolStart.getDate() + ((weekIndex - 1) * 7));
                  
                  const isFirstWeekOfMonth = weekStart.getDate() <= 7;
                  const monthName = (isFirstWeekOfMonth && weekIndex > 0) || weekIndex === 0
                    ? weekStart.toLocaleString('default', { month: 'short' }) 
                    : null;

                  return (
                    <div key={weekIndex} className="flex flex-col gap-[3px] shrink-0 relative">
                      {monthName && (
                        <button 
                          onClick={() => {
                            const lastDayOfMonth = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
                            setFocusDate(lastDayOfMonth.toISOString().split('T')[0]);
                            setViewRange("month");
                          }}
                          className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#C5A059] h-4 absolute top-[-1.8rem] left-0 hover:opacity-100 transition-all whitespace-nowrap cursor-pointer z-10"
                        >
                          {monthName}
                        </button>
                      )}
                      
                      <div className="flex flex-col gap-[3px]">
                        {Array.from({ length: 7 }).map((_, dayIndex) => {
                          const date = new Date(weekStart);
                          date.setDate(weekStart.getDate() + dayIndex);
                          
                          const dateStr = date.toISOString().split('T')[0];
                          const intensity = getCalendarIntensity(dateStr);
                          const isInvalidDate = date < new Date('2026-04-01');
                          const isToday = dateStr === getTodayIST();
                          
                          const isSelected = dateStr === focusDate;
                          
                          return (
                            <button 
                              key={dayIndex} 
                              title={dateStr}
                              onClick={() => {
                                if (!isInvalidDate) {
                                  setFocusDate(dateStr);
                                  setViewRange("day");
                                }
                              }}
                              disabled={isInvalidDate}
                              className={cn(
                                "w-3.5 h-3.5 rounded-[2px] transition-all relative",
                                (intensity === 0 || isInvalidDate) && "bg-[#161b22]",
                                intensity === 1 && !isInvalidDate && "bg-[#0e4429]",
                                intensity === 2 && !isInvalidDate && "bg-[#006d32]",
                                intensity === 3 && !isInvalidDate && "bg-[#26a641]",
                                intensity === 4 && !isInvalidDate && "bg-[#39d353]",
                                isToday && "ring-1 ring-white z-10",
                                isSelected && !isToday && "ring-1 ring-[#C5A059] z-10",
                                !isInvalidDate && "hover:scale-125 hover:z-20 cursor-pointer"
                              )}
                            >
                              {isToday && <div className="absolute inset-0 bg-white opacity-20" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-12 gap-10"
              >
                {/* 01. Metric Pentagram */}
                <div className="col-span-12 lg:col-span-4 flex flex-col">
                  <SectionTitle number="01" title={`Metabolic Scope: ${viewRange}`} />
                  <div className="flex-1 bg-[#161616] border border-[#333] p-6 relative aspect-square lg:aspect-auto">
                    <ResponsiveContainer width="100%" height="80%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                        <PolarGrid stroke="#333" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#C5A059', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }} />
                        <Radar
                          name="Performance"
                          dataKey="A"
                          stroke="#C5A059"
                          fill="#C5A059"
                          fillOpacity={0.15}
                          strokeWidth={1.5}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 border-t border-[#333] pt-4 flex justify-between items-center">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest opacity-40 mb-1">Burned Total</p>
                        <p className="text-xl font-serif italic text-white leading-tight">{stats.caloriesBurned.toFixed(0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-widest opacity-40">Period Deficit</p>
                        <p className="text-lg font-serif italic text-[#C5A059]">{stats.deficit.toFixed(0)} kcal</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 02. Biometric Budget */}
                <div className="col-span-12 lg:col-span-4 flex flex-col space-y-6">
                  <SectionTitle number="02" title={`Biometric Budget: ${viewRange}${viewRange === 'month' ? ' (' + new Date(focusDate).toLocaleString('default', { month: 'long' }) + ')' : ''}`} />
                  
                  <div className="space-y-6 bg-[#161616] border border-[#333] p-6">
                    <MacroBar label={`${viewRange === "day" ? "Day" : "Period"} Protein`} value={stats.protein} max={rangedTargets.protein} unit="g" accent="#C5A059" />
                    <MacroBar label={`${viewRange === "day" ? "Day" : "Period"} Sugar`} value={stats.sugar} max={rangedTargets.sugar} unit="g" accent="#FF4444" warning={stats.sugar > rangedTargets.sugar} />
                    <MacroBar label={`${viewRange === "day" ? "Day" : "Period"} Healthy Fats`} value={stats.healthyFats} max={rangedTargets.healthyFats} unit="g" accent="#E0D7C6" />
                    
                    {stats.avgWeight > 0 && (
                      <div className="pt-4 border-t border-[#333]">
                        <p className="text-[9px] uppercase tracking-widest opacity-40 mb-1">Aesthetic Mass ({viewRange === 'day' ? 'Current' : 'Avg'})</p>
                        <p className="text-2xl font-serif italic text-white leading-tight">{stats.avgWeight.toFixed(1)} <span className="text-xs not-italic font-sans opacity-40 uppercase">kg</span></p>
                      </div>
                    )}
                    
                    <div className="pt-4 mt-4 border-t border-[#333]">
                      <div className="bg-[#C5A059] text-[#0F0F0F] p-5">
                        <h3 className="text-xs font-bold uppercase mb-2 tracking-tighter">Period Calorie Delta</h3>
                        <div className="flex justify-between items-baseline">
                          <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">Consumed: {stats.caloriesConsumed.toFixed(0)}</p>
                          <p className="text-lg font-serif italic font-bold">Deficit: {stats.deficit.toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#161616] border border-[#333] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Guitar Focus</span>
                      <Music size={14} className="text-[#C5A059]" />
                    </div>
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-3xl font-serif italic leading-none">{guitarFocus.toFixed(1)}</span>
                      <span className="text-[10px] uppercase opacity-40 pb-1">/ 5.0 High</span>
                    </div>
                    <input 
                      type="range" min="1" max="5" step="0.1" value={guitarFocus} 
                      onChange={(e) => setGuitarFocus(parseFloat(e.target.value))}
                      className="w-full h-px bg-[#333] appearance-none cursor-pointer accent-[#C5A059]"
                    />
                  </div>

                  <div className="bg-[#161616] border border-[#333] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Pushup Volume</span>
                      <Dumbbell size={14} className="text-[#C5A059]" />
                    </div>
                    <div className="flex items-end gap-2 text-[#C5A059]">
                      <span className="text-3xl font-serif italic leading-none">{stats.pushups}</span>
                      <span className="text-[10px] uppercase opacity-60 pb-1">Total Reps</span>
                    </div>
                    <p className="text-[9px] uppercase tracking-widest opacity-30 mt-3 font-bold">Extracted from Protocol Reps</p>
                  </div>
                </div>

                {/* 03. The Zap Protocol */}
                <div className="col-span-12 lg:col-span-4 flex flex-col space-y-6">
                  <SectionTitle number="03" title="The Zap Protocol" color="#FF4444" />
                  
                  <div className={cn(
                    "border p-6 transition-colors duration-500",
                    showZapAlert ? "bg-[#2A0A0A] border-[#FF4444]" : "bg-[#161616] border-[#333]"
                  )}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-2 h-2 rounded-full", showZapAlert ? "bg-[#FF4444] animate-pulse" : "bg-[#333]")}></div>
                      <span className={cn("text-[10px] uppercase tracking-widest font-bold", showZapAlert ? "text-[#FF4444]" : "opacity-40")}>
                        Status: {showZapAlert ? "Active Irritation" : "Nominal"}
                      </span>
                    </div>
                    <h4 className="font-serif italic text-2xl mb-4 text-white">Regression Required</h4>
                    <ul className="text-[11px] space-y-3 uppercase tracking-wider font-bold">
                      <li className="flex gap-3"><span className="text-[#C5A059]">•</span> <span>Avoid Rotational Shearing</span></li>
                      <li className="flex gap-3"><span className="text-[#C5A059]">•</span> <span>Swimming: Pulling Only</span></li>
                      {showZapAlert && (
                        <button 
                          onClick={() => setShowZapAlert(false)}
                          className="mt-4 w-full border border-[#FF4444]/30 py-2 text-[9px] hover:bg-[#FF4444]/10 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                    </ul>
                  </div>

                  <SectionTitle number="04" title="Meta-Optimization Insights" color="#C5A059" />
                  <div className="bg-[#161616] border border-[#333] p-6 space-y-5">
                    {(() => {
                      const suggestions: { type: 'danger' | 'warning' | 'info' | 'success', text: string, label: string }[] = [];
                      
                      const pRatio = stats.protein / (rangedTargets.protein || 1);
                      if (pRatio < 0.8) {
                        suggestions.push({ 
                          type: 'warning', 
                          label: 'Muscle Catabolism', 
                          text: `Protein intake is ${((1 - pRatio) * 100).toFixed(0)}% below threshold. Target lean bovine or clean whey to prevent mass erosion.` 
                        });
                      }
                      
                      if (stats.sugar > rangedTargets.sugar) {
                        suggestions.push({ 
                          type: 'danger', 
                          label: 'Insulin Alert', 
                          text: "Glucose threshold breached. Lipolysis stalled for ~4 hours. Neutralize with high-volume soluble fiber or movement." 
                        });
                      }
                      
                      const dRatio = stats.deficit / (rangedTargets.deficit || 1);
                      if (dRatio < 0.7) {
                        suggestions.push({ 
                          type: 'info', 
                          label: 'Fat Oxidation', 
                          text: "Deficit is shallow. Energy partition is leaning towards storage. Increase intensity to sustain the 0.5kg/week trajectory." 
                        });
                      }

                      const hfRatio = stats.healthyFats / (rangedTargets.healthyFats || 1);
                      if (hfRatio < 0.6) {
                        suggestions.push({ 
                          type: 'warning', 
                          label: 'Neural Load', 
                          text: "Lipid insufficiency. Cognitive clarity and meniscus infrastructure at risk. Source clean Omega-3s." 
                        });
                      }

                      if (stats.pushups < 20 && stats.pushups > 0) {
                        suggestions.push({ 
                          type: 'info', 
                          label: 'Torque Audit', 
                          text: "Pushup volume is currently below biological density thresholds. Prioritize higher repetition cadence." 
                        });
                      }

                      if (suggestions.length === 0) {
                         suggestions.push({ 
                           type: 'success', 
                           label: 'System Parity', 
                           text: "Biological protocol synchronized. All markers are within optimal operational windows. Proceed with current adherence." 
                         });
                      }

                      return suggestions.map((s, i) => (
                        <div key={i} className="flex gap-4 group/insight border-l-2 pl-4 transition-all" style={{ borderColor: s.type === 'danger' ? '#FF4444' : s.type === 'warning' ? '#f97316' : s.type === 'success' ? '#22c55e' : '#444' }}>
                          <div className="flex-1">
                            <h4 className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-30 group-hover/insight:opacity-100 transition-opacity mb-1">{s.label}</h4>
                            <p className="text-[10px] leading-relaxed text-white/70 font-serif italic">{s.text}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="flex-1 border border-[#333] p-8 flex flex-col justify-between bg-[#161616]">
                    <div>
                      <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-6 opacity-40">Manual Override</h2>
                      <div className="space-y-4">
                        <ManualAdjuster label="Protein" value={stats.protein} onAdjust={(amt) => adjustStat("protein", amt)} unit="g" />
                        <ManualAdjuster label="Carbs" value={stats.carbs} onAdjust={(amt) => adjustStat("carbs", amt)} unit="g" />
                        <ManualAdjuster label="Sugar" value={stats.sugar} onAdjust={(amt) => adjustStat("sugar", amt)} unit="g" />
                        <ManualAdjuster label="Healthy Fats" value={stats.healthyFats} onAdjust={(amt) => adjustStat("healthyFats", amt)} unit="g" />
                        <ManualAdjuster label="Burned" value={stats.caloriesBurned} onAdjust={(amt) => adjustStat("caloriesBurned", amt)} unit="kcal" step={50} />
                        <ManualAdjuster label="Body-Mass" value={profile.currentWeight} onAdjust={(amt) => {
                          const newWeight = profile.currentWeight + amt;
                          setProfile({ ...profile, currentWeight: newWeight });
                          adjustStat("weight", amt);
                        }} unit="kg" step={0.1} />
                        <ManualAdjuster label="Fat %" value={0} onAdjust={(amt) => adjustStat("fatPercentage", amt)} unit="%" step={0.1} />

                        <div className="pt-4 border-t border-[#333] space-y-2">
                           <p className="text-[9px] uppercase tracking-widest font-bold opacity-30 mb-2">Protocol Templates</p>
                           <div className="grid grid-cols-2 gap-2">
                             <button 
                               onClick={() => addManualLog({ label: "Ganna Juice", sugar: 28, carbs: 32 })}
                               className="py-2 px-3 border border-[#333] text-[9px] uppercase font-bold text-white/40 hover:border-[#C5A059] hover:text-[#C5A059] transition-all"
                             >
                               + Ganna
                             </button>
                             <button 
                               onClick={() => addManualLog({ label: "Lean Meal", protein: 40, healthyFats: 10, carbs: 15 })}
                               className="py-2 px-3 border border-[#333] text-[9px] uppercase font-bold text-white/40 hover:border-[#C5A059] hover:text-[#C5A059] transition-all"
                             >
                               + Lean Meal
                             </button>
                             <button 
                               onClick={() => addManualLog({ label: "High Burn", caloriesBurned: 500 })}
                               className="py-2 px-3 border border-[#333] text-[9px] uppercase font-bold text-white/40 hover:border-[#C5A059] hover:text-[#C5A059] transition-all"
                             >
                               + Active Burn
                             </button>
                             <button 
                               onClick={() => addManualLog({ label: "Healthy Snack", healthyFats: 15, protein: 10 })}
                               className="py-2 px-3 border border-[#333] text-[9px] uppercase font-bold text-white/40 hover:border-[#C5A059] hover:text-[#C5A059] transition-all"
                             >
                               + H-Fat Snack
                             </button>
                           </div>

                           <div className="pt-2">
                             <ActionButton label="Trigger Zap Pulse" icon={<Zap size={14} />} color="#FF4444" onClick={() => addManualLog({ label: "Zap Log" })} />
                           </div>
                        </div>
                      </div>
                    </div>

                    {bufferingPrompt && (
                      <div className="mt-8 border-t border-[#333] pt-6">
                        <div className="flex items-start gap-4">
                          <AlertTriangle className="text-[#C5A059] shrink-0" size={18} />
                          <div>
                            <p className="text-[11px] italic font-serif leading-relaxed">{bufferingPrompt}</p>
                            <button onClick={() => setBufferingPrompt(null)} className="text-[9px] uppercase tracking-widest font-bold mt-2 border-b border-[#C5A059]">Dismiss</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "progress" && (
              <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                <div className="flex justify-between items-end">
                  <SectionTitle number="04" title={`Clinical Progress: ${progressRange}`} />
                  <div className="flex gap-4 mb-4">
                    {(["day", "week", "month"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setProgressRange(r)}
                        className={cn(
                          "text-[10px] uppercase tracking-widest font-bold pb-1 border-b-2 transition-all",
                          progressRange === r ? "border-[#C5A059] text-[#C5A059]" : "border-transparent opacity-30 hover:opacity-100"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="bg-[#161616] border border-[#333] p-8 lg:col-span-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#C5A059] mb-8">Bio-Mass Trajectory (Weight)</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis 
                            dataKey="date" 
                            tick={{fontSize: 10, fill: '#666'}} 
                            stroke="#333"
                            tickFormatter={(val) => {
                              if (progressRange === "day") return val.split('-').slice(1).join('/');
                              if (progressRange === "month") return new Date(val).toLocaleString('default', { month: 'short' });
                              return `W-${val.split('-').slice(1).join('/')}`;
                            }}
                          />
                          <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#161616', border: '1px solid #333', color: '#fff', fontSize: '10px'}}
                            itemStyle={{color: '#C5A059'}}
                            labelFormatter={(val) => progressRange === 'day' ? val : `Range Start: ${val}`}
                          />
                          <Line type="monotone" dataKey="weight" stroke="#C5A059" strokeWidth={2} dot={{fill: '#C5A059', r: 3}} activeDot={{r: 5}} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-[#161616] border border-[#333] p-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#E0D7C6] mb-8">Bio-Informatics: BMI</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis 
                            dataKey="date" 
                            tick={{fontSize: 10, fill: '#666'}} 
                            stroke="#333"
                            tickFormatter={(val) => {
                              if (progressRange === "day") return val.split('-').slice(1).join('/');
                              if (progressRange === "month") return new Date(val).toLocaleString('default', { month: 'short' });
                              return `W-${val.split('-').slice(1).join('/')}`;
                            }}
                          />
                          <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#161616', border: '1px solid #333', color: '#fff', fontSize: '10px'}}
                            itemStyle={{color: '#E0D7C6'}}
                          />
                          <Line type="monotone" dataKey="bmi" stroke="#E0D7C6" strokeWidth={2} dot={{fill: '#E0D7C6', r: 3}} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-[#161616] border border-[#333] p-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF4444] mb-8">Lipid Architecture (Fat %)</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis 
                            dataKey="date" 
                            tick={{fontSize: 10, fill: '#666'}} 
                            stroke="#333"
                            tickFormatter={(val) => {
                              if (progressRange === "day") return val.split('-').slice(1).join('/');
                              if (progressRange === "month") return new Date(val).toLocaleString('default', { month: 'short' });
                              return `W-${val.split('-').slice(1).join('/')}`;
                            }}
                          />
                          <YAxis domain={[0, 30]} tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#161616', border: '1px solid #333', color: '#fff', fontSize: '10px'}}
                            itemStyle={{color: '#FF4444'}}
                          />
                          <Line type="monotone" dataKey="fat" stroke="#FF4444" strokeWidth={2} dot={{fill: '#FF4444', r: 3}} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "import" && (
              <motion.div key="import" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto pt-10">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-serif italic text-white leading-tight">Data Synchronizer</h2>
                  <button 
                    onClick={purgeLogs}
                    className="flex items-center gap-2 border border-[#FF4444]/30 hover:bg-[#FF4444]/10 px-6 py-2 text-[10px] uppercase tracking-widest font-bold text-[#FF4444] transition-all"
                  >
                    <AlertTriangle size={14} /> Purge Protocol History
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                  <div className="lg:col-span-2 border border-[#333] border-dashed h-64 flex flex-col items-center justify-center bg-[#161616] hover:bg-[#1a1a1a] transition-all cursor-pointer group">
                    <FileUp size={32} className="text-[#C5A059] mb-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-xl font-serif italic mb-2">Sync Biometric Data</h3>
                    <p className="text-[10px] uppercase tracking-widest opacity-40 mb-8 px-4 text-center">Synchronize XLSX Protocol Logs</p>
                    <label className="border border-[#C5A059] px-10 py-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-all cursor-pointer">
                      Browse Files
                      <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileUpload} />
                    </label>
                  </div>
                  <div className="bg-[#1C1C1C] border border-[#333] p-8 flex flex-col justify-center">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#C5A059] mb-4">Protocol Schema</h4>
                    <ul className="text-[9px] uppercase tracking-[0.1em] space-y-2 opacity-60 font-bold leading-relaxed">
                    <li className="flex justify-between"><span>Col A</span> <span className="text-[#C5A059]">Date</span></li>
                    <li className="flex justify-between"><span>Col B</span> <span className="text-[#C5A059]">Weight (kg)</span></li>
                    <li className="flex justify-between"><span>Protein (g)</span> <span>Target 180+</span></li>
                    <li className="flex justify-between"><span>Sugar (g)</span> <span>Max 25-30</span></li>
                    <li className="flex justify-between"><span>Calories</span> <span>Burned/Consumed</span></li>
                    <li className="flex justify-between"><span>Reps</span> <span>Protocol Intensity</span></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-[#161616] border border-[#333] p-8">
                  <h3 className="text-sm font-bold uppercase mb-6 tracking-widest text-[#C5A059]">Data Orchestration</h3>
                  <p className="text-[11px] leading-loose opacity-70 italic font-serif">
                    The deficit is recalculated daily by comparing your Expenditure (Calories Burned) against your Intake (Protein, Carbs, Fats). Healthy Fats are isolated to track neural recovery and lipid optimization.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto pt-10">
                <div className="bg-[#161616] border border-[#333] p-10">
                  <h2 className="text-2xl font-serif italic mb-8">Metadata Config</h2>
                  <div className="space-y-8">
                    <ProfileField label="Current Bio-Mass (kg)" value={profile.currentWeight} onChange={(v) => setProfile({ ...profile, currentWeight: v })} />
                    <ProfileField label="Target Objective (kg)" value={profile.targetWeight} onChange={(v) => setProfile({ ...profile, targetWeight: v })} />
                    <div>
                      <span className="block text-[10px] uppercase font-bold tracking-widest opacity-40 mb-4">Fasting Protocol</span>
                      <div className="flex gap-4">
                        {["12:12", "14:10"].map(window => (
                          <button
                            key={window}
                            onClick={() => setProfile({ ...profile, fastingWindow: window as any })}
                            className={cn(
                              "flex-1 py-3 text-[11px] uppercase tracking-widest font-bold border transition-all",
                              profile.fastingWindow === window 
                                ? "bg-[#C5A059] border-[#C5A059] text-black" 
                                : "bg-transparent border-[#333] text-white/40 hover:border-[#C5A059]"
                            )}
                          >
                            {window}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Decorative */}
          <footer className="mt-16 pt-8 border-t border-[#333] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-[9px] uppercase tracking-[0.4em] opacity-20 font-bold">
            <div className="space-y-1">
              <p>ACL-R POST-OP RECOVERY v2.05</p>
              <p className="opacity-100 text-[#C5A059]">status: biological parity / protocol committed</p>
            </div>
            <div className="text-right space-y-1">
              <p>© 2026 ALVERI INFINITI</p>
              <p className="opacity-100 text-[#22c55e]">branch: master_metabolism</p>
            </div>
            <div className="space-y-1 text-center md:text-right">
              <p>MENISCUS PRESERVATION PROTOCOL</p>
              <p className="opacity-60 italic font-serif lowercase tracking-[0.1em]">hash: 7f82da_infiniti_alpha</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({ number, title, color = "#C5A059" }: { number: string, title: string, color?: string }) {
  return (
    <h2 className="text-xs uppercase tracking-[0.2em] mb-8 font-bold border-l-2 pl-4 flex items-baseline gap-3" style={{ borderColor: color }}>
      <span className="opacity-40">{number}.</span>
      <span>{title}</span>
    </h2>
  );
}

function MacroBar({ label, value, max, unit, accent, warning }: { label: string, value: number, max: number, unit: string, accent: string, warning?: boolean }) {
  const percentage = (value / max) * 100;
  return (
    <div className="relative">
      <div className="flex justify-between text-[11px] mb-2 uppercase tracking-[0.2em] font-bold">
        <span className="opacity-60">{label}</span>
        <span style={{ color: warning ? "#FF4444" : accent }}>{value.toFixed(0)}{unit} / {max}{unit}</span>
      </div>
      <div className="h-1 bg-[#222] w-full overflow-visible">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(120, percentage)}%` }} // Allow bleed out up to 120%
          className="h-full relative shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          style={{ 
            backgroundColor: warning ? "#FF4444" : accent,
            boxShadow: `0 0 12px ${warning ? "#FF4444" : accent}40`
          }}
        />
      </div>
      {warning && <p className="text-[9px] text-[#FF4444] italic font-serif mt-2 tracking-widest uppercase">Alert: Budget Exceeded. Blunt with lean protein.</p>}
    </div>
  );
}

function ActionButton({ label, icon, onClick, color = "#C5A059" }: { label: string, icon: React.ReactNode, onClick: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-4 border border-[#333] hover:border-[#C5A059]/50 p-4 transition-all group hover:bg-[#C5A059]/5"
    >
      <div className="text-[#C5A059] group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-[10px] uppercase tracking-widest font-bold opacity-60 group-hover:opacity-100">{label}</span>
    </button>
  );
}

function NavItem({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "p-4 rounded-sm transition-all relative group",
      active ? "text-[#C5A059]" : "text-white/20 hover:text-white/60"
    )}>
      {icon}
      {active && <motion.div layoutId="nav-glow" className="absolute inset-0 border border-[#C5A059] opacity-20" />}
    </button>
  );
}

function ProfileField({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] uppercase font-bold tracking-widest opacity-40 mb-3 ml-1">{label}</label>
      <input 
        type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full bg-transparent border border-[#333] px-5 py-3 outline-none focus:border-[#C5A059] transition-colors font-serif italic text-xl"
      />
    </div>
  );
}

function ManualAdjuster({ label, value, onAdjust, unit, step = 5 }: { label: string, value: number, onAdjust: (amt: number) => void, unit: string, step?: number }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-widest font-bold opacity-40 mb-1">{label}</span>
        <span className="text-sm font-serif italic text-white leading-none">{value.toFixed(0)}<span className="text-[10px] opacity-40 ml-1">{unit}</span></span>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => onAdjust(-step)}
          className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center hover:border-[#C5A059] text-white/40 hover:text-[#C5A059] transition-all"
        >
          <Minus size={12} />
        </button>
        <button 
          onClick={() => onAdjust(step)}
          className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center hover:border-[#C5A059] text-white/40 hover:text-[#C5A059] transition-all"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
