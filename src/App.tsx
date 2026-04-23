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
  LayoutDashboard,
  CheckCircle2,
  Droplets,
  Scale,
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

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [macroLogs, setMacroLogs] = useState<MacroLog[]>([]);
  const [guitarFocus, setGuitarFocus] = useState<number>(3.0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "import" | "profile" | "progress">("dashboard");
  const [viewRange, setViewRange] = useState<"day" | "week" | "month">("day");
  const [showZapAlert, setShowZapAlert] = useState(false);
  const [bufferingPrompt, setBufferingPrompt] = useState<string | null>(null);

  // Derived stats based on selected time range
  const filteredLogs = React.useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (viewRange === "day") {
      return macroLogs.filter(l => l.timestamp.startsWith(todayStr));
    }
    
    const rangeMs = viewRange === "week" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const startTime = now.getTime() - rangeMs;
    
    return macroLogs.filter(l => new Date(l.timestamp).getTime() >= startTime);
  }, [macroLogs, viewRange]);

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
    guitarFocus,
    symptoms: filteredLogs.filter(l => l.label.toLowerCase().includes("zap") || l.label.toLowerCase().includes("shock")).map(l => "zap")
  };

  const multiplier = viewRange === "day" ? 1 : viewRange === "week" ? 7 : 30;
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
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws);
      
      const parsedLogs: MacroLog[] = data.map((row) => ({
        id: crypto.randomUUID(),
        timestamp: row.Date || row.date || new Date().toISOString(),
        protein: Number(row["Protein (g)"] || row.Protein || row.protein || 0),
        sugar: Number(row["Sugar (g)"] || row.Sugar || row.sugar || 0),
        sugarPercentage: row["Sugar (%)"] ? Number(row["Sugar (%)"]) : undefined,
        carbs: Number(row["Carbs (g)"] || row.Carbs || row.carbs || 0),
        fats: Number(row["Fats (g)"] || row.Fats || row.fats || 0),
        healthyFats: Number(row["Healthy Fats"] || row.healthyFats || 0),
        caloriesBurned: Number(row["Calories Burned"] || row.caloriesBurned || 0),
        caloriesConsumed: row["Calories Consumed"] ? Number(row["Calories Consumed"]) : undefined,
        deficit: row["Daily Deficit"] ? Number(row["Daily Deficit"]) : undefined,
        bmr: row["Estimated BMR"] ? Number(row["Estimated BMR"]) : undefined,
        reps: row.Reps ? Number(row.Reps) : undefined,
        weight: row["Weight (kg)"] || row.Weight || row.weight ? Number(row["Weight (kg)"] || row.Weight || row.weight) : undefined,
        fatPercentage: row["Fat Percentage"] || row.fatPercentage ? Number(row["Fat Percentage"] || row.fatPercentage) : undefined,
        label: row.Category || row.Label || row.label || "Manual Entry"
      }));

      setMacroLogs(parsedLogs);
      alert(`Synchronized ${parsedLogs.length} entries from protocol file.`);
    };
    reader.readAsBinaryString(file);
  };

  const addManualLog = (log: Partial<MacroLog>) => {
    const newLog: MacroLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
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
    setMacroLogs([...macroLogs, newLog]);
  };

  const purgeLogs = () => {
    if (confirm("Metabolic Purge: Are you sure you want to delete all historical protocol data?")) {
      setMacroLogs([]);
    }
  };

  const adjustStat = (stat: keyof MacroLog, amount: number) => {
    const today = new Date().toISOString().split('T')[0];
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
    const logsForDate = macroLogs.filter(l => l.timestamp.startsWith(dateStr));
    if (logsForDate.length === 0) return 0;

    const dayProtein = logsForDate.reduce((s, l) => s + l.protein, 0);
    const dayDeficit = logsForDate.reduce((s, l) => s + (l.caloriesBurned - (l.protein * 4 + l.carbs * 4 + l.fats * 9)), 0);
    
    const pScore = Math.min(1, dayProtein / MACRO_TARGETS.protein.min);
    const dScore = Math.min(1, dayDeficit / MACRO_TARGETS.deficit.target);
    const avg = (pScore + dScore) / 2;

    if (avg > 0.9) return 3;
    if (avg > 0.6) return 2;
    return 1;
  };

  const progressData = macroLogs
    .filter(l => l.weight !== undefined)
    .map(l => ({
      date: l.timestamp.split('T')[0],
      weight: l.weight,
      fat: l.fatPercentage,
      bmi: l.weight ? l.weight / ((profile.height / 100) ** 2) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

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

          {/* Metabolic Heatmap */}
          <section className="mb-12 bg-[#161616] border border-[#333] p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Metabolic Consistency Calendar</h2>
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest opacity-30 font-bold">
                <span>Low</span>
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 bg-[#0F0F0F] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#ef4444] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#eab308] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#22c55e] rounded-sm" />
                </div>
                <span>Best</span>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-hide">
              {/* Reset to show data starting from April 1st */}
              {Array.from({ length: 15 }).map((_, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1.5 shrink-0">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const startDate = new Date('2026-04-01');
                    // Find the first Sunday before or on April 1st to align weeks
                    const firstDayOffset = startDate.getDay();
                    startDate.setDate(startDate.getDate() - firstDayOffset + (weekIndex * 7) + dayIndex);
                    
                    const dateStr = startDate.toISOString().split('T')[0];
                    const intensity = getCalendarIntensity(dateStr);
                    const isBeforeApril = new Date(dateStr) < new Date('2026-04-01');
                    
                    return (
                      <div 
                        key={dayIndex} 
                        title={dateStr}
                        className={cn(
                          "w-3 h-3 rounded-[1px] transition-colors cursor-help",
                          (intensity === 0 || isBeforeApril) && "bg-[#0F0F0F]",
                          intensity === 1 && !isBeforeApril && "bg-[#ef4444] opacity-40",
                          intensity === 2 && !isBeforeApril && "bg-[#eab308] opacity-60",
                          intensity === 3 && !isBeforeApril && "bg-[#22c55e]"
                        )}
                      />
                    );
                  })}
                </div>
              ))}
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
                  <SectionTitle number="01" title="Metric Pentagram" />
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
                        <p className="text-[9px] uppercase tracking-widest opacity-40 mb-1">Calories Burned</p>
                        <p className="text-xl font-serif italic text-white leading-tight">{stats.caloriesBurned.toFixed(0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-widest opacity-40">Daily Deficit</p>
                        <p className="text-lg font-serif italic text-[#C5A059]">{stats.deficit.toFixed(0)} kcal</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 02. Biometric Budget */}
                <div className="col-span-12 lg:col-span-4 flex flex-col space-y-6">
                  <SectionTitle number="02" title="Biometric Budget" />
                  
                  <div className="space-y-6 bg-[#161616] border border-[#333] p-6">
                    <MacroBar label="Protein Density" value={stats.protein} max={rangedTargets.protein} unit="g" accent="#C5A059" />
                    <MacroBar label="Sugar Control" value={stats.sugar} max={rangedTargets.sugar} unit="g" accent="#FF4444" warning={stats.sugar > rangedTargets.sugar} />
                    <MacroBar label="Healthy Fats" value={stats.healthyFats} max={rangedTargets.healthyFats} unit="g" accent="#E0D7C6" />
                    
                    <div className="pt-4 mt-4 border-t border-[#333]">
                      <div className="bg-[#C5A059] text-[#0F0F0F] p-5">
                        <h3 className="text-xs font-bold uppercase mb-2 tracking-tighter">Calorie Delta</h3>
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
                <SectionTitle number="04" title="Clinical Progress Overlays" />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="bg-[#161616] border border-[#333] p-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#C5A059] mb-8">Bio-Mass Trajectory (Weight)</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="date" tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#161616', border: '1px solid #333', color: '#fff', fontSize: '10px'}}
                            itemStyle={{color: '#C5A059'}}
                          />
                          <Line type="monotone" dataKey="weight" stroke="#C5A059" strokeWidth={2} dot={{fill: '#C5A059', r: 3}} activeDot={{r: 5}} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-[#161616] border border-[#333] p-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#C5A059] mb-8">Lipid Architecture (Fat %)</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="date" tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
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

                  <div className="bg-[#161616] border border-[#333] p-8 lg:col-span-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#C5A059] mb-8">Metabolic BMI Consistency</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="date" tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{fontSize: 10, fill: '#666'}} stroke="#333" />
                          <Tooltip 
                            contentStyle={{backgroundColor: '#161616', border: '1px solid #333', color: '#fff', fontSize: '10px'}}
                            itemStyle={{color: '#E0D7C6'}}
                          />
                          <Line type="monotone" dataKey="bmi" stroke="#E0D7C6" strokeWidth={2} dot={{fill: '#E0D7C6', r: 3}} />
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
                      <li>• Date / Category</li>
                      <li>• Protein (g) / Carbs (g) / Fats (g)</li>
                      <li>• Sugar (g) / Sugar (%)</li>
                      <li>• Calories Burned / Consumed</li>
                      <li>• Estimated BMR / Daily Deficit</li>
                      <li>• Reps / Weight (kg)</li>
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
          <footer className="mt-16 flex justify-between items-center text-[9px] uppercase tracking-[0.4em] opacity-20 font-bold">
            <span>ACL-R POST-OP RECOVERY v2.05</span>
            <span>© 2025 ALVERI INFINITI</span>
            <span>MENISCUS PRESERVATION PROTOCOL</span>
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
