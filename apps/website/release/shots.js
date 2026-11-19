(function () {
  var R = window.RELEASE;
  var query = new URLSearchParams(location.search);
  var formatId = query.get('format') || 'iphone69';
  var format = R.formats.filter(function (f) { return f.id === formatId; })[0] || R.formats[0];

  function studioSrc(screen) {
    return '/studio/?embed=1&bare=1&screen=' + encodeURIComponent(screen);
  }

  function phone(screen) {
    var box = document.createElement('div');
    box.className = 'slide-phone';
    var frame = document.createElement('iframe');
    frame.src = studioSrc(screen);
    frame.title = screen;
    frame.tabIndex = -1;
    box.appendChild(frame);
    return box;
  }

  function copy(title, sub, mark) {
    var box = document.createElement('div');
    box.className = 'slide-copy';
    if (mark) {
      var img = document.createElement('img');
      img.className = 'slide-mark';
      img.src = '/imgs/satSigner_symbol.png';
      img.alt = '';
      box.appendChild(img);
    }
    var h = document.createElement('h2');
    h.className = 'slide-title';
    h.textContent = title;
    var p = document.createElement('p');
    p.className = 'slide-sub';
    p.textContent = sub;
    box.appendChild(h);
    box.appendChild(p);
    return box;
  }

  // The header asset is a single slide built from the first three shots.
  function slides() {
    if (format.id === 'header') return [{ header: true }];
    return R.shots;
  }

  function slide(s) {
    var node = document.createElement('div');
    node.className = 'slide' + (format.id === 'ipad13' ? ' is-ipad' : '') + (s.header ? ' is-header' : '');
    node.style.setProperty('--w', format.w + 'px');
    node.style.setProperty('--h', format.h + 'px');
    if (s.header) {
      node.appendChild(copy('See every sat.', 'Self-custody bitcoin with full UTXO control, multisig, and air-gapped signing.', true));
      R.shots.slice(0, 3).forEach(function (shot) { node.appendChild(phone(shot.screen)); });
    } else {
      node.appendChild(copy(s.title, s.sub));
      node.appendChild(phone(s.screen));
    }
    return node;
  }

  if (query.has('export')) {
    document.documentElement.classList.add('is-export');
    var n = parseInt(query.get('slide') || '0', 10);
    document.body.innerHTML = '';
    document.body.appendChild(slide(slides()[n]));
    return;
  }

  var tabs = document.getElementById('shots-formats');
  R.formats.forEach(function (f) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'kit-link-button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(f.id === format.id));
    b.textContent = f.label + ' · ' + f.w + '×' + f.h;
    b.addEventListener('click', function () {
      query.set('format', f.id);
      location.search = query.toString();
    });
    tabs.appendChild(b);
  });

  var grid = document.getElementById('shots-grid');
  grid.classList.toggle('is-wide', format.w > format.h);
  var fits = [];
  slides().forEach(function (s, i) {
    var cell = document.createElement('div');
    cell.className = 'shots-cell';
    var fit = document.createElement('div');
    fit.className = 'shots-fit';
    fit.style.aspectRatio = format.w + ' / ' + format.h;
    fit.appendChild(slide(s));
    var link = document.createElement('a');
    link.href = '?export=1&format=' + format.id + '&slide=' + i;
    link.target = '_blank';
    link.textContent = (i + 1) + '. ' + (s.screen || 'header') + ' · open full size';
    cell.appendChild(fit);
    cell.appendChild(link);
    grid.appendChild(cell);
    fits.push(fit);
  });

  function scale() {
    fits.forEach(function (fit) {
      fit.firstChild.style.transform = 'scale(' + fit.clientWidth / format.w + ')';
    });
  }
  scale();
  addEventListener('resize', scale);
})();
