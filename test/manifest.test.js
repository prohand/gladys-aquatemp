// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest, but it cannot know which handlers
// the code registers, nor the rules of this repository (four languages,
// versions written by the Release workflow): these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { CONNECTION_STATUSES, SCENE_TRIGGERS } from '../src/capabilities/triggers.js';
import { MODE_CHOICES, SCENE_ACTIONS, SCENE_ACTION_KEYS } from '../src/capabilities/scenes.js';
import { HEAT_PUMP_WIDGET } from '../src/capabilities/widget.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));
const indexSource = await read('../index.js');

test('the versions agree: package.json, manifest and image tag', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-aquatemp:${pkg.version}`);
  assert.match(
    manifest.cover_image,
    /^https:\/\/raw\.githubusercontent\.com\/prohand\/gladys-aquatemp\//,
  );
});

test('the name and the description fit what the store allows', () => {
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const [language, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${language}: ${text.length}`);
  }
});

test('a cloud integration: the transport badge says cloud', () => {
  // The heat pumps are only reachable through the Aqua Temp cloud: no LAN
  // protocol is known, so no "prefer local" toggle either.
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('the countries are ISO 3166-1 alpha-2 codes, 1 to 20, unique', () => {
  const { countries } = manifest;
  assert.ok(Array.isArray(countries) && countries.length >= 1 && countries.length <= 20);
  assert.equal(new Set(countries).size, countries.length);
  for (const country of countries) {
    assert.match(country, /^[A-Z]{2}$/);
  }
  // The four languages of the integration have their countries in the list.
  for (const country of ['GB', 'FR', 'DE', 'ES']) {
    assert.ok(countries.includes(country), country);
  }
});

test('the search keywords follow the store rules', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, keywords.length, 'keywords must be unique');
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, `keyword "${keyword}"`);
  }
});

const CATEGORIES = [
  'climate',
  'lighting',
  'energy',
  'security',
  'multimedia',
  'appliances',
  'environment',
  'protocols',
  'network',
  'notifications',
  'assistants',
  'services',
  'transport',
  'vehicles',
  'servers',
  'leisure',
];

test('the categories stay inside the vocabulary the store indexes', () => {
  const { categories } = manifest;
  assert.ok(categories.length >= 1 && categories.length <= 3);
  for (const category of categories) {
    assert.ok(CATEGORIES.includes(category), `unknown category "${category}"`);
  }
});

test('the Gladys floor covers every field the manifest declares', () => {
  // categories: 4.86; widgets and scenes: 5.1; keywords and countries: 5.3.
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.type === 'section') {
      assert.ok(!(field.key in DEFAULT_CONFIG), `section "${field.key}" stores no value`);
      continue;
    }
    assert.ok(field.key in DEFAULT_CONFIG, `config key "${field.key}" unknown to the code`);
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('the password is a secret field', () => {
  const password = manifest.config_schema.find((field) => field.key === 'password');
  assert.equal(password.type, 'secret');
});

test('every manifest action is registered in index.js', () => {
  for (const action of manifest.actions) {
    assert.match(indexSource, new RegExp(`onAction\\('${action.key}'`), action.key);
  }
});

test('every scene action is declared, handled and registered', () => {
  const keys = manifest.scene_actions.map((action) => action.key).sort();
  assert.deepEqual(keys, Object.values(SCENE_ACTION_KEYS).sort());
  assert.deepEqual(Object.keys(SCENE_ACTIONS).sort(), keys);
  for (const name of Object.keys(SCENE_ACTION_KEYS)) {
    assert.match(indexSource, new RegExp(`onSceneAction\\(SCENE_ACTION_KEYS\\.${name}`), name);
  }
  const modes = manifest.scene_actions
    .find((action) => action.key === SCENE_ACTION_KEYS.SET_MODE)
    .fields.find((field) => field.key === 'mode')
    .options.map((option) => option.value);
  assert.deepEqual(modes.sort(), [...MODE_CHOICES].sort());
});

test('the scene triggers the code fires are the ones the manifest declares', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  const statuses = manifest.scene_triggers
    .find((trigger) => trigger.key === SCENE_TRIGGERS.CONNECTION_CHANGED)
    .fields.find((field) => field.key === 'status')
    .options.map((option) => option.value);
  assert.deepEqual(statuses.sort(), [...CONNECTION_STATUSES].sort());
});

test('the widget is declared and registered', () => {
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key),
    [HEAT_PUMP_WIDGET],
  );
  assert.match(indexSource, /onWidgetGet\(HEAT_PUMP_WIDGET/);
  assert.match(indexSource, /onWidgetAction\(HEAT_PUMP_WIDGET/);
});

test('device selects are dynamic: a source and no static options', () => {
  const fields = [
    ...manifest.scene_triggers.flatMap((trigger) => trigger.fields ?? []),
    ...manifest.scene_actions.flatMap((action) => action.fields ?? []),
    ...manifest.widgets.flatMap((widget) => widget.settings ?? []),
  ].filter((field) => field.key === 'device');
  assert.ok(fields.length >= 7);
  for (const field of fields) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined);
  }
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every text of the manifest is written in en, fr, de and es', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the widget texts hold in the store limits in every language', () => {
  for (const widget of manifest.widgets) {
    for (const language of LANGUAGES) {
      const label = widget.label[language].length;
      const description = widget.description[language].length;
      assert.ok(label >= 3 && label <= 30, `${widget.key} label.${language}`);
      assert.ok(description <= 100, `${widget.key} description.${language}`);
    }
  }
});

test('the user documentation exists in every language, long enough for the store', async () => {
  for (const language of LANGUAGES) {
    const text = await read(`../docs/${language}.md`);
    assert.ok(text.length >= 300, `docs/${language}.md: ${text.length} characters`);
  }
});
