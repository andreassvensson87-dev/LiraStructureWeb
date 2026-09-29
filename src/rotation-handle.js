import * as THREE from 'three';
import { parseAngle } from './rotation.js';
const ns = 'http://www.w3.org/2000/svg',
  colors = { reference: '#258e79' };
function svg(tag, attributes = {}) {
  const el = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
  return el;
}
export class RotationHandle {
  constructor(host, camera, { change, pivot, commit, dragging, step }) {
    Object.assign(this, { host, camera, change, pivot, commit, dragging, step });
    this.root = svg('svg', { class: 'rotation-handle', 'aria-label': 'Rotationshandtag' });
    host.append(this.root);
    this.endMarkers = [0, 1].map(() => {
      const c = svg('circle', {
        r: 4,
        fill: 'white',
        stroke: '#258e79',
        'stroke-width': 2,
        'pointer-events': 'none',
      });
      this.root.append(c);
      return c;
    });
    this.rings = {};
    this.paths = {};
    this.labels = {};
    for (const axis of ['reference']) {
      const group = svg('g', {
        'data-rotation-ring': axis,
        role: 'button',
        'aria-label': 'Rotera runt referenslinjen',
        tabindex: 0,
      });
      const title = svg('title');
      title.textContent = 'Rotera runt referenslinjen';
      group.append(title);
      const visible = svg('path', { fill: 'none', stroke: colors[axis], 'stroke-width': 2 });
      const hit = svg('path', {
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 16,
        class: 'rotation-hit',
      });
      const label = svg('text', {
        fill: colors[axis],
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      });
      label.textContent = '';
      group.append(visible, hit, label);
      this.root.append(group);
      this.rings[axis] = group;
      this.paths[axis] = [visible, hit];
      this.labels[axis] = label;
      group.addEventListener('pointerdown', (e) => this.begin(e, axis));
      group.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.input.focus();
        }
      });
    }
    this.arc = svg('path', { fill: 'none', 'stroke-width': 4, 'pointer-events': 'none' });
    this.arrow = svg('path', { 'pointer-events': 'none' });
    this.root.append(this.arc, this.arrow);
    this.form = document.createElement('form');
    this.form.className = 'rotation-input draw-length';
    this.form.hidden = true;
    this.form.innerHTML =
      '<label for="rotation-angle">Vinkel <small>°</small></label><div><input id="rotation-angle" inputmode="decimal" autocomplete="off" value="0" aria-label="Rotationsvinkel"><button class="primary" type="submit">Rotera ↵</button></div><div class="rotation-actions"><span>Runt referenslinjen</span><button type="button" class="rotation-pivot" title="Välj två nya axelpunkter">Ny referenslinje</button></div><p role="alert"></p>';
    host.parentElement.append(this.form);
    this.input = this.form.querySelector('input');
    this.error = this.form.querySelector('p');
    this.form.querySelector('.rotation-pivot').onclick = () => this.pivot();
    this.input.oninput = () => {
      try {
        const angle = parseAngle(this.input.value);
        this.error.textContent = '';
        this.angle = angle;
        this.change(this.normal.toArray(), angle);
      } catch (e) {
        this.error.textContent = e.message;
      }
    };
    this.form.onsubmit = (e) => {
      e.preventDefault();
      try {
        const angle = parseAngle(this.input.value);
        this.angle = angle;
        this.change(this.normal.toArray(), angle);
        this.commit();
      } catch (error) {
        this.error.textContent = error.message;
      }
    };
    this.root.addEventListener('pointermove', (e) => this.move(e));
    this.root.addEventListener('pointerup', (e) => this.end(e));
    this.root.addEventListener('pointercancel', () => this.cancelDrag());
    this.root.addEventListener('lostpointercapture', () => {
      if (this.drag) this.cancelDrag();
    });
    this.hide();
  }
  show(start, end) {
    this.ends = [start, end];
    this.active = true;
    this.pick = false;
    this.origin = new THREE.Vector3(...start)
      .add(new THREE.Vector3(...end))
      .multiplyScalar(0.5)
      .toArray();
    this.normal = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize();
    const helper =
      Math.abs(this.normal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(helper, this.normal).normalize(),
      v = new THREE.Vector3().crossVectors(this.normal, u);
    this.basis = [u.toArray(), v.toArray()];
    this.axis = 'reference';
    this.angle = 0;
    this.startAngle = 0;
    this.input.value = '0';
    this.error.textContent = '';
    this.root.style.display = '';
    this.form.hidden = false;
    this.change(this.normal.toArray(), 0);
  }
  hide() {
    this.cancelDrag();
    this.active = false;
    this.root.style.display = 'none';
    this.form.hidden = true;
  }
  cancelDrag() {
    if (this.drag) {
      const id = this.drag.id;
      this.angle = this.drag.initial;
      this.input.value = String(this.angle);
      this.change(this.normal.toArray(), this.angle);
      this.drag = null;
      if (this.root.hasPointerCapture(id)) this.root.releasePointerCapture(id);
      this.dragging(false);
    }
  }
  project(angle, axis = this.axis) {
    const [u, v] = this.basis,
      point = new THREE.Vector3(...this.origin)
        .addScaledVector(new THREE.Vector3(...u), this.radius * Math.cos(angle))
        .addScaledVector(new THREE.Vector3(...v), this.radius * Math.sin(angle))
        .project(this.camera);
    return {
      x: ((point.x + 1) * this.host.clientWidth) / 2,
      y: ((1 - point.y) * this.host.clientHeight) / 2,
    };
  }
  atPointer(e) {
    const r = this.host.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        1 - ((e.clientY - r.top) / r.height) * 2,
      ),
      ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const normal = this.normal;
    if (Math.abs(ray.ray.direction.dot(normal)) < 0.025) return null;
    const point = ray.ray.intersectPlane(
      new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(...this.origin)),
      new THREE.Vector3(),
    );
    if (!point) return null;
    point.sub(new THREE.Vector3(...this.origin));
    const [u, v] = this.basis;
    return Math.atan2(point.dot(new THREE.Vector3(...v)), point.dot(new THREE.Vector3(...u)));
  }
  begin(e, axis) {
    if (e.button !== 0 || this.pick) return;
    e.preventDefault();
    e.stopPropagation();
    const angle = this.atPointer(e);
    this.startAngle = angle ?? 0;
    this.drag = {
      id: e.pointerId,
      last: angle,
      total: 0,
      initial: this.angle,
      x: e.clientX,
      y: e.clientY,
    };
    this.root.setPointerCapture(e.pointerId);
    this.dragging(true);
  }
  move(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    e.preventDefault();
    const d = this.drag,
      a = this.atPointer(e);
    if (a !== null && d.last !== null) {
      let delta = a - d.last;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      d.total += THREE.MathUtils.radToDeg(delta);
      d.last = a;
    } else {
      d.total = e.clientX - d.x - (e.clientY - d.y);
    }
    const step = this.step(),
      raw = d.initial + d.total;
    this.angle = step ? Math.round(raw / step) * step : Math.round(raw * 10) / 10;
    this.input.value = String(this.angle);
    this.error.textContent = '';
    this.change(this.normal.toArray(), this.angle);
  }
  end(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.drag = null;
    this.root.releasePointerCapture(e.pointerId);
    this.dragging(false);
    this.input.focus({ preventScroll: true });
    this.input.select();
  }
  update() {
    if (!this.active) return;
    this.radius =
      ((this.camera.top - this.camera.bottom) / this.camera.zoom / this.host.clientHeight) * 86;
    this.root.setAttribute('viewBox', `0 0 ${this.host.clientWidth} ${this.host.clientHeight}`);
    this.ends.forEach((point, i) => {
      const p = new THREE.Vector3(...point).project(this.camera);
      this.endMarkers[i].setAttribute('cx', ((p.x + 1) * this.host.clientWidth) / 2);
      this.endMarkers[i].setAttribute('cy', ((1 - p.y) * this.host.clientHeight) / 2);
    });
    for (const axis of ['reference']) {
      let d = '';
      for (let i = 0; i <= 96; i++) {
        const p = this.project((i / 96) * Math.PI * 2, axis);
        d += `${i ? 'L' : 'M'}${p.x},${p.y}`;
      }
      this.paths[axis].forEach((path) => path.setAttribute('d', d));
      this.paths[axis][0].setAttribute('stroke-width', axis === this.axis ? 3 : 1.5);
      this.rings[axis].style.opacity = this.pick ? 0.25 : axis === this.axis ? 1 : 0.65;
      this.rings[axis].style.pointerEvents = this.pick ? 'none' : '';
      const p = this.project(Math.PI / 4, axis);
      this.labels[axis].setAttribute('x', p.x + 10);
      this.labels[axis].setAttribute('y', p.y - 10);
    }
    let d = '';
    const sweep = THREE.MathUtils.degToRad(this.angle),
      n = Math.max(1, Math.ceil(Math.min(Math.abs(this.angle), 360) / 5));
    for (let i = 0; i <= n; i++) {
      const p = this.project(this.startAngle + (sweep * i) / n);
      d += `${i ? 'L' : 'M'}${p.x},${p.y}`;
    }
    this.arc.setAttribute('d', this.pick || !this.angle ? '' : d);
    this.arc.setAttribute('stroke', colors[this.axis]);
    const p = this.project(this.startAngle + sweep),
      prev = this.project(this.startAngle + sweep - Math.sign(sweep) * 0.05),
      dx = p.x - prev.x,
      dy = p.y - prev.y,
      length = Math.hypot(dx, dy) || 1,
      x = dx / length,
      y = dy / length;
    this.arrow.setAttribute(
      'd',
      this.pick || !this.angle
        ? ''
        : `M${p.x},${p.y}l${-x * 12 - y * 5},${-y * 12 + x * 5}l${y * 10},${-x * 10}Z`,
    );
    this.arrow.setAttribute('fill', colors[this.axis]);
  }
}
