from infolake.enums import BaseEnum
from django.db import models

class Colors(BaseEnum):
    """Доступные цвета маркера"""

    blue = 'синий'
    green = 'зеленый'
    red = 'красный'
    yellow = 'желтый'
    marine = 'морской'

class ActionLineTypes(models.TextChoices):
    """Стили линии контура зоны действия"""

    SOLID = 'solid', 'Сплошная линия'
    DASHED = 'dashed', 'Пунктирная линия'
    DASH_DOT = 'dash_dot', 'Тире точка'
    DASH_X = 'dash_x', 'Тире крест'