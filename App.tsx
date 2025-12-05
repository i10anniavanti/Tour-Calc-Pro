import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Calendar, User, Bus, Truck, Hotel, Bike, DollarSign, 
  Calculator, Sparkles, TrendingUp, Briefcase, AlertTriangle, 
  Fuel, Utensils, Download, Save, FolderOpen, Trash2, X,
  ArrowRight, Info, CheckCircle2, AlertCircle, Clock, Plus, Minus,
  CreditCard, FileText, ChevronDown, ChevronUp, Copy, FileDown,
  Upload, FileJson, Cloud, CloudOff, RefreshCw, Map as MapIcon, Plane, ShieldCheck, Ticket, Landmark
} from 'lucide-react';
import { TripParams, CostBreakdown, HotelStay } from './types';
import { NumberInput, Toggle } from './components/InputSection';
import { CostChart } from './components/CostChart';
import { generateTripProposal, analyzeCostsAI } from './services/geminiService';
import { supabase, saveTripToCloud, getTripsFromCloud, deleteTripFromCloud, CloudTrip } from './services/supabaseClient';
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

const DEFAULT_DURATION = 0; // Impostato a 0 come richiesto

// Initial State - TUTTO A ZERO per permettere il calcolo incrementale
const initialParams: TripParams = {
  tripName: "Nuovo Tour",
  participants: 0, // Impostato a 0
  durationDays: DEFAULT_DURATION, // Impostato a 0
  profitMarginPercent: 0, // Impostato a 0
  
  // Costi Staff
  hasGuide: true,
  guide: {
    dailyRates: Array(DEFAULT_DURATION).fill(0),
    dailyRatesBefore: [],
    dailyRatesAfter: [],
    travelCost: 0,
    extraDaysBefore: 0,
    extraDaysAfter: 0,
  },
  guideBikeDailyCosts: Array(DEFAULT_DURATION).fill(0),

  hasDriver: true,
  driver: {
    dailyRates: Array(DEFAULT_DURATION).fill(0),
    dailyRatesBefore: [0],
    dailyRatesAfter: [0],
    travelCost: 0,
    extraDaysBefore: 1, 
    extraDaysAfter: 1, 
  },
  
  // Logistica Staff condivisa
  staffDailyLunchCosts: Array(DEFAULT_DURATION).fill(0),
  staffDailyLunchCostsBefore: [0],
  staffDailyLunchCostsAfter: [0],

  staffDailyAccommodationCosts: Array(DEFAULT_DURATION).fill(0),
  staffDailyAccommodationCostsBefore: [0],
  staffDailyAccommodationCostsAfter: [0],

  // Vehicle
  vanDailyRentalCosts: Array(DEFAULT_DURATION).fill(0),
  vanDailyRentalCostsBefore: [0],
  vanDailyRentalCostsAfter: [0],

  fuelDailyCosts: Array(DEFAULT_DURATION).fill(0),
  fuelDailyCostsBefore: [0],
  fuelDailyCostsAfter: [0],

  staffTollsCost: 0, // Pedaggi

  // Sviluppo
  scoutingCost: 0,

  // Client
  hotelStays: [
    { 
      id: '1', 
      name: 'Hotel Base', 
      nights: DEFAULT_DURATION, 
      costPerNight: 0,
      paymentTerms: "",
      cancellationPolicy: "",
      dusSupplement: 0
    }
  ],
  hasBikeRental: true,
  bikeDailyRentalCosts: Array(DEFAULT_DURATION).fill(0),
  clientDailyDinnerCosts: Array(DEFAULT_DURATION).fill(0),
  
  clientTotalTransferCost: 0, // TOTALE GRUPPO
  clientExperienceCost: 0,
  clientInsuranceCost: 0,

  // Commerciale
  bankingFeePercent: 0,
  agencyCommissionPercent: 0,
};

interface SavedTrip {
  id: string;
  name: string;
  date: string;
  params: TripParams;
  isCloud?: boolean; // Flag per distinguere la provenienza
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
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load trips logic
  const loadTrips = async () => {
    setIsSyncing(true);
    // 1. Load Local
    const localSaved = localStorage.getItem('tourCalc_saves');
    let localTrips: SavedTrip[] = [];
    if (localSaved) {
      try { localTrips = JSON.parse(localSaved); } catch (e) {}
    }

    // 2. Load Cloud (if available)
    if (supabase) {
      setIsCloudEnabled(true);
      const cloudData = await getTripsFromCloud();
      const cloudTrips: SavedTrip[] = cloudData.map(t => ({
        id: t.id,
        name: t.name,
        date: new Date(t.created_at).toLocaleDateString(),
        params: t.trip_data,
        isCloud: true
      }));
      setSavedTrips([...cloudTrips, ...localTrips.filter(l => !l.isCloud)]);
    } else {
      setSavedTrips(localTrips);
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    loadTrips();
    const autoSaved = localStorage.getItem('tourCalc_autosave');
    if (autoSaved) {
      try {
         const parsed = JSON.parse(autoSaved);
         if (parsed.tripName !== initialParams.tripName) {
             setParams(parsed);
         }
      } catch(e) {}
    }
  }, []);

