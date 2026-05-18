"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sun, Moon, Target, Calendar, Search, X, LogOut, Power } from 'lucide-react';
import { fetchEmployees, fetchSessions, subscribeToUpdates, fetchRangeStats, fetchDailyMinutes, postAttendance } from '@/lib/api';
import { toast } from 'sonner';

type ViewMode = 'focused';

const MODES: Record<ViewMode, { start: number, end: number, label: string, icon: React.ReactNode }> = {
  focused: { start: 10, end: 19, label: 'Working Hours', icon: <Target size={20} /> },
};

interface Session {
  start: number;
  end: number | null;
  type: 'green' | 'red';
}

type DurationTab = 'day' | 'week' | 'month' | 'year' | 'custom';

interface StatPeriod {
  durationWorkedStr: string;
  durationBreakStr: string;
  inSessions: number;
  outSessions: number;
  wfhDays?: number;
  officeDays?: number;
}

interface Person {
  id: string;
  name: string;
  phone: string;
  telegramId: string;
  location: 'Office' | 'Home';
  sessions: Session[];
  stats: {
    week: StatPeriod;
    month: StatPeriod;
    year: StatPeriod;
    custom: StatPeriod;
  };
  heatmapData: Record<string, number>;
}

const RANDOM_NAMES = [
  "Liam Smith", "Olivia Johnson", "Noah Williams", "Emma Brown", "James Jones",
  "Ava Garcia", "William Miller", "Sophia Davis", "Benjamin Rodriguez", "Isabella Martinez",
  "Lucas Hernandez", "Mia Lopez", "Henry Gonzalez", "Charlotte Wilson", "Alexander Anderson",
  "Amelia Thomas", "Sebastian Taylor", "Evelyn Moore", "Jack Jackson", "Harper Martin"
];

