# Pair eval report

- generated: 2026-10-19T22:21:21.119Z
- file: frozen-real4.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 108/120 (90.0%) | - |
| startlux | 105/120 (87.5%) | - |

| id | pivot | gold | decide | startlux | ok |
|---|---|---|---|---|---|
| u001 |  | single:K | single:K{K} | pass | d:✓ s:✗ |
| u002 |  | single:6 | single:6{6} | pass | d:✓ s:✗ |
| u003 |  | single:5 | single:5{5} | pair:2{22} | d:✓ s:✗ |
| u004 |  | pass | pass | pass | d:✓ s:✓ |
| u005 |  | pass | pass | pass | d:✓ s:✓ |
| u006 |  | pass | pair:RJ{RJRJ} | pair:RJ{RJRJ} | d:✗ s:✗ |
| u007 |  | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ s:✓ |
| u008 |  | pair:A | pair:A{AA} | pair:A{AA} | d:✓ s:✓ |
| u009 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| u010 |  | pairSeq:4 | pairSeq:4{223344} | pairSeq:4{223344} | d:✓ s:✓ |
| u011 |  | single:A | single:A{A} | single:A{A} | d:✓ s:✓ |
| u012 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ s:✓ |
| u013 |  | pass | pass | pass | d:✓ s:✓ |
| u014 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| u015 |  | pass | pass | pass | d:✓ s:✓ |
| u016 |  | pass | single:RJ{RJ} | single:RJ{RJ} | d:✗ s:✗ |
| u017 |  | fullhouse:7 | fullhouse:7{77449} | fullhouse:7{77889} | d:✓ s:✓ |
| u018 |  | single:7 | single:7{7} | single:7{7} | d:✓ s:✓ |
| u019 |  | pass | pass | pass | d:✓ s:✓ |
| u020 |  | single:8 | single:8{8} | single:8{8} | d:✓ s:✓ |
| u021 |  | single:3 | single:3{3} | single:3{3} | d:✓ s:✓ |
| u022 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| u023 |  | pass | pass | pass | d:✓ s:✓ |
| u024 |  | bomb:3 | bomb:3{3333K} | bomb:3{3333K} | d:✓ s:✓ |
| u025 |  | pass | pass | pass | d:✓ s:✓ |
| u026 |  | pair:5 | pass | pass | d:✓ s:✓ |
| u027 |  | pairSeq:6 | fullhouse:6{66644} | pairSeq:6{445566} | d:✓ s:✓ |
| u028 |  | single:J | single:J{J} | single:J{J} | d:✓ s:✓ |
| u029 |  | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ s:✓ |
| u030 |  | pass | pass | pass | d:✓ s:✓ |
| u031 |  | fullhouse:6 | fullhouse:6{66655} | fullhouse:6{66655} | d:✓ s:✓ |
| u032 |  | single:Q | single:2{2} | single:Q{Q} | d:✗ s:✓ |
| u033 |  | pass | pass | pass | d:✓ s:✓ |
| u034 |  | pair:3 | pair:3{33} | pair:8{88} | d:✓ s:✗ |
| u035 |  | fullhouse:J | fullhouse:J{JJKK3} | fullhouse:J{JJKK3} | d:✓ s:✓ |
| u036 |  | bomb:9 | pass | pass | d:✓ s:✓ |
| u037 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ s:✓ |
| u038 |  | single:5 | single:5{5} | single:5{5} | d:✓ s:✓ |
| u039 |  | pass | pass | pass | d:✓ s:✓ |
| u040 |  | fullhouse:6 | fullhouse:6{66633} | fullhouse:6{66633} | d:✓ s:✓ |
| u041 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| u042 |  | bomb:10 | bomb:10{10101010} | bomb:10{10101010} | d:✓ s:✓ |
| u043 |  | pass | pass | pass | d:✓ s:✓ |
| u044 |  | single:6 | single:7{7} | single:7{7} | d:✓ s:✓ |
| u045 |  | single:A | single:A{A} | single:A{A} | d:✓ s:✓ |
| u046 |  | pass | pass | pass | d:✓ s:✓ |
| u047 |  | single:4 | single:7{7} | single:7{7} | d:✓ s:✓ |
| u048 |  | pass | pass | pass | d:✓ s:✓ |
| u049 |  | pass | pass | pass | d:✓ s:✓ |
| u050 |  | pass | bomb:3{3333} | bomb:3{3333} | d:✗ s:✗ |
| u051 |  | pass | pass | pass | d:✓ s:✓ |
| u052 |  | bomb:3 | bomb:3{33310} | bomb:3{33310} | d:✓ s:✓ |
| u053 |  | pass | pass | pass | d:✓ s:✓ |
| u054 |  | single:8 | single:8{8} | single:4{4} | d:✓ s:✗ |
| u055 |  | single:8 | single:8{8} | single:8{8} | d:✓ s:✓ |
| u056 |  | pass | pass | pass | d:✓ s:✓ |
| u057 |  | pass | pass | pass | d:✓ s:✓ |
| u058 |  | pass | pass | pass | d:✓ s:✓ |
| u059 |  | pass | pass | pass | d:✓ s:✓ |
| u060 |  | pass | pass | pass | d:✓ s:✓ |
| u061 |  | pass | pass | pass | d:✓ s:✓ |
| u062 |  | single:4 | single:4{4} | single:4{4} | d:✓ s:✓ |
| u063 |  | single:2 | pair:Q{QQ} | pair:Q{QQ} | d:✗ s:✗ |
| u064 |  | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ s:✓ |
| u065 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ s:✓ |
| u066 |  | pass | pass | bomb:K{KKKK} | d:✓ s:✓ |
| u067 |  | pass | pass | pass | d:✓ s:✓ |
| u068 |  | single:K | single:8{8} | single:8{8} | d:✓ s:✓ |
| u069 |  | bomb:10 | bomb:10{10101010} | bomb:10{10101010} | d:✓ s:✓ |
| u070 |  | fullhouse:J | fullhouse:J{JJ44J} | fullhouse:J{JJ44J} | d:✓ s:✓ |
| u071 |  | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ s:✓ |
| u072 |  | pair:8 | pair:8{88} | pair:8{88} | d:✓ s:✓ |
| u073 |  | pass | pass | pass | d:✓ s:✓ |
| u074 |  | fullhouse:3 | fullhouse:3{33344} | fullhouse:3{33344} | d:✓ s:✓ |
| u075 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ s:✓ |
| u076 |  | bomb:6 | bomb:6{666610} | bomb:6{666610} | d:✓ s:✓ |
| u077 |  | pass | single:Q{Q} | pass | d:✗ s:✓ |
| u078 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ s:✓ |
| u079 |  | bomb:10 | pair:4{45} | pair:4{45} | d:✗ s:✗ |
| u080 |  | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ s:✓ |
| u081 |  | pass | pass | pass | d:✓ s:✓ |
| u082 |  | pass | bomb:5{5555J} | bomb:5{5555J} | d:✗ s:✗ |
| u083 |  | pass | pass | pass | d:✓ s:✓ |
| u084 |  | single:6 | single:6{6} | single:6{6} | d:✓ s:✓ |
| u085 |  | bomb:4 | bomb:4{44466} | bomb:4{44466} | d:✓ s:✓ |
| u086 |  | pass | single:RJ{RJ} | single:RJ{RJ} | d:✓ s:✓ |
| u087 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ s:✓ |
| u088 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ s:✓ |
| u089 |  | pass | pass | pass | d:✓ s:✓ |
| u090 |  | pass | pair:8{88} | pass | d:✗ s:✓ |
| u091 |  | single:8 | single:8{8} | single:8{8} | d:✓ s:✓ |
| u092 |  | single:K | single:K{K} | single:K{K} | d:✓ s:✓ |
| u093 |  | single:4 | single:4{4} | pair:2{22} | d:✓ s:✗ |
| u094 |  | single:A | single:A{A} | single:A{A} | d:✓ s:✓ |
| u095 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ s:✓ |
| u096 |  | pass | pass | pass | d:✓ s:✓ |
| u097 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| u098 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ s:✓ |
| u099 |  | pass | pass | pass | d:✓ s:✓ |
| u100 |  | pass | single:A{A} | pass | d:✗ s:✓ |
| u101 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| u102 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ s:✓ |
| u103 |  | pass | pass | pass | d:✓ s:✓ |
| u104 |  | straight:8 | single:2{2} | straight:8{45678} | d:✓ s:✓ |
| u105 |  | single:9 | single:9{9} | single:9{9} | d:✓ s:✓ |
| u106 |  | pair:3 | fullhouse:7{77733} | fullhouse:7{77744} | d:✓ s:✓ |
| u107 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ s:✓ |
| u108 |  | pass | single:BJ{BJ} | single:BJ{BJ} | d:✗ s:✗ |
| u109 |  | pass | pass | pass | d:✓ s:✓ |
| u110 |  | pair:J | pair:J{JJ} | pair:A{AA} | d:✓ s:✗ |
| u111 |  | single:K | single:K{K} | single:K{K} | d:✓ s:✓ |
| u112 |  | pass | pass | pass | d:✓ s:✓ |
| u113 |  | pass | pass | pass | d:✓ s:✓ |
| u114 |  | pass | pass | pass | d:✓ s:✓ |
| u115 |  | pass | pass | pass | d:✓ s:✓ |
| u116 |  | fullhouse:5 | pair:2{22} | fullhouse:5{55588} | d:✓ s:✓ |
| u117 |  | pass | bomb:3{3333} | bomb:3{3333} | d:✗ s:✗ |
| u118 |  | pass | pass | pass | d:✓ s:✓ |
| u119 |  | pass | pass | pass | d:✓ s:✓ |
| u120 |  | single:J | single:4{4} | single:4{4} | d:✓ s:✓ |
