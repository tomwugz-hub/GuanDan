# Pair eval report

- generated: 2026-10-19T04:40:41.352Z
- file: frozen-real4.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 108/120 (90.0%) | - |

| id | pivot | gold | decide |  ok |
|---|---|---|---|---|
| u001 |  | single:K | single:K{K} |  d:✓ |
| u002 |  | single:6 | single:6{6} |  d:✓ |
| u003 |  | single:5 | single:5{5} |  d:✓ |
| u004 |  | pass | pass |  d:✓ |
| u005 |  | pass | pass |  d:✓ |
| u006 |  | pass | pair:RJ{RJRJ} |  d:✗ |
| u007 |  | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| u008 |  | pair:A | pair:A{AA} |  d:✓ |
| u009 |  | single:RJ | single:RJ{RJ} |  d:✓ |
| u010 |  | pairSeq:4 | pairSeq:4{223344} |  d:✓ |
| u011 |  | single:A | single:A{A} |  d:✓ |
| u012 |  | single:Q | single:Q{Q} |  d:✓ |
| u013 |  | pass | pass |  d:✓ |
| u014 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| u015 |  | pass | pass |  d:✓ |
| u016 |  | pass | single:RJ{RJ} |  d:✗ |
| u017 |  | fullhouse:7 | fullhouse:7{77449} |  d:✓ |
| u018 |  | single:7 | single:7{7} |  d:✓ |
| u019 |  | pass | pass |  d:✓ |
| u020 |  | single:8 | single:8{8} |  d:✓ |
| u021 |  | single:3 | single:3{3} |  d:✓ |
| u022 |  | single:RJ | single:RJ{RJ} |  d:✓ |
| u023 |  | pass | pass |  d:✓ |
| u024 |  | bomb:3 | bomb:3{3333K} |  d:✓ |
| u025 |  | pass | pass |  d:✓ |
| u026 |  | pair:5 | pass |  d:✓ |
| u027 |  | pairSeq:6 | fullhouse:6{66644} |  d:✓ |
| u028 |  | single:J | single:J{J} |  d:✓ |
| u029 |  | pair:J | pair:J{JJ} |  d:✓ |
| u030 |  | pass | pass |  d:✓ |
| u031 |  | fullhouse:6 | fullhouse:6{66655} |  d:✓ |
| u032 |  | single:Q | single:2{2} |  d:✗ |
| u033 |  | pass | pass |  d:✓ |
| u034 |  | pair:3 | pair:3{33} |  d:✓ |
| u035 |  | fullhouse:J | fullhouse:J{JJKK3} |  d:✓ |
| u036 |  | bomb:9 | pass |  d:✓ |
| u037 |  | bomb:4 | bomb:4{4444} |  d:✓ |
| u038 |  | single:5 | single:5{5} |  d:✓ |
| u039 |  | pass | pass |  d:✓ |
| u040 |  | fullhouse:6 | fullhouse:6{66633} |  d:✓ |
| u041 |  | single:RJ | single:RJ{RJ} |  d:✓ |
| u042 |  | bomb:10 | bomb:10{10101010} |  d:✓ |
| u043 |  | pass | pass |  d:✓ |
| u044 |  | single:6 | single:7{7} |  d:✓ |
| u045 |  | single:A | single:A{A} |  d:✓ |
| u046 |  | pass | pass |  d:✓ |
| u047 |  | single:4 | single:7{7} |  d:✓ |
| u048 |  | pass | pass |  d:✓ |
| u049 |  | pass | pass |  d:✓ |
| u050 |  | pass | bomb:3{3333} |  d:✗ |
| u051 |  | pass | pass |  d:✓ |
| u052 |  | bomb:3 | bomb:3{33310} |  d:✓ |
| u053 |  | pass | pass |  d:✓ |
| u054 |  | single:8 | single:8{8} |  d:✓ |
| u055 |  | single:8 | single:8{8} |  d:✓ |
| u056 |  | pass | pass |  d:✓ |
| u057 |  | pass | pass |  d:✓ |
| u058 |  | pass | pass |  d:✓ |
| u059 |  | pass | pass |  d:✓ |
| u060 |  | pass | pass |  d:✓ |
| u061 |  | pass | pass |  d:✓ |
| u062 |  | single:4 | single:4{4} |  d:✓ |
| u063 |  | single:2 | pair:Q{QQ} |  d:✗ |
| u064 |  | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| u065 |  | pair:5 | pair:5{55} |  d:✓ |
| u066 |  | pass | pass |  d:✓ |
| u067 |  | pass | pass |  d:✓ |
| u068 |  | single:K | single:8{8} |  d:✓ |
| u069 |  | bomb:10 | bomb:10{101010107} |  d:✓ |
| u070 |  | fullhouse:J | fullhouse:J{JJ44J} |  d:✓ |
| u071 |  | bomb:K | bomb:K{KKKK} |  d:✓ |
| u072 |  | pair:8 | pair:8{88} |  d:✓ |
| u073 |  | pass | pass |  d:✓ |
| u074 |  | fullhouse:3 | fullhouse:3{33344} |  d:✓ |
| u075 |  | pair:10 | pair:10{1010} |  d:✓ |
| u076 |  | bomb:6 | bomb:6{666610} |  d:✓ |
| u077 |  | pass | single:Q{Q} |  d:✗ |
| u078 |  | pair:5 | pair:5{55} |  d:✓ |
| u079 |  | bomb:10 | pair:4{45} |  d:✗ |
| u080 |  | bomb:Q | bomb:Q{QQQQ} |  d:✓ |
| u081 |  | pass | pass |  d:✓ |
| u082 |  | pass | bomb:5{5555J} |  d:✗ |
| u083 |  | pass | pass |  d:✓ |
| u084 |  | single:6 | single:6{6} |  d:✓ |
| u085 |  | bomb:4 | bomb:4{44466} |  d:✓ |
| u086 |  | pass | single:RJ{RJ} |  d:✓ |
| u087 |  | pair:10 | pair:10{1010} |  d:✓ |
| u088 |  | pair:9 | pair:9{99} |  d:✓ |
| u089 |  | pass | pass |  d:✓ |
| u090 |  | pass | pair:8{88} |  d:✗ |
| u091 |  | single:8 | single:8{8} |  d:✓ |
| u092 |  | single:K | single:K{K} |  d:✓ |
| u093 |  | single:4 | single:4{4} |  d:✓ |
| u094 |  | single:A | single:A{A} |  d:✓ |
| u095 |  | single:Q | single:Q{Q} |  d:✓ |
| u096 |  | pass | pass |  d:✓ |
| u097 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| u098 |  | pair:3 | pair:3{33} |  d:✓ |
| u099 |  | pass | pass |  d:✓ |
| u100 |  | pass | single:A{A} |  d:✗ |
| u101 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| u102 |  | single:BJ | single:BJ{BJ} |  d:✓ |
| u103 |  | pass | pass |  d:✓ |
| u104 |  | straight:8 | single:2{2} |  d:✓ |
| u105 |  | single:9 | single:9{9} |  d:✓ |
| u106 |  | pair:3 | fullhouse:7{77733} |  d:✓ |
| u107 |  | bomb:8 | bomb:8{88888} |  d:✓ |
| u108 |  | pass | single:BJ{BJ} |  d:✗ |
| u109 |  | pass | pass |  d:✓ |
| u110 |  | pair:J | pair:J{JJ} |  d:✓ |
| u111 |  | single:K | single:K{K} |  d:✓ |
| u112 |  | pass | pass |  d:✓ |
| u113 |  | pass | pass |  d:✓ |
| u114 |  | pass | pass |  d:✓ |
| u115 |  | pass | pass |  d:✓ |
| u116 |  | fullhouse:5 | pair:2{22} |  d:✓ |
| u117 |  | pass | bomb:3{3333} |  d:✗ |
| u118 |  | pass | pass |  d:✓ |
| u119 |  | pass | pass |  d:✓ |
| u120 |  | single:J | single:4{4} |  d:✓ |
