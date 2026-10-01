import uuid

from django.db import models


class DemoStepTool(models.TextChoices):
    CAMERA = 'camera', 'Камера'
    OBJECTS = 'objects', 'Объекты'
    EVENTS = 'events', 'События'
    ZONES = 'zones', 'Зоны действия'
    INUNDATION = 'inundation', 'Зоны затопления'
    SITUATIONS = 'situations', 'Оперативная обстановка'
    LAYERS = 'layers', 'Слои карты'
    FORMULAR = 'formular', 'Формуляр объекта'
    COUNTRY = 'country', 'Справка по стране'
    TEXT = 'text', 'Текст на карте'
    MOSAIC = 'mosaic', 'Мультиэкран'


class DemoStepStartMode(models.TextChoices):
    ON_CLICK = 'on_click', 'Новый такт'
    AFTER_PREVIOUS = 'after_previous', 'После предыдущего'
    WITH_PREVIOUS = 'with_previous', 'Вместе с предыдущим'


class DemoStepEffect(models.TextChoices):
    NONE = 'none', 'Без анимации'
    FADE_IN = 'fade_in', 'Проявление'
    REVEAL_FROM_CENTER = 'reveal_from_center', 'Раскрытие от центра'
    BLINK = 'blink', 'Мигание'
    FLICKER = 'flicker', 'Мерцание'
    GLOW = 'glow', 'Свечение'
    COLOR_SHIFT = 'color_shift', 'Переливание цвета'
    SWAY = 'sway', 'Колыхание'
    STATE_CYCLE = 'state_cycle', 'Смена состояний'
    STATE_OVERLAY = 'state_overlay', 'Наложение состояний'
    DIRECTIONAL_WIPE = 'directional_wipe', 'Направленное появление'


class DemoStepDirection(models.TextChoices):
    LEFT = 'left', 'Слева'
    RIGHT = 'right', 'Справа'
    TOP = 'top', 'Сверху'
    BOTTOM = 'bottom', 'Снизу'


DEFAULT_DEMO_STEP_DURATION_MS = 6000


class DemoScenario(models.Model):
    """Сценарий автоматической демонстрации возможностей карты."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    title = models.CharField(max_length=255, verbose_name='Название')
    description = models.TextField(blank=True, default='', verbose_name='Описание')
    is_default = models.BooleanField(
        default=False,
        verbose_name='Сценарий по умолчанию',
        help_text='Запускается кнопкой быстрого старта демонстрации',
    )
    loop = models.BooleanField(default=True, verbose_name='Зацикливать показ')
    auto_advance = models.BooleanField(
        default=True,
        verbose_name='Автоматически переключать этапы',
        help_text='Если выключено, переход к следующему этапу выполняет докладчик',
    )
    mosaic = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Мультиэкран (JSON)',
        help_text=(
            'presets[{id, title, layout, reveal, screens[{id, label, cue, loop, stage_id, '
            'expand_stage_id, content_type, video_url}]}], active_preset_id'
        ),
    )
    tableau = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Художественный режим (JSON)',
        help_text=(
            'blocks[{id,title,width,height,elements}], '
            'presets[{id,title,cue,variant,stage_id,tilt,gallery,placements,arrows}], active_preset_id'
        ),
    )
    sequence = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Программа показа (JSON)',
        help_text='[{type, stage_id|preset_id, duration_ms, wait_for_presenter, enter, exit}]',
    )
    default_step_duration_ms = models.PositiveIntegerField(
        default=DEFAULT_DEMO_STEP_DURATION_MS,
        verbose_name='Длительность шага по умолчанию, мс',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата изменения')
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_scenarios_created',
        verbose_name='Автор',
    )

    class Meta:
        verbose_name = 'Сценарий демонстрации'
        verbose_name_plural = 'Сценарии демонстрации'
        ordering = ['title']

    def __str__(self):
        return self.title


class DemoTableauMedia(models.Model):
    """Изображение для блоков художественного режима демонстрации."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    image = models.ImageField(
        upload_to='demo_tableau/',
        verbose_name='Изображение',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_tableau_media',
        verbose_name='Автор',
    )

    class Meta:
        verbose_name = 'Медиа художественного режима'
        verbose_name_plural = 'Медиа художественного режима'
        ordering = ['-created_at']

    def __str__(self):
        return str(self.id)


