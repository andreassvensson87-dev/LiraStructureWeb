import {
  TIBNOR_ROWS,
  TIBNOR_UPE_ROWS,
  TIBNOR_U_ROWS,
  TIBNOR_L_ROWS,
  TIBNOR_HOLLOW_ROWS,
  TIBNOR_ROUND_ROWS,
  TIBNOR_HEM_ROWS,
  TIBNOR_T_ROWS,
} from './tibnor-data.js';
import {
  roundedBeamTemplate,
  roundedChannelTemplate,
  taperedChannelTemplate,
  roundedAngleTemplate,
  roundedHollowTemplate,
  sectionTemplate,
  roundedTeeTemplate,
} from './section-templates.js';
import { mergeLibrary } from './section-profile.js';

export const TIBNOR_SOURCE = 'https://www.tibnor.se/medias/konstruktionstabellerSWE-2023.pdf';
const beamTables = { IPE: '004', HEA: '005', HEB: '006', HEM: '007' };
const beamProfiles = Object.entries({ ...TIBNOR_ROWS, HEM: TIBNOR_HEM_ROWS }).flatMap(
  ([family, rows]) =>
    rows.map(([size, H, B, tf, tw, R, A, massPerMeter, iy, iz, wy, wz, it]) => ({
      ...roundedBeamTemplate(family === 'IPE' ? 'i' : 'h'),
      id: `tibnor-2023-${family.toLowerCase()}-${size}`,
      revision: 1,
      name: `${family} ${size}`,
      family,
      standard: family === 'HEM' ? 'S235JR/S355J2' : 'S355J2',
      source: `Tibnors konstruktionstabeller 2023 · tabell ${beamTables[family]} · ${TIBNOR_SOURCE}`,
      density: 7850,
      parameters: Object.entries({ B, H, tw, tf, R }).map(([name, value]) => ({ name, value })),
      catalog: {
        A,
        massPerMeter,
        Ix: iy * 1e4,
        Iy: iz * 1e4,
        Wx: wy * 1e3,
        Wy: wz * 1e3,
        J: it * 1e6,
      },
    })),
);
const channelProfiles = TIBNOR_UPE_ROWS.map(
  ([size, H, B, tf, tw, R1, R2, A, massPerMeter, iy, iz, wy, wz1, wz2, it, cz]) => ({
    ...roundedChannelTemplate(),
    id: 'tibnor-2023-upe-' + size,
    revision: 1,
    name: 'UPE ' + size,
    family: 'UPE',
    standard: 'S355N/S355M/S355J2',
    source: 'Tibnors konstruktionstabeller 2023 · tabell 003 · ' + TIBNOR_SOURCE,
    density: 7850,
    parameters: Object.entries({ B, H, tw, tf, R1, R2 }).map(([name, value]) => ({ name, value })),
    catalog: {
      A,
      massPerMeter,
      Ix: iy * 1e4,
      Iy: iz * 1e4,
      Wx: wy * 1e3,
      Wy: wz2 * 1e3,
      WyMinus: wz1 * 1e3,
      WyPlus: wz2 * 1e3,
      cx: cz - B / 2,
      cy: 0,
      J: it * 1e6,
    },
  }),
);
const taperedChannels = TIBNOR_U_ROWS.map(
  ([size, H, B, tf, tw, Rk, Rf, A, massPerMeter, iy, iz, wy, wz, it, cz]) => ({
    ...taperedChannelTemplate({
      slope: H <= 300 ? 8 : 5,
      thicknessReference: H <= 300 ? 'B/2' : '(B-tw)/2',
    }),
    id: 'tibnor-2023-u-' + size,
    revision: 1,
    name: 'U ' + size,
    family: 'U/UPN',
    aliases: ['UPN ' + size],
    standard: 'S235JR',
    source: 'Tibnors konstruktionstabeller 2023 · tabell 002 · ' + TIBNOR_SOURCE,
    density: 7850,
    parameters: Object.entries({ B, H, tw, tf, Rk, Rf }).map(([name, value]) => ({ name, value })),
    catalog: {
      A,
      massPerMeter,
      Ix: iy * 1e4,
      Iy: iz * 1e4,
      Wx: wy * 1e3,
      Wy: wz * 1e3,
      cx: cz - B / 2,
      cy: 0,
      J: it * 1e6,
    },
  }),
);
const angleProfiles = TIBNOR_L_ROWS.map(
  ([name, printedH, printedB, printedT, Rk, A, massPerMeter, iy, iz, wy, wz, cz, cy]) => {
    // Nominal size resolves two conflicting dimension cells in table 011.
    const [H, B, t] = name.slice(1).split('x').map(Number);
    const equal = H === B;
    return {
      ...roundedAngleTemplate(),
      id: 'tibnor-2023-l-' + name.slice(1),
      revision: 1,
      name: 'L ' + name.slice(1),
      family: equal ? 'L liksidig' : 'L oliksidig',
      standard: equal ? 'S235JR/S355J2' : 'S235JR',
      source: 'Tibnors konstruktionstabeller 2023 · tabell 011 · ' + TIBNOR_SOURCE,
      density: 7850,
      parameters: Object.entries({ B, H, t, Rk, Rf: Math.min(Rk / 2, t) }).map(([name, value]) => ({
        name,
        value,
      })),
      catalog: {
        A,
        massPerMeter,
        Ix: iy * 1e4,
        Iy: iz * 1e4,
        Wx: wy * 1e3,
        Wy: wz * 1e3,
        cx: cz - B / 2,
        cy: cy - H / 2,
      },
      ...(printedH !== H || printedB !== B || printedT !== t
        ? { sourceDimensionConflict: { H: printedH, B: printedB, t: printedT } }
        : {}),
    };
  },
);
const hollowProfiles = Object.entries(TIBNOR_HOLLOW_ROWS).flatMap(([series, rows]) =>
  rows.map(([H, B, t, massPerMeter, A, iy, iz, wy, wz, it]) => {
    const multiplier = series === 'VKR' ? 1.5 : t <= 6 ? 2 : t <= 10 ? 2.5 : 3;
    return {
      ...roundedHollowTemplate(),
      id: 'tibnor-2023-' + series.toLowerCase() + '-' + H + 'x' + B + 'x' + t,
      revision: 1,
      name: series + ' ' + H + 'x' + B + 'x' + t,
      family: series + (H === B ? ' kvadratisk' : ' rektangulär'),
      standard: 'S355J2H · SS-EN ' + (series === 'VKR' ? '10210' : '10219'),
      source:
        'Tibnors konstruktionstabeller 2023 · tabell ' +
        (series === 'VKR' ? '008' : '009') +
        ' · ' +
        TIBNOR_SOURCE,
      density: 7850,
      parameters: Object.entries({
        B,
        H,
        t,
        Ro: multiplier + '*t',
        Ri: (series === 'VKR' ? 1 : multiplier - 1) + '*t',
      }).map(([name, value]) => ({ name, value })),
      catalog: {
        A,
        massPerMeter,
        Ix: iy * 1e4,
        Iy: iz * 1e4,
        Wx: wy * 1e3,
        Wy: wz * 1e3,
        J: it * 1e4,
      },
    };
  }),
);
const roundProfiles = Object.entries(TIBNOR_ROUND_ROWS).flatMap(([series, rows]) =>
  rows.map(([D, t, massPerMeter, A, i, w, it]) => ({
    ...sectionTemplate('chs'),
    id: 'tibnor-2023-' + series.toLowerCase() + '-' + D + 'x' + t,
    revision: 1,
    name: series + ' ' + D + 'x' + t,
    family: series === 'KCKR' ? 'Runda svetsade' : 'Runda sömlösa',
    aliases: [series + ' ' + String(D).replace('.', ',') + 'x' + String(t).replace('.', ',')],
    standard: 'S355J2H · SS-EN ' + (series === 'KCKR' ? '10219' : '10210'),
    source: 'Tibnors konstruktionstabeller 2023 · tabell 010 · ' + TIBNOR_SOURCE,
    density: 7850,
    parameters: Object.entries({ D, t }).map(([name, value]) => ({ name, value })),
    catalog: {
      A,
      massPerMeter,
      Ix: i * 1e4,
      Iy: i * 1e4,
      Wx: w * 1e3,
      Wy: w * 1e3,
      ...(it === undefined ? {} : { J: it * 1e4 }),
    },
  })),
);
const teeProfiles = TIBNOR_T_ROWS.map(
  ([name, H, B, t, Rk, Rf, R1, A, massPerMeter, cy, iy, iz, wy, wz]) => ({
    ...roundedTeeTemplate(),
    id: 'tibnor-2023-t-' + name.slice(1),
    revision: 1,
    name: 'T ' + name.slice(1),
    family: 'T',
    standard: 'S235JR',
    source: 'Tibnors konstruktionstabeller 2023 · tabell 012 · ' + TIBNOR_SOURCE,
    density: 7850,
    parameters: Object.entries({ B, H, tw: t, tf: t, Rk, Rf, R1 }).map(([name, value]) => ({
      name,
      value,
    })),
    catalog: {
      A,
      massPerMeter,
      Ix: iy * 1e4,
      Iy: iz * 1e4,
      Wx: wy * 1e3,
      WxMinus: wy * 1e3,
      Wy: wz * 1e3,
      cx: 0,
      cy: H / 2 - cy,
    },
  }),
);
export const TIBNOR_PROFILES = [
  ...beamProfiles,
  ...channelProfiles,
  ...taperedChannels,
  ...angleProfiles,
  ...hollowProfiles,
  ...roundProfiles,
  ...teeProfiles,
];
const builtinIds = new Set(TIBNOR_PROFILES.map((p) => p.id));
export const isTibnorProfile = (p) => builtinIds.has(p.id);

// Built-ins are bundled offline; only personal definitions go into browser storage.
// A conflicting imported catalog definition must never silently replace source data.
export const withTibnorCatalog = (personal) => mergeLibrary(TIBNOR_PROFILES, personal);
export const personalProfiles = (profiles) =>
  profiles.filter((p) => !(isTibnorProfile(p) && p.revision === 1));
