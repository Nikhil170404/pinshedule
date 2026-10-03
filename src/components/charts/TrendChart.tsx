'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface TrendPoint { day: string; value: number }

export default function TrendChart({ data, label }: { data: TrendPoint[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e60023" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#e60023" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} minTickGap={24}
          tickFormatter={(d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v) => [Number(v).toLocaleString(), label]}
          labelFormatter={(d) => new Date(String(d) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
        <Area type="monotone" dataKey="value" stroke="#e60023" strokeWidth={2} fill="url(#trend)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
