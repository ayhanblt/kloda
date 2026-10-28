const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const temporary=require('node:fs').mkdtempSync(path.join(os.tmpdir(),'kloda-mobile-ui-'));
app.setPath('userData',temporary); app.disableHardwareAcceleration();
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:390,height:844,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true}});
  const results=[];
  for(const locale of ['tr','en','de']) for(const width of [320,768]){
    win.setContentSize(width,1000);
    await win.loadFile(path.join(__dirname,`computer-${locale}.html`));
    const metrics=await win.webContents.executeJavaScript(`({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].map(b=>({height:b.getBoundingClientRect().height,text:b.innerText}))})`);
    assert(metrics.scroll<=metrics.width,locale+' horizontal overflow');
    assert(metrics.buttons.every(b=>b.height>=48),locale+' small touch target');
    const image=await win.webContents.capturePage();
    const name=`computer-${locale}-${width}.png`;
    await fs.writeFile(path.join(__dirname,name),image.toPNG());
    results.push({locale,width,image:name,...metrics});
  }
  await fs.writeFile(path.join(__dirname,'visual-result.json'),JSON.stringify({scope:'Host DOM approximation of actual RN test trees; native font/safe-area/keyboard/VoiceOver not validated',results},null,2));
  console.log('HOST_MOBILE_PREVIEW_6_PASS_NOT_NATIVE_ACCEPTANCE');win.destroy();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
