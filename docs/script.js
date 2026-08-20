// Theme toggle
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };
})();

// Simple client-side search
(function () {
  const pages = [
    { title: 'Home', url: 'index.html', keywords: 'overview introduction features' },
    { title: 'Installation', url: 'installation.html', keywords: 'install npm copy setup' },
    { title: 'Quick Start', url: 'quick-start.html', keywords: 'example basic start first' },
    { title: 'Collections', url: 'collections.html', keywords: 'collection create options list drop unload' },
    { title: 'Inserting Documents', url: 'inserting.html', keywords: 'insert insertMany autoId' },
    { title: 'Querying', url: 'querying.html', keywords: 'find findOne query operators filter sort limit skip project' },
    { title: 'Updating', url: 'updating.html', keywords: 'update updateOne updateMany set inc push pull unset' },
    { title: 'Deleting', url: 'deleting.html', keywords: 'delete deleteOne deleteMany' },
    { title: 'Indexes', url: 'indexes.html', keywords: 'index indexes idx unique multi performance' },
    { title: 'Transactions', url: 'transactions.html', keywords: 'transaction commit rollback' },
    { title: 'Async API', url: 'async.html', keywords: 'async await promise insertAsync' },
    { title: 'ID Generation', url: 'ids.html', keywords: 'id auto uuid objectid rebuildId' },
    { title: 'Import & Backup', url: 'import-backup.html', keywords: 'import backup restore' },
    { title: 'Events', url: 'events.html', keywords: 'event emitter on emit' },
    { title: 'Collection Options', url: 'options.html', keywords: 'options autoId indexes pretty lazy idType' },
    { title: 'API Reference', url: 'api-reference.html', keywords: 'api methods reference' },
    { title: 'Examples', url: 'examples.html', keywords: 'example advanced real world' }
  ];

  window.initSearch = function () {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      if (q.length < 2) {
        results.innerHTML = '';
        results.style.display = 'none';
        return;
      }

      const matched = pages.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q)
      );

      if (matched.length === 0) {
        results.innerHTML = '<div class="search-item">No results</div>';
      } else {
        results.innerHTML = matched.map(p =>
          `<a class="search-item" href="${p.url}">${p.title}</a>`
        ).join('');
      }
      results.style.display = 'block';
    });

    // Hide results when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-box')) {
        results.style.display = 'none';
      }
    });
  };

  document.addEventListener('DOMContentLoaded', initSearch);
})();

// Mobile sidebar
window.toggleSidebar = function () {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
};
