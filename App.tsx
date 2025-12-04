import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Calendar, User, Bus, Truck, Hotel, Bike, DollarSign, 
  Calculator, Sparkles, TrendingUp, Briefcase, AlertTriangle, 
  Fuel, Utensils, Download, Save, FolderOpen, Trash2, X,
  ArrowRight, Info, CheckCircle2, AlertCircle, Clock, Plus, Minus,
  CreditCard, FileText, ChevronDown, ChevronUp, Copy, FileDown,
  Upload, FileJson
} from 'lucide-react';
import { TripParams, CostBreakdown, HotelStay } from './types';
import { NumberInput, Toggle } from './components/InputSection';
import { CostChart } from './components/CostChart';
import { generateTripProposal, analyzeCostsAI } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
       const currentStaysDuration = prev.hotelStays.reduce((acc, s) => acc + s.nights, 0);
       const diff = safeDuration - currentStaysDuration;
       
       let newStays = [...prev.hotelStays];
       if (newStays.length > 0) {
         const lastStay = newStays[newStays.length - 1];
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

       const finalTotal = newStays.reduce((acc, s) => acc + s.nights, 0);
       if (finalTotal < safeDuration) {
          newStays[newStays.length - 1].nights += (safeDuration - finalTotal);
       } else if (finalTotal > safeDuration) {
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
    const totalHotelCostPerPerson = params.hotelStays.reduce((acc, stay) => acc + (stay.nights * stay.costPerNight), 0);
    
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

    let vanRentalTotal = 0;
    let fuelTotal = 0;

    if (params.hasDriver) { 
        vanRentalTotal = getSum(params.vanDailyRentalCostsBefore) + getSum(params.vanDailyRentalCosts) + getSum(params.vanDailyRentalCostsAfter);
        fuelTotal = getSum(params.fuelDailyCostsBefore) + getSum(params.fuelDailyCosts) + getSum(params.fuelDailyCostsAfter);
    }

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

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(savedTrips, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `tourcalc_backup_${new Date().toISOString().slice(0,10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

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
            if (parsed.length > 0 && !parsed[0].params) {
              throw new Error("Formato non valido");
            }
            if (window.confirm(`Trovati ${parsed.length} viaggi nel backup. Vuoi sovrascrivere i salvataggi esistenti? (Clicca Annulla per unire)`)) {
               setSavedTrips(parsed);
               localStorage.setItem('tourCalc_saves', JSON.stringify(parsed));
            } else {
               const merged = [...parsed, ...savedTrips];
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
    // Explicit Tuple Type Definition for jsPDF to avoid TS Errors
    const primaryColor: [number, number, number] = [109, 40, 217]; // Brand 700
    const secondaryColor: [number, number, number] = [245, 243, 255]; // Brand 50

    // Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("TourCalc Pro", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Preventivo Dettagliato", 200, 15, { align: 'right' });
    
    // Info Viaggio Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(255, 255, 255);
    doc.rect(14, 30, 182, 25, 'FD'); 
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(params.tripName || "Viaggio Senza Nome", 18, 40);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 18, 48);
    doc.text(`Partecipanti: ${params.participants}`, 90, 48);
    doc.text(`Durata: ${params.durationDays} giorni`, 150, 48);

    let finalY = 60;

    // --- TABELLA 1: DETTAGLIO STAFF ---
    if (params.hasGuide || params.hasDriver) {
        const staffBody = [];
        
        if (params.hasGuide) {
            const guideFeeTotal = getSum(params.guide.dailyRatesBefore) + getSum(params.guide.dailyRates) + getSum(params.guide.dailyRatesAfter);
            staffBody.push(["Guida Ciclistica", 
                `Tour (${params.durationDays}gg) + Extra (${params.guide.extraDaysBefore + params.guide.extraDaysAfter}gg)`, 
                `€${guideFeeTotal.toFixed(2)}`
            ]);
            staffBody.push(["Viaggio Guida", "Volo/Trasferimento", `€${params.guide.travelCost.toFixed(2)}`]);
        }
        if (params.hasDriver) {
            const driverFeeTotal = getSum(params.driver.dailyRatesBefore) + getSum(params.driver.dailyRates) + getSum(params.driver.dailyRatesAfter);
            staffBody.push(["Autista", 
                `Tour (${params.durationDays}gg) + Extra (${params.driver.extraDaysBefore + params.driver.extraDaysAfter}gg)`, 
                `€${driverFeeTotal.toFixed(2)}`
            ]);
            staffBody.push(["Viaggio Autista", "Volo/Trasferimento", `€${params.driver.travelCost.toFixed(2)}`]);
        }

        autoTable(doc, {
            startY: finalY,
            head: [['Ruolo', 'Dettaglio Giorni/Servizio', 'Costo Totale']],
            body: staffBody,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255 },
            styles: { fontSize: 9 }
        });
        
        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 10;
    }

    // --- TABELLA 2: LOGISTICA & VITTO STAFF ---
    const logBody = [
        ["Noleggio Van", `Totale per ${(params.hasDriver ? params.durationDays + params.driver.extraDaysBefore + params.driver.extraDaysAfter : 0)} giorni`, `€${costs.fixedCosts.vanRental.toFixed(2)}`],
        ["Carburante", "Stima Totale", `€${costs.fixedCosts.fuel.toFixed(2)}`],
        ["Alloggio Staff", "Guida + Autista (Mezza Pensione)", `€${costs.fixedCosts.staffAccommodation.toFixed(2)}`],
        ["Pasti Staff", "Pranzi on tour", `€${costs.fixedCosts.staffLunch.toFixed(2)}`]
    ];

    autoTable(doc, {
        startY: finalY,
        head: [['Voce Logistica', 'Note', 'Costo']],
        body: logBody,
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], textColor: 255 }, // Violet-500
        styles: { fontSize: 9 }
    });
    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;

    // --- TABELLA 3: HOTEL CLIENTI ---
    const hotelBody = params.hotelStays.map(h => [
        h.name,
        `${h.nights} notti`,
        `€${h.costPerNight.toFixed(2)}`,
        `€${(h.nights * h.costPerNight * params.participants).toFixed(2)}`
    ]);

    doc.text("Dettaglio Hotel Clienti", 14, finalY - 2);
    autoTable(doc, {
        startY: finalY,
        head: [['Hotel', 'Durata', 'Costo/Notte (Pax)', 'Totale Gruppo']],
        body: hotelBody,
        theme: 'grid',
        headStyles: { fillColor: [244, 63, 94], textColor: 255 }, // Rose-500
        styles: { fontSize: 9 }
    });
    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 15;

    // --- TABELLA 4: RIEPILOGO FINALE ---
    // Check if we need new page
    if (finalY > 240) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFillColor(245, 243, 255); // Brand 50
    doc.setDrawColor(109, 40, 217); // Brand 700
    doc.rect(120, finalY, 80, 50, 'FD');

    doc.setFontSize(12);
    doc.setTextColor(109, 40, 217);
    doc.setFont("helvetica", "bold");
    doc.text("PREZZO CONSIGLIATO", 125, finalY + 10);
    
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(`€${costs.suggestedPricePerPerson.toFixed(0)}`, 125, finalY + 22);
    doc.setFontSize(10);
    doc.text("per persona", 125, finalY + 28);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Costo Vivo: €${costs.costPerPerson.toFixed(0)}`, 125, finalY + 38);
    doc.text(`Margine: €${(costs.suggestedPricePerPerson - costs.costPerPerson).toFixed(0)} (${params.profitMarginPercent}%)`, 125, finalY + 44);

    doc.save(`${params.tripName.replace(/\s+/g, '_')}_preventivo.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-brand-700 to-brand-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
              <Calculator className="w-6 h-6 text-brand-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TourCalc Pro</h1>
              <div className="flex items-center space-x-2 text-xs text-brand-200">
                <span className="opacity-80">PROFESSIONAL PLANNING TOOL</span>
                {lastAutoSave && (
                   <span className="flex items-center bg-white/10 px-1.5 py-0.5 rounded text-[10px] animate-pulse">
                     <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                     SALVATAGGIO AUTO
                   </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowSavesModal(true)}
              className="flex items-center px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-all"
            >
               <FolderOpen className="w-4 h-4 mr-2" /> I Miei Viaggi
            </button>
            <button 
              onClick={handleAnalyzeCosts}
              disabled={isAiLoading}
              className="hidden sm:flex items-center px-4 py-2 bg-white text-brand-700 hover:bg-brand-50 rounded-lg text-sm font-bold shadow-glow transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isAiLoading ? 'Analisi...' : 'Analisi IA'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs (Mobile only mainly) */}
        <div className="flex justify-center mb-8 bg-white p-1 rounded-xl shadow-sm border border-slate-100 w-fit mx-auto">
           <button
             onClick={() => setActiveTab('calc')}
             className={`flex items-center px-6 py-2 rounded-lg text-sm font-bold transition-all ${
               activeTab === 'calc' 
               ? 'bg-brand-600 text-white shadow-md' 
               : 'text-slate-500 hover:bg-slate-50'
             }`}
           >
             <FileText className="w-4 h-4 mr-2" /> Configurazione
           </button>
           <button
             onClick={() => handleGenerateProposal()}
             className={`flex items-center px-6 py-2 rounded-lg text-sm font-bold transition-all ${
               activeTab === 'proposal' 
               ? 'bg-brand-600 text-white shadow-md' 
               : 'text-slate-500 hover:bg-slate-50'
             }`}
           >
             <TrendingUp className="w-4 h-4 mr-2" /> Risultati & IA
           </button>
        </div>

        {activeTab === 'calc' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Inputs */}
          <div className="xl:col-span-7 space-y-6">
            
            {/* General Details */}
            <SectionCard title="Dettagli Viaggio" icon={Briefcase}>
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">NOME VIAGGIO</label>
                  <input 
                    type="text"
                    value={params.tripName} 
                    onChange={e => setParams({...params, tripName: e.target.value})}
                    className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-lg font-bold text-slate-800 p-3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <NumberInput label="Partecipanti" value={params.participants} onChange={v => setParams({...params, participants: v})} icon={Users} min={1} />
                  <NumberInput label="Durata (Giorni)" value={params.durationDays} onChange={handleDurationChange} icon={Calendar} min={1} />
                </div>
                <NumberInput 
                   label="Margine Profitto (%)" 
                   value={params.profitMarginPercent} 
                   onChange={v => setParams({...params, profitMarginPercent: v})} 
                   icon={TrendingUp}
                   suffix="%"
                />
              </div>
            </SectionCard>

            {/* Staff & Logistics */}
            <SectionCard title="Staff e Logistica" icon={User}>
              <div className="space-y-8">
                
                {/* Guide Section */}
                <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="font-bold text-indigo-900 flex items-center"><User className="w-4 h-4 mr-2"/> Guida Ciclistica</h3>
                     <Toggle label="Includi" checked={params.hasGuide} onChange={v => setParams({...params, hasGuide: v})} />
                  </div>
                  
                  {params.hasGuide && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <NumberInput label="Volo/Viaggio Guida" value={params.guide.travelCost} onChange={v => setParams({...params, guide: {...params.guide, travelCost: v}})} icon={DollarSign} />
                          <NumberInput label="Giorni Prima" value={params.guide.extraDaysBefore} onChange={v => handleExtraDaysChange('guide', 'before', v)} icon={Clock} />
                          <NumberInput label="Giorni Dopo" value={params.guide.extraDaysAfter} onChange={v => handleExtraDaysChange('guide', 'after', v)} icon={Clock} />
                       </div>

                       {params.guide.extraDaysBefore > 0 && (
                          <DailyCostGrid 
                            label="Compenso Guida (Giorni Prima)" 
                            values={params.guide.dailyRatesBefore} 
                            onChange={vals => setParams({...params, guide: {...params.guide, dailyRatesBefore: vals}})} 
                            variant="before"
                          />
                       )}

                       <DailyCostGrid 
                         label="Compenso Guida (Durante il Tour)" 
                         values={params.guide.dailyRates} 
                         onChange={vals => setParams({...params, guide: {...params.guide, dailyRates: vals}})} 
                         icon={User}
                       />

                       {params.guide.extraDaysAfter > 0 && (
                          <DailyCostGrid 
                            label="Compenso Guida (Giorni Dopo)" 
                            values={params.guide.dailyRatesAfter} 
                            onChange={vals => setParams({...params, guide: {...params.guide, dailyRatesAfter: vals}})} 
                            variant="after"
                          />
                       )}
                    </div>
                  )}
                </div>

                {/* Driver Section */}
                <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-indigo-900 flex items-center"><Truck className="w-4 h-4 mr-2"/> Autista e Van</h3>
                      <Toggle label="Includi" checked={params.hasDriver} onChange={v => setParams({...params, hasDriver: v})} />
                   </div>

                   {params.hasDriver && (
                     <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <NumberInput label="Volo/Viaggio Autista" value={params.driver.travelCost} onChange={v => setParams({...params, driver: {...params.driver, travelCost: v}})} icon={User} />
                          <NumberInput label="Giorni Prima" value={params.driver.extraDaysBefore} onChange={v => handleExtraDaysChange('driver', 'before', v)} icon={Clock} />
                          <NumberInput label="Giorni Dopo" value={params.driver.extraDaysAfter} onChange={v => handleExtraDaysChange('driver', 'after', v)} icon={Clock} />
                        </div>

                        {/* Driver Fees */}
                        {params.driver.extraDaysBefore > 0 && (
                           <DailyCostGrid label="Compenso Autista (Prima)" values={params.driver.dailyRatesBefore} onChange={vals => setParams({...params, driver: {...params.driver, dailyRatesBefore: vals}})} variant="before" />
                        )}
                        <DailyCostGrid label="Compenso Autista (Tour)" values={params.driver.dailyRates} onChange={vals => setParams({...params, driver: {...params.driver, dailyRates: vals}})} />
                        {params.driver.extraDaysAfter > 0 && (
                           <DailyCostGrid label="Compenso Autista (Dopo)" values={params.driver.dailyRatesAfter} onChange={vals => setParams({...params, driver: {...params.driver, dailyRatesAfter: vals}})} variant="after" />
                        )}

                        <div className="h-px bg-indigo-200/50 my-6"></div>

                        {/* Van Costs */}
                        {params.driver.extraDaysBefore > 0 && (
                           <DailyCostGrid label="Noleggio Van (Prima)" values={params.vanDailyRentalCostsBefore} onChange={vals => setParams({...params, vanDailyRentalCostsBefore: vals})} variant="before" icon={Bus} />
                        )}
                        <DailyCostGrid label="Noleggio Van (Tour)" values={params.vanDailyRentalCosts} onChange={vals => setParams({...params, vanDailyRentalCosts: vals})} icon={Bus} />
                        {params.driver.extraDaysAfter > 0 && (
                           <DailyCostGrid label="Noleggio Van (Dopo)" values={params.vanDailyRentalCostsAfter} onChange={vals => setParams({...params, vanDailyRentalCostsAfter: vals})} variant="after" icon={Bus} />
                        )}

                        {/* Fuel Costs */}
                        {params.driver.extraDaysBefore > 0 && (
                           <DailyCostGrid label="Carburante (Prima)" values={params.fuelDailyCostsBefore} onChange={vals => setParams({...params, fuelDailyCostsBefore: vals})} variant="before" icon={Fuel} />
                        )}
                        <DailyCostGrid label="Carburante (Tour)" values={params.fuelDailyCosts} onChange={vals => setParams({...params, fuelDailyCosts: vals})} icon={Fuel} />
                        {params.driver.extraDaysAfter > 0 && (
                           <DailyCostGrid label="Carburante (Dopo)" values={params.fuelDailyCostsAfter} onChange={vals => setParams({...params, fuelDailyCostsAfter: vals})} variant="after" icon={Fuel} />
                        )}
                     </div>
                   )}
                </div>

                {/* Shared Staff Logistics (Meals/Hotel) */}
                {(params.hasGuide || params.hasDriver) && (
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Hotel className="w-4 h-4 mr-2"/> Vitto e Alloggio Staff</h3>
                      
                      <div className="space-y-6">
                         {/* Accommodation */}
                         <div>
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Costo Alloggio Staff (Totale per persona)</p>
                            {(params.guide.extraDaysBefore > 0 || params.driver.extraDaysBefore > 0) && (
                               <DailyCostGrid label="Hotel Staff (Prima)" values={params.staffDailyAccommodationCostsBefore} onChange={vals => setParams({...params, staffDailyAccommodationCostsBefore: vals})} variant="before" />
                            )}
                            <DailyCostGrid label="Hotel Staff (Tour)" values={params.staffDailyAccommodationCosts} onChange={vals => setParams({...params, staffDailyAccommodationCosts: vals})} />
                            {(params.guide.extraDaysAfter > 0 || params.driver.extraDaysAfter > 0) && (
                               <DailyCostGrid label="Hotel Staff (Dopo)" values={params.staffDailyAccommodationCostsAfter} onChange={vals => setParams({...params, staffDailyAccommodationCostsAfter: vals})} variant="after" />
                            )}
                         </div>

                         {/* Meals */}
                         <div>
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Costo Pasti Staff (Totale per persona)</p>
                            {(params.guide.extraDaysBefore > 0 || params.driver.extraDaysBefore > 0) && (
                               <DailyCostGrid label="Pasti Staff (Prima)" values={params.staffDailyLunchCostsBefore} onChange={vals => setParams({...params, staffDailyLunchCostsBefore: vals})} variant="before" icon={Utensils} />
                            )}
                            <DailyCostGrid label="Pasti Staff (Tour)" values={params.staffDailyLunchCosts} onChange={vals => setParams({...params, staffDailyLunchCosts: vals})} icon={Utensils} />
                            {(params.guide.extraDaysAfter > 0 || params.driver.extraDaysAfter > 0) && (
                               <DailyCostGrid label="Pasti Staff (Dopo)" values={params.staffDailyLunchCostsAfter} onChange={vals => setParams({...params, staffDailyLunchCostsAfter: vals})} variant="after" icon={Utensils} />
                            )}
                         </div>
                      </div>
                   </div>
                )}

              </div>
            </SectionCard>

            {/* Client Costs */}
            <SectionCard title="Costi Clienti (Hotel & Bici)" icon={Hotel}>
               <div className="space-y-8">
                  
                  {/* HOTEL MANAGEMENT */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center"><Hotel className="w-4 h-4 mr-2"/> Hotel</h3>
                       <button 
                         onClick={() => {
                            const currentNights = params.hotelStays.reduce((acc, s) => acc + s.nights, 0);
                            if (currentNights < params.durationDays) {
                               const newItem: HotelStay = {
                                  id: Date.now().toString(),
                                  name: "Nuovo Hotel",
                                  nights: params.durationDays - currentNights,
                                  costPerNight: 90,
                                  paymentTerms: "",
                                  cancellationPolicy: "",
                                  dusSupplement: 0
                               };
                               setParams({...params, hotelStays: [...params.hotelStays, newItem]});
                            } else {
                               alert("Hai già coperto tutti i giorni del tour!");
                            }
                         }}
                         className="text-xs flex items-center bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg font-bold hover:bg-brand-100 transition-colors"
                       >
                         <Plus className="w-3 h-3 mr-1" /> Aggiungi Hotel
                       </button>
                     </div>

                     {params.hotelStays.map((stay, index) => {
                        // Calculate day range for display
                        let startDay = 1;
                        for (let i = 0; i < index; i++) startDay += params.hotelStays[i].nights;
                        let endDay = startDay + stay.nights - 1;

                        return (
                        <div key={stay.id} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 relative group animate-in fade-in zoom-in-95">
                           <div className="absolute top-4 right-4 flex space-x-2">
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded">
                                 G{startDay} - G{endDay}
                              </span>
                              {params.hotelStays.length > 1 && (
                                <button onClick={() => {
                                   const filtered = params.hotelStays.filter(h => h.id !== stay.id);
                                   setParams({...params, hotelStays: filtered});
                                }} className="text-rose-400 hover:text-rose-600">
                                   <X className="w-4 h-4" />
                                </button>
                              )}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                              <div>
                                 <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Hotel</label>
                                 <input 
                                    type="text" 
                                    value={stay.name}
                                    onChange={(e) => {
                                       const newStays = [...params.hotelStays];
                                       newStays[index].name = e.target.value;
                                       setParams({...params, hotelStays: newStays});
                                    }}
                                    className="w-full text-sm font-bold bg-white border-slate-200 rounded-lg"
                                 />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Notti</label>
                                    <input 
                                       type="number" 
                                       value={stay.nights}
                                       min={1}
                                       onChange={(e) => {
                                          const val = parseInt(e.target.value) || 1;
                                          const newStays = [...params.hotelStays];
                                          newStays[index].nights = val;
                                          setParams({...params, hotelStays: newStays});
                                       }}
                                       className="w-full text-sm bg-white border-slate-200 rounded-lg"
                                    />
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Costo/Notte</label>
                                    <div className="relative">
                                       <span className="absolute left-2 top-2 text-slate-400 text-xs">€</span>
                                       <input 
                                          type="number" 
                                          value={stay.costPerNight}
                                          onChange={(e) => {
                                             const val = parseFloat(e.target.value) || 0;
                                             const newStays = [...params.hotelStays];
                                             newStays[index].costPerNight = val;
                                             setParams({...params, hotelStays: newStays});
                                          }}
                                          className="w-full text-sm bg-white border-slate-200 rounded-lg pl-6"
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>
                           
                           {/* Details Collapse */}
                           <div className="mt-2 pt-2 border-t border-rose-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Pagamento</label>
                                 <input type="text" placeholder="es. 30% acconto" className="w-full text-xs bg-white/50 border-slate-200 rounded" 
                                    value={stay.paymentTerms}
                                    onChange={e => {
                                       const ns = [...params.hotelStays]; ns[index].paymentTerms = e.target.value; setParams({...params, hotelStays: ns});
                                    }}
                                 />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Cancellazione</label>
                                 <input type="text" placeholder="es. 15gg prima" className="w-full text-xs bg-white/50 border-slate-200 rounded"
                                    value={stay.cancellationPolicy}
                                    onChange={e => {
                                       const ns = [...params.hotelStays]; ns[index].cancellationPolicy = e.target.value; setParams({...params, hotelStays: ns});
                                    }}
                                 />
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase">Suppl. DUS</label>
                                 <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-slate-400 text-[10px]">€</span>
                                    <input type="number" className="w-full text-xs bg-white/50 border-slate-200 rounded pl-5"
                                       value={stay.dusSupplement}
                                       onChange={e => {
                                          const ns = [...params.hotelStays]; ns[index].dusSupplement = parseFloat(e.target.value)||0; setParams({...params, hotelStays: ns});
                                       }}
                                    />
                                 </div>
                              </div>
                           </div>
                        </div>
                     )})}
                     
                     {/* Total Check */}
                     <div className="flex justify-end">
                        {params.hotelStays.reduce((a,b)=>a+b.nights,0) !== params.durationDays && (
                           <span className="text-xs text-red-500 font-bold flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Totale notti hotel ({params.hotelStays.reduce((a,b)=>a+b.nights,0)}) diverso dalla durata ({params.durationDays})
                           </span>
                        )}
                     </div>
                  </div>

                  <div className="h-px bg-slate-200 my-6"></div>

                  {/* BIKES */}
                  <DailyCostGrid 
                     label="Noleggio Bici Clienti (Costo giornaliero)" 
                     values={params.bikeDailyRentalCosts} 
                     onChange={vals => setParams({...params, bikeDailyRentalCosts: vals})} 
                     icon={Bike}
                  />

               </div>
            </SectionCard>
          </div>

          {/* Right Column: Results - Sticky */}
          <div className="xl:col-span-5 space-y-6 sticky top-24">
            
            {/* Price Card */}
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2 group-hover:opacity-30 transition-opacity"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2 group-hover:opacity-30 transition-opacity"></div>
              
              <div className="relative z-10">
                <h3 className="text-brand-200 text-xs font-bold uppercase tracking-widest mb-1">Prezzo Consigliato</h3>
                <div className="flex items-baseline mb-6">
                  <span className="text-6xl font-black tracking-tighter">€{costs.suggestedPricePerPerson.toFixed(0)}</span>
                  <span className="ml-2 text-slate-400 font-medium">per persona</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Costo Vivo</span>
                      <span className="block text-xl font-bold">€{costs.costPerPerson.toFixed(0)}</span>
                   </div>
                   <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                      <span className="block text-[10px] text-brand-300 uppercase font-bold">Profitto</span>
                      <span className="block text-xl font-bold text-brand-300">€{costs.totalProfit.toFixed(0)}</span>
                   </div>
                </div>

                <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                   <div className="flex items-center group/tooltip relative">
                      <span className="text-xs font-medium text-slate-400 mr-2">BREAK EVEN POINT</span>
                      <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                         Il numero minimo di partecipanti per coprire i costi fissi (Guida, Van, Staff). Sotto questo numero, vai in perdita.
                      </div>
                   </div>
                   <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${costs.isBreakEvenImpossible || costs.breakEvenParticipants > params.participants ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                      {costs.isBreakEvenImpossible ? (
                        <span className="flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Impossibile</span>
                      ) : (
                        <span className="flex items-center">
                           <Users className="w-3 h-3 mr-1"/> 
                           <span className="text-lg mr-1">{costs.breakEvenParticipants}</span> partecipanti
                        </span>
                      )}
                   </div>
                </div>
              </div>
            </div>

            {/* Chart Card */}
            <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase mb-6">Distribuzione Costi</h3>
              <CostChart costs={costs} />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
               <button 
                 onClick={handleExportCSV}
                 className="flex items-center justify-center px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
               >
                 <Download className="w-4 h-4 mr-2" /> CSV
               </button>
               <button 
                 onClick={handleExportPDF}
                 className="flex items-center justify-center px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-500/30"
               >
                 <FileDown className="w-4 h-4 mr-2" /> PDF
               </button>
            </div>

          </div>
        </div>
        ) : (
          /* AI Proposal Tab */
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                   <div className="flex items-center">
                      <div className="bg-brand-100 p-2 rounded-lg mr-4">
                         <Sparkles className="w-6 h-6 text-brand-600" />
                      </div>
                      <div>
                         <h2 className="text-2xl font-bold text-slate-900">Assistente IA</h2>
                         <p className="text-slate-500">Genera contenuti intelligenti per il tuo viaggio</p>
                      </div>
                   </div>
                   <div className="flex space-x-2">
                      <button onClick={handleGenerateProposal} className="px-4 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-100">Genera Proposta</button>
                      <button onClick={handleAnalyzeCosts} className="px-4 py-2 bg-slate-50 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-100">Analizza Costi</button>
                   </div>
                </div>

                {isAiLoading ? (
                   <div className="py-20 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent mb-4"></div>
                      <p className="text-slate-500">L'IA sta elaborando i tuoi dati...</p>
                   </div>
                ) : (
                   <div className="prose prose-slate max-w-none">
                      <ReactMarkdown>{aiContent || "Seleziona un'azione per iniziare."}</ReactMarkdown>
                   </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Save/Load Modal */}
      {showSavesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-bold text-lg">I Miei Viaggi</h3>
                 <button onClick={() => setShowSavesModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-2 max-h-96 overflow-y-auto">
                 {savedTrips.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                       <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                       <p>Nessun viaggio salvato</p>
                    </div>
                 ) : (
                    <div className="space-y-1">
                       {savedTrips.map(trip => (
                          <div key={trip.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg group">
                             <div onClick={() => handleLoadTrip(trip)} className="cursor-pointer flex-grow">
                                <p className="font-bold text-slate-800">{trip.name}</p>
                                <p className="text-xs text-slate-500">{trip.date} • {trip.params.participants} pax</p>
                             </div>
                             <button onClick={() => handleDeleteTrip(trip.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
                 <button onClick={handleSaveTrip} className="flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700">
                    <Save className="w-4 h-4 mr-2" /> Salva Corrente
                 </button>
                 <div className="flex space-x-2">
                    <button onClick={handleExportBackup} className="flex-1 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100" title="Esporta Backup">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100" title="Importa Backup">
                        <Upload className="w-4 h-4" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportBackup} className="hidden" accept=".json" />
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};