// packages/scanner/test-parse.ts
import csstree from 'css-tree';

const css = `
  .box { display: grid; word-break: auto-phrase; }
  @container (width > 400px) { .box { color: rebeccapurple; } }
`;

const ast = csstree.parse(css, { positions: true });

// count rules using the walker
let ruleCount = 0;
csstree.walk(ast, (node) => {
  if (
    node.type === 'Rule' ||
    node.type === 'Atrule' ||
    node.type === 'StyleSheet'
  ) {
    ruleCount++;
  }
});

console.log('Parsed OK. Rules:', ruleCount);
