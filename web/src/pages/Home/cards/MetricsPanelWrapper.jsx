import PropTypes from 'prop-types';
import { METRIC_DEFINITIONS } from '../../../utils/metricDefinitions.js';
import { metricOrderSignal } from '../../../utils/dashboardManager.js';
import { MetricsGrid } from './MetricsGrid.jsx';

export function MetricsPanelWrapper({ ds, inCard = false }) {
  const metricOrder = metricOrderSignal.value;

  const orderedIds = [
    ...metricOrder,
    ...METRIC_DEFINITIONS
      .filter(m => m.required && !metricOrder.includes(m.id))
      .map(m => m.id),
  ];

  const visibleMetrics = orderedIds
    .map(id => METRIC_DEFINITIONS.find(m => m.id === id))
    .filter(Boolean)
    .filter(m => m.available(ds))
    .map(m => ({
      id: m.id,
      label: m.label,
      current: m.getValue(ds),
      target: m.getTarget ? m.getTarget(ds) : null,
      unit: m.unit,
      adjustable: m.adjustable(ds),
      onDecrease: m.onDecrease ? m.onDecrease(ds) : undefined,
      onIncrease: m.onIncrease ? m.onIncrease(ds) : undefined,
    }));

  return <MetricsGrid metrics={visibleMetrics} inCard={inCard} />;
}

MetricsPanelWrapper.propTypes = {
  ds: PropTypes.object.isRequired,
  inCard: PropTypes.bool,
};
