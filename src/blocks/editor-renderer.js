import * as THREE from 'three';
import { createModelViewport } from '../model/viewport.js';
import { createObjectMesh } from '../model/object-mesh.js';
import { paintDrawingObject } from '../drawing-object-renderer.js';
import { modelBlockMembers } from './model-adapter.js';
import { drawingBlockMembers } from './drawing-adapter.js';
import { blockPoints } from './point-bindings.js';
import { renderBindingGuides } from './binding-guides-renderer.js';
import { createBlockLabels } from './editor-labels.js';
const NS = 'http://www.w3.org/2000/svg';
const svgNode = (tag, attrs) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
/** Preview uses the application's existing geometry and SVG renderers. It owns disposable resources. */
export function createBlockPreview(host, dimension, onPoint, onError, onReference) {
  const labels = onReference ? createBlockLabels(host, onReference) : null;
  let viewport,
    group,
    svg,
    fit = true;
  const pointMaterials = [false, true].map((selected) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d');
    context.fillStyle = selected ? '#e89a30' : '#f8fbfa';
    context.fillRect(4, 4, 24, 24);
    context.strokeStyle = selected ? '#805215' : '#287c65';
    context.lineWidth = 4;
    context.strokeRect(4, 4, 24, 24);
    return new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
      sizeAttenuation: false,
    });
  });
  if (dimension === 3) {
    viewport = createModelViewport(host, onError);
    viewport.renderer.setAnimationLoop(() => {
      viewport.navigation.controls.update();
      const scale =
        ((viewport.camera.top - viewport.camera.bottom) /
          viewport.camera.zoom /
          Math.max(host.clientHeight, 1)) *
        12;
      group?.children
        .filter((child) => child.userData.blockPoint)
        .forEach((child) => child.scale.set(scale, scale, 1));
      viewport.renderer.render(viewport.scene, viewport.camera);
      labels?.project((position) => {
        const p = new THREE.Vector3(...position).project(viewport.camera);
        return Math.abs(p.z) <= 1
          ? [((p.x + 1) * host.clientWidth) / 2, ((1 - p.y) * host.clientHeight) / 2]
          : null;
      });
    });
  } else {
    svg = svgNode('svg', { 'aria-label': 'Blockförhandsvisning', role: 'img' });
    host.append(svg);
  }
  const clear = () => {
    if (group) {
      viewport.scene.remove(group);
      group.traverse((child) => {
        if (child.userData.blockPoint) return;
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material?.dispose();
      });
      group = null;
    }
    svg?.replaceChildren();
  };
  return {
    render(definition, result, points = new Set(), highlighted = [], referenceId) {
      const active = new Set(highlighted),
        entries = [];
      const selected = new Set(points || []);
      clear();
      if (viewport) {
        const members = modelBlockMembers(definition, result.values);
        group = new THREE.Group();
        for (const object of members)
          group.add(createObjectMesh(object, { selectedIds: new Set(), model: members }));
        const bounds = new THREE.Box3().setFromObject(group),
          size = bounds.getSize(new THREE.Vector3()),
          center = bounds.getCenter(new THREE.Vector3());
        for (const reference of result.references) {
          const axes = [0, 1, 2].filter((axis) => axis !== reference.axis),
            corners = [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ].map((sign) => {
              const p = center.toArray();
              p[reference.axis] = reference.coordinate;
              axes.forEach(
                (axis, i) => (p[axis] += sign[i] * Math.max(size.toArray()[axis] / 2, 100)),
              );
              return p;
            });
          entries.push({ reference, position: corners[0], active: active.has(reference.id) });
          if (onReference) {
            const geometry = new THREE.BufferGeometry().setFromPoints(
              corners.map((p) => new THREE.Vector3(...p)),
            );
            geometry.setIndex([0, 1, 2, 0, 2, 3]);
            const plane = new THREE.Mesh(
              geometry,
              new THREE.MeshBasicMaterial({
                color: '#e89a30',
                transparent: true,
                opacity: active.has(reference.id) ? 0.08 : 0,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            );
            plane.userData.blockReference = reference.id;
            group.add(plane);
          }
          group.add(
            new THREE.LineLoop(
              new THREE.BufferGeometry().setFromPoints(corners.map((p) => new THREE.Vector3(...p))),
              new THREE.LineBasicMaterial({
                color: active.has(reference.id) ? '#e89a30' : '#7b9990',
                transparent: true,
                opacity: active.has(reference.id) ? 1 : 0.45,
              }),
            ),
          );
        }
        for (const p of blockPoints(result)) {
          const dot = new THREE.Sprite(pointMaterials[Number(selected.has(p.key))]);
          dot.renderOrder = selected.has(p.key) ? 1000 : 500;
          dot.position.set(...p.point);
          dot.userData.blockPoint = p.key;
          group.add(dot);
        }
        entries.push(...renderBindingGuides(definition, result, selected, referenceId, { group }));
        viewport.scene.add(group);
        if (fit) {
          viewport.navigation.fit(bounds);
          fit = false;
        }
        viewport.renderer.domElement.onclick = (event) => {
          const rect = viewport.renderer.domElement.getBoundingClientRect(),
            ray = new THREE.Raycaster();
          ray.setFromCamera(
            new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            ),
            viewport.camera,
          );
          const hits = ray.intersectObjects(group.children);
          const candidates = hits.filter((hit) => hit.object.userData.blockPoint);
          const hit = event.shiftKey
            ? candidates.find((candidate) => !selected.has(candidate.object.userData.blockPoint)) ||
              candidates[0]
            : candidates[0];
          if (hit) onPoint(hit.object.userData.blockPoint, event.shiftKey);
          else {
            const reference = hits.find((candidate) => candidate.object.userData.blockReference);
            if (reference) onReference?.(reference.object.userData.blockReference);
          }
        };
      } else {
        const members = drawingBlockMembers(
          definition,
          result.values,
          undefined,
          definition.units === 'paper' ? 'paper' : 'preview',
        );
        const geometryPoints = result.members.flatMap((m) => m.points),
          min = [0, 1].map((i) => Math.min(...geometryPoints.map((p) => p[i]))),
          max = [0, 1].map((i) => Math.max(...geometryPoints.map((p) => p[i]))),
          span = Math.max(...max.map((v, i) => v - min[i]), 1),
          padding = span * 0.12;
        svg.setAttribute(
          'viewBox',
          `${min[0] - padding} ${-max[1] - padding} ${Math.max(max[0] - min[0], span * 0.2) + padding * 2} ${Math.max(max[1] - min[1], span * 0.2) + padding * 2}`,
        );
        const unit = span / 500,
          editor = {
            adapter: {
              project: (p) => [p[0], -p[1]],
              unit: () => unit,
              pixelScale: () => 1 / unit,
            },
            mode: 'preview',
          };
        members.forEach((member) => paintDrawingObject(editor, svg, member, false));
        result.references.forEach((reference) => {
          const coord = reference.coordinate;
          entries.push({
            reference,
            active: active.has(reference.id),
            position:
              reference.axis === 0 ? [coord, max[1] + padding / 2] : [min[0] - padding / 2, coord],
          });
          const line = svgNode(
            'line',
            reference.axis === 0
              ? {
                  x1: coord,
                  x2: coord,
                  y1: -max[1] - padding,
                  y2: -min[1] + padding,
                  stroke: active.has(reference.id) ? '#e89a30' : '#7b9990',
                  'stroke-width': unit,
                  'stroke-dasharray': `${4 * unit} ${4 * unit}`,
                }
              : {
                  x1: min[0] - padding,
                  x2: max[0] + padding,
                  y1: -coord,
                  y2: -coord,
                  stroke: active.has(reference.id) ? '#e89a30' : '#7b9990',
                  'stroke-width': unit,
                  'stroke-dasharray': `${4 * unit} ${4 * unit}`,
                },
          );
          line.style.cursor = 'pointer';
          line.onclick = () => onReference?.(reference.id);
          svg.append(line);
        });
        entries.push(
          ...renderBindingGuides(definition, result, selected, referenceId, { svg, node: svgNode }),
        );
        for (const p of blockPoints(result)) {
          const dot = svgNode('rect', {
            x: p.point[0] - 5 * unit,
            y: -p.point[1] - 5 * unit,
            width: 10 * unit,
            height: 10 * unit,
            fill: selected.has(p.key) ? '#e89a30' : '#f8fbfa',
            stroke: '#287c65',
            'stroke-width': unit,
            role: 'button',
            tabindex: 0,
            'aria-pressed': selected.has(p.key),
            'aria-label': p.name,
          });
          dot.onclick = (event) => {
            // Closely spaced points can overlap on screen. Pick from their real
            // projected positions; Shift cycles through coincident members.
            const matrix = svg.getScreenCTM();
            if (!matrix) return;
            const candidates = blockPoints(result)
              .map((candidate) => {
                const x = matrix.a * candidate.point[0] - matrix.c * candidate.point[1] + matrix.e;
                const y = matrix.b * candidate.point[0] - matrix.d * candidate.point[1] + matrix.f;
                return {
                  key: candidate.key,
                  distance: Math.hypot(x - event.clientX, y - event.clientY),
                };
              })
              .filter((candidate) => candidate.distance <= 8)
              .sort((a, b) => a.distance - b.distance);
            const chosen = event.shiftKey
              ? candidates.find((candidate) => !selected.has(candidate.key)) || candidates[0]
              : candidates[0];
            if (chosen) onPoint(chosen.key, event.shiftKey);
          };
          dot.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onPoint(p.key, event.shiftKey);
            }
          };
          svg.append(dot);
        }
      }
      labels?.render(entries);
      if (svg)
        labels?.project((position) => {
          const matrix = svg.getScreenCTM();
          if (!matrix) return null;
          const rect = host.getBoundingClientRect();
          return [
            matrix.a * position[0] - matrix.c * position[1] + matrix.e - rect.left,
            matrix.b * position[0] - matrix.d * position[1] + matrix.f - rect.top,
          ];
        });
    },
    fit() {
      fit = true;
    },
    dispose() {
      clear();
      labels?.dispose();
      pointMaterials.forEach((material) => {
        material.map.dispose();
        material.dispose();
      });
      viewport?.dispose();
      svg?.remove();
    },
  };
}
