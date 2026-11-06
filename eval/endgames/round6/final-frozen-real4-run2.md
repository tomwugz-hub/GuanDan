# Pair eval report

- generated: 2026-10-17T11:02:28.564Z
- file: frozen-real4.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 108/120 (90.0%) | - |
| jev | 109/120 (90.8%) | - |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| u001 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| u002 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| u003 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| u004 |  | pass | pass | pass | d:✓ j:✓ |
| u005 |  | pass | pass | pass | d:✓ j:✓ |
| u006 |  | pass | pair:RJ{RJRJ} | pair:RJ{RJRJ} | d:✗ j:✗ |
| u007 |  | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ j:✓ |
| u008 |  | pair:A | pair:A{AA} | single:RJ{RJ} | d:✓ j:✗ |
| u009 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| u010 |  | pairSeq:4 | pairSeq:4{223344} | pairSeq:4{223344} | d:✓ j:✓ |
| u011 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| u012 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| u013 |  | pass | pass | pass | d:✓ j:✓ |
| u014 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| u015 |  | pass | pass | pass | d:✓ j:✓ |
| u016 |  | pass | single:RJ{RJ} | single:RJ{RJ} | d:✗ j:✗ |
| u017 |  | fullhouse:7 | fullhouse:7{77449} | fullhouse:7{77449} | d:✓ j:✓ |
| u018 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| u019 |  | pass | pass | pass | d:✓ j:✓ |
| u020 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| u021 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| u022 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| u023 |  | pass | pass | pass | d:✓ j:✓ |
| u024 |  | bomb:3 | bomb:3{3333K} | bomb:3{3333K} | d:✓ j:✓ |
| u025 |  | pass | pass | pass | d:✓ j:✓ |
| u026 |  | pair:5 | pass | pass | d:✓ j:✓ |
| u027 |  | pairSeq:6 | fullhouse:6{66655} | fullhouse:6{66644} | d:✓ j:✓ |
| u028 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| u029 |  | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| u030 |  | pass | pass | pass | d:✓ j:✓ |
| u031 |  | fullhouse:6 | fullhouse:6{66699} | single:4{4} | d:✓ j:✗ |
| u032 |  | single:Q | single:2{2} | single:Q{Q} | d:✗ j:✓ |
| u033 |  | pass | pass | pass | d:✓ j:✓ |
| u034 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| u035 |  | fullhouse:J | fullhouse:J{JJKK3} | fullhouse:J{JJKK3} | d:✓ j:✓ |
| u036 |  | bomb:9 | pass | pass | d:✓ j:✓ |
| u037 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ |
| u038 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| u039 |  | pass | pass | pass | d:✓ j:✓ |
| u040 |  | fullhouse:6 | fullhouse:6{66633} | fullhouse:6{66633} | d:✓ j:✓ |
| u041 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| u042 |  | bomb:10 | bomb:10{10101010} | bomb:10{10101010} | d:✓ j:✓ |
| u043 |  | pass | pass | pass | d:✓ j:✓ |
| u044 |  | single:6 | single:7{7} | single:7{7} | d:✓ j:✓ |
| u045 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| u046 |  | pass | pass | pass | d:✓ j:✓ |
| u047 |  | single:4 | single:7{7} | single:7{7} | d:✓ j:✓ |
| u048 |  | pass | pass | pass | d:✓ j:✓ |
| u049 |  | pass | pass | pass | d:✓ j:✓ |
| u050 |  | pass | bomb:3{3333} | pass | d:✗ j:✓ |
| u051 |  | pass | pass | pass | d:✓ j:✓ |
| u052 |  | bomb:3 | bomb:3{33310} | bomb:3{33310} | d:✓ j:✓ |
| u053 |  | pass | pass | pass | d:✓ j:✓ |
| u054 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| u055 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| u056 |  | pass | pass | pass | d:✓ j:✓ |
| u057 |  | pass | pass | pass | d:✓ j:✓ |
| u058 |  | pass | pass | pass | d:✓ j:✓ |
| u059 |  | pass | pass | pass | d:✓ j:✓ |
| u060 |  | pass | pass | pass | d:✓ j:✓ |
| u061 |  | pass | pass | pass | d:✓ j:✓ |
| u062 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| u063 |  | single:2 | pair:Q{QQ} | pair:Q{QQ} | d:✗ j:✗ |
| u064 |  | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ j:✓ |
| u065 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| u066 |  | pass | pass | pass | d:✓ j:✓ |
| u067 |  | pass | pass | pass | d:✓ j:✓ |
| u068 |  | single:K | single:8{8} | single:8{8} | d:✓ j:✓ |
| u069 |  | bomb:10 | bomb:10{101010107} | bomb:10{10101010} | d:✓ j:✓ |
| u070 |  | fullhouse:J | fullhouse:J{JJ44J} | fullhouse:J{JJ44J} | d:✓ j:✓ |
| u071 |  | bomb:K | bomb:K{KKKK} | bomb:K{KKKK} | d:✓ j:✓ |
| u072 |  | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| u073 |  | pass | pass | pass | d:✓ j:✓ |
| u074 |  | fullhouse:3 | fullhouse:3{33344} | fullhouse:3{33344} | d:✓ j:✓ |
| u075 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| u076 |  | bomb:6 | single:10{10} | bomb:6{666610} | d:✗ j:✓ |
| u077 |  | pass | single:Q{Q} | single:Q{Q} | d:✗ j:✗ |
| u078 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| u079 |  | bomb:10 | pair:4{45} | pair:4{45} | d:✗ j:✗ |
| u080 |  | bomb:Q | bomb:Q{QQQQ} | bomb:Q{QQQQ} | d:✓ j:✓ |
| u081 |  | pass | pass | pass | d:✓ j:✓ |
| u082 |  | pass | bomb:5{5555J} | bomb:5{5555J} | d:✗ j:✗ |
| u083 |  | pass | pass | pass | d:✓ j:✓ |
| u084 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| u085 |  | bomb:4 | bomb:4{44466} | bomb:4{44466} | d:✓ j:✓ |
| u086 |  | pass | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| u087 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| u088 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| u089 |  | pass | pass | pass | d:✓ j:✓ |
| u090 |  | pass | pair:8{88} | pair:Q{QQ} | d:✗ j:✗ |
| u091 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| u092 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| u093 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| u094 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| u095 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| u096 |  | pass | pass | pass | d:✓ j:✓ |
| u097 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| u098 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| u099 |  | pass | pass | pass | d:✓ j:✓ |
| u100 |  | pass | pass | pass | d:✓ j:✓ |
| u101 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| u102 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| u103 |  | pass | pass | pass | d:✓ j:✓ |
| u104 |  | straight:8 | single:2{2} | single:2{2} | d:✓ j:✓ |
| u105 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| u106 |  | pair:3 | fullhouse:7{77744} | fullhouse:7{77744} | d:✓ j:✓ |
| u107 |  | bomb:8 | bomb:8{88888} | bomb:8{88888} | d:✓ j:✓ |
| u108 |  | pass | single:BJ{BJ} | single:BJ{BJ} | d:✗ j:✗ |
| u109 |  | pass | pass | pass | d:✓ j:✓ |
| u110 |  | pair:J | pair:J{JJ} | pair:J{JJ} | d:✓ j:✓ |
| u111 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| u112 |  | pass | pass | pass | d:✓ j:✓ |
| u113 |  | pass | pass | pass | d:✓ j:✓ |
| u114 |  | pass | pass | pass | d:✓ j:✓ |
| u115 |  | pass | pass | pass | d:✓ j:✓ |
| u116 |  | fullhouse:5 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| u117 |  | pass | bomb:3{3333} | bomb:3{3333} | d:✗ j:✗ |
| u118 |  | pass | pass | pass | d:✓ j:✓ |
| u119 |  | pass | pass | pass | d:✓ j:✓ |
| u120 |  | single:J | single:4{4} | single:4{4} | d:✓ j:✓ |
