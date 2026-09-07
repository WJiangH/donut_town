import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function loadTown() {
  const scope = {window: {location: {search: ''}}, document: {addEventListener() {}}};
  scope.window.window = scope.window;
  for (const file of ['../assets/town-walkmask.js', '../town-collision.js', '../assets/town-zones-auto.js', '../town-zones.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    new Function('window', 'document', 'atob', source)(scope.window, scope.document, atob);
  }
  return scope.window;
}

const {TownCollision, TownZones} = loadTown();
const ALL_ACTIONS = Object.fromEntries(
  ['sitChair', 'sitGrass', 'coffee', 'read', 'garden', 'lookout', 'experiment'].map(id => [id, {}])
);

test('every tagged spot in town stands on ground a character can reach', () => {
  assert.equal(TownZones.ready, true);
  const townZones = TownZones.list.filter(zone => zone.scene === 'town');
  assert.ok(townZones.length >= 150, `only ${townZones.length} tags in town`);
  assert.ok(townZones.filter(zone => zone.measured).length >= 100);
  for (const zone of townZones) {
    assert.ok(TownCollision.isWalkable(zone.anchor.x, zone.anchor.y), `${zone.note} stands off the map`);
    const path = TownCollision.findPath({x: 50, y: 59}, zone.anchor);
    assert.ok(path.length, `${zone.note} cannot be walked to`);
  }
});

test('every action has somewhere to happen, in more than one corner of town', () => {
  const spread = {};
  for (const zone of TownZones.list.filter(zone => zone.scene === 'town')) {
    for (const pose of [zone.action].flat()) (spread[pose] ??= []).push(zone);
  }
  for (const pose of ['sitChair', 'sitGrass', 'coffee', 'read', 'lookout', 'garden']) {
    assert.ok(spread[pose]?.length >= 4, `${pose} has only ${spread[pose]?.length ?? 0} places`);
  }
  assert.ok(spread.garden.filter(zone => zone.x > 72 && zone.y < 27).length >= 10, 'the farm should be full of garden tags');
});

test('a character only settles into poses their art actually has', () => {
  const bench = TownZones.list.find(zone => zone.note === 'fountain west bench');
  assert.ok(TownZones.zoneFor(bench.anchor, 'town', ALL_ACTIONS, []));
  assert.equal(TownZones.zoneFor(bench.anchor, 'town', {coffee: {}}, []), null);
  assert.equal(TownZones.zoneFor(bench.anchor, 'town', undefined, []), null);
});

test('an occupied bench is left alone, an occupied lawn still has room', () => {
  const bench = TownZones.list.find(zone => zone.note === 'fountain west bench');
  const sitter = [{x: bench.anchor.x, y: bench.anchor.y, action: 'sitChair'}];
  const taken = TownZones.zoneFor(bench.anchor, 'town', {sitChair: {}}, sitter);
  assert.equal(taken, null);
  const meadow = TownZones.list.find(zone => zone.note === 'south-east meadow');
  const one = [{x: meadow.anchor.x, y: meadow.anchor.y, action: 'sitGrass'}];
  assert.ok(TownZones.zoneFor(meadow.anchor, 'town', {sitGrass: {}}, one));
});

test('poses start only after standing still for a moment', () => {
  const meadow = TownZones.list.find(zone => zone.note === 'south-east meadow');
  TownZones.reset();
  assert.equal(TownZones.settle(meadow.anchor, 'town', 1000, {sitGrass: {}}, []), null);
  assert.equal(TownZones.settle(meadow.anchor, 'town', 1800, {sitGrass: {}}, []), null);
  const settled = TownZones.settle(meadow.anchor, 'town', 1000 + 1400 + 900, {sitGrass: {}}, []);
  assert.equal(settled.action, 'sitGrass');
  TownZones.reset();
  const away = {x: meadow.anchor.x + 20, y: meadow.anchor.y};
  assert.equal(TownZones.settle(away, 'town', 9000, ALL_ACTIONS, []), null);
});

test('walking up to a bench happens before sitting on it', () => {
  const bench = TownZones.list.find(zone => zone.note === 'south plaza bench');
  const nearby = {x: bench.anchor.x + 1.5, y: bench.anchor.y + 0.6};
  TownZones.reset();
  TownZones.settle(nearby, 'town', 0, {sitChair: {}}, []);
  const step = TownZones.settle(nearby, 'town', 4000, {sitChair: {}}, []);
  assert.deepEqual(step.walkTo, {x: bench.anchor.x, y: bench.anchor.y});
  const seated = TownZones.settle(bench.anchor, 'town', 9000, {sitChair: {}}, []);
  assert.equal(seated.action, 'sitChair');
});
