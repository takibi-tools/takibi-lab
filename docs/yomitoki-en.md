# Yomitoki — English edition

This edition was aligned with the Japanese release at commit `e0e0be05e6bf07431a6e4fd61d3ddf1f2a9d5364` in `takibi-tools/takibi-tools.github.io`. Context guidance was subsequently updated in both main apps on 2026-09-19; the standalone demos remain unchanged.

- App: `../yomitoki-en.html`
- Standalone demo: `../yomitoki-en-demo/index.html`
- Run the offline tests from the repository root: `node tests/yomitoki-en.test.cjs` and `node tests/context.test.cjs`

## Behavior shared with the Japanese edition

The app uses Gemini only (`gemini-2.5-flash`). Changing the API key does not change providers. Keys are stored in this browser and sent to Google in the `x-goog-api-key` header, not in the URL. Clear the key field after using a shared device.

One run makes two API requests: inspection plus revision, then a second inspection of the revised reply. Each request has a 90-second timeout, including receipt of its body. The sample button is disabled during both requests. There is no automatic additional rewrite or retry. A failed second inspection remains explicitly incomplete; it never becomes a clean result. A successful second inspection may still report issues for the reader to review.

The app shows one underline color per passage. If an unsupported assertion overlaps with a more specific issue, that specific issue provides the color. If several specific issues overlap, a valid `primary` (or `primaryFlag`) chooses among them; otherwise their returned order is used. This is not a severity ranking. Every recognized issue remains in the findings, even when its color is not used for the passage.

The sample button saves the current question and reply in memory, shows the translated example, and changes to **Back to my text**. Selecting it again restores both fields. The standalone demo contains no API call or key-storage code.

The original question / context is recommended, not required. Empty or whitespace-only context produces a separate “Inspected without context” note above the results. It reflects the submitted input and is unaffected by later edits. Both inspection prompts share a clarification: missing context alone does not establish that evidence does not exist or that the AI invented a claim. Problems visible in the response are still inspected using the existing criteria.

## Classification and localization

The Japanese criteria and response keys are retained. English labels are a presentation mapping, not replacement machine values. The prompts request natural English for `summary`, `note`, and `remeasured`; `text` and `phrase` must preserve the inspected text. Classifying a statement as Fact does not verify its truth. Questions and conversation prompts have their own label, outside the four statement categories.

| Stable response value | English display | Badge / CSS class |
| --- | --- | --- |
| 事実 | Fact | F |
| 推論 | Inference | I |
| 意見 | Opinion | O |
| 励まし | Encouragement | E |
| 問い | Question | Q |
| 根拠なき断定 | Unsupported assertion | dantei |
| 過剰肯定 | Excessive affirmation | koutei |
| 過剰な未来予測 | Overconfident prediction | mirai |
| 出どころなき引用 | Unsourced citation | inyou |

Changing a display label must not change these response values or the CSS mapping. Invalid or incomplete results are rejected rather than silently treated as unflagged. The model, request parameters, inspection criteria and correction policy match the current Japanese edition; the output-language instruction is localized.

The paper grid, serif headings, red seal, colors and layout are retained. The English revision heading has extra right padding to avoid colliding with the seal on narrow screens.

## Sample provenance and limits

The photo sample is an English translation and reconstruction of the saved Japanese inspection, which was itself transcribed from screenshots. It is **not an English live-API result**. The fictional input contains an invented expert quotation. The saved classifications and flags are preserved; missing raw `primary`, `summary`, or second-inspection segment data have not been invented. The translated provenance note appears in both the app and the standalone demo.

The release was checked with mock responses and browser UI tests. No live Gemini requests were made during this update. Whether the model consistently produces natural English and completes both real requests remains unverified. The tool does not perform external fact-checking, and its assessments can be wrong.
