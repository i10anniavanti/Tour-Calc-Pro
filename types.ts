
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
  guideBikeDailyCosts: number[]; // NUOVO: Costo bici guida

  hasDriver: boolean;
  driver: StaffConfig;
  
  // Logistica Staff condivisa
  staffDailyLunchCosts: number[];
  staffDailyLunchCostsBefore: number[];
  staffDailyLunchCostsAfter: number[];

  staffDailyAccommodationCosts: number[];
  staffDailyAccommodationCostsBefore: number[];
  staffDailyAccommodationCostsAfter: number[];

  // Logistica e Alloggio
  vanDailyRentalCosts: number[];
  vanDailyRentalCostsBefore: number[];
  vanDailyRentalCostsAfter: number[];

  fuelDailyCosts: number[];
  fuelDailyCostsBefore: number[];
  fuelDailyCostsAfter: number[];
  
  staffTollsCost: number; // NUOVO: Pedaggi

  // Sviluppo
  scoutingCost: number; // NUOVO: Ricognizione e sviluppo

  // Clienti
  hotelStays: HotelStay[];
  bikeDailyRentalCosts: number[];
  
  clientTransferCost: number; // NUOVO: Transfer A/R a persona
  clientInsuranceCost: number; // NUOVO: Assicurazione a persona
  clientExperienceCost: number; // NUOVO: Visite/Esperienze a persona
  clientDailyDinnerCosts: number[]; // NUOVO: Cene clienti giornaliere

  // Commerciale
  bankingFeePercent: number; // NUOVO: % Incasso (es. 3%)
  agencyCommissionPercent: number; // NUOVO: % Intermediario
}

export interface CostBreakdown {
  fixedCosts: {
    staffFees: number;
    staffTravel: number;
    staffAccommodation: number;
    staffLunch: number;
    guideBike: number; // NUOVO
    vanRental: number;
    fuel: number;
    tolls: number; // NUOVO
    scouting: number; // NUOVO
    total: number;
  };
  variableCosts: {
    clientAccommodation: number;
    clientBike: number;
    clientTransfer: number; // NUOVO
    clientInsurance: number; // NUOVO
    clientExperience: number; // NUOVO
    clientDinner: number; // NUOVO
    total: number;
  };
  commercialCosts: { // NUOVO
    bankingFees: number;
    agencyCommissions: number;
    total: number;
  };
  totalCost: number; // Costi Operativi (Fissi + Variabili)
  costPerPerson: number;
  suggestedPricePerPerson: number;
  totalRevenue: number;
  totalProfit: number; // Profitto Netto (dopo costi e commissioni)
  breakEvenParticipants: number;
  isBreakEvenImpossible: boolean;
}
