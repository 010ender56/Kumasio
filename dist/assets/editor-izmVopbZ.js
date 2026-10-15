import{a as e,c as t,i as n,n as r,o as i,r as a,u as o}from"./lib-BJAKVooH.js";document.addEventListener(`DOMContentLoaded`,async()=>{let s=e();document.body.prepend(s);let c=await i();async function l(){await o(c),D()}document.querySelector(`.sidebar`);let u=document.querySelector(`.question-list`),d=document.getElementById(`add-question-btn`),f=document.getElementById(`preview-set`),p=document.getElementById(`edit-set`),m=document.getElementById(`edit-set-dialog`),h=r(document.getElementById(`quiz-info-uploader`)),g=document.getElementById(`quiz-title`),_=document.getElementById(`quiz-desc`);document.getElementById(`char-count`);let v=document.getElementById(`quiz-type`),y=document.getElementById(`save-quiz-info`),b=document.getElementById(`delete-set`),x=document.getElementById(`quiz-only-options`),S=document.getElementById(`one-way-quiz`),C=document.getElementById(`builder-panel`),w={"multiple-choice":{needsOptions:!0,singleCorrect:!0,defaultOptions:()=>[{text:``,correct:!1},{text:``,correct:!1},{text:``,correct:!1},{text:``,correct:!1}]},"multiple-response":{needsOptions:!0,singleCorrect:!1,defaultOptions:()=>[{text:``,correct:!1},{text:``,correct:!1},{text:``,correct:!1},{text:``,correct:!1}]},"true-false":{needsOptions:!0,singleCorrect:!0,defaultOptions:()=>[{text:`True`,correct:!1},{text:`False`,correct:!1}]},"short-answer":{needsOptions:!1,singleCorrect:!1,defaultOptions:()=>[]},"long-answer":{needsOptions:!1,singleCorrect:!1,defaultOptions:()=>[]},flashcard:{needsOptions:!1,singleCorrect:!1,defaultOptions:()=>[]}};function T(e=`multiple-choice`){let t=w[e];return{id:crypto.randomUUID(),text:``,type:e,options:t.defaultOptions(),expectedAnswer:``,validationType:`text`,validationMode:`exact match`,feedback:`submitted`,required:!1,changeable:!0,image:null}}function E(){return c.sets[c.currentSet]?.questions||[]}function D(){let e=c.sets[c.currentSet];e&&(g.value=e.name||``,_.value=e.description||``,v.value=e.type||`quiz`,e.image?(h.previewBox.style.backgroundImage=`url('${e.image}')`,h.uploadText.style.display=`none`):(h.previewBox.style.backgroundImage=``,h.uploadText.style.display=`block`),h.input.value=``,h.resetCleared(),S.checked=!e.oneWay,x.style.display=e.type===`quiz`?`block`:`none`)}function O(){u.innerHTML=``;let e=E();if(e.length===0){let e=document.createElement(`small`);e.textContent=`No question yet.`,u.appendChild(e);return}e.forEach((t,n)=>{let r=document.createElement(`div`);r.className=`question-item`,r.textContent=`Item ${n+1}`,r.dataset.id=t.id;let i=document.createElement(`button`);i.textContent=`Remove`,i.classList.add(`btn`,`remove-question-button`),i.addEventListener(`click`,async n=>{n.stopPropagation();let r=e.findIndex(e=>e.id===t.id);r!==-1&&(e.splice(r,1),await l(),O(),j())}),r.append(i),c.currentIndex===n&&(r.style.backgroundColor=`var(--surface-lighter)`,r.style.borderColor=`var(--accent)`),u.appendChild(r)})}function k(e){let t=E();if(e<0||e>=t.length){C.innerHTML=`<h1>No selected question</h1><p>Select a question to edit</p>`;return}c.currentIndex=e;let i=t[e];C.innerHTML=`
        <div class="builder-section">
            <label for="questionText">Question Text</label>
            <div class="row" style="flex-direction: row; align-items: start;">
                <div class="uploader-container" id="question-uploader"></div>
                <textarea id="questionText" placeholder="Enter your question here..." style="flex: 1;">${i.text||``}</textarea>
            </div>
        </div>
        <div class="builder-section">
            <label for="type">Answer Type</label>
            <select id="type">
                <option value="multiple-choice" ${i.type===`multiple-choice`?`selected`:``}>Multiple Choice</option>
                <option value="multiple-response" ${i.type===`multiple-response`?`selected`:``}>Multiple Response</option>
                <option value="true-false" ${i.type===`true-false`?`selected`:``}>True or False</option>
                <option value="short-answer" ${i.type===`short-answer`?`selected`:``}>Short Answer</option>
                <option value="long-answer" ${i.type===`long-answer`?`selected`:``}>Long Answer</option>
            </select>
        </div>
        <div class="builder-section">
            <label for="feedback">Feedback Mode</label>
            <select id="feedback">
                <option value="show_correct" ${i.feedback===`show_correct`?`selected`:``}>Wrong/Right/Partially (Show Correct Answer)</option>
                <option value="hide_correct" ${i.feedback===`hide_correct`?`selected`:``}>Wrong/Right/Partially (Hide Correct Answer)</option>
                <option value="submitted" ${i.feedback===`submitted`?`selected`:``}>Submitted (No Feedback)</option>
            </select>
        </div>
        <div class="builder-section">
            <div class="row" style="flex-direction: row; gap: 20px;">
                <label><input type="checkbox" id="required" ${i.required?`checked`:``}> Required Question</label>
                <label><input type="checkbox" id="changeable" ${i.changeable===!1?``:`checked`}> Changeable after submission</label>
            </div>
        </div>
        <div class="builder-section">
            <label>Answer Options</label>
            <div class="answer-options"></div>
            <button class="btn" id="add-option-btn">+ Add Option</button>
        </div>
        <button class="cta" id="save-question-btn">Save Question</button>
    `;let a=r(document.getElementById(`question-uploader`),async e=>{i.image=await n(e)});i.image&&(a.previewBox.style.backgroundImage=`url('${i.image}')`,a.uploadText.style.display=`none`);let o=document.getElementById(`questionText`),s=document.getElementById(`type`),u=document.getElementById(`feedback`),d=document.getElementById(`required`),f=document.getElementById(`changeable`),p=document.querySelector(`.answer-options`),m=document.getElementById(`add-option-btn`),h=document.getElementById(`save-question-btn`);o.addEventListener(`input`,()=>{i.text=o.value.trim()}),s.addEventListener(`change`,()=>{i.type=s.value,i.options=w[i.type].defaultOptions(),g(i)}),u.addEventListener(`change`,()=>{i.feedback=u.value}),d.addEventListener(`change`,()=>{i.required=d.checked}),f.addEventListener(`change`,()=>{i.changeable=f.checked});function g(e){if(p.innerHTML=``,w[e.type].needsOptions)e.options.forEach((t,n)=>{let r=document.createElement(`div`);r.className=`answer-row`;let i=document.createElement(`input`);i.type=`checkbox`,i.checked=!!t.correct,i.addEventListener(`change`,()=>{t.correct=i.checked});let a=document.createElement(`input`);a.type=`text`,a.value=t.text||``,a.addEventListener(`input`,()=>{t.text=a.value});let o=document.createElement(`button`);o.textContent=`×`,o.classList.add(`btn`),o.addEventListener(`click`,()=>{e.options.splice(n,1),g(e)}),r.append(i,a,o),p.appendChild(r)});else{let t=document.createElement(`input`);t.type=`text`,t.value=e.expectedAnswer||``,t.addEventListener(`input`,()=>{e.expectedAnswer=t.value}),p.appendChild(t)}}g(i),m.addEventListener(`click`,()=>{w[i.type].needsOptions&&(i.options.push({text:``,correct:!1}),g(i))}),h.addEventListener(`click`,async()=>{await l(),alert(`Saved!`)})}function A(){let e=E();C.innerHTML=`
        <div class="flashcard-builder-list">
            ${e.map((e,t)=>`
                <div class="flashcard-edit-row" data-id="${e.id}" data-index="${t}">
                    <div class="fc-field">
                        <label>Front</label>
                        <textarea class="fc-front" placeholder="Enter term...">${e.text||``}</textarea>
                    </div>
                    <div class="fc-field">
                        <label>Back</label>
                        <textarea class="fc-back" placeholder="Enter definition...">${e.expectedAnswer||``}</textarea>
                    </div>
                    <div class="fc-field fc-image-field">
                        <label>Image</label>
                        <div class="uploader-container fc-uploader"></div>
                    </div>
                    <button class="btn danger remove-card">×</button>
                </div>
            `).join(``)}
        </div>
    `,e.forEach((t,i)=>{let a=C.querySelector(`.flashcard-edit-row[data-index="${i}"]`);if(!a)return;let o=a.querySelector(`.fc-front`),s=a.querySelector(`.fc-back`),c=a.querySelector(`.fc-uploader`);o.addEventListener(`input`,async()=>{t.text=o.value.trim(),await l()}),s.addEventListener(`input`,async()=>{t.expectedAnswer=s.value.trim(),await l()});let u=r(c,async e=>{t.image=await n(e),await l()});t.image&&(u.previewBox.style.backgroundImage=`url('${t.image}')`,u.uploadText.style.display=`none`),a.querySelector(`.remove-card`).addEventListener(`click`,async()=>{e.splice(i,1),await l(),A(),O()})})}function j(){c.sets[c.currentSet]?.type===`flashcards`?(u.style.display=`none`,C.style.width=`100%`,A()):(u.style.display=`flex`,C.style.width=`80vw`,E().length===0?C.innerHTML=`<h1>No questions yet</h1><p>Click "Add Question" to create your first question.</p>`:c.currentIndex===void 0||c.currentIndex<0?C.innerHTML=`<h1>No selected question</h1><p>Please select a question to edit</p>`:k(c.currentIndex))}p.addEventListener(`click`,()=>{D(),m.showModal()}),d.addEventListener(`click`,async()=>{let e=T(c.sets[c.currentSet]?.type===`flashcards`?`flashcard`:`multiple-choice`);E().push(e),await l(),O(),j()}),u.addEventListener(`click`,e=>{let t=e.target.closest(`.question-item`);if(!t||c.sets[c.currentSet]?.type===`flashcards`)return;let n=t.dataset.id,r=E().findIndex(e=>e.id===n);r!==-1&&(c.currentIndex=r,O(),j())}),y.addEventListener(`click`,async()=>{let e=c.sets[c.currentSet];e.name=g.value.trim(),e.description=_.value.trim();let t=h.getFile();t?e.image=await n(t):h.getIsCleared()&&(e.image=null),h.resetCleared(),e.oneWay=!S.checked,await l(),m.close(),j()}),b.addEventListener(`click`,async()=>{if(confirm(`Are you sure you want to delete this quiz set?`)){delete c.sets[c.currentSet];let e=Object.keys(c.sets);if(e.length===0){let e=`i${Date.now()}`;c.sets[e]=a(`quiz`),c.currentSet=e}else c.currentSet=e[0];await l(),window.location.href=`./index.html`}}),v.addEventListener(`change`,async()=>{confirm(`Changing type will reset questions. Continue?`)?(c.sets[c.currentSet].type=v.value,await l(),j()):v.value=c.sets[c.currentSet].type}),f.addEventListener(`click`,()=>{c.sets[c.currentSet].type===`flashcards`?window.location.href=`./flashcards.html?set=${c.currentSet}&mode=review`:window.location.href=`./quiz.html?set=${c.currentSet}&preview`});async function M(){t(c.userPrefs.theme);let e=new URLSearchParams(window.location.search).get(`set`);if(e)c.currentSet=e;else{let e=new URLSearchParams(window.location.search).get(`type`)||`quiz`,t=`i${Date.now()}`;c.currentSet=t,c.sets[t]=a(e),await l()}c.sets[c.currentSet]||(c.sets[c.currentSet]=a(`quiz`),await l()),c.sets[c.currentSet].questions?.length||(c.sets[c.currentSet].questions=[T(c.sets[c.currentSet].type===`flashcards`?`flashcard`:`multiple-choice`)],await l()),D(),O(),j()}await M()});