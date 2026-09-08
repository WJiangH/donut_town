import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('Home returns to its entry scene, including nested visits, and stays open if saving fails', async () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const nodes = new Map();
  const transitions = [];
  let saved = true;
  const panel = {load() {}, flush: async () => saved, pause() {}};
  const context = vm.createContext({
    window: {}, document: {querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {hidden: true, inert: false, focus() {}});
      return nodes.get(selector);
    }}, housePanel: Promise.resolve(panel), currentScene: 'town',
    scene: () => ({title: {chemPod: 'Chem Pod', donutShop: 'Donut Shop', donutFactory: 'Donut Factory'}[context.currentScene]}),
    closeDrawer() {}, closeProfile() {}, updateTownSidebar() {},
    pressedKeys: new Set(), clickPath: [], themeController: null,
    transitionToScene: name => transitions.push(name)
  });
  vm.runInContext(source.slice(source.indexOf('function openHouse('), source.indexOf('document.querySelector("#houseShop").addEventListener')), context);
  for (const [scene, label] of [['town', 'town'], ['chemPod', 'Chem Pod'], ['donutShop', 'Donut Shop'], ['donutFactory', 'Donut Factory']]) {
    context.currentScene = scene;
    context.openHouse('a'.repeat(64));
    context.openHouse('b'.repeat(64));
    assert.equal(nodes.get('#leaveHouse').textContent, `Back to ${label}`);
    assert.equal(nodes.get('.app-shell').inert, true);
    saved = false;
    assert.equal(await context.closeHouse(), false);
    assert.equal(nodes.get('#houseView').hidden, false);
    assert.equal(nodes.get('.app-shell').inert, true);
    saved = true;
    assert.equal(await context.closeHouse(), true);
    assert.equal(nodes.get('#houseView').hidden, true);
    assert.equal(nodes.get('.app-shell').inert, false);
    assert.equal(context.currentScene, scene);
  }
  assert.deepEqual(transitions, [], 'returning must not re-enter/reset the original scene');
  context.openHouse();
  await context.closeHouse(true);
  assert.deepEqual(transitions, ['town'], 'explicit Town navigation still goes to Town');
});
