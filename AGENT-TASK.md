# ClawVault Dashboard - Major Upgrade

## Goal
Transform the ClawVault dashboard into a world-class, Obsidian-style graph visualization that's optimized for real-time display on TVs and large screens.

## Current State
- Basic Express server at `dashboard/server.js`
- Uses force-graph library
- Static graph refresh via API

## Requirements

### 1. Obsidian-like Graph Experience
- **Click to focus** - clicking a node centers and highlights it
- **Smooth animations** - zoom, pan, node hover effects
- **Node clustering** - related notes cluster together
- **Link animations** - animated particles along edges showing relationships
- **Search/filter** - type to find nodes, filter by type/tag

### 2. Real-time Updates (WebSocket)
- WebSocket connection for live graph updates
- When vault files change, graph updates automatically
- Show "pulse" animation on newly changed nodes
- Perfect for displaying on TV to watch agent work in real-time

### 3. Performance & Scalability
- Handle 1000+ nodes smoothly
- WebGL rendering (force-graph supports this)
- Lazy loading for large vaults
- Efficient diff-based updates (don't rebuild whole graph)

### 4. TV/Display Mode
- Full-screen mode with no UI chrome
- Auto-rotate/drift camera when idle
- High contrast colors for visibility
- Optional: cycle through "hot" nodes

### 5. Tech Stack
- Keep Express backend
- Upgrade to force-graph 3D or keep 2D but optimize
- Add chokidar for file watching
- WebSocket via ws or socket.io

## File Structure
```
dashboard/
├── server.js          # Express + WebSocket server
├── lib/
│   └── vault-parser.js # Graph building logic
└── public/
    ├── index.html
    ├── app.js         # Main client code
    └── styles.css
```

## Success Criteria
- Feels as smooth as Obsidian graph
- Can display on a TV and watch nodes update in real-time as agent writes files
- Handles large vaults without lag
