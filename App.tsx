import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Calendar, User, Bus, Truck, Hotel, Bike, DollarSign, 
  Calculator, Sparkles, TrendingUp, Briefcase, AlertTriangle, 
  Fuel, Utensils, Download, Save, FolderOpen, Trash2, X,
  ArrowRight, Info, CheckCircle2, AlertCircle, Clock, Plus, Minus,
  CreditCard, FileText, ChevronDown, ChevronUp, Copy, FileDown, Code,
  Upload, FileJson
} from 'lucide-react';
import { TripParams, CostBreakdown, HotelStay } from './types';
import { NumberInput, Toggle } from './components/InputSection';
import { CostChart } from './components/CostChart';
import { generateTripProposal, analyzeCostsAI } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

// Helper per inizializzare/ridimensionare array
const resizeArray = (currentArray: number[], newSize: number, defaultValue: number): number[] => {
  if (!currentArray) return Array(newSize).fill(defaultValue);
  if (newSize > currentArray.length) {
    const lastValue = currentArray.length > 0 ? currentArray[currentArray.length - 1] : defaultValue;
    const diff = newSize - currentArray.length;
    return [...currentArray, ...Array(diff).fill(lastValue)];
  } else {
    return currentArray.slice(0, newSize);
  }
};

const getSum = (arr: number[]) => arr ? arr.reduce((a, b) => a + b, 0) : 0;

const DEFAULT_DURATION = 7;

// Initial State
const initialParams: TripParams = {
  tripName: "Tour Ciclistico Toscana",
  participants: 8,
  durationDays: DEFAULT_DURATION,
  profitMarginPercent: 25,
  hasGuide: true,
  guide: {
    dailyRates: Array(DEFAULT_DURATION).fill(150),
    dailyRatesBefore: [],
    dailyRatesAfter: [],
    travelCost: 200,
    extraDaysBefore: 0,
    extraDaysAfter: 0,
  },
  hasDriver: true,
  driver: {
    dailyRates: Array(DEFAULT_DURATION).fill(120),
    dailyRatesBefore: [120],
    dailyRatesAfter: [120],
    travelCost: 200,
    extraDaysBefore: 1, 
    extraDaysAfter: 1, 
  },
  // Staff Logistics
  staffDailyLunchCosts: Array(DEFAULT_DURATION).fill(25),
  staffDailyLunchCostsBefore: [25],
  staffDailyLunchCostsAfter: [25],

  staffDailyAccommodationCosts: Array(DEFAULT_DURATION).fill(90),
  staffDailyAccommodationCostsBefore: [90],
  staffDailyAccommodationCostsAfter: [90],

  // Vehicle
  vanDailyRentalCosts: Array(DEFAULT_DURATION).fill(160),
  vanDailyRentalCostsBefore: [160],
  vanDailyRentalCostsAfter: [160],

  fuelDailyCosts: Array(DEFAULT_DURATION).fill(40),
  fuelDailyCostsBefore: [40],
  fuelDailyCostsAfter: [40],

  // Client
  hotelStays: [
    { 
      id: '1', 
      name: 'Hotel Base', 
      nights: DEFAULT_DURATION, 
      costPerNight: 90,
      paymentTerms: "30% alla conferma, saldo 30gg prima",
      cancellationPolicy: "Penale 100% da 15gg prima",
      dusSupplement: 30
    }
  ],
  bikeDailyRentalCosts: Array(DEFAULT_DURATION).fill(30),
};

interface SavedTrip {
  id: string;
  name: string;
  date: string;
  params: TripParams;
}

interface DailyCostGridProps {
  values: number[];
  onChange: (newValues: number[]) => void;
  label: string;
  icon?: React.ElementType;
  helperText?: string;
  variant?: 'default' | 'before' | 'after';
}

