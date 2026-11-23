// -----------------------------------------------------------------------------
// The changelog roll of the Release workflow (.github/scripts/changelog-release.mjs).
// The release commit goes straight to main: what it writes must still pass
// format:check, and the notes of the GitHub Release are read from it.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const changelogPath = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));

test('the Unreleased section moves under the released version', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A thing.\n';
  assert.equal(
    rollChangelog(text, '1.2.0', '2026-11-23'),
    '# Changelog\n\n## [Unreleased]\n\n## [1.2.0] - 2026-11-23\n\n### Added\n\n- A thing.\n',
  );
});

test('an empty Unreleased section still names the version', () => {
  const rolled = rollChangelog('# Changelog\n\n## [Unreleased]\n', '1.0.1', '2026-11-23');
  assert.match(rolled, /## \[1\.0\.1\] - 2026-11-23\n\n- Maintenance release/);
});

test('a version already in the changelog is not written twice', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-11-23\n\n- First.\n';
  assert.equal(rollChangelog(text, '1.0.0', '2026-11-24'), text);
});

test('the real changelog, rolled, still passes Prettier', async () => {
  const text = await readFile(changelogPath, 'utf8');
  assert.match(text, /^## \[Unreleased\]$/m, 'CHANGELOG.md needs an Unreleased section');
  const rolled = rollChangelog(text, '9.9.9', '2026-11-23');
  const options = { ...(await prettier.resolveConfig(changelogPath)), filepath: changelogPath };
  assert.equal(await prettier.format(rolled, options), rolled);
});
