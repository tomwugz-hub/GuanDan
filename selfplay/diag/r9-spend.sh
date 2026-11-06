#!/bin/sh
# r9 本任务 API 花费：jev-calls.jsonl 第 $(cat r9-calls-baseline.txt) 行之后，按 $0.042/M 输入 token
cd "$(dirname "$0")/../.." && B=$(cat selfplay/logs/r9-calls-baseline.txt)
tail -n +$((B+1)) selfplay/logs/jev-calls.jsonl | node -e 'let n=0,t=0,o=0,tags={};require("readline").createInterface({input:process.stdin}).on("line",l=>{const x=JSON.parse(l);n++;const i=x.usage?.input_tokens||0;t+=i;o+=x.usage?.output_tokens||0;tags[x.tag]=(tags[x.tag]||0)+i}).on("close",()=>console.log(JSON.stringify({calls:n,inTok:t,outTok:o,usd:+(t*0.042e-6).toFixed(4),byTagUsd:Object.fromEntries(Object.entries(tags).map(([k,v])=>[k,+(v*0.042e-6).toFixed(4)]))})))'
