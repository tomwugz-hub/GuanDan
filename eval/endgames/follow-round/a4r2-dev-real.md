# Pair eval report

- generated: 2026-10-17T08:01:55.325Z
- file: dev-real.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 119/120 (99.2%) | - |
| jev | 118/120 (98.3%) | - |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| d001 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| d002 |  | pair:3/4 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| d003 |  | single:2/4 | single:2{2} | single:2{2} | d:✓ j:✓ |
| d004 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d005 |  | fullhouse:9 | fullhouse:9{99922} | fullhouse:9{99922} | d:✓ j:✓ |
| d006 |  | pass | pass | pass | d:✓ j:✓ |
| d007 |  | single:A/K | single:A{A} | single:A{A} | d:✓ j:✓ |
| d008 |  | pass | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| d009 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| d010 |  | pass | pass | pass | d:✓ j:✓ |
| d011 |  | pass | pass | pass | d:✓ j:✓ |
| d012 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| d013 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| d014 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| d015 |  | pass | pass | pass | d:✓ j:✓ |
| d016 |  | fullhouse:2 | single:9{9} | single:9{9} | d:✓ j:✓ |
| d017 |  | pass | pass | pass | d:✓ j:✓ |
| d018 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| d019 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| d020 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| d021 |  | single:2/3 | single:2{2} | single:2{2} | d:✓ j:✓ |
| d022 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| d023 |  | pass | pass | pass | d:✓ j:✓ |
| d024 |  | pass | pass | pass | d:✓ j:✓ |
| d025 |  | pass | pass | pass | d:✓ j:✓ |
| d026 |  | pass | pass | pass | d:✓ j:✓ |
| d027 |  | single:2/4/5/9/Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| d028 |  | bomb:7 | bomb:7{77777} | bomb:7{77777} | d:✓ j:✓ |
| d029 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| d030 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| d031 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| d032 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| d033 |  | pass | pass | pass | d:✓ j:✓ |
| d034 |  | pass | pass | pass | d:✓ j:✓ |
| d035 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d036 |  | pair:RJ | pair:RJ{RJRJ} | pair:RJ{RJRJ} | d:✓ j:✓ |
| d037 |  | straight: | straight:7{34567} | straight:7{34567} | d:✓ j:✓ |
| d038 |  | pass | pass | pass | d:✓ j:✓ |
| d039 |  | pass | pass | pass | d:✓ j:✓ |
| d040 |  | pass | pass | pass | d:✓ j:✓ |
| d041 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| d042 |  | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| d043 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| d044 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| d045 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| d046 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| d047 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| d048 |  | triple:3 | triple:3{333} | triple:3{333} | d:✓ j:✓ |
| d049 |  | pass | pass | pass | d:✓ j:✓ |
| d050 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d051 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| d052 |  | pass | pass | pass | d:✓ j:✓ |
| d053 |  | bomb:3 | bomb:3{3333} | bomb:3{3333} | d:✓ j:✓ |
| d054 |  | pass | pass | pass | d:✓ j:✓ |
| d055 |  | pass | pass | pass | d:✓ j:✓ |
| d056 |  | pass | pass | pass | d:✓ j:✓ |
| d057 |  | pair:4 | pair:4{410} | pair:4{410} | d:✓ j:✓ |
| d058 |  | pass | pass | pass | d:✓ j:✓ |
| d059 |  | single:8/A | single:8{8} | single:8{8} | d:✓ j:✓ |
| d060 |  | pass | pass | pass | d:✓ j:✓ |
| d061 |  | pass | pass | pass | d:✓ j:✓ |
| d062 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| d063 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| d064 |  | pass | pass | pass | d:✓ j:✓ |
| d065 |  | pass | pass | pass | d:✓ j:✓ |
| d066 |  | bomb:6 | bomb:6{66663} | bomb:6{6666} | d:✓ j:✓ |
| d067 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| d068 |  | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| d069 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| d070 |  | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| d071 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d072 |  | bomb: | bomb:4{444K} | bomb:4{444K} | d:✓ j:✓ |
| d073 |  | pass | pass | pass | d:✓ j:✓ |
| d074 |  | pass | pass | pass | d:✓ j:✓ |
| d075 |  | single:2 | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d076 |  | pass | pass | pass | d:✓ j:✓ |
| d077 |  | pass | bomb:4{44448} | bomb:4{4444} | d:✓ j:✓ |
| d078 |  | pass | pass | pass | d:✓ j:✓ |
| d079 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| d080 |  | pair:7/9 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| d081 |  | bomb:2 | bomb:2{2222J} | bomb:2{2222} | d:✓ j:✓ |
| d082 |  | single:2 | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ |
| d083 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| d084 |  | pass | pass | pass | d:✓ j:✓ |
| d085 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| d086 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| d087 |  | straight:Q | straight:Q{8910JQ} | straight:Q{8910JQ} | d:✓ j:✓ |
| d088 |  | pass | pass | pass | d:✓ j:✓ |
| d089 |  | pass | pass | pass | d:✓ j:✓ |
| d090 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| d091 |  | straight:J | straight:J{78910J} | single:3{3} | d:✓ j:✗ |
| d092 |  | pass | pass | pass | d:✓ j:✓ |
| d093 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| d094 |  | pass | pass | pass | d:✓ j:✓ |
| d095 |  | pass | pass | pass | d:✓ j:✓ |
| d096 |  | pass | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| d097 |  | pass | pass | pass | d:✓ j:✓ |
| d098 |  | fullhouse:8 | fullhouse:8{88899} | fullhouse:8{88899} | d:✓ j:✓ |
| d099 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| d100 |  | fullhouse:6/Q | fullhouse:6{66622} | fullhouse:6{66622} | d:✓ j:✓ |
| d101 |  | pass | fullhouse:6{6661010} | fullhouse:6{6661010} | d:✗ j:✗ |
| d102 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| d103 |  | pass | pass | pass | d:✓ j:✓ |
| d104 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| d105 |  | pass | pass | pass | d:✓ j:✓ |
| d106 |  | pass | pass | pass | d:✓ j:✓ |
| d107 |  | single:3 | pair:5{55} | single:3{3} | d:✓ j:✓ |
| d108 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| d109 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| d110 |  | pass | pass | pass | d:✓ j:✓ |
| d111 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| d112 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| d113 |  | pass | pass | pass | d:✓ j:✓ |
| d114 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| d115 |  | pass | pass | pass | d:✓ j:✓ |
| d116 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| d117 |  | single:A/K | single:A{A} | single:A{A} | d:✓ j:✓ |
| d118 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| d119 |  | pass | pass | pass | d:✓ j:✓ |
| d120 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
