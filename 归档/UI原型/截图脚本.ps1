# UI原型截图脚本：Edge headless 本机窗口最小宽度 500、视口=窗口-30x-96，
# 故用 500x940 窗口 + 页面 #shot 模式贴左上，再裁 390x844。
$ErrorActionPreference = "Stop"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$base = "file:///D:/my_program/val-manager/%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3/UI%E5%8E%9F%E5%9E%8B/%E5%8E%9F%E5%9E%8Bv1.html"
$tmp = "C:\Users\13670\AppData\Local\Temp\shot"
$out = "D:\my_program\val-manager\设计文档\UI原型\截图"
New-Item -ItemType Directory -Force $tmp, $out | Out-Null
$screens = @("journey","draft","lineup","transfer","result","match","coach","draw")
foreach ($s in $screens) {
  & $edge --headless --disable-gpu --hide-scrollbars --virtual-time-budget=12000 `
    --window-size=500,940 --screenshot="$tmp\$s.png" "$base#screen=$s&shot=1" | Out-Null
}
python -c "
from PIL import Image
import os
for s in ['journey','draft','lineup','transfer','result','match','coach','draw']:
    im = Image.open(os.path.join(r'$tmp', s + '.png')).crop((0, 0, 390, 844))
    im.save(os.path.join(r'$out', s + '.png'))
    print(s, 'ok')
"