  // Auto-save logic - 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
       localStorage.setItem('tourCalc_autosave', JSON.stringify(params));
       setLastAutoSave(new Date());
    }, 15000); 
    return () => clearInterval(interval);
  }, [params]);

  useEffect(() => {
     setUnsavedChanges(true);
  }, [params]);

  const handleDurationChange = (newDuration: number) => {
    const safeDuration = Math.max(0, newDuration); // Permette 0
    setParams(prev => {
       const currentStaysDuration = prev.hotelStays.reduce((acc, s) => acc + s.nights, 0);
       const diff = safeDuration - currentStaysDuration;
       
       let newStays = [...prev.hotelStays];
       if (newStays.length > 0) {
         const lastStay = newStays[newStays.length - 1];
         // Adjust nights of last stay or append
         if (diff > 0) {
             newStays[newStays.length - 1] = { ...lastStay, nights: lastStay.nights + diff };
         } else if (diff < 0) {
             // Logic to reduce nights... complex if 0, simplified:
             // Se riduciamo drasticamente, resettiamo a un default o accorciamo l'ultimo
             // Per semplicità se andiamo a 0, hotel stays resta ma con 0 notti
             let remove = Math.abs(diff);
             for (let i = newStays.length - 1; i >= 0 && remove > 0; i--) {
                if (newStays[i].nights > remove) {
                   newStays[i].nights -= remove;
                   remove = 0;
                } else {
                   remove -= newStays[i].nights;
                   newStays[i].nights = 0; // Or remove stay? Keeping struct safer
                }
             }
         }
       } else if (safeDuration > 0) {
         newStays = [{ 
             id: Date.now().toString(), 
             name: "Hotel Standard", 
             nights: safeDuration, 
             costPerNight: 0,
             paymentTerms: "",
             cancellationPolicy: "",
             dusSupplement: 0
         }];
       }

       return {
        ...prev,
        durationDays: safeDuration,
        hotelStays: newStays,
        bikeDailyRentalCosts: resizeArray(prev.bikeDailyRentalCosts, safeDuration, 0),
        clientDailyDinnerCosts: resizeArray(prev.clientDailyDinnerCosts, safeDuration, 0),
        vanDailyRentalCosts: resizeArray(prev.vanDailyRentalCosts, safeDuration, 0),
        fuelDailyCosts: resizeArray(prev.fuelDailyCosts, safeDuration, 0),
        staffDailyLunchCosts: resizeArray(prev.staffDailyLunchCosts, safeDuration, 0),
        staffDailyAccommodationCosts: resizeArray(prev.staffDailyAccommodationCosts, safeDuration, 0),
        guideBikeDailyCosts: resizeArray(prev.guideBikeDailyCosts, safeDuration, 0),
        guide: {
          ...prev.guide,
          dailyRates: resizeArray(prev.guide.dailyRates, safeDuration, 0)
        },
        driver: {
          ...prev.driver,
          dailyRates: resizeArray(prev.driver.dailyRates, safeDuration, 0)
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
          newParams.guide.dailyRatesBefore = resizeArray(prev.guide.dailyRatesBefore, safeDays, 0);
        } else {
          newParams.guide.extraDaysAfter = safeDays;
          newParams.guide.dailyRatesAfter = resizeArray(prev.guide.dailyRatesAfter, safeDays, 0);
        }
      } else { 
        newParams.driver = { ...prev.driver };
        if (type === 'before') {
          newParams.driver.extraDaysBefore = safeDays;
          newParams.driver.dailyRatesBefore = resizeArray(prev.driver.dailyRatesBefore, safeDays, 0);
          newParams.vanDailyRentalCostsBefore = resizeArray(prev.vanDailyRentalCostsBefore, safeDays, 0);
          newParams.fuelDailyCostsBefore = resizeArray(prev.fuelDailyCostsBefore, safeDays, 0);
        } else {
          newParams.driver.extraDaysAfter = safeDays;
          newParams.driver.dailyRatesAfter = resizeArray(prev.driver.dailyRatesAfter, safeDays, 0);
          newParams.vanDailyRentalCostsAfter = resizeArray(prev.vanDailyRentalCostsAfter, safeDays, 0);
          newParams.fuelDailyCostsAfter = resizeArray(prev.fuelDailyCostsAfter, safeDays, 0);
        }
      }

      const maxBefore = Math.max(newParams.guide.extraDaysBefore, newParams.driver.extraDaysBefore);
      const maxAfter = Math.max(newParams.guide.extraDaysAfter, newParams.driver.extraDaysAfter);

      newParams.staffDailyLunchCostsBefore = resizeArray(prev.staffDailyLunchCostsBefore, maxBefore, 0);
      newParams.staffDailyLunchCostsAfter = resizeArray(prev.staffDailyLunchCostsAfter, maxAfter, 0);
      
      newParams.staffDailyAccommodationCostsBefore = resizeArray(prev.staffDailyAccommodationCostsBefore, maxBefore, 0);
      newParams.staffDailyAccommodationCostsAfter = resizeArray(prev.staffDailyAccommodationCostsAfter, maxAfter, 0);

      return newParams;
    });
  };

  const costs = useMemo((): CostBreakdown => {
    const totalHotelCostPerPerson = params.hotelStays.reduce((acc, stay) => acc + (stay.nights * stay.costPerNight), 0);
    
    let guideFees = 0;
    let guideAccommodation = 0;
    let guideLunch = 0;
    let guideBikeTotal = 0;
    
    if (params.hasGuide) {
      guideFees = getSum(params.guide.dailyRatesBefore) + getSum(params.guide.dailyRates) + getSum(params.guide.dailyRatesAfter);
      guideBikeTotal = getSum(params.guideBikeDailyCosts);
      
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
      fuelTotal +
      params.staffTollsCost +
      guideBikeTotal +
      params.scoutingCost;

    const totalBikeCostPerPerson = params.hasBikeRental ? getSum(params.bikeDailyRentalCosts) : 0;
    const totalDinnerCostPerPerson = getSum(params.clientDailyDinnerCosts);
    
    // Calcolo per pax (o 0 se 0 pax)
    const pax = params.participants || 1; // Evito divisione per 0 nei calcoli unitari
    const realPax = params.participants || 0;
    
    const clientAccTotal = totalHotelCostPerPerson * realPax;
    const clientBikeTotal = totalBikeCostPerPerson * realPax;
    const clientDinnerTotal = totalDinnerCostPerPerson * realPax;
    
    // Calcolo transfer basato sul totale inserito
    const clientTransferTotal = params.clientTotalTransferCost; 
    
    const clientExperienceTotal = params.clientExperienceCost * realPax;
    const clientInsuranceTotal = params.clientInsuranceCost * realPax;

    const variableTotal = clientAccTotal + clientBikeTotal + clientDinnerTotal + clientTransferTotal + clientExperienceTotal + clientInsuranceTotal;

    const totalCost = fixedTotal + variableTotal;
    const costPerPerson = realPax > 0 ? totalCost / realPax : 0;
    
    // Calcolo Prezzo con Commissioni
    // Prezzo = (Costi + Profitto) / (1 - %Commissioni)
    const marginMultiplier = 1 + (params.profitMarginPercent / 100);
    const targetNetPricePerPerson = costPerPerson * marginMultiplier;

    // Aggiungo le commissioni (Banca + Agenzia) che si calcolano sul PREZZO FINALE
    const totalCommissionPercent = (params.bankingFeePercent + params.agencyCommissionPercent) / 100;
    // Evito divisione per zero o negativo se commissioni >= 100%
    const safeDivisor = Math.max(0.01, 1 - totalCommissionPercent);
    const suggestedPricePerPerson = targetNetPricePerPerson / safeDivisor;

    const totalRevenue = suggestedPricePerPerson * realPax;
    
    // Calcolo costi commerciali
    const bankingFees = totalRevenue * (params.bankingFeePercent / 100);
    const agencyCommissions = totalRevenue * (params.agencyCommissionPercent / 100);
    const commercialCostsTotal = bankingFees + agencyCommissions;

    const totalProfit = totalRevenue - totalCost - commercialCostsTotal;

    // Costi variabili per singola persona (per calcolo margine contribuzione)
    const transferPerPax = clientTransferTotal / pax;
    const variableCostPerPax = totalHotelCostPerPerson + totalBikeCostPerPerson + totalDinnerCostPerPerson + transferPerPax + params.clientExperienceCost + params.clientInsuranceCost;
    
    // Margine di contribuzione unitario = Prezzo vendita - Costi Variabili Unitari - Commissioni Unitarie
    const commissionPerPax = suggestedPricePerPerson * totalCommissionPercent;
    const contributionMargin = suggestedPricePerPerson - variableCostPerPax - commissionPerPax;
    
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
        guideBike: guideBikeTotal,
        vanRental: vanRentalTotal,
        fuel: fuelTotal,
        tolls: params.staffTollsCost,
        scouting: params.scoutingCost,
        total: fixedTotal
      },
      variableCosts: {
        clientAccommodation: clientAccTotal,
        clientBike: clientBikeTotal,
        clientDinner: clientDinnerTotal,
        clientTransfer: clientTransferTotal,
        clientExperience: clientExperienceTotal,
        clientInsurance: clientInsuranceTotal,
        total: variableTotal
      },
      commercialCosts: {
        bankingFees,
        agencyCommissions,
        total: commercialCostsTotal
      },
      totalCost: totalCost + commercialCostsTotal, // Totale uscite reali
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

  const handleSaveTrip = async () => {
    setIsSyncing(true);
    try {
      if (isCloudEnabled) {
        await saveTripToCloud(params.tripName || "Viaggio Senza Nome", params);
      } else {
        const newTrip: SavedTrip = {
          id: Date.now().toString(),
          name: params.tripName || "Viaggio Senza Nome",
          date: new Date().toLocaleDateString(),
          params: params
        };
        const updated = [newTrip, ...savedTrips.filter(t => !t.isCloud)];
        setSavedTrips(updated);
        localStorage.setItem('tourCalc_saves', JSON.stringify(updated));
      }
      setUnsavedChanges(false);
      loadTrips();
    } catch (e: any) {
      console.error(e);
      // Estrai il messaggio di errore più significativo
      const msg = e.message || e.error_description || (e.details ? JSON.stringify(e.details) : JSON.stringify(e));
      alert(`Errore nel salvataggio: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadTrip = (saved: SavedTrip) => {
    setParams(saved.params);
    setShowSavesModal(false);
    setUnsavedChanges(false);
  };

  const handleDeleteTrip = async (id: string, isCloud?: boolean) => {
    // RIMOSSA window.confirm per evitare blocchi interfaccia
    setIsSyncing(true);
    try {
      if (isCloud && isCloudEnabled) {
        await deleteTripFromCloud(id);
      } else {
        const updated = savedTrips.filter(t => t.id !== id);
        setSavedTrips(updated);
        localStorage.setItem('tourCalc_saves', JSON.stringify(updated));
      }
      loadTrips();
    } catch (e: any) {
      console.error(e);
      alert("Errore cancellazione: " + (e.message || "Errore sconosciuto"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(savedTrips, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `tourcalc_backup_${new Date().toISOString().slice(0,10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    setUnsavedChanges(false);
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
            const currentLocal = savedTrips.filter(t => !t.isCloud);
            const merged = [...(parsed as SavedTrip[]), ...currentLocal];
            // Fix: uso Map nativo di JS per il filtro, non l'icona MapIcon
            const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
            setSavedTrips(unique as SavedTrip[]);
            localStorage.setItem('tourCalc_saves', JSON.stringify(unique));
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
      ["COSTI FISSI", "IMPORTO"],
      ["Compensi Staff", costs.fixedCosts.staffFees.toFixed(2)],
      ["Viaggi Staff", costs.fixedCosts.staffTravel.toFixed(2)],
      ["Alloggio Staff", costs.fixedCosts.staffAccommodation.toFixed(2)],
      ["Pasti Staff", costs.fixedCosts.staffLunch.toFixed(2)],
      ["Noleggio Van", costs.fixedCosts.vanRental.toFixed(2)],
      ["Carburante", costs.fixedCosts.fuel.toFixed(2)],
      ["Pedaggi", costs.fixedCosts.tolls.toFixed(2)],
      ["Bici Guida", costs.fixedCosts.guideBike.toFixed(2)],
      ["Sviluppo & Ricognizione", costs.fixedCosts.scouting.toFixed(2)],
      ["TOTALE COSTI FISSI", costs.fixedCosts.total.toFixed(2)],
      [""],
      ["COSTI VARIABILI", "IMPORTO"],
      ["Alloggio Clienti", costs.variableCosts.clientAccommodation.toFixed(2)],
      ["Noleggio Bici Clienti", costs.variableCosts.clientBike.toFixed(2)],
      ["Transfer A/R", costs.variableCosts.clientTransfer.toFixed(2)],
      ["Assicurazione", costs.variableCosts.clientInsurance.toFixed(2)],
      ["Esperienze/Visite", costs.variableCosts.clientExperience.toFixed(2)],
      ["Cene", costs.variableCosts.clientDinner.toFixed(2)],
      ["TOTALE COSTI VARIABILI", costs.variableCosts.total.toFixed(2)],
      [""],
      ["COSTI COMMERCIALI", "IMPORTO"],
      ["Commissioni Banca (3%)", costs.commercialCosts.bankingFees.toFixed(2)],
      ["Commissioni Agenzia", costs.commercialCosts.agencyCommissions.toFixed(2)],
      [""],
      ["RISULTATI ECONOMICI", ""],
      ["Costo Totale (Uscite)", costs.totalCost.toFixed(2)],
      ["Costo per Persona (Base)", costs.costPerPerson.toFixed(2)],
      ["Margine (%)", params.profitMarginPercent],
      ["PREZZO VENDITA SUGGERITO", costs.suggestedPricePerPerson.toFixed(2)],
      ["Profitto Netto Totale", costs.totalProfit.toFixed(2)],
      ["Break Even Point (Pax)", costs.isBreakEvenImpossible ? "IMPOSSIBILE" : costs.breakEvenParticipants]
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
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
    const primaryColor: [number, number, number] = [109, 40, 217];
    
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("TourCalc Pro", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Preventivo Dettagliato", 200, 15, { align: 'right' });
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(params.tripName || "Viaggio Senza Nome", 14, 35);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 42);
    doc.text(`Partecipanti: ${params.participants}`, 80, 42);
    doc.text(`Durata: ${params.durationDays} giorni`, 140, 42);

    let finalY = 55;

    // STAFF
    const staffBody = [];
    if (params.hasGuide) {
        staffBody.push(["Guida Ciclistica", `Fees + Viaggi + Bici`, `€${(costs.fixedCosts.staffFees/2 + costs.fixedCosts.staffTravel/2 + costs.fixedCosts.guideBike).toFixed(2)}`]);
    }
    if (params.hasDriver) {
        staffBody.push(["Autista", `Fees + Viaggi`, `€${(costs.fixedCosts.staffFees/2 + costs.fixedCosts.staffTravel/2).toFixed(2)}`]);
    }
    if (staffBody.length > 0) {
        autoTable(doc, {
            startY: finalY,
            head: [['Staff', 'Dettaglio', 'Costo']],
            body: staffBody,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255 },
            styles: { fontSize: 9 }
        });
        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 10;
    }

    // LOGISTICA
    const logBody = [
        ["Noleggio Van", `Totale`, `€${costs.fixedCosts.vanRental.toFixed(2)}`],
        ["Carburante & Pedaggi", `Stima Totale`, `€${(costs.fixedCosts.fuel + costs.fixedCosts.tolls).toFixed(2)}`],
        ["Vitto e Alloggio Staff", `Hotel + Pasti`, `€${(costs.fixedCosts.staffAccommodation + costs.fixedCosts.staffLunch).toFixed(2)}`],
        ["Sviluppo", `Ricognizione`, `€${costs.fixedCosts.scouting.toFixed(2)}`]
    ];
    autoTable(doc, {
        startY: finalY,
        head: [['Logistica', 'Dettaglio', 'Costo']],
        body: logBody,
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], textColor: 255 }, 
        styles: { fontSize: 9 }
    });
    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;

    // CLIENTI
    const clientBody = [
        ["Hotel", "Totale Gruppo", `€${costs.variableCosts.clientAccommodation.toFixed(2)}`],
        ["Noleggio Bici", "Totale Gruppo", `€${costs.variableCosts.clientBike.toFixed(2)}`],
        ["Transfer A/R", "Totale Gruppo", `€${costs.variableCosts.clientTransfer.toFixed(2)}`],
        ["Cene", "Totale Gruppo", `€${costs.variableCosts.clientDinner.toFixed(2)}`],
        ["Assicurazione & Extra", "Totale Gruppo", `€${(costs.variableCosts.clientInsurance + costs.variableCosts.clientExperience).toFixed(2)}`],
    ];
    autoTable(doc, {
        startY: finalY,
        head: [['Servizi Clienti', 'Note', 'Costo']],
        body: clientBody,
        theme: 'grid',
        headStyles: { fillColor: [244, 63, 94], textColor: 255 },
        styles: { fontSize: 9 }
    });
    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;

    // COMMERCIALI
    const commBody = [
        ["Commissioni Bancarie", `${params.bankingFeePercent}%`, `€${costs.commercialCosts.bankingFees.toFixed(2)}`],
        ["Commissioni Agenzia", `${params.agencyCommissionPercent}%`, `€${costs.commercialCosts.agencyCommissions.toFixed(2)}`],
    ];
    autoTable(doc, {
        startY: finalY,
        head: [['Commerciale', '%', 'Importo']],
        body: commBody,
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: 255 },
        styles: { fontSize: 9 }
    });
    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 15;

    // TOTALE
    doc.setFillColor(245, 243, 255); 
    doc.setDrawColor(109, 40, 217); 
    doc.rect(14, finalY, 182, 30, 'FD');
    doc.setFontSize(14);
    doc.setTextColor(109, 40, 217);
    doc.text(`PREZZO CONSIGLIATO: €${costs.suggestedPricePerPerson.toFixed(2)} pp`, 20, finalY + 12);
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Profitto Netto Totale: €${costs.totalProfit.toFixed(2)}`, 20, finalY + 22);

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
              <h1 className="text-xl font-bold tracking-tight">TourCalc Pro v2.10</h1>
              <div className="flex items-center space-x-2 text-xs text-brand-200">
                <span className="opacity-80">PROFESSIONAL PLANNING TOOL</span>
                {lastAutoSave && (
                   <span className="hidden sm:inline-block text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-brand-100">
                      Auto-save: {lastAutoSave.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                   </span>
                )}
                {isCloudEnabled ? (
                  <span className="flex items-center bg-green-500/20 px-1.5 py-0.5 rounded text-[10px] text-green-200 border border-green-500/30">
                    <span title="Cloud Active"><Cloud className="w-3 h-3 mr-1" /></span> CLOUD
                  </span>
                ) : (
                  <span className="flex items-center bg-slate-500/30 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                    <span title="Local Mode"><CloudOff className="w-3 h-3 mr-1" /></span> LOCAL
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             {unsavedChanges && (
                <span className="text-xs text-amber-300 animate-pulse font-medium hidden sm:inline-block">
                   ⚠ Unsaved
                </span>
             )}
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
            <button 
                 onClick={handleExportPDF}
                 className="flex items-center justify-center p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold transition-all shadow-lg shadow-rose-500/30"
                 title="Esporta PDF"
               >
                 <FileText className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
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
                  <NumberInput label="Partecipanti" value={params.participants} onChange={v => setParams({...params, participants: v})} icon={Users} min={0} />
                  <NumberInput label="Durata (Giorni)" value={params.durationDays} onChange={handleDurationChange} icon={Calendar} min={0} />
                </div>
                <NumberInput 
                   label="Margine Profitto (% su Costi)" 
                   value={params.profitMarginPercent} 
                   onChange={v => setParams({...params, profitMarginPercent: v})} 
                   icon={TrendingUp}
                   suffix="%"
                />
              </div>
            </SectionCard>

            {/* Commercial & Development */}
            <SectionCard title="Commerciale & Sviluppo" icon={Landmark}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <NumberInput 
                     label="Sviluppo & Scouting (Fisso)" 
                     value={params.scoutingCost} 
                     onChange={v => setParams({...params, scoutingCost: v})} 
                     icon={MapIcon}
                  />
                  <NumberInput 
                     label="Comm. Bancarie (%)" 
                     value={params.bankingFeePercent} 
                     onChange={v => setParams({...params, bankingFeePercent: v})} 
                     icon={CreditCard}
                     suffix="%"
                     placeholder="3"
                  />
                   <NumberInput 
                     label="Comm. Agenzia (%)" 
                     value={params.agencyCommissionPercent} 
                     onChange={v => setParams({...params, agencyCommissionPercent: v})} 
                     icon={Briefcase}
                     suffix="%"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Le commissioni percentuali vengono calcolate sul prezzo di vendita finale, riducendo il margine netto.</p>
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

                       <DailyCostGrid 
                         label="Compenso Guida (Durante il Tour)" 
                         values={params.guide.dailyRates} 
                         onChange={vals => setParams({...params, guide: {...params.guide, dailyRates: vals}})} 
                         icon={User}
                         helperText="Tariffe 90, 100, 110, 120 (+ 20% di ritenuta)"
                       />
                       
                       <div className="h-px bg-indigo-200/50 my-4"></div>

                        {/* Guide Bikes */}
                        <DailyCostGrid 
                          label="Noleggio Bici Guida (Giornaliero)" 
                          values={params.guideBikeDailyCosts} 
                          onChange={vals => setParams({...params, guideBikeDailyCosts: vals})} 
                          icon={Bike}
                        />
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
                        <DailyCostGrid label="Compenso Autista (Tour)" values={params.driver.dailyRates} onChange={vals => setParams({...params, driver: {...params.driver, dailyRates: vals}})} />
                        
                        <div className="h-px bg-indigo-200/50 my-6"></div>

                        {/* Van Costs */}
                        <DailyCostGrid label="Noleggio Van (Tour)" values={params.vanDailyRentalCosts} onChange={vals => setParams({...params, vanDailyRentalCosts: vals})} icon={Bus} />
                        
                        {/* Fuel Costs */}
                        <DailyCostGrid label="Carburante (Tour)" values={params.fuelDailyCosts} onChange={vals => setParams({...params, fuelDailyCosts: vals})} icon={Fuel} />
                        
                        <div className="mt-4">
                           <NumberInput 
                              label="Pedaggi Autostradali (Totale Stigamato)" 
                              value={params.staffTollsCost} 
                              onChange={v => setParams({...params, staffTollsCost: v})} 
                              icon={Truck}
                           />
                           <a href="https://www.viamichelin.it/" target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline flex items-center mt-1 ml-1">
                              Calcola su ViaMichelin <ArrowRight className="w-3 h-3 ml-1"/>
                           </a>
                        </div>
                     </div>
                   )}
                </div>

                {/* Shared Staff Logistics (Meals/Hotel) */}
                {(params.hasGuide || params.hasDriver) && (
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Hotel className="w-4 h-4 mr-2"/> Vitto e Alloggio Staff</h3>
                      
                      <div className="space-y-6">
                         <DailyCostGrid label="Hotel Staff (Tour)" values={params.staffDailyAccommodationCosts} onChange={vals => setParams({...params, staffDailyAccommodationCosts: vals})} />
                         <DailyCostGrid label="Pasti Staff (Tour)" values={params.staffDailyLunchCosts} onChange={vals => setParams({...params, staffDailyLunchCosts: vals})} icon={Utensils} />
                      </div>
                   </div>
                )}

              </div>
            </SectionCard>

             {/* CLIENT BIKE RENTAL CARD */}
             <SectionCard title="Noleggio Bici Gruppo" icon={Bike}>
                <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-orange-900 flex items-center"><Bike className="w-4 h-4 mr-2"/> Bici Partecipanti</h3>
                      <Toggle label="Includi nel prezzo" checked={params.hasBikeRental} onChange={v => setParams({...params, hasBikeRental: v})} />
                   </div>
                   
                   {params.hasBikeRental && (
                     <div className="animate-in fade-in slide-in-from-top-2">
                        <DailyCostGrid 
                           label="Noleggio Bici Clienti (Costo giornaliero)" 
                           values={params.bikeDailyRentalCosts} 
                           onChange={vals => setParams({...params, bikeDailyRentalCosts: vals})} 
                           icon={Bike}
                           helperText="Inserisci il costo di noleggio per singola bici"
                        />
                     </div>
                   )}
                </div>
             </SectionCard>

            {/* Client Costs */}
            <SectionCard title="Costi Clienti (Hotel & Extra)" icon={Hotel}>
               <div className="space-y-8">
                  
                  {/* HOTEL MANAGEMENT */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center"><Hotel className="w-4 h-4 mr-2"/> Hotel</h3>
                       
                       {/* Total Nights Validator */}
                       <div className={`text-xs font-bold px-3 py-1 rounded-full flex items-center border ${
                          params.hotelStays.reduce((acc, s) => acc + s.nights, 0) === params.durationDays 
                          ? 'bg-green-100 text-green-700 border-green-200' 
                          : 'bg-red-100 text-red-700 border-red-200'
                       }`}>
                          {params.hotelStays.reduce((acc, s) => acc + s.nights, 0) === params.durationDays ? (
                             <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                             <AlertCircle className="w-3 h-3 mr-1" />
                          )}
                          Totale Notti: {params.hotelStays.reduce((acc, s) => acc + s.nights, 0)} / {params.durationDays}
                       </div>

                       <button 
                         onClick={() => {
                            const currentNights = params.hotelStays.reduce((acc, s) => acc + s.nights, 0);
                            if (currentNights < params.durationDays) {
                               const newItem: HotelStay = {
                                  id: Date.now().toString(),
                                  name: "Nuovo Hotel",
                                  nights: params.durationDays - currentNights,
                                  costPerNight: 0,
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
                              <div className="col-span-1 md:col-span-2">
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
                              <div className="grid grid-cols-3 gap-2 col-span-1 md:col-span-2">
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
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Supp. DUS</label>
                                    <div className="relative">
                                       <span className="absolute left-2 top-2 text-slate-400 text-xs">€</span>
                                       <input 
                                          type="number" 
                                          value={stay.dusSupplement}
                                          onChange={(e) => {
                                             const val = parseFloat(e.target.value) || 0;
                                             const newStays = [...params.hotelStays];
                                             newStays[index].dusSupplement = val;
                                             setParams({...params, hotelStays: newStays});
                                          }}
                                          className="w-full text-sm bg-white border-slate-200 rounded-lg pl-6"
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>
                           
                           {/* Dettagli Avanzati Hotel (Textarea) */}
                           <div className="mt-3 pt-3 border-t border-rose-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                               <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Condizioni Pagamento</label>
                                  <textarea 
                                     placeholder="es. 30% acconto..."
                                     value={stay.paymentTerms}
                                     onChange={(e) => {
                                        const newStays = [...params.hotelStays];
                                        newStays[index].paymentTerms = e.target.value;
                                        setParams({...params, hotelStays: newStays});
                                     }}
                                     rows={2}
                                     className="w-full text-xs bg-white border-slate-200 rounded-lg resize-none"
                                  />
                               </div>
                               <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Policy Cancellazione</label>
                                  <textarea 
                                     placeholder="es. Free fino a 30gg..."
                                     value={stay.cancellationPolicy}
                                     onChange={(e) => {
                                        const newStays = [...params.hotelStays];
                                        newStays[index].cancellationPolicy = e.target.value;
                                        setParams({...params, hotelStays: newStays});
                                     }}
                                     rows={2}
                                     className="w-full text-xs bg-white border-slate-200 rounded-lg resize-none"
                                  />
                               </div>
                           </div>
                        </div>
                     )})}
                  </div>

                  <div className="h-px bg-slate-200 my-6"></div>

                  {/* DINNER */}
                  <DailyCostGrid 
                     label="Costi Pasti Extra Giornalieri (a persona)" 
                     values={params.clientDailyDinnerCosts} 
                     onChange={vals => setParams({...params, clientDailyDinnerCosts: vals})} 
                     icon={Utensils}
                     helperText="Inserisci il costo per i pasti extra (es. cene o pranzi non inclusi)"
                  />
                  
                  <div className="h-px bg-slate-200 my-6"></div>
                  
                  {/* EXTRA SERVICES */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="sm:col-span-2">
                           <NumberInput 
                               label="Costo Totale Transfer A/R (Bus/Van)" 
                               value={params.clientTotalTransferCost} 
                               onChange={v => setParams({...params, clientTotalTransferCost: v})} 
                               icon={Bus}
                           />
                           <p className="text-xs text-slate-500 text-right mt-[-10px] mb-2 mr-1">
                               (€{(params.clientTotalTransferCost / (params.participants || 1)).toFixed(2)} / persona)
                           </p>
                       </div>
                       <NumberInput 
                           label="Costo Esperienze/Visite (a persona)" 
                           value={params.clientExperienceCost} 
                           onChange={v => setParams({...params, clientExperienceCost: v})} 
                           icon={Ticket}
                       />
                       <NumberInput 
                           label="Assicurazione (a persona)" 
                           value={params.clientInsuranceCost} 
                           onChange={v => setParams({...params, clientInsuranceCost: v})} 
                           icon={ShieldCheck}
                       />
                   </div>

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
                      <span className="block text-[10px] text-brand-300 uppercase font-bold">Profitto Netto</span>
                      <span className="block text-xl font-bold text-brand-300">€{costs.totalProfit.toFixed(0)}</span>
                   </div>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-2">
                   <div className="flex justify-between text-xs text-slate-400">
                      <span>Commissioni Incluse ({params.bankingFeePercent + params.agencyCommissionPercent}%)</span>
                      <span>€{costs.commercialCosts.total.toFixed(0)}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center group/tooltip relative">
                        <span className="text-xs font-medium text-slate-400 mr-2">BREAK EVEN POINT</span>
                        <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                        
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                           Il numero minimo di partecipanti per coprire i costi fissi.
                        </div>
                     </div>
                     <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${costs.isBreakEvenImpossible || costs.breakEvenParticipants > params.participants ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                        {costs.isBreakEvenImpossible ? (
                          <span className="flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Impossibile</span>
                        ) : (
                          <span className="flex items-center">
                             <Users className="w-3 h-3 mr-1"/> 
                             <span className="text-lg mr-1">{costs.breakEvenParticipants}</span> pax
                          </span>
                        )}
                     </div>
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
                 <FileText className="w-4 h-4 mr-2" /> PDF
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
              
              {/* Cloud Status */}
              <div className={`px-6 py-2 text-xs font-bold text-center border-b ${isCloudEnabled ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                 {isCloudEnabled ? "CLOUD SYNC ATTIVO" : "MODALITÀ LOCALE (Configura Supabase per il Cloud)"}
              </div>

              <div className="p-2 max-h-96 overflow-y-auto">
                 {isSyncing ? (
                    <div className="p-8 text-center text-slate-400">
                       <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                       <p>Sincronizzazione...</p>
                    </div>
                 ) : savedTrips.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                       <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                       <p>Nessun viaggio salvato</p>
                    </div>
                 ) : (
                    <div className="space-y-1">
                       {savedTrips.map(trip => (
                          <div key={trip.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg group">
                             <div onClick={() => handleLoadTrip(trip)} className="cursor-pointer flex-grow">
                                <div className="flex items-center">
                                   <p className="font-bold text-slate-800 mr-2">{trip.name}</p>
                                   {trip.isCloud ? (
                                     <span title="Salvato in Cloud">
                                       <Cloud className="w-3 h-3 text-green-500" />
                                     </span>
                                   ) : (
                                     <span title="Salvato in Locale">
                                       <CloudOff className="w-3 h-3 text-slate-300" />
                                     </span>
                                   )}
                                </div>
                                <p className="text-xs text-slate-500">{trip.date} • {trip.params.participants} pax</p>
                             </div>
                             <button onClick={() => handleDeleteTrip(trip.id, trip.isCloud)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
                 <button onClick={handleSaveTrip} disabled={isSyncing} className="flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50">
                    <Save className="w-4 h-4 mr-2" /> Salva Corrente
                 </button>
                 <div className="flex space-x-2">
                    <button onClick={handleExportBackup} className="flex-1 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100" title="Esporta Backup JSON">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100" title="Importa Backup JSON">
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