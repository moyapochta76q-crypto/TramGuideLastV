// Логика интерактивной карты мира: главная страница + страница "Трамвайные системы".

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

    // Системы по стране
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

      return list.map(system => {
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
      }).join('');
    }

    function renderAllSystems() {
      const sorted = [...systems].sort((a, b) =>
        a.city.localeCompare(b.city, 'ru') || a.name.localeCompare(b.name, 'ru')
      );
      titleEl.textContent = 'Все трамвайные системы';
      countEl.textContent = `Всего систем: ${sorted.length}`;
      listEl.innerHTML = systemsListToHTML(sorted);
    }

    function renderCountry(countryName) {
      const list = systemsByCountry.get(countryName) || [];
      const sorted = [...list].sort((a, b) =>
        a.city.localeCompare(b.city, 'ru') || a.name.localeCompare(b.name, 'ru')
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
      // Отправляем событие, чтобы пересчитались карточки и счётчик
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Инициализация после загрузки SVG
    mapObject.addEventListener('load', () => {
      try {
        const svgDoc = mapObject.contentDocument;
        if (!svgDoc) {
          if (messageEl) {
            messageEl.textContent = 'Не удалось получить доступ к SVG-карте.';
          }
          renderAllSystems();
          return;
        }

        // Берём все элементы с классом .country
        const countryPaths = svgDoc.querySelectorAll('.country');
        if (!countryPaths.length && messageEl) {
          messageEl.textContent = 'SVG-карта загружена, но страны с классом .country не найдены.';
        }

        // Помечаем страны, где есть трамвайные системы
        systemsByCountry.forEach((_value, countryName) => {
          const path = svgDoc.querySelector(`.country[data-country="${countryName}"]`);
          if (path) {
            path.classList.add('has-trams');
          }
        });

        function clearActive() {
          countryPaths.forEach(path => path.classList.remove('active'));
        }

        function selectCountry(countryName) {
          clearActive();
          const activePath = svgDoc.querySelector(`.country[data-country="${countryName}"]`);
          if (activePath) {
            activePath.classList.add('active');
          }
          renderCountry(countryName);
          syncFilterCountry(countryName);
        }

        countryPaths.forEach(path => {
          const countryName = path.getAttribute('data-country') || '';
          if (!countryName) return;

          // Делаем страны доступными с клавиатуры
          path.setAttribute('tabindex', '0');
          path.setAttribute('role', 'button');
          path.setAttribute('aria-label', `Страна ${countryName}`);

          path.addEventListener('click', () => {
            selectCountry(countryName);
          });

          path.addEventListener('keydown', (event) => {
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
        });

        // Первичный список
        renderAllSystems();
        if (messageEl) {
          messageEl.textContent = 'Выберите страну на карте, чтобы отфильтровать список.';
        }
      } catch (error) {
        console.error(error);
        if (messageEl) {
          messageEl.textContent = 'Произошла ошибка при инициализации карты.';
        }
        renderAllSystems();
      }
    });

    // На случай, если SVG не загрузился
    mapObject.addEventListener('error', () => {
      if (messageEl) {
        messageEl.textContent = 'Не удалось загрузить SVG-карту. Список систем доступен ниже.';
      }
      renderAllSystems();
    });
  }

  // Экспортируем в глобальный объект
  window.initWorldMap = initWorldMap;
})();
