import React, { useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  icon?: LucideIcon;
  step?: number;
  min?: number;
  suffix?: string;
  placeholder?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({ 
  label, value, onChange, icon: Icon, step = 1, min = 0, suffix, placeholder 
}) => {
  // Local state to handle typing freely
  const [localValue, setLocalValue] = useState<string>(value.toString());
  const [error, setError] = useState<string | null>(null);

  // Sync local state when prop changes externally (e.g. loading a preset)
  useEffect(() => {
    setLocalValue(value.toString());
    setError(null);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    
    // Immediate visual feedback for obvious errors
    if (newVal === '') {
        // Allow empty while typing, don't error yet
        setError(null);
    } else if (isNaN(parseFloat(newVal))) {
        setError('Numero non valido');
    } else {
        setError(null);
    }
  };

  const handleBlur = () => {
    let parsed = parseFloat(localValue);

    if (isNaN(parsed)) {
      // Revert to last valid prop value or min
      parsed = min;
      setError('Valore ripristinato');
      setTimeout(() => setError(null), 2000);
    } else if (parsed < min) {
      parsed = min;
      setError(`Minimo ${min}`);
      setTimeout(() => setError(null), 2000);
    }

    setLocalValue(parsed.toString());
    onChange(parsed);
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">{label}</label>
      <div className="relative rounded-xl shadow-sm group transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-brand-500'}`} />
          </div>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`block w-full rounded-xl border-0 ring-1 ring-inset py-3 pl-10 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-all
            ${error 
              ? 'ring-red-300 focus:ring-red-500 bg-red-50' 
              : 'ring-slate-200 focus:ring-brand-500 hover:ring-slate-300'
            } 
            ${!Icon ? 'pl-4' : ''}`}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <span className="text-slate-400 font-medium sm:text-sm">{suffix}</span>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 font-medium ml-1 animate-pulse">{error}</p>
      )}
    </div>
  );
};

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onChange(!checked)}>
    <span className="flex-grow flex flex-col">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </span>
    <button
      type="button"
      className={`${
        checked ? 'bg-brand-600' : 'bg-slate-200'
      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2`}
    >
      <span
        className={`${
          checked ? 'translate-x-5' : 'translate-x-0'
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
      />
    </button>
  </div>
);