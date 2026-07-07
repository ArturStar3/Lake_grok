(function () {
  function toggleMinElevation() {
    const zoneMode = document.querySelector('#id_zone_mode');
    const minElevationRow = document.querySelector('.field-min_elevation_deg');
    if (!zoneMode || !minElevationRow) return;
    const show = zoneMode.value === 'los_radar';
    minElevationRow.style.display = show ? '' : 'none';
    if (!show) {
      const input = document.querySelector('#id_min_elevation_deg');
      if (input) input.value = '';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const zoneMode = document.querySelector('#id_zone_mode');
    if (zoneMode) {
      zoneMode.addEventListener('change', toggleMinElevation);
    }
    toggleMinElevation();
  });
})();
