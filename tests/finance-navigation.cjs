// Use the public destinations, including secondary destinations under More.
async function openFinanceSection(page,view){
 if(await page.locator('#expFinanceNav').isHidden())await page.locator('[data-family-finance]:visible').click();
 if(['dash','ledger','plan'].includes(view)){await page.locator('#expFinanceNav [data-view="'+view+'"]').click();return;}
 if(!await page.locator('#expFinanceMore').evaluate(n=>n.open))await page.locator('#expFinanceMore summary').click();
 await page.locator('#expFinanceMore [data-view="'+view+'"]').click();
}
async function openAdvancedExpense(page){await page.locator('#expAddBtn').click();await page.locator('#fqDetails summary').click();await page.locator('#fqAdvanced').click();}
module.exports={openFinanceSection,openAdvancedExpense};
