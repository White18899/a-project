const fs = require('fs');

console.log('--- Debugging Alignment Flow ---');

// 1. Check element with text and subtext
const elem = {
    id: 'test_card',
    type: 'text',
    text: 'THE PIVOTAL PARADIGM SHIFT',
    hasSubtext: true,
    subtext: 'In 2026, artificial intelligence transitions from passive conversational interfaces to proactive, goal-driven agents...',
    align: 'center',
    subtextAlign: 'left'
};

console.log('Initial element:', elem);

// Check canvas.js rendering condition
const canvasCode = fs.readFileSync('a:/a-project/js/canvas.js', 'utf8');

// In canvas.js:
// const hasSubtextStyling = Boolean(
//     elem.hasSubtext || 
//     elem.subtext || 
//     (elem.subtextSize && elem.subtextSize !== elem.fontSize) || 
//     (elem.subtextColor && elem.subtextColor !== elem.textColor) ||
//     elem.subtextFontWeight
// );

// But what if elem is:
const elemLegacy = {
    id: 'legacy_card',
    type: 'text',
    text: 'THE PIVOTAL PARADIGM SHIFT\n\nIn 2026, artificial intelligence transitions from passive conversational interfaces to proactive, goal-driven agents...',
    // No hasSubtext, no subtext!
    align: 'center'
};

const hasSubtextStyling = Boolean(
    elemLegacy.hasSubtext || 
    elemLegacy.subtext || 
    (elemLegacy.subtextSize && elemLegacy.subtextSize !== elemLegacy.fontSize) || 
    (elemLegacy.subtextColor && elemLegacy.subtextColor !== elemLegacy.textColor) ||
    elemLegacy.subtextFontWeight
);

console.log('elemLegacy hasSubtextStyling:', hasSubtextStyling);
// It is FALSE!
// So elemLegacy gets rendered as a SINGLE PIXI.Text node with elemLegacy.text!
// All text is aligned to elemLegacy.align ('center')!
// If the user clicks 'left' for heading, the whole element aligns left!
// If the user clicks 'center' for subtext, subtextAlign is updated on the element, BUT canvas still thinks hasSubtextStyling is FALSE because elemLegacy.hasSubtext is still false and elemLegacy.subtext is still empty!

// Also, what if elem is created by AI?
// Let's check what server.js returns:
const serverCode = fs.readFileSync('a:/a-project/server.js', 'utf8');
const serverMatch = serverCode.match(/"hasSubtext":\s*true/g);
console.log('server hasSubtext matches:', serverMatch ? serverMatch.length : 0);

