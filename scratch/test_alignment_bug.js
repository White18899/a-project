// Reproduce alignment issue
const fs = require('fs');

console.log('Testing alignment logic...');

// Case 1: Element loaded from slide or generated without explicit hasSubtext
const elem1 = {
    id: 'elem_test_1',
    type: 'text',
    text: 'THE PIVOTAL PARADIGM SHIFT\n\nIn 2026, artificial intelligence transitions from passive conversational interfaces to proactive, goal-driven agents',
    align: 'center',
    subtextAlign: 'left'
};

// Canvas.js logic currently:
const rawText = elem1.text || '';
const hasSubtextStyling = Boolean(
    elem1.hasSubtext || 
    elem1.subtext || 
    (elem1.subtextSize && elem1.subtextSize !== elem1.fontSize) || 
    (elem1.subtextColor && elem1.subtextColor !== elem1.textColor) ||
    elem1.subtextFontWeight
);

console.log('Case 1 hasSubtextStyling:', hasSubtextStyling);
// It is FALSE!
// Therefore, in canvas.js it goes to:
// else {
//     const pixiText = new PIXI.Text(displayText, textStyle);
// }
// Where textStyle.align = resolvedAlign = elem1.align!
// Which means BOTH the heading AND the paragraph are rendered in a single PIXI.Text node aligned to elem1.align!
// When the user clicks "Align Left" on Heading:
elem1.align = 'left';
console.log('After changing heading align to left, single node align:', elem1.align);
// Heading is left, but the paragraph is ALSO left!
// The user says: "why the both text align are connected if change heading align it change for para too"

// Case 2: What if the user clicks "Align Center" on Subtext?
elem1.subtextAlign = 'center';
// Does canvas re-render with dual node?
const hasSubtextStylingAfter = Boolean(
    elem1.hasSubtext || 
    elem1.subtext || 
    (elem1.subtextSize && elem1.subtextSize !== elem1.fontSize) || 
    (elem1.subtextColor && elem1.subtextColor !== elem1.textColor) ||
    elem1.subtextFontWeight
);
console.log('Case 2 hasSubtextStyling after changing subtextAlign:', hasSubtextStylingAfter);
// STILL FALSE! So Subtext align doesn't even work!

// Case 3: What if elem has hasSubtext: true and subtext?
const elem3 = {
    id: 'elem_test_3',
    type: 'text',
    text: 'THE PIVOTAL PARADIGM SHIFT',
    hasSubtext: true,
    subtext: 'In 2026, artificial intelligence transitions from passive...',
    align: 'center',
    subtextAlign: 'left'
};

// When syncTypographyStudioUI is called on an element like elem1:
// Does syncTypographyStudioUI update the element in state?
// Let's check editor.js lines 6063-6080:
// It only sets cardHeadingInput.value and cardSubtextInput.value! It does NOT update the element in state!
console.log('Done test reproduction.');
