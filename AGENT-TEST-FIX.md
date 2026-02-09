# CRITICAL: Dashboard Keeps Crashing - Write Tests & Fix

## Problem
Dashboard crashes browser repeatedly. Previous fixes haven't worked.

## Your Mission
1. **Write a test that loads the dashboard** using Playwright or Puppeteer
2. **Run the test** - capture any console errors, memory issues, crashes
3. **Fix what you find**
4. **Re-run tests** until passing

## Test Requirements
Create `dashboard/test/crash-test.js`:
```js
// Use Puppeteer (already in node_modules or install it)
// 1. Launch headless browser
// 2. Navigate to http://localhost:3377
// 3. Wait 10 seconds
// 4. Check for console errors
// 5. Check page didn't crash
// 6. Take screenshot
// 7. Report pass/fail
```

## Install if needed
```bash
npm install puppeteer --save-dev
```

## Run test
```bash
node dashboard/test/crash-test.js
```

## Common Crash Causes to Check
- Infinite requestAnimationFrame loops
- WebSocket reconnect storms
- Force-graph with too many nodes without proper config
- Memory leaks from creating objects every frame

## Simplify Until It Works
If tests keep failing, STRIP the dashboard to bare minimum:
- Just load force-graph with static data
- No WebSocket
- No fancy rendering
- No animations

Then add features back one by one.

## Success Criteria
- `node dashboard/test/crash-test.js` passes
- Dashboard loads without crashing for 30 seconds
- No console errors

When done: openclaw gateway wake --text 'Dashboard tested and fixed' --mode now
