/**
 * 批量新增子任务（电脑端 Excel 式表格）
 * 列：任务内容 / 成员(通常1人，可搜索) / 计划开始 / 计划完成 / 备注
 * 负责人固定为项目负责人；列表展示仍走现有 subtasks.js。
 */
(function () {
  const META_TIMEOUT_MS = 12000;
  const DEFAULT_ROWS = 8;
  const MAX_ROWS = 50;

  const btnBatch = document.getElementById('btnBatchAddSubtask');
  const modal = document.getElementById('subtaskBatchModal');
  const bodyEl = document.getElementById('subtaskBatchBody');
  const ownerHint = document.getElementById('subtaskBatchOwnerHint');
  const errorEl = document.getElementById('subtaskBatchError');
  const btnAddRow = document.getElementById('btnBatchAddRow');
  const btnCancel = document.getElementById('btnBatchCancel');
  const btnSave = document.getElementById('btnBatchSave');
  const projectId = queryParam('project_id');

  if (!modal || !bodyEl || !projectId) return;

  let allUsers = [];
  let currentProject = null;
  let loadingMeta = false;
  let saving = false;
  let rowSeq = 0;
  /** @type {Array<{id:number, memberUserid:string, memberName:string}>} */
  let rows = [];

  function canEdit() {
    if (window.Auth && window.Auth.canEditProjects()) return true;
    try {
      const key = (window.AUTH_KEYS && window.AUTH_KEYS.user) || 'projectshow_auth_user';
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const user = JSON.parse(raw);
      return !!(user && user.can_edit_projects);
    } catch (e) {
      return false;
    }
  }

  function ensureCanEdit() {
    if (canEdit()) return true;
    const goLogin = confirm('批量新增需要先登录且具备编辑权限。是否前往登录？');
    if (goLogin) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `index.html?view=projects&login=1&return=${returnTo}`;
    }
    return false;
  }

  function formatOwnerLabel(project) {
    if (!project) return '（项目未设置负责人）';
    const mgrId = (project.manager_userid || '').trim();
    const mgrName = (project.manager_name || '').trim();
    if (!mgrId && !mgrName) return '（项目未设置负责人）';
    if (!mgrName) return mgrId;
    if (!mgrId) return mgrName;
    return `${mgrName}（${mgrId}）`;
  }

  function userLabel(user) {
    const userid = (user.userid || '').trim();
    const name = (user.name || '').trim();
    if (name && userid && name !== userid) return `${name} (${userid})`;
    return name || userid || '—';
  }

  function showError(msg) {
    errorEl.textContent = msg || '操作失败';
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label}超时（${Math.round(ms / 1000)}s）`));
      }, ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }

  async function loadMeta() {
    const [projData, userData] = await Promise.all([
      withTimeout(fetchProject(projectId), META_TIMEOUT_MS, '项目信息'),
      withTimeout(fetchWecomUsers(), META_TIMEOUT_MS, '成员列表'),
    ]);
    currentProject = projData.project || null;
    allUsers = userData.users || [];
  }

  function filterUsers(keyword) {
    const q = String(keyword || '')
      .trim()
      .toLowerCase();
    if (!q) return allUsers.slice(0, 40);
    return allUsers
      .filter((u) => {
        const hay = `${u.name || ''} ${u.userid || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }

  function closeMemberMenus(except) {
    bodyEl.querySelectorAll('.batch-member-menu').forEach((menu) => {
      if (menu !== except) menu.hidden = true;
    });
  }

  function renderMemberMenu(rowId, menu, keyword) {
    const list = filterUsers(keyword);
    if (!list.length) {
      menu.innerHTML = '<div class="batch-member-empty">无匹配成员</div>';
      menu.hidden = false;
      return;
    }
    menu.innerHTML = list
      .map((u) => {
        const userid = escapeHtml((u.userid || '').trim());
        const name = escapeHtml((u.name || '').trim());
        const label = escapeHtml(userLabel(u));
        return `<button type="button" class="batch-member-option" data-userid="${userid}" data-name="${name}">${label}</button>`;
      })
      .join('');
    menu.hidden = false;
    menu.querySelectorAll('.batch-member-option').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const row = rows.find((r) => r.id === rowId);
        if (!row) return;
        row.memberUserid = btn.getAttribute('data-userid') || '';
        row.memberName = btn.getAttribute('data-name') || '';
        const input = bodyEl.querySelector(`tr[data-row-id="${rowId}"] .batch-member-input`);
        if (input) input.value = row.memberName || row.memberUserid;
        menu.hidden = true;
      });
    });
  }

  function renumberRows() {
    bodyEl.querySelectorAll('tr[data-row-id]').forEach((tr, idx) => {
      const cell = tr.querySelector('.col-idx');
      if (cell) cell.textContent = String(idx + 1);
    });
  }

  function removeRow(rowId) {
    if (rows.length <= 1) {
      // 至少保留一行，清空即可
      const row = rows[0];
      row.memberUserid = '';
      row.memberName = '';
      const tr = bodyEl.querySelector(`tr[data-row-id="${row.id}"]`);
      if (tr) {
        tr.querySelector('.batch-content').value = '';
        tr.querySelector('.batch-planned-start').value = '';
        tr.querySelector('.batch-planned-end').value = '';
        tr.querySelector('.batch-actual-start').value = '';
        tr.querySelector('.batch-actual-end').value = '';
        tr.querySelector('.batch-remark').value = '';
        tr.querySelector('.batch-member-input').value = '';
      }
      return;
    }
    rows = rows.filter((r) => r.id !== rowId);
    const tr = bodyEl.querySelector(`tr[data-row-id="${rowId}"]`);
    if (tr) tr.remove();
    renumberRows();
  }

  function addRow(prefill) {
    if (rows.length >= MAX_ROWS) {
      showError(`单次最多 ${MAX_ROWS} 行`);
      return null;
    }
    const id = ++rowSeq;
    const row = {
      id,
      memberUserid: (prefill && prefill.memberUserid) || '',
      memberName: (prefill && prefill.memberName) || '',
    };
    rows.push(row);

    const tr = document.createElement('tr');
    tr.setAttribute('data-row-id', String(id));
    tr.innerHTML = `
      <td class="col-idx">${rows.length}</td>
      <td class="col-content"><input type="text" class="batch-content" autocomplete="off" placeholder="任务内容" /></td>
      <td class="col-member">
        <div class="batch-member-wrap">
          <input type="text" class="batch-member-input" autocomplete="off" placeholder="搜索姓名/UserID" />
          <div class="batch-member-menu" hidden></div>
        </div>
      </td>
      <td class="col-date"><input type="date" class="batch-planned-start" /></td>
      <td class="col-date"><input type="date" class="batch-planned-end" /></td>
      <td class="col-date"><input type="date" class="batch-actual-start" /></td>
      <td class="col-date"><input type="date" class="batch-actual-end" /></td>
      <td class="col-remark"><input type="text" class="batch-remark" autocomplete="off" placeholder="可选" /></td>
      <td class="col-act"><button type="button" class="btn btn-sm batch-remove-row" title="删除本行">×</button></td>
    `;
    bodyEl.appendChild(tr);

    const contentInput = tr.querySelector('.batch-content');
    const memberInput = tr.querySelector('.batch-member-input');
    const menu = tr.querySelector('.batch-member-menu');
    const removeBtn = tr.querySelector('.batch-remove-row');

    if (prefill) {
      if (prefill.content) contentInput.value = prefill.content;
      if (prefill.plannedStart) tr.querySelector('.batch-planned-start').value = prefill.plannedStart;
      if (prefill.plannedEnd) tr.querySelector('.batch-planned-end').value = prefill.plannedEnd;
      if (prefill.actualStart) tr.querySelector('.batch-actual-start').value = prefill.actualStart;
      if (prefill.actualEnd) tr.querySelector('.batch-actual-end').value = prefill.actualEnd;
      if (prefill.remark) tr.querySelector('.batch-remark').value = prefill.remark;
      if (row.memberUserid || row.memberName) {
        memberInput.value = row.memberName || row.memberUserid;
      }
    }

    memberInput.addEventListener('focus', () => {
      closeMemberMenus(menu);
      renderMemberMenu(id, menu, memberInput.value);
    });
    memberInput.addEventListener('input', () => {
      // 手动改字后视为未选中，直到从菜单点选
      row.memberUserid = '';
      row.memberName = '';
      closeMemberMenus(menu);
      renderMemberMenu(id, menu, memberInput.value);
    });
    memberInput.addEventListener('blur', () => {
      setTimeout(() => {
        menu.hidden = true;
        // 若未从菜单点选，尝试按当前文本精确匹配一人
        if (!row.memberUserid) {
          const q = memberInput.value.trim().toLowerCase();
          if (!q) return;
          const hit = allUsers.find((u) => {
            const name = (u.name || '').trim().toLowerCase();
            const userid = (u.userid || '').trim().toLowerCase();
            return name === q || userid === q || `${name} (${userid})` === q;
          });
          if (hit) {
            row.memberUserid = (hit.userid || '').trim();
            row.memberName = (hit.name || '').trim();
            memberInput.value = row.memberName || row.memberUserid;
          }
        }
      }, 150);
    });

    // 从 Excel 粘贴多行到「任务内容」：自动拆到后续行
    contentInput.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text || text.indexOf('\n') < 0) return;
      e.preventDefault();
      const lines = text
        .split(/\r?\n/)
        .map((s) => s.replace(/\t.*$/, '').trim())
        .filter((s) => s !== '');
      if (!lines.length) return;
      contentInput.value = lines[0];
      const startIdx = rows.findIndex((r) => r.id === id);
      for (let i = 1; i < lines.length; i++) {
        const targetIdx = startIdx + i;
        if (targetIdx < rows.length) {
          const targetId = rows[targetIdx].id;
          const targetTr = bodyEl.querySelector(`tr[data-row-id="${targetId}"]`);
          if (targetTr) targetTr.querySelector('.batch-content').value = lines[i];
        } else if (rows.length < MAX_ROWS) {
          addRow({ content: lines[i] });
        }
      }
    });

    removeBtn.addEventListener('click', () => removeRow(id));
    return row;
  }

  function resetRows() {
    rows = [];
    rowSeq = 0;
    bodyEl.innerHTML = '';
    for (let i = 0; i < DEFAULT_ROWS; i++) addRow();
  }

  function collectPayload() {
    const project = currentProject || {};
    const subtasks = [];
    const trs = [...bodyEl.querySelectorAll('tr[data-row-id]')];
    for (let i = 0; i < trs.length; i++) {
      const tr = trs[i];
      const rowId = Number(tr.getAttribute('data-row-id'));
      const row = rows.find((r) => r.id === rowId) || { memberUserid: '', memberName: '' };
      const content = (tr.querySelector('.batch-content').value || '').trim();
      const plannedStart = (tr.querySelector('.batch-planned-start').value || '').trim();
      const plannedEnd = (tr.querySelector('.batch-planned-end').value || '').trim();
      const actualStart = (tr.querySelector('.batch-actual-start').value || '').trim();
      const actualEnd = (tr.querySelector('.batch-actual-end').value || '').trim();
      const remark = (tr.querySelector('.batch-remark').value || '').trim();
      const memberInputVal = (tr.querySelector('.batch-member-input').value || '').trim();
      let memberUserid = row.memberUserid;
      let memberName = row.memberName;
      if (!memberUserid && memberInputVal) {
        // blur 可能还没跑完，这里再匹配一次
        const q = memberInputVal.toLowerCase();
        const hit = allUsers.find((u) => {
          const name = (u.name || '').trim().toLowerCase();
          const userid = (u.userid || '').trim().toLowerCase();
          return name === q || userid === q;
        });
        if (hit) {
          memberUserid = (hit.userid || '').trim();
          memberName = (hit.name || '').trim();
        } else {
          throw new Error(`第 ${i + 1} 行：成员「${memberInputVal}」无法匹配，请从下拉中选择`);
        }
      }
      if (
        !content &&
        !plannedStart &&
        !plannedEnd &&
        !actualStart &&
        !actualEnd &&
        !remark &&
        !memberUserid
      ) {
        continue;
      }
      if (!content) {
        throw new Error(`第 ${i + 1} 行：任务内容不能为空`);
      }
      const members = memberUserid
        ? [{ userid: memberUserid, name: memberName || '' }]
        : [];
      subtasks.push({
        project_id: Number(projectId),
        content,
        owner_userid: (project.manager_userid || '').trim(),
        owner_name: (project.manager_name || '').trim(),
        status: '待启动',
        planned_start_date: plannedStart,
        planned_end_date: plannedEnd,
        actual_start_date: actualStart,
        actual_end_date: actualEnd,
        remark,
        members,
      });
    }
    return {
      project_id: Number(projectId),
      subtasks,
    };
  }

  function closeModal() {
    modal.hidden = true;
    closeMemberMenus();
  }

  async function openModal() {
    if (!ensureCanEdit()) return;
    if (loadingMeta) return;
    loadingMeta = true;
    if (btnBatch) btnBatch.disabled = true;
    clearError();
    resetRows();
    ownerHint.textContent = '负责人固定为项目负责人（加载中…）';
    modal.hidden = false;

    try {
      await loadMeta();
      ownerHint.textContent = `负责人固定为项目负责人：${formatOwnerLabel(currentProject)}`;
      clearError();
      const first = bodyEl.querySelector('.batch-content');
      if (first) {
        setTimeout(() => {
          try {
            first.focus();
          } catch (e) {
            /* ignore */
          }
        }, 40);
      }
    } catch (err) {
      allUsers = [];
      currentProject = null;
      ownerHint.textContent = '负责人固定为项目负责人';
      showError((err && err.message) || '加载项目/成员失败，仍可填写内容；选人需成员接口可用');
    } finally {
      loadingMeta = false;
      if (btnBatch) btnBatch.disabled = false;
    }
  }

  async function saveBatch() {
    if (saving) return;
    clearError();
    let payload;
    try {
      payload = collectPayload();
    } catch (err) {
      showError(err.message || '校验失败');
      return;
    }
    if (!payload.subtasks.length) {
      showError('请至少填写一行任务内容');
      return;
    }

    saving = true;
    btnSave.disabled = true;
    try {
      const data = await createSubtasksBatch(payload);
      closeModal();
      alert(data.msg || `已批量创建 ${data.count || payload.subtasks.length} 条子任务`);
      if (window.SubtasksApp && typeof window.SubtasksApp.reload === 'function') {
        await window.SubtasksApp.reload();
      } else {
        window.location.reload();
      }
    } catch (err) {
      showError(err.message || '批量创建失败');
    } finally {
      saving = false;
      btnSave.disabled = false;
    }
  }

  if (btnBatch) btnBatch.addEventListener('click', openModal);
  if (btnAddRow) btnAddRow.addEventListener('click', () => addRow());
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (btnSave) btnSave.addEventListener('click', saveBatch);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.batch-member-wrap')) closeMemberMenus();
  });

  window.SubtaskBatchApp = {
    open: openModal,
    refreshButton() {
      if (!btnBatch) return;
      // 宽屏才显示；窄屏仍可用单条新增
      const wide = window.matchMedia('(min-width: 960px)').matches;
      btnBatch.hidden = !(canEdit() && wide);
    },
  };

  window.SubtaskBatchApp.refreshButton();
  window.addEventListener('resize', () => {
    if (window.SubtaskBatchApp) window.SubtaskBatchApp.refreshButton();
  });
  document.addEventListener('authchange', () => {
    if (window.SubtaskBatchApp) window.SubtaskBatchApp.refreshButton();
  });
})();
