(function () {
  'use strict';

  if (window.__markdownAdminInit) {
    return;
  }
  window.__markdownAdminInit = true;

  function applyWrapFormat(value, start, end, before, after, placeholder) {
    placeholder = placeholder || 'текст';
    var selected = value.slice(start, end);
    var text = selected || placeholder;
    var newValue = value.slice(0, start) + before + text + after + value.slice(end);
    var selStart = start + before.length;
    var selEnd = selStart + text.length;
    return { value: newValue, selectionStart: selStart, selectionEnd: selEnd };
  }

  function applyLinePrefixFormat(value, start, end, prefix) {
    var before = value.slice(0, start);
    var selected = value.slice(start, end);
    var after = value.slice(end);
    var lines = selected.length > 0 ? selected.split('\n') : [''];
    var formatted = lines.map(function (line) {
      return line.startsWith(prefix) ? line : prefix + line;
    }).join('\n');
    return {
      value: before + formatted + after,
      selectionStart: start,
      selectionEnd: start + formatted.length,
    };
  }

  function applyLinkFormat(value, start, end) {
    var selected = value.slice(start, end);
    var text = selected || 'текст';
    var link = '[' + text + '](url)';
    var newValue = value.slice(0, start) + link + value.slice(end);
    var urlStart = start + text.length + 3;
    return { value: newValue, selectionStart: urlStart, selectionEnd: urlStart + 3 };
  }

  function applyHorizontalRule(value, start, end) {
    var rule = '\n\n---\n\n';
    var newValue = value.slice(0, start) + rule + value.slice(end);
    var pos = start + rule.length;
    return { value: newValue, selectionStart: pos, selectionEnd: pos };
  }

  function applyTableFormat(value, start, end, rows, cols) {
    rows = rows || 2;
    cols = cols || 3;
    var colCount = Math.max(1, cols);
    var rowCount = Math.max(1, rows);
    var headerCells = [];
    var separatorCells = [];
    var bodyRow = [];
    var i;
    for (i = 0; i < colCount; i += 1) {
      headerCells.push('Заголовок ' + (i + 1));
      separatorCells.push('---');
      bodyRow.push('Значение');
    }
    var lines = [
      '| ' + headerCells.join(' | ') + ' |',
      '| ' + separatorCells.join(' | ') + ' |',
    ];
    for (i = 0; i < rowCount; i += 1) {
      lines.push('| ' + bodyRow.join(' | ') + ' |');
    }
    var before = value.slice(0, start);
    var after = value.slice(end);
    var needsLeadingNewline = before.length > 0 && !before.endsWith('\n\n')
      ? (before.endsWith('\n') ? '\n' : '\n\n')
      : '';
    var needsTrailingNewline = after.startsWith('\n') ? '\n' : '\n\n';
    var table = needsLeadingNewline + lines.join('\n') + needsTrailingNewline;
    var newValue = before + table + after;
    var pos = before.length + table.length;
    return { value: newValue, selectionStart: pos, selectionEnd: pos };
  }

  function restoreSelection(textarea, start, end) {
    requestAnimationFrame(function () {
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  }

  function getCsrfToken() {
    var match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function fetchPreview(url, text) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify({ content: text }),
      credentials: 'same-origin',
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('preview failed');
      }
      return response.json();
    });
  }

  function applyAction(textarea, action) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var result;

    switch (action) {
      case 'h2':
        result = applyLinePrefixFormat(value, start, end, '## ');
        break;
      case 'h3':
        result = applyLinePrefixFormat(value, start, end, '### ');
        break;
      case 'bold':
        result = applyWrapFormat(value, start, end, '**', '**');
        break;
      case 'italic':
        result = applyWrapFormat(value, start, end, '*', '*');
        break;
      case 'strike':
        result = applyWrapFormat(value, start, end, '~~', '~~');
        break;
      case 'ul':
        result = applyLinePrefixFormat(value, start, end, '- ');
        break;
      case 'ol':
        result = applyLinePrefixFormat(value, start, end, '1. ');
        break;
      case 'quote':
        result = applyLinePrefixFormat(value, start, end, '> ');
        break;
      case 'link':
        result = applyLinkFormat(value, start, end);
        break;
      case 'table':
        result = applyTableFormat(value, start, end, 2, 3);
        break;
      case 'hr':
        result = applyHorizontalRule(value, start, end);
        break;
      default:
        return;
    }

    textarea.value = result.value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    restoreSelection(textarea, result.selectionStart, result.selectionEnd);
  }

  function getWidget(el) {
    return el ? el.closest('.markdown-widget') : null;
  }

  function updatePreview(root) {
    var textarea = root.querySelector('textarea');
    var preview = root.querySelector('[data-markdown-preview]');
    var previewUrl = root.dataset.previewUrl;
    if (!textarea || !preview || !previewUrl) {
      return;
    }

    var text = textarea.value.trim();
    if (!text) {
      preview.innerHTML = '<span class="markdown-widget__preview--empty">Нет содержимого для предпросмотра</span>';
      return;
    }

    preview.classList.add('markdown-widget__preview--loading');
    preview.textContent = 'Загрузка предпросмотра…';
    fetchPreview(previewUrl, textarea.value)
      .then(function (data) {
        preview.classList.remove('markdown-widget__preview--loading');
        preview.innerHTML = data.html || '<span class="markdown-widget__preview--empty">Нет содержимого</span>';
      })
      .catch(function () {
        preview.classList.remove('markdown-widget__preview--loading');
        preview.innerHTML = '<span class="markdown-widget__preview--empty">Не удалось загрузить предпросмотр</span>';
      });
  }

  function setTab(root, tab) {
    root.dataset.activeTab = tab;
    root.querySelectorAll('[data-markdown-tab]').forEach(function (btn) {
      var isActive = btn.dataset.markdownTab === tab;
      btn.classList.toggle('markdown-widget__tab--active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (tab === 'preview') {
      updatePreview(root);
    }
  }

  function initWidget(root) {
    if (!root || root.dataset.markdownInit === 'true') {
      return;
    }
    root.dataset.markdownInit = 'true';
    if (!root.dataset.activeTab) {
      root.dataset.activeTab = 'edit';
    }

    var textarea = root.querySelector('textarea');
    if (!textarea) {
      return;
    }

    textarea.addEventListener('input', function () {
      if (root.dataset.activeTab === 'preview') {
        clearTimeout(root._markdownPreviewTimer);
        root._markdownPreviewTimer = setTimeout(function () {
          updatePreview(root);
        }, 300);
      }
    });
  }

  function initAll() {
    document.querySelectorAll('.markdown-widget').forEach(initWidget);
  }

  document.addEventListener('click', function (event) {
    var tabBtn = event.target.closest('[data-markdown-tab]');
    if (tabBtn) {
      var tabRoot = getWidget(tabBtn);
      if (tabRoot) {
        event.preventDefault();
        event.stopPropagation();
        initWidget(tabRoot);
        setTab(tabRoot, tabBtn.dataset.markdownTab);
      }
      return;
    }

    var actionBtn = event.target.closest('[data-md-action]');
    if (actionBtn) {
      var actionRoot = getWidget(actionBtn);
      if (actionRoot) {
        event.preventDefault();
        event.stopPropagation();
        var textarea = actionRoot.querySelector('textarea');
        if (textarea) {
          applyAction(textarea, actionBtn.dataset.mdAction);
        }
      }
    }
  }, true);

  function scheduleInit() {
    initAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInit);
  } else {
    scheduleInit();
  }

  window.addEventListener('load', scheduleInit);
  document.addEventListener('formset:added', function () {
    setTimeout(scheduleInit, 0);
  });
  document.addEventListener('alpine:initialized', scheduleInit);

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var observerTimer = null;
    var observer = new MutationObserver(function (mutations) {
      var hasWidget = false;
      var i;
      for (i = 0; i < mutations.length; i += 1) {
        var nodes = mutations[i].addedNodes;
        var j;
        for (j = 0; j < nodes.length; j += 1) {
          var node = nodes[j];
          if (node.nodeType !== 1) {
            continue;
          }
          if (
            (node.classList && node.classList.contains('markdown-widget'))
            || (node.querySelector && node.querySelector('.markdown-widget'))
          ) {
            hasWidget = true;
            break;
          }
        }
        if (hasWidget) {
          break;
        }
      }
      if (!hasWidget) {
        return;
      }
      clearTimeout(observerTimer);
      observerTimer = setTimeout(scheduleInit, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
