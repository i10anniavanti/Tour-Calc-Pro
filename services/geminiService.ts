import { GoogleGenAI } from "@google/genai";
import { TripParams, CostBreakdown } from "../types";

// Inizializzazione Lazy: Crea l'istanza solo quando serve, non all'avvio dell'app.
// Questo previene il crash (schermata bianca) se la API Key non è configurata correttamente su Vercel.
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key mancante o non configurata correttamente.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTripProposal = async (params: TripParams, costs: CostBreakdown): Promise<string> => {
  const prompt = `
    Agisci come un Tour Operator esperto di viaggi in bici.
    Scrivi una bozza di email formale e accattivante da inviare a un cliente per proporre questo viaggio.
    Usa un tono professionale ma coinvolgente. Includi una breve descrizione ipotetica di un itinerario basato sulla durata.

    Dettagli Viaggio:
    - Nome Viaggio: ${params.tripName}
    - Durata: ${params.durationDays} giorni
    - Partecipanti: ${params.participants} persone
    - Servizi Inclusi: ${params.hasGuide ? "Guida ciclistica esperta," : ""} ${params.hasDriver ? "Autista con Van di supporto," : ""} Pernottamento in mezza pensione, Noleggio bici.
    
    Analisi Costi (da usare per giustificare il valore, non elencare i costi grezzi):
    - Prezzo proposto a persona: €${costs.suggestedPricePerPerson.toFixed(2)}
    
    Struttura la risposta in Markdown.
    Rispondi in Italiano.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Impossibile generare la proposta al momento.";
  } catch (error: any) {
    console.error("Errore Gemini:", error);
    return `Si è verificato un errore: ${error.message || "Errore sconosciuto"}. Verifica la API Key su Vercel.`;
  }
};

export const analyzeCostsAI = async (costs: CostBreakdown): Promise<string> => {
  const prompt = `
    Analizza i seguenti dati finanziari per un viaggio di gruppo organizzato da un tour operator.
    Fornisci 3 consigli strategici brevi per ottimizzare i costi o migliorare il margine, identificando dove si spendono più soldi.
    
    Dati:
    - Costi Fissi Totali: €${costs.fixedCosts.total} (Staff, Van, Alloggio Staff)
    - Costi Variabili Totali: €${costs.variableCosts.total} (Alloggio Clienti, Bici)
    - Margine di profitto attuale: €${costs.totalProfit}
    - Incidenza Costo Guida/Staff: €${costs.fixedCosts.staffFees + costs.fixedCosts.staffTravel + costs.fixedCosts.staffAccommodation}
    
    Rispondi in Italiano con un elenco puntato Markdown.
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Analisi non disponibile.";
  } catch (error: any) {
    console.error("Errore Gemini:", error);
    return `Errore nell'analisi dei costi: ${error.message || "Errore sconosciuto"}.`;
  }
};