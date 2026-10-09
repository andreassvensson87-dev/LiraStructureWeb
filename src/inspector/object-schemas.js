import { editablePlate, platePropertyGroups } from '../model/plate-properties.js';
import { editableSweep, sweepPropertyGroups } from '../model/sweep-properties.js';
import { defineAttributeSchema } from './attributes.js';

const field = (key, label, type, selector, copy, extra = {}) => ({
  key,
  label,
  type,
  selector,
  copy,
  row: 'label',
  ...extra,
});
const shared = [
  field('name', 'Namn', 'text', '#inspector-name', 'name'),
  field('material', 'Material', 'custom', '.material-quick-row', 'material', { row: 'self' }),
  field('color', 'Objektfärg', 'custom', '#object-color-toggle', 'color', {
    row: 'self',
    inline: true,
  }),
];
const identity = {
  key: 'identity',
  label: 'Numrering',
  collapsible: false,
  content: '#identity-fields',
  id: 'sweep-identity-details',
};
export const objectInspectorSchemas = {
  sweep: defineAttributeSchema({
    key: 'sweep',
    mode: 'sweepProperties',
    noun: 'sweeps',
    className: 'sweep-inspector',
    editable: editableSweep,
    copyGroups: sweepPropertyGroups,
    unchecked: ['name'],
    isCreating: ({ drawing, operation }) => drawing && !operation,
    labels: '#form label, #inspector-identity, #identity-fields label',
    lockContainers: '#form, #material-panel',
    sections: [
      identity,
      {
        key: 'placement',
        collapsible: false,
        label: 'Insättning',
        content: '.profile-preview',
        className: 'sweep-preview-details',
        summaryId: 'sweep-placement-summary',
      },
    ],
    captions: [{ selector: '.profile-source', label: 'Profilkälla' }],
    fields: [
      ...shared,
      field('profile', 'Form', 'select', '#profile', 'profile'),
      field('width', 'Bredd', 'number', '#width', 'profile', { unit: 'mm' }),
      field('height', 'Höjd', 'number', '#height', 'profile', { unit: 'mm' }),
      field('thickness', 'Tjocklek', 'number', '#thickness', 'profile', { unit: 'mm' }),
      field('libraryProfile', 'Profil', 'custom', '#profile-quick-picker', 'profile', {
        row: 'self',
      }),
      field('rotation', 'Profilrotation', 'number', '#rotation', 'rotation', { unit: '°' }),
      field(
        'placement',
        'Insättning',
        'custom',
        '.sweep-preview-details .attribute-section-heading',
        'placement',
        {
          row: 'self',
        },
      ),
    ],
  }),
  plate: defineAttributeSchema({
    key: 'plate',
    mode: 'plateProperties',
    noun: 'plåtar',
    className: 'plate-inspector',
    editable: editablePlate,
    copyGroups: platePropertyGroups,
    unchecked: ['name'],
    isCreating: ({ drawing, operation }) =>
      drawing && operation?.mode === 'plateCreate' && !operation.cutTargets && !operation.lineCut,
    labels:
      '#plate-form > label, #plate-plane-fields label, #inspector-identity, #identity-fields label',
    lockContainers: '#plate-form, #material-panel',
    sections: [identity],
    fields: [
      ...shared,
      field('plane', 'Arbetsplan', 'select', '#plate-plane'),
      field('thickness', 'Tjocklek', 'number', '#plate-thickness', 'thickness', { unit: 'mm' }),
      field('placement', 'Placering', 'select', '#plate-side', 'placement'),
      field('contourOffset', 'Konturoffset', 'number', '#plate-contour-offset', undefined, {
        unit: 'mm',
      }),
    ],
  }),
};
