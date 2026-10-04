/**
 * Recharts requires literal color strings, not CSS custom properties, so
 * these are transcribed by hand from styles/tokens.css and
 * Badge/Badge.module.css. Keep in sync if either source changes.
 */
export const LINE_COLOR = '#002E60'; // --primary
export const REVENUE_COLOR = '#B3261E'; // --danger — red revenue line
export const GRID_COLOR = '#EBEFF2'; // --line-soft
export const AXIS_COLOR = '#5A646B'; // --ink-soft
export const TOOLTIP_BG = '#FFFFFF'; // --panel
export const TOOLTIP_BORDER = '#DCE2E6'; // --line
export const MONO_FONT = "'Inter', system-ui, \"Segoe UI\", Roboto, sans-serif"; // --mono

/** Mirrors Badge's tone colors so the Ride Status donut matches status badges elsewhere on the dashboard. */
export const STATUS_COLORS: Record<'pending' | 'assigned' | 'ongoing' | 'completed' | 'cancelled', string> = {
  pending: '#e3b341', // Badge .warn border
  assigned: '#4F7CAC', // lighter than ongoing, still the info blue family
  ongoing: '#002E60', // --primary / Badge .info
  completed: '#477434', // --success / Badge .success
  cancelled: '#B3261E', // --danger / Badge .danger
};
