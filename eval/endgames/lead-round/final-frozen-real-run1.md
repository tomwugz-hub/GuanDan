# Pair eval report

- generated: 2026-10-17T07:34:13.085Z
- file: frozen-real.jsonl
- cases: 120, pairs: 0
- gold legality: 120/120 legal

| system | case acc | pair acc |
|---|---|---|
| decide | 110/120 (91.7%) | - |
| jev | 109/120 (90.8%) | - |

| id | pivot | gold | decide | jev | ok |
|---|---|---|---|---|---|
| r001 |  | single:BJ | pass | single:10{10} | d:✓ j:✗ |
| r002 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r003 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| r004 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r005 |  | pass | pass | pass | d:✓ j:✓ |
| r006 |  | single:3/4/10 | single:4{4} | single:3{3} | d:✓ j:✓ |
| r007 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| r008 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r009 |  | straight:6 | straight:6{23456} | straight:6{23456} | d:✓ j:✓ |
| r010 |  | pair:8 | pass | pass | d:✗ j:✗ |
| r011 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| r012 |  | single:5 | single:5{5} | single:5{5} | d:✓ j:✓ |
| r013 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| r014 |  | pass | pass | pass | d:✓ j:✓ |
| r015 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| r016 |  | pass | pass | pass | d:✓ j:✓ |
| r017 |  | pass | pass | pass | d:✓ j:✓ |
| r018 |  | pass | pass | pass | d:✓ j:✓ |
| r019 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r020 |  | pass | pass | pass | d:✓ j:✓ |
| r021 |  | single:10/RJ | single:10{10} | single:RJ{RJ} | d:✓ j:✓ |
| r022 |  | pass | pass | pass | d:✓ j:✓ |
| r023 |  | fullhouse:3 | pair:RJ{RJRJ} | pair:RJ{RJRJ} | d:✓ j:✓ |
| r024 |  | single:BJ | single:BJ{BJ} | single:BJ{BJ} | d:✓ j:✓ |
| r025 |  | bomb:7 | bomb:7{7777} | bomb:7{7777} | d:✓ j:✓ |
| r026 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| r027 |  | pass | pass | pass | d:✓ j:✓ |
| r028 |  | pass | pass | pass | d:✓ j:✓ |
| r029 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| r030 |  | single:BJ/A | pass | single:A{A} | d:✗ j:✓ |
| r031 |  | pass | pass | pass | d:✓ j:✓ |
| r032 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| r033 |  | pass | pass | pass | d:✓ j:✓ |
| r034 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| r035 |  | pass | pass | pass | d:✓ j:✓ |
| r036 |  | pair:RJ/Q | pair:RJ{RJRJ} | pair:8{8Q} | d:✓ j:✗ |
| r037 |  | single:3/6/9 | single:9{9} | single:3{3} | d:✓ j:✓ |
| r038 |  | pair:3 | pair:3{33} | pair:3{33} | d:✓ j:✓ |
| r039 |  | pair: | pair:J{J9} | pair:9{99} | d:✓ j:✓ |
| r040 |  | single:3/5 | single:3{3} | single:3{3} | d:✓ j:✓ |
| r041 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| r042 |  | single:J | single:J{J} | single:J{J} | d:✓ j:✓ |
| r043 |  | bomb:9 | bomb:9{99997} | bomb:9{99997} | d:✓ j:✓ |
| r044 |  | single:Q | pass | pass | d:✗ j:✗ |
| r045 |  | bomb:3 | bomb:3{3333} | bomb:3{3333} | d:✓ j:✓ |
| r046 |  | pass | pass | pass | d:✓ j:✓ |
| r047 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| r048 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| r049 |  | pass | pass | pass | d:✓ j:✓ |
| r050 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r051 |  | single:9/6 | single:9{9} | single:6{6} | d:✓ j:✓ |
| r052 |  | pass | pass | pass | d:✓ j:✓ |
| r053 |  | single:4 | single:Q{Q} | single:Q{Q} | d:✗ j:✗ |
| r054 |  | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| r055 |  | single:10 | single:10{10} | single:10{10} | d:✓ j:✓ |
| r056 |  | bomb:4 | single:10{10} | single:10{10} | d:✓ j:✓ |
| r057 |  | pass | pass | pass | d:✓ j:✓ |
| r058 |  | single:3 | single:3{3} | single:3{3} | d:✓ j:✓ |
| r059 |  | pass | pass | pass | d:✓ j:✓ |
| r060 |  | pair:Q | pass | pass | d:✗ j:✗ |
| r061 |  | pass | pass | pass | d:✓ j:✓ |
| r062 |  | pair:2 | pair:2{22} | pair:2{22} | d:✓ j:✓ |
| r063 |  | pass | pass | pass | d:✓ j:✓ |
| r064 |  | pair:5 | pair:5{55} | pair:5{55} | d:✓ j:✓ |
| r065 |  | pair:8 | bomb:2{2228} | bomb:2{2228} | d:✗ j:✗ |
| r066 |  | pass | pass | pass | d:✓ j:✓ |
| r067 |  | pair:8 | pair:8{88} | pair:8{88} | d:✓ j:✓ |
| r068 |  | pass | pass | pass | d:✓ j:✓ |
| r069 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r070 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| r071 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r072 |  | single:10/J | single:10{10} | single:10{10} | d:✓ j:✓ |
| r073 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| r074 |  | triple:2 | triple:2{222} | triple:2{222} | d:✓ j:✓ |
| r075 |  | pass | pass | pass | d:✓ j:✓ |
| r076 |  | triple:2 | triple:2{222} | triple:2{222} | d:✓ j:✓ |
| r077 |  | single:4 | single:4{4} | single:4{4} | d:✓ j:✓ |
| r078 |  | pass | pass | pass | d:✓ j:✓ |
| r079 |  | single:BJ | pass | pass | d:✓ j:✓ |
| r080 |  | pass | pass | pass | d:✓ j:✓ |
| r081 |  | single:10/J | single:10{10} | single:J{J} | d:✓ j:✓ |
| r082 |  | pair:6 | pair:6{66} | pair:6{66} | d:✓ j:✓ |
| r083 |  | single:9/A | single:A{A} | single:A{A} | d:✓ j:✓ |
| r084 |  | single:BJ | pass | single:BJ{BJ} | d:✗ j:✓ |
| r085 |  | pass | pass | pass | d:✓ j:✓ |
| r086 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| r087 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| r088 |  | single:A | single:A{A} | single:A{A} | d:✓ j:✓ |
| r089 |  | pair:6 | pair:6{66} | pair:6{66} | d:✓ j:✓ |
| r090 |  | pair:9/7 | pair:9{99} | pair:9{99} | d:✓ j:✓ |
| r091 |  | single:K | single:J{J} | single:J{J} | d:✗ j:✗ |
| r092 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| r093 |  | bomb:10 | bomb:10{10101010103} | bomb:10{10101010103} | d:✓ j:✓ |
| r094 |  | single:8 | single:8{8} | single:8{8} | d:✓ j:✓ |
| r095 |  | straight: | straight:8{45678} | straight:8{45678} | d:✓ j:✓ |
| r096 |  | single:10/BJ | single:10{10} | single:10{10} | d:✓ j:✓ |
| r097 |  | pair:2/3 | pair:3{33} | pair:2{22} | d:✓ j:✓ |
| r098 |  | single:Q | single:Q{Q} | single:Q{Q} | d:✓ j:✓ |
| r099 |  | pass | pass | pass | d:✓ j:✓ |
| r100 |  | pass | pass | pass | d:✓ j:✓ |
| r101 |  | single:6 | single:6{6} | single:6{6} | d:✓ j:✓ |
| r102 |  | pass | pass | pass | d:✓ j:✓ |
| r103 |  | pass | pass | pass | d:✓ j:✓ |
| r104 |  | pair:10 | pair:10{1010} | pair:10{1010} | d:✓ j:✓ |
| r105 |  | fullhouse:J | fullhouse:J{JJJKK} | fullhouse:J{JJJKK} | d:✓ j:✓ |
| r106 |  | single:2 | single:2{2} | single:2{2} | d:✓ j:✓ |
| r107 |  | single:RJ | single:RJ{RJ} | single:RJ{RJ} | d:✓ j:✓ |
| r108 |  | pass | pass | single:3{3} | d:✓ j:✓ |
| r109 |  | bomb:3 | bomb:3{33333} | bomb:3{33333} | d:✓ j:✓ |
| r110 |  | pass | pass | pass | d:✓ j:✓ |
| r111 |  | pass | pass | pass | d:✓ j:✓ |
| r112 |  | pair: | pair:A{AA} | pair:A{AA} | d:✓ j:✓ |
| r113 |  | triple:6 | single:5{5} | single:5{5} | d:✗ j:✗ |
| r114 |  | single:6 | single:6{6} | single:K{K} | d:✓ j:✗ |
| r115 |  | pass | single:BJ{BJ} | single:BJ{BJ} | d:✗ j:✗ |
| r116 |  | bomb:2 | bomb:2{2222} | bomb:2{2222} | d:✓ j:✓ |
| r117 |  | single:7 | single:7{7} | single:7{7} | d:✓ j:✓ |
| r118 |  | pair:7 | pair:7{77} | pair:7{77} | d:✓ j:✓ |
| r119 |  | pass | pass | pass | d:✓ j:✓ |
| r120 |  | pass | pass | pass | d:✓ j:✓ |
