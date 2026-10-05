"""Record the game's voice with a neural voice (Microsoft Ava via edge-tts) into ../audio:
   w/<grade>/<word>-{word,sentence,meaning,spell}.mp3, letters/<a-z>.mp3, phrases/starts.mp3, lines/<slug>.mp3.
   Skips files that already exist, so rerun it after a word list change.  python make-audio.py [--force]"""
import asyncio, json, os, re, sys
import edge_tts
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); OUT=os.path.join(ROOT,'audio')
VOICE='en-US-AvaNeural'; FORCE='--force' in sys.argv
def words():
    s=open(os.path.join(ROOT,'index.html'),encoding='utf-8').read()
    def arr(name):
        i=s.index('var '+name+'='); j=s.index('];',i)+1; src=s[i+len(name)+5:j]
        src=re.sub(r"(\{|,)(\w+):",r'\1"\2":',src).replace("'",'"'); return json.loads(src)
    lines=[]
    for m in re.finditer(r"sumVoice:\[([^\]]*)\]",s):
        for q in re.findall(r"'([^']*)'",m.group(1)):
            if q not in lines: lines.append(q)
    return arr('WORDS3'),arr('WORDS4'),lines
def slug(t): return re.sub(r'[^a-z0-9]+','-',t.lower()).strip('-')[:60]
def jobs():
    W3,W4,lines=words(); J=[]
    for g,L in (('3',W3),('4',W4)):
        for w in L:
            k=w['w'].lower(); d=f'w/{g}/{k}'
            J.append((d+'-word', w['w']+'.', '-10%'))
            J.append((d+'-sentence', w['s'], '-5%'))
            J.append((d+'-meaning', f"{w['w']} means {w['d']}.", '-5%'))
            J.append((d+'-spell', f"{w['w']}. {', '.join(w['w'].upper())}. {w['w']}.", '-20%'))
    for c in 'abcdefghijklmnopqrstuvwxyz': J.append((f'letters/{c}', c.upper()+'.', '-10%'))
    J.append(('phrases/starts','It starts with','-5%'))
    for t in lines: J.append((f'lines/{slug(t)}', t, '+0%'))
    return J
async def one(sem,path,text,rate):
    f=os.path.join(OUT,path+'.mp3')
    if os.path.exists(f) and os.path.getsize(f)>1000 and not FORCE: return 'skip'
    os.makedirs(os.path.dirname(f),exist_ok=True)
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text,VOICE,rate=rate,pitch='+5Hz').save(f)
                if os.path.getsize(f)>1000: return 'ok'
            except Exception as e:
                err=e
            await asyncio.sleep(1.5*(attempt+1))
    return 'FAIL '+path
async def main():
    J=jobs(); sem=asyncio.Semaphore(4)
    res=await asyncio.gather(*[one(sem,p,t,r) for p,t,r in J])
    bad=[r for r in res if r.startswith('FAIL')]
    print(f"{len(J)} clips: {res.count('ok')} made, {res.count('skip')} kept, {len(bad)} failed"); [print(b) for b in bad]
    sys.exit(1 if bad else 0)
asyncio.run(main())
