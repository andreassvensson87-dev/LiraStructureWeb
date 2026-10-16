/** Nominal coarse-thread geometry, mm. Sources and scope: docs/fastener-catalog.md. */
export const METRIC_FASTENER_DIMENSIONS = [
  // d, pitch, head width, head height, ISO 4032 height, ISO 7089 bore/OD/thickness
  [8, 1.25, 13, 5.3, 6.8, 8.4, 16, 1.6],
  [10, 1.5, 16, 6.4, 8.4, 10.5, 20, 2],
  [12, 1.75, 18, 7.5, 10.8, 13, 24, 2.5],
  [16, 2, 24, 10, 14.8, 17, 30, 3],
  [20, 2.5, 30, 12.5, 18, 21, 37, 3],
  [24, 3, 36, 15, 21.5, 25, 44, 4],
  [30, 3.5, 46, 18.7, 25.6, 31, 56, 4],
  [36, 4, 55, 22.5, 31, 37, 66, 5],
];

/** ISO 4014 thread length b; a too-short manual shaft remains a fit warning. */
export const iso4014ThreadLength = (diameter, length) =>
  2 * diameter + (length <= 125 ? 6 : length <= 200 ? 12 : 25);
