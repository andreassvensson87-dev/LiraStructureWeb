import { appendVectorDrawing } from './drawing-vector.js';
import { geometryEdges } from './fasteners/edges.js';
import { referenceCandidates } from './annotation-references.js';
import { partHoleCandidates } from './fasteners/drawing.js';
import { partViewFrame } from './part-view-frame.js';
import { migratePartOrientation } from './part-section-orientation.js';
import { detailSource } from './drawing-details.js';
import { frameMatrix } from './drawing-sections.js';
import { resizeDrawingView, setDrawingViewScale } from './drawing-views.js';
import * as THREE from 'three';
import { sectionFrame, sectionDrawing, sectionVectors } from './drawing-sections.js';
const NS = 'http://www.w3.org/2000/svg';
function node(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
}
export class PartSections {
  constructor(editor) {
    this.e = editor;
    this.cache = new Map();
    const label = document.createElement('label');
    label.textContent = 'Vy · skala 1:';
    this.scale = document.createElement('input');
    this.scale.type = 'number';
    this.scale.min = '.1';
    this.scale.max = '1000';
    this.scale.step = 'any';
    label.append(this.scale);
    editor.dialog.querySelector('.view-properties').append(label);
    this.scale.onchange = () => {
      const view = this.selected(),
        scale = Number(this.scale.value);
      if (view && Number.isFinite(scale) && scale >= 0.1 && scale <= 1000) {
        setDrawingViewScale(view, scale);
        this.build();
        editor.compose();
      }
    };
  }
  get items() {
    return (this.e.config.views || []).filter((v) => v.section || v.detail || v.standard);
  }
  crop(view, corner, delta) {
    Object.assign(this.selected(), resizeDrawingView(view, corner, delta));
    this.build();
  }
  selected() {
    return this.items.find((v) => v.id === this.e.selectedView);
  }
  markers(parentId) {
    return this.items.filter((v) => v.section && v.source.parentViewId === parentId);
  }
  frame(view, orientation = 'source') {
    if (view.detail) return this.frame(detailSource(view, this.e.config.views), orientation);
    if (view.section) {
      const parent = this.e.config.views.find((v) => v.id === view.source.parentViewId);
      return sectionFrame(
        this.frame(parent, orientation),
        view.section.points,
        view.section.side,
        orientation,
      );
    }
    return partViewFrame(view.projection || view.id);
  }
  data(view) {
    const frame = this.frame(view),
      source = detailSource(view, this.e.config.views),
      section = source.section || (source.id === 'section' ? { depth: 1e7 } : null);
    let data;
    if (section) data = sectionDrawing([this.e.geometry], frame, section.depth);
    else {
      const g = this.e.geometry.clone().applyMatrix4(frameMatrix(frame)),
        edges = geometryEdges(g, 5),
        p = edges.attributes.position,
        behind = [];
      for (let i = 0; i < p.count; i += 2)
        behind.push([
          [p.getX(i), p.getY(i)],
          [p.getX(i + 1), p.getY(i + 1)],
        ]);
      const candidates = [],
        identities = [],
        inverse = frameMatrix(frame).invert();
      for (let i = 0; i < p.count; i += 2) {
        for (const t of [0, 0.5, 1]) {
          const point = new THREE.Vector3()
            .fromBufferAttribute(p, i)
            .lerp(new THREE.Vector3().fromBufferAttribute(p, i + 1), t);
          candidates.push([point.x, point.y]);
          identities.push(point.applyMatrix4(inverse).toArray());
        }
      }
      data = { cut: [], behind, ...(view.standard ? { candidates, identities } : {}) };
      edges.dispose();
      g.dispose();
    }
    return { ...data, frame, section };
  }
  build() {
    migratePartOrientation(this.e.record, (view, orientation) => this.frame(view, orientation));
    this.cache.clear();
    for (const view of this.items) {
      const data = this.data(view);
      data.vectors = sectionVectors(this.e.geometry, data.frame, data.section);
      data.holeCenters = !data.section
        ? partHoleCandidates(this.e.holeSchedule || [], data.frame, this.e.drawingReflection)
        : [];
      this.cache.set(view.id, data);
      this.e.annotationCandidates[view.id] = referenceCandidates(
        data.candidates || [...data.cut, ...data.behind].flat(),
        'part',
        data.identities,
      );
      this.e.annotationCandidates[view.id].push(...data.holeCenters.map((h) => h.point));
    }
  }
  commit(view) {
    if (view.section) {
      const data = sectionDrawing([this.e.geometry], this.frame(view), view.section.depth),
        size = data.bounds.getSize(new THREE.Vector2());
      view.camera.center = data.bounds.getCenter(new THREE.Vector2()).toArray();
      view.size = [Math.max(25, size.x / view.scale + 12), Math.max(25, size.y / view.scale + 12)];
    }
    this.e.config.views.push(view);
    this.build();
    this.e.compose();
    this.e.selectView(view.id);
  }
  update(view) {
    if (view.section) {
      const data = sectionDrawing([this.e.geometry], this.frame(view), view.section.depth);
      view.camera.center = data.bounds.getCenter(new THREE.Vector2()).toArray();
    }
    this.build();
    this.e.compose();
    this.e.selectView(view.id);
  }
  sync() {
    const view = this.selected();
    this.scale.parentElement.hidden = !view;
    if (view) this.scale.value = view.scale;
    this.e.$('hidden-lines').parentElement.hidden = false;
    if (view) this.e.$('hidden-lines').checked = !!view.settings.hiddenLines;
    this.e.sectionTool?.sync();
  }
  options() {
    const select = this.e.$('selected-view');
    select.replaceChildren(...this.e.config.views.map((view) => new Option(view.name, view.id)));
    select.value = this.e.selectedView;
  }
  project(p, view) {
    return [
      view.position[0] + view.size[0] / 2 + (p[0] - view.camera.center[0]) / view.scale,
      view.position[1] + view.size[1] / 2 - (p[1] - view.camera.center[1]) / view.scale,
    ];
  }
  paint() {
    const e = this.e;
    for (const view of this.items) {
      const data = this.cache.get(view.id);
      if (!data) continue;
      const g = node('g', { 'data-view': view.id, transform: `translate(${view.position})` }),
        [w, h] = view.size,
        clipId = 'part-section-' + view.id,
        defs = node('defs', {}),
        clip = node('clipPath', { id: clipId });
      clip.append(node('rect', { width: w, height: h }));
      defs.append(clip);
      g.append(defs);
      const content = node('g', { 'clip-path': `url(#${clipId})` });
      const project = (p) => [
        w / 2 + (p[0] - view.camera.center[0]) / view.scale,
        h / 2 - (p[1] - view.camera.center[1]) / view.scale,
      ];
      appendVectorDrawing(content, data.vectors, project, { hidden: view.settings.hiddenLines });
      for (const hole of data.holeCenters) {
        const [x, y] = project(hole.point);
        const r = hole.diameter / (2 * view.scale) + 1;
        content.append(
          node('path', {
            'data-bore-center': hole.point.reference.featureId,
            d: `M${x - r},${y}H${x + r}M${x},${y - r}V${y + r}`,
            fill: 'none',
            stroke: '#506974',
            'stroke-width': 0.12,
            'pointer-events': 'none',
          }),
        );
      }
      content.append(
        node('path', {
          d: data.cut.map(([a, b]) => `M${project(a)}L${project(b)}`).join(''),
          stroke: '#20343b',
          'stroke-width': 0.4,
          fill: 'none',
        }),
      );
      g.append(content);
      e.frame(g, view.id, 0, 0, w, h);
      g.setAttribute('aria-label', 'Välj ' + view.name);
      if (e.selectedView === view.id) {
        const r = 4 / e.navigation.scale;
        for (const [corner, x, y] of [
          ['nw', 0, 0],
          ['ne', w, 0],
          ['se', w, h],
          ['sw', 0, h],
        ])
          g.append(
            node('rect', {
              'data-section-crop': corner,
              x: x - r,
              y: y - r,
              width: 2 * r,
              height: 2 * r,
              fill: 'white',
              stroke: '#287c65',
              'stroke-width': 1,
              'vector-effect': 'non-scaling-stroke',
              cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
            }),
          );
      }
      e.svg.append(g);
    }
  }
}
