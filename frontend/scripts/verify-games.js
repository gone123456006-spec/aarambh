/**
 * Offline check that Games tab data can load without crashing.
 * Run: node scripts/verify-games.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function compileTs(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });
  return outputText;
}

function loadTsModule(filePath, mocks = {}) {
  const code = compileTs(filePath);
  const module = { exports: {} };
  const dir = path.dirname(filePath);
  const sandboxRequire = (id) => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith('.')) {
      const base = path.resolve(dir, id);
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        path.join(base, 'index.ts'),
      ];
      const match = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (match && match.endsWith('.ts')) {
        return loadTsModule(match, mocks);
      }
      if (match) return require(match);
      throw new Error(`Cannot resolve ${id} from ${dir}`);
    }
    return require(id);
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: sandboxRequire,
    console,
    __dirname: dir,
    __filename: filePath,
  });
  return module.exports;
}

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('OK  ', msg);
}

const root = path.join(__dirname, '..');
const gameDataPath = path.join(root, 'constants', 'gameData.ts');
const coursesPath = path.join(root, 'app', '(tabs)', 'courses.tsx');

const gameData = loadTsModule(gameDataPath);

const checks = [
  ['QUIZ_QUESTIONS', gameData.QUIZ_QUESTIONS, gameData.QUIZ_LEVEL_COUNT],
  ['WORD_SCRAMBLES', gameData.WORD_SCRAMBLES, gameData.SCRAMBLE_LEVEL_COUNT],
  ['FILL_BLANKS', gameData.FILL_BLANKS, gameData.FILL_BLANK_LEVEL_COUNT],
  ['FLASHCARDS', gameData.FLASHCARDS, gameData.FLASHCARD_LEVEL_COUNT],
];

for (const [name, arr, expected] of checks) {
  if (!Array.isArray(arr) || arr.length === 0) {
    fail(`${name} is empty or missing`);
    continue;
  }
  if (arr.length !== expected) {
    fail(`${name} length ${arr.length} !== expected ${expected}`);
  } else {
    ok(`${name}: ${arr.length} items`);
  }
}

gameData.QUIZ_QUESTIONS.forEach((q, i) => {
  if (!q?.q || !Array.isArray(q.options) || q.options.length < 2) {
    fail(`quiz[${i}] missing question/options`);
  }
  if (typeof q.answer !== 'number' || !q.options[q.answer]) {
    fail(`quiz[${i}] invalid answer index ${q.answer}`);
  }
});

gameData.WORD_SCRAMBLES.forEach((item, i) => {
  if (!item?.word || !item.hint) fail(`scramble[${i}] missing word/hint`);
});

const badFill = [];
gameData.FILL_BLANKS.forEach((q, i) => {
  if (!q?.sentence || !Array.isArray(q.options) || q.options.length !== 4) {
    fail(`fill[${i}] does not have 4 options`);
  }
  if (q.answer < 0 || !q.options[q.answer]) {
    badFill.push(i);
  }
});
if (badFill.length) fail(`FILL_BLANKS invalid answer indexes: ${badFill.slice(0, 10).join(', ')}`);
else ok('FILL_BLANKS all answers are valid indexes');

gameData.FLASHCARDS.forEach((c, i) => {
  if (!c?.word || !c.meaning || !c.example) fail(`flash[${i}] incomplete`);
});

const coursesSrc = fs.readFileSync(coursesPath, 'utf8');
const requiredImports = [
  'QUIZ_LEVEL_COUNT',
  'SCRAMBLE_LEVEL_COUNT',
  'FILL_BLANK_LEVEL_COUNT',
  'FLASHCARD_LEVEL_COUNT',
  'QUIZ_QUESTIONS',
  'WORD_SCRAMBLES',
  'FILL_BLANKS',
  'FLASHCARDS',
];
const importBlock = coursesSrc.slice(0, coursesSrc.indexOf('from \'@/constants/gameData\''));
for (const name of requiredImports) {
  if (!importBlock.includes(name)) fail(`courses.tsx missing import ${name}`);
  else ok(`courses.tsx imports ${name}`);
}

if (coursesSrc.includes('useGameQuestions')) {
  fail('courses.tsx still references useGameQuestions (can crash if API fails)');
} else {
  ok('courses.tsx does not depend on live API questions to open');
}

if (!coursesSrc.includes('GamesCrashBoundary')) {
  fail('missing crash boundary');
} else {
  ok('GamesCrashBoundary is in place');
}

const iconDir = path.join(root, 'assets', 'images', 'icons3d');
['help.png', 'puzzle.png', 'pencil.png', 'cards.png', 'trophy.png'].forEach((file) => {
  const p = path.join(iconDir, file);
  if (!fs.existsSync(p) || fs.statSync(p).size < 500) fail(`missing icon ${file}`);
  else ok(`icon ${file} present`);
});

if (!process.exitCode) {
  console.log('\nGames data and screen wiring look safe to open.');
} else {
  console.log('\nGames check found problems.');
}
