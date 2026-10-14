import { flangeProfile } from './bolted-endplate.js';
import { stiffenerDistance, stiffenerProfile } from './stiffener.js';
import { pickFitReference, nearestFitEnd } from './fit-placement.js';
import { fastenerSeriesKey } from '../fasteners/assembly.js';

const member = (object, message) => {
  if (!object || (object.type ?? 'sweep') !== 'sweep') throw Error(message);
};
const finish = (draft, changes) => ({ draft: { ...draft, ...changes }, ready: true });
const oneEnd = (draft, object, point) => {
  member(object, 'Välj en balk eller pelare.');
  return finish(draft, { references: [object.id], endA: nearestFitEnd(object, point) });
};
const bolted = (draft, object, point, bolts) => {
  if (!flangeProfile(object)) throw Error('Välj en H- eller I-profil.');
  if (!draft.references.length)
    return {
      draft: {
        ...draft,
        references: [object.id],
        ...(draft.kind === 'beamSplice' ? { endA: nearestFitEnd(object, point) } : {}),
      },
      ready: false,
    };
  if (draft.references[0] === object.id) throw Error('Välj ett annat referensobjekt.');
  const choices = bolts.filter((spec) => spec.head.kind === 'hex');
  const spec = choices.find((spec) => spec.standard === 'ISO 4017') || choices[0] || null;
  return finish(draft, {
    references: [draft.references[0], object.id],
    endB: nearestFitEnd(object, point),
    boltSpec: structuredClone(spec),
    lengthOptions: structuredClone(
      spec ? choices.filter((other) => fastenerSeriesKey(other) === fastenerSeriesKey(spec)) : [],
    ),
    holeDiameter: spec ? spec.diameter + 2 : 18,
    nearWasher: !!spec?.washer,
    farWasher: !!spec?.washer,
  });
};
export const componentPlacements = {
  fit: {
    prompts: ['Välj första profilen nära anslutningen', 'Välj andra profilen nära anslutningen'],
    pick(draft, object, point) {
      const slot = draft.references.length ? 'b' : 'a';
      const picked = pickFitReference({ a: draft.references[0], b: '' }, slot, object, point);
      return {
        draft: {
          ...draft,
          references: [...draft.references, picked.id],
          [slot === 'a' ? 'endA' : 'endB']: picked.end,
        },
        ready: slot === 'b',
      };
    },
  },
  baseplate: {
    prompts: ['Välj pelare'],
    pick(draft, object) {
      member(object, 'Välj en pelare.');
      return finish(draft, {
        references: [object.id],
        endA: object.start[2] < object.end[2] ? 'start' : 'end',
      });
    },
  },
  endplate: { prompts: ['Välj balk- eller pelarände'], pick: oneEnd },
  stiffener: {
    prompts: ['Välj H-, I- eller U-profil', 'Välj plats längs samma profil'],
    pick(draft, object, point) {
      member(object, 'Välj en H-, I- eller U-profil.');
      if (!stiffenerProfile(object)) throw Error('Välj en H-, I- eller U-profil.');
      if (draft.references.length && object.id !== draft.references[0])
        throw Error('Välj plats på samma balk eller pelare.');
      return {
        draft: {
          ...draft,
          references: [object.id],
          distance: draft.references.length
            ? Math.round(stiffenerDistance(object, point) * 10) / 10
            : Math.hypot(...object.end.map((v, i) => v - object.start[i])) / 2,
        },
        ready: !!draft.references.length,
      };
    },
  },
  boltedEndplate: {
    prompts: ['Välj H/I-pelare', 'Välj H/I-balkände mot pelarflänsen'],
    pick: bolted,
  },
  beamSplice: { prompts: ['Välj första H/I-balkänden', 'Välj andra H/I-balkänden'], pick: bolted },
};
