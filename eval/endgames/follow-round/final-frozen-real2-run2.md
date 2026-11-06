# Pair eval report

- generated: 2026-10-17T08:04:07.674Z
- file: frozen-real2.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 110/120 (91.7%) | - |
| jev | 108/120 (90.0%) | - |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| s001 |  | pairSeq:8 | pairSeq:8{667788} | pairSeq:8{667788} | d:✓ j:✓ |
| s002 |  | single:BJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| s003 |  | pair:4 | pair:4{44} | pair:4{44} | d:✓ j:✓ |
| s004 |  | pass | pass | pass | d:✓ j:✓ |
| s005 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| s006 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| s007 |  | pass | pass | pass | d:✓ j:✓ |
| s008 |  | single:BJ | pass | pass | d:✗ j:✗ |
| s009 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| s010 |  | pass | pass | pass | d:✓ j:✓ |
| s011 |  | pass | pass | pass | d:✓ j:✓ |
| s012 |  | pass | pass | pass | d:✓ j:✓ |
| s013 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| s014 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| s015 |  | fullhouse:10 | fullhouse:10{1010557} | fullhouse:10{1010557} | d:✓ j:✓ |
| s016 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| s017 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| s018 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| s019 |  | pass | pass | pass | d:✓ j:✓ |
| s020 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| s021 |  | pair:K | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| s022 |  | pass | pass | pass | d:✓ j:✓ |
| s023 |  | pass | pass | pass | d:✓ j:✓ |
| s024 |  | pass | pass | pass | d:✓ j:✓ |
| s025 |  | pass | pass | pass | d:✓ j:✓ |
| s026 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| s027 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| s028 |  | pass | pass | pass | d:✓ j:✓ |
| s029 |  | bomb:4 | bomb:4{44444} | bomb:4{44444} | d:✓ j:✓ |
| s030 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| s031 |  | single:K | single:K{K} | single:K{K} | d:✓ j:✓ |
| s032 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| s033 |  | fullhouse:9 | fullhouse:9{99QQ3} | fullhouse:9{99QQ3} | d:✓ j:✓ |
| s034 |  | fullhouse:3 | fullhouse:3{3331010} | fullhouse:3{3331010} | d:✓ j:✓ |
| s035 |  | pass | pass | pass | d:✓ j:✓ |
| s036 |  | pass | pass | pass | d:✓ j:✓ |
| s037 |  | pass | pass | pass | d:✓ j:✓ |
| s038 |  | bomb:2 | bomb:2{2222} | bomb:2{2222} | d:✓ j:✓ |
| s039 |  | pass | pass | pass | d:✓ j:✓ |
| s040 |  | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| s041 |  | single:2 | single:6{6} | single:6{6} | d:✓ j:✓ |
| s042 |  | pair:6 | pass | pass | d:✓ j:✓ |
| s043 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| s044 |  | pair:Q | pair:Q{QQ} | pair:Q{QQ} | d:✓ j:✓ |
| s045 |  | pass | pass | pass | d:✓ j:✓ |
| s046 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| s047 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| s048 |  | bomb:4 | bomb:4{4444} | bomb:4{4444} | d:✓ j:✓ |
| s049 |  | pass | pass | pass | d:✓ j:✓ |
| s050 |  | bomb:8 | bomb:8{8888} | bomb:8{8888} | d:✓ j:✓ |
| s051 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| s052 |  | pass | pass | pass | d:✓ j:✓ |
| s053 |  | triple:6 | single:RJ{RJ} | single:6{6} | d:✗ j:✗ |
| s054 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| s055 |  | pass | pass | pass | d:✓ j:✓ |
| s056 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| s057 |  | bomb:A | bomb:A{AAAA} | bomb:A{AAAA} | d:✓ j:✓ |
| s058 |  | single:2 | single:3{3} | single:2{2} | d:✗ j:✓ |
| s059 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| s060 |  | pass | pass | pass | d:✓ j:✓ |
| s061 |  | single:RJ | pass | pass | d:✗ j:✗ |
| s062 |  | bomb:K | bomb:K{KKKKK} | bomb:K{KKKKK} | d:✓ j:✓ |
| s063 |  | pass | pass | pass | d:✓ j:✓ |
| s064 |  | fullhouse:2 | bomb:3{33332} | bomb:3{3333} | d:✗ j:✗ |
| s065 |  | pass | pass | pass | d:✓ j:✓ |
| s066 |  | bomb:8 | single:6{6} | single:6{6} | d:✗ j:✗ |
| s067 |  | pass | pass | pass | d:✓ j:✓ |
| s068 |  | pair:6 | pair:K{KK} | pair:K{KK} | d:✓ j:✓ |
| s069 |  | pass | pass | pass | d:✓ j:✓ |
| s070 |  | pass | pass | pass | d:✓ j:✓ |
| s071 |  | pass | pass | pass | d:✓ j:✓ |
| s072 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| s073 |  | bomb:9 | bomb:9{99999} | bomb:9{99999} | d:✓ j:✓ |
| s074 |  | bomb:3 | bomb:3{3333} | bomb:3{3333} | d:✓ j:✓ |
| s075 |  | pair:3 | pair:3{39} | pair:3{39} | d:✓ j:✓ |
| s076 |  | pass | pass | pass | d:✓ j:✓ |
| s077 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| s078 |  | pass | single:7{7} | single:7{7} | d:✗ j:✗ |
| s079 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| s080 |  | pass | pass | pass | d:✓ j:✓ |
| s081 |  | pass | pass | single:RJ{RJ} | d:✓ j:✗ |
| s082 |  | pass | pass | pass | d:✓ j:✓ |
| s083 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| s084 |  | pass | pass | pass | d:✓ j:✓ |
| s085 |  | pass | single:10{10} | single:10{10} | d:✗ j:✗ |
| s086 |  | single:2/3 | single:2{2} | single:3{3} | d:✓ j:✓ |
| s087 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| s088 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| s089 |  | straight:J | straight:J{78910J} | straight:J{78910J} | d:✓ j:✓ |
| s090 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| s091 |  | pass | pass | pass | d:✓ j:✓ |
| s092 |  | single:6 | single:5{5} | single:5{5} | d:✗ j:✗ |
| s093 |  | single:A/K/BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| s094 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| s095 |  | fullhouse:5/8 | fullhouse:5{55566} | fullhouse:5{55566} | d:✓ j:✓ |
| s096 |  | pair:2 | single:5{5} | pair:2{22} | d:✓ j:✓ |
| s097 |  | pass | pass | pass | d:✓ j:✓ |
| s098 |  | pass | pass | pass | d:✓ j:✓ |
| s099 |  | pass | pass | pass | d:✓ j:✓ |
| s100 |  | pair:Q | single:4{4} | single:4{4} | d:✗ j:✗ |
| s101 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| s102 |  | pass | pass | pass | d:✓ j:✓ |
| s103 |  | pass | pass | pass | d:✓ j:✓ |
| s104 |  | pass | pass | pass | d:✓ j:✓ |
| s105 |  | single:9 | single:9{9} | single:9{9} | d:✓ j:✓ |
| s106 |  | pass | pass | single:K{K} | d:✓ j:✗ |
| s107 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| s108 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| s109 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| s110 |  | bomb:5 | bomb:5{5555} | bomb:5{5555} | d:✓ j:✓ |
| s111 |  | bomb:9 | bomb:9{9999} | pair:9{99} | d:✓ j:✗ |
| s112 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| s113 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| s114 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| s115 |  | pair:9 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| s116 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| s117 |  | pass | pass | pass | d:✓ j:✓ |
| s118 |  | pass | pass | pass | d:✓ j:✓ |
| s119 |  | pass | pass | pass | d:✓ j:✓ |
| s120 |  | pass | pass | pass | d:✓ j:✓ |
