'use client'

export const dynamic = 'force-dynamic'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../components/app-shell'
import { createClient } from '../../supabase-client'
import styles from './JournalPage.module.css'

type Entry={id:string;user_id:string;title:string;content:string|null;reference_at:string|null;tags:string[]|null;created_at:string;updated_at:string}
export default function JournalPage(){const router=useRouter();const supabase=useMemo(()=>createClient(),[]);const [entries,setEntries]=useState<Entry[]>([]);const [userId,setUserId]=useState('');const [email,setEmail]=useState('');const [search,setSearch]=useState('');const [tag,setTag]=useState('');const [selected,setSelected]=useState<Entry|null>(null);const [form,setForm]=useState({title:'',content:'',reference_at:'',tags:''});const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [mobileEditor,setMobileEditor]=useState(false);const saveFormRef=useRef<HTMLFormElement>(null)
 async function load(){const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/login');return}setUserId(user.id);setEmail(user.email??'');const {data,error:e}=await supabase.from('journal_entries').select('*').eq('user_id',user.id).order('created_at',{ascending:false});if(e)setError(e.message);setEntries((data??[]) as Entry[])}useEffect(()=>{load()},[])
 const tags=useMemo(()=>Array.from(new Set(entries.flatMap(e=>e.tags??[]))).sort(),[entries]);const filtered=useMemo(()=>entries.filter(e=>{const q=search.trim().toLowerCase();const matches=!q||e.title.toLowerCase().includes(q)||(e.content??'').toLowerCase().includes(q);const matchesTag=!tag||((e.tags??[]).includes(tag));return matches&&matchesTag}),[entries,search,tag])
 function newEntry(){setSelected(null);setForm({title:'',content:'',reference_at:'',tags:''});setError('');setMobileEditor(true)}function edit(e:Entry){setSelected(e);setForm({title:e.title,content:e.content??'',reference_at:e.reference_at?new Date(e.reference_at).toISOString().slice(0,16):'',tags:(e.tags??[]).join(', ')});setError('');setMobileEditor(true)}
 async function save(ev:FormEvent){ev.preventDefault();if(!form.title.trim()){setError('Informe um título.');return}setSaving(true);setError('');const tags=form.tags.split(',').map(x=>x.trim()).filter(Boolean);const payload={title:form.title.trim(),content:form.content,reference_at:form.reference_at?new Date(form.reference_at).toISOString():null,tags};const result=selected?await supabase.from('journal_entries').update(payload).eq('id',selected.id).eq('user_id',userId):await supabase.from('journal_entries').insert({...payload,user_id:userId});if(result.error)setError(result.error.message);else{await load();setSelected(null);setForm({title:'',content:'',reference_at:'',tags:''});setMobileEditor(false)}setSaving(false)}
 async function remove(){if(!selected)return;if(!window.confirm('Excluir esta nota?'))return;setSaving(true);const {error:e}=await supabase.from('journal_entries').delete().eq('id',selected.id).eq('user_id',userId);if(e)setError(e.message);else{await load();setSelected(null);setForm({title:'',content:'',reference_at:'',tags:''});setMobileEditor(false)}setSaving(false)}
 const formatListDate=(value:string)=>{const date=new Date(value);const now=new Date();if(date.toDateString()===now.toDateString())return `Hoje, ${date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;return date.toLocaleDateString('pt-BR')}
 const formatCreated=(value:string)=>new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
 const editedLabel=(value:string)=>{const diff=Math.max(0,Date.now()-new Date(value).getTime());const minutes=Math.floor(diff/60000);if(minutes<1)return 'agora';if(minutes===1)return 'há 1 minuto';return `há ${minutes} minutos`}
 const focusTags=()=>{document.getElementById('journal-tags')?.focus()}
 return <AppShell email={email}><div className={styles.page}>
   <header className={styles.header}><div className={styles.eyebrow}>Espaço pessoal</div><h1>Meu Journal</h1><p className={styles.subtitle}>Suas anotações pessoais. Só você pode acessá-las. <span className={styles.lock} aria-label="Privado">🔒</span></p></header>
   {error&&<div className={styles.error}>{error}</div>}
   <div className={`${styles.layout} ${mobileEditor?styles.editorMode:''}`}>
     <aside className={styles.sidebar}>
       <div className={styles.sidebarTop}><button className={styles.newButton} type="button" onClick={newEntry}>＋ Nova nota</button></div>
       <div className={styles.filters}>
         <button className={`${styles.tagButton} ${!tag?styles.active:''}`} type="button" onClick={()=>setTag('')}>Todas</button>
         {tags.map(t=><button key={t} className={`${styles.tagButton} ${tag===t?styles.active:''}`} type="button" onClick={()=>setTag(t)}>{t}</button>)}
       </div>
       <div className={styles.list}>
         {filtered.map(e=><button className={`${styles.item} ${selected?.id===e.id?styles.selected:''}`} key={e.id} type="button" onClick={()=>edit(e)}>
           <span className={styles.itemTitle}>{e.title}</span><p className={styles.preview}>{e.content||'Sem conteúdo'}</p><span className={styles.date}>{formatListDate(e.created_at)}</span>
           {!!(e.tags??[]).length&&<span className={styles.itemTags}>{(e.tags??[]).map(t=><span className={styles.itemTag} key={t}>{t}</span>)}</span>}
         </button>)}
         {!filtered.length&&<div className={styles.emptyList}><span className={styles.emptyIcon}>📓</span><span>Nenhuma anotação ainda.</span></div>}
       </div>
     </aside>
     <section className={styles.editor}>
       {selected||mobileEditor?<>
         <div className={styles.editorHeader}>
           <input className={styles.titleInput} required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Título da nota" aria-label="Título da nota" />
           <div className={styles.actions}>
             <button className={styles.actionButton} type="button" onClick={focusTags}>🏷️ Tags</button>
             {selected&&<button className={`${styles.actionButton} ${styles.deleteButton}`} type="button" onClick={remove}>🗑️</button>}
             <button className={styles.saveButton} type="button" disabled={saving} onClick={()=>saveFormRef.current?.requestSubmit()}>{saving?'Salvando...':'Salvar'}</button>
             <button className={`${styles.actionButton} ${styles.mobileBack}`} type="button" onClick={()=>setMobileEditor(false)}>Voltar</button>
           </div>
         </div>
         <div className={styles.metadata}>
           {selected?<><span>Criado em {formatCreated(selected.created_at)}</span><span>Editado {editedLabel(selected.updated_at)}</span></>:<span>Rascunho pessoal</span>}
           {(form.tags.split(',').map(x=>x.trim()).filter(Boolean)).map(t=><span className={styles.metaTag} key={t}>{t}</span>)}
         </div>
         <form ref={saveFormRef} id="journal-save-form" className={styles.formArea} onSubmit={save}>
           <textarea className={styles.textarea} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Escreva sua anotação aqui..." aria-label="Conteúdo da anotação" />
           <div className={styles.supportFields}>
             <label className={styles.field}>Data/hora de referência<input type="datetime-local" value={form.reference_at} onChange={e=>setForm({...form,reference_at:e.target.value})}/></label>
             <label className={styles.field}>Tags, separadas por vírgulas<input id="journal-tags" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="cliente, reunião, pessoal"/></label>
           </div>
           <div className={styles.footerActions}><button type="button" className={`${styles.actionButton} ${styles.cancelButton}`} onClick={()=>{setSelected(null);setForm({title:'',content:'',reference_at:'',tags:''});setMobileEditor(false)}}>Cancelar</button>{selected&&<button type="button" className={`${styles.actionButton} ${styles.deleteButton}`} onClick={remove}>Excluir</button>}<button type="submit" className={styles.saveButton} disabled={saving}>{saving?'Salvando...':'Salvar'}</button></div>
         </form>
       </>:<div className={styles.emptyEditor}><span className={styles.emptyEditorIcon}>📝</span><span>Selecione uma nota ou crie uma nova para começar.</span></div>}
     </section>
   </div>
 </div></AppShell>}
