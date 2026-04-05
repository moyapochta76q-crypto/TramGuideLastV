// Логика интерактивной карты мира:
// - главная страница (index.html)
// - страница "Трамвайные системы" (systems.html)
//
// Тут:
// 1) Панорамирование и зум через svg-pan-zoom;
// 2) Стартовый вид — увеличенный, с фокусом на Европе (по Германии и Чехии);
// 3) Отключаем прокрутку страницы колёсиком, когда курсор над картой;
// 4) Карта работает и если SVG уже успел загрузиться до вызова initWorldMap.

(function () {
  'use strict';

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

    // Отключаем скролл страницы, когда крутим колёсико над картой
    try {
      mapObject.addEventListener(
        'wheel',
        function (event) {
          event.preventDefault();
        },
        { passive: false }
      );
    } catch (e) {
      // на всякий случай, если браузер не поддерживает passive:false
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
     * Фокус на Европе (по Германии и Чехии).
     * Используем их bounding box, чтобы выставить зум и панорамирование.
     */
    function focusOnEurope(svgDoc) {
      if (!panZoomInstance) return;

      const svgRoot = svgDoc.querySelector('svg');
      if (!svgRoot) return;

      // Страны, по которым считаем границы Европы
      const europeCountries = ['Германия', 'Чехия'];

      let bbox = null;

      europeCountries.forEach(name => {
        const el = svgDoc.querySelector(`.country[data-country="${name}"]`);
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

      if (!bbox) return;

      const width = bbox.x2 - bbox.x1;
      const height = bbox.y2 - bbox.y1;
      const centerX = bbox.x1 + width / 2;
      const centerY = bbox.y1 + height / 2;

      const sizes = panZoomInstance.getSizes();
      const vpWidth = sizes.width;
      const vpHeight = sizes.height;

      // Зум так, чтобы Европа заняла большую часть окна, но с небольшими полями
      const zoom = Math.min(vpWidth / width, vpHeight / height) * 0.9;

      panZoomInstance.zoom(zoom);

      const panX = vpWidth / 2 - centerX * zoom;
      const panY = vpHeight / 2 - centerY * zoom;
      panZoomInstance.pan({ x: panX, y: panY });
    }

    /**
     * Основная инициализация по готовому svg-документу.
     */
    function setupSvg(svgDoc) {
      if (initialized) return;
      initialized = true;

      const svgRoot = svgDoc.querySelector('svg');

      // Подключаем панорамирование и зум, если библиотека svg-pan-zoom загружена
      if (window.svgPanZoom && svgRoot) {
        panZoomInstance = window.svgPanZoom(svgRoot, {
          zoomEnabled: true,
          panEnabled: true,
          controlIconsEnabled: true, // плюс/минус и "домик"
          fit: true,
          center: true,
          minZoom: 0.7,
          maxZoom: 10,
          zoomScaleSensitivity: 0.3,
          dblClickZoomEnabled: true,
          mouseWheelZoomEnabled: true
        });
      }

      // Страны на карте
      const countryPaths = svgDoc.querySelectorAll('.country');
      if (!countryPaths.length && messageEl) {
        messageEl.textContent =
          'SVG-карта загружена, но страны с классом .country не найдены.';
      }

      // Помечаем страны, где есть трамвайные системы
      systemsByCountry.forEach((_value, countryName) => {
        const path = svgDoc.querySelector(
          `.country[data-country="${countryName}"]`
        );
        if (path) {
          path.classList.add('has-trams');
        }
      });

      // Фокусируем стартовый вид на Европе
      if (panZoomInstance) {
        focusOnEurope(svgDoc);
      }

      function clearActive() {
        countryPaths.forEach(path => path.classList.remove('active'));
      }

      function selectCountry(countryName) {
        clearActive();
        const activePath = svgDoc.querySelector(
          `.country[data-country="${countryName}"]`
        );
        if (activePath) {
          activePath.classList.add('active');
        }
        renderCountry(countryName);
        syncFilterCountry(countryName);
      }

      // Навешиваем обработчики на страны
      countryPaths.forEach(path => {
        const countryName = path.getAttribute('data-country') || '';
        if (!countryName) return;

        // Доступность: навигация с клавиатуры
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

        // Сброс масштаба и центра (к виду "всё целиком")
        if (panZoomInstance) {
          panZoomInstance.resetZoom();
          panZoomInstance.center();
        }
      });

      // Первичный список
      renderAllSystems();
      if (messageEl) {
        messageEl.textContent =
          'Выберите страну на карте, чтобы отфильтровать список.';
      }
    }

    /**
     * Пробуем сразу инициализировать, если SVG уже загружен
     * (это как раз случай страницы с системами).
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

    // Если не получилось сразу — ждём событие load
    if (!tryImmediateInit()) {
      mapObject.addEventListener('load', () => {
        try {
          const svgDoc = mapObject.contentDocument;
          if (svgDoc) {
            setupSvg(svgDoc);
          } else {
            if (messageEl) {
              messageEl.textContent = 'Не удалось прочитать содержимое SVG-карты.';
            }
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

    // На случай, если SVG совсем не загрузился
    mapObject.addEventListener('error', () => {
      if (messageEl) {
        messageEl.textContent =
          'Не удалось загрузить SVG-карту. Список систем доступен ниже.';
      }
      renderAllSystems();
    });
  }

  // Экспортируем в глобальный объект
  window.initWorldMap = initWorldMap;
})();
