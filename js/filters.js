// Фильтрация списков трамвайных систем и вагонов

(function () {
  'use strict';

  /**
   * Создаёт debounce-обёртку для функции
   * (откладывает вызов, пока пользователь не перестанет печатать)
   */
  function debounce(func, wait) {
    var timeout;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        func.apply(context, args);
      }, wait);
    };
  }

  /**
   * Инициализация фильтров для страницы систем (systems.html)
   * 
   * @param {Array} systems - массив всех систем из JSON
   * @param {Function} onRender - функция для отрисовки отфильтрованного списка
   * @param {Function} onCount - функция для обновления счётчика (опционально)
   */
  function initSystemFilters(systems, onRender, onCount) {
    var filterCountry = document.getElementById('filter-country');
    var filterCity = document.getElementById('filter-city');
    var filterStatus = document.getElementById('filter-status');
    var resetBtn = document.getElementById('filters-reset');

    if (!filterCountry && !filterCity && !filterStatus) {
      console.log('Фильтры: элементы фильтров не найдены на странице');
      return;
    }

    // Заполняем список стран
    if (filterCountry) {
      var countries = [];
      systems.forEach(function (system) {
        if (system.country && countries.indexOf(system.country) === -1) {
          countries.push(system.country);
        }
      });
      countries.sort(function (a, b) {
        return a.localeCompare(b, 'ru');
      });

      // Очищаем и заполняем select
      filterCountry.innerHTML = '<option value="">Все страны</option>';
      countries.forEach(function (country) {
        var option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        filterCountry.appendChild(option);
      });
    }

    // Функция фильтрации
    function applyFilters() {
      var selectedCountry = filterCountry ? filterCountry.value : '';
      var cityQuery = filterCity ? filterCity.value.toLowerCase().trim() : '';
      var selectedStatus = filterStatus ? filterStatus.value : '';

      var filtered = systems.filter(function (system) {
        // Фильтр по стране
        if (selectedCountry && system.country !== selectedCountry) {
          return false;
        }

        // Фильтр по городу (поиск по подстроке)
        if (cityQuery && system.city.toLowerCase().indexOf(cityQuery) === -1) {
          return false;
        }

        // Фильтр по статусу
        if (selectedStatus && system.status !== selectedStatus) {
          return false;
        }

        return true;
      });

      // Вызываем функцию отрисовки
      if (onRender) {
        onRender(filtered);
      }

      // Обновляем счётчик
      if (onCount) {
        onCount(filtered.length, systems.length);
      }
    }

    // Навешиваем обработчики
    if (filterCountry) {
      filterCountry.addEventListener('change', applyFilters);
    }

    if (filterCity) {
      // Для текстового поля используем debounce (300мс задержка)
      filterCity.addEventListener('input', debounce(applyFilters, 300));
    }

    if (filterStatus) {
      filterStatus.addEventListener('change', applyFilters);
    }

    // Кнопка сброса фильтров
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (filterCountry) filterCountry.value = '';
        if (filterCity) filterCity.value = '';
        if (filterStatus) filterStatus.value = '';
        applyFilters();
      });
    }

    console.log('Фильтры систем: инициализированы');
  }

  /**
   * Инициализация фильтров для страницы вагонов (vehicles.html)
   * 
   * @param {Array} vehicles - массив всех вагонов из JSON
   * @param {Function} onRender - функция для отрисовки отфильтрованного списка
   * @param {Function} onCount - функция для обновления счётчика (опционально)
   */
  function initVehicleFilters(vehicles, onRender, onCount) {
    var filterManufacturer = document.getElementById('filter-manufacturer');
    var filterCountry = document.getElementById('filter-country');
    var filterFloorType = document.getElementById('filter-floor-type');
    var filterSections = document.getElementById('filter-sections');
    var resetBtn = document.getElementById('filters-reset');

    if (!filterManufacturer && !filterCountry && !filterFloorType && !filterSections) {
      console.log('Фильтры: элементы фильтров вагонов не найдены');
      return;
    }

    // Заполняем список производителей
    if (filterManufacturer) {
      var manufacturers = [];
      vehicles.forEach(function (vehicle) {
        if (vehicle.manufacturer && manufacturers.indexOf(vehicle.manufacturer) === -1) {
          manufacturers.push(vehicle.manufacturer);
        }
      });
      manufacturers.sort(function (a, b) {
        return a.localeCompare(b, 'ru');
      });

      filterManufacturer.innerHTML = '<option value="">Все производители</option>';
      manufacturers.forEach(function (manufacturer) {
        var option = document.createElement('option');
        option.value = manufacturer;
        option.textContent = manufacturer;
        filterManufacturer.appendChild(option);
      });
    }

    // Заполняем список стран производства
    if (filterCountry) {
      var countries = [];
      vehicles.forEach(function (vehicle) {
        if (vehicle.country && countries.indexOf(vehicle.country) === -1) {
          countries.push(vehicle.country);
        }
      });
      countries.sort(function (a, b) {
        return a.localeCompare(b, 'ru');
      });

      filterCountry.innerHTML = '<option value="">Все страны</option>';
      countries.forEach(function (country) {
        var option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        filterCountry.appendChild(option);
      });
    }

    // Функция фильтрации
    function applyFilters() {
      var selectedManufacturer = filterManufacturer ? filterManufacturer.value : '';
      var selectedCountry = filterCountry ? filterCountry.value : '';
      var selectedFloorType = filterFloorType ? filterFloorType.value : '';
      var selectedSections = filterSections ? filterSections.value : '';

      var filtered = vehicles.filter(function (vehicle) {
        // Фильтр по производителю
        if (selectedManufacturer && vehicle.manufacturer !== selectedManufacturer) {
          return false;
        }

        // Фильтр по стране производства
        if (selectedCountry && vehicle.country !== selectedCountry) {
          return false;
        }

        // Фильтр по типу пола
        if (selectedFloorType && vehicle.floorType !== selectedFloorType) {
          return false;
        }

        // Фильтр по количеству секций
        if (selectedSections) {
          var sections = parseInt(selectedSections, 10);
          if (vehicle.sections !== sections) {
            return false;
          }
        }

        return true;
      });

      // Вызываем функцию отрисовки
      if (onRender) {
        onRender(filtered);
      }

      // Обновляем счётчик
      if (onCount) {
        onCount(filtered.length, vehicles.length);
      }
    }

    // Навешиваем обработчики
    if (filterManufacturer) {
      filterManufacturer.addEventListener('change', applyFilters);
    }

    if (filterCountry) {
      filterCountry.addEventListener('change', applyFilters);
    }

    if (filterFloorType) {
      filterFloorType.addEventListener('change', applyFilters);
    }

    if (filterSections) {
      filterSections.addEventListener('change', applyFilters);
    }

    // Кнопка сброса фильтров
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (filterManufacturer) filterManufacturer.value = '';
        if (filterCountry) filterCountry.value = '';
        if (filterFloorType) filterFloorType.value = '';
        if (filterSections) filterSections.value = '';
        applyFilters();
      });
    }

    console.log('Фильтры вагонов: инициализированы');
  }

  // Экспортируем функции глобально
  window.TramFilters = {
    initSystemFilters: initSystemFilters,
    initVehicleFilters: initVehicleFilters
  };

})();
