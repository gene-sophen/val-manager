"""Build locally served UI font subsets; originals and earlier prototypes stay intact."""
from pathlib import Path
from urllib.request import urlopen
from fontTools import subset
from fontTools.ttLib import TTFont
import io

root=Path(__file__).parent
out=root/'fonts'
out.mkdir(exist_ok=True)
text=''.join(chr(i) for i in range(32,127))
for folder in [root,root.parent/'art-direction-01',root.parent/'art-direction-02']:
    for file in folder.iterdir():
        if file.suffix in {'.html','.js','.cjs','.css','.md'}:
            text+=file.read_text(encoding='utf-8')
text+='加载中已完成重试暂不可用当前选择返回关闭首页选手卡册能力协同枪法意识珍藏阵容晋级并肩开始'

def save_subset(font,name):
    options=subset.Options()
    options.layout_features=['*']
    options.name_IDs=['*']
    options.name_legacy=True
    options.name_languages=['*']
    worker=subset.Subsetter(options=options)
    worker.populate(text=text)
    worker.subset(font)
    font.flavor='woff'
    font.save(out/name)

save_subset(TTFont(r'C:\Windows\Fonts\NotoSansSC-VF.ttf'),'NotoSansSC-ui.woff')
nunito=urlopen('https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf').read()
save_subset(TTFont(io.BytesIO(nunito)),'Nunito-ui.woff')
for directory,name in [('nunito','Nunito-OFL.txt'),('notosanssc','NotoSansSC-OFL.txt')]:
    (out/name).write_bytes(urlopen('https://raw.githubusercontent.com/google/fonts/main/ofl/'+directory+'/OFL.txt').read())
for file in out.iterdir():print(file.name,file.stat().st_size)
