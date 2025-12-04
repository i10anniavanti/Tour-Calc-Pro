import { createClient } from '@supabase/supabase-js';
import { TripParams } from '../types';

// Accesso sicuro a import.meta.env
// Se env è undefined (es. durante build o ambienti specifici), usa un oggetto vuoto per evitare crash
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_KEY;

// Inizializza il client solo se le chiavi esistono (non sono stringhe vuote o undefined)
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export interface CloudTrip {
  id: string;
  name: string;
  created_at: string;
  trip_data: TripParams; // Mappa il JSON del DB ai parametri dell'app
}

// Funzioni Helper
export const saveTripToCloud = async (tripName: string, params: TripParams) => {
  if (!supabase) throw new Error("Supabase non configurato");
  
  const { data, error } = await supabase
    .from('trips')
    .insert([
      { name: tripName, trip_data: params }
    ])
    .select();
    
  if (error) throw error;
  return data?.[0];
};

export const getTripsFromCloud = async (): Promise<CloudTrip[]> => {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Errore recupero viaggi:", error);
    return [];
  }
  return data as CloudTrip[];
};

export const deleteTripFromCloud = async (id: string) => {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
};