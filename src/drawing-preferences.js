export const DRAWING_PREFERENCES_KEY = 'lirastructure.drawing-preferences.v1';
export const drawingFonts = [
  ['Arial', 'Arial, sans-serif'],
  ['Verdana', 'Verdana, sans-serif'],
  ['Georgia', 'Georgia, serif'],
  ['Times New Roman', '"Times New Roman", serif'],
  ['Courier New', '"Courier New", monospace'],
];
export function drawingFont(record) {
  const font = record?.typography?.font;
  return drawingFonts.some(([, value]) => value === font) ? font : drawingFonts[0][1];
}
export function readDrawingPreferences() {
  try {
    return {
      font: drawingFont({ typography: JSON.parse(localStorage.getItem(DRAWING_PREFERENCES_KEY)) }),
    };
  } catch {
    return { font: drawingFonts[0][1] };
  }
}
export function newDrawingTypography() {
  return { ...readDrawingPreferences() };
}
export function applyDrawingFont(root, record) {
  root.classList.add('drawing-font-scope');
  root.style.setProperty('--drawing-font', drawingFont(record));
}
