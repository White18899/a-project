const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');

const transformMarker = '<!-- ACCORDION 1: TRANSFORM & LAYOUT -->';
const typoMarker = '<!-- ACCORDION 2: TYPOGRAPHY & CONTENT -->';
const appMarker = '<!-- ACCORDION 3: APPEARANCE & STYLE -->';
const interMarker = '<!-- ACCORDION 4: INTERACTIVITY & ACTIONS -->';

const idxTransform = content.indexOf(transformMarker);
const idxTypo = content.indexOf(typoMarker);
const idxApp = content.indexOf(appMarker);
const idxInter = content.indexOf(interMarker);

if (idxTransform === -1 || idxTypo === -1 || idxApp === -1 || idxInter === -1) {
    console.error('Markers not found! Indices:', { idxTransform, idxTypo, idxApp, idxInter });
    process.exit(1);
}

let blockTransform = content.slice(idxTransform, idxTypo).trimEnd();
let blockTypo = content.slice(idxTypo, idxApp).trimEnd();
let blockApp = content.slice(idxApp, idxInter).trimEnd();

// Update comments and ensure Appearance is open by default
blockTypo = blockTypo.replace('<!-- ACCORDION 2: TYPOGRAPHY & CONTENT -->', '<!-- ACCORDION 1: TYPOGRAPHY & CONTENT -->');

blockApp = blockApp.replace('<!-- ACCORDION 3: APPEARANCE & STYLE -->', '<!-- ACCORDION 2: APPEARANCE & STYLE -->');
blockApp = blockApp.replace('<div class="inspector-accordion-item" id="acc-item-appearance">', '<div class="inspector-accordion-item open" id="acc-item-appearance">');
blockApp = blockApp.replace('<div class="accordion-header" role="button" tabindex="0" aria-expanded="false">', '<div class="accordion-header" role="button" tabindex="0" aria-expanded="true">');

blockTransform = blockTransform.replace('<!-- ACCORDION 1: TRANSFORM & LAYOUT -->', '<!-- ACCORDION 3: TRANSFORM & LAYOUT -->');

const reordered = blockTypo + '\n\n                                    ' + blockApp + '\n\n                                    ' + blockTransform + '\n\n                                    ';

content = content.slice(0, idxTransform) + reordered + content.slice(idxInter);

fs.writeFileSync('index.html', content, 'utf8');
console.log('Successfully reordered accordions and set Appearance & Style to OPEN by default in index.html!');
