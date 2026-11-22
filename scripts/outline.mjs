const ORDER_LINE = /^order:\s*(.+)$/m;
const FRONT_MATTER = /^---\n([\s\S]*?)\n---/;

const problem = (message) => ({ id: 'R28', message: `structure: ${message}` });

export function outlineHooks(contract) {
  return contract.hooks
    .filter((hook) => hook.screens.includes(1) && !hook.repeatable && hook.name !== contract.promise_board.root)
    .map((hook) => hook.name);
}

export function readOutline(text) {
  const header = FRONT_MATTER.exec(text ?? '')?.[1];
  const line = header && ORDER_LINE.exec(header)?.[1];
  if (!line) return null;
  return line.split(',').map((name) => name.trim()).filter(Boolean);
}

const before = (order, first, second) => order.indexOf(first) < order.indexOf(second);

export function outlineProblems(order, contract) {
  const hooks = outlineHooks(contract);
  const unknown = order.filter((name) => !hooks.includes(name)).map((name) => problem(`${name} is not a block of the promise screen`));
  const repeated = [...new Set(order.filter((name, index) => order.indexOf(name) !== index))].map((name) => problem(`${name} appears more than once`));
  const missing = hooks.filter((name) => !order.includes(name)).map((name) => problem(`${name} is missing: the outline names every block once`));
  if (unknown.length || repeated.length || missing.length) return [...unknown, ...repeated, ...missing];
  return [
    ...(order[0] === 'brand' ? [] : [problem('brand opens the screen')]),
    ...(order.at(-1) === 'footer' ? [] : [problem('footer closes the screen')]),
    ...(before(order, 'title', 'subtitle') ? [] : [problem('subtitle comes after title')]),
    ...(before(order, 'closing', 'cta-closing') ? [] : [problem('cta-closing comes after closing')]),
  ];
}

export function boardOrder(board, contract) {
  const hooks = new Set(outlineHooks(contract));
  const names = board.elements.map((element) => element.attrs[contract.hook_attribute]).filter((name) => hooks.has(name));
  return [...new Set(names)];
}

export function boardOrderProblem(board, order, contract) {
  const found = boardOrder(board, contract);
  if (JSON.stringify(found) === JSON.stringify(order)) return null;
  return { id: 'R28', message: `the blocks follow the order ${found.join(', ')}; structure.md asks for ${order.join(', ')}` };
}
