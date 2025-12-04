
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CostBreakdown } from '../types';

interface CostChartProps {
  costs: CostBreakdown;
}

const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308'];

export const CostChart: React.FC<CostChartProps> = ({ costs }) => {
  const data = [
    { name: 'Staff (Compensi)', value: costs.fixedCosts.staffFees },
    { name: 'Staff (Viaggi)', value: costs.fixedCosts.staffTravel },
    { name: 'Staff (Vitto/Alloggio)', value: costs.fixedCosts.staffAccommodation + costs.fixedCosts.staffLunch },
    { name: 'Van (Noleggio)', value: costs.fixedCosts.vanRental },
    { name: 'Van (Carburante)', value: costs.fixedCosts.fuel },
    { name: 'Clienti (Alloggio)', value: costs.variableCosts.clientAccommodation },
    { name: 'Clienti (Bici)', value: costs.variableCosts.clientBike },
  ].filter(d => d.value > 0);

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
