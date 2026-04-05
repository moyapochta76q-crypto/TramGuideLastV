// Основная логика сайта TramGuide
// Навигация, загрузка данных, табы, страницы, кеширование JSON.

(function () {
  'use strict';

  /** ******************************
   * Утилиты
   *********************************/

  /**
   * Загрузка JSON с простым кешированием в localStorage.
   * @param {string} url
   * @param {string} storageKey
   * @returns {Promise<any>}
   */
  async function loadJSON(url, storageKey) {
    // Возможность отключить кеш ?noCache=1
    const urlParams = new URLSearchParams(window.location.search);
    const noCache = urlParams.get('noCache') === '1';

    if (!noCache && window.localStorage && storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {
        console.warn('Не удалось прочитать localStorage:', e);
      }
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки ${url}: ${response.status}`);
    }
    const data = await response.json();

    if (!noCache && window.localStorage && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (e) {
        console.warn('Не удалось записать в localStorage:', e);
      }
    }

    return data;
  }

  /**
   * Установка текущего года в подвале.
   */
  function initCurrentYear() {
    const yearSpans = document.querySelectorAll('.js-current-year');
    const year = new Date().getFullYear();
    yearSpans.forEach(span => {
      span.textContent = year;
    });
  }

  /**
   * Инициализация мобильной навигации (бургер-меню).
   */
  function initNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('main-nav');

    if (!navToggle || !nav) return;

    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Закрытие меню при клике по ссылке
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /**
   * Инициализация аккордеона фильтров на мобильных.
   */
  function initFiltersAccordion() {
    const filterBlocks = document.querySelectorAll('.filters');
    if (!filterBlocks.length) return;

    filterBlocks.forEach(block => {
      const toggle = block.querySelector('.filters-toggle');
      const content = block.querySelector('.filters-content');
      if (!toggle || !content) return;

      toggle.addEventListener('click', () => {
        const isOpen = block.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  /**
   * Табы (вкладки) — общая логика.
   * Сохранение активной вкладки в URL (якорь).
   */
  function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
    if (!tabButtons.length) return;

    const tabContents = document.querySelectorAll('.tab-content');

    function setActiveTab(name, updateUrl = true) {
      tabButtons.forEach(btn => {
        const isActive = btn.dataset.tab === name;
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.tabIndex = isActive ? 0 : -1;
      });

      tabContents.forEach(content => {
        const idSuffix = content.id.replace('tab-', '');
        if (idSuffix === name) {
          content.classList.add('is-active');
        } else {
          content.classList.remove('is-active');
        }
      });

      if (updateUrl) {
        if (window.history && window.history.replaceState) {
          const url = `${window.location.pathname}${window.location.search}#${name}`;
          history.replaceState(null, '', url);
        } else {
          window.location.hash = name;
        }
      }
    }

    // Обработчики кликов по кнопкам табов
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        if (tabName) {
          setActiveTab(tabName);
        }
      });
    });

    // Инициализация активной вкладки из хеша
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const hasTab = Array.from(tabButtons).some(btn => btn.dataset.tab === hash);
      if (hasTab) {
        setActiveTab(hash, false);
        return;
      }
    }

    // По умолчанию активна первая вкладка
    const first = tabButtons[0];
    if (first) {
      setActiveTab(first.dataset.tab, false);
    }
  }

  /**
   * Инициализация лайтбокса для галерей (SimpleLightbox).
   */
  function initLightboxGallery() {
    if (typeof SimpleLightbox === 'undefined') return;
    if (!document.querySelector('.js-lightbox-gallery a')) return;

    // Инициализация по селектору (можно вызывать повторно при обновлении DOM)
    // eslint-disable-next-line no-undef
    new SimpleLightbox('.js-lightbox-gallery a', {
      captions: true,
      captionsData: 'alt',
      captionDelay: 150,
      history: false,
      close: true,
      animationSlide: true
    });
  }

  /**
   * Главная страница: статистика + карта + последние добавления.
   */
  async function initHomePage() {
    try {
      const [systems, vehicles] = await Promise.all([
        loadJSON('data/systems.json', 'tramguide_systems'),
        loadJSON('data/vehicles.json', 'tramguide_vehicles')
      ]);

      updateStats(systems, vehicles);
      renderLatest(systems, vehicles);

      if (typeof window.initWorldMap === 'function') {
        window.initWorldMap(systems);
      }
    } catch (error) {
      console.error(error);
      const msg = document.getElementById('map-message');
      if (msg) {
        msg.textContent = 'Не удалось загрузить данные о трамвайных системах. Попробуйте обновить страницу позже.';
      }
    }
  }

  /**
   * Обновление статистики на главной.
   */
  function updateStats(systems, vehicles) {
    const systemsCountEl = document.getElementById('stat-systems');
    const vehiclesCountEl = document.getElementById('stat-vehicles');
    const countriesCountEl = document.getElementById('stat-countries');

    if (!systems || !vehicles) return;

    const systemsCount = systems.length;
    const vehiclesCount = vehicles.length;

    const countrySet = new Set();
    systems.forEach(sys => {
      if (sys.country) {
        countrySet.add(sys.country);
      }
    });

    if (systemsCountEl) systemsCountEl.textContent = systemsCount.toString();
    if (vehiclesCountEl) vehiclesCountEl.textContent = vehiclesCount.toString();
    if (countriesCountEl) countriesCountEl.textContent = countrySet.size.toString();
  }

  /**
   * Главная: блок "Последние добавления".
   * Для простоты берём последние элементы массивов.
   */
  function renderLatest(systems, vehicles) {
    const latestSystemsEl = document.getElementById('latest-systems');
    const latestVehiclesEl = document.getElementById('latest-vehicles');
    if (!latestSystemsEl || !latestVehiclesEl) return;

    const latestSystems = systems.slice(-3).reverse();
    const latestVehicles = vehicles.slice(-3).reverse();

    latestSystemsEl.innerHTML = latestSystems.map(systemToCardSmall).join('');
    latestVehiclesEl.innerHTML = latestVehicles.map(vehicleToCardSmall).join('');
  }

  function systemToCardSmall(system) {
    const statusClass = system.status === 'действующая' ? 'badge-status--active' : 'badge-status--closed';
    const statusText = system.status === 'действующая' ? 'Действующая' : 'Закрытая';

    const yearsText = system.yearOpened
      ? `${system.yearOpened} — ${system.status === 'действующая' ? 'наст. время' : (system.yearClosed || '—')}`
      : 'Годы работы неизвестны';

    const cover = system.coverImage || 'https://via.placeholder.com/800x600?text=Трамвайная+система';

    return `
      <article class="card system-card">
        <a href="system-detail.html?id=${encodeURIComponent(system.id)}" class="card-image-wrapper">
          <img src="${cover}"
               alt="${system.name}"
               loading="lazy">
        </a>
        <div class="card-body">
          <h3 class="card-title">
            <a href="system-detail.html?id=${encodeURIComponent(system.id)}">${system.name}</a>
          </h3>
          <p class="card-meta">${system.city}, ${system.country}</p>
          <p class="card-meta">${yearsText}</p>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
      </article>
    `;
  }

  function vehicleToCardSmall(vehicle) {
    const img = (vehicle.photos && vehicle.photos[0]) ||
      'https://via.placeholder.com/800x600?text=Трамвайный+вагон';

    return `
      <article class="card vehicle-card">
        <a href="vehicle-detail.html?id=${encodeURIComponent(vehicle.id)}" class="card-image-wrapper">
          <img src="${img}"
               alt="Модель трамвая ${vehicle.model}"
               loading="lazy">
        </a>
        <div class="card-body">
          <h3 class="card-title">
            <a href="vehicle-detail.html?id=${encodeURIComponent(vehicle.id)}">${vehicle.model}</a>
          </h3>
          <p class="card-meta">${vehicle.manufacturer}, ${vehicle.country}</p>
          <p class="card-meta">Годы выпуска: ${vehicle.yearsProduced || '—'}</p>
          <div class="card-tags">
            <span class="tag">Секции: ${vehicle.sections || '—'}</span>
            <span class="tag">${vehicle.floorType || 'Тип пола неизвестен'}</span>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Страница systems.html: каталог трамвайных систем + фильтры.
   */
  async function initSystemsPage() {
    const grid = document.getElementById('systems-grid');
    const countEl = document.getElementById('systems-count');
    const emptyEl = document.getElementById('systems-empty');
    if (!grid || !countEl) return;

    try {
      const systems = await loadJSON('data/systems.json', 'tramguide_systems');

      function render(list) {
        if (!list.length) {
          grid.innerHTML = '';
          if (emptyEl) emptyEl.classList.remove('hidden');
          return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');
        grid.innerHTML = list.map(systemToCardLarge).join('');
      }

      function updateCount(n) {
        countEl.textContent = `Найдено систем: ${n}`;
      }

      render(systems);
      updateCount(systems.length);

      if (window.TramFilters && typeof window.TramFilters.initSystemFilters === 'function') {
        window.TramFilters.initSystemFilters(systems, render, updateCount);
      }

      // Инициализируем карту и на странице каталога систем
      if (typeof window.initWorldMap === 'function') {
        window.initWorldMap(systems);
      }
    } catch (error) {
      console.error(error);
      if (emptyEl) {
        emptyEl.textContent = 'Не удалось загрузить данные о трамвайных системах.';
        emptyEl.classList.remove('hidden');
      }
    }
  }

  function systemToCardLarge(system) {
    const statusClass = system.status === 'действующая' ? 'badge-status--active' : 'badge-status--closed';
    const statusText = system.status === 'действующая' ? 'Действующая' : 'Закрытая';

    const yearsText = system.yearOpened
      ? `${system.yearOpened} — ${system.status === 'действующая' ? 'наст. время' : (system.yearClosed || '—')}`
      : 'Годы работы неизвестны';

    const cover = system.coverImage || 'https://via.placeholder.com/800x600?text=Трамвайная+система';

    return `
      <article class="card system-card">
        <a href="system-detail.html?id=${encodeURIComponent(system.id)}" class="card-image-wrapper">
          <img src="${cover}"
               alt="${system.name}"
               loading="lazy">
        </a>
        <div class="card-body">
          <h3 class="card-title">
            <a href="system-detail.html?id=${encodeURIComponent(system.id)}">${system.name}</a>
          </h3>
          <p class="card-meta">${system.city}, ${system.country}</p>
          <p class="card-meta">${yearsText}</p>
          <div class="card-tags">
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <div style="margin-top: 6px;">
            <a href="system-detail.html?id=${encodeURIComponent(system.id)}" class="btn btn-sm btn-primary">Подробнее</a>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Страница vehicles.html: каталог вагонов + фильтры.
   */
  async function initVehiclesPage() {
    const grid = document.getElementById('vehicles-grid');
    const countEl = document.getElementById('vehicles-count');
    const emptyEl = document.getElementById('vehicles-empty');
    if (!grid || !countEl) return;

    try {
      const vehicles = await loadJSON('data/vehicles.json', 'tramguide_vehicles');

      function render(list) {
        if (!list.length) {
          grid.innerHTML = '';
          if (emptyEl) emptyEl.classList.remove('hidden');
          return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');
        grid.innerHTML = list.map(vehicleToCardLarge).join('');
      }

      function updateCount(n) {
        countEl.textContent = `Найдено вагонов: ${n}`;
      }

      render(vehicles);
      updateCount(vehicles.length);

      if (window.TramFilters && typeof window.TramFilters.initVehicleFilters === 'function') {
        window.TramFilters.initVehicleFilters(vehicles, render, updateCount);
      }
    } catch (error) {
      console.error(error);
      if (emptyEl) {
        emptyEl.textContent = 'Не удалось загрузить данные о вагонах.';
        emptyEl.classList.remove('hidden');
      }
    }
  }

  function vehicleToCardLarge(vehicle) {
    const img = (vehicle.photos && vehicle.photos[0]) ||
      'https://via.placeholder.com/800x600?text=Трамвайный+вагон';

    const floorLabel = vehicle.floorType || 'Тип пола неизвестен';
    const sectionsLabel = vehicle.sections ? `${vehicle.sections} секц.` : 'Секции: —';

    return `
      <article class="card vehicle-card">
        <a href="vehicle-detail.html?id=${encodeURIComponent(vehicle.id)}" class="card-image-wrapper">
          <img src="${img}"
               alt="Модель трамвая ${vehicle.model}"
               loading="lazy">
        </a>
        <div class="card-body">
          <h3 class="card-title">
            <a href="vehicle-detail.html?id=${encodeURIComponent(vehicle.id)}">${vehicle.model}</a>
          </h3>
          <p class="card-meta">${vehicle.manufacturer}, ${vehicle.country}</p>
          <p class="card-meta">Годы выпуска: ${vehicle.yearsProduced || '—'}</p>
          <div class="card-tags">
            <span class="tag">Секции: ${sectionsLabel}</span>
            <span class="tag">${floorLabel}</span>
          </div>
          <div style="margin-top: 6px;">
            <a href="vehicle-detail.html?id=${encodeURIComponent(vehicle.id)}" class="btn btn-sm btn-primary">Подробнее</a>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Страница system-detail.html.
   */
  async function initSystemDetailPage() {
    const params = new URLSearchParams(window.location.search);
    const systemId = params.get('id');
    const messageEl = document.getElementById('system-message');

    if (!systemId) {
      if (messageEl) {
        messageEl.textContent = 'Идентификатор трамвайной системы не указан.';
        messageEl.classList.remove('hidden');
      }
      return;
    }

    try {
      const [systems, vehicles] = await Promise.all([
        loadJSON('data/systems.json', 'tramguide_systems'),
        loadJSON('data/vehicles.json', 'tramguide_vehicles')
      ]);

      const system = systems.find(sys => sys.id === systemId);
      if (!system) {
        if (messageEl) {
          messageEl.textContent = 'Трамвайная система не найдена.';
          messageEl.classList.remove('hidden');
        }
        return;
      }

      fillSystemDetails(system, vehicles);
      initTabs();
      initLightboxGallery();
    } catch (error) {
      console.error(error);
      if (messageEl) {
        messageEl.textContent = 'Не удалось загрузить данные о трамвайной системе.';
        messageEl.classList.remove('hidden');
      }
    }
  }

  function fillSystemDetails(system, vehicles) {
    const titleEl = document.getElementById('system-title');
    const subtitleEl = document.getElementById('system-subtitle');

    const coverEl = document.getElementById('system-cover');
    const countryEl = document.getElementById('system-country');
    const cityEl = document.getElementById('system-city');
    const yearOpenedEl = document.getElementById('system-year-opened');
    const yearClosedEl = document.getElementById('system-year-closed');
    const statusEl = document.getElementById('system-status');
    const trackLengthEl = document.getElementById('system-track-length');
    const gaugeTypeEl = document.getElementById('system-gauge-type');
    const routesEl = document.getElementById('system-routes');
    const vehiclesEl = document.getElementById('system-vehicles');
    const operatorEl = document.getElementById('system-operator');

    const historyContentEl = document.getElementById('system-history-content');
    const schemeContentEl = document.getElementById('system-scheme-content');
    const galleryContentEl = document.getElementById('system-gallery-content');
    const rollingContentEl = document.getElementById('system-rollingstock-content');
    const descContentEl = document.getElementById('system-description-content');

    if (titleEl) titleEl.textContent = system.name;
    if (subtitleEl) {
      subtitleEl.textContent = `${system.city || 'Город не указан'}, ${system.country || 'Страна не указана'}`;
    }

    if (coverEl) {
      const src = system.coverImage ||
        'https://via.placeholder.com/800x600?text=Трамвайная+система';
      coverEl.src = src;
      coverEl.alt = system.name;
    }

    if (countryEl) countryEl.textContent = system.country || '—';
    if (cityEl) cityEl.textContent = system.city || '—';
    if (yearOpenedEl) yearOpenedEl.textContent = system.yearOpened || '—';
    if (yearClosedEl) yearClosedEl.textContent = system.yearClosed || '—';
    if (statusEl) statusEl.textContent = system.status || '—';

    if (trackLengthEl) {
      trackLengthEl.textContent = system.trackLength != null
        ? `${system.trackLength} км`
        : '—';
    }

    if (gaugeTypeEl) {
      gaugeTypeEl.textContent = system.gaugeType != null
        ? `${system.gaugeType} мм`
        : '—';
    }

    if (routesEl) {
      routesEl.textContent = system.numberOfRoutes != null ? String(system.numberOfRoutes) : '—';
    }

    if (vehiclesEl) {
      vehiclesEl.textContent = system.numberOfVehicles != null ? String(system.numberOfVehicles) : '—';
    }

    if (operatorEl) operatorEl.textContent = system.operator || '—';

    // История
    if (historyContentEl) {
      if (system.history) {
        // Допускаем простой HTML в истории
        historyContentEl.innerHTML = `<p>${system.history}</p>`;
      } else {
        historyContentEl.textContent = 'Историческое описание скоро появится.';
      }
    }

    // Схема
    if (schemeContentEl) {
      if (system.schemeImage) {
        schemeContentEl.innerHTML = `
          <img src="${system.schemeImage}"
               alt="Схема линий трамвайной системы ${system.name}"
               loading="lazy">
        `;
      } else {
        schemeContentEl.textContent = 'Схема в разработке.';
      }
    }

    // Галерея
    if (galleryContentEl) {
      if (system.photos && system.photos.length) {
        const items = system.photos.map((url, index) => `
          <a href="${url}"
             class="gallery-item"
             aria-label="Фотография ${index + 1} системы ${system.name}">
            <img src="${url}" alt="Трамвайная система ${system.name}, фото ${index + 1}" loading="lazy">
          </a>
        `).join('');
        galleryContentEl.innerHTML = `
          <div class="gallery-grid js-lightbox-gallery">
            ${items}
          </div>
        `;
      } else {
        galleryContentEl.textContent = 'Фотографии в процессе добавления.';
      }
    }

    // Подвижной состав
    if (rollingContentEl) {
      if (system.rollingStock && system.rollingStock.length) {
        const byId = new Map(vehicles.map(v => [v.id, v]));
        const cards = system.rollingStock.map(id => byId.get(id)).filter(Boolean);

        if (cards.length) {
          rollingContentEl.innerHTML = `
            <div class="card-grid">
              ${cards.map(v => `
                <article class="card vehicle-card">
                  <a href="vehicle-detail.html?id=${encodeURIComponent(v.id)}" class="card-image-wrapper">
                    <img src="${(v.photos && v.photos[0]) || 'https://via.placeholder.com/800x600?text=Трамвайный+вагон'}"
                         alt="Модель трамвая ${v.model}"
                         loading="lazy">
                  </a>
                  <div class="card-body">
                    <h3 class="card-title">
                      <a href="vehicle-detail.html?id=${encodeURIComponent(v.id)}">${v.model}</a>
                    </h3>
                    <p class="card-meta">${v.manufacturer}, ${v.country}</p>
                    <p class="card-meta">Годы выпуска: ${v.yearsProduced || '—'}</p>
                  </div>
                </article>
              `).join('')}
            </div>
          `;
        } else {
          rollingContentEl.textContent = 'Информация о подвижном составе скоро появится.';
        }
      } else {
        rollingContentEl.textContent = 'Информация о подвижном составе скоро появится.';
      }
    }

    // Описание системы
    if (descContentEl) {
      const parts = [];
      parts.push(`<p><strong>${system.name}</strong> — трамвайная система в городе ${system.city || 'не указан'}, ${system.country || 'не указана'}.</p>`);

      if (system.description) {
        parts.push(`<p>${system.description}</p>`);
      }

      // Краткое повторение характеристик для мобильных
      const lines = [];
      if (system.yearOpened) {
        lines.push(`Год открытия: ${system.yearOpened}`);
      }
      if (system.yearClosed) {
        lines.push(`Год закрытия: ${system.yearClosed}`);
      }
      if (system.status) {
        lines.push(`Статус: ${system.status}`);
      }
      if (system.trackLength) {
        lines.push(`Длина путей: ${system.trackLength} км`);
      }
      if (system.gaugeType) {
        lines.push(`Колея: ${system.gaugeType} мм`);
      }

      if (lines.length) {
        parts.push('<ul>' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>');
      }

      descContentEl.innerHTML = parts.join('');
    }
  }

  /**
   * Страница vehicle-detail.html.
   */
  async function initVehicleDetailPage() {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get('id');
    const messageEl = document.getElementById('vehicle-message');

    if (!vehicleId) {
      if (messageEl) {
        messageEl.textContent = 'Идентификатор модели вагона не указан.';
        messageEl.classList.remove('hidden');
      }
      return;
    }

    try {
      const [vehicles, systems] = await Promise.all([
        loadJSON('data/vehicles.json', 'tramguide_vehicles'),
        loadJSON('data/systems.json', 'tramguide_systems')
      ]);

      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) {
        if (messageEl) {
          messageEl.textContent = 'Модель вагона не найдена.';
          messageEl.classList.remove('hidden');
        }
        return;
      }

      fillVehicleDetails(vehicle, systems);
      initLightboxGallery();
    } catch (error) {
      console.error(error);
      if (messageEl) {
        messageEl.textContent = 'Не удалось загрузить данные о модели вагона.';
        messageEl.classList.remove('hidden');
      }
    }
  }

  function fillVehicleDetails(vehicle, systems) {
    const titleEl = document.getElementById('vehicle-title');
    const subtitleEl = document.getElementById('vehicle-subtitle');

    const mainLinkEl = document.getElementById('vehicle-main-link');
    const mainPhotoEl = document.getElementById('vehicle-main-photo');
    const thumbsEl = document.getElementById('vehicle-thumbs');
    const fullscreenBtn = document.getElementById('vehicle-fullscreen-btn');

    const manufacturerEl = document.getElementById('vehicle-manufacturer');
    const countryEl = document.getElementById('vehicle-country');
    const yearsEl = document.getElementById('vehicle-years');
    const totalProducedEl = document.getElementById('vehicle-total-produced');
    const lengthEl = document.getElementById('vehicle-length');
    const widthEl = document.getElementById('vehicle-width');
    const sectionsEl = document.getElementById('vehicle-sections');
    const capacityEl = document.getElementById('vehicle-capacity');
    const seatingEl = document.getElementById('vehicle-seating');
    const floorTypeEl = document.getElementById('vehicle-floor-type');
    const powerTypeEl = document.getElementById('vehicle-power-type');
    const maxSpeedEl = document.getElementById('vehicle-max-speed');

    const operationsEl = document.getElementById('vehicle-operates');

    if (titleEl) titleEl.textContent = vehicle.model;
    if (subtitleEl) {
      subtitleEl.textContent = `${vehicle.manufacturer || 'Производитель не указан'} • ${vehicle.country || 'Страна не указана'} • ${vehicle.yearsProduced || 'Годы выпуска неизвестны'}`;
    }

    // Галерея
    const photos = vehicle.photos && vehicle.photos.length
      ? vehicle.photos
      : ['https://via.placeholder.com/800x600?text=Трамвайный+вагон'];

    const firstPhoto = photos[0];

    if (mainPhotoEl) {
      mainPhotoEl.src = firstPhoto;
      mainPhotoEl.alt = `Модель трамвая ${vehicle.model}`;
    }
    if (mainLinkEl) {
      mainLinkEl.href = firstPhoto;
    }

    if (thumbsEl) {
      thumbsEl.innerHTML = photos.map((url, index) => `
        <a href="${url}" class="${index === 0 ? 'is-active' : ''}" data-index="${index}">
          <img src="${url}" alt="Миниатюра ${index + 1} модели ${vehicle.model}" loading="lazy">
        </a>
      `).join('');

      thumbsEl.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link) return;
        event.preventDefault();

        const url = link.getAttribute('href');
        if (mainPhotoEl) mainPhotoEl.src = url;
        if (mainLinkEl) mainLinkEl.href = url;

        // Подсветка активной миниатюры
        thumbsEl.querySelectorAll('a').forEach(a => a.classList.remove('is-active'));
        link.classList.add('is-active');
      });
    }

    if (fullscreenBtn && thumbsEl) {
      fullscreenBtn.addEventListener('click', () => {
        const activeThumb = thumbsEl.querySelector('a.is-active') || thumbsEl.querySelector('a');
        if (activeThumb) {
          activeThumb.click(); // Откроет SimpleLightbox (после initLightboxGallery)
        }
      });
    }

    // Характеристики
    if (manufacturerEl) manufacturerEl.textContent = vehicle.manufacturer || '—';
    if (countryEl) countryEl.textContent = vehicle.country || '—';
    if (yearsEl) yearsEl.textContent = vehicle.yearsProduced || '—';
    if (totalProducedEl) {
      totalProducedEl.textContent = vehicle.totalProduced != null ? String(vehicle.totalProduced) : '—';
    }
    if (lengthEl) {
      lengthEl.textContent = vehicle.length != null ? `${vehicle.length} м` : '—';
    }
    if (widthEl) {
      widthEl.textContent = vehicle.width != null ? `${vehicle.width} м` : '—';
    }
    if (sectionsEl) {
      sectionsEl.textContent = vehicle.sections != null ? String(vehicle.sections) : '—';
    }
    if (capacityEl) {
      capacityEl.textContent = vehicle.capacity != null ? String(vehicle.capacity) : '—';
    }
    if (seatingEl) {
      seatingEl.textContent = vehicle.seatingCapacity != null ? String(vehicle.seatingCapacity) : '—';
    }
    if (floorTypeEl) floorTypeEl.textContent = vehicle.floorType || '—';
    if (powerTypeEl) powerTypeEl.textContent = vehicle.powerType || '—';
    if (maxSpeedEl) {
      maxSpeedEl.textContent = vehicle.maxSpeed != null ? `${vehicle.maxSpeed} км/ч` : '—';
    }

    // Где эксплуатируется
    if (operationsEl) {
      if (vehicle.operatesIn && vehicle.operatesIn.length) {
        const byId = new Map(systems.map(s => [s.id, s]));
        const items = vehicle.operatesIn
          .map(id => byId.get(id))
          .filter(Boolean)
          .map(system => `
            <li>
              🌍 <a href="system-detail.html?id=${encodeURIComponent(system.id)}">
                ${system.city}, ${system.country} — ${system.name}
              </a>
            </li>
          `);

        if (items.length) {
          operationsEl.innerHTML = items.join('');
        } else {
          operationsEl.innerHTML = '<li>Информация о системах эксплуатации скоро появится.</li>';
        }
      } else {
        operationsEl.innerHTML = '<li>Информация о системах эксплуатации скоро появится.</li>';
      }
    }
  }

  /**
   * Инициализация при загрузке DOM.
   */
  document.addEventListener('DOMContentLoaded', () => {
    initCurrentYear();
    initNavigation();
    initFiltersAccordion();

    const page = document.body.dataset.page;

    switch (page) {
      case 'home':
        initHomePage();
        break;
      case 'systems-list':
        initSystemsPage();
        break;
      case 'system-detail':
        initSystemDetailPage();
        break;
      case 'vehicles-list':
        initVehiclesPage();
        break;
      case 'vehicle-detail':
        initVehicleDetailPage();
        break;
      default:
        // Страница без специальной логики
        break;
    }

    // Для страниц с табами (system-detail)
    if (page === 'system-detail') {
      initTabs();
    }
  });
})();
