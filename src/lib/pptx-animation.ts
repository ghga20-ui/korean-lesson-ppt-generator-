/**
 * Animation XML injection for PPTX files.
 * Handles extracting shape IDs from generated slide XML
 * and building click-triggered "appear" animation blocks.
 */

import JSZip from "jszip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Animation group: marker shape IDs + annotation text ID for one annotation. */
export interface AnimationGroup {
  markerIds: number[];
  textId: number;
}

// ---------------------------------------------------------------------------
// Shape ID extraction
// ---------------------------------------------------------------------------

/**
 * Extract actual shape IDs from generated slide XML.
 *
 * pptxgenjs adds shapes in the order we call addText/addShape. The XML
 * contains <p:cNvPr id="N" .../> for each shape. We parse these to get
 * the real IDs, skipping the first two (group shape + main text).
 *
 * @param shapeCountsPerAnnotation - Array where each element is the total
 *   number of shapes (marker shape(s) + 1 text box) for that annotation.
 *   Multi-line underlines have >2 shapes per annotation.
 */
export function extractShapeIds(
  slideXml: string,
  shapeCountsPerAnnotation: number[],
): AnimationGroup[] {
  const matches = [...slideXml.matchAll(/<p:cNvPr\s+id="(\d+)"/g)];
  const allIds = matches.map((m) => parseInt(m[1], 10));

  // allIds layout:
  //   [0] = nvGrpSpPr group shape (id usually 1)
  //   [1] = main text box
  //   Then for each annotation: N marker shapes + 1 text box

  const groups: AnimationGroup[] = [];
  let idx = 2; // skip nvGrpSpPr and main text

  for (const totalCount of shapeCountsPerAnnotation) {
    const markerCount = totalCount - 1; // last shape is the text box
    const markerIds: number[] = [];

    for (let j = 0; j < markerCount; j++) {
      if (idx < allIds.length) {
        markerIds.push(allIds[idx++]);
      }
    }

    const textId = idx < allIds.length ? allIds[idx++] : 0;
    groups.push({ markerIds, textId });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Timing XML generation
// ---------------------------------------------------------------------------

/**
 * Build the OOXML `<p:timing>` element with correct structure that
 * PowerPoint actually recognises.
 *
 * Structure matches real PowerPoint output:
 * - Single <p:seq nodeType="mainSeq"> (NOT multiple <p:seq>)
 * - Click groups use <p:cond delay="indefinite"/> (NOT delay="0")
 * - Includes <p:bldLst> section listing all animated shapes
 *
 * Each annotation click group shows all marker shapes + text together.
 * Multi-line underlines have multiple marker shapes in the same click group.
 */
export function buildTimingXml(groups: AnimationGroup[]): string {
  if (groups.length === 0) return "";

  let ctnId = 0;

  /** Helper: build a single "fade" <p:par> node for one shape. */
  function appearNode(spid: number, nodeType: string): string {
    const dur = 500; // fade duration in ms
    return (
      `<p:par>` +
      `<p:cTn id="${++ctnId}" fill="hold">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `<p:childTnLst>` +
      `<p:par>` +
      `<p:cTn id="${++ctnId}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}" dur="${dur}">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `<p:childTnLst>` +
      `<p:animEffect transition="in" filter="fade">` +
      `<p:cBhvr>` +
      `<p:cTn id="${++ctnId}" dur="${dur}">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `</p:cTn>` +
      `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
      `</p:cBhvr>` +
      `</p:animEffect>` +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>` +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>`
    );
  }

  // Build click group <p:par> nodes inside the mainSeq.
  // Each annotation produces TWO click groups:
  //   Click 1: marker shape(s) appear
  //   Click 2: annotation text appears
  const clickGroups: string[] = [];

  for (const group of groups) {
    // --- Click group 1: marker shapes ---
    const markerNodes: string[] = [];
    for (let j = 0; j < group.markerIds.length; j++) {
      markerNodes.push(
        appearNode(group.markerIds[j], j === 0 ? "clickEffect" : "withEffect"),
      );
    }

    clickGroups.push(
      `<p:par>` +
      `<p:cTn id="${++ctnId}" fill="hold">` +
      `<p:stCondLst>` +
      `<p:cond delay="indefinite"/>` +
      `</p:stCondLst>` +
      `<p:childTnLst>` +
      markerNodes.join("") +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>`,
    );

    // --- Click group 2: annotation text ---
    clickGroups.push(
      `<p:par>` +
      `<p:cTn id="${++ctnId}" fill="hold">` +
      `<p:stCondLst>` +
      `<p:cond delay="indefinite"/>` +
      `</p:stCondLst>` +
      `<p:childTnLst>` +
      appearNode(group.textId, "clickEffect") +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>`,
    );
  }

  // Build the <p:bldLst> section — required for PowerPoint to recognise animations
  const bldEntries: string[] = [];
  for (const group of groups) {
    for (const mid of group.markerIds) {
      bldEntries.push(`<p:bldP spid="${mid}" grpId="0" animBg="1"/>`);
    }
    bldEntries.push(`<p:bldP spid="${group.textId}" grpId="0"/>`);
  }

  return (
    `<p:timing>` +
    `<p:tnLst>` +
    `<p:par>` +
    `<p:cTn id="${++ctnId}" dur="indefinite" restart="never" nodeType="tmRoot">` +
    `<p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek">` +
    `<p:cTn id="${++ctnId}" dur="indefinite" nodeType="mainSeq">` +
    `<p:childTnLst>` +
    clickGroups.join("") +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq>` +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>` +
    `</p:tnLst>` +
    `<p:bldLst>` +
    bldEntries.join("") +
    `</p:bldLst>` +
    `</p:timing>`
  );
}

// ---------------------------------------------------------------------------
// Animation injection
// ---------------------------------------------------------------------------

/**
 * Post-process a PPTX buffer to inject click-triggered "appear" animations
 * into each slide that has annotations.
 *
 * Extracts actual shape IDs from generated XML instead of guessing them.
 *
 * @param slideShapeCounts - For each slide, an array of shape counts per
 *   annotation (each element = marker shapes + 1 text box).
 */
export async function injectAnimations(
  pptxBuffer: Buffer,
  slideShapeCounts: number[][],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(pptxBuffer);

  for (let i = 0; i < slideShapeCounts.length; i++) {
    const shapeCounts = slideShapeCounts[i];
    if (shapeCounts.length === 0) continue;

    const slideFileName = `ppt/slides/slide${i + 1}.xml`;
    const slideXml = await zip.file(slideFileName)?.async("string");
    if (!slideXml) continue;

    const groups = extractShapeIds(slideXml, shapeCounts);
    if (groups.length === 0) continue;

    const timingXml = buildTimingXml(groups);

    // Inject the <p:timing> block right before the closing </p:sld>.
    const updatedXml = slideXml.replace("</p:sld>", `${timingXml}</p:sld>`);
    zip.file(slideFileName, updatedXml);
  }

  const result = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return Buffer.from(result);
}
