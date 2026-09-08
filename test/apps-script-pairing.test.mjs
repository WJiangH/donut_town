import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../Google_Script/Code.gs", import.meta.url), "utf8");
const context = vm.createContext({
  console,
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => "" })
  }
});
vm.runInContext(source, context);

test("manager exclusions use Slack IDs from Members rather than email rosters", () => {
  const members = {
    ULEADER: { managerSlackId: "" },
    UMEMBER: { managerSlackId: "ULEADER" },
    UOTHER: { managerSlackId: "" }
  };
  assert.equal(context.isLeaderMemberConflict("ULEADER", "UMEMBER", members), true);
  assert.equal(context.isLeaderMemberConflict("UMEMBER", "ULEADER", members), true);
  assert.equal(context.isLeaderMemberConflict("UMEMBER", "UOTHER", members), false);
  assert.equal(context.isLeaderMemberConflict("UNEW", "UOTHER", members), false);
});

test('connected script excludes booked reactors before pairing and retries from durable results',()=>{
  let committed=null,conflict=false,failRead=false,logged=false,draws=0;
  const requests=[],marks=[];
  const c=vm.createContext({console,Set,PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}});
  vm.runInContext(source,c);
  Object.assign(c,{
    fetchReactors:()=>['U1','U2','U3','U4','U5','U6','U6','U99'],
    getDonutMemberDirectory_:()=>({}),getUserName:id=>id,
    buildConstrainedPairs:pool=>{draws++;assert.deepEqual([...pool],['U3','U4','U5','U6']);return {pairs:[['U3','U4'],['U5','U6']]};},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>logged?{getLastRow:()=>2,getRange:()=>({getValues:()=>[['100.000001']]})}:null})},
    logToGuessWhoSheet:()=>{logged=true;},markAsDone:ts=>marks.push(ts),postToSlack(){},
    townPairingRequest_:(config,input)=>{
      requests.push(input);
      if(input.action==='pool'){if(failRead)throw Error('offline');return {bookedIds:['U1','U2','U8','U9'],eligibleIds:['U1','U2','U3','U4','U5','U6'],committed};}
      if(input.action==='commit'){if(conflict)throw Error('already_booked');committed={pairs:input.pairs,leftover:input.leftover};return committed;}
      return {notifications:{pending:false}};
    }
  });
  failRead=true;assert.throws(()=>c.runTownConnectedPairing_({}, {ts:'100.000001'}, []),/offline/);assert.equal(draws,0);
  failRead=false;conflict=true;assert.throws(()=>c.runTownConnectedPairing_({}, {ts:'100.000001'}, []),/already_booked/);assert.equal(marks.length,0);
  conflict=false;c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);assert.equal(draws,2);assert(logged);
  c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);assert.equal(draws,2,'a rerun resumes the committed batch without another draw');
});

test('Group D subtraction preserves the original small-pool, odd-person and result-message rules',()=>{
  const c=vm.createContext({console,Set,PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}});vm.runInContext(source,c);
  let reactors=['U1','U2','U3'],committed;
  const messages=[];
  Object.assign(c,{fetchReactors:()=>reactors,getUserName:id=>id,getDonutMemberDirectory_:()=>({}),
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>null})},logToGuessWhoSheet(){},markAsDone(){},
    postToSlack:(text,ts)=>messages.push({text,ts}),
    townPairingRequest_:(config,input)=>{
      if(input.action==='pool')return {bookedIds:['U1','U2','U9'],eligibleIds:['U1','U2','U3','U4','U5','U9']};
      if(input.action==='commit'){committed=input;return input;}
      throw Error('Random result messages must remain in the Sheet workflow');
    }
  });
  c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);
  assert.equal(committed,undefined,'one remaining member follows the original skip rule');
  reactors=['U1','U2'];c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);
  assert.equal(committed,undefined);assert.equal(messages.length,0);
  reactors=['U1','U2','U3','U4','U5'];
  c.runTownConnectedPairing_({ASSIGNED_WINNER_SLACK_ID:'U3'}, {ts:'100.000001'}, []);
  assert.equal(committed.leftover,'U3');assert.deepEqual([...committed.pairs[0]].sort(),['U4','U5']);
  assert.equal(messages[0].ts,'100.000001');
  assert.match(messages[0].text,/The Donuts are Served!/);
  assert.match(messages[0].text,/join them for a trio chat/);
  assert(!messages[0].text.includes('<@U9>'),'someone outside Group D never enters the random pool');
  const original=messages[0].text;messages.length=0;
  c.processGuessWhoResults({ts:'100.000001'},committed.pairs,committed.leftover);
  assert.equal(messages[0].text,original,'connected draws use the original result formatter');
});
