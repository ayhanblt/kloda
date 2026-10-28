"""Host preview of real RN test render trees; not native layout acceptance."""
import json, re, html
from pathlib import Path
base = Path(__file__).parent

def flat(value):
    result = {}
    for item in value if isinstance(value, list) else [value]:
        if isinstance(item, list): result.update(flat(item))
        elif isinstance(item, dict): result.update(item)
    return result

def render(node):
    if node is None: return ''
    if isinstance(node, list): return ''.join(map(render, node))
    if not isinstance(node, dict): return html.escape(str(node))
    props = node.get('props', {})
    if node.get('type') == 'RCTScrollView' and node.get('children'):
        child = node['children'][0]
        child.setdefault('props', {})['style'] = props.get('contentContainerStyle', {})
    role = props.get('accessibilityRole')
    tag = 'button' if role == 'button' else 'div'
    if str(node.get('type', '')).startswith('RNSVG'): return ''
    style = flat(props.get('style', {}))
    if tag == 'div' and node.get('type') != 'Text':
        style = {'display':'flex', 'flexDirection':'column', **style}
    if 'borderWidth' in style: style['borderStyle'] = 'solid'
    rules = []
    for key, value in style.items():
        if value is None or isinstance(value, (dict,list)): continue
        if key == 'flex':
            rules.append(f'flex:{value}'); continue
        name = re.sub(r'[A-Z]', lambda m:'-'+m[0].lower(), key)
        if key in ['paddingHorizontal','paddingVertical']:
            for side in (['left','right'] if key.endswith('Horizontal') else ['top','bottom']): rules.append(f'padding-{side}:{value}px')
            continue
        if isinstance(value,(int,float)) and key not in ['fontWeight','opacity','flexGrow','flexShrink','order']: value = f'{value}px'
        rules.append(f'{name}:{value}')
    disabled = ' disabled' if props.get('accessibilityState',{}).get('disabled') else ''
    return f'<{tag} style="{html.escape(";".join(rules),quote=True)}"{disabled}>{render(node.get("children"))}</{tag}>'

for locale in ['tr','en','de']:
    tree = json.loads((base / f'computer-{locale}.json').read_text())
    body = render(tree)
    (base / f'computer-{locale}.html').write_text(f'''<!doctype html><html lang="{locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{{box-sizing:border-box;min-width:0}}body{{margin:0;font-family:Arial,sans-serif;background:#fff8f5;color:#1C1917;overflow-wrap:anywhere}}button{{font:inherit;cursor:pointer}}button:disabled{{opacity:.5}}[style]{{white-space:normal}}body.scaled{{zoom:1.3}}
</style><body>{body}</body></html>''')
