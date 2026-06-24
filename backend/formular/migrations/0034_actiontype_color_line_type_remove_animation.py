from django.db import migrations, models


ANIMATION_TO_STYLE = {
    'gradient': ('solid', '#8b0000'),
    'radar': ('solid', '#00ced1'),
    'wave': ('dashed', '#ff8c00'),
    'pulse': ('dash_dot', '#9370db'),
    'rings': ('dash_dot', '#32cd32'),
    'sector': ('dash_x', '#4682b4'),
    'alert': ('dash_x', '#dc143c'),
    'dashed_rotate': ('dashed', '#ffd700'),
}

DEFAULT_PALETTE = ['#2E86AB', '#A23B72', '#F18F01', '#3A7D44', '#6B4C9A', '#C73E1D']


def migrate_animation_to_style(apps, schema_editor):
    ActionType = apps.get_model('formular', 'ActionType')
    for index, action_type in enumerate(ActionType.objects.all().order_by('id')):
        animation = getattr(action_type, 'animation', None) or 'wave'
        line_type, color = ANIMATION_TO_STYLE.get(
            animation,
            ('solid', DEFAULT_PALETTE[index % len(DEFAULT_PALETTE)]),
        )
        action_type.line_type = line_type
        action_type.color = color
        action_type.save(update_fields=['line_type', 'color'])


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0033_remove_target_formular_ta_branch__22d6ec_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='actiontype',
            name='color',
            field=models.CharField(
                default='#3388ff',
                help_text='Цвет контура и заливки зоны (формат #RRGGBB)',
                max_length=7,
                verbose_name='Цвет зоны',
            ),
        ),
        migrations.AddField(
            model_name='actiontype',
            name='line_type',
            field=models.CharField(
                choices=[
                    ('solid', 'Сплошная линия'),
                    ('dashed', 'Пунктирная линия'),
                    ('dash_dot', 'Тире точка'),
                    ('dash_x', 'Тире X'),
                ],
                default='solid',
                max_length=20,
                verbose_name='Тип линии',
            ),
        ),
        migrations.RunPython(migrate_animation_to_style, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='actiontype',
            name='animation',
        ),
    ]
