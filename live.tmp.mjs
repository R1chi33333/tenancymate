import { ask } from './src/lib/ask.ts';
const r = await ask('How many weeks of bond can my landlord ask for?');
console.log('ANSWER:', r.answer);
console.log('provided:', r.providedSections.join(','));
console.log('check:', JSON.stringify(r.check));
