from django.db import models


class UserStatus(models.TextChoices):
    PENDING = 'pending', 'Ожидает одобрения'
    ACTIVE = 'active', 'Активен'
    BLOCKED = 'blocked', 'Заблокирован'


class ModuleLevel(models.TextChoices):
    NONE = 'none', 'Нет доступа'
    READ = 'read', 'Просмотр'
    WRITE = 'write', 'Редактирование'


MODULE_FIELDS = (
    'targets',
    'events',
    'formular',
    'country_dossier',
    'persons',
    'equipment',
)

LEVEL_RANK = {
    ModuleLevel.NONE: 0,
    ModuleLevel.READ: 1,
    ModuleLevel.WRITE: 2,
}
