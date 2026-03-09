import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

test('officer route does not pass authToken or userName props into OfficerDashboard', async () => {
    const appSource = await readFile(path.join(frontendRoot, 'App.tsx'), 'utf8');

    assert.match(appSource, /<OfficerDashboard\s*\/?>/);
    assert.doesNotMatch(appSource, /<OfficerDashboard[\s\S]*authToken=/);
    assert.doesNotMatch(appSource, /<OfficerDashboard[\s\S]*userName=/);
});

test('officer dashboard reads live auth state instead of relying on injected props', async () => {
    const dashboardSource = await readFile(path.join(frontendRoot, 'pages', 'OfficerDashboard.tsx'), 'utf8');

    assert.match(dashboardSource, /const OfficerDashboard: React\.FC = \(\) => \{/);
    assert.match(dashboardSource, /const currentUserId = authService\.getUser\(\)\?\.id \?\? null;/);
    assert.match(dashboardSource, /const userName = authService\.getUser\(\)\?\.username \|\| 'Officer';/);
    assert.match(dashboardSource, /const getAuthToken = \(\) => authService\.getToken\(\) \|\| '';/);
    assert.match(dashboardSource, /\}, \[currentUserId\]\);/);
});