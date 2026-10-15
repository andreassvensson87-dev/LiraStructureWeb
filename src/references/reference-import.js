import * as THREE from 'three';
import { edgeIndex } from './edge-index.js';

import { cadReferenceParts } from './cad-geometry.js';

import { encodeReference } from './reference-state.js';
import { initialReferencePlacement } from './reference-placement.js';
import { cadLayers } from './cad-layers.js';

export class ReferenceImport {
  constructor({
    getModels,
    commitModel,
    dispose,
    busy,
    message,
    progress,
    onSelect,
    changed,
    fit,
    bounds,
  }) {
    Object.assign(this, {
      getModels,
      commitModel,
      dispose,
      busy,
      message,
      progress,
      onSelect,
      changed,
      fit,
      bounds,
    });
    this.worker = null;
    this.pending = [];
    this.completeImport = null;
  }
  cancel() {
    this.worker?.terminate();
    this.worker = null;
    this.completeImport?.(false);
    this.completeImport = null;
    this.dispose(this.pending || []);
    this.pending = [];
    this.busy(false);
  }
  async load(file, { replaceId = null, saved = null, onComplete = null } = {}) {
    const format = file.name.split('.').at(-1).toUpperCase();
    if (format !== 'IFC' && file.size > 10 * 1024 * 1024) {
      this.message('CAD-filen får vara högst 10 MB.', true);
      onComplete?.(false);
      return;
    }
    this.cancel();
    this.completeImport = onComplete;
    this.busy(true);
    this.progress(0);
    this.message(`Läser ${format}…`);
    let worker;
    try {
      worker =
        format === 'IFC'
          ? new Worker(new URL('./ifc.worker.js', import.meta.url), { type: 'module' })
          : new Worker(new URL('./cad.worker.js', import.meta.url), { type: 'module' });
    } catch {
      this.cancel();
      this.message(`${format}-läsaren kunde inte starta.`, true);
      return;
    }
    this.worker = worker;
    this.pending = [];
    let source;
    const fail = (message) => {
      if (this.worker !== worker) return;
      this.cancel();
      this.message(message, true);
    };
    worker.onerror = () => fail(`${format}-läsaren kunde inte starta eller slutföra importen.`);
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      if (data.type === 'error') {
        fail(data.message);
        return;
      }
      if (data.type === 'progress') {
        this.progress(data.value);
        return;
      }
      if (data.type === 'cad') {
        try {
          this.pending = cadReferenceParts(data.entities);
          worker.onmessage({
            data: {
              ...data,
              layers: data.layers || cadLayers(data.entities),
              type: 'done',
              schema: format,
            },
          });
        } catch (error) {
          fail(error.message || 'CAD-geometrin kunde inte visas.');
        }
        return;
      }
      if (data.type === 'mesh') {
        try {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
          geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(...data.color),
            roughness: 0.85,
            metalness: 0,
            side: THREE.DoubleSide,
            transparent: data.opacity < 1,
            opacity: data.opacity,
            depthWrite: data.opacity >= 1,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.fromArray(data.origin);
          mesh.userData = {
            ifcId: data.id,
            ifcType: data.ifcType,
            name: data.name,
            globalId: data.globalId,
            profileEvidence: data.profileEvidence,
          };
          this.pending.push({
            mesh,
            edges: data.edges,
            index: edgeIndex(data.edges),
            opacity: data.opacity,
          });
        } catch {
          fail('Geometrin kunde inte visas. Prova en mindre IFC-fil.');
        }
        return;
      }
      if (data.type === 'done') {
        const previous = this.getModels().find((m) => m.id === replaceId);
        const model = {
          id: saved?.id || previous?.id || crypto.randomUUID(),
          title: previous?.title || file.name,
          fileName: file.name,
          folder: previous?.folder || 'Standard',
          schema: data.schema,
          format,
          source,
          coordinateMode: saved?.coordinateMode || previous?.coordinateMode || 'map',
          sourceCoordinates: data.sourceCoordinates || null,
          placement: structuredClone(previous?.placement || initialReferencePlacement()),
          locked: previous?.locked || false,
          ...(format !== 'IFC'
            ? {
                placement: structuredClone(
                  previous?.placement || { offset: [0, 0, 0], rotation: 0, scale: 1 },
                ),
                unitFactor: previous?.unitFactor ?? data.unitFactor ?? 1,
                unitKnown: previous?.placement ? previous.unitKnown : data.unitKnown,
                skipped: data.skipped || [],
                layers: data.layers || [],
                layerVisibility: { ...previous?.layerVisibility },
              }
            : {}),
          group: new THREE.Group(),
          parts: this.pending,
          transparent: previous?.transparent || false,
          corners: previous?.corners ?? true,
          edges: previous?.edges ?? true,
        };
        this.pending = [];
        model.group.visible = previous?.group.visible ?? true;
        for (const part of model.parts) {
          if (model.transparent) {
            part.mesh.material.transparent = true;
            part.mesh.material.opacity = 0.3;
            part.mesh.material.depthWrite = false;
          }
          model.group.add(part.mesh);
        }
        try {
          this.commitModel(model, previous, saved);
        } catch (error) {
          this.dispose(model.parts);
          fail(error.message);
          return;
        }
        worker.terminate();
        this.worker = null;
        this.busy(false);
        this.onSelect?.(model);
        this.completeImport?.(true);
        this.completeImport = null;
        this.changed();
        this.message(
          `${format} importerad.${data.skipped?.length ? ' Vissa objekt saknar stöd; se referensens uppgifter.' : ''}`,
        );
        if (model.group.visible && !saved) this.fit(this.bounds());
      }
    };
    try {
      const bytes = await file.arrayBuffer();
      if (this.worker === worker) {
        source = saved?.source || encodeReference(bytes);
        worker.postMessage(format === 'IFC' ? bytes : { bytes, format }, [bytes]);
      }
    } catch {
      if (this.worker === worker) fail('Filen kunde inte läsas.');
    }
  }
}
