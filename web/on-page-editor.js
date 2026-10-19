// Edits are staged until Save, so Cancel never changes the saved annotation.
export function openOnPageEditor(note,anchor,{save,cancel}){
 document.querySelector('.on-page-editor')?.remove();
 const panel=document.createElement('section');panel.className='on-page-editor';panel.setAttribute('aria-label','Edit annotation on PDF');
 panel.innerHTML='<strong>Edit annotation</strong><textarea aria-label="Annotation text" maxlength="1200"></textarea><div class="on-page-options"><label>Style<select data-field="style"><option value="hand">My handwriting</option><option value="digital">Digital</option></select></label><label>Font<select data-field="fontFamily"><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label><label>Size<input data-field="size" type="number" min="8" max="36" step="0.5"></label><label>Color<input data-field="color" type="color"></label></div><p role="status"></p><div><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="save">Save changes</button></div>';
 const text=panel.querySelector('textarea');text.value=note.text;
 for(const key of ['style','fontFamily','size','color'])panel.querySelector(`[data-field="${key}"]`).value=note[key]??(key==='fontFamily'?'sans':'');
 const style=panel.querySelector('[data-field="style"]'),font=panel.querySelector('[data-field="fontFamily"]');style.onchange=()=>{font.disabled=style.value==='hand';};style.onchange();
 function close(){panel.remove();cancel();anchor?.focus();}
 panel.querySelector('[data-action="cancel"]').onclick=close;
 panel.querySelector('[data-action="save"]').onclick=async()=>{const changes={text:text.value.trim(),style:style.value,fontFamily:font.value,size:Number(panel.querySelector('[data-field="size"]').value),color:panel.querySelector('[data-field="color"]').value};const error=await save(changes);if(error)panel.querySelector('[role="status"]').textContent=error;else panel.remove();};
 panel.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();panel.querySelector('[data-action="save"]').click();}};
 document.body.append(panel);
 const rect=anchor?.getBoundingClientRect()||{left:20,bottom:80};panel.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-panel.offsetWidth-8))}px`;panel.style.top=`${Math.max(8,Math.min(rect.bottom+8,innerHeight-panel.offsetHeight-8))}px`;text.focus();
 return panel;
}
