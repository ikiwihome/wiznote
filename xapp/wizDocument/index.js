function initWizDocument() {
  // const [, , kbGuid, ,] = window.location.pathname.split('/');

  const NoteType = {
    Markdown: 'markdown',
    MathJax: 'mathjax',
    Outline: 'outline',
    Common: 'common',
  };

  let saveHtmlId = 0;
  // eslint-disable-next-line compat/compat
  const urlParams = new URLSearchParams(window.location.search);
  const frameKey = urlParams.get('frameKey') || '';
  let isReadOnly = null;
  const isPersonalKb = !!urlParams.get('isPersonalKb');
  const isFromWizClipper = !!urlParams.get('isFromWizClipper');
  const noFrame = !!urlParams.get('xssNoFrame');
  const userGuid = urlParams.get('userGuid') || '';
  const alias = urlParams.get('alias') || '';
  let pSpacing = urlParams.get('pSpacing') || 8;
  const darkBgColor = urlParams.get('darkBgColor') || '';
  const darkTextColor = urlParams.get('darkTextColor') || '';
  const resourcesPath = urlParams.get('resourcesPath') ?? '';
  let userAvatar = '';

  const dependencyUrl = `${resourcesPath}/wizDocument/dependency`;
  const wizDocumentUrl = `${resourcesPath}/wizDocument/WizDocument.js`;
  const lang = urlParams.get('lang') || 'en';
  const readerType = urlParams.get('readerType') || NoteType.Common;
  const canEdit = !!urlParams.get('canEdit');
  let themeMode = urlParams.get('themeMode') || 'auto';
  // 切换 阅读、编辑模式时，保存滚动条位置
  let lastScrollbarTop = 0;
  const iframe = window.parent.document.querySelector(`#${frameKey}`);
  const iframeContainer = iframe.parentElement;
  const noteContainer = iframeContainer.closest('.normal-note-container');
  const scrollLayerMain = noteContainer.closest('.react-custom-scrollbars-layer');
  const noteTitle = scrollLayerMain.querySelector('.normal-note-title');
  const scrollLayer = scrollLayerMain.parentElement;

  const pureReadMode = {
    enable: false,
    needContentExtraction: false,
    borderColor: '',
    htmlBgColor: '',
    bodyBgColor: '',
  };
  const nightMode = {
    enable: false,
    color: darkTextColor,
    bgColor: darkBgColor,
    hotkey: '#969696',
    brightness: '',
    outline: {
      dot: '#969696',
      nodeSelected: '##F0F0F0',
      nodeShowMenu: '#555555',
      completed: '#969696',
      dotIconHover: '#F0F0F0',
    },
    floatLayer: {
      bgColor: '#555555',
      bgColorHover: 'rgba(150, 150, 150, 0.2)',
    },
  };

  let tocTimer = null;
  let titleMap = {};

  // console.log(wizDocumentUrl, dependencyUrl);
  let wizDocument = null;

  const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
  function handleMediaQueryListChange() {
    if (wizDocument && themeMode === 'auto') {
      if (mediaQueryList.matches) {
        wizDocument.nightMode.on();
      } else {
        wizDocument.nightMode.off();
      }
    }
  }
  mediaQueryList.addEventListener('change', handleMediaQueryListChange);

  function sendMessage(message) {
    window.parent.postMessage(message, window.location.origin);
  }

  function handleHotkeys(event, handler) {
    if (!isReadOnly && (handler.key === 'left' || handler.key === 'up')) {
      if (wizDocument.editor.range.isAtDocStart()) {
        sendMessage({
          type: 'setTitleFocus',
          frameKey,
          data: {
            pos: -1,
          },
        });
      }
    }
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    let closeWindow = false;
    if (isMac) {
      if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        if (event.key === 'w') {
          closeWindow = true;
        } else if (event.key === 'a') {
          wizDocument.editor.execCommand('SelectAll');
        }
      }
    } else if (!event.metaKey && !event.shiftKey && event.ctrlKey && !event.altKey) {
      if (event.key === 'w') {
        closeWindow = true;
      } else if (event.key === 'a') {
        wizDocument.editor.execCommand('SelectAll');
      }
    }
    //
    if (closeWindow) {
      event.preventDefault();
    }

    const { altKey, bubbles, code, composed, ctrlKey, defaultPrevented, key, keyCode, metaKey, returnValue, shiftKey, type, which } = event;
    const e = { altKey, bubbles, code, composed, ctrlKey, defaultPrevented, key, keyCode, metaKey, returnValue, shiftKey, type, which };

    sendMessage({
      type: 'Hotkeys',
      frameKey,
      data: {
        key: handler.key,
        event: e,
      },
    });
  }

  function setHotkeys(hotkeysData) {
    if (hotkeysData.indexOf('left') < 0) {
      hotkeysData.push('left');
    }
    if (hotkeysData.indexOf('up') < 0) {
      hotkeysData.push('up');
    }
    const keysCommand = hotkeysData.join(',');
    window.hotkeys.unbind(keysCommand, handleHotkeys);
    // window.hotkeys.deleteScope('all');
    window.hotkeys.filter = (event) => {
      return true;
    };
    // 设置 element 避免 编辑、阅读切换时 重置 html，不重新绑定事件
    window.hotkeys(keysCommand, { element: document.body }, handleHotkeys);
  }

  function setReadOnly(readonly) {
    isReadOnly = readonly;
    lastScrollbarTop = scrollLayerMain.scrollTop;
    if (readonly) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      wizDocument.reader.on({}, handleWizDocumentCallback);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      wizDocument.editor.on({}, handleWizDocumentCallback);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      wizDocument.editor.addListener(wizDocument.editor.ListenerType.SelectionChange, handleSelectionChanged);
    }
  }

  function setParagraphSpacing(spacing) {
    pSpacing = spacing;
    const style = document.querySelector('#note_setting_p_spacing');
    if (style) {
      style.textContent = `
body.wiz-editor-body div, body.wiz-editor-body p,
body.wiz-editor-body ul, body.wiz-editor-body ol,
body.wiz-editor-body dl {margin: ${pSpacing}px 0 ${pSpacing / 2}px;}
body.wiz-editor-body li {margin: ${pSpacing / 4}px 0 0;}
body.wiz-editor-body h1 {margin: ${pSpacing * 1.5}px 0 ${pSpacing / 2}px;}
body.wiz-editor-body h2 {margin: ${pSpacing * 1.5}px 0 ${pSpacing / 2}px;}
body.wiz-editor-body h3 {margin: ${pSpacing * 1.25}px 0 ${pSpacing / 2}px;}
body.wiz-editor-body h4 {margin: ${pSpacing * 1.25}px 0 ${pSpacing / 2}px;}
body.wiz-editor-body h5 {margin: ${pSpacing * 1}px 0 ${pSpacing / 2}px;}
body.wiz-editor-body h6 {margin: ${pSpacing * 1}px 0 ${pSpacing / 2}px;}`;
    }
  }

  function getHtml() {
    return wizDocument.editor.getContentHtml();
  }

  function getText() {
    // 避免 wiz_tmp_tag 导致得到多余的 text
    const styleId = 'desktop-get-content-text';
    const isTemp = true;
    const style = 'body.wiz-editor-body wiz_tmp_tag {display: none !important;}';
    wizDocument.insertCustomStyle(styleId, style, isTemp);
    let text = '';
    if (readerType === NoteType.Markdown) {
      text = window.removeMarkdown(wizDocument.editor.getMarkdownSrc());
    } else {
      text = wizDocument.editor.getBodyText();
    }
    wizDocument.removeStyleById(styleId);
    return text;
  }

  function handleExecuteStyleCommand(command, params) {
    switch (command) {
      case 'clearFormat':
        {
          wizDocument.editor.execCommand('formatBlock', 'false', 'div');
          const removeAll = false;
          const isRemoveColor = true;
          const isRemoveAllStyles = true;
          wizDocument.editor.removeFormat(removeAll, isRemoveColor, isRemoveAllStyles);
        }
        break;
      case 'bold':
        wizDocument.editor.execCommand('bold', false, '');
        // wizDocument.editor.focus();
        break;
      case 'italic':
        wizDocument.editor.execCommand('Italic', false, '');
        // wizDocument.editor.focus();
        break;
      case 'underline':
        wizDocument.editor.execCommand('UnderLine', false, '');
        // wizDocument.editor.focus();
        break;
      case 'unorderedList':
        wizDocument.editor.execCommand('InsertUnOrderedList', false, '');
        // wizDocument.editor.focus();
        break;
      case 'orderedList':
        wizDocument.editor.execCommand('InsertOrderedList', false, '');
        // wizDocument.editor.focus();
        break;
      case 'heading1':
        wizDocument.editor.execCommand('formatBlock', 'false', 'h1');
        // wizDocument.editor.focus();
        break;
      case 'heading2':
        wizDocument.editor.execCommand('formatBlock', 'false', 'h2');
        // wizDocument.editor.focus();
        break;
      case 'heading3':
        wizDocument.editor.execCommand('formatBlock', 'false', 'h3');
        // wizDocument.editor.focus();
        break;
      case 'heading4':
        wizDocument.editor.execCommand('formatBlock', 'false', 'h4');
        // wizDocument.editor.focus();
        break;
      case 'heading5':
        wizDocument.editor.execCommand('formatBlock', 'false', 'h5');
        // wizDocument.editor.focus();
        break;
      case 'alignLeft':
        wizDocument.editor.execCommand('justifyleft', false, '');
        // wizDocument.editor.focus();
        break;
      case 'alignCenter':
        wizDocument.editor.execCommand('justifycenter', false, '');
        // wizDocument.editor.focus();
        break;
      case 'alignRight':
        wizDocument.editor.execCommand('justifyright', false, '');
        // wizDocument.editor.focus();
        break;
      case 'indent':
        if (readerType === NoteType.Outline) {
          wizDocument.outline.indent();
        } else {
          wizDocument.editor.execCommand('indent', false, '');
          // wizDocument.editor.focus();
        }
        break;
      case 'outdent':
        if (readerType === NoteType.Outline) {
          wizDocument.outline.outdent();
        } else {
          wizDocument.editor.execCommand('outdent', false, '');
          // wizDocument.editor.focus();
        }
        break;
      case 'checkedBox':
        wizDocument.editor.todo.setTodo();
        // wizDocument.editor.focus();
        break;
      case 'link':
        // editor.executeTextCommand('link', params);
        break;
      case 'unlink':
        // editor.executeTextCommand('unlink', params);
        break;
      case 'table':
        {
          const col = (params && params.col) || 5;
          const row = (params && params.row) || 4;
          wizDocument.editor.table.insertTable(col, row);
          // wizDocument.editor.focus();
        }
        break;
      case 'code':
        wizDocument.editor.code.insertCode();
        // wizDocument.editor.focus();
        break;
      case 'quote':
        break;
      case 'backgroundColor':
        {
          let color = params.color;
          if (color === 'transparent') {
            color = null;
          }
          wizDocument.editor.modifySelectionDom({ 'background-color': color });
          // wizDocument.editor.focus();
        }
        break;
      case 'textColor':
        wizDocument.editor.modifySelectionDom({ color: params.color });
        // wizDocument.editor.focus();
        break;
      case 'insertImage':
        wizDocument.editor.img.insertByPath(params.images.join('*'));
        break;
      case 'uploadImagesBySrcFinished':
        params.images.forEach((image) => {
          if (image.src) {
            wizDocument.editor.img.onImgUploadComplete(image.key, image.src);
          } else {
            wizDocument.editor.img.onImgUploadError(image.key);
          }
        });
        break;
      default:
        break;
    }
  }

  function handleMessage(event) {
    if (!wizDocument) {
      return;
    }

    const data = event.data;
    let html = '';
    let text = '';
    switch (data.type) {
      case 'getContentHtml':
        if (wizDocument.editor.isModified()) {
          html = getHtml();
          text = getText();
        }
        sendMessage({
          type: 'MESSAGE_RESULT',
          callbackId: data.callbackId,
          frameKey: data.frameKey,
          result: { html, text },
        });
        break;
      case 'getContentText':
        sendMessage({
          type: 'MESSAGE_RESULT',
          callbackId: data.callbackId,
          frameKey: data.frameKey,
          result: { text: getText() },
        });
        break;
      case 'getMarkdownSrc':
        {
          const src = wizDocument.editor.getMarkdownSrc();
          sendMessage({
            type: 'MESSAGE_RESULT',
            callbackId: data.callbackId,
            frameKey: data.frameKey,
            result: src,
          });
        }
        break;
      case 'getSaveHtmlId':
        sendMessage({
          type: 'MESSAGE_RESULT',
          callbackId: data.callbackId,
          frameKey: data.frameKey,
          result: saveHtmlId,
        });
        break;
      case 'executeCommand':
        handleExecuteStyleCommand(data.data.command, data.data.params);
        break;
      case 'focus':
        if (data.data.isSelectStart) {
          const sel = document.getSelection();
          sel.removeAllRanges();
          const range = document.createRange();
          range.setStart(document.body, 0);
          sel.addRange(range);
        }
        if (data.data.restoreScrollbar) {
          wizDocument.editor.range.moveToPoint(10, lastScrollbarTop);
          scrollLayerMain.scrollTop = lastScrollbarTop;
        }
        if (!isReadOnly) {
          wizDocument.editor.focus();
        }
        break;
      case 'setHotkeys':
        setHotkeys(data.data.hotkeys);
        break;
      case 'setUserAvatar':
        userAvatar = data.data;
        break;
      case 'setReadOnly':
        if (data.data.readOnly !== isReadOnly) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          unbind();
          setReadOnly(data.data.readOnly);
        }
        break;
      case 'setUnModified':
        if (data.data.saveHtmlId !== saveHtmlId) {
          return;
        }
        wizDocument.editor.setUnModified();
        break;
      case 'setDarkMode':
        wizDocument.nightMode.on();
        break;
      case 'setParagraphSpacing':
        setParagraphSpacing(data.data);
        break;
      case 'closeDarkMode':
        wizDocument.nightMode.off();
        break;
      case 'scrollToTitle':
        {
          const title = titleMap[data.data];
          let top = -1;
          if (title) {
            top = title.dom.getBoundingClientRect().top;
          }
          sendMessage({
            type: 'MESSAGE_RESULT',
            callbackId: data.callbackId,
            frameKey: data.frameKey,
            result: top,
          });
        }
        break;
      case 'showMindMap':
        {
          const isOutline = wizDocument.getDocumentType() === 'outline';
          if (!isOutline) {
            return;
          }
          if (data.data.isShowMindMap) {
            wizDocument.outline.showMinder(data.data.title);
          } else {
            wizDocument.outline.hideMinder();
          }
        }
        break;

      case 'setThemeMode':
        themeMode = data.data;
        if (data.data === 'dark') {
          wizDocument.nightMode.on();
        } else if (data.data === 'light') {
          wizDocument.nightMode.off();
        }
        break;
      case 'find':
        if (data.data.keyword) {
          wizDocument.reader.highlight.on(data.data.keyword, data.data.focusFirst);
        } else {
          wizDocument.reader.highlight.off();
        }
        break;
      case 'findNext':
        wizDocument.editor.find(data.data.keyword);
        // wizDocument.reader.highlight.next();
        break;
      case 'replace':
        // console.log('replace', data.data.keyword, data.data.replaceContent);
        wizDocument.editor.replace(data.data.keyword, data.data.replaceContent);
        break;
      case 'replaceAll':
        wizDocument.editor.replaceAll(data.data.keyword, data.data.replaceContent);
        break;
      case 'closeFind':
        wizDocument.reader.highlight.off();
        break;
      case 'selectAll':
        wizDocument.editor.execCommand('SelectAll');
        break;
      case 'changeAutoEditByDblclick':
        wizDocument.setOptions({
          reader: {
            autoEditByDblclick: data.data.autoEditByDblclick,
          },
        });
        break;
      case 'htmlViewer':
        wizDocument.destroy();
        wizDocument.reader.on(
          {
            documentBodyType: 'html',
            documentBody: data.data.documentBody,
          },
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          handleWizDocumentCallback
        );
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'cut':
        document.execCommand('cut');
        break;
      case 'paste':
        document.execCommand('paste');
        break;
      default:
    }
    // console.log(event);
  }

  function handleSelectionChanged(data) {
    // console.log(data);
    const toolsEnable = data.clientTools === '1';

    const noteStatus = {
      bold: toolsEnable ? data.bold === '1' : 'disabled',
      italic: toolsEnable ? data.italic === '1' : 'disabled',
      underline: toolsEnable ? data.underline === '1' : 'disabled',
      orderedList: toolsEnable ? data.InsertOrderedList === '1' : 'disabled',
      unorderedList: toolsEnable ? data.InsertUnorderedList === '1' : 'disabled',
      align: toolsEnable ? '' : 'disabled',
      textColor: toolsEnable ? data.foreColor : 'disabled',
      backgroundColor: toolsEnable ? data.backColor : 'disabled',
    };
    if (toolsEnable && data.justifycenter === '1') {
      noteStatus.align = 'center';
    } else if (toolsEnable && data.justifyright === '1') {
      noteStatus.align = 'right';
    } else if (toolsEnable && data.justifyleft === '1') {
      noteStatus.align = 'left';
    }

    if (!toolsEnable || data.canCreateTodo !== '1') {
      noteStatus.checkbox = 'disabled';
    }
    if (!toolsEnable || data.canCreateCode !== '1') {
      noteStatus.code = 'disabled';
    }
    if (!toolsEnable || data.canCreateTable !== '1') {
      noteStatus.table = 'disabled';
    }

    if (toolsEnable && /^h\d$/.test(data.blockFormat)) {
      noteStatus.heading = parseInt(data.blockFormat.substr(1), 10);
    }
    sendMessage({
      type: 'NoteStatusChanged',
      frameKey,
      data: noteStatus,
    });
  }

  function loadWizDocument(callback) {
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.setAttribute('charset', 'utf-8');
    s.onload = callback;
    s.src = wizDocumentUrl;
    document.querySelector('HEAD').appendChild(s);
    return s;
  }

  let lastResizeTime = Date.now();
  let lastResizeHtml = '';
  let lastHeight = 0;
  let lastWidth = 0;
  let dHeight = 0;
  let dWidth = 0;
  let resizeLoopCount = 0;

  function handleResize(entries) {
    if (!iframe) {
      return;
    }
    const iframeRect = iframe.getBoundingClientRect();
    if (iframeRect.height === 0 && iframeRect.width === 0) {
      // tabs 切换隐藏
      return;
    }

    const html = document.body.innerHTML;
    const time = Date.now();
    if (html.length === lastResizeHtml.length && time - lastResizeTime < 150 && dHeight >= 0 && dWidth >= 0) {
      resizeLoopCount += 1;
    } else {
      resizeLoopCount = 0;
    }
    lastResizeTime = time;
    lastResizeHtml = html;
    if (resizeLoopCount > 50) {
      return;
    }

    if (iframeContainer) {
      const wizMarkerSvg = document.querySelector('#wiz-painter-root #sketchpad .wiz-svg-page-container');
      const wizMarkerStyleId = 'body-for-wiz-marker';
      const wizAutoHeightStyleId = 'body-for-iframe-height';
      let height = 0;
      let width = 0;
      if (wizMarkerSvg) {
        const rect = wizMarkerSvg.getBoundingClientRect();
        height = rect.height;
        width = rect.width;
        iframeContainer.style.height = `${height}px`;
        iframeContainer.style.width = `${width}px`;
        const style = `.wiz-editor-body {min-height: ${rect.height}px !important;}`;
        const isTemp = true;
        wizDocument.insertCustomStyle(wizMarkerStyleId, style, isTemp);
      } else {
        const style = `body.wiz-editor-body {min-height: initial !important; height: initial !important;}`;
        const isTemp = true;
        wizDocument.insertCustomStyle(wizAutoHeightStyleId, style, isTemp);
        const scrollLayerRect = scrollLayer.getBoundingClientRect();
        const noteTitleRect = noteTitle ? noteTitle.getBoundingClientRect() : new DOMRect();
        const iframeMinHeight = scrollLayerRect.height - noteTitleRect.height;
        height = Math.max(document.body.offsetHeight, document.body.scrollHeight, iframeMinHeight);
        // console.log(scrollLayerRect.height, '-', noteTitleRect.height);
        // console.log(document.body.offsetHeight, document.body.scrollHeight, iframeMinHeight);
        iframeContainer.style.height = `${height}px`;
        const parent = iframeContainer.parentElement;
        if (!parent) {
          return;
        }

        let bodyWidth = 0;
        if (isFromWizClipper) {
          bodyWidth = document.documentElement.scrollWidth;
        }
        if (bodyWidth === parent.offsetWidth) {
          return;
        }
        if (bodyWidth > parent.offsetWidth) {
          width = bodyWidth;
          iframeContainer.style.width = `${width}px`;
        } else {
          width = 0;
          iframeContainer.style.width = '';
        }
        if (width > 0 && width > noteContainer.clientWidth) {
          noteContainer.style.width = `${width}px`;
          // noteContainer.style.marginRight = '0px';
        } else {
          noteContainer.style.width = '';
          // noteContainer.style.marginRight = '';
        }
        wizDocument.removeStyleById(wizAutoHeightStyleId);
        wizDocument.removeStyleById(wizMarkerStyleId);
      }
      dHeight = height - lastHeight;
      dWidth = width - lastWidth;
      lastHeight = height;
      lastWidth = width;
    }
  }

  const resizeObserver = new ResizeObserver(handleResize);

  function handleBeforeUnload(e) {
    resizeObserver.disconnect();
  }

  function handleContextmenu(e) {
    // console.log(e);
    const { clientX, clientY, target } = e;
    let img = null;
    if (/^img$/i.test(target.tagName)) {
      img = {
        src: target.getAttribute('src'),
      };
    }
    setTimeout(() => {
      sendMessage({
        type: 'ContextMenuEditor',
        frameKey,
        data: {
          clientX,
          clientY,
          img,
          isCanCopy: wizDocument.isCanCopy(),
        },
      });
    });
  }

  function handleClick(e) {
    if (!e.isTrusted) {
      return;
    }
    const event = new MouseEvent(e.type, e);
    window.parent.document.body.dispatchEvent(event);
    if (!isReadOnly && e.target === document.documentElement) {
      document.body.dispatchEvent(event);
      document.body.focus();
    }
  }
  function handleDblclick(e) {
    sendMessage({
      type: 'DblclickEditor',
      frameKey,
    });
  }

  function unbind() {
    resizeObserver.unobserve(document.body);
    document.documentElement.removeEventListener('click', handleClick);
    document.documentElement.removeEventListener('dblclick', handleDblclick);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('contextmenu', handleContextmenu);
  }
  function bind() {
    unbind();
    resizeObserver.observe(document.body);
    document.documentElement.addEventListener('click', handleClick);
    document.documentElement.addEventListener('dblclick', handleDblclick);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('message', handleMessage);
    window.addEventListener('contextmenu', handleContextmenu);
  }
  function handleWizDocumentCallback() {
    if (themeMode === 'auto') {
      if (mediaQueryList.matches) {
        wizDocument.nightMode.on();
      } else {
        wizDocument.nightMode.off();
      }
    } else if (themeMode === 'light') {
      wizDocument.nightMode.off();
    } else if (themeMode === 'dark') {
      wizDocument.nightMode.on();
    }
    const nodeLoadingStyle = document.querySelector('#note-loading');
    if (nodeLoadingStyle) {
      nodeLoadingStyle.remove();
    }
    if (isReadOnly || readerType !== NoteType.Markdown) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      sendCurToc();
    }

    bind();
    sendMessage({
      type: 'WizDocumentInitialized',
      frameKey,
      data: { isReadOnly },
    });
  }

  function handleUploadImages(files) {
    const images = [];
    for (let i = 0; i < files.length; i += 1) {
      let file = files[i];
      if (file.getAsFile) {
        file = file.getAsFile();
      }
      if (file && file.size > 0 && /image\/\w+/i.test(file.type)) {
        images.push(file);
      }
    }
    sendMessage({
      type: 'NoteUploadImages',
      frameKey,
      data: images,
    });
  }

  function handleDropFile(files, e) {
    wizDocument.editor.range.moveToPoint(e.clientX, e.clientY);
    handleUploadImages(files);
  }
  function handlePasteFile(files) {
    handleUploadImages(files);
  }
  function handlePasteImagesFromHtml(images) {
    const data = [];
    images.forEach((image, index) => {
      data.push({ key: image.key, src: image.attr.src });
    });

    sendMessage({
      type: 'NoteUploadImagesBySrc',
      frameKey,
      data,
    });
  }

  function handleUploadImage() {
    sendMessage({
      type: 'NoteUploadImage',
      frameKey,
    });
  }

  function handleAutoEdit() {
    setReadOnly(false);
    handleWizDocumentCallback();
  }

  function sendCurToc() {
    const toc = wizDocument.reader.getToc();
    const result = [];
    titleMap = {};
    function findChildren(titleList, parent) {
      titleList.forEach((data) => {
        titleMap[data.id] = data;
        const title = {
          blockId: data.id,
          text: data.dom.innerText,
          children: [],
        };
        if (parent) {
          parent.children.push(title);
        } else {
          result.push(title);
        }
        if (data.children) {
          findChildren(data.children, title);
        }
      });
    }
    findChildren(toc, null);
    sendMessage({
      type: 'NoteUpdateToc',
      frameKey,
      data: result,
    });
  }

  function handleUpdateToc() {
    if (tocTimer) {
      window.clearTimeout(tocTimer);
    }
    tocTimer = setTimeout(sendCurToc, 500);
  }

  function onLoad() {
    // console.log(window.WizDocument);
    const options = {
      document,
      container: iframeContainer,
      useFrame: true,
      frame: {
        disableInitContent: true,
        disableResizeContainer: true,
      },
      lang,
      clientType: 'desktop',
      isFromWizClipper,
      userInfo: {
        user_guid: userGuid,
        user_name: alias,
      },
      maxRedo: 100,
      dependencyUrl,
      xss: {
        noFrame,
      },
      // table: {
      //     colWidth: 120,        //默认列宽
      //     colWidthMin: 30,      //最小列宽
      //     rowHeightMin: 33      //最小行高
      // },
      noAmend: false, // only for read, 关闭修订
      timeout: {
        // only for read
        markdown: 30 * 1000,
        mathJax: 30 * 1000,
      },
      callback: {
        onClickLink: (e, href, isReader) => {
          sendMessage({
            type: 'NoteOpenUrl',
            frameKey,
            data: {
              href,
              isReadOnly: isReader,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
            },
          });
          e.preventDefault();
        },
        onImageDbClicked: (src, images) => {
          sendMessage({
            type: 'DbClickImage',
            frameKey,
            data: {
              images,
              index: images.findIndex((img) => img === src),
            },
          });
        },
      },
      editor: {
        autoFocus: false,
        autoCheckLink: true,
        type: 'common',
        customFixScrollBodyBottom: 60,
        callback: {
          undo: (data) => {
            // 避免保存数据时，继续修改数据，但却被设置 unModified
            saveHtmlId = Date.now();
            if (isReadOnly) {
              // autoEdit 转换时，会自动触发，但此时 isReadOnly = true
              return;
            }

            if (readerType !== NoteType.Markdown) {
              handleUpdateToc();
            }

            // 捕获需要自动保存的状态
            sendMessage({
              type: 'NoteModified',
              frameKey,
            });
          },
          onDropFile: handleDropFile,
          onPasteFile: handlePasteFile,
          onPasteImages: handlePasteImagesFromHtml,
          markerUndo: (jsonString) => {
            // WizChromeBrowser.Execute("MarkerUndo", jsonString, null, null, null);
          },
          markerInitiated: (jsonString) => {
            // WizChromeBrowser.Execute("MarkerInitiated", jsonString, null, null, null);
          },
          onUploadImage: handleUploadImage,
        },
      },
      reader: {
        type: readerType,
        autoEditByDblclick: {
          enable: canEdit,
          ignoreImage: true,
        },
        // clickImageEvent: getViewImageAction(),
        callback: {
          markdown: null, // only for read
          mathJax: null, // only for read
          onAutoEdit: handleAutoEdit,
        },
      },
      clientRoute: {
        getUserAlias: () => {
          return alias;
        },
        getUserAvatarFileName: () => {
          return userAvatar;
        },
        getUserGuid: () => {
          return userGuid;
        },
        hasPermission: () => {
          return 'docVM.can_edit.can';
        },
        isPersonalDocument: () => {
          return isPersonalKb;
        },
        checkDocLock: () => {
          // _data.checkDocLock(function () {
          //   wizDocument.reader.todo.onCheckDocLock(false, false);
          // });
        },
        getOriginalDoc: () => {
          return 'docVM.doc_info.document_body';
        },
        // saveDoc: function() {
        //   console.log('need save....doc');
        // }
      },
      codeNoIDE: false,
      pureReadMode,
      nightMode,
    };
    //
    wizDocument = new window.WizDocument(options);
    const isReplace = true;
    wizDocument.insertDefaultStyle(isReplace);
    window.wizDocument = wizDocument;
    bind();
    sendMessage({
      type: 'getReadOnlyStatus',
      frameKey,
      data: {},
    });
  }

  loadWizDocument(onLoad);
}

document.addEventListener('DOMContentLoaded', (event) => {
  initWizDocument();
});
