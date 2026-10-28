import fs from 'node:fs';
const errors=[];
const schema=fs.readFileSync('prisma/schema.prisma','utf8');
const migration=fs.readFileSync('prisma/migrations/202610140016_reward_ledger_maker_checker/migration.sql','utf8');
const finance=fs.readFileSync('apps/api/src/finance/finance.service.ts','utf8');
const controller=fs.readFileSync('apps/api/src/finance/finance.controller.ts','utf8');
const web=fs.readFileSync('apps/web/app/finance/page.tsx','utf8');
if(!/provider\s*=\s*"mysql"/.test(schema)) errors.push('Prisma datasource is not MySQL.');
for(const model of ['RewardPolicy','RewardCalculation','RewardLedgerEntry','FinanceApproval']) if(!schema.includes(`model ${model} {`)||!migration.includes(`CREATE TABLE \`${model}\``)) errors.push(`Missing schema/migration for ${model}.`);
for(const token of ['PlaybackEventStatus.ACCEPTED','PlaybackEventType.PLAY_COMPLETED','PENDING_APPROVAL','REWARD_ELIGIBILITY_CALCULATED','reward-accrual:']) if(!finance.includes(token)) errors.push(`Finance service missing guard/logic: ${token}`);
if(!finance.includes('approval.requestedById === actor.sub')) errors.push('Maker-checker self-approval guard missing.');
if(!controller.includes("Controller('finance')")||!web.includes('Reward eligibility & ledger')) errors.push('Finance API or web page missing.');
if(!schema.includes('@@unique([screenId, periodStart, periodEnd])')) errors.push('Reward period idempotency unique constraint missing.');
if(errors.length){errors.forEach(e=>console.error(`FAIL: ${e}`));process.exit(1)}
console.log('Contract finance-accrual static checks passed: MySQL schema, four finance tables/migration, accepted-playback filters, maker-checker guard, ledger idempotency, API and UI present.');
