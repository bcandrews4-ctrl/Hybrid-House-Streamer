# Hybrid House Streamer — Improvement Roadmap

Code-level analysis with specific file/line references and prioritized recommendations.

---

## Critical: Security

### 1. XSS in Cast Display (`cast.js:210-212`)

Exercise names are injected via `innerHTML` without sanitization:

```js
tr.innerHTML = `<td>${row.exercise || '—'}</td>...`
```

An exercise like `<img src=x onerror=alert(1)>` executes on every connected cast screen. Use `textContent` or `document.createElement` instead. Same pattern at `cast.js:161-218` (bar splits at line 183).

### 2. No Socket.IO Authentication (`server.js:90-106`)

HTTP Basic Auth protects routes but not WebSocket connections. Any client can connect and emit `play`, `stop`, `updateWorkout`. Add `io.use()` middleware to validate credentials from `socket.handshake.auth`.

### 3. TLS Certificate Validation Disabled (`server.js:33`)

```js
ssl: { rejectUnauthorized: false }
```

Opens the database connection to MITM attacks. Use the platform-provided CA cert or make this configurable via env var.

---

## High: Architecture

### 4. Split `server.js` Into Modules

646 lines handling 5 concerns:

| Lines | Concern |
|-------|---------|
| 20-255 | Database layer (connect, reconnect, load, save, file fallback) |
| 258-433 | Timer computation engine (pure functions) |
| 455-548 | Socket.IO event handlers |
| 87-115, 578-611 | HTTP routes |
| 553-646 | Tick loop + graceful shutdown |

Suggested structure:
```
src/
  db.js            # pg.Pool setup, load/save, file fallback
  timer.js         # computeHouse() and helpers (pure, testable)
  socket-handlers.js
  routes.js
  server.js        # Wiring only
```

### 5. Use `pg.Pool` Instead of `pg.Client` (`server.js:31`)

Comment says "connection pooling" but creates a single `pg.Client`. A pool handles reconnection automatically and eliminates the 50 lines of manual reconnect logic at lines 42-76.

### 6. Broadcast Efficiency (`server.js:575`)

Full state for all 3 houses broadcasts to every socket every second:

```js
io.emit('state', buildRuntime(state.activeDay));
```

Improvements:
- Use Socket.IO rooms so `/cast/2` only receives house 2 data
- Skip broadcasts when all timers are idle (no countdown, no startedAt)
- Send deltas instead of full state

---

## Medium: Code Quality

### 7. HTML Duplication (`index.html:35-228`)

Three identical ~65-line house card blocks. Only IDs and heading text differ. Generate from a template (server-side loop or client-side JS) to cut ~130 lines.

### 8. Duplicated Save Logic (`dashboard.js`)

"Save" button (lines 57-133) and "Copy to Cast" (lines 379-443) do the same thing. Extract `saveHouse(h)` and call from both. Consider removing one button.

### 9. No Input Validation on Socket Events (`server.js:466-503`)

`updateWorkout` accepts any payload shape. A client sending `{ exercises: "string" }` corrupts state for all clients. Add basic type/shape validation before mutating state.

### 10. Race Conditions on Save (`server.js:466-548`)

`saveState()` is called without `await` in every handler. Rapid edits can interleave DB writes and lose data. Either await saves or debounce with a dirty flag.

### 11. Add Tests

Zero test files. The timer engine (`computeHouse`, lines 258-433) is pure and critical — ideal for unit testing. Use `vitest` or `node:test` (both zero-config for ESM).

### 12. Inline Styles in JS (`dashboard.js:144-204`)

Bar split feature uses ~60 lines of `style.cssText`. Move to `styles.css` classes for maintainability and media query support.

---

## Low: UX Polish

### 13. No Disconnect Handling

Neither dashboard nor cast handle `socket.on('disconnect')`. Screens freeze silently on network drop. Add a visible connection status indicator.

### 14. Replace `alert()` (`dashboard.js:129, 469, 507`)

`alert()` blocks the main thread and looks unprofessional. Use a toast/notification div that auto-hides.

---

## Priority Matrix

| Priority | Issue | Effort |
|----------|-------|--------|
| Critical | XSS in cast innerHTML | Small |
| Critical | Socket auth | Small |
| Critical | TLS cert validation | Small |
| High | Split server.js | Medium |
| High | pg.Pool migration | Small |
| High | Broadcast rooms | Medium |
| Medium | HTML dedup | Small |
| Medium | Save logic dedup | Small |
| Medium | Socket validation | Small |
| Medium | Await saveState | Small |
| Medium | Timer unit tests | Medium |
| Medium | Inline styles cleanup | Small |
| Low | Disconnect indicator | Small |
| Low | Toast notifications | Small |
