APP.ui = {
  formatDate: function (dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU');
  },

  timeAgo: function (dateStr) {
    if (!dateStr) return '';
    var now = new Date();
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var diff = Math.floor((now - d) / 1000);
    if (diff < 0) return 'только что';
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад';
    if (diff < 604800) return Math.floor(diff / 86400) + ' дн назад';
    return d.toLocaleDateString('ru-RU');
  },

  showToast: function (message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add('toast-visible');

    // Remove after 3 seconds
    setTimeout(function () {
      toast.classList.remove('toast-visible');
      toast.addEventListener('transitionend', function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      });
      // Fallback removal
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 400);
    }, 3000);
  },

  showSpinner: function (containerId) {
    var overlay = document.getElementById('spinner-overlay');
    if (overlay) overlay.style.display = 'flex';
  },

  hideSpinner: function (containerId) {
    var overlay = document.getElementById('spinner-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  escapeHtml: function (str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  truncate: function (str, len) {
    if (!str) return '';
    len = len || 100;
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
  },

  debounce: function (fn, delay) {
    delay = delay || 300;
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }
};
