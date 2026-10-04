import { get, onValue, push, ref, update } from "firebase/database";
import { database } from "../config/firebase";

const dentalPath=(clinicId,patientId)=>`clinics/${clinicId}/dental/patients/${patientId}`;

export function subscribeDentalTwin(clinicId,patientId,callback,onError){
  if(!clinicId||!patientId){callback?.(null);return()=>{};}
  return onValue(ref(database,dentalPath(clinicId,patientId)),snap=>{
    callback?.(snap.exists()?{patientId,...snap.val()}:null);
  },onError);
}

export async function getDentalTwin(clinicId,patientId){
  if(!clinicId||!patientId)return null;
  const snap=await get(ref(database,dentalPath(clinicId,patientId)));
  return snap.exists()?{patientId,...snap.val()}:null;
}

export async function syncDentalVisitToTwin({clinicId,patientId,visitId,doctor,dentalData={}}){
  if(!clinicId||!patientId||!visitId)return;
  const root=dentalPath(clinicId,patientId);
  const existing=await get(ref(database,root));
  const old=existing.exists()?existing.val():{};
  const previousChart=old.currentChart||{};
  const hasChart=dentalData.dentalChart && typeof dentalData.dentalChart==="object";
  const currentChart=hasChart?dentalData.dentalChart:previousChart;
  const treatmentPlan=dentalData.treatmentPlanItems??old.treatmentPlan??[];
  const sessions=dentalData.dentalSessions??old.sessions??[];
  const periodontalChart=dentalData.periodontalChart??old.periodontalChart??{};
  const media=dentalData.dentalMedia??old.media??[];
  const timestamp=Date.now();
  const snapshotId=push(ref(database,`${root}/snapshots`)).key;
  const eventId=push(ref(database,`${root}/timeline`)).key;
  const updates={};

  updates[`${root}/currentChart`]=currentChart;
  updates[`${root}/treatmentPlan`]=treatmentPlan;
  updates[`${root}/sessions`]=sessions;
  updates[`${root}/periodontalChart`]=periodontalChart;
  updates[`${root}/media`]=media;
  updates[`${root}/updatedAt`]=timestamp;
  updates[`${root}/lastVisitId`]=visitId;

  if(snapshotId) updates[`${root}/snapshots/${snapshotId}`]={
    id:snapshotId,visitId,createdAt:timestamp,doctorId:doctor?.id||"",doctorName:doctor?.name||"",
    chart:currentChart,treatmentPlan,media
  };

  const changedTeeth=[...new Set([...Object.keys(previousChart),...Object.keys(currentChart)])].filter(key=>
    JSON.stringify(previousChart[key]||{})!==JSON.stringify(currentChart[key]||{})
  );
  if(eventId) updates[`${root}/timeline/${eventId}`]={
    id:eventId,visitId,createdAt:timestamp,doctorId:doctor?.id||"",doctorName:doctor?.name||"",
    type:"visit_snapshot",changedTeeth,before:previousChart,after:currentChart
  };
  changedTeeth.forEach(tooth=>{
    const toothEvent=push(ref(database,`${root}/teeth/${tooth}/timeline`)).key;
    if(toothEvent) updates[`${root}/teeth/${tooth}/timeline/${toothEvent}`]={
      id:toothEvent,visitId,createdAt:timestamp,doctorId:doctor?.id||"",doctorName:doctor?.name||"",
      before:previousChart[tooth]||null,after:currentChart[tooth]||null
    };
    updates[`${root}/teeth/${tooth}/current`]=currentChart[tooth]||null;
    updates[`${root}/teeth/${tooth}/updatedAt`]=timestamp;
  });
  await update(ref(database),updates);
}

export function buildDentalInsights(twin){
  if(!twin)return {affected:0,openPlans:0,planValue:0,paid:0,remaining:0,overdue:0,media:0};
  const chart=twin.currentChart||{};
  const plans=Array.isArray(twin.treatmentPlan)?twin.treatmentPlan:Object.values(twin.treatmentPlan||{});
  const sessions=Array.isArray(twin.sessions)?twin.sessions:Object.values(twin.sessions||{});
  const media=Array.isArray(twin.media)?twin.media:Object.values(twin.media||{});
  const planValue=plans.reduce((s,x)=>s+(Number(x.cost)||0),0);
  const paid=sessions.reduce((s,x)=>s+(Number(x.paid)||0),0);
  const now=Date.now();
  return {
    affected:Object.values(chart).filter(x=>x?.status&&x.status!=="healthy").length,
    openPlans:plans.filter(x=>x.status!=="completed").length,
    planValue,paid,remaining:Math.max(0,planValue-paid),
    overdue:sessions.filter(x=>x.status==="planned"&&x.date&&new Date(x.date).getTime()<now).length,
    media:media.length,
  };
}
