
export interface StaffConfig {
  dailyRates: number[]; // Array costi giornalieri durante il tour
  dailyRatesBefore: number[]; // Array costi giornalieri giorni extra PRIMA
  dailyRatesAfter: number[]; // Array costi giornalieri giorni extra DOPO
  travelCost: number; // Costo volo/trasferimento per arrivare
  extraDaysBefore: number; // Numero giorni arrivo prima
  extraDaysAfter: number; // Numero giorni partenza dopo
}

export interface HotelStay {
  id: string;
  name: string;
  nights: number;
  costPerNight: number;
  paymentTerms: string;      // Termini di pagamento
  cancellationPolicy: string; // Politica di cancellazione
  dusSupplement: number;     // Supplemento Doppia Uso Singola
}

export interface TripParams {
  tripName: string;
  participants: number;
  durationDays: number;
  profitMarginPercent: number;
  
  // Costi Staff
  hasGuide: boolean;
  guide: StaffConfig;
  hasDriver: boolean;
  driver: StaffConfig;
  
  // Logistica Staff condivisa
  staffDailyLunchCosts: number[];
  staffDailyLunchCostsBefore: number[];
  staffDailyLunchCostsAfter: number[];
  
  staffDailyAccommodationCosts: number[]; // Nuovo: Alloggio staff specifico (se diverso da clienti o per giorni extra)
  staffDailyAccommodationCostsBefore: number[];
  staffDailyAccommodationCostsAfter: number[];

  // Logistica e Alloggio
  vanDailyRentalCosts: number[];
  vanDailyRentalCostsBefore: number[];
  vanDailyRentalCostsAfter: number[];

  fuelDailyCosts: number[];
  fuelDailyCostsBefore: number[];
  fuelDailyCostsAfter: number[];

  hotelStays: HotelStay[]; // Gestione soggiorni hotel (blocchi di notti)
  bikeDailyRentalCosts: number[]; // Array costo bici per persona per ogni giorno (CLIENTI)
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
  breakEvenParticipants: number; // Minimo partecipanti per coprire i costi
  isBreakEvenImpossible: boolean;
}
