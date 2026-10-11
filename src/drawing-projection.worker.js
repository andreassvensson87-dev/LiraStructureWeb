import { packDrawingProjection, drawingProjectionBuffers } from './drawing-projection-result.js';
import { calculateDrawingProjection } from './drawing-projection-data.js';

self.onmessage = ({ data: { key, data } }) => {
  try {
    const result = packDrawingProjection(calculateDrawingProjection(data));
    self.postMessage({ key, result }, drawingProjectionBuffers(result));
  } catch (error) {
    self.postMessage({ key, error: error.message || 'Vyn kunde inte beräknas.' });
  }
};
