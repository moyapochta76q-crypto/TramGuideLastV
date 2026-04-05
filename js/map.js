// Логика интерактивной карты мира:
// - главная страница (index.html)
// - страница "Трамвайные системы" (systems.html)
//
// Здесь:
// 1) Панорамирование и зум через svg-pan-zoom;
// 2) Стартовый вид – увеличенный, с фокусом на Европе
//    (по Германии и Чехии, либо по примерной области viewBox);
// 3) Колёсико над картой не скроллит страницу;
// 4) Карта инициализируется и если SVG загрузился раньше JS, и если позже.

(function () {
  'use strict';
  // Таблица соответствия: код страны в SVG → название на русском (как в systems.json)
  const COUNTRY_CODES = {
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
  const COUNTRY_NAMES = {};
  for (const [code, name] of Object.entries(COUNTRY_CODES)) {
    COUNTRY_NAMES[name] = code;
  }
  /**
   * Инициализация карты мира.
   * @param {Array<object>} systems
   */
  function initWorldMap(systems) {
    const mapObject = document.getElementById('world-map');
    const listEl = document.getElementById('map-systems-list');
    const titleEl = document.getElementById('map-systems-title');
    const countEl = document.getElementById('map-systems-count');
    const resetBtn = document.getElementById('map-reset');
    const messageEl = document.getElementById('map-message');

    if (!mapObject || !listEl || !titleEl || !countEl || !resetBtn) {
      return;
    }

    const pageType = document.body.dataset.page || '';

    let panZoomInstance = null;
    let initialized = false;

    // Блокируем прокрутку страницы, когда колесо крутят над блоком карты
    const mapWrapper = mapObject.closest('.map-wrapper');
    if (mapWrapper) {
      try {
        mapWrapper.addEventListener(
          'wheel',
          function (event) {
            event.preventDefault();
          },
          { passive: false }
        );
      } catch (e) {
        mapWrapper.addEventListener('wheel', function (event) {
          event.preventDefault();
        });
      }
    }

    // Группируем системы по странам
    const systemsByCountry = new Map();
    systems.forEach(system => {
      const country = system.country || 'Неизвестно';
      if (!systemsByCountry.has(country)) {
        systemsByCountry.set(country, []);
      }
      systemsByCountry.get(country).push(system);
    });

    function systemsListToHTML(list) {
      if (!list.length) {
        return '<li>В выбранной стране данных о трамвайных системах пока нет.</li>';
      }

      return list
        .map(system => {
          const status = system.status === 'действующая' ? 'действует' : 'закрыта';
          const yearsText = system.yearOpened
            ? `${system.yearOpened} — ${status}`
            : status;

          return `
            <li>
              • <a href="system-detail.html?id=${encodeURIComponent(system.id)}">
                ${system.city}, ${system.country} — ${system.name}
              </a>
              <span class="map-system-years">(${yearsText})</span>
            </li>
          `;
        })
        .join('');
    }

    function renderAllSystems() {
      const sorted = [...systems].sort(
        (a, b) =>
          a.city.localeCompare(b.city, 'ru') ||
          a.name.localeCompare(b.name, 'ru')
      );
      titleEl.textContent = 'Все трамвайные системы';
      countEl.textContent = `Всего систем: ${sorted.length}`;
      listEl.innerHTML = systemsListToHTML(sorted);
    }

    function renderCountry(countryName) {
      const list = systemsByCountry.get(countryName) || [];
      const sorted = [...list].sort(
        (a, b) =>
          a.city.localeCompare(b.city, 'ru') ||
          a.name.localeCompare(b.name, 'ru')
      );
      titleEl.textContent = `${countryName} (${sorted.length})`;
      countEl.textContent = `Систем в стране: ${sorted.length}`;
      listEl.innerHTML = systemsListToHTML(sorted);
    }

    // Синхронизация карты с фильтром "Страна" на странице systems.html
    function syncFilterCountry(countryNameOrEmpty) {
      if (pageType !== 'systems-list') return;
      const countrySelect = document.getElementById('filter-country');
      if (!countrySelect) return;

      countrySelect.value = countryNameOrEmpty || '';
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Фокус на Европе.
     * 1) Пробуем использовать bbox Германии и Чехии (если размечены).
     * 2) Если нет — берём примерный прямоугольник из viewBox.
     */
    function focusOnEurope(svgDoc) {
      if (!panZoomInstance) return;

      const svgRoot = svgDoc.documentElement;
      if (!svgRoot || svgRoot.nodeName.toLowerCase() !== 'svg') return;

      let bbox = null;

      // Пытаемся найти Германию и Чехию по data-country
        ['de', 'cz'].forEach(code => {
        const el = svgDoc.getElementById(code);
        if (!el) return;

        const b = el.getBBox();
        const x2 = b.x + b.width;
        const y2 = b.y + b.height;

        if (!bbox) {
          bbox = { x1: b.x, y1: b.y, x2, y2 };
        } else {
          bbox.x1 = Math.min(bbox.x1, b.x);
          bbox.y1 = Math.min(bbox.y1, b.y);
          bbox.x2 = Math.max(bbox.x2, x2);
          bbox.y2 = Math.max(bbox.y2, y2);
        }
      });

      // Если bbox по странам не нашли — берём примерную "Европу" по viewBox
      if (!bbox) {
        const vb = svgRoot.viewBox && svgRoot.viewBox.baseVal;
        if (!vb || !vb.width || !vb.height) return;

        // Примерные границы Европы: 25–65% ширины, 10–55% высоты viewBox
        const x1 = vb.x + vb.width * 0.25;
        const x2 = vb.x + vb.width * 0.65;
        const y1 = vb.y + vb.height * 0.1;
        const y2 = vb.y + vb.height * 0.55;

        bbox = { x1, y1, x2, y2 };
      }

      const width = bbox.x2 - bbox.x1;
      const height = bbox.y2 - bbox.y1;
      const centerX = bbox.x1 + width / 2;
      const centerY = bbox.y1 + height / 2;

      const sizes = panZoomInstance.getSizes();
      const vpWidth = sizes.width;
      const vpHeight = sizes.height;

      const zoom = Math.min(vpWidth / width, vpHeight / height) * 0.9;

      panZoomInstance.zoom(zoom);

      const panX = vpWidth / 2 - centerX * zoom;
      const panY = vpHeight / 2 - centerY * zoom;
      panZoomInstance.pan({ x: panX, y: panY });
    }

    /**
     * Основная инициализация по уже загруженному SVG-документу.
     */
    function setupSvg(svgDoc) {
      if (initialized) return;
      initialized = true;

      const svgRoot = svgDoc.documentElement;
      if (!svgRoot || svgRoot.nodeName.toLowerCase() !== 'svg') {
        if (messageEl) {
          messageEl.textContent = 'Не удалось найти корневой элемент SVG.';
        }
        renderAllSystems();
        return;
      }

      // Подключаем панорамирование и зум
      if (window.svgPanZoom) {
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
      }

      // Дополнительно блокируем скролл страницы по колесику внутри самого SVG
      try {
        svgRoot.addEventListener(
          'wheel',
          function (event) {
            event.preventDefault();
          },
          { passive: false }
        );
      } catch (e) {
        svgRoot.addEventListener('wheel', function (event) {
          event.preventDefault();
        });
      }

      const countryPaths = svgDoc.querySelectorAll('.landxx');
      if (!countryPaths.length && messageEl) {
        messageEl.textContent =
          'SVG-карта загружена, но страны с классом .country не найдены.';
      }

      // Помечаем страны, где есть трамвайные системы
      systemsByCountry.forEach((_value, countryName) => {
        const countryCode = COUNTRY_NAMES[countryName];
        if (countryCode) {
        const path = svgDoc.getElementById(countryCode);
        if (path) {
        path.classList.add('has-trams');
    }
  }
});

      // Фокусируем стартовый вид на Европе (чуть позже, чтобы svg-pan-zoom успел посчитать размеры)
      if (panZoomInstance) {
        setTimeout(() => focusOnEurope(svgDoc), 0);
      }

      function clearActive() {
        countryPaths.forEach(path => path.classList.remove('active'));
      }

      function selectCountry(countryName) {
        clearActive();
        const countryCode = COUNTRY_NAMES[countryName];
        const activePath = countryCode ? svgDoc.getElementById(countryCode) : null;
        if (activePath) {
          activePath.classList.add('active');
        }
        renderCountry(countryName);
        syncFilterCountry(countryName);
      }

      // Обработчики кликов и клавиш
      countryPaths.forEach(path => {
     // Получаем код страны из id (например, "ru", "de")
     const countryCode = path.id || '';
     // Преобразуем в русское название
     const countryName = COUNTRY_CODES[countryCode.toLowerCase()] || '';
  if (!countryName) return;

        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', `Страна ${countryName}`);

        path.addEventListener('click', () => {
          selectCountry(countryName);
        });

        path.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCountry(countryName);
          }
        });
      });

      // Кнопка "Показать все"
      resetBtn.addEventListener('click', () => {
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
        messageEl.textContent =
          'Выберите страну на карте, чтобы отфильтровать список.';
      }
    }

    /**
     * Пробуем инициализировать сразу (если SVG уже загружен).
     */
    function tryImmediateInit() {
      try {
        const svgDoc = mapObject.contentDocument;
        if (svgDoc && svgDoc.documentElement) {
          setupSvg(svgDoc);
          return true;
        }
      } catch (e) {
        console.error(e);
      }
      return false;
    }

    // Если не удалось сразу — ждём событие load
    if (!tryImmediateInit()) {
      mapObject.addEventListener('load', () => {
        try {
          const svgDoc = mapObject.contentDocument;
          if (svgDoc) {
            setupSvg(svgDoc);
          } else if (messageEl) {
            messageEl.textContent = 'Не удалось прочитать содержимое SVG-карты.';
            renderAllSystems();
          }
        } catch (error) {
          console.error(error);
          if (messageEl) {
            messageEl.textContent =
              'Произошла ошибка при инициализации карты.';
          }
          renderAllSystems();
        }
      });
    }

    // Если SVG совсем не загрузился
    mapObject.addEventListener('error', () => {
      if (messageEl) {
        messageEl.textContent =
          'Не удалось загрузить SVG-карту. Список систем доступен ниже.';
      }
      renderAllSystems();
    });
  }

  window.initWorldMap = initWorldMap;
})();