class DemoMosaicMedia(models.Model):
    """Видеофайл для слота мультиэкранной демонстрации."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    video = models.FileField(
        upload_to='demo_mosaic/',
        verbose_name='Видео',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_mosaic_media',
        verbose_name='Автор',
    )

    class Meta:
        verbose_name = 'Видео мультиэкрана'
        verbose_name_plural = 'Видео мультиэкрана'
        ordering = ['-created_at']

    def __str__(self):
        return str(self.id)


class DemoScenarioStage(models.Model):
    """Этап-шаблон вида карты: камера, объекты, текст, анимации."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    scenario = models.ForeignKey(
        DemoScenario,
        on_delete=models.CASCADE,
        related_name='stages',
        verbose_name='Сценарий',
    )
    order = models.PositiveIntegerField(default=0, verbose_name='Порядок')
    title = models.CharField(max_length=255, blank=True, default='', verbose_name='Название этапа')
    cue = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name='Номер позиции',
        help_text='Цифра в углу экрана для докладчика (1–99). Пусто — не показывать.',
    )
    duration_ms = models.PositiveIntegerField(
        default=0,
        verbose_name='Длительность этапа, мс',
        help_text='0 — длительность определяется шагами этапа.',
    )

    class Meta:
        verbose_name = 'Этап сценария демонстрации'
        verbose_name_plural = 'Этапы сценария демонстрации'
        ordering = ['scenario_id', 'order']
        constraints = [
            models.UniqueConstraint(
                fields=('scenario', 'order'),
                name='uniq_demo_scenario_stage_order',
            ),
        ]
        indexes = [
            models.Index(fields=('scenario', 'order')),
        ]

    def __str__(self):
        return self.title or f'Этап {self.order + 1}'


class DemoScenarioStep(models.Model):
    """Шаг сценария демонстрации: что показать, как долго и с какой анимацией."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    scenario = models.ForeignKey(
        DemoScenario,
        on_delete=models.CASCADE,
        related_name='steps',
        verbose_name='Сценарий',
    )
    stage = models.ForeignKey(
        'DemoScenarioStage',
        on_delete=models.CASCADE,
        related_name='steps',
        verbose_name='Этап',
        null=True,
        blank=True,
    )
    order = models.PositiveIntegerField(default=0, verbose_name='Порядок')
    title = models.CharField(max_length=255, blank=True, default='', verbose_name='Название шага')
    tool = models.CharField(
        max_length=20,
        choices=DemoStepTool.choices,
        default=DemoStepTool.CAMERA,
        verbose_name='Инструмент',
    )
    duration_ms = models.PositiveIntegerField(
        default=DEFAULT_DEMO_STEP_DURATION_MS,
        verbose_name='Длительность, мс',
    )
    start_mode = models.CharField(
        max_length=20,
        choices=DemoStepStartMode.choices,
        default=DemoStepStartMode.ON_CLICK,
        verbose_name='Начало',
    )
    hold_previous = models.BooleanField(
        default=False,
        verbose_name='Сохранять содержимое предыдущего шага',
    )
    wait_for_click = models.BooleanField(
        default=False,
        verbose_name='Переход к следующему шагу по щелчку',
    )
    camera = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Камера (JSON)',
        help_text='mode, lat, lng, zoom, duration_ms, ease_linearity, padding',
    )
    selection = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Выбранные элементы (JSON)',
        help_text='target_ids, event_ids, situation_ids, zone_leaves, overlay_layer_ids, country_isos, mosaic_action',
    )
    animation = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Анимация (JSON)',
        help_text='effect, direction, duration_ms, delay_ms, easing, repeat, continuous, state_cycle',
    )
    text = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Текст на карте (JSON)',
        help_text='content, anchor, lat, lng, screen, offset, width, style, enter, exit',
    )
    mosaic = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Мультиэкран этапа (JSON)',
        help_text='slot, loop, label — задаётся на первом шаге этапа (on_click)',
    )

    class Meta:
        verbose_name = 'Шаг сценария демонстрации'
        verbose_name_plural = 'Шаги сценария демонстрации'
        ordering = ['scenario_id', 'stage_id', 'order']
        constraints = [
            models.UniqueConstraint(
                fields=('stage', 'order'),
                name='uniq_demo_scenario_stage_step_order',
            ),
        ]
        indexes = [
            models.Index(fields=('scenario', 'order')),
            models.Index(fields=('stage', 'order')),
        ]

    def __str__(self):
        label = self.title or self.get_tool_display()
        return f'{self.order + 1}. {label}'

