from django.db import models


class UserStatus(models.TextChoices):
    PENDING = 'pending', 'Ожидает одобрения'
    ACTIVE = 'active', 'Активен'
    BLOCKED = 'blocked', 'Заблокирован'


class ModuleLevel(models.TextChoices):
    NONE = 'none', 'Нет доступа'
    READ = 'read', 'Просмотр'
    WRITE = 'write', 'Редактирование'
    WRITE_DELETE = 'write_delete', 'Редактирование и удаление'


MODULE_FIELDS = (
    'targets',
    'events',
    'operational_situations',
    'formular',
    'country_dossier',
    'persons',
    'equipment',
    'reports',
    'data_exchange',
)

LEVEL_RANK = {
    ModuleLevel.NONE: 0,
    ModuleLevel.READ: 1,
    ModuleLevel.WRITE: 2,
    ModuleLevel.WRITE_DELETE: 3,
}

# Модули, для которых раньше действовал глобальный can_delete
DELETE_CAPABLE_MODULES = (
    'targets',
    'events',
    'operational_situations',
    'persons',
    'reports',
)