export default function ProgressTracker() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [people, setPeople] = useState<Person[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('focused');
  const [zoomScale, setZoomScale] = useState(24 / 9);
  const [isManualZoom, setIsManualZoom] = useState(false);
  const [activeDateLabel, setActiveDateLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeDurationTab, setActiveDurationTab] = useState<DurationTab>('day');
  const [isMounted, setIsMounted] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<'current' | 'rolling'>('current');
  const todayStr = new Date().toISOString().split('T')[0];
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerInteractionRef = useRef<HTMLDivElement>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number, scrollLeft: number } | null>(null);

  const [popupData, setPopupData] = useState<{
    session: Session;
    personName: string;
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalChartMinutes = 24 * 60;

  const getMinutesFromChartStart = (date: Date) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const diffMs = date.getTime() - todayStart.getTime();
    return diffMs / 60000;
  };

  // State for focused employee details fetched dynamically
  const [focusedStats, setFocusedStats] = useState<Record<string, StatPeriod>>({
    week: { durationWorkedStr: '0h 0m', durationBreakStr: '0h 0m', inSessions: 0, outSessions: 0, officeDays: 0, wfhDays: 0 },
    month: { durationWorkedStr: '0h 0m', durationBreakStr: '0h 0m', inSessions: 0, outSessions: 0, officeDays: 0, wfhDays: 0 },
    year: { durationWorkedStr: '0h 0m', durationBreakStr: '0h 0m', inSessions: 0, outSessions: 0, officeDays: 0, wfhDays: 0 },
    custom: { durationWorkedStr: '0h 0m', durationBreakStr: '0h 0m', inSessions: 0, outSessions: 0, officeDays: 0, wfhDays: 0 },
  });
  const [focusedHeatmap, setFocusedHeatmap] = useState<Record<string, number>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLiveData = async () => {
    try {
      const employees = await fetchEmployees();
      const todayDateStr = new Date().toISOString().split('T')[0];
      const sessionsMap = await fetchSessions(todayDateStr);
      
      const mergedPeople: Person[] = employees.map(emp => {
        const empSessions = sessionsMap[emp.id] || [];
        
        const finalSessions: Session[] = empSessions.length > 0 
          ? empSessions.map(s => ({
              start: s.start,
              end: s.end,
              type: s.type
            }))
          : [{ 
              start: 480, // Start at 8 AM default
              end: null, 
              type: emp.current_status.toLowerCase() === 'in' ? 'green' : 'red' 
            }];

        return {
          id: emp.id ? String(emp.id).trim() : '-',
          name: emp.name ? String(emp.name).trim() : '-',
          phone: emp.phone ? String(emp.phone).trim() : '-',
          telegramId: emp.telegram_id ? String(emp.telegram_id).trim() : '-',
          location: (emp.location === 'Home' || emp.has_wfh) ? 'Home' : 'Office',
          sessions: finalSessions,
          stats: {
            week: { durationWorkedStr: 'Loading...', durationBreakStr: 'Loading...', inSessions: 0, outSessions: 0 },
            month: { durationWorkedStr: 'Loading...', durationBreakStr: 'Loading...', inSessions: 0, outSessions: 0 },
            year: { durationWorkedStr: 'Loading...', durationBreakStr: 'Loading...', inSessions: 0, outSessions: 0 },
            custom: { durationWorkedStr: 'Loading...', durationBreakStr: 'Loading...', inSessions: 0, outSessions: 0 },
          },
          heatmapData: {}
        };
      });

      setPeople(mergedPeople);
    } catch (err: any) {
      console.error("Error loading live attendance data:", err);
      setError(err.message || "Failed to sync with database");
    } finally {
      setLoadingData(false);
    }
  };

  // Initial data fetch and SSE connection
  useEffect(() => {
    loadLiveData();
    
    // Subscribe to SSE updates for real-time dashboard sync
    const unsubscribe = subscribeToUpdates(() => {
      console.log("Realtime event received! Reloading tactical timeline...");
      loadLiveData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Dynamic focused employee stats and activity heatmap fetching
  useEffect(() => {
    if (selectedPersonId === null) return;
    
    const loadFocusedData = async () => {
      setLoadingStats(true);
      try {
        const today = new Date();
        const getLocalDateStr = (d: Date) => d.toISOString().split('T')[0];

        // 1. Fetch Heatmap
        const heatmapResult = await fetchDailyMinutes();
        const userHeatmap = heatmapResult[selectedPersonId] || {};
        setFocusedHeatmap(userHeatmap);

        // 2. Fetch Range Stats helper
        const getStatsForRange = async (start: string, end: string): Promise<StatPeriod> => {
          try {
            const statsMap = await fetchRangeStats(start, end);
            const userStats = statsMap[selectedPersonId] || {
              work_mins: 0,
              break_mins: 0,
              in_sessions: 0,
              out_sessions: 0,
              office_days: 0,
              wfh_days: 0
            };
            
            const wH = Math.floor(userStats.work_mins / 60);
            const wM = Math.floor(userStats.work_mins % 60);
            const bH = Math.floor(userStats.break_mins / 60);
            const bM = Math.floor(userStats.break_mins % 60);

            return {
              durationWorkedStr: `${wH}h ${wM}m`,
              durationBreakStr: `${bH}h ${bM}m`,
              inSessions: userStats.in_sessions,
              outSessions: userStats.out_sessions,
              officeDays: userStats.office_days,
              wfhDays: userStats.wfh_days
            };
          } catch (e) {
            console.error("Failed to fetch range stats:", e);
            return { durationWorkedStr: '0h 0m', durationBreakStr: '0h 0m', inSessions: 0, outSessions: 0, officeDays: 0, wfhDays: 0 };
          }
        };

        // Compute Date Ranges
        const weekStart = new Date();
        weekStart.setDate(today.getDate() - 7);
        const weekStats = await getStatsForRange(getLocalDateStr(weekStart), getLocalDateStr(today));

        const monthStart = new Date();
        monthStart.setDate(today.getDate() - 30);
        const monthStats = await getStatsForRange(getLocalDateStr(monthStart), getLocalDateStr(today));

        const yearStart = new Date();
        yearStart.setDate(today.getDate() - 365);
        const yearStats = await getStatsForRange(getLocalDateStr(yearStart), getLocalDateStr(today));

        const customStats = await getStatsForRange(customStartDate, customEndDate);

        setFocusedStats({
          week: weekStats,
          month: monthStats,
          year: yearStats,
          custom: customStats
        });

      } catch (err) {
        console.error("Error fetching focused employee stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    loadFocusedData();
  }, [selectedPersonId, customStartDate, customEndDate]);

  // Update clock
  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Default positioning on load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const totalWidth = scrollContainerRef.current.scrollWidth;
        const targetHours = 14.5; // Centers at 2:30 PM so viewport shows 10 AM to 7 PM
        const scrollPos = (targetHours / 24) * totalWidth - (scrollContainerRef.current.clientWidth / 2);
        scrollContainerRef.current.scrollLeft = Math.max(0, scrollPos);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Reactive date label update
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateDate = () => {
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const viewportWidth = container.clientWidth;
      
      // Calculate the pixel position of the center relative to the start of the chart
      const centerPos = scrollLeft + viewportWidth / 2;
      
      // The 48-hour range spans from padding (48px) to scrollWidth - 48px
      const padding = 48;
      const effectiveWidth = scrollWidth - padding * 2;
      
      // Calculate pct relative to the 24-hour span
      const pct = (centerPos - padding) / effectiveWidth;
      const currentHour = pct * 24;
      
      const baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0); // Start of TODAY
      const viewDate = new Date(baseDate.getTime() + currentHour * 60 * 60 * 1000);
      
      setActiveDateLabel(viewDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }));
    };

    container.addEventListener('scroll', updateDate);
    // Also update on resize or zoom changes
    const observer = new ResizeObserver(updateDate);
    observer.observe(container);
    
    updateDate(); // Initial call

    return () => {
      container.removeEventListener('scroll', updateDate);
      observer.disconnect();
    };
  }, [zoomScale]);

  const currentMinutesFromChartStart = getMinutesFromChartStart(currentTime);

  const filteredPeople = useMemo(() => {
    if (selectedPersonId !== null) {
      const person = people.find(p => p.id === selectedPersonId);
      return person ? [person] : [];
    }
    if (!searchQuery) return people;
    const q = searchQuery.toLowerCase();
    
    return people
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return aName.localeCompare(bName);
      });
  }, [people, searchQuery, selectedPersonId]);
  
  // Dynamic calculation for employees checked in after 10:00 AM
  const lateCount = useMemo(() => {
    return people.filter(p => {
      const greenSessions = p.sessions.filter(s => s.type === 'green');
      if (greenSessions.length === 0) return false;
      const firstCheckIn = Math.min(...greenSessions.map(s => s.start));
      return firstCheckIn > 600; // 10:00 AM in minutes
    }).length;
  }, [people]);

  // Clear selection if search query changes
  useEffect(() => {
    if (searchQuery) {
      setSelectedPersonId(null);
    }
  }, [searchQuery]);

  // Buffering effect on search
  const isBuffering = searchQuery !== "" && filteredPeople.length !== 1;

  const togglePersonStatus = async (id: string) => {
    const person = people.find(p => p.id === id);
    if (!person) return;
    
    const isCurrentlyIn = person.sessions[person.sessions.length - 1].type === 'green';
    const action = isCurrentlyIn ? 'out' : 'in';
    
    try {
      await postAttendance(id, person.name, action);
      toast.success(`Successfully posted check-${action} override for ${person.name}`);
      loadLiveData();
    } catch (err: any) {
      toast.error(`Override check-${action} failed: ${err.message}`);
    }
  };

  const getDateFromChartMinutes = (mins: number) => {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    return new Date(baseDate.getTime() + mins * 60000);
  };

  const getDailyStats = (person: Person): StatPeriod => {
    let totalWorkMins = 0;
    let totalBreakMins = 0;
    let inSessions = 0;
    let outSessions = 0;

    const windowStart = 10 * 60; // 10:00 AM
    const windowEnd = 19 * 60;   // 7:00 PM

    person.sessions.forEach(session => {
      const start = session.start;
      const end = session.end || currentMinutesFromChartStart;

      if (session.type === 'green') {
        totalWorkMins += (end - start);
        inSessions++;
      } else {
        outSessions++;
        // Calculate break ONLY within the 10:00 to 19:00 window
        const overlapStart = Math.max(start, windowStart);
        const overlapEnd = Math.min(end, windowEnd);
        if (overlapEnd > overlapStart) {
          totalBreakMins += (overlapEnd - overlapStart);
        }
      }
    });

    const workH = Math.floor(totalWorkMins / 60);
    const workM = Math.floor(totalWorkMins % 60);
    const breakH = Math.floor(totalBreakMins / 60);
    const breakM = Math.floor(totalBreakMins % 60);

    return {
      durationWorkedStr: `${workH}h ${workM}m`,
      durationBreakStr: `${breakH}h ${breakM}m`,
      inSessions,
      outSessions
    };
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const formatDuration = (startMins: number, endMins: number) => {
    const diff = endMins - startMins;
    const totalSeconds = Math.floor(diff * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const renderHeatmap = (person: Person, tab: DurationTab, startStr: string, endStr: string, mode: 'rolling' | 'current') => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const getLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const getLiveHoursToday = (p: Person) => {
      let totalMins = 0;
      p.sessions.forEach(session => {
        if (session.type === 'green') {
          const start = session.start;
          const end = session.end || getMinutesFromChartStart(currentTime);
          totalMins += Math.max(0, end - start);
        }
      });
      return totalMins / 60;
    };

    const getHeatmapColor = (hours: number, isHourly = false) => {
      if (isHourly) {
        if (hours === 0) return 'bg-white/5 border border-white/5';
        if (hours < 0.3) return 'bg-emerald-500/20 border border-emerald-500/10';
        if (hours < 0.7) return 'bg-emerald-500/50 border border-emerald-500/30';
        if (hours < 0.9) return 'bg-emerald-500/80 border border-emerald-500/50';
        return 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
      } else {
        if (hours === 0) return 'bg-white/5 border border-white/5';
        if (hours < 5) return 'bg-emerald-500/20 border border-emerald-500/10';
        if (hours < 7.5) return 'bg-emerald-500/50 border border-emerald-500/30';
        if (hours <= 9) return 'bg-emerald-500/80 border border-emerald-500/50';
        return 'bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
      }
    };

    if (tab === 'day' || (tab === 'custom' && startStr === endStr)) {
      const targetDateStr = tab === 'day' ? getLocalDateStr(today) : startStr;
      const isToday = targetDateStr === getLocalDateStr(today);
      
      const hourlyData: number[] = new Array(24).fill(0);
      
      if (isToday) {
         person.sessions.forEach(session => {
           if (session.type === 'green') {
             const startMins = session.start;
             const endMins = session.end || getMinutesFromChartStart(currentTime);
             for (let m = Math.floor(startMins); m < Math.floor(endMins); m++) {
               const h = Math.floor(m / 60);
               if (h >= 0 && h < 24) {
                 hourlyData[h] += (1 / 60);
               }
             }
           }
         });
      } else {
         const totalHours = focusedHeatmap[targetDateStr] || 0;
         let distributed = 0;
         for (let h = 9; h < 18 && distributed < totalHours; h++) {
           const val = Math.min(1, totalHours - distributed);
           hourlyData[h] = val;
           distributed += val;
         }
      }

      return (
        <div className="flex justify-center min-w-max w-full">
          <div className="flex gap-2 sm:gap-3 items-end">
            {hourlyData.map((hours, h) => (
               <div key={h} className="group relative flex flex-col items-center gap-3">
                 <div className={`w-8 h-12 sm:w-10 sm:h-14 rounded-xl transition-all duration-300 ${getHeatmapColor(hours, true)} hover:scale-110 hover:ring-4 ring-emerald-500/50 shadow-sm`}></div>
                 <span className="text-[10px] font-black text-zinc-600 group-hover:text-zinc-300 transition-colors">{h}:00</span>
                 <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] flex flex-col items-center">
                   <div className="bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl flex flex-col items-center">
                     <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{targetDateStr} @ {h}:00</span>
                     <span className="text-xs font-black text-white">{Math.round(hours * 60)} mins active</span>
                   </div>
                   <div className="w-2 h-2 bg-zinc-900 border-b border-r border-white/10 rotate-45 -mt-1.5"></div>
                 </div>
               </div>
            ))}
          </div>
        </div>
      );
    }

    let rangeStart = new Date(today);
    let rangeEnd = new Date(today);
    
    if (tab === 'year') {
      if (mode === 'current') {
        rangeStart = new Date(today.getFullYear(), 0, 1);
        rangeEnd = new Date(today.getFullYear(), 11, 31);
      } else {
        rangeStart.setDate(today.getDate() - 364); 
      }
    } else if (tab === 'month') {
      if (mode === 'current') {
        rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
        rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      } else {
        rangeStart.setDate(today.getDate() - 30);
      }
    } else if (tab === 'week') {
      if (mode === 'current') {
        const currDay = today.getDay();
        const diffToMon = currDay === 0 ? -6 : 1 - currDay;
        rangeStart.setDate(today.getDate() + diffToMon);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeStart.getDate() + 6);
      } else {
        rangeStart.setDate(today.getDate() - 6);
      }
    } else if (tab === 'custom') {
      rangeStart = new Date(startStr);
      rangeEnd = new Date(endStr);
      if (rangeStart > rangeEnd) {
        const temp = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = temp;
      }
    }

    const dates: Date[] = [];
    const curr = new Date(rangeStart);
    while (curr <= rangeEnd) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    if (tab === 'year' || (tab === 'custom' && dates.length > 90)) {
      const isScrollable = dates.length > 366;
      const squareSize = isScrollable ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 xl:w-[17px] xl:h-[17px]';
      const gapClass = isScrollable ? 'gap-1.5 sm:gap-2' : 'gap-1';
      const monthMarginClass = isScrollable ? 'ml-4 sm:ml-6' : 'ml-3 sm:ml-4';
      const textClass = isScrollable ? 'text-[9px] sm:text-[11px]' : 'text-[8px] sm:text-[10px]';
      const labelTextClass = isScrollable ? 'text-[8px] sm:text-[10px]' : 'text-[7px] sm:text-[9px]';

      const weeks: ({ date: Date, hours: number, dateStr: string } | null)[][] = [];
      let currentWeek: ({ date: Date, hours: number, dateStr: string } | null)[] = new Array(7).fill(null);
      
      dates.forEach(d => {
        const dayOfWeek = d.getDay();
        const dateStr = getLocalDateStr(d);
        const isToday = dateStr === getLocalDateStr(today);
        const hours = isToday ? getLiveHoursToday(person) : (focusedHeatmap[dateStr] || 0);
        currentWeek[dayOfWeek] = { date: d, hours, dateStr };
        
        if (dayOfWeek === 6) {
          weeks.push([...currentWeek]);
          currentWeek = new Array(7).fill(null);
        }
      });
      if (currentWeek.some(d => d !== null)) {
        weeks.push(currentWeek);
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      return (
        <div className={`flex justify-center w-full ${isScrollable ? 'min-w-max' : ''}`}>
          <div className={`flex ${gapClass}`}>
             <div className={`flex flex-col justify-around pr-1 sm:pr-2 font-black text-zinc-600 pb-4 ${labelTextClass}`}>
               <span>Mon</span>
               <span>Wed</span>
               <span>Fri</span>
             </div>
             {weeks.map((week, wIdx) => {
               const firstDay = week.find(d => d !== null);
               const isNewMonth = firstDay && firstDay.date.getDate() <= 7 && wIdx > 0 && firstDay.date.getMonth() !== weeks[wIdx-1].find(d=>d!==null)?.date.getMonth();
               
               return (
                 <div key={wIdx} className={`flex flex-col ${gapClass} pb-4 ${isNewMonth ? `${monthMarginClass} relative` : ''}`}>
                   {isNewMonth && firstDay && (
                     <span className={`absolute -top-5 sm:-top-6 left-0 font-black text-zinc-500 uppercase tracking-widest ${textClass}`}>{months[firstDay.date.getMonth()]}</span>
                   )}
                   {week.map((day, dIdx) => {
                     if (!day) return <div key={dIdx} className={squareSize}></div>;
                     return (
                       <div key={dIdx} className="group relative">
                         <div className={`${squareSize} rounded-[1px] sm:rounded-[2px] transition-all duration-300 ${getHeatmapColor(day.hours)} hover:ring-1 ring-emerald-500/50`}></div>
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] flex flex-col items-center">
                           <div className="bg-zinc-900 border border-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl flex flex-col items-center">
                             <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{day.dateStr}</span>
                             <span className="text-xs font-black text-white">{day.hours.toFixed(1)} hrs</span>
                           </div>
                           <div className="w-2 h-2 bg-zinc-900 border-b border-r border-white/10 rotate-45 -mt-1.5"></div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               );
             })}
          </div>
        </div>
      );
    } else if (tab === 'month') {
      const chunks: Date[][] = [];
      for (let i = 0; i < dates.length; i += 7) {
        chunks.push(dates.slice(i, i + 7));
      }
      return (
        <div className="flex justify-center w-full mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-8 max-w-6xl">
             {chunks.map((chunk, chunkIdx) => {
                const isLastShortChunk = chunkIdx === chunks.length - 1 && chunk.length < 7;
                return (
                  <div key={chunkIdx} className={`flex gap-2 sm:gap-3 ${isLastShortChunk ? 'xl:col-span-2 justify-center' : ''}`}>
                     {chunk.map((d, idx) => {
                       const dateStr = getLocalDateStr(d);
                       const isToday = dateStr === getLocalDateStr(today);
                       const hours = isToday ? getLiveHoursToday(person) : (focusedHeatmap[dateStr] || 0);
                       return (
                         <div key={idx} className="group relative flex flex-col items-center gap-2">
                           <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl transition-all duration-300 ${getHeatmapColor(hours)} hover:scale-110 hover:ring-2 ring-emerald-500/50 flex items-center justify-center shadow-sm`}>
                             <span className={`font-black text-xs sm:text-sm text-white/30 group-hover:text-white/90 transition-colors`}>
                               {d.getDate()}
                             </span>
                           </div>
                           <span className={`text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest`}>
                             {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                           </span>
                           <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] flex flex-col items-center">
                             <div className="bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl whitespace-nowrap shadow-2xl flex flex-col items-center">
                               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{dateStr}</span>
                               <span className="text-sm font-black text-white mt-0.5">{hours.toFixed(1)} hrs</span>
                             </div>
                             <div className="w-3 h-3 bg-zinc-900 border-b border-r border-white/10 rotate-45 -mt-2"></div>
                           </div>
                         </div>
                       );
                     })}
                  </div>
                );
             })}
          </div>
        </div>
      );
    } else {
      const isFewDays = dates.length <= 14;
      const squareSize = isFewDays ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl' : 'w-8 h-8 sm:w-10 sm:h-10 rounded-xl';
      const gapSize = isFewDays ? 'gap-4 sm:gap-6' : 'gap-2 sm:gap-3';
      const labelSize = isFewDays ? 'text-[10px] sm:text-xs' : 'text-[8px] sm:text-[10px]';

      return (
        <div className="flex justify-center w-full mt-2">
          <div className={`flex flex-wrap justify-center ${gapSize} max-w-5xl`}>
             {dates.map((d, idx) => {
               const dateStr = getLocalDateStr(d);
               const isToday = dateStr === getLocalDateStr(today);
               const hours = isToday ? getLiveHoursToday(person) : (focusedHeatmap[dateStr] || 0);
               return (
                 <div key={idx} className="group relative flex flex-col items-center gap-2">
                   <div className={`${squareSize} transition-all duration-300 ${getHeatmapColor(hours)} hover:scale-110 hover:ring-4 ring-emerald-500/50 flex items-center justify-center shadow-sm`}>
                     {/* Date Number inside */}
                     <span className={`font-black ${isFewDays ? 'text-xl sm:text-3xl text-white/40' : 'text-xs sm:text-sm text-white/30'} group-hover:text-white/90 transition-colors`}>
                       {d.getDate()}
                     </span>
                   </div>
                   <span className={`${labelSize} font-black text-zinc-500 uppercase tracking-widest`}>
                     {d.toLocaleDateString('en-US', { weekday: isFewDays ? 'short' : 'narrow' })}
                   </span>
                   <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] flex flex-col items-center">
                     <div className="bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl whitespace-nowrap shadow-2xl flex flex-col items-center">
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{dateStr}</span>
                       <span className="text-sm font-black text-white mt-0.5">{hours.toFixed(1)} hrs</span>
                     </div>
                     <div className="w-3 h-3 bg-zinc-900 border-b border-r border-white/10 rotate-45 -mt-2"></div>
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      );
    }
  };

  const handleSessionClick = (e: React.MouseEvent, person: Person, session: Session) => {
    e.stopPropagation();
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setPopupData({
      session,
      personName: person.name,
      x: e.clientX,
      y: e.clientY,
      visible: true
    });
  };

  const handlePopupMouseEnter = () => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setPopupData(prev => prev ? { ...prev, visible: true } : null);
  };

  const handlePopupMouseLeave = () => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      setPopupData(prev => prev ? { ...prev, visible: false } : null);
      setTimeout(() => setPopupData(prev => prev?.visible === false ? null : prev), 700);
    }, 500);
  };

  const handleSessionMouseLeave = (session: Session) => {
    setPopupData(prev => {
      if (prev && prev.session === session) {
        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = setTimeout(() => {
          setPopupData(p => p ? { ...p, visible: false } : null);
          setTimeout(() => setPopupData(p => p?.visible === false ? null : p), 700);
        }, 500);
      }
      return prev;
    });
  };

  const handleSessionMouseEnter = (session: Session) => {
    setPopupData(prev => {
      if (prev && prev.session === session) {
        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
        return { ...prev, visible: true };
      }
      return prev;
    });
  };

  const timeMarkers = useMemo(() => {
    if (!isMounted) return [];
    const markers = [];
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 24; i++) {
      const d = new Date(baseDate.getTime() + i * 60 * 60 * 1000);
      markers.push({
        hour: d.getHours(),
        label: d.toLocaleTimeString([], { hour: 'numeric', hour12: true }),
      });
    }
    return markers;
  }, [isMounted]);

  useEffect(() => {
    const header = headerInteractionRef.current;
    const container = scrollContainerRef.current;
    if (!header || !container) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        container.scrollLeft += e.deltaX;
        setIsManualZoom(true);
      } else {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        setZoomScale(prev => {
          const next = Math.min(Math.max(prev * delta, 1), 15);
          if (next !== prev) setIsManualZoom(true);
          return next;
        });
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDistRef.current = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      } else if (e.touches.length === 1) {
        touchStartPosRef.current = { x: e.touches[0].pageX, scrollLeft: container.scrollLeft };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        e.preventDefault();
        const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        const delta = dist / touchStartDistRef.current;
        touchStartDistRef.current = dist;
        setZoomScale(prev => {
          const next = Math.min(Math.max(prev * delta, 1), 15);
          if (next !== prev) setIsManualZoom(true);
          return next;
        });
      } else if (e.touches.length === 1 && touchStartPosRef.current !== null) {
        const dx = touchStartPosRef.current.x - e.touches[0].pageX;
        container.scrollLeft = touchStartPosRef.current.scrollLeft + dx;
        setIsManualZoom(true);
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
      touchStartPosRef.current = null;
    };

    header.addEventListener('wheel', handleWheel, { passive: false });
    header.addEventListener('touchstart', handleTouchStart);
    header.addEventListener('touchmove', handleTouchMove, { passive: false });
    header.addEventListener('touchend', handleTouchEnd);

    return () => {
      header.removeEventListener('wheel', handleWheel);
      header.removeEventListener('touchstart', handleTouchStart);
      header.removeEventListener('touchmove', handleTouchMove);
      header.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const selectPreset = (mode: ViewMode) => {
    setViewMode(mode);
    setIsManualZoom(false);
    const { start, end } = MODES[mode];
    const duration = end - start;
    const newZoom = 24 / duration;
    setZoomScale(newZoom);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        const totalWidth = scrollContainerRef.current.scrollWidth;
        const targetHours = start + duration / 2;
        const scrollPos = (targetHours / 24) * totalWidth - (scrollContainerRef.current.clientWidth / 2);
        
        scrollContainerRef.current.scrollTo({
          left: Math.max(0, scrollPos),
          behavior: 'smooth'
        });
      }
    }, 10);
  };

  return (
    <div className="h-full w-full bg-[#020202] text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col p-4 gap-4">
      {/* Detached Top HUD */}
      <div className="flex-shrink-0 px-6 py-2 bg-zinc-950/80 border border-white/[0.05] rounded-2xl backdrop-blur-xl flex items-center justify-between h-16 shadow-2xl relative overflow-hidden">
        {/* Left Side: Clock & Presets (Swapped) */}
        <div className="flex items-center gap-8 z-10">
          <div className="text-3xl font-black tracking-tighter tabular-nums text-zinc-100">
            {isMounted ? currentTime.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
          </div>
          
          <div className="flex gap-1 p-1.5 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
            {(Object.keys(MODES) as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => selectPreset(mode)}
                className={`px-5 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-500 ${
                  !isManualZoom && viewMode === mode 
                    ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {React.cloneElement(MODES[mode].icon as React.ReactElement<{size: number}>, { size: 18 })}
                <span className="text-[11px] font-black uppercase tracking-widest">{MODES[mode].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Centered Stats Display */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-10 z-10">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Fleet</span>
            <span className="text-2xl font-black text-white">{people.length}</span>
          </div>
          <div className="w-px h-8 bg-white/5"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-1">Active IN</span>
            <span className="text-2xl font-black text-emerald-500">{people.filter(p => p.sessions[p.sessions.length-1].type === 'green').length}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-rose-500/50 uppercase tracking-widest mb-1">Active OUT</span>
            <span className="text-2xl font-black text-rose-500">{people.filter(p => p.sessions[p.sessions.length-1].type === 'red').length}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest mb-1">Tactical Late</span>
            <span className="text-2xl font-black text-amber-500">{people.length > 0 ? lateCount : '-'}</span>
          </div>
        </div>

        {/* Right Side: Date & Login */}
        <div className="flex items-center gap-8 z-10">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-2.5 rounded-full flex items-center gap-3 backdrop-blur-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest whitespace-nowrap">{activeDateLabel}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Space reserved for global login dropdown in page.tsx */}
            <div className="w-12 h-12"></div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Container - Detached Card */}
      <div className="flex-1 flex overflow-hidden bg-zinc-950/50 border border-white/[0.05] rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        <div className="w-full h-full flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - Perfectly Aligned */}
            <div className="w-52 flex-shrink-0 bg-black/20 border-r border-zinc-800/50 flex flex-col z-20">
              <div className="h-12 px-4 flex items-center border-b border-zinc-800/20">
                <div className="relative w-full flex items-center">
                  <Search className="absolute left-2 text-zinc-600" size={14} />
                  <input
                    type="text"
                    placeholder="Search fleet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-hidden">
                <div className={`pt-0 space-y-0 flex flex-col ${!searchQuery && filteredPeople.length > 1 ? 'h-full' : ''} overflow-y-hidden scrollbar-hide`}>
                  {filteredPeople.map(person => {
                    const isGreen = person.sessions[person.sessions.length-1].type === 'green';
                    const rowHeightClass = (!searchQuery && filteredPeople.length > 1) ? 'flex-1' : 'h-12';
                    return (
                      <div
                        key={person.id}
                        onClick={() => {
                          setSelectedPersonId(person.id);
                          setSearchQuery(""); // Clear search if selecting directly
                        }}
                        className={`${rowHeightClass} px-5 flex items-center gap-3 text-base font-black text-zinc-400 border-l-4 ${
                          isGreen 
                            ? (person.location === 'Home' ? 'border-cyan-500/80' : 'border-emerald-500/80') 
                            : 'border-rose-500/80'
                        } border-b border-white/[0.03] even:bg-white/[0.01] hover:bg-white/[0.04] transition-all group whitespace-nowrap overflow-hidden cursor-pointer`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isGreen 
                            ? (person.location === 'Home' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]') 
                            : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                        }`}></div>
                        <span className="truncate group-hover:text-white transition-colors uppercase tracking-tight">{person.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden relative select-none scrollbar-hide"
              >
                <div 
                  style={{ width: `${100 * zoomScale}%`, minWidth: '100%' }}
                  className="relative h-full flex flex-col"
                >
                  {/* Sticky Header */}
                  <div 
                    ref={headerInteractionRef}
                    className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 cursor-ew-resize h-12 flex flex-col justify-end pb-2 flex-shrink-0"
                  >
                    <div className="w-full flex justify-between px-12 relative items-end h-full">
                      {timeMarkers.map((m, idx) => (
                        <div key={idx} className="relative w-px h-full flex items-end">
                          <span className="absolute left-0 bottom-0 bg-zinc-800/80 text-[10px] font-black text-zinc-400 px-2.5 py-1.5 rounded-lg border border-zinc-700/30 shadow-xl pointer-events-none uppercase tracking-tighter whitespace-nowrap">
                            {m.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grid Lines Overlay */}
                  <div className={`absolute inset-0 pointer-events-none px-12 pt-12 ${filteredPeople.length === 1 ? 'h-24' : ''}`}>
                    <div className="flex justify-between h-full">
                      {timeMarkers.map((_, idx) => (
                        <div key={idx} className="w-px h-full bg-gradient-to-b from-zinc-800/40 via-zinc-800/5 to-transparent"></div>
                      ))}
                    </div>
                  </div>

                  {/* Rows Container */}
                  <div className="relative flex-1 flex flex-col overflow-hidden">
                    {isBuffering && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-500">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]"></div>
                          <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] animate-pulse">Tactical Scan Active</span>
                        </div>
                      </div>
                    )}
                    <div 
                      className={`px-12 flex flex-col transition-all duration-700 ${isBuffering ? 'opacity-5 grayscale scale-[0.98] blur-sm' : 'opacity-100 grayscale-0 scale-100 blur-0'} ${!searchQuery && filteredPeople.length > 1 ? 'h-full' : ''}`}
                    >
                      {filteredPeople.map(person => {
                        const rowHeightClass = (!searchQuery && filteredPeople.length > 1) ? 'flex-1' : 'h-12';
                        return (
                          <div key={person.id} className={`${rowHeightClass} flex items-center relative group border-b border-white/[0.03] even:bg-white/[0.01]`}>
                            <div className="absolute -inset-x-6 inset-y-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>
                            <div className="w-full h-6 bg-black/60 rounded-full overflow-hidden relative border border-zinc-800/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                              {person.sessions.map((session, sIdx) => {
                                const startPct = (session.start / totalChartMinutes) * 100;
                                const endPct = ((session.end || currentMinutesFromChartStart) / totalChartMinutes) * 100;
                                const isGrowing = session.end === null;
                                return (
                                  <div
                                    key={sIdx}
                                    onClick={(e) => handleSessionClick(e, person, session)}
                                    onMouseEnter={() => handleSessionMouseEnter(session)}
                                    onMouseLeave={() => handleSessionMouseLeave(session)}
                                    className={`absolute top-0 h-full rounded-full transition-all duration-700 ease-out cursor-pointer hover:brightness-110 ${
                                      session.type === 'green' 
                                        ? (person.location === 'Home'
                                            ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 ' + (isGrowing ? 'to-cyan-400/90' : 'to-cyan-400') + ' shadow-[0_0_25px_rgba(6,182,212,0.15)]'
                                            : 'bg-gradient-to-r from-emerald-600 via-emerald-500 ' + (isGrowing ? 'to-emerald-400/90' : 'to-emerald-400') + ' shadow-[0_0_25px_rgba(16,185,129,0.15)]')
                                        : 'bg-gradient-to-r from-rose-600 via-rose-500 ' + (isGrowing ? 'to-rose-400/90' : 'to-rose-400') + ' shadow-[0_0_25px_rgba(244,63,94,0.15)]'
                                    }`}
                                    style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dedicated Control Area for Focused View (Stationary Overlay) */}
              {filteredPeople.length === 1 && (
                <div className="absolute top-12 left-0 right-0 bottom-0 pointer-events-none z-50">
                  <div className="w-full h-full relative flex flex-col pt-12 px-12">
                    {/* Background Masking Gridlines */}
                    <div className="absolute top-12 inset-x-0 bottom-0 bg-zinc-950/40 backdrop-blur-md border-t border-zinc-800/20 z-0"></div>

                    {/* Tactical HUD Element - Moved to background */}
                    <div className="absolute inset-x-0 bottom-0 opacity-5 pb-12 pointer-events-none select-none overflow-hidden z-0 flex flex-col justify-end">
                      <div className="text-[12rem] font-black text-white/10 leading-none tracking-tighter uppercase whitespace-nowrap">
                        {filteredPeople[0].name.split(' ')[0]}
                      </div>
                    </div>
                    
                    <div className="relative w-full flex justify-between items-start mt-4 pointer-events-auto z-10 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSelectedPersonId(null);
                          setSearchQuery("");
                        }}
                        title="Exit View"
                        className="group flex items-center justify-center p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                      >
                        <LogOut size={20} className="text-zinc-500 group-hover:text-rose-500 transition-colors" />
                      </button>

                      <button
                        onClick={() => togglePersonStatus(filteredPeople[0].id)}
                        title={filteredPeople[0].sessions[filteredPeople[0].sessions.length-1].type === 'green' ? 'Mark as OUT' : 'Mark as IN'}
                        className={`group flex items-center justify-center p-3 border rounded-xl transition-all duration-500 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl ${
                          filteredPeople[0].sessions[filteredPeople[0].sessions.length-1].type === 'green'
                            ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40' 
                            : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                        }`}
                      >
                        <Power size={20} className={filteredPeople[0].sessions[filteredPeople[0].sessions.length-1].type === 'green' ? 'text-rose-500' : 'text-emerald-500'} />
                      </button>
                    </div>

                    <div className="relative flex-1 w-full overflow-y-auto pointer-events-auto mt-6 z-10 custom-scrollbar pr-4 pb-8 flex flex-col gap-10">
                      {/* Details Grid */}
                      {(() => {
                        const person = filteredPeople[0];
                        let stats: StatPeriod;
                        const todayStr = new Date().toISOString().split('T')[0];

                        if (activeDurationTab === 'day') {
                          stats = getDailyStats(person);
                        } else if (activeDurationTab === 'custom') {
                          if (customStartDate === customEndDate) {
                            if (customStartDate === todayStr) {
                              stats = getDailyStats(person);
                            } else {
                              const pastHours = focusedHeatmap[customStartDate] || 0;
                              const wH = Math.floor(pastHours);
                              const wM = Math.floor((pastHours % 1) * 60);
                              stats = {
                                durationWorkedStr: `${wH}h ${wM}m`,
                                durationBreakStr: '0h 0m',
                                inSessions: pastHours > 0 ? 1 : 0,
                                outSessions: pastHours > 0 ? 1 : 0,
                                officeDays: pastHours > 0 ? 1 : 0,
                                wfhDays: 0
                              };
                            }
                          } else {
                            stats = focusedStats.custom;
                          }
                        } else {
                          stats = focusedStats[activeDurationTab] || { durationWorkedStr: '0h 0m', durationBreakStr: '0h 0m', inSessions: 0, outSessions: 0 };
                        }
                        
                        const isDayView = activeDurationTab === 'day' || (activeDurationTab === 'custom' && customStartDate === customEndDate);
                        
                        return (
                          <div className="flex flex-col gap-6 px-4">
                            {/* Personal Info - Constant */}
                            <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-wrap justify-between items-center gap-8 shadow-lg">
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Name</span>
                                <span className="text-2xl font-black text-white">{person.name}</span>
                              </div>
                              <div className="w-px h-12 bg-white/5 hidden md:block"></div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Employee ID</span>
                                <span className="text-2xl font-black text-white">
                                  {person.id && person.id !== '-' 
                                    ? (person.id.toString().replace(/^EMP-/i, '').replace(/^0+/, '') || '0')
                                    : '-'}
                                </span>
                              </div>
                              <div className="w-px h-12 bg-white/5 hidden md:block"></div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Phone Number</span>
                                <span className="text-2xl font-black text-white">{person.phone && person.phone !== '-' ? person.phone : '-'}</span>
                              </div>
                              <div className="w-px h-12 bg-white/5 hidden md:block"></div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Telegram ID</span>
                                <span className="text-2xl font-black text-emerald-400">{person.telegramId && person.telegramId !== '-' ? person.telegramId : '-'}</span>
                              </div>
                            </div>

                            {/* Duration Tab Selector */}
                            <div className="flex flex-col items-center gap-6">
                              <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50 w-max shadow-xl">
                                {(['day', 'week', 'month', 'year', 'custom'] as DurationTab[]).map(t => (
                                  <button
                                    key={t}
                                    onClick={() => setActiveDurationTab(t)}
                                    className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                      activeDurationTab === t 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                                    }`}
                                  >
                                    {t === 'custom' ? 'Custom Range' : t}
                                  </button>
                                ))}
                              </div>

                              {activeDurationTab === 'custom' && (
                                <div className="flex items-center gap-4 bg-zinc-900/40 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
                                  <div className="flex items-center gap-3 px-4 py-1.5 bg-black/40 rounded-xl border border-zinc-800/50">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Start</span>
                                    <input 
                                      type="date" 
                                      value={customStartDate}
                                      onChange={(e) => setCustomStartDate(e.target.value)}
                                      className="bg-transparent text-sm font-bold text-zinc-300 focus:outline-none focus:text-emerald-400 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)] [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 cursor-pointer"
                                    />
                                  </div>
                                  <div className="w-4 h-px bg-zinc-800"></div>
                                  <div className="flex items-center gap-3 px-4 py-1.5 bg-black/40 rounded-xl border border-zinc-800/50">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">End</span>
                                    <input 
                                      type="date" 
                                      value={customEndDate}
                                      onChange={(e) => setCustomEndDate(e.target.value)}
                                      className="bg-transparent text-sm font-bold text-zinc-300 focus:outline-none focus:text-emerald-400 [&::-webkit-calendar-picker-indicator]:filter-[invert(1)] [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 cursor-pointer"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Stats */}
                            <div className={`grid grid-cols-2 ${isDayView ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} lg:grid-rows-2 gap-6`}>
                              <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-1 lg:row-start-1 lg:row-span-2">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Current Location</span>
                                <span className={`text-3xl lg:text-5xl font-black ${person.location === 'Home' ? 'text-amber-400' : 'text-blue-400'}`}>{person.location}</span>
                              </div>

                              <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-2 lg:row-start-1">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Duration Worked</span>
                                <span className="text-3xl font-black text-emerald-400">{stats.durationWorkedStr}</span>
                              </div>

                              <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 relative overflow-hidden group shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-2 lg:row-start-2">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] relative z-10">Break Duration</span>
                                <span className="text-3xl font-black text-rose-400 relative z-10">{stats.durationBreakStr}</span>
                                <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                {isDayView && (
                                  <span className="absolute bottom-4 right-5 text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">10AM - 7PM</span>
                                )}
                              </div>

                              <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-3 lg:row-start-1">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Total IN Sessions</span>
                                <span className="text-3xl font-black text-white">{stats.inSessions}</span>
                              </div>

                              <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-3 lg:row-start-2">
                                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Total OUT Sessions</span>
                                <span className="text-3xl font-black text-white">{stats.outSessions}</span>
                              </div>

                              {!isDayView && 'officeDays' in stats && (
                                <>
                                  <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-4 lg:row-start-1">
                                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Office Days</span>
                                    <span className="text-3xl font-black text-blue-400">{stats.officeDays}</span>
                                  </div>
                                  <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col justify-center gap-2 shadow-lg hover:bg-zinc-900/50 transition-colors lg:col-start-4 lg:row-start-2">
                                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">WFH Days</span>
                                    <span className="text-3xl font-black text-amber-400">{stats.wfhDays}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Heatmap Section */}
                      <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 flex flex-col gap-6 shadow-lg lg:col-span-4 col-span-2 mx-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                          <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Activity Heatmap</span>
                          
                          {/* Toggle for Mode - Centered */}
                          {activeDurationTab !== 'day' && activeDurationTab !== 'custom' && (
                            <div className="flex bg-black/40 p-1 rounded-lg border border-zinc-800/50 absolute left-1/2 -translate-x-1/2">
                              <button
                                onClick={() => setHeatmapMode('current')}
                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${heatmapMode === 'current' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}
                              >
                                Current
                              </button>
                              <button
                                onClick={() => setHeatmapMode('rolling')}
                                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${heatmapMode === 'rolling' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-600 hover:text-zinc-400'}`}
                              >
                                Rolling
                              </button>
                            </div>
                          )}
                          
                          <div className="flex gap-2 items-center">
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Less</span>
                            <div className="w-3 h-3 rounded-[2px] bg-white/5 border border-white/5"></div>
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-500/20 border border-emerald-500/10"></div>
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-500/50 border border-emerald-500/30"></div>
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-500/80 border border-emerald-500/50"></div>
                            <div className="w-3 h-3 rounded-[2px] bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">More</span>
                          </div>
                        </div>
                        
                        <div className="flex-1 w-full overflow-x-auto custom-scrollbar pt-16 pb-4">
                          {renderHeatmap(filteredPeople[0], activeDurationTab, customStartDate, customEndDate, heatmapMode)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {popupData && (
        <div 
          className={`fixed z-[200] w-64 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-700 ease-in-out pointer-events-auto ${
            popupData.visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
          }`}
          style={{ 
            left: Math.min(popupData.x, typeof window !== 'undefined' ? window.innerWidth - 270 : popupData.x), 
            top: Math.max(20, popupData.y - 150)
          }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <div className="flex items-center justify-between mb-3">
             <span className="text-xs font-black text-white uppercase tracking-widest">{popupData.personName}</span>
             <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
               popupData.session.type === 'green' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
             }`}>
               {popupData.session.type === 'green' ? 'IN (Active)' : 'OUT (Break)'}
             </span>
          </div>
          <div className="space-y-2">
             <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold tracking-wider">
               <span>Start Time</span>
               <span className="text-white">{formatTime(getDateFromChartMinutes(popupData.session.start))}</span>
             </div>
             <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold tracking-wider">
               <span>End Time</span>
               <span className="text-white">{popupData.session.end ? formatTime(getDateFromChartMinutes(popupData.session.end)) : 'Ongoing'}</span>
             </div>
             <div className="h-px w-full bg-white/5 my-2"></div>
             <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold tracking-wider">
               <span>Duration</span>
               <span className="text-emerald-400 font-black">{formatDuration(popupData.session.start, popupData.session.end || currentMinutesFromChartStart)}</span>
             </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; border: 1px solid #333; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #222; }
      `}</style>
    </div>
  );
}
