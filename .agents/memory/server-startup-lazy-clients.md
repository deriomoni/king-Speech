---
name: Server startup resilience with lazy API clients
description: Why external API clients must be constructed lazily in the King Speech server
---

The Express/TS server (King-Speech/server) must boot even when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are absent (dev/preview often has none).

**Rule:** Construct third-party SDK clients (OpenAI, Anthropic) lazily inside a getter (e.g. `getAnthropic()`, `getOpenAI()`), never at module top level. Eager top-level construction throws on a missing key and crashes the whole workflow before Metro/preview can come up.

**Why:** A missing key should degrade only the routes that need it, not take down the entire dev server + web preview.

**How to apply:** When adding or merging server code that news up an API client, wrap it in a memoized getter called from the request handler. The audio client also prefers a direct `OPENAI_API_KEY`, falling back to the Replit integrations proxy key/base URL when the direct key is absent.
