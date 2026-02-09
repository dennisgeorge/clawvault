# DEBUG: Dashboard Still Crashing

## Symptoms
- Browser crashes/freezes when loading dashboard
- 327 nodes, 377 edges in graph

## Debug Steps Required

1. **Check for infinite loops** in:
   - WebSocket reconnection logic
   - Animation frame callbacks (requestAnimationFrame)
   - Event handlers that trigger re-renders

2. **Check memory issues**:
   - Are we creating new objects every frame?
   - Are event listeners being added multiple times?
   - Is the graph being re-initialized repeatedly?

3. **Check force-graph config**:
   - Is warmupTicks too high?
   - Is cooldownTicks causing issues?
   - d3AlphaDecay / d3VelocityDecay values

## Likely Culprits
- `renderNode()` function doing too much work per frame
- WebSocket onmessage triggering full graph rebuild
- No throttling on graph.graphData() calls

## Fix Strategy
1. Add console.log breadcrumbs to find the hot path
2. Throttle ALL graph updates to max 1 per second
3. Simplify renderNode to absolute minimum
4. Disable WebSocket temporarily to isolate issue

## Test
Load http://localhost:3377 - should NOT freeze browser

When done: openclaw gateway wake --text 'Dashboard crash fixed' --mode now
