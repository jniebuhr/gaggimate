export const COLUMN_TYPES = {
  VAL: 'val',
  SE: 'se',
  MM: 'mm',
  AVG: 'avg',
  BOOL: 'bool',
};

export function createColumn({ id, label, type, group, default: isDefault = false, targetType }) {
  const col = { id, label, type, group, default: isDefault };
  if (targetType) col.targetType = targetType;
  return col;
}

export const columnConfig = [
  createColumn({
    id: 'duration',
    label: 'Duration (s)',
    type: COLUMN_TYPES.VAL,
    group: 'basics',
    default: true,
    targetType: 'duration',
  }),
  createColumn({
    id: 'water',
    label: 'Pumped Water (ml)',
    type: COLUMN_TYPES.VAL,
    group: 'basics',
    default: true,
    targetType: 'pumped',
  }),
  createColumn({
    id: 'weight',
    label: 'Weight (g)',
    type: COLUMN_TYPES.VAL,
    group: 'weight',
    default: true,
    targetType: 'weight',
  }),
  createColumn({ id: 'w_se', label: 'Weight (g)', type: COLUMN_TYPES.SE, group: 'weight' }),
  createColumn({ id: 'w_mm', label: 'Weight (g)', type: COLUMN_TYPES.MM, group: 'weight' }),
  createColumn({ id: 'w_avg', label: 'Weight (g)', type: COLUMN_TYPES.AVG, group: 'weight' }),
  createColumn({
    id: 'wf_se',
    label: 'Weight Flow (g/s)',
    type: COLUMN_TYPES.SE,
    group: 'weightflow',
  }),
  createColumn({
    id: 'wf_mm',
    label: 'Weight Flow (g/s)',
    type: COLUMN_TYPES.MM,
    group: 'weightflow',
  }),
  createColumn({
    id: 'wf_avg',
    label: 'Weight Flow (g/s)',
    type: COLUMN_TYPES.AVG,
    group: 'weightflow',
  }),
  createColumn({
    id: 'p_se',
    label: 'Pressure (bar)',
    type: COLUMN_TYPES.SE,
    group: 'pressure',
    default: true,
    targetType: 'pressure',
  }),
  createColumn({ id: 'p_mm', label: 'Pressure (bar)', type: COLUMN_TYPES.MM, group: 'pressure' }),
  createColumn({ id: 'p_avg', label: 'Pressure (bar)', type: COLUMN_TYPES.AVG, group: 'pressure' }),
  createColumn({
    id: 'tp_se',
    label: 'Target Pressure (bar)',
    type: COLUMN_TYPES.SE,
    group: 'target_pressure',
  }),
  createColumn({
    id: 'tp_mm',
    label: 'Target Pressure (bar)',
    type: COLUMN_TYPES.MM,
    group: 'target_pressure',
  }),
  createColumn({
    id: 'tp_avg',
    label: 'Target Pressure (bar)',
    type: COLUMN_TYPES.AVG,
    group: 'target_pressure',
  }),
  createColumn({
    id: 'f_se',
    label: 'Pump Flow (ml/s)',
    type: COLUMN_TYPES.SE,
    group: 'flow',
    default: true,
    targetType: 'flow',
  }),
  createColumn({ id: 'f_mm', label: 'Pump Flow (ml/s)', type: COLUMN_TYPES.MM, group: 'flow' }),
  createColumn({ id: 'f_avg', label: 'Pump Flow (ml/s)', type: COLUMN_TYPES.AVG, group: 'flow' }),
  createColumn({
    id: 'tf_se',
    label: 'Target Pump Flow (ml/s)',
    type: COLUMN_TYPES.SE,
    group: 'target_flow',
  }),
  createColumn({
    id: 'tf_mm',
    label: 'Target Pump Flow (ml/s)',
    type: COLUMN_TYPES.MM,
    group: 'target_flow',
  }),
  createColumn({
    id: 'tf_avg',
    label: 'Target Pump Flow (ml/s)',
    type: COLUMN_TYPES.AVG,
    group: 'target_flow',
  }),
  createColumn({
    id: 'pf_se',
    label: 'Puck Flow (ml/s)',
    type: COLUMN_TYPES.SE,
    group: 'puckflow',
    default: true,
  }),
  createColumn({
    id: 'pf_mm',
    label: 'Puck Flow (ml/s)',
    type: COLUMN_TYPES.MM,
    group: 'puckflow',
  }),
  createColumn({
    id: 'pf_avg',
    label: 'Puck Flow (ml/s)',
    type: COLUMN_TYPES.AVG,
    group: 'puckflow',
  }),
  createColumn({ id: 't_se', label: 'Temperature (℃)', type: COLUMN_TYPES.SE, group: 'temp' }),
  createColumn({ id: 't_mm', label: 'Temperature (℃)', type: COLUMN_TYPES.MM, group: 'temp' }),
  createColumn({
    id: 't_avg',
    label: 'Temperature (℃)',
    type: COLUMN_TYPES.AVG,
    group: 'temp',
    default: true,
  }),
  createColumn({
    id: 'tt_se',
    label: 'Target Temp (℃)',
    type: COLUMN_TYPES.SE,
    group: 'target_temp',
  }),
  createColumn({
    id: 'tt_mm',
    label: 'Target Temp (℃)',
    type: COLUMN_TYPES.MM,
    group: 'target_temp',
  }),
  createColumn({
    id: 'tt_avg',
    label: 'Target Temp (℃)',
    type: COLUMN_TYPES.AVG,
    group: 'target_temp',
  }),
  createColumn({
    id: 'sys_raw',
    label: 'Raw Data Points',
    type: COLUMN_TYPES.VAL,
    group: 'system',
  }),
  createColumn({
    id: 'sys_shot_vol',
    label: 'Start Volumetric',
    type: COLUMN_TYPES.BOOL,
    group: 'system',
  }),
  createColumn({
    id: 'sys_curr_vol',
    label: 'Currently Volumetric',
    type: COLUMN_TYPES.BOOL,
    group: 'system',
  }),
  createColumn({
    id: 'sys_scale',
    label: 'BT Scale Connected',
    type: COLUMN_TYPES.BOOL,
    group: 'system',
  }),
  createColumn({
    id: 'sys_vol_avail',
    label: 'Volumetric Avail.',
    type: COLUMN_TYPES.BOOL,
    group: 'system',
  }),
  createColumn({
    id: 'sys_ext',
    label: 'Extended Record',
    type: COLUMN_TYPES.BOOL,
    group: 'system',
  }),
];

export const getAllColumns = () => {
  const all = new Set();
  columnConfig.forEach(col => all.add(col.id));
  return all;
};

export const getColumnsByGroup = groupKey => {
  const columns = new Set();
  columnConfig.forEach(col => {
    if (col.group === groupKey) columns.add(col.id);
  });
  return columns;
};

export const getDefaultColumns = () => {
  const defaults = new Set();
  columnConfig.forEach(col => {
    if (col.default) defaults.add(col.id);
  });
  return defaults;
};

export const getGroupedColumns = () => {
  const grouped = {};
  columnConfig.forEach(col => {
    if (!grouped[col.group]) {
      grouped[col.group] = [];
    }
    grouped[col.group].push(col);
  });
  return grouped;
};
