"""Small, explicit rendering policy for local Markdown and SVG content."""

from html import escape
from html.parser import HTMLParser
import re
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

from django.core.exceptions import ValidationError

_HTML_TAGS = frozenset('p br hr h1 h2 h3 h4 h5 h6 strong em b i del s blockquote pre code ul ol li table thead tbody tfoot tr th td a img div span sup sub dl dt dd'.split())
_VOID = frozenset(('br', 'hr', 'img'))
_DROP = frozenset(('script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template'))


def _safe_url(value, *, image=False):
    if not value or any(ord(char) < 32 for char in value) or '\\' in value:
        return False
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    if image:
        return not parsed.scheme and not parsed.netloc and parsed.path.startswith(('/media/', '/static/'))
    return parsed.scheme.lower() in ('', 'http', 'https', 'mailto') and not value.startswith('//')


class _HTMLPolicy(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.blocked = []

    def handle_starttag(self, tag, attrs):
        if self.blocked or tag in _DROP:
            if tag not in _VOID and tag not in ('embed', 'input', 'meta', 'link'):
                self.blocked.append(tag)
            return
        if tag not in _HTML_TAGS:
            return
        safe = []
        for name, value in attrs:
            if value is None:
                continue
            if name in ('title', 'alt') or (name == 'class' and re.fullmatch(r'[\w -]+', value)):
                safe.append((name, value))
            elif tag == 'a' and name == 'href' and _safe_url(value):
                safe.append((name, value))
            elif tag == 'img' and name == 'src' and _safe_url(value, image=True):
                safe.append((name, value))
            elif name in ('colspan', 'rowspan', 'start') and re.fullmatch(r'[0-9]{1,4}', value) and int(value) <= 1000:
                safe.append((name, value))
        if tag == 'img' and not any(name == 'src' for name, _ in safe):
            return
        attributes = ''.join(f' {name}="{escape(value, quote=True)}"' for name, value in safe)
        self.output.append(f'<{tag}{attributes}>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in _VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.blocked:
            if tag in self.blocked:
                index = len(self.blocked) - 1 - self.blocked[::-1].index(tag)
                del self.blocked[index:]
            return
        if tag in _HTML_TAGS and tag not in _VOID:
            self.output.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.blocked:
            self.output.append(escape(data, quote=False))


def sanitize_html(value):
    parser = _HTMLPolicy()
    parser.feed(str(value))
    parser.close()
    return ''.join(parser.output)


SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
_SVG_TAGS = frozenset('svg g defs path rect circle ellipse line polyline polygon text tspan title desc use symbol linearGradient radialGradient stop clipPath mask pattern filter feGaussianBlur feOffset feBlend feColorMatrix feComposite feFlood feMerge feMergeNode'.split())
_CSS_PROPERTIES = frozenset('fill stroke stroke-width opacity fill-opacity stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-miterlimit fill-rule clip-rule clip-path mask filter font-size font-family font-weight font-style text-anchor dominant-baseline text-decoration letter-spacing word-spacing display visibility stop-color stop-opacity vector-effect paint-order shape-rendering color-rendering overflow'.split())


def _safe_css(value):
    if '\\' in value or '@' in value or re.search(r'expression|javascript|data:|https?:|file:', value, re.I):
        raise ValidationError('SVG содержит небезопасный стиль')
    for ref in re.findall(r'url\s*\((.*?)\)', value, re.I):
        if not re.fullmatch(r'[\s\'\"]*#[\w.-]+[\s\'\"]*', ref):
            raise ValidationError('В SVG разрешены только внутренние ссылки')
    for declaration in value.split(';'):
        if not declaration.strip():
            continue
        prop, sep, content = declaration.partition(':')
        if not sep or prop.strip().lower() not in _CSS_PROPERTIES or '<' in content or '>' in content:
            raise ValidationError('SVG содержит неподдерживаемый стиль')
    return value


def safe_svg(value):
    """Return static SVG, converting simple class/id styles to inline styles."""
    if isinstance(value, bytes):
        try:
            value = value.decode('utf-8-sig')
        except UnicodeError as exc:
            raise ValidationError('SVG должен быть в кодировке UTF-8') from exc
    if len(value.encode('utf-8')) > 2 * 1024 * 1024 or re.search(r'<!DOCTYPE|<!ENTITY', value, re.I):
        raise ValidationError('SVG слишком большой или содержит объявления XML')
    try:
        root = ET.fromstring(value)
    except ET.ParseError as exc:
        raise ValidationError('Некорректный SVG') from exc
    if root.tag not in ('svg', f'{{{SVG_NAMESPACE}}}svg'):
        raise ValidationError('Файл не является SVG')
    nodes = list(root.iter())
    if len(nodes) > 10000:
        raise ValidationError('SVG содержит слишком много элементов')
    selectors_seen = 0
    for parent in nodes:
        for child in list(parent):
            if child.tag in ('metadata', f'{{{SVG_NAMESPACE}}}metadata', '{http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd}namedview'):
                parent.remove(child)
                continue
            if child.tag in ('style', f'{{{SVG_NAMESPACE}}}style'):
                css = re.sub(r'/\*.*?\*/', '', child.text or '', flags=re.S)
                rules = list(re.finditer(r'([^{}]+)\{([^{}]*)\}', css))
                remaining = re.sub(r'[^{}]+\{[^{}]*\}', '', css).strip()
                if remaining:
                    raise ValidationError('Неподдерживаемая таблица стилей SVG')
                for rule in rules:
                    declarations = _safe_css(rule.group(2).strip())
                    for selector in rule.group(1).split(','):
                        selectors_seen += 1
                        if selectors_seen > 256:
                            raise ValidationError('Слишком много селекторов в SVG')
                        selector = selector.strip()
                        if not re.fullmatch(r'[.#][\w-]+', selector):
                            raise ValidationError('Стили SVG должны использовать классы или id')
                        for node in nodes:
                            matches = (selector[1:] in node.get('class', '').split()) if selector[0] == '.' else node.get('id') == selector[1:]
                            if matches:
                                node.set('style', declarations + ';' + node.get('style', ''))
                parent.remove(child)
    for node in root.iter():
        namespace, _, tag = node.tag[1:].partition('}') if node.tag.startswith('{') else ('', '', node.tag)
        if namespace not in ('', SVG_NAMESPACE) or tag not in _SVG_TAGS:
            raise ValidationError('SVG содержит активный или неподдерживаемый элемент')
        for attr, content in node.attrib.items():
            local = attr.split('}')[-1].lower()
            if '\\' in content or '/*' in content:
                raise ValidationError('SVG содержит неподдерживаемые CSS escape/comment конструкции')
            if local.startswith('on') or local in ('base', 'src'):
                raise ValidationError('SVG содержит активный атрибут')
            if local == 'href' and not re.fullmatch(r'#[\w.-]+', content):
                raise ValidationError('В SVG разрешены только внутренние ссылки')
            if local == 'style':
                _safe_css(content)
            elif re.search(r'url\s*\(', content, re.I):
                _safe_css('fill:' + content)
        if not namespace:
            node.tag = f'{{{SVG_NAMESPACE}}}{tag}'
    ET.register_namespace('', SVG_NAMESPACE)
    return ET.tostring(root, encoding='unicode')
