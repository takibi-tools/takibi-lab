const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'parfait-atelier', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const plain = value => JSON.parse(JSON.stringify(value));
function engine() {
  const context = vm.createContext({});
  for (const marker of ['const data={', 'else root.ParfaitFile=api', 'const api={difficulty']) {
    const source = scripts.find(script => script.includes(marker));
    assert(source, 'Missing inline module: ' + marker);
    vm.runInContext(source, context, { timeout: 1000 });
  }
  return { A: context.Atelier, C: context.Catalog, F: context.ParfaitFile };
}

test('the public beta compiles and keeps its storage separate from the complete edition', () => {
  for (const source of scripts) new vm.Script(source);
  new vm.Script(scripts.join('\n;\n'));
  assert.match(html, /const STORAGE='parfait-atelier-beta-v03',LEGACY_STORAGE='parfait-atelier-free-demo-v1'/);
  assert.match(html, /const key='parfait-atelier-beta-music-v03'/);
  assert.doesNotMatch(html, /localStorage\.getItem\('parfait-atelier-studio/);
  assert.doesNotMatch(html, /localStorage\.(?:clear|removeItem)\(/);
  assert.match(html, /#panel \.locked-item small\{display:block!important/);
  assert.match(html, /if\(b\.dataset\.inspect\)\{openRewards\(\);return;\}/);
});

test('saved ownership cannot grant locked materials or a larger collection', () => {
  const { A, C } = engine();
  const profile = plain(A.initial());
  assert.deepEqual(plain(profile.owned), plain(C.baseKeys));
  assert.equal(C.baseKeys.length, 27);
  profile.owned.push(...C.rewards.map(item => item.key));
  for (const item of C.rewards) assert.equal(A.owns(profile, item.key), false, item.key);
  assert.equal(A.capacity(profile), 10);
  assert.throws(() => A.validate(profile));
  assert.throws(() => A.encode(profile));
  assert.throws(() => A.decode(JSON.stringify({ format: 'parfait-atelier-beta-backup', version: 1, profile })));
});

test('completing twelve quests never creates a reward or changes allowed materials', () => {
  const { A, C } = engine();
  let profile = A.enterMode(A.initial(), 'daily');
  for (let count = 0; count < 12; count++) {
    const quest = A.questById(profile.quest);
    const topId = Number(quest.keys.find(key => key.startsWith('top:')).split(':')[1]);
    const layerId = Number(quest.keys.find(key => key.startsWith('layer:')).split(':')[1]);
    profile.draft = {
      ...plain(A.initialDesign()),
      layers: [layerId],
      tops: [{ id: topId, x: 200 + count * 15, y: 280, size: 100, angle: 0 }]
    };
    const result = A.complete(profile, { keep: false });
    profile = result.profile;
    assert.equal(result.gift, false);
    assert.equal(A.credits(profile), 0);
    assert.equal(A.available(profile), 0);
    assert.equal(profile.pendingGift, null);
    assert.deepEqual(plain(profile.boxRewards), []);
    assert.deepEqual(plain(profile.owned), plain(C.baseKeys));
    assert.throws(() => A.openBox(profile), /ベータ版では使用できません/);
    profile = A.decode(A.encode(profile));
    const next = profile.board.slots.find(slot => !slot.done);
    profile = next ? A.selectQuest(profile, next.id) : A.nextBoard(profile);
  }
  assert.equal(profile.questRuns.length, 12);
  assert.equal(profile.board.round, 5);
});

test('individual files reject every kind of locked ingredient', () => {
  const { A, C, F } = engine();
  for (const item of C.rewards.filter(item => item.category !== 'album')) {
    const design = plain(A.initialDesign());
    if (item.category === 'glass') design.glass = item.id;
    else if (item.category === 'layer') design.layers.push(item.id);
    else if (item.category === 'scene') design.scene = item.id;
    else design.tops.push({ id: item.id, x: 350, y: 280, size: 100, angle: 0 });
    const file = JSON.stringify({ format: 'parfait-atelier', version: 4, design });
    assert.throws(() => F.decode(file), /ベータ版では使用できません/, item.key);
    assert.throws(() => F.encode(design), /ベータ版では使用できません/, item.key);
    assert.throws(() => A.checkAccess(A.initial(), design), /ベータ版では使用できません/, item.key);
  }
  const base = plain(A.initialDesign());
  assert.deepEqual(plain(F.decode(F.encode(base))), base);
});

test('complete-edition backups and fabricated pending rewards cannot be imported', () => {
  const { A, C } = engine();
  const profile = plain(A.initial());
  assert.throws(() => A.decode(JSON.stringify({ format: 'parfait-atelier-backup', version: 5, profile })), /完全版/);
  for (const patch of [{ pendingGift: C.rewards[0].key }, { boxRewards: [C.rewards[0].key] }]) {
    const altered = { ...profile, ...patch };
    assert.throws(() => A.decode(JSON.stringify({ format: 'parfait-atelier-beta-backup', version: 1, profile: altered })), /ベータ版では使用できません/);
  }
});

test('legacy beta migration preserves duplicate-looking works without ID collisions', () => {
  const { A, C } = engine();
  const design = plain(A.initialDesign());
  const second = { ...plain(design), title: '別の名前', scene: 'night' };
  assert.equal(A.fingerprint(design), A.fingerprint(second));
  const old = {
    format: 'parfait-atelier-demo-backup', version: 1,
    profile: {
      draft: design,
      works: [
        { id: 'work-22', createdAt: '2026-09-21T12:00:00Z', design },
        { id: 'work-23', createdAt: '2026-09-21T12:01:00Z', design: second }
      ],
      owned: C.items.map(item => item.key),
      boxRewards: C.rewards.map(item => item.key),
      pendingGift: 'album'
    }
  };
  let migrated = A.decode(JSON.stringify(old));
  assert.equal(migrated.works.length, 2);
  assert.equal(migrated.works[1].design.title, '別の名前');
  assert.equal(migrated.fingerprints.length, 1);
  assert.deepEqual(plain(migrated.owned), plain(C.baseKeys));
  assert.deepEqual(plain(migrated.boxRewards), []);
  assert.deepEqual(plain(migrated.questRuns), []);
  assert.equal(migrated.pendingGift, null);
  migrated.draft.tops[0].x += 30;
  migrated = A.complete(migrated).profile;
  assert.equal(migrated.works[0].id, 'work-3');
  assert.equal(new Set(migrated.works.map(work => work.id)).size, 3);
  assert.equal(A.decode(A.encode(migrated)).works.length, 3);
  old.profile.works[0].design.tops.push({ id: 16, x: 300, y: 280, size: 100, angle: 0 });
  assert.throws(() => A.decode(JSON.stringify(old)), /ベータ版では使用できません/);
});
