(function () {
  const askModal = document.getElementById('askModal');
  const askQuestion = document.getElementById('askQuestion');
  const askError = document.getElementById('askError');
  const askAnswer = document.getElementById('askAnswer');
  const btnAsk = document.getElementById('btnAskAssistant');
  const btnAskCancel = document.getElementById('btnAskCancel');
  const btnAskSubmit = document.getElementById('btnAskSubmit');

  if (!askModal || !btnAsk) return;

  function setAskError(text) {
    if (!askError) return;
    askError.hidden = !text;
    askError.textContent = text || '';
  }

  function openAsk() {
    askModal.hidden = false;
    setAskError('');
    if (askQuestion) askQuestion.focus();
  }

  function closeAsk() {
    askModal.hidden = true;
  }

  async function submitAsk() {
    const question = (askQuestion && askQuestion.value ? askQuestion.value : '').trim();
    setAskError('');
    if (!question) {
      setAskError('请输入问题');
      return;
    }
    if (btnAskSubmit) btnAskSubmit.disabled = true;
    if (askAnswer) {
      askAnswer.hidden = false;
      askAnswer.textContent = '正在回答…';
    }
    try {
      const data = await askAssistant(question);
      if (askAnswer) {
        askAnswer.hidden = false;
        askAnswer.textContent = data.answer || '没有返回内容';
      }
    } catch (err) {
      if (askAnswer) askAnswer.hidden = true;
      setAskError(err.message || '提问失败');
    } finally {
      if (btnAskSubmit) btnAskSubmit.disabled = false;
    }
  }

  btnAsk.addEventListener('click', openAsk);
  if (btnAskCancel) btnAskCancel.addEventListener('click', closeAsk);
  if (btnAskSubmit) btnAskSubmit.addEventListener('click', submitAsk);
  askModal.addEventListener('click', (e) => {
    if (e.target === askModal) closeAsk();
  });
  if (askQuestion) {
    askQuestion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitAsk();
    });
  }
})();
