const assert = require('node:assert/strict');

module.exports = async function checkForms(evaluate) {
  await evaluate(async () => {
    const scene = field('select','测试场景');
    window.switchPlaygroundScene = value => {
      scene.value = value;
      scene.dispatchEvent(new Event('change', {bubbles:true}));
    };
    switchPlaygroundScene('toolbar');
    field('button','右对齐').click();
  });
  assert.equal(await evaluate(() => field('[aria-label="右对齐"]:not(button)').style.justifyItems), 'end');
  await evaluate(() => switchPlaygroundScene('wizard'));
  assert.equal(await evaluate(() => field('button','上一步').disabled), true);
  await evaluate(async () => {
    const range=field('select','图层范围');
    range.value='整个合成';
    range.dispatchEvent(new Event('change',{bubbles:true}));
    field('button','下一步').click(); await Promise.resolve();
    const group=field('[aria-label="输出格式"]');
    [...group.children].find(button=>button.textContent==='JPEG').click();
    field('button','上一步').click();
  });
  assert.equal(await evaluate(() => field('select','图层范围').value), '整个合成');
  await evaluate(async () => {field('button','下一步').click(); await Promise.resolve(); field('button','下一步').click(); await Promise.resolve();});
  assert.equal(await evaluate(() => field('button','下一步').disabled), true);
  assert.ok(await evaluate(() => field('button','确认模拟输出').getRootNode().textContent.includes('整个合成 → JPEG')));
  await evaluate(() => field('button','确认模拟输出').click());
  assert.ok(await evaluate(() => field('button','确认模拟输出').getRootNode().textContent.includes('已模拟输出 JPEG')));
};
