# URGENT: Fix Dashboard Crashes & Performance

## Problem
The dashboard is:
1. Lagging badly
2. Crashing the browser
3. UI doesn't look different from before

## Root Cause Analysis Needed
Check:
- Is force-graph set up with WebGL mode? (use `.graphRenderer(ForceGraph.renderers.webgl)` for performance)
- Is the WebSocket reconnecting in a loop?
- Memory leaks in animation frames?
- Too many particles on links?

## Quick Fixes to Try
1. Reduce particle count: `.linkDirectionalParticles(0)` to test
2. Enable WebGL: Check if using canvas vs WebGL renderer
3. Reduce cooldownTicks
4. Add lazy loading that actually skips rendering off-screen nodes

## Files to Check
- `dashboard/public/app.js` - main client code
- `dashboard/server.js` - WebSocket handling

## Success = 
- Dashboard loads without lag
- Doesn't crash the browser
- Smooth interactions with 300+ nodes