const DailyCostGrid: React.FC<DailyCostGridProps> = ({ values, onChange, label, icon: Icon, helperText, variant = 'default' }) => {
  if (!values || values.length === 0) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'before': return "bg-amber-50/50 border-amber-200/60";
      case 'after': return "bg-indigo-50/50 border-indigo-200/60";
      default: return "bg-white border-slate-200";
    }
  };

  const getLabelColor = () => {
    switch (variant) {
      case 'before': return "text-amber-700";
      case 'after': return "text-indigo-700";
      default: return "text-slate-600";
    }
  };

  const getDayLabel = (idx: number) => {
    if (variant === 'before') return `-${values.length - idx}`;
    if (variant === 'after') return `+${idx + 1}`;
    return `G${idx + 1}`;
  };

  const handleFillAll = () => {
    const firstVal = values[0] || 0;
    onChange(values.map(() => firstVal));
  };

  return (
    <div className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-end mb-2">
        <label className={`block text-[10px] font-bold uppercase tracking-widest flex items-center ${getLabelColor()}`}>
          {Icon && <Icon className="h-3.5 w-3.5 mr-1.5 opacity-80" />}
          {label}
        </label>
        {values.length > 1 && (
          <button 
            onClick={handleFillAll}
            className="text-[10px] text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded transition-colors flex items-center"
            title="Copia il primo valore su tutti i giorni"
          >
            <Copy className="w-3 h-3 mr-1" /> Copia su tutti
          </button>
        )}
      </div>
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 p-3 rounded-xl border shadow-sm ${getVariantStyles()}`}>
        {values.map((cost, index) => (
          <div key={index} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
               <span className={`text-[10px] font-bold ${getLabelColor()} opacity-50`}>
                 {getDayLabel(index)}
               </span>
            </div>
            <input
              type="number"
              value={cost}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                 const newValues = [...values];
                 const val = parseFloat(e.target.value);
                 newValues[index] = isNaN(val) ? 0 : val;
                 onChange(newValues);
              }}
              className="block w-full rounded-lg border-slate-200 bg-white/50 pl-8 focus:border-brand-500 focus:ring-brand-500 text-xs py-2 border shadow-sm transition-all text-right pr-2"
            />
          </div>
        ))}
      </div>
      {helperText && <p className="text-xs text-slate-400 mt-1.5 ml-1">{helperText}</p>}
    </div>
  );
};

// Componente per le sezioni collassabili
const SectionCard: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}> = ({ title, icon: Icon, children, defaultOpen = true, className = "" }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-2xl shadow-soft border border-slate-100 relative overflow-hidden transition-all duration-300 ${className} ${!isOpen ? 'pb-0' : ''}`}>
      <div 
        className="p-6 sm:p-8 flex justify-between items-center cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-bold text-slate-800 flex items-center">
          <Icon className="w-5 h-5 mr-2.5 text-brand-600"/> {title}
        </h2>
        <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>
      
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 sm:px-8 pb-8 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [params, setParams] = useState<TripParams>(initialParams);
  const [aiContent, setAiContent] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'calc' | 'proposal'>('calc');
  
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [showSavesModal, setShowSavesModal] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved trips on mount
  useEffect(() => {
    const saved = localStorage.getItem('tourCalc_saves');
    if (saved) {
      try {
        setSavedTrips(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved trips", e);
      }
    }
    
    // Check for auto-save
    const autoSaved = localStorage.getItem('tourCalc_autosave');
    if (autoSaved) {
      try {
         const parsed = JSON.parse(autoSaved);
         if (window.confirm("Trovata una sessione precedente salvata automaticamente. Vuoi ripristinarla?")) {
            setParams(parsed);
         }
      } catch(e) {}
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    const interval = setInterval(() => {
       localStorage.setItem('tourCalc_autosave', JSON.stringify(params));
       setLastAutoSave(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [params]);

  const handleDurationChange = (newDuration: number) => {
    const safeDuration = Math.max(1, newDuration);
    setParams(prev => {
       // Adjust last hotel stay to match new duration
       const currentStaysDuration = prev.hotelStays.reduce((acc, s) => acc + s.nights, 0);
       const diff = safeDuration - currentStaysDuration;
       
       let newStays = [...prev.hotelStays];
       if (newStays.length > 0) {
         // Modify last stay
         const lastStay = newStays[newStays.length - 1];
         // Ensure nights doesn't go below 1 unless it's being removed (simple logic: just clamp to 1 minimum for last stay if total > 1)
         const newNights = Math.max(1, lastStay.nights + diff);
         newStays[newStays.length - 1] = { ...lastStay, nights: newNights };
       } else {
         newStays = [{ 
             id: Date.now().toString(), 
             name: "Hotel Standard", 
             nights: safeDuration, 
             costPerNight: 90,
             paymentTerms: "",
             cancellationPolicy: "",
             dusSupplement: 0
         }];
       }

       // Helper to fix total nights mismatch if simple math failed (e.g. multiple stays)
       const finalTotal = newStays.reduce((acc, s) => acc + s.nights, 0);
       if (finalTotal < safeDuration) {
          newStays[newStays.length - 1].nights += (safeDuration - finalTotal);
       } else if (finalTotal > safeDuration) {
          // Reduce from end
          let remove = finalTotal - safeDuration;
          for (let i = newStays.length - 1; i >= 0 && remove > 0; i--) {
             if (newStays[i].nights > remove) {
                newStays[i].nights -= remove;
                remove = 0;
             } else {
                remove -= newStays[i].nights;
                newStays.splice(i, 1);
             }
          }
       }

       return {
        ...prev,
        durationDays: safeDuration,
        hotelStays: newStays,
        bikeDailyRentalCosts: resizeArray(prev.bikeDailyRentalCosts, safeDuration, 30),
        vanDailyRentalCosts: resizeArray(prev.vanDailyRentalCosts, safeDuration, 160),
        fuelDailyCosts: resizeArray(prev.fuelDailyCosts, safeDuration, 40),
        staffDailyLunchCosts: resizeArray(prev.staffDailyLunchCosts, safeDuration, 25),
        staffDailyAccommodationCosts: resizeArray(prev.staffDailyAccommodationCosts, safeDuration, 90),
        guide: {
          ...prev.guide,
          dailyRates: resizeArray(prev.guide.dailyRates, safeDuration, 150)
        },
        driver: {
          ...prev.driver,
          dailyRates: resizeArray(prev.driver.dailyRates, safeDuration, 120)
        },
      };
    });
  };

  const handleExtraDaysChange = (
    role: 'guide' | 'driver', 
    type: 'before' | 'after', 
    days: number
  ) => {
    const safeDays = Math.max(0, days);
    
    setParams(prev => {
      const newParams = { ...prev };
      
      if (role === 'guide') {
        newParams.guide = { ...prev.guide };
        if (type === 'before') {
          newParams.guide.extraDaysBefore = safeDays;
          newParams.guide.dailyRatesBefore = resizeArray(prev.guide.dailyRatesBefore, safeDays, 150);
        } else {
          newParams.guide.extraDaysAfter = safeDays;
          newParams.guide.dailyRatesAfter = resizeArray(prev.guide.dailyRatesAfter, safeDays, 150);
        }
      } else { 
        newParams.driver = { ...prev.driver };
        if (type === 'before') {
          newParams.driver.extraDaysBefore = safeDays;
          newParams.driver.dailyRatesBefore = resizeArray(prev.driver.dailyRatesBefore, safeDays, 120);
          newParams.vanDailyRentalCostsBefore = resizeArray(prev.vanDailyRentalCostsBefore, safeDays, 160);
          newParams.fuelDailyCostsBefore = resizeArray(prev.fuelDailyCostsBefore, safeDays, 40);
        } else {
          newParams.driver.extraDaysAfter = safeDays;
          newParams.driver.dailyRatesAfter = resizeArray(prev.driver.dailyRatesAfter, safeDays, 120);
          newParams.vanDailyRentalCostsAfter = resizeArray(prev.vanDailyRentalCostsAfter, safeDays, 160);
          newParams.fuelDailyCostsAfter = resizeArray(prev.fuelDailyCostsAfter, safeDays, 40);
        }
      }

      const maxBefore = Math.max(newParams.guide.extraDaysBefore, newParams.driver.extraDaysBefore);
      const maxAfter = Math.max(newParams.guide.extraDaysAfter, newParams.driver.extraDaysAfter);

      newParams.staffDailyLunchCostsBefore = resizeArray(prev.staffDailyLunchCostsBefore, maxBefore, 25);
      newParams.staffDailyLunchCostsAfter = resizeArray(prev.staffDailyLunchCostsAfter, maxAfter, 25);
      
      newParams.staffDailyAccommodationCostsBefore = resizeArray(prev.staffDailyAccommodationCostsBefore, maxBefore, 90);
      newParams.staffDailyAccommodationCostsAfter = resizeArray(prev.staffDailyAccommodationCostsAfter, maxAfter, 90);

      return newParams;
    });
  };

  const costs = useMemo((): CostBreakdown => {
    // Hotel cost calculated from Stays
    const totalHotelCostPerPerson = params.hotelStays.reduce((acc, stay) => acc + (stay.nights * stay.costPerNight), 0);
    
    // 1. Guide Costs
    let guideFees = 0;
    let guideAccommodation = 0;
    let guideLunch = 0;
    
    if (params.hasGuide) {
      guideFees = getSum(params.guide.dailyRatesBefore) + getSum(params.guide.dailyRates) + getSum(params.guide.dailyRatesAfter);
      
      const accBefore = params.staffDailyAccommodationCostsBefore.slice(0, params.guide.extraDaysBefore).reduce((a, b) => a + b, 0);
      const accDuring = getSum(params.staffDailyAccommodationCosts);
      const accAfter = params.staffDailyAccommodationCostsAfter.slice(0, params.guide.extraDaysAfter).reduce((a, b) => a + b, 0);
      guideAccommodation = accBefore + accDuring + accAfter;

      const lunchBefore = params.staffDailyLunchCostsBefore.slice(0, params.guide.extraDaysBefore).reduce((a, b) => a + b, 0);
      const lunchDuring = getSum(params.staffDailyLunchCosts);
      const lunchAfter = params.staffDailyLunchCostsAfter.slice(0, params.guide.extraDaysAfter).reduce((a, b) => a + b, 0);
      guideLunch = lunchBefore + lunchDuring + lunchAfter;
    }
    const guideTravel = params.hasGuide ? params.guide.travelCost : 0;

    // 2. Driver Costs
    let driverFees = 0;
    let driverAccommodation = 0;
    let driverLunch = 0;

    if (params.hasDriver) {
      driverFees = getSum(params.driver.dailyRatesBefore) + getSum(params.driver.dailyRates) + getSum(params.driver.dailyRatesAfter);
      
      const accBefore = params.staffDailyAccommodationCostsBefore.slice(0, params.driver.extraDaysBefore).reduce((a, b) => a + b, 0);
      const accDuring = getSum(params.staffDailyAccommodationCosts);
      const accAfter = params.staffDailyAccommodationCostsAfter.slice(0, params.driver.extraDaysAfter).reduce((a, b) => a + b, 0);
      driverAccommodation = accBefore + accDuring + accAfter;

      const lunchBefore = params.staffDailyLunchCostsBefore.slice(0, params.driver.extraDaysBefore).reduce((a, b) => a + b, 0);
      const lunchDuring = getSum(params.staffDailyLunchCosts);
      const lunchAfter = params.staffDailyLunchCostsAfter.slice(0, params.driver.extraDaysAfter).reduce((a, b) => a + b, 0);
      driverLunch = lunchBefore + lunchDuring + lunchAfter;
    }
    const driverTravel = params.hasDriver ? params.driver.travelCost : 0;

    // 3. Vehicle Costs
    let vanRentalTotal = 0;
    let fuelTotal = 0;

    if (params.hasDriver) { 
        vanRentalTotal = getSum(params.vanDailyRentalCostsBefore) + getSum(params.vanDailyRentalCosts) + getSum(params.vanDailyRentalCostsAfter);
        fuelTotal = getSum(params.fuelDailyCostsBefore) + getSum(params.fuelDailyCosts) + getSum(params.fuelDailyCostsAfter);
    }

    // 4. Totals
    const staffFeesTotal = guideFees + driverFees;
    const staffTravelTotal = guideTravel + driverTravel;
    const staffAccTotal = guideAccommodation + driverAccommodation;
    const staffLunchTotal = guideLunch + driverLunch;
    
    const fixedTotal = 
      staffFeesTotal + 
      staffTravelTotal + 
      staffAccTotal + 
      staffLunchTotal +
      vanRentalTotal +
      fuelTotal;

    const totalBikeCostPerPerson = getSum(params.bikeDailyRentalCosts);
    const clientAccTotal = totalHotelCostPerPerson * params.participants;
    const clientBikeTotal = totalBikeCostPerPerson * params.participants;
    
    const variableTotal = clientAccTotal + clientBikeTotal;

    const totalCost = fixedTotal + variableTotal;
    const costPerPerson = totalCost / (params.participants || 1);
    
    const multiplier = 1 + (params.profitMarginPercent / 100);
    const suggestedPricePerPerson = costPerPerson * multiplier;
    const totalRevenue = suggestedPricePerPerson * params.participants;
    const totalProfit = totalRevenue - totalCost;

    const variableCostPerPax = totalHotelCostPerPerson + totalBikeCostPerPerson;
    const contributionMargin = suggestedPricePerPerson - variableCostPerPax;
    
    let breakEvenParticipants = 0;
    let isBreakEvenImpossible = false;

    if (contributionMargin <= 0) {
      isBreakEvenImpossible = true;
      breakEvenParticipants = Infinity; 
    } else {
      breakEvenParticipants = Math.ceil(fixedTotal / contributionMargin);
    }

    return {
      fixedCosts: {
        staffFees: staffFeesTotal,
        staffTravel: staffTravelTotal,
        staffAccommodation: staffAccTotal,
        staffLunch: staffLunchTotal,
        vanRental: vanRentalTotal,
        fuel: fuelTotal,
        total: fixedTotal
      },
      variableCosts: {
        clientAccommodation: clientAccTotal,
        clientBike: clientBikeTotal,
        total: variableTotal
      },
      totalCost,
      costPerPerson,
      suggestedPricePerPerson,
      totalRevenue,
      totalProfit,
      breakEvenParticipants,
      isBreakEvenImpossible
    };
  }, [params]);

  const handleGenerateProposal = async () => {
    setIsAiLoading(true);
    setActiveTab('proposal');
    const text = await generateTripProposal(params, costs);
    setAiContent(text);
    setIsAiLoading(false);
  };

  const handleAnalyzeCosts = async () => {
    setIsAiLoading(true);
    setActiveTab('proposal');
    const text = await analyzeCostsAI(costs);
    setAiContent(text);
    setIsAiLoading(false);
  };

  const handleSaveTrip = () => {
    const newTrip: SavedTrip = {
      id: Date.now().toString(),
      name: params.tripName || "Viaggio Senza Nome",
      date: new Date().toLocaleDateString(),
      params: params
    };
    const updated = [newTrip, ...savedTrips];
    setSavedTrips(updated);
    localStorage.setItem('tourCalc_saves', JSON.stringify(updated));
    alert('Viaggio salvato con successo!');
  };

  const handleLoadTrip = (saved: SavedTrip) => {
    setParams(saved.params);
    setShowSavesModal(false);
  };

  const handleDeleteTrip = (id: string) => {
    const updated = savedTrips.filter(t => t.id !== id);
    setSavedTrips(updated);
    localStorage.setItem('tourCalc_saves', JSON.stringify(updated));
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const dataStr = JSON.stringify(savedTrips, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `tourcalc_backup_${new Date().toISOString().slice(0,10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import JSON Backup
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    
    if (files && files.length > 0) {
      fileReader.readAsText(files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            // Basic validation check
            if (parsed.length > 0 && !parsed[0].params) {
              throw new Error("Formato non valido");
            }
            if (window.confirm(`Trovati ${parsed.length} viaggi nel backup. Vuoi sovrascrivere i salvataggi esistenti? (Clicca Annulla per unire)`)) {
               setSavedTrips(parsed);
               localStorage.setItem('tourCalc_saves', JSON.stringify(parsed));
            } else {
               const merged = [...parsed, ...savedTrips];
               // remove duplicates by ID
               const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
               setSavedTrips(unique);
               localStorage.setItem('tourCalc_saves', JSON.stringify(unique));
            }
            alert("Importazione completata!");
          } else {
             alert("Il file non contiene una lista valida di viaggi.");
          }
        } catch (error) {
           console.error(error);
           alert("Errore nella lettura del file backup.");
        }
      };
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ["RIEPILOGO VIAGGIO", ""],
      ["Nome Viaggio", params.tripName],
      ["Partecipanti", params.participants],
      ["Durata", params.durationDays],
      [""],
      ["DETTAGLIO HOTEL", "NOTTI", "COSTO/NOTTE", "TOTALE"],
      ...params.hotelStays.map(h => [h.name, h.nights, h.costPerNight.toFixed(2), (h.nights * h.costPerNight).toFixed(2)]),
      [""],
      ["COSTI FISSI", "IMPORTO"],
      ["Compensi Staff", costs.fixedCosts.staffFees.toFixed(2)],
      ["Viaggi Staff", costs.fixedCosts.staffTravel.toFixed(2)],
      ["Alloggio Staff", costs.fixedCosts.staffAccommodation.toFixed(2)],
      ["Pasti Staff", costs.fixedCosts.staffLunch.toFixed(2)],
      ["Noleggio Van", costs.fixedCosts.vanRental.toFixed(2)],
      ["Carburante", costs.fixedCosts.fuel.toFixed(2)],
      ["TOTALE COSTI FISSI", costs.fixedCosts.total.toFixed(2)],
      [""],
      ["COSTI VARIABILI", "IMPORTO"],
      ["Alloggio Clienti", costs.variableCosts.clientAccommodation.toFixed(2)],
      ["Noleggio Bici", costs.variableCosts.clientBike.toFixed(2)],
      ["TOTALE COSTI VARIABILI", costs.variableCosts.total.toFixed(2)],
      [""],
      ["RISULTATI ECONOMICI", ""],
      ["Costo Totale", costs.totalCost.toFixed(2)],
      ["Costo per Persona", costs.costPerPerson.toFixed(2)],
      ["Margine (%)", params.profitMarginPercent],
      ["PREZZO VENDITA SUGGERITO", costs.suggestedPricePerPerson.toFixed(2)],
      ["Profitto Totale", costs.totalProfit.toFixed(2)],
      ["Break Even Point (Pax)", costs.isBreakEvenImpossible ? "IMPOSSIBILE" : costs.breakEvenParticipants]
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${params.tripName.replace(/\s+/g, '_')}_preventivo.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(124, 58, 237); // Brand purple
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Preventivo Viaggio - TourCalc Pro", 14, 13);
    
    // Info Viaggio
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Viaggio: ${params.tripName}`, 14, 35);
    doc.setFontSize(10);
    doc.text(`Partecipanti: ${params.participants} | Durata: ${params.durationDays} giorni`, 14, 42);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 48);

    // Tabella Hotel
    autoTable(doc, {
      startY: 55,
      head: [['Hotel', 'Notti', 'Costo/Notte', 'Totale (p.p.)']],
      body: params.hotelStays.map(h => [
        h.name,
        h.nights,
        `€${h.costPerNight.toFixed(2)}`,
        `€${(h.nights * h.costPerNight).toFixed(2)}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [109, 40, 217] }, // brand-700
      styles: { fontSize: 9 }
    });

    // Tabella Costi
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY || 60;
    
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Voce di Costo', 'Importo Totale']],
      body: [
        [{ content: 'COSTI FISSI', styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }, ''],
        ['Staff (Compensi)', `€${costs.fixedCosts.staffFees.toFixed(2)}`],
        ['Staff (Viaggi)', `€${costs.fixedCosts.staffTravel.toFixed(2)}`],
        ['Staff (Vitto/Alloggio)', `€${(costs.fixedCosts.staffAccommodation + costs.fixedCosts.staffLunch).toFixed(2)}`],
        ['Van & Carburante', `€${(costs.fixedCosts.vanRental + costs.fixedCosts.fuel).toFixed(2)}`],
        [{ content: 'Totale Costi Fissi', styles: { fontStyle: 'bold' } }, `€${costs.fixedCosts.total.toFixed(2)}`],
        
        [{ content: 'COSTI VARIABILI', styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }, ''],
        ['Alloggio Clienti', `€${costs.variableCosts.clientAccommodation.toFixed(2)}`],
        ['Noleggio Bici', `€${costs.variableCosts.clientBike.toFixed(2)}`],
        [{ content: 'Totale Costi Variabili', styles: { fontStyle: 'bold' } }, `€${costs.variableCosts.total.toFixed(2)}`],
        
        [{ content: 'TOTALE GENERALE', styles: { fontStyle: 'bold', fontSize: 10 } }, { content: `€${costs.totalCost.toFixed(2)}`, styles: { fontStyle: 'bold' } }],
      ],
      theme: 'grid',
      headStyles: { fillColor: [109, 40, 217] },
      styles: { fontSize: 9 }
    });

    // Summary Box
    // @ts-ignore
    const summaryY = doc.lastAutoTable.finalY + 15;
    
    doc.setFillColor(245, 243, 255); // brand-50
    doc.setDrawColor(124, 58, 237);
    doc.roundedRect(14, summaryY, 180, 40, 3, 3, 'FD');
    
    doc.setFontSize(11);
    doc.setTextColor(109, 40, 217);
    doc.text("PREZZO DI VENDITA SUGGERITO", 105, summaryY + 10, { align: 'center' });
    
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(`€${costs.suggestedPricePerPerson.toFixed(0)}`, 105, summaryY + 22, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("per persona", 105, summaryY + 30, { align: 'center' });

    // Break Even
    doc.setFontSize(9);
    doc.text(`Minimo Partecipanti (Break-Even): ${costs.isBreakEvenImpossible ? 'IMPOSSIBILE' : costs.breakEvenParticipants}`, 14, summaryY + 50);

    doc.save(`${params.tripName.replace(/\s+/g, '_')}_preventivo.pdf`);
  };

  const handleDownloadSource = async () => {
    const zip = new JSZip();
    
    // Create the structure
    zip.file("README.md", "# TourCalc Pro\n\nApplicazione React per calcolo preventivi viaggi.\n\n## Setup\n\n1. `npm install`\n2. `npm run dev`");
    
    // Since we are in a browser environment without file system access to other modules,
    // we must manually reconstruct the critical files for the user to download a working copy.
    // This assumes the file content provided in the context is current.

    const indexHtmlContent = `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TourCalc Pro</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
          },
          extend: {
            colors: {
              brand: {
                50: '#f5f3ff',
                100: '#ede9fe',
                200: '#ddd6fe',
                300: '#c4b5fd',
                400: '#a78bfa',
                500: '#8b5cf6',
                600: '#7c3aed',
                700: '#6d28d9',
                800: '#5b21b6',
                900: '#4c1d95',
              },
              accent: {
                500: '#f43f5e',
                600: '#e11d48',
              }
            },
            boxShadow: {
              'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
              'glow': '0 0 15px rgba(139, 92, 246, 0.3)',
            }
          }
        }
      }
    </script>
  </head>
  <body class="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-brand-200 selection:text-brand-900">
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>`;

    // Package.json mock
    const packageJsonContent = `{
  "name": "tourcalc-pro",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.344.0",
    "recharts": "^2.12.0",
    "react-markdown": "^9.0.1",
    "@google/genai": "^0.1.1",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "jszip": "^3.10.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3"
  }
}`;

    const viteConfigContent = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`;

    // Add root files
    zip.file("index.html", indexHtmlContent);
    zip.file("package.json", packageJsonContent);
    zip.file("vite.config.ts", viteConfigContent);

    // Create src folder
    const src = zip.folder("src");
    if (src) {
        src.file("types.ts", `
export interface StaffConfig {
  dailyRates: number[]; 
  dailyRatesBefore: number[]; 
  dailyRatesAfter: number[]; 
  travelCost: number; 
  extraDaysBefore: number; 
  extraDaysAfter: number; 
}

export interface HotelStay {
  id: string;
  name: string;
  nights: number;
  costPerNight: number;
  paymentTerms: string;
  cancellationPolicy: string;
  dusSupplement: number;
}

export interface TripParams {
  tripName: string;
  participants: number;
  durationDays: number;
  profitMarginPercent: number;
  hasGuide: boolean;
  guide: StaffConfig;
  hasDriver: boolean;
  driver: StaffConfig;
  staffDailyLunchCosts: number[];
  staffDailyLunchCostsBefore: number[];
  staffDailyLunchCostsAfter: number[];
  staffDailyAccommodationCosts: number[]; 
  staffDailyAccommodationCostsBefore: number[];
  staffDailyAccommodationCostsAfter: number[];
  vanDailyRentalCosts: number[];
  vanDailyRentalCostsBefore: number[];
  vanDailyRentalCostsAfter: number[];
  fuelDailyCosts: number[];
  fuelDailyCostsBefore: number[];
  fuelDailyCostsAfter: number[];
  hotelStays: HotelStay[];
  bikeDailyRentalCosts: number[];
}

export interface CostBreakdown {
  fixedCosts: {
    staffFees: number;
    staffTravel: number;
    staffAccommodation: number;
    staffLunch: number;
    vanRental: number;
    fuel: number;
    total: number;
  };
  variableCosts: {
    clientAccommodation: number;
    clientBike: number;
    total: number;
  };
  totalCost: number;
  costPerPerson: number;
  suggestedPricePerPerson: number;
  totalRevenue: number;
  totalProfit: number;
  breakEvenParticipants: number; 
  isBreakEvenImpossible: boolean;
}`);

        // Note: For App.tsx, we can't self-reflect perfectly. 
        // In a real scenario, this would fetch the actual file content.
        // Here we put a placeholder encouraging the user to copy from editor if needed, 
        // OR we could try to put the current logic if we had it as a string constant.
        // To avoid duplication bloat, we will add a note.
        src.file("App.tsx", "// COPIA IL CODICE DAL TUO EDITOR AI STUDIO E INCOLLALO QUI.\n// (Il generatore automatico non può leggere il codice sorgente del componente App mentre è in esecuzione).");
        
        src.file("index.tsx", `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`);

        // Services
        const services = src.folder("services");
        services?.file("geminiService.ts", `import { GoogleGenAI } from "@google/genai";
import { TripParams, CostBreakdown } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

export const generateTripProposal = async (params: TripParams, costs: CostBreakdown): Promise<string> => {
  const prompt = \`Agisci come Tour Operator...\`; // (Simplified for brevity in zip)
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Impossibile generare.";
  } catch (error) { return "Errore."; }
};
export const analyzeCostsAI = async (costs: CostBreakdown): Promise<string> => { return "Analisi..."; };`);
        
        // Components
        const components = src.folder("components");
        components?.file("CostChart.tsx", `import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
// ... (Content of CostChart)
export const CostChart = ({ costs }: any) => <div>Chart Placeholder</div>;`);
        
        components?.file("InputSection.tsx", `import React from 'react';
// ... (Content of InputSection)
export const NumberInput = (props: any) => <input {...props} />;
export const Toggle = (props: any) => <button {...props} />;`);
    }

    const blob = await zip.generateAsync({type:"blob"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "TourCalcPro_Source.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Hotel Management Handlers
  const addHotelStay = () => {
    const currentTotalNights = params.hotelStays.reduce((sum, stay) => sum + stay.nights, 0);
    const remaining = Math.max(1, params.durationDays - currentTotalNights);
    const newStay: HotelStay = {
      id: Date.now().toString(),
      name: "Nuovo Hotel",
      nights: remaining,
      costPerNight: 90,
      paymentTerms: "",
      cancellationPolicy: "",
      dusSupplement: 0
    };
    setParams(p => ({...p, hotelStays: [...p.hotelStays, newStay]}));
  };

  const removeHotelStay = (id: string) => {
    setParams(p => ({...p, hotelStays: p.hotelStays.filter(s => s.id !== id)}));
  };

  const updateHotelStay = (id: string, field: keyof HotelStay, value: any) => {
    setParams(p => ({
      ...p,
      hotelStays: p.hotelStays.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const totalHotelNights = params.hotelStays.reduce((sum, stay) => sum + stay.nights, 0);
  const nightsMismatch = totalHotelNights !== params.durationDays;
  
  // Calculate day ranges for display
  let currentDayCounter = 1;

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-20">
      
      {/* Modal Salvataggi */}
      {showSavesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center">
                <FolderOpen className="w-5 h-5 mr-2.5 text-brand-600" />
                I Miei Viaggi
              </h3>
              <button onClick={() => setShowSavesModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full p-1 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Toolbar Backup */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between space-x-2">
               <button onClick={handleExportBackup} className="flex-1 flex items-center justify-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-brand-600 hover:border-brand-300 transition-colors">
                  <FileJson className="w-4 h-4 mr-2" /> Backup Dati
               </button>
               <label className="flex-1 flex items-center justify-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-brand-600 hover:border-brand-300 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" /> Ripristina
                  <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
               </label>
            </div>

            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              {savedTrips.length === 0 ? (
                <div className="text-center py-10">
                   <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                   <p className="text-slate-500">Nessun viaggio salvato.</p>
                </div>
              ) : (
                savedTrips.map(trip => (
                  <div key={trip.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all group">
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-brand-700 transition-colors">{trip.name}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" /> {trip.date} 
                        <span className="mx-2">•</span> 
                        <Users className="w-3 h-3 mr-1" /> {trip.params.participants} pax
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleLoadTrip(trip)}
                        className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Carica"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTrip(trip.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
               <span className="text-xs text-slate-500 hidden sm:inline">Salva la configurazione attuale.</span>
               <button
                  onClick={handleSaveTrip}
                  className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all transform hover:scale-[1.02]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salva Corrente
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-brand-700 to-indigo-800 text-white shadow-lg sticky top-0 z-20 backdrop-blur-md bg-opacity-90 supports-[backdrop-filter]:bg-opacity-80">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/20">
               <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TourCalc Pro</h1>
              <p className="text-[10px] text-brand-200 font-medium tracking-wider uppercase flex items-center">
                Professional Planning Tool
                {lastAutoSave && (
                  <span className="ml-2 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[9px] flex items-center border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse mr-1"></span>
                    Salvataggio Auto
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
             <button
              onClick={() => setShowSavesModal(true)}
              className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/10 backdrop-blur-sm whitespace-nowrap"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              I Miei Viaggi
            </button>
            <button
              onClick={handleDownloadSource}
              className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/10 backdrop-blur-sm whitespace-nowrap"
            >
              <Code className="h-4 w-4 mr-2" />
              Scarica Codice
            </button>
             <button
              onClick={handleAnalyzeCosts}
              disabled={isAiLoading}
              className="flex items-center px-4 py-2 bg-white text-brand-700 hover:bg-brand-50 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 border border-transparent shadow-lg whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4 mr-2 text-brand-600" />
              Analisi IA
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
         {/* Tabs */}
         <div className="flex space-x-1 bg-white p-1.5 rounded-2xl shadow-sm mb-8 w-fit mx-auto sm:mx-0 border border-slate-200">
            <button
               onClick={() => setActiveTab('calc')}
               className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center ${activeTab === 'calc' ? 'bg-brand-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
               <Calculator className="w-4 h-4 mr-2" /> Configurazione
            </button>
            <button
               onClick={() => setActiveTab('proposal')}
               className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center ${activeTab === 'proposal' ? 'bg-brand-600 shadow-md text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
               <TrendingUp className="w-4 h-4 mr-2" /> Risultati & IA
            </button>
         </div>

         {activeTab === 'calc' ? (
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-500 items-start">
              
              {/* Left Column: Input Data */}
              <div className="lg:col-span-7 space-y-6">
                 
                 {/* Section: Viaggio */}
                 <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center relative z-10"><Briefcase className="w-5 h-5 mr-2.5 text-brand-600"/> Dettagli Viaggio</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                       <div className="col-span-1 md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Nome Viaggio</label>
                          <input type="text" value={params.tripName} onChange={e => setParams({...params, tripName: e.target.value})} className="block w-full rounded-xl border-slate-200 bg-slate-50/50 py-3 px-4 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border shadow-sm transition-all focus:bg-white" placeholder="Es. Tour delle Dolomiti" />
                       </div>
                       <NumberInput label="Partecipanti" value={params.participants} onChange={v => setParams({...params, participants: v})} icon={Users} min={1} placeholder="8" />
                       <NumberInput label="Durata (Giorni)" value={params.durationDays} onChange={handleDurationChange} icon={Calendar} min={1} placeholder="7" />
                       <NumberInput label="Margine Profitto (%)" value={params.profitMarginPercent} onChange={v => setParams({...params, profitMarginPercent: v})} icon={TrendingUp} suffix="%" placeholder="25" />
                    </div>
                 </div>

                 {/* Section: Staff & Logistica */}
                 <SectionCard title="Staff e Logistica" icon={User} defaultOpen={true}>
                    {/* Guida */}
                    <div className="mb-8 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                      <Toggle label="Includi Guida Ciclistica" checked={params.hasGuide} onChange={v => setParams({...params, hasGuide: v})} />
                      
                      {params.hasGuide && (
                        <div className="mt-6 space-y-6 pl-4 border-l-2 border-brand-100 animate-in fade-in slide-in-from-left-2">
                          <div className="grid grid-cols-2 gap-4">
                             <NumberInput label="Volo/Viaggio Guida" value={params.guide.travelCost} onChange={v => setParams({...params, guide: {...params.guide, travelCost: v}})} icon={DollarSign} />
                             <div className="grid grid-cols-2 gap-2">
                                <NumberInput label="Giorni Prima" value={params.guide.extraDaysBefore} onChange={v => handleExtraDaysChange('guide', 'before', v)} icon={Clock} min={0} />
                                <NumberInput label="Giorni Dopo" value={params.guide.extraDaysAfter} onChange={v => handleExtraDaysChange('guide', 'after', v)} icon={Clock} min={0} />
                             </div>
                          </div>

                          <div className="space-y-4">
                             <DailyCostGrid 
                               label="Compenso Guida (Giorni Prima)"
                               values={params.guide.dailyRatesBefore}
                               onChange={(v) => setParams(p => ({...p, guide: {...p.guide, dailyRatesBefore: v}}))}
                               icon={User}
                               variant="before"
                             />
                             <DailyCostGrid 
                               label="Compenso Guida (Durante il Tour)"
                               values={params.guide.dailyRates}
                               onChange={(v) => setParams(p => ({...p, guide: {...p.guide, dailyRates: v}}))}
                               icon={User}
                             />
                             <DailyCostGrid 
                               label="Compenso Guida (Giorni Dopo)"
                               values={params.guide.dailyRatesAfter}
                               onChange={(v) => setParams(p => ({...p, guide: {...p.guide, dailyRatesAfter: v}}))}
                               icon={User}
                               variant="after"
                             />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Autista & Van */}
                    <div className="mb-6">
                      <Toggle label="Includi Autista e Van" checked={params.hasDriver} onChange={v => setParams({...params, hasDriver: v})} />
                      
                      {params.hasDriver && (
                        <div className="mt-6 space-y-6 pl-4 border-l-2 border-brand-100 animate-in fade-in slide-in-from-left-2">
                          <div className="grid grid-cols-2 gap-4">
                             <NumberInput label="Volo/Viaggio Autista" value={params.driver.travelCost} onChange={v => setParams({...params, driver: {...params.driver, travelCost: v}})} icon={User} />
                             <div className="grid grid-cols-2 gap-2">
                                <NumberInput label="Giorni Prima" value={params.driver.extraDaysBefore} onChange={v => handleExtraDaysChange('driver', 'before', v)} icon={Clock} min={0} />
                                <NumberInput label="Giorni Dopo" value={params.driver.extraDaysAfter} onChange={v => handleExtraDaysChange('driver', 'after', v)} icon={Clock} min={0} />
                             </div>
                          </div>

                          {/* Driver Fees */}
                          <div className="space-y-4">
                             <DailyCostGrid 
                               label="Compenso Autista (Prima)" values={params.driver.dailyRatesBefore} variant="before"
                               onChange={(v) => setParams(p => ({...p, driver: {...p.driver, dailyRatesBefore: v}}))}
                             />
                             <DailyCostGrid 
                               label="Compenso Autista (Durante)" values={params.driver.dailyRates}
                               onChange={(v) => setParams(p => ({...p, driver: {...p.driver, dailyRates: v}}))}
                             />
                             <DailyCostGrid 
                               label="Compenso Autista (Dopo)" values={params.driver.dailyRatesAfter} variant="after"
                               onChange={(v) => setParams(p => ({...p, driver: {...p.driver, dailyRatesAfter: v}}))}
                             />
                          </div>

                          {/* Van Rental */}
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                             <h3 className="text-sm font-bold text-slate-800 flex items-center"><Bus className="w-4 h-4 mr-2 text-brand-500"/> Costi Mezzo (Van)</h3>
                             <DailyCostGrid 
                               label="Noleggio Van (Prima)" values={params.vanDailyRentalCostsBefore} variant="before"
                               onChange={(v) => setParams(p => ({...p, vanDailyRentalCostsBefore: v}))}
                             />
                             <DailyCostGrid 
                               label="Noleggio Van (Durante)" values={params.vanDailyRentalCosts}
                               onChange={(v) => setParams(p => ({...p, vanDailyRentalCosts: v}))}
                             />
                             <DailyCostGrid 
                               label="Noleggio Van (Dopo)" values={params.vanDailyRentalCostsAfter} variant="after"
                               onChange={(v) => setParams(p => ({...p, vanDailyRentalCostsAfter: v}))}
                             />
                          </div>

                           {/* Fuel */}
                           <div className="space-y-4 pt-4 border-t border-slate-100">
                             <h3 className="text-sm font-bold text-slate-800 flex items-center"><Fuel className="w-4 h-4 mr-2 text-brand-500"/> Carburante</h3>
                             <DailyCostGrid 
                               label="Carburante (Prima)" values={params.fuelDailyCostsBefore} variant="before"
                               onChange={(v) => setParams(p => ({...p, fuelDailyCostsBefore: v}))}
                             />
                             <DailyCostGrid 
                               label="Carburante (Durante)" values={params.fuelDailyCosts}
                               onChange={(v) => setParams(p => ({...p, fuelDailyCosts: v}))}
                             />
                             <DailyCostGrid 
                               label="Carburante (Dopo)" values={params.fuelDailyCostsAfter} variant="after"
                               onChange={(v) => setParams(p => ({...p, fuelDailyCostsAfter: v}))}
                             />
                          </div>
                        </div>
                      )}
                    </div>
                 </SectionCard>
                 
                 {/* Section: Staff Accomodation & Meals */}
                 {(params.hasGuide || params.hasDriver) && (
                    <SectionCard title="Vitto e Alloggio Staff" icon={Utensils} defaultOpen={false}>
                       {/* Meals */}
                       <div className="space-y-4 mb-8">
                          <DailyCostGrid 
                             label="Pasti Staff (Prima)" values={params.staffDailyLunchCostsBefore} variant="before"
                             onChange={(v) => setParams(p => ({...p, staffDailyLunchCostsBefore: v}))}
                          />
                           <DailyCostGrid 
                             label="Pasti Staff (Durante - Totale per persona)" values={params.staffDailyLunchCosts}
                             onChange={(v) => setParams(p => ({...p, staffDailyLunchCosts: v}))}
                          />
                           <DailyCostGrid 
                             label="Pasti Staff (Dopo)" values={params.staffDailyLunchCostsAfter} variant="after"
                             onChange={(v) => setParams(p => ({...p, staffDailyLunchCostsAfter: v}))}
                          />
                       </div>

                        {/* Accommodation */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                           <h3 className="text-sm font-bold text-slate-800 flex items-center mb-4"><Hotel className="w-4 h-4 mr-2 text-brand-500"/> Alloggio Staff</h3>
                           <DailyCostGrid 
                             label="Hotel Staff (Prima)" values={params.staffDailyAccommodationCostsBefore} variant="before"
                             onChange={(v) => setParams(p => ({...p, staffDailyAccommodationCostsBefore: v}))}
                          />
                           <DailyCostGrid 
                             label="Hotel Staff (Durante)" values={params.staffDailyAccommodationCosts}
                             onChange={(v) => setParams(p => ({...p, staffDailyAccommodationCosts: v}))}
                          />
                           <DailyCostGrid 
                             label="Hotel Staff (Dopo)" values={params.staffDailyAccommodationCostsAfter} variant="after"
                             onChange={(v) => setParams(p => ({...p, staffDailyAccommodationCostsAfter: v}))}
                          />
                        </div>
                    </SectionCard>
                 )}

                 {/* Section: Costi Clienti */}
                 <SectionCard title="Costi Variabili (Clienti)" icon={Users} defaultOpen={true}>
                    
                    {/* Hotel Stays Management */}
                    <div className="mb-8">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center"><Hotel className="w-4 h-4 mr-2"/> Hotel & Soggiorni</h3>
                         <button onClick={addHotelStay} className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                            <Plus className="w-3 h-3 mr-1" /> Aggiungi Hotel
                         </button>
                       </div>
                       
                       <div className="space-y-3">
                         {params.hotelStays.map((stay, index) => {
                           const startDay = currentDayCounter;
                           const endDay = startDay + stay.nights - 1;
                           currentDayCounter += stay.nights;
                           
                           return (
                             <div key={stay.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative group animate-in slide-in-from-left-2 duration-300">
                                <div className="absolute top-2 right-2">
                                   <span className="text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                                      Giorno {startDay} - {endDay}
                                   </span>
                                </div>
                                
                                {/* Row 1: Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mt-2">
                                  <div className="md:col-span-5">
                                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Hotel / Tappa {index + 1}</label>
                                     <input 
                                       type="text" 
                                       value={stay.name} 
                                       onChange={(e) => updateHotelStay(stay.id, 'name', e.target.value)}
                                       placeholder="Nome Hotel"
                                       className="block w-full rounded-lg border-slate-200 text-sm focus:border-brand-500 focus:ring-brand-500"
                                     />
                                  </div>
                                  <div className="md:col-span-2">
                                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Notti</label>
                                     <input 
                                       type="number" 
                                       min={1}
                                       value={stay.nights} 
                                       onChange={(e) => updateHotelStay(stay.id, 'nights', parseInt(e.target.value) || 0)}
                                       className="block w-full rounded-lg border-slate-200 text-sm focus:border-brand-500 focus:ring-brand-500"
                                     />
                                  </div>
                                  <div className="md:col-span-2">
                                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Costo / Notte</label>
                                     <div className="relative">
                                       <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                         <span className="text-slate-400 text-xs">€</span>
                                       </div>
                                       <input 
                                         type="number" 
                                         min={0}
                                         value={stay.costPerNight} 
                                         onChange={(e) => updateHotelStay(stay.id, 'costPerNight', parseFloat(e.target.value) || 0)}
                                         className="block w-full rounded-lg border-slate-200 pl-6 text-sm focus:border-brand-500 focus:ring-brand-500"
                                       />
                                     </div>
                                  </div>
                                  <div className="md:col-span-2">
                                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Suppl. DUS</label>
                                     <div className="relative">
                                       <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                         <span className="text-slate-400 text-xs">€</span>
                                       </div>
                                       <input 
                                         type="number" 
                                         min={0}
                                         value={stay.dusSupplement || 0} 
                                         onChange={(e) => updateHotelStay(stay.id, 'dusSupplement', parseFloat(e.target.value) || 0)}
                                         className="block w-full rounded-lg border-slate-200 pl-6 text-sm focus:border-brand-500 focus:ring-brand-500"
                                       />
                                     </div>
                                  </div>
                                  <div className="md:col-span-1 flex justify-end pb-1.5">
                                     <button 
                                       onClick={() => removeHotelStay(stay.id)}
                                       disabled={params.hotelStays.length === 1}
                                       className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                                     >
                                        <Trash2 className="w-5 h-5" />
                                     </button>
                                  </div>
                                </div>

                                {/* Row 2: Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-100/50">
                                   <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center">
                                         <CreditCard className="w-3 h-3 mr-1" /> Condizioni Pagamento
                                      </label>
                                      <input 
                                       type="text" 
                                       value={stay.paymentTerms || ''} 
                                       onChange={(e) => updateHotelStay(stay.id, 'paymentTerms', e.target.value)}
                                       placeholder="Es. 30% acconto, saldo 30gg data arrivo"
                                       className="block w-full rounded-lg border-slate-200 bg-white/50 text-xs focus:border-brand-500 focus:ring-brand-500 py-2"
                                     />
                                   </div>
                                   <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center">
                                         <FileText className="w-3 h-3 mr-1" /> Policy Cancellazione
                                      </label>
                                      <input 
                                       type="text" 
                                       value={stay.cancellationPolicy || ''} 
                                       onChange={(e) => updateHotelStay(stay.id, 'cancellationPolicy', e.target.value)}
                                       placeholder="Es. Gratuita fino a 30gg, poi 100%"
                                       className="block w-full rounded-lg border-slate-200 bg-white/50 text-xs focus:border-brand-500 focus:ring-brand-500 py-2"
                                     />
                                   </div>
                                </div>
                             </div>
                           );
                         })}
                       </div>

                       {nightsMismatch && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start text-amber-700 text-xs">
                             <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                             <div>
                                <strong>Attenzione:</strong> Il totale delle notti ({totalHotelNights}) non corrisponde alla durata del viaggio ({params.durationDays}).
                                {totalHotelNights < params.durationDays ? ` Aggiungi ${params.durationDays - totalHotelNights} notti.` : ` Rimuovi ${totalHotelNights - params.durationDays} notti.`}
                             </div>
                          </div>
                       )}
                    </div>

                     <div className="mt-6 pt-6 border-t border-slate-100">
                        <DailyCostGrid 
                          label="Noleggio Bici" 
                          values={params.bikeDailyRentalCosts} 
                          onChange={(v) => setParams({...params, bikeDailyRentalCosts: v})}
                          icon={Bike}
                          helperText="Costo noleggio bici giornaliero per partecipante."
                        />
                     </div>
                 </SectionCard>
              </div>
              
              {/* Right Column: Results - Sticky */}
              <div className="lg:col-span-5 space-y-6 sticky top-24 h-fit">
                 
                 {/* Summary Card */}
                 <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500 rounded-full blur-[80px] opacity-20 -mr-16 -mt-16 group-hover:opacity-30 transition-opacity duration-700"></div>
                    <div className="relative z-10">
                       <h3 className="text-sm font-medium text-brand-200 uppercase tracking-wider mb-2">Prezzo Consigliato</h3>
                       <div className="text-5xl font-bold mb-1 tracking-tight">€{costs.suggestedPricePerPerson.toFixed(0)}</div>
                       <div className="text-sm text-slate-400 mb-8">per persona</div>

                       <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
                          <div>
                             <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Costo Vivo</div>
                             <div className="text-2xl font-semibold">€{costs.costPerPerson.toFixed(0)}</div>
                          </div>
                          <div>
                             <div className="text-xs text-brand-300 uppercase tracking-wide mb-1">Profitto</div>
                             <div className="text-2xl font-semibold text-brand-400">€{(costs.suggestedPricePerPerson - costs.costPerPerson).toFixed(0)}</div>
                          </div>
                       </div>
                       
                       <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center group/be">
                          <div>
                             <div className="text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center">
                               Break Even Point 
                               <div className="relative ml-2">
                                  <Info className="w-3.5 h-3.5 text-slate-500 cursor-help hover:text-white transition-colors" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover/be:opacity-100 group-hover/be:visible transition-all duration-200 pointer-events-none z-50 leading-relaxed border border-white/10">
                                    Numero minimo di partecipanti necessario per coprire tutti i costi fissi e variabili senza andare in perdita.
                                  </div>
                               </div>
                             </div>
                             {costs.isBreakEvenImpossible ? (
                                <div className="text-lg font-bold text-red-400 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/> Margine Negativo</div>
                             ) : (
                                <div className="text-2xl font-semibold text-white">{costs.breakEvenParticipants} <span className="text-sm font-normal text-slate-400">partecipanti</span></div>
                             )}
                          </div>
                          {costs.breakEvenParticipants > params.participants && !costs.isBreakEvenImpossible && (
                             <div className="text-xs text-amber-400 font-bold bg-amber-400/10 px-3 py-1.5 rounded-full border border-amber-400/20">
                                <AlertTriangle className="w-3 h-3 inline mr-1"/> Sotto Soglia
                             </div>
                          )}
                          {costs.breakEvenParticipants <= params.participants && !costs.isBreakEvenImpossible && (
                             <div className="text-xs text-emerald-400 font-bold bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
                                <CheckCircle2 className="w-3 h-3 inline mr-1"/> Sostenibile
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Charts & Details */}
                 <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-6">Distribuzione Costi</h3>
                    <CostChart costs={costs} />
                 </div>

                 {/* Detailed Table */}
                 <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                       <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dettaglio Costi</h3>
                       <div className="flex space-x-2">
                           <button onClick={handleExportCSV} className="text-slate-600 hover:text-brand-700 text-xs font-bold flex items-center bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                              <Download className="w-3 h-3 mr-1.5" /> CSV
                           </button>
                           <button onClick={handleExportPDF} className="text-white hover:text-white text-xs font-bold flex items-center bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                              <FileDown className="w-3 h-3 mr-1.5" /> PDF
                           </button>
                       </div>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                             <tr>
                                <th className="px-6 py-3">Voce</th>
                                <th className="px-6 py-3 text-right">Totale</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             <tr className="bg-slate-50/50"><td className="px-6 py-2 font-bold text-xs text-slate-400 uppercase pt-4">Costi Fissi</td><td></td></tr>
                             <tr><td className="px-6 py-3">Staff (Compensi)</td><td className="px-6 py-3 text-right font-medium">€{costs.fixedCosts.staffFees.toFixed(2)}</td></tr>
                             <tr><td className="px-6 py-3">Staff (Viaggi)</td><td className="px-6 py-3 text-right font-medium">€{costs.fixedCosts.staffTravel.toFixed(2)}</td></tr>
                             <tr><td className="px-6 py-3">Staff (Vitto/Alloggio)</td><td className="px-6 py-3 text-right font-medium">€{(costs.fixedCosts.staffAccommodation + costs.fixedCosts.staffLunch).toFixed(2)}</td></tr>
                             <tr><td className="px-6 py-3">Van & Carburante</td><td className="px-6 py-3 text-right font-medium">€{(costs.fixedCosts.vanRental + costs.fixedCosts.fuel).toFixed(2)}</td></tr>
                             
                             <tr className="bg-slate-50/50"><td className="px-6 py-2 font-bold text-xs text-slate-400 uppercase pt-4">Costi Variabili</td><td></td></tr>
                             <tr><td className="px-6 py-3">Alloggio Clienti</td><td className="px-6 py-3 text-right font-medium">€{costs.variableCosts.clientAccommodation.toFixed(2)}</td></tr>
                             <tr><td className="px-6 py-3">Noleggio Bici</td><td className="px-6 py-3 text-right font-medium">€{costs.variableCosts.clientBike.toFixed(2)}</td></tr>
                             
                             <tr className="bg-slate-50 text-slate-900 font-bold">
                                <td className="px-6 py-4">TOTALE VIAGGIO</td>
                                <td className="px-6 py-4 text-right">€{costs.totalCost.toFixed(2)}</td>
                             </tr>
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* AI Action Card */}
                 <div className="bg-gradient-to-r from-brand-50 to-indigo-50 rounded-2xl p-6 border border-brand-100">
                    <h3 className="text-brand-800 font-bold mb-2 flex items-center"><Sparkles className="w-4 h-4 mr-2"/> Assistente AI</h3>
                    <p className="text-sm text-brand-600/80 mb-4">Genera una proposta commerciale o analizza i costi.</p>
                    <button 
                       onClick={handleGenerateProposal}
                       disabled={isAiLoading}
                       className="w-full py-3 bg-white text-brand-600 font-bold rounded-xl shadow-sm border border-brand-200 hover:bg-brand-50 hover:border-brand-300 transition-all mb-3 flex items-center justify-center"
                    >
                       {isAiLoading ? 'Generazione...' : 'Genera Bozza Preventivo'}
                    </button>
                 </div>

              </div>
           </div>
         ) : (
           /* Tab: Proposal / AI Output */
           <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                 <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center">
                       <Sparkles className="w-5 h-5 mr-2 text-brand-500"/> Risultato Generato
                    </h2>
                    {aiContent && (
                       <button className="text-slate-500 hover:text-brand-600 transition-colors" onClick={() => navigator.clipboard.writeText(aiContent)}>
                          <span className="text-xs font-bold uppercase tracking-wider">Copia Testo</span>
                       </button>
                    )}
                 </div>
                 <div className="p-8 min-h-[400px]">
                    {isAiLoading ? (
                       <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mb-4"></div>
                          <p className="animate-pulse">L'IA sta elaborando i dati...</p>
                       </div>
                    ) : aiContent ? (
                       <div className="prose prose-slate max-w-none prose-headings:text-brand-800 prose-a:text-brand-600">
                          <ReactMarkdown>{aiContent}</ReactMarkdown>
                       </div>
                    ) : (
                       <div className="text-center py-20">
                          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                             <Sparkles className="w-8 h-8" />
                          </div>
                          <h3 className="text-slate-900 font-medium mb-2">Nessun contenuto generato</h3>
                          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">Usa i pulsanti nella dashboard per generare una proposta o un'analisi dei costi.</p>
                          <button onClick={() => setActiveTab('calc')} className="text-brand-600 font-bold hover:underline text-sm">Torna alla Configurazione</button>
                       </div>
                    )}
                 </div>
              </div>
           </div>
         )}

      </main>
    </div>
  );
};