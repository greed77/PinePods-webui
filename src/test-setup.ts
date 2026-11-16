// Shared unit-test setup: a clean localStorage per test.
import { beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
