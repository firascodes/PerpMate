# Phase 1: Skeleton & E2E Bot Trade

Brief: Build cohesive skeletons for the Telegram bot, Privy embedded wallets (with session signers), Li.Fi routing (fund-in), Hyperliquid market order execution, minimal read-only dashboard, and basic DB. Goal: a user can onboard, fund-in via Li.Fi, and place a market order on Hyperliquid via the bot. Dashboard remains read-only.

## Completed Tasks

- [x] Repo and env scaffolding created
- [x] `.env.example` for bot created
- [x] Prisma schema scaffolded (users, signals, trades, positions)

## In Progress Tasks

- [x] Telegram bot scaffold with core commands (`/start`, `/wallet`, `/fund`, `/preview`, `/execute`, `/active`)
- [x] Privy embedded wallet creation at onboarding; persist wallet address in DB
- [x] API keys configured: Privy App ID/Secret; RPC URL set; Li.Fi key optional

## Future Tasks

- Privy & Policies
  - [ ] Configure Privy session signer policies (per-user spend/tx limits)
  - [ ] Implement signer retrieval and health checks

- Li.Fi Routing & Deposit Flow
  - [x] Quote discovery for source chain/token → HyperEVM/HL path (SDK v3 integration)
  - [ ] **CRITICAL**: Replace funding intent with direct deposit addresses (copyable for user)
  - [ ] **CRITICAL**: Implement deposit monitoring (watch wallet for incoming USDC)
  - [ ] **CRITICAL**: Auto-detect deposits and trigger "Successfully deposited X USDC" notifications
  - [ ] Execute Li.Fi route after deposit confirmation
  - [ ] Poll route status and map deposit credit to Hypercore
  - [ ] Handle failures and fallbacks; present ETA/fees in preview
  - [x] Tools connectivity + supported chains messaging (Solana/Base) in /fund

- Hyperliquid Execution
  - [x] Exchange client: market order placement (MVP)
  - [x] Store order IDs and execution refs; poll for status/portfolio
  - [x] `/active` surface to show open orders/positions summary
  - [x] HL clients scaffolded (info/exchange) and helpers added
  - [ ] **CRITICAL**: Test end-to-end: deposit → bridge → place order → verify on HyperEVM
  - [ ] **CRITICAL**: Verify orders appear on Hyperliquid exchange and HyperEVM explorer

- Telegram UX
  - [x] Basic funding flow with USDC selection (Solana/Base) and amount capture
  - [x] Route preview showing pending deposits and destination details
  - [ ] Signal/preview card format for natural-language trading preview
  - [ ] "Preview Trade" → route estimate (fees/ETA) + order summary
  - [ ] Confirm step, then execute; show progress updates
  - [ ] Basic disclaimers and error messages

- Dashboard (Read-only Skeleton)
  - [x] Next.js app with "Login with Telegram" button (memecoin style)
  - [x] Dark theme with feature highlights (Tailwind CSS ready)
  - [ ] **READY FOR LOGO**: Dashboard styling complete, awaiting branding assets
  - [ ] Minimal positions/portfolio read using HL info endpoints
  - [ ] Simple status page linking from Telegram
  - [ ] Live deployment (Vercel/Netlify) for public access

  ### Styling Plan (Design-only tasks; no code in this step)
  - [x] Adopt **dark theme** with accent `#97FCE4` across buttons, links, focus, and key highlights
  - [x] Install and configure **shadcn/ui** components (Button, Navbar, Card, Tooltip) and **MagicUI** primitives
  - [x] **Navbar**: left `PerpMate.svg` wordmark + `ghost.svg` as icon; right transparent Telegram glyph (links to bot)
  - [x] **Login with Telegram** button: dark variant, soft glow using `#97FCE4`, Telegram icon left-aligned
  - [x] Layout: max-width container, 12/8-column responsive grid, generous spacing scale (magic-number 4)
  - [x] Typography: Inter or equivalent; headings bold, supporting text muted; consistent line-height
  - [x] Components: Hero (value props), Features grid, Footer with links (Docs, PRD, Telegram) ✅
  - [x] Accessibility: focus rings using `#97FCE4`, color contrast ≥ AA, keyboard nav
  - [ ] Assets: Ensure `/assets/PerpMate.svg` and `/assets/ghost.svg` wired as logo + favicon
  - [x] Theming: Tailwind tokens for `brand` color set to `#97FCE4`, semantic roles (primary/foreground/muted)
  - [ ] Motion: subtle hover/press transitions; no large parallax

- Observability & Safety
  - [x] Structured logging (pino) and minimal metrics
  - [x] Rate limiting on bot commands; abuse guards
  - [x] Secrets management; `.env.example` and runtime validation

## Implementation Plan

