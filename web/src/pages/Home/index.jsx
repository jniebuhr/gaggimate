import './style.css';
import { useContext } from 'react';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Chart, LineController, TimeScale, LinearScale, PointElement, LineElement, Legend, Filler } from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { OverviewChart } from '../../components/OverviewChart.jsx';
Chart.register(LineController);
Chart.register(TimeScale);
Chart.register(LinearScale);
Chart.register(PointElement);
Chart.register(LineElement);
Chart.register(Filler);
Chart.register(Legend);

const modeMap = {
  0: 'Standby',
  1: 'Brew',
  2: 'Steam',
  3: 'Water',
};

const status = computed(() => machine.value.status);

export function Home() {
  const apiService = useContext(ApiServiceContext);
  return (
    <div key="home" className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12">
          <h2 className="text-2xl font-bold">Dashboard</h2>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 p-6 sm:col-span-6 xl:col-span-3"
        >
          <dl>
            <dt className="text-2xl font-bold">{modeMap[status.value.mode] || 'Standby'}</dt>
            <dd className="text-sm font-medium text-slate-500">
              Mode
            </dd>
          </dl>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 p-6 sm:col-span-6 xl:col-span-3"
        >
          <dl>
            <dt className="text-2xl font-bold">{status.value.currentTemperature || 0} °C</dt>
            <dd className="text-sm font-medium text-slate-500">
              Current Temperature
            </dd>
          </dl>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 p-6 sm:col-span-6 xl:col-span-3"
        >
          <dl>
            <dt className="text-2xl font-bold">{status.value.targetTemperature || 0} °C</dt>
            <dd className="text-sm font-medium text-slate-500">
              Target Temperature
            </dd>
          </dl>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 p-6 sm:col-span-6 xl:col-span-3"
        >
          <dl>
            <dt className="text-2xl font-bold">{status.value.selectedProfile || '-'}</dt>
            <dd className="text-sm font-medium text-slate-500">
              Current Profile
            </dd>
          </dl>
        </div>
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 sm:col-span-12"
        >
          <div className="px-6 pt-6">
            <h2 className="text-2xl font-bold">Overview</h2>
          </div>

          <div className="p-6">
            <OverviewChart />
          </div>
        </div>
      </div>
  );
}
