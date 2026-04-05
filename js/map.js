// Логика интерактивной карты мира
// - главная страница (index.html)
// - страница "Трамвайные системы" (systems.html)

(function () {
  'use strict';

  // Таблица соответствия: код страны в SVG → название на русском (как в systems.json)
  var COUNTRY_CODES = {
    'ru': 'Россия',
    'de': 'Германия',
    'cz': 'Чехия',
    'ua': 'Украина',
    'pl': 'Польша',
    'fr': 'Франция',
    'at': 'Австрия',
    'ch': 'Швейцария',
    'be': 'Бельгия',
    'nl': 'Нидерланды',
    'gb': 'Великобритания',
    'es': 'Испания',
    'pt': 'Португалия',
    'it': 'Италия',
    'hu': 'Венгрия',
    'ro': 'Румыния',
    'bg': 'Болгария',
    'rs': 'Сербия',
    'hr': 'Хорватия',
    'si': 'Словения',
    'sk': 'Словакия',
    'by': 'Беларусь',
    'lt': 'Литва',
    'lv': 'Латвия',
    'ee': 'Эстония',
    'fi': 'Финляндия',
    'se': 'Швеция',
    'no': 'Норвегия',
    'dk': 'Дания',
    'us': 'США',
    'ca': 'Канада',
    'mx': 'Мексика',
    'br': 'Бразилия',
    'ar': 'Аргентина',
    'au': 'Австралия',
    'nz': 'Новая Зеландия',
    'jp': 'Япония',
    'cn': 'Китай',
    'kr': 'Южная Корея',
    'in': 'Индия',
    'tr': 'Турция',
    'eg': 'Египет',
    'za': 'ЮАР',
    'ma': 'Марокко',
    'tn': 'Тунис',
    'dz': 'Алжир',
    'uz': 'Узбекистан',
    'kz': 'Казахстан',
    'ge': 'Грузия',
    'az': 'Азербайджан',
    'am': 'Армения',
    'gr': 'Греция',
    'ie': 'Ирландия',
    'lu': 'Люксембург'
  };

  // Обратная таблица: название → код
  var COUNTRY_NAMES = {};
  for (var code in COUNTRY_CODES) {
    if (COUNTRY_CODES.hasOwnProperty(code)) {
      COUNTRY_NAMES[COUNTRY_CODES[code]] = code;
    }
  }

  /**
   * Инициализация карты мира.
   * @param {Array<object>} systems
   */
  function initWorldMap(systems) {
    var mapObject = document.getElementById('world-map');
    var listEl = document.getElementById('map-systems-list');
    var titleEl = document.getElementById('map-systems-title');
    var countEl = document.getElementById('map-systems-count');
    var resetBtn = document.getElementById('map-reset');
    var messageEl = document.getElementById('map-message');

    if (!mapObject || !listEl || !titleEl || !countEl || !resetBtn) {
      console.log('Карта: не найдены необходимые элементы на странице');
      return;
    }

    var pageType = document.body.dataset.page || '';
    var panZoomInstance = null;
    var initialized = false;

    // Блокируем прокрутку страницы, когда колесо крутят над блоком карты
    var mapWrapper = mapObject.closest('.map-wrapper');
    if (mapWrapper) {
      mapWrapper.addEventListener('wheel', function (event) {
        event.preventDefault();
      }, { passive: false });
    }

    // Группируем системы по странам
    var systemsByCountry = new Map();
    systems.forEach(function (system) {
      var country = system.country || 'Неизвестно';
      if (!systemsByCountry.has(country)) {
        systemsByCountry.set(country, []);
      }
      systemsByCountry.get(country).push(system);
    });

    function systemsListToHTML(list) {
      if (!list.length) {
        return '<li>В выбранной стране данных о трамвайных системах пока нет.</li>';
      }

      return list.map(function (system) {
        var status = system.status === 'действующая' ? 'действует' : 'закрыта';
        var yearsText = system.yearOpened
          ? system.yearOpened + ' — ' + status
          : status;

        return '<li>' +
          '• <a href="system-detail.html?id=' + encodeURIComponent(system.id) + '">' +
          system.city + ', ' + system.country + ' — ' + system.name +
          '</a>' +
          '<span class="map-system-years">(' + yearsText + ')</span>' +
          '</li>';
      }).join('');
    }

    function renderAllSystems() {
      var sorted = systems.slice().sort(function (a, b) {
        return a.city.localeCompare(b.city, 'ru') ||
          a.name.localeCompare(b.name, 'ru');
      });
      titleEl.textContent = 'Все трамвайные системы';
      countEl.textContent = 'Всего систем: ' + sorted.length;
      listEl.innerHTML = systemsListToHTML(sorted);
    }

    function renderCountry(countryName) {
      var list = systemsByCountry.get(countryName) || [];
      var sorted = list.slice().sort(function (a, b) {
        return a.city.localeCompare(b.city, 'ru') ||
          a.name.localeCompare(b.name, 'ru');
      });
      titleEl.textContent = countryName + ' (' + sorted.length + ')';
      countEl.textContent = 'Систем в стране: ' + sorted.length;
      listEl.innerHTML = systemsListToHTML(sorted);
    }

    // Синхронизация карты с фильтром "Страна" на странице systems.html
    function syncFilterCountry(countryNameOrEmpty) {
      if (pageType !== 'systems-list') return;
      var countrySelect = document.getElementById('filter-country');
      if (!countrySelect) return;

      countrySelect.value = countryNameOrEmpty || '';
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Фокус на Европе.
     */
    function focusOnEurope(svgDoc) {
      if (!panZoomInstance) return;

      var svgRoot = svgDoc.documentElement;
      if (!svgRoot || svgRoot.nodeName.toLowerCase() !== 'svg') return;

      var bbox = null;

      // Пытаемся найти Германию и Чехию по id
      ['de', 'cz'].forEach(function (code) {
        var el = svgDoc.getElementById(code);
        if (!el) return;

        try {
          var b = el.getBBox();
          var x2 = b.x + b.width;
          var y2 = b.y + b.height;

          if (!bbox) {
            bbox = { x1: b.x, y1: b.y, x2: x2, y2: y2 };
          } else {
            bbox.x1 = Math.min(bbox.x1, b.x);
            bbox.y1 = Math.min(bbox.y1, b.y);
            bbox.x2 = Math.max(bbox.x2, x2);
            bbox.y2 = Math.max(bbox.y2, y2);
          }
        } catch (e) {
          console.log('Не удалось получить bbox для', code);
        }
      });

      // Если bbox по странам не нашли — берём примерную "Европу" по viewBox
      if (!bbox) {
        var vb = svgRoot.viewBox && svgRoot.viewBox.baseVal;
        if (!vb || !vb.width || !vb.height) return;

        var x1 = vb.x + vb.width * 0.25;
        var x2 = vb.x + vb.width * 0.65;
        var y1 = vb.y + vb.height * 0.1;
        var y2 = vb.y + vb.height * 0.55;

        bbox = { x1: x1, y1: y1, x2: x2, y2: y2 };
      }

      var width = bbox.x2 - bbox.x1;
      var height = bbox.y2 - bbox.y1;
      var centerX = bbox.x1 + width / 2;
      var centerY = bbox.y1 + height / 2;

      var sizes = panZoomInstance.getSizes();
      var vpWidth = sizes.width;
      var vpHeight = sizes.height;

      var zoom = Math.min(vpWidth / width, vpHeight / height) * 0.9;

      panZoomInstance.zoom(zoom);

      var panX = vpWidth / 2 - centerX * zoom;
      var panY = vpHeight / 2 - centerY * zoom;
      panZoomInstance.pan({ x: panX, y: panY });
    }

    /**
     * Основная инициализация по уже загруженному SVG-документу.
     */
    function setupSvg(svgDoc) {
      if (initialized) return;
      initialized = true;

      var svgRoot = svgDoc.documentElement;
      if (!svgRoot || svgRoot.nodeName.toLowerCase() !== 'svg') {
        if (messageEl) {
          messageEl.textContent = 'Не удалось найти корневой элемент SVG.';
        }
        console.log('Карта: svgRoot не найден или это не svg');
        renderAllSystems();
        return;
      }

      console.log('Карта: SVG успешно загружен');

      // Подключаем панорамирование и зум
      if (window.svgPanZoom) {
        try {
          panZoomInstance = window.svgPanZoom(svgRoot, {
            zoomEnabled: true,
            panEnabled: true,
            controlIconsEnabled: true,
            fit: true,
            center: true,
            minZoom: 0.7,
            maxZoom: 10,
            zoomScaleSensitivity: 0.3,
            dblClickZoomEnabled: true,
            mouseWheelZoomEnabled: true
          });
          console.log('Карта: svg-pan-zoom подключен');
        } catch (e) {
          console.log('Карта: ошибка при инициализации svg-pan-zoom', e);
        }
      } else {
        console.log('Карта: библиотека svg-pan-zoom не найдена');
      }

      // Блокируем скролл страницы по колесику внутри SVG
      svgRoot.addEventListener('wheel', function (event) {
        event.preventDefault();
      }, { passive: false });

      // Ищем страны с классом landxx
      var countryPaths = svgDoc.querySelectorAll('.landxx');
      console.log('Карта: найдено стран с классом landxx:', countryPaths.length);

      if (!countryPaths.length && messageEl) {
        messageEl.textContent = 'SVG-карта загружена, но страны не найдены.';
      }

      // Помечаем страны, где есть трамвайные системы
      systemsByCountry.forEach(function (value, countryName) {
        var countryCode = COUNTRY_NAMES[countryName];
        if (countryCode) {
          var path = svgDoc.getElementById(countryCode);
          if (path) {
            path.classList.add('has-trams');
          }
        }
      });

      // Фокусируем стартовый вид на Европе
      if (panZoomInstance) {
        setTimeout(function () {
          focusOnEurope(svgDoc);
        }, 100);
      }

      function clearActive() {
        countryPaths.forEach(function (path) {
          path.classList.remove('active');
        });
      }

      function selectCountry(countryName) {
        clearActive();
        var countryCode = COUNTRY_NAMES[countryName];
        var activePath = countryCode ? svgDoc.getElementById(countryCode) : null;
        if (activePath) {
          activePath.classList.add('active');
        }
        renderCountry(countryName);
        syncFilterCountry(countryName);
      }

      // Обработчики кликов
      countryPaths.forEach(function (path) {
        // Получаем код страны из id
        var countryCode = path.id || '';
        // Преобразуем в русское название
        var countryName = COUNTRY_CODES[countryCode.toLowerCase()] || '';
        if (!countryName) return;

        path.style.cursor = 'pointer';
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', 'Страна ' + countryName);

        path.addEventListener('click', function () {
          selectCountry(countryName);
        });

        path.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCountry(countryName);
          }
        });
      });

      // Кнопка "Показать все"
      resetBtn.addEventListener('click', function () {
        clearActive();
        renderAllSystems();
        syncFilterCountry('');

        if (panZoomInstance) {
          panZoomInstance.resetZoom();
          panZoomInstance.center();
        }
      });

      // Стартовый список
      renderAllSystems();
      if (messageEl) {
        messageEl.textContent = 'Выберите страну на карте, чтобы отфильтровать список.';
      }
    }

    /**
     * Пробуем инициализировать сразу (если SVG уже загружен).
     */
    function tryImmediateInit() {
      try {
        var svgDoc = mapObject.contentDocument;
        if (svgDoc && svgDoc.documentElement) {
          setupSvg(svgDoc);
          return true;
        }
      } catch (e) {
        console.log('Карта: не удалось получить contentDocument', e);
      }
      return false;
    }

    // Если не удалось сразу — ждём событие load
    if (!tryImmediateInit()) {
      mapObject.addEventListener('load', function () {
        try {
          var svgDoc = mapObject.contentDocument;
          if (svgDoc) {
            setupSvg(svgDoc);
          } else if (messageEl) {
            messageEl.textContent = 'Не удалось прочитать содержимое SVG-карты.';
            renderAllSystems();
          }
        } catch (error) {
          console.log('Карта: ошибка при инициализации', error);
          if (messageEl) {
            messageEl.textContent = 'Произошла ошибка при инициализации карты.';
          }
          renderAllSystems();
        }
      });
    }

    // Если SVG совсем не загрузился
    mapObject.addEventListener('error', function () {
      if (messageEl) {
        messageEl.textContent = 'Не удалось загрузить SVG-карту. Список систем доступен ниже.';
      }
      renderAllSystems();
    });
  }

  window.initWorldMap = initWorldMap;
})();