1. Foundations
   - Project scaffold, TypeScript configs, linting, logger, error boundary
   - `.env` loading, schema validation, `.env.example`
   - Prisma schema for `User`, `Signal`, `Trade`, `Position`; migration
   - Repo layout: npm workspaces or two npm projects in one repo (`apps/bot`, `apps/web`)

2. Privy
   - Onboarding creates embedded wallet; store address in `User`
   - Session signer setup with policies (spend/tx caps)

3. Telegram Bot
   - Commands: `/start`, `/wallet`, `/fund`, `/preview`, `/execute`, `/active`
   - Flow: preview builds order summary + Li.Fi route estimate → confirm → execute

4. Li.Fi Routing (Fund-in)
   - Quote, execute, poll; map to Hypercore deposit credit
   - Errors: retries/backoff, user-facing fallbacks

5. Hyperliquid Execution
   - Market order placement via exchange endpoint with session signer
   - Store order refs; poll status; update `/active`

6. Dashboard Skeleton (Read-only)
   - Privy auth; display bound wallet
   - Minimal positions/PnL read from HL info endpoints

7. Observability & Safety
   - Structured logs, metrics counters
   - Rate limits and disclaimers

## MAINNET READY CHECKLIST 🚀

### **Critical Path to Live Trading:**

- [ ] **1. Deposit Flow**: User gets copyable wallet address for Solana/Base USDC deposits
- [ ] **2. Deposit Detection**: Bot monitors wallet and notifies "Successfully deposited X USDC"
- [ ] **3. Auto-Bridge**: Li.Fi route executes automatically after deposit confirmation
- [ ] **4. HL Order Placement**: Market order placed on Hyperliquid with bridged funds
- [ ] **5. Verification**: Order visible on both Hyperliquid exchange AND HyperEVM explorer
- [ ] **6. Dashboard Access**: Live deployed dashboard shows positions/trades

### **Environment Setup:**

- [ ] Mainnet RPC endpoints configured (no testnet)
- [ ] Production Privy app with mainnet permissions
- [ ] Li.Fi SDK pointing to mainnet chains (Solana/Base → Arbitrum)
- [ ] Hyperliquid mainnet API endpoints
- [ ] Real USDC token addresses for all chains

## Acceptance Criteria (Phase 1)

- User onboards in Telegram; embedded Privy wallet created; address stored
- User deposits USDC to wallet address; bot detects and notifies automatically
- Bot executes Li.Fi bridge route and places Hyperliquid market order
- Order/trade visible on both Hyperliquid UI and HyperEVM blockchain explorer
- Dashboard deployed live with real-time position/trade data

## Relevant Files

- `bot/src/index.ts` — Bot entrypoint (command wiring, DI bootstrap)
- `bot/src/commands/start.ts` — Onboarding/start
- `bot/src/commands/wallet.ts` — Show wallet address
- `bot/src/commands/fund.ts` — Li.Fi quote/execute/poll
- `bot/src/commands/preview.ts` — Build order preview from NL input/params
- `bot/src/commands/execute.ts` — Confirm and execute order
- `bot/src/commands/active.ts` — Show open orders/positions
- `bot/src/services/privy.ts` — Wallet creation, session signer, policies
- `bot/src/services/lifi.ts` — Quote/execute/poll helpers
- `bot/src/services/hyperliquid.ts` — Info + trading clients (market orders)
- `bot/src/services/trading.ts` — Orchestrate route → deposit → trade
- `bot/src/db/*` — Prisma schema + repositories
- `dashboard/*` — Next.js app skeleton with Privy auth
- `apps/web/src/app/page.tsx` - ✅ Implemented dark theme and brand color styling. Added ShineBorder component to login button. Updated layout to max-width. Implemented Navbar with logo and Telegram link. Refactored to use shadcn/ui components. Added footer. Applied focus rings.
- `apps/web/tailwind.config.js` - ✅ Added brand color to the theme. Added focus-ring utility.
- `apps/web/src/app/layout.tsx` - ✅ Enabled dark mode. Applied Inter font.
- `apps/web/src/lib/utils.ts` - ✅ Added cn utility function.
- `apps/web/src/components/ui/shine-border.tsx` - ✅ Added ShineBorder component.
- `apps/web/src/components/ui/button.tsx` - ✅ Installed shadcn/ui component.
- `apps/web/src/components/ui/card.tsx` - ✅ Installed shadcn/ui component.
- `apps/web/src/components/ui/tooltip.tsx` - ✅ Installed shadcn/ui component.
- `public/assets/PerpMate.svg` - ✅ Added logo.
- `public/assets/telegram.svg` - ✅ Added Telegram icon.
- `.env` — Secrets (Privy, Telegram, DB, Li.Fi, HL)

## Notes

- Market orders only in Phase 1; limit + TP/SL come later
- Dashboard is read-only; all execution flows happen in Telegram
- Fund-out (HL → HyperEVM → Li.Fi back to origin) is tracked for a later phase
