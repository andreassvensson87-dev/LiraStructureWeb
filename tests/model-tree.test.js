import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelTree } from '../src/model-tree.js';

const node = () => {
  const classes = new Set();
  return {
    children: [],
    attributes: {},
    dataset: {},
    replacements: 0,
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren() {
      this.children = [];
      this.replacements++;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
};
function fixture(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: node };
  const hidden = new Set(),
    picks = [];
  const tree = Object.assign(Object.create(ModelTree.prototype), {
    root: node(),
    search: { value: '' },
    group: { value: 'type' },
    closed: new Set(),
    isolateButton: {},
    visible: (id) => !hidden.has(id),
    selectable: () => true,
    select: (id) => picks.push(id),
    toggle: (id) => hidden.add(id),
  });
  const objects = ['a', 'b'].map((id, i) => ({
    id,
    type: 'plate',
    name: id,
    prefix: 'P',
    number: i + 1,
    material: { name: 'Stål' },
    section: { name: 'Profil' },
    thickness: 10,
  }));
  try {
    run(tree, objects, hidden, picks);
  } finally {
    globalThis.document = previous;
  }
}

test('geometry-only edits retain model rows, groups and selection and visibility controls', () => {
  fixture((tree, objects, hidden, picks) => {
    tree.render(objects, new Set(['a']));
    const group = tree.root.children[0],
      pick = tree.rows.get('a');
    group.open = false;
    const changed = [{ ...objects[0], thickness: 20 }, objects[1]];
    hidden.add('a');
    tree.render(changed, new Set(['b']));
    assert.equal(tree.root.replacements, 1);
    assert.equal(tree.root.children[0], group);
    assert.equal(group.open, false);
    assert.equal(tree.rows.get('a'), pick);
    assert.equal(pick.classList.contains('selected'), false);
    assert.equal(tree.rows.get('b').classList.contains('selected'), true);
    assert.equal(tree.visibilityRows.get('a').eye.attributes['aria-label'], 'Visa P-001');
    assert.equal(tree.visibilityRows.get('a').row.classList.contains('muted'), true);
    pick.onclick({ shiftKey: false });
    assert.deepEqual(picks, ['a']);
    assert.equal(tree.objects, changed);
  });
});

test('renaming, identity, material, search, grouping and membership changes refresh the list', () => {
  fixture((tree, objects) => {
    tree.render(objects);
    objects[0].name = 'Ny plåt';
    tree.render(objects);
    assert.match(tree.rows.get('a').title, /Ny plåt/);
    objects[0].number = 3;
    tree.render(objects);
    assert.equal(tree.rows.get('a').textContent, 'P-003');
    objects[0].material.name = 'Betong';
    tree.group.value = 'material';
    tree.render(objects);
    assert.equal(tree.root.children[0].children[0].textContent, 'Betong · 1');
    tree.search.value = 'Ny plåt';
    tree.render(objects);
    assert.deepEqual([...tree.rows.keys()], ['a']);
    tree.search.value = '';
    tree.group.value = 'none';
    tree.render([objects[1], objects[0]]);
    assert.deepEqual([...tree.rows.keys()], ['b', 'a']);
    tree.render([objects[0]]);
    assert.deepEqual([...tree.rows.keys()], ['a']);
    tree.render([]);
    assert.equal(tree.root.children[0].textContent, 'Inga objekt ännu.');
  });
});

test('assembly groups select whole membership, search by mark and refresh after edits', () => {
  fixture((tree, objects) => {
    const assemblies = [
        { id: 'as', mark: 'A-001', name: 'Balkpar', mainId: 'a', memberIds: ['a', 'b'] },
      ],
      picks = [];
    tree.selectGroup = (ids, add) => picks.push({ ids, add });
    tree.group.value = 'assembly';
    tree.render(objects, new Set(['a']), assemblies);
    const button = tree.groupSelections.get('as').button;
    assert.equal(button.classList.contains('selected'), false);
    button.onclick({ shiftKey: true, preventDefault() {}, stopPropagation() {} });
    assert.deepEqual(picks, [{ ids: ['a', 'b'], add: true }]);
    tree.setSelection(new Set(['a', 'b']));
    assert.equal(button.classList.contains('selected'), true);
    tree.search.value = 'A-001';
    tree.render(objects, new Set(), assemblies);
    assert.deepEqual([...tree.rows.keys()], ['a', 'b']);
    const replacementCount = tree.root.replacements;
    const renamed = [{ ...assemblies[0], name: 'Renamed' }];
    tree.render(objects, new Set(), renamed);
    assert.equal(tree.root.replacements, replacementCount + 1);
    assert.match(tree.root.children[0].children[0].textContent, /Renamed/);
    tree.search.value = '';
    tree.render(objects, new Set(), []);
    assert.equal(tree.groupSelections.size, 0);
    assert.match(tree.root.children[0].children[0].textContent, /Utan assembly/);
  });
});
