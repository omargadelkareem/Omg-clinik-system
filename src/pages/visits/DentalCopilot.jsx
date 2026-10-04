import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, MicOff, Play, Sparkles, X } from "lucide-react";

const STATUS_RULES = [
  { key:"caries", label:"تسوس", words:["تسوس","caries","decay"] },
  { key:"root_canal", label:"علاج جذور", words:["علاج عصب","علاج جذور","root canal","rct","عصب"] },
  { key:"filling", label:"حشو", words:["حشو","filling","restoration"] },
  { key:"crown", label:"تاج", words:["تاج","تركيبة","crown"] },
  { key:"implant", label:"زرعة", words:["زرعة","implant"] },
  { key:"missing", label:"مفقود", words:["مفقود","مخلوع","missing","extracted"] },
  { key:"fracture", label:"كسر", words:["كسر","fracture","cracked"] },
];

const SURFACE_RULES = [
  { key:"occlusal", label:"O", words:["occlusal","اكلوزال","إطباقي","اطباقي"] },
  { key:"mesial", label:"M", words:["mesial","ميزيال","أنسي","انسي"] },
  { key:"distal", label:"D", words:["distal","ديستال","وحشي"] },
  { key:"buccal", label:"B", words:["buccal","باكال","شدقي"] },
  { key:"lingual", label:"L", words:["lingual","لينجوال","لساني","palatal","بالاتال","حنكي"] },
];

function normalizeArabic(value=""){
  return value.toLowerCase().replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[،,.]/g," ");
}
function hasAny(text,words){ return words.some(w=>text.includes(normalizeArabic(w))); }

export function parseDentalCommand(raw=""){
  const text=normalizeArabic(raw);
  const toothMatch=text.match(/(?:سن|السن|tooth|رقم)?\s*([1-4][1-8])\b/);
  const tooth=toothMatch ? Number(toothMatch[1]) : null;
  const state=STATUS_RULES.find(rule=>hasAny(text,rule.words)) || null;
  const surfaces=SURFACE_RULES.filter(rule=>hasAny(text,rule.words));
  const costMatch=text.match(/(?:تكلفه|سعر|cost|price)\s*(?:حوالي)?\s*(\d{2,7})/) || text.match(/(\d{2,7})\s*(?:جنيه|ج\.م|egp)/);
  const cost=costMatch ? costMatch[1] : "";
  const procedures=[];
  if(hasAny(text,["rct","root canal","علاج عصب","علاج جذور"])) procedures.push("علاج جذور RCT");
  if(hasAny(text,["crown","تاج","تركيبه"])) procedures.push("Crown");
  if(hasAny(text,["filling","حشو","restoration"])) procedures.push("حشو");
  if(hasAny(text,["implant","زرعه"])) procedures.push("Implant");
  if(hasAny(text,["extraction","خلع"])) procedures.push("خلع");
  if(!procedures.length && state && state.key!=="healthy") procedures.push(state.label);
  return { raw, tooth, status:state?.key || "", statusLabel:state?.label || "", surfaces:surfaces.map(x=>x.key), surfaceLabels:surfaces.map(x=>x.label), cost, procedures };
}

