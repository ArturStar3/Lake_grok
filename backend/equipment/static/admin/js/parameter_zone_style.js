(function () {
  function setFieldDisabled(input, disabled) {
    if (!input) return;
    input.disabled = disabled;
    input.closest('.field-zone_color, .field-zone_line_type')
      ?.classList.toggle('equipment-parameter-zone-style--inherited', disabled);
  }

  function toggleZoneStyleFields() {
    const inheritColor = document.querySelector('#id_inherit_zone_color');
    const inheritLine = document.querySelector('#id_inherit_zone_line_type');
    const colorInput = document.querySelector('#id_zone_color');
    const lineInput = document.querySelector('#id_zone_line_type');

    setFieldDisabled(colorInput, Boolean(inheritColor?.checked));
    setFieldDisabled(lineInput, Boolean(inheritLine?.checked));
  }

  function toggleZoneStyleSection() {
    const actionType = document.querySelector('#id_action_type');
    const section = document.querySelector('.equipment-parameter-zone-style');
    if (!actionType || !section) return;

    const hasActionType = Boolean(actionType.value);
    section.style.display = hasActionType ? '' : 'none';

    if (!hasActionType) {
      const inheritColor = document.querySelector('#id_inherit_zone_color');
      const inheritLine = document.querySelector('#id_inherit_zone_line_type');
      if (inheritColor) inheritColor.checked = true;
      if (inheritLine) inheritLine.checked = true;
    }

    toggleZoneStyleFields();
  }

  function bindZoneStyleAdmin() {
    const inheritColor = document.querySelector('#id_inherit_zone_color');
    const inheritLine = document.querySelector('#id_inherit_zone_line_type');
    const actionType = document.querySelector('#id_action_type');

    if (inheritColor) {
      inheritColor.addEventListener('change', toggleZoneStyleFields);
    }
    if (inheritLine) {
      inheritLine.addEventListener('change', toggleZoneStyleFields);
    }
    if (actionType) {
      actionType.addEventListener('change', toggleZoneStyleSection);
    }

    toggleZoneStyleSection();
  }

  document.addEventListener('DOMContentLoaded', bindZoneStyleAdmin);
})();
