import { evaluateBlock } from './definition.js';
/** Detached definition history and test values; adapters own geometry and commits. */
export class BlockSession {
  constructor(definition, validate = () => {}) {
    this.definition = structuredClone(definition);
    this.validate = validate;
    this.values = {};
    this.past = [];
    this.future = [];
    this.evaluate();
  }
  evaluate() {
    const result = evaluateBlock(this.definition, this.values);
    this.validate(result, this.definition);
    return result;
  }
  change(edit) {
    const previous = structuredClone(this.definition);
    const testValues = this.values;
    try {
      edit(this.definition);
      this.values = {};
      this.evaluate();
    } catch (error) {
      this.definition = previous;
      this.values = testValues;
      throw error;
    }
    this.past.push(previous);
    this.past = this.past.slice(-100);
    this.future = [];
  }
  test(values) {
    const previous = this.values;
    this.values = { ...values };
    try {
      return this.evaluate();
    } catch (error) {
      this.values = previous;
      throw error;
    }
  }
  undo(redo = false) {
    const from = redo ? this.future : this.past,
      to = redo ? this.past : this.future;
    if (!from.length) return;
    to.push(this.definition);
    this.definition = from.pop();
    this.values = {};
    return this.evaluate();
  }
  release() {
    this.definition = null;
    this.values = {};
    this.past = [];
    this.future = [];
  }
}
