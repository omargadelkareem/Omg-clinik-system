import { onValue, ref } from "firebase/database";
import { database } from "../config/firebase";

function rows(value){
  return Object.entries(value||{}).map(([id,item])=>({id,...item}));
}
export function subscribePatientFinance(clinicId,patientId,callback,onError){
  if(!clinicId||!patientId){callback?.({transactions:[],payments:[],summary:{billed:0,paid:0,remaining:0,invoices:0}});return()=>{};}
  return onValue(ref(database,`clinics/${clinicId}/finance`),snap=>{
    const finance=snap.val()||{};
    const transactions=rows(finance.transactions).filter(x=>x.patientId===patientId&&x.status!=="cancelled").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const transactionIds=new Set(transactions.map(x=>x.id));
    const payments=rows(finance.payments).filter(x=>x.patientId===patientId||transactionIds.has(x.transactionId)).sort((a,b)=>(b.paidAt||b.createdAt||0)-(a.paidAt||a.createdAt||0));
    const billed=transactions.reduce((s,x)=>s+(Number(x.amount)||0),0);
    const paid=transactions.reduce((s,x)=>s+(Number(x.paid)||0),0);
    const remaining=transactions.reduce((s,x)=>s+(Number(x.remaining ?? ((Number(x.amount)||0)-(Number(x.paid)||0)))||0),0);
    callback?.({transactions,payments,summary:{billed,paid,remaining,invoices:transactions.length,unpaid:transactions.filter(x=>x.status==="unpaid").length,partial:transactions.filter(x=>x.status==="partial").length}});
  },onError);
}
