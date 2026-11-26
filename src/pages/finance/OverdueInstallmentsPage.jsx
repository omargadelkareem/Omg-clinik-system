import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { subscribeOverdueInstallments } from "../../services/overdueInstallmentsService";
import "./OverdueInstallmentsPage.css";
export default function OverdueInstallmentsPage(){
 const {clinicId}=useAuth(),[rows,setRows]=useState([]),[error,setError]=useState("");
 useEffect(()=>{if(!clinicId)return;return subscribeOverdueInstallments(clinicId,setRows,err=>setError(err.message||"تعذر تحميل المتأخرات"));},[clinicId]);
 return <main className="overdue-page" dir="rtl"><header><h1>الأقساط المتأخرة</h1><p>قائمة استحقاقات العيادة التي تجاوزت تاريخ السداد. متابعة داخلية فقط، ولا يتم إرسال رسائل تلقائيًا للمرضى.</p></header>{error&&<p role="alert">{error}</p>}<div className="overdue-stat">عدد الأقساط المتأخرة: <strong>{rows.length}</strong> — إجمالي المستحق: <strong>{rows.reduce((s,x)=>s+x.amount,0).toLocaleString("ar-EG")} ج.م</strong></div><div className="overdue-table"><table><thead><tr><th>المريض</th><th>الفاتورة</th><th>القسط</th><th>تاريخ الاستحقاق</th><th>المبلغ المتأخر</th><th>إجراء</th></tr></thead><tbody>{rows.map(row=><tr key={row.invoiceId+":"+row.installment}><td>{row.patientId}</td><td>{row.invoiceNumber}</td><td>{row.installment}</td><td>{row.dueDate}</td><td>{row.amount} ج.م</td><td><Link to={`/patients/${row.patientId}/procedures`}>ملف العلاج والتحصيل</Link></td></tr>)}</tbody></table>{!rows.length&&<p>لا توجد أقساط متأخرة حاليًا.</p>}</div></main>;
}
