import ts from 'typescript';

// The imported demo contains JavaScript as well as TypeScript. Keep unused
// bindings visible without pretending its existing JS is fully type-annotated.
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const files = ts.sys.readDirectory('src', ['.ts', '.tsx', '.js', '.jsx'], ['node_modules']);
const program = ts.createProgram(files, {
  ...parsed.options, allowJs:true, checkJs:true, noUnusedLocals:true, noUnusedParameters:true,
});
const unusedCodes = new Set([6133, 6192, 6196, 6198]);
const diagnostics = ts.getPreEmitDiagnostics(program).filter(diagnostic =>
  diagnostic.file && !diagnostic.file.fileName.includes('/node_modules/') && unusedCodes.has(diagnostic.code));
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory:ts.sys.getCurrentDirectory,
    getCanonicalFileName:path => path,
    getNewLine:() => '\n',
  }));
  process.exitCode=1;
} else console.log(`Source hygiene passed (${files.filter(file => !file.endsWith('.d.ts')).length} JS/TS modules; no unused bindings).`);
