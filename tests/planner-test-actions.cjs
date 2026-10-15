// Navigate disclosures through their real controls before legacy business-flow actions.
// New UX tests deliberately do not use this helper, so collapsed defaults remain asserted.
async function revealPlannerControl(p,selector){const el=p.locator(selector);if(!await el.count())return;const ancestors=await el.locator('xpath=ancestor::details').all();for(const d of ancestors)if(!await d.evaluate(e=>e.open))await d.locator(':scope > summary').click();}
module.exports={revealPlannerControl};
