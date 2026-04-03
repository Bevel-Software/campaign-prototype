# Plan: Historical Ad Recommendations After Segments

## Goal
After the agent generates audience segments, it should automatically shortlist a historical ad for each segment (from `historical_data.csv`), explain why it picked that ad (e.g. same persona, high reach, similar messaging), and ask the user to confirm before proceeding to briefs.

## Current Flow
1. User describes campaign → agent creates **settings card**
2. User confirms → agent creates **segment cards**
3. User selects segments → agent creates **brief cards**
4. User confirms briefs → agent creates **creative cards** (with image generation)

## New Flow (step 2.5 inserted)
1. User describes campaign → agent creates **settings card**
2. User confirms → agent creates **segment cards**
3. **NEW — Ad inspiration step:**
   - Agent reads historical ad data (loaded from CSV)
   - For each segment, shortlists 1-2 best-matching historical ads
   - Creates **asset cards** on canvas linked to each segment
   - Explains reasoning in chat (e.g. "Picked ad X for segment Y because: same B2B persona, highest reach at 202k, matching employer-benefit messaging")
   - Asks user: "Here are reference ads for each segment. Review and confirm, or swap any out before we move to briefs."
4. User confirms → agent creates **brief cards** (now informed by the reference ads)
5. User confirms briefs → agent creates **creative cards**

## Implementation Steps

### 1. Serve CSV data to the frontend
- [ ] Add an API endpoint (`GET /api/historical-ads`) in `server/index.ts` that reads `historical_data.csv` and returns it as JSON
- [ ] Alternatively, convert CSV to JSON and place in `public/` for static fetch

### 2. Load historical ads into AppState
- [ ] Add `historicalAds: HistoricalAd[]` to `AppState` in `canvasTypes.ts`
- [ ] Fetch and parse the data on app load in `CanvasApp.tsx`
- [ ] Add reducer action `SET_HISTORICAL_ADS`

### 3. Pass historical ads to the LLM
- [ ] In `chatAgent.ts` → `processMessage()`, include a system message with the historical ad data (text, image description, reach, location, duration) when ads are loaded
- [ ] Keep it concise — the LLM doesn't need raw CSV, just a structured summary

### 4. Update the system prompt
- [ ] Add a new section to `SYSTEM_PROMPT` describing the "ad inspiration" step
- [ ] Instruct the agent: after spawning segments, also shortlist 1 historical ad per segment using `spawn_assets`
- [ ] Require the agent to explain its reasoning in the `reply` and ask for user confirmation
- [ ] Only proceed to briefs after user approves the references

### 5. Asset card enhancements (optional, if images are available)
- [ ] If ad images are downloaded to `public/ads/`, populate asset card `image` field with the local path
- [ ] If no images, asset cards show the `Image Description` text + Ad Library link as the `source` field

## Open Question
- **Ad images**: The CSV `Image Link` column says "Not publicly available". If we want visual asset cards, the ad images need to be manually downloaded from the Facebook Ad Library links and placed in `public/ads/`. Otherwise, text-only asset cards work fine with `Image Description` + `Ad Link`.
