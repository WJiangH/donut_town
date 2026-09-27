import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const browseSource = source.slice(source.indexOf('function browseNeighborDirectory('), source.indexOf('\nfunction renderResidents('));

test('arrow keys browse visible neighbors and leave search Home/End intact', () => {
  const rows = [1, 2, 3].map(id => ({
    dataset: { resident: String(id) },
    focus() { context.document.activeElement = this; },
    scrollIntoView() { this.scrolled = true; }
  }));
  const search = { id: 'neighborSearch' };
  const context = {
    document: { activeElement: search, querySelectorAll: () => rows },
    selectedResident: null,
    openResident(id) { context.selectedResident = { id }; }
  };
  vm.createContext(context);
  vm.runInContext(browseSource, context);
  function press(key, target = context.document.activeElement) {
    const event = { key, target, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    context.browseNeighborDirectory(event);
    return event;
  }
  assert.equal(press('Home', search).prevented, false);
  assert.equal(press('ArrowDown', search).prevented, true);
  assert.equal(context.selectedResident.id, 1);
  assert.equal(context.document.activeElement, rows[0]);
  press('ArrowDown');
  assert.equal(context.selectedResident.id, 2);
  assert.equal(rows[1].scrolled, true);
  press('ArrowUp');
  assert.equal(context.selectedResident.id, 1);
  press('ArrowUp');
  assert.equal(context.selectedResident.id, 1, 'the list stops at its first row');
  press('End');
  assert.equal(context.selectedResident.id, 3);
});
