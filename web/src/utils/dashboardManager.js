const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};

export const DEFAULT_LAYOUT = {
  cards: [
    { id: 'process', cols: 1, rows: 1 },
    { id: 'status', cols: 1, rows: 1 },
    { id: 'chart', cols: 2, rows: 2 },
  ]
};

const CARD_IDS = DEFAULT_LAYOUT.cards.map(card => card.id);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

export const normalizeDashboardLayout = layout => {
  if (layout === DASHBOARD_LAYOUTS.ORDER_LAST) {
    return {
      cards: [
        { id: 'chart', cols: 2, rows: 2 },
        { id: 'process', cols: 1, rows: 1 },
        { id: 'status', cols: 1, rows: 1 },
      ],
    };
  }

  if (layout === DASHBOARD_LAYOUTS.ORDER_FIRST || !layout || !Array.isArray(layout.cards)) {
    return DEFAULT_LAYOUT;
  }

  const cardsById = new Map();
  layout.cards.forEach(card => {
    if (CARD_IDS.includes(card?.id) && !cardsById.has(card.id)) {
      cardsById.set(card.id, {
        id: card.id,
        cols: clamp(card.cols, 1, 2),
        rows: clamp(card.rows, 1, 3),
      });
    }
  });

  DEFAULT_LAYOUT.cards.forEach(card => {
    if (!cardsById.has(card.id)) {
      cardsById.set(card.id, { ...card });
    }
  });

  return { cards: Array.from(cardsById.values()) };
};

export const getDashboardLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_LAYOUT;
  }

  try {
    const stored = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!stored) return DEFAULT_LAYOUT;
    try {
      return normalizeDashboardLayout(JSON.parse(stored));
    } catch {
      return normalizeDashboardLayout(stored);
    }
  } catch (error) {
    console.warn('getDashboardLayout: localStorage access failed:', error);
    return DEFAULT_LAYOUT;
  }
};

export const setDashboardLayout = layout => {
  const normalizedLayout = normalizeDashboardLayout(layout);
  if (!normalizedLayout?.cards) {
    console.error('setDashboardLayout: Invalid layout object');
    return false;
  }

  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(normalizedLayout));
    return true;
  } catch (error) {
    console.error('setDashboardLayout: Failed to store layout in localStorage:', error);
    return false;
  }
};
