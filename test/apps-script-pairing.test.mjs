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
    logToGuessWhoSheet:()=>{logged=true;},markAsDone:ts=>marks.push(ts),
    townPairingRequest_:(config,input)=>{
      requests.push(input);
      if(input.action==='pool'){if(failRead)throw Error('offline');return {bookedIds:['U1','U2'],eligibleIds:['U1','U2','U3','U4','U5','U6'],committed};}
      if(input.action==='commit'){if(conflict)throw Error('already_booked');committed={pairs:input.pairs,leftover:input.leftover};return committed;}
      return {notifications:{pending:false}};
    }
  });
  failRead=true;assert.throws(()=>c.runTownConnectedPairing_({}, {ts:'100.000001'}, []),/offline/);assert.equal(draws,0);
  failRead=false;conflict=true;assert.throws(()=>c.runTownConnectedPairing_({}, {ts:'100.000001'}, []),/already_booked/);assert.equal(marks.length,0);
  conflict=false;c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);assert.equal(draws,2);assert(logged);
  c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);assert.equal(draws,2,'a rerun resumes the committed batch without another draw');
});

test('after exclusions, an empty or odd pool completes without pairing an already-booked person',()=>{
  const c=vm.createContext({console,Set,PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}});vm.runInContext(source,c);
  let reactors=['U1','U2','U3'],committed;
  Object.assign(c,{fetchReactors:()=>reactors,pickLotteryWinner:ids=>ids[0],getUserName:id=>id,
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>null})},logToGuessWhoSheet(){},markAsDone(){},
    townPairingRequest_:(config,input)=>{
      if(input.action==='pool')return {bookedIds:['U1','U2'],eligibleIds:['U1','U2','U3']};
      if(input.action==='commit'){committed=input;return input;}
      return {notifications:{pending:false}};
    }
  });
  c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);
  assert.equal(committed.pairs.length,0);assert.equal(committed.leftover,'U3');
  reactors=['U1','U2'];c.runTownConnectedPairing_({}, {ts:'100.000001'}, []);
  assert.equal(committed.pairs.length,0);assert.equal(committed.leftover,null);
});
