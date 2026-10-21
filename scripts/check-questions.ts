// npm run check:questions. Fails (exit 1) on any problem in src/questions/bank/*.json.
import { checkBankFiles } from '../src/questions/checkBank';
import { loadBankFiles } from './load-bank-files';

const { problems, counts } = checkBankFiles(loadBankFiles(), { requireTopics: true });
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (problems.length > 0) {
  console.error(`check:questions: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const cells = Object.entries(counts)
  .map(([k, n]) => `${k}=${n}`)
  .join(' ');
console.log(
  `check:questions: OK, ${total} questions in ${Object.keys(counts).length} files (${cells})`,
);
