import { runReferenceSnapWorkload } from './reference-snap-workload.js';
console.log(
  JSON.stringify(
    await runReferenceSnapWorkload({ references: process.argv.includes('--large') ? 100 : 20 }),
    null,
    2,
  ),
);