export default function DentalCopilot({ chart={}, treatmentPlan=[], onApply }) {
  const [text,setText]=useState("");
  const [voiceState,setVoiceState]=useState("idle");
  const [message,setMessage]=useState("");
  const [seconds,setSeconds]=useState(0);
  const recognitionRef=useRef(null);
  const timerRef=useRef(null);
  const listening=voiceState==="listening";
  const parsed=useMemo(()=>parseDentalCommand(text),[text]);

  useEffect(()=>()=>{ clearInterval(timerRef.current); recognitionRef.current?.abort?.(); },[]);

  const startVoice=async()=>{
    setMessage("");
    setVoiceState("starting");
    setSeconds(0);

    const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Recognition){
      setVoiceState("error");
      setMessage("الإملاء الصوتي غير مدعوم في هذا المتصفح. افتح النظام على Chrome أو Edge.");
      return;
    }

    try{
      if(navigator.mediaDevices?.getUserMedia){
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        stream.getTracks().forEach(track=>track.stop());
      }

      const recognition=new Recognition();
      recognition.lang="ar-EG";
      recognition.interimResults=true;
      recognition.continuous=true;
      recognition.maxAlternatives=1;

      recognition.onstart=()=>{
        setVoiceState("listening");
        setMessage("");
        timerRef.current=setInterval(()=>setSeconds(value=>value+1),1000);
      };
      recognition.onspeechstart=()=>setVoiceState("listening");
      recognition.onresult=(event)=>{
        let transcript="";
        for(let i=0;i<event.results.length;i++) transcript+=event.results[i][0].transcript+" ";
        setText(transcript.trim());
      };
      recognition.onerror=(event)=>{
        clearInterval(timerRef.current);
        setVoiceState("error");
        const errors={
          "not-allowed":"صلاحية الميكروفون مرفوضة. اسمح للمتصفح باستخدام الميكروفون ثم جرّب مرة أخرى.",
          "service-not-allowed":"خدمة التعرف على الصوت محظورة في المتصفح.",
          "audio-capture":"لم يتم العثور على ميكروفون يعمل على الجهاز.",
          "no-speech":"لم أسمع كلامًا. اضغط الميكروفون وتحدث بعد ظهور «جاري الاستماع».",
          "network":"تعذر الوصول لخدمة التعرف على الصوت. تحقق من الإنترنت.",
        };
        setMessage(errors[event.error] || `تعذر تشغيل الصوت (${event.error || "unknown"}).`);
      };
      recognition.onend=()=>{
        clearInterval(timerRef.current);
        setVoiceState(current=>current==="error" ? "error" : "captured");
      };

      recognitionRef.current=recognition;
      recognition.start();
    }catch(error){
      clearInterval(timerRef.current);
      setVoiceState("error");
      if(error?.name==="NotAllowedError" || error?.name==="PermissionDeniedError")
        setMessage("صلاحية الميكروفون مرفوضة. اضغط علامة القفل بجانب عنوان الموقع وفعّل Microphone.");
      else if(error?.name==="NotFoundError")
        setMessage("لا يوجد ميكروفون متاح على الجهاز.");
      else
        setMessage("تعذر فتح الميكروفون. راجع صلاحية Microphone في المتصفح.");
    }
  };
  const stopVoice=()=>{
    recognitionRef.current?.stop();
    clearInterval(timerRef.current);
    setVoiceState("captured");
  };
  const apply=()=>{
    if(!parsed.tooth){setMessage("اذكر رقم السن بنظام FDI، مثال: السن 16.");return;}
    if(!parsed.status && !parsed.procedures.length){setMessage("اذكر الحالة أو الإجراء المطلوب.");return;}
    onApply?.(parsed); setMessage("تم تنفيذ الأمر على الخريطة وخطة العلاج.");
  };

  return <section className="dental-copilot">
    <div className="copilot-brand"><span className="copilot-mark"><Sparkles size={17}/></span><div><strong>OMG Dental Copilot</strong><span>أمر واحد يحدّث الـChart وخطة العلاج</span></div><em>LOCAL AI</em></div>
    <div className={`copilot-voice-status ${voiceState}`}>
      <span className="voice-status-dot" />
      <div>
        <strong>{voiceState==="starting" ? "جاري تشغيل الميكروفون..." : listening ? "جاري الاستماع — اتكلم الآن" : voiceState==="captured" ? "تم التقاط الكلام" : voiceState==="error" ? "الميكروفون غير متاح" : "اضغط الميكروفون ثم ابدأ الكلام"}</strong>
        <small>{listening ? `استماع 00:${String(seconds).padStart(2,"0")}` : voiceState==="captured" ? "يمكنك مراجعة النص ثم الضغط على تنفيذ" : "سيظهر كلامك مباشرة داخل المربع"}</small>
      </div>
      {listening && <div className="voice-wave" aria-hidden="true">{[1,2,3,4,5].map(x=><i key={x}/>)}</div>}
    </div>
    <div className="copilot-command">
      <button type="button" aria-label={listening?"إيقاف الاستماع":"بدء الاستماع"} className={listening?"copilot-mic listening":voiceState==="starting"?"copilot-mic starting":"copilot-mic"} onClick={listening?stopVoice:startVoice} disabled={voiceState==="starting"}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button>
      <textarea value={text} onChange={e=>{setText(e.target.value);setMessage("");}} placeholder='قل أو اكتب: "السن 16 تسوس Occlusal وDistal، محتاج RCT وبعدها Crown، التكلفة 6000"' />
      <button type="button" className="copilot-run" onClick={apply}><Play size={15}/> تنفيذ</button>
    </div>
    {text && <div className="copilot-understanding">
      <span className={parsed.tooth?"ok":""}>{parsed.tooth?<>سن <b>{parsed.tooth}</b></>:"لم أحدد السن"}</span>
      {parsed.statusLabel && <span className="ok">{parsed.statusLabel}</span>}
      {!!parsed.surfaceLabels.length && <span className="ok">الأسطح {parsed.surfaceLabels.join(" + ")}</span>}
      {parsed.procedures.map(p=><span className="ok" key={p}>{p}</span>)}
      {parsed.cost && <span className="ok">{Number(parsed.cost).toLocaleString("ar-EG")} ج.م</span>}
    </div>}
    {message && <div className={message.startsWith("تم")?"copilot-message success":"copilot-message"}>{message.startsWith("تم")?<Check size={14}/>:<X size={14}/>} {message}</div>}
    <div className="copilot-examples">
      <button type="button" onClick={()=>setText("السن 16 تسوس Occlusal و Distal محتاج RCT وبعدها Crown التكلفة 6000")}>مثال RCT + Crown</button>
      <button type="button" onClick={()=>setText("السن 26 حشو Mesial التكلفة 1200")}>مثال حشو</button>
      <button type="button" onClick={()=>setText("السن 36 مفقود محتاج Implant التكلفة 15000")}>مثال Implant</button>
    </div>
  </section>;
}
