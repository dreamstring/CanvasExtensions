/* Exercise the shipped template in Chromium with a replaceable paint-dialog fixture. */
const fs = require('node:fs');
const {browserFixture,runtimeSource}=require('./ui-browser-fixture.cjs');
const template = fs.readFileSync('templates/fill-panel/main.js', 'utf8');

async function exercise() {
  const check = (value, message) => { if (!value) throw Error(message); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const dialog = document.querySelector('[role=dialog]');
  const replacement = dialog.cloneNode(true);
  const host = window.FigmaExtensions;
  host.begin('fill-panel-example', []);
  loadTemplate();
  host.end();
  const findShadow = root => [...root.querySelectorAll('*')].find(el => el.shadowRoot)?.shadowRoot;
  const shadow = findShadow(dialog);
  check(shadow, 'missing Fill panel');
  const mode = dialog.querySelector('[role=combobox]');
  check(mode.nextElementSibling.contains(shadow.host), 'panel must follow the native image mode control');
  check(host.sdk.targets.inspect().every(slot => slot.element), 'expected four available host slots');
  const duplicate = replacement.cloneNode(true);
  dialog.after(duplicate);
  await tick();
  check(host.sdk.targets.inspect().filter(slot=>slot.name==='paintDialog').length===2, 'enumerate both live dialogs');
  check(host.sdk.targets.paintDialog()===null && !shadow.host.isConnected, 'ambiguous target must detach');
  duplicate.remove();
  await tick();
  check(shadow.host.isConnected,'remount after disambiguation');
  for(const position of ['before','after','prepend','append']){
   const el=document.createElement('i');
   const remove=host.sdk.targets.insert({target:host.sdk.targets.paintTypes,element:el,position});
   const group=host.sdk.targets.paintTypes();
   const placed={before:group.previousElementSibling,after:group.nextElementSibling,prepend:group.firstElementChild,append:group.lastElementChild};
   check(placed[position]===el,position+' insertion failed');
   remove();check(!el.isConnected,'insertion cleanup failed');
  }
  const range = shadow.querySelector('input[type=range]');
  const number = shadow.querySelector('input[type=number]');
  const checkbox = shadow.querySelector('input[type=checkbox]');
  check(range.disabled && number.disabled, 'group must initially disable both fields');
  const action = dialog.querySelector('fieldset button');
  check(action?.getAttribute('aria-pressed') === 'false', 'missing toolbar action');
  action.click();
  check(checkbox.checked && action.getAttribute('aria-pressed') === 'true', 'toolbar failed to update form');
  checkbox.click();
  check(action.getAttribute('aria-pressed') === 'false', 'checkbox failed to update toolbar');
  checkbox.click();
  check(!range.disabled && !number.disabled, 'checkbox failed to enable the group');
  range.value = '125';
  range.dispatchEvent(new Event('input', { bubbles: true }));
  check(number.value === '125' && shadow.textContent.includes('100 px → 125 px'), 'range binding failed');
  number.focus();
  number.value = '140';
  number.dispatchEvent(new Event('input', { bubbles: true }));
  check(shadow.activeElement === number, 'number input failed to receive focus');
  number.blur();
  check(range.value === '140', 'number did not commit to range');
  check(shadow.querySelector('style[data-canvas-native-ui]'), 'missing native style adapter');
  document.body.style.setProperty('--color-bg-secondary', 'rgb(72, 81, 90)');
  check(getComputedStyle(number).backgroundColor === 'rgb(72, 81, 90)', 'theme did not propagate');
  dialog.replaceWith(replacement);
  await tick();
  check(findShadow(replacement) === shadow && range.value === '140', 'popup rebuild lost panel state');
  shadow.querySelector('button').click();
  check(range.disabled && number.value === '100', 'reset failed');
  check(replacement.contains(action) && action.getAttribute('aria-pressed') === 'false', 'toolbar remount/reset failed');
  host.dispose();
  await tick();
  check(!action.isConnected, 'toolbar action survived unload');
  check(!findShadow(replacement), 'panel survived unload');
}

const html =  `<!doctype html><meta charset="utf-8"><body>
<aside aria-label="Right sidebar"><input></aside>
<div role="dialog"><fieldset><input type="radio" value="IMAGE"></fieldset><button role="combobox">Fill</button></div>
<pre id="result">pending</pre><script>
window.figma={currentPage:{selection:[{id:'selected'}]},on(){},off(){}};
${runtimeSource()}
function loadTemplate(){${template}}
</script>`;
browserFixture('ui-browser',html,({evaluate})=>evaluate(exercise))
 .then(()=>console.log('PASS Chromium Fill template: native theme, grouped controls, editing, popup replacement and unload'))
 .catch(error=>{console.error(error);process.exitCode=1;});
